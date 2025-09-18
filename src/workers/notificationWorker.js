const queueManager = require("../queues/notificationQueue")
const firebaseService = require("../services/firebaseService")
const db = require("../database/connection")
const logger = require("../utils/logger")

class NotificationWorker {
  constructor() {
    this.isRunning = false
  }

  async start() {
    if (this.isRunning) {
      logger.warn("Worker ya está ejecutándose")
      return
    }

    this.isRunning = true
    logger.info("Iniciando workers de notificaciones...")

    try {
      await db.connect()
      logger.info("Conexión a base de datos establecida")

      await this.testRedisConnection()

      // Configurar procesadores de colas
      this.setupSingleNotificationProcessor()
      this.setupBatchNotificationProcessor()
      this.setupRetryNotificationProcessor()

      logger.info("Workers de notificaciones iniciados exitosamente")
    } catch (error) {
      logger.error("Error al iniciar workers:", error)
      this.isRunning = false
      throw error
    }
  }

  async testRedisConnection() {
    try {
      const stats = await queueManager.getQueueStats()
      logger.info("Conexión a Redis verificada exitosamente")
      return true
    } catch (error) {
      logger.error("Error conectando a Redis:", error)
      throw new Error(`No se puede conectar a Redis: ${error.message}`)
    }
  }

  setupSingleNotificationProcessor() {
    queueManager.singleNotificationQueue.process("send-single", 5, async (job) => {
      const { id, fcmToken, title, message, additionalData, notificationType, priority } = job.data

      logger.info(`Procesando notificación individual: ${id}`)

      try {
        // Actualizar estado a procesando
        await db.run(`UPDATE pending_notifications SET status = 'processing' WHERE id = ?`, [id])

        // Enviar notificación
        const result = await firebaseService.sendNotification({
          fcmToken,
          title,
          message,
          additionalData,
          notificationType,
          priority,
        })

        if (result.success) {
          // Marcar como enviada y mover al historial
          await this.moveToHistory(id, result, "sent")
          await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [id])

          logger.info(`Notificación ${id} enviada exitosamente`)
          return { success: true, messageId: result.messageId }
        } else {
          // Manejar error
          await this.handleNotificationError(id, result, job)
          throw new Error(result.error)
        }
      } catch (error) {
        logger.error(`Error procesando notificación ${id}:`, error)
        await this.handleNotificationError(id, { error: error.message }, job)
        throw error
      }
    })
  }

  setupBatchNotificationProcessor() {
    queueManager.batchNotificationQueue.process("send-batch", 2, async (job) => {
      const { notifications } = job.data

      logger.info(`Procesando lote de ${notifications.length} notificaciones`)

      try {
        // Actualizar estado de todas las notificaciones a procesando
        const ids = notifications.map((n) => n.id)
        await db.run(
          `UPDATE pending_notifications SET status = 'processing' WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids,
        )

        // Enviar lote
        const result = await firebaseService.sendBatchNotifications(notifications)

        // Procesar resultados individuales
        for (let i = 0; i < result.results.length; i++) {
          const notificationResult = result.results[i]
          const notification = notifications[i]

          if (notificationResult.success) {
            await this.moveToHistory(notification.id, notificationResult, "sent")
            await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notification.id])
          } else {
            await this.handleBatchNotificationError(notification.id, notificationResult)
          }
        }

        logger.info(`Lote procesado: ${result.successCount} exitosas, ${result.failureCount} fallidas`)

        return {
          successCount: result.successCount,
          failureCount: result.failureCount,
          totalProcessed: notifications.length,
        }
      } catch (error) {
        logger.error("Error procesando lote:", error)

        // Marcar todas las notificaciones como fallidas
        const ids = notifications.map((n) => n.id)
        await db.run(
          `UPDATE pending_notifications SET status = 'failed', error_message = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
          [error.message, ...ids],
        )

        throw error
      }
    })
  }

  setupRetryNotificationProcessor() {
    queueManager.retryQueue.process("retry-notification", 3, async (job) => {
      const { id, fcmToken, title, message, additionalData, notificationType, priority, retryAttempt } = job.data

      logger.info(`Procesando reintento ${retryAttempt} para notificación: ${id}`)

      try {
        // Enviar notificación
        const result = await firebaseService.sendNotification({
          fcmToken,
          title,
          message,
          additionalData,
          notificationType,
          priority,
        })

        if (result.success) {
          // Marcar como enviada y mover al historial
          await this.moveToHistory(id, result, "sent", retryAttempt)
          await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [id])

          logger.info(`Reintento ${retryAttempt} para notificación ${id} exitoso`)
          return { success: true, messageId: result.messageId, retryAttempt }
        } else {
          // Si es un token inválido, no reintentar más
          if (result.isTokenInvalid) {
            await this.moveToHistory(id, result, "invalid_token", retryAttempt)
            await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [id])
            logger.info(`Token inválido detectado en reintento para notificación ${id}`)
            return { success: false, reason: "invalid_token" }
          }

          // Actualizar contador de intentos
          await db.run(`UPDATE pending_notifications SET attempts = ?, error_message = ? WHERE id = ?`, [
            retryAttempt,
            result.error,
            id,
          ])

          throw new Error(result.error)
        }
      } catch (error) {
        logger.error(`Error en reintento ${retryAttempt} para notificación ${id}:`, error)

        // Actualizar contador de intentos
        await db.run(`UPDATE pending_notifications SET attempts = ?, error_message = ? WHERE id = ?`, [
          retryAttempt,
          error.message,
          id,
        ])

        throw error
      }
    })
  }

  async handleNotificationError(notificationId, result, job) {
    try {
      const maxAttempts = Number.parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3

      if (result.isTokenInvalid) {
        // Token inválido, no reintentar
        await this.moveToHistory(notificationId, result, "invalid_token")
        await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notificationId])
        logger.info(`Token inválido para notificación ${notificationId}, no se reintentará`)
        return
      }

      if (result.isRetryable && job.attemptsMade < maxAttempts) {
        // Programar reintento
        const notification = await db.get(`SELECT * FROM pending_notifications WHERE id = ?`, [notificationId])

        if (notification) {
          await queueManager.addRetryNotification(
            {
              id: notificationId,
              fcmToken: notification.fcm_token,
              title: notification.title,
              message: notification.message,
              additionalData: notification.additional_data,
              notificationType: notification.notification_type,
              priority: notification.priority,
            },
            job.id,
          )

          await db.run(`UPDATE pending_notifications SET status = 'pending', attempts = ? WHERE id = ?`, [
            job.attemptsMade + 1,
            notificationId,
          ])

          logger.info(`Reintento programado para notificación ${notificationId}`)
        }
      } else {
        // Máximo de intentos alcanzado o error no recuperable
        await this.moveToHistory(notificationId, result, "failed", job.attemptsMade + 1)
        await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notificationId])
        logger.info(`Notificación ${notificationId} marcada como fallida después de ${job.attemptsMade + 1} intentos`)
      }
    } catch (error) {
      logger.error(`Error manejando fallo de notificación ${notificationId}:`, error)
    }
  }

  async handleBatchNotificationError(notificationId, result) {
    try {
      if (result.error && result.error.code) {
        const errorInfo = firebaseService.classifyError(result.error)

        if (errorInfo.isTokenInvalid) {
          await this.moveToHistory(notificationId, result, "invalid_token")
          await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notificationId])
          return
        }
      }

      // Para errores en lotes, marcar como fallida directamente
      await this.moveToHistory(notificationId, result, "failed")
      await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notificationId])
    } catch (error) {
      logger.error(`Error manejando fallo de notificación en lote ${notificationId}:`, error)
    }
  }

  async moveToHistory(originalId, result, status, attempts = 1) {
    try {
      // Obtener datos originales
      const original = await db.get(`SELECT * FROM pending_notifications WHERE id = ?`, [originalId])

      if (!original) {
        logger.warn(`No se encontró notificación original con ID ${originalId}`)
        return
      }

      // Insertar en historial
      await db.run(
        `INSERT INTO notification_history 
         (original_id, fcm_token, title, message, additional_data, notification_type, priority, 
          status, attempts, response_data, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          originalId,
          original.fcm_token,
          original.title,
          original.message,
          original.additional_data,
          original.notification_type,
          original.priority,
          status,
          attempts,
          result.messageId ? JSON.stringify({ messageId: result.messageId }) : null,
          result.error || null,
        ],
      )

      logger.debug(`Notificación ${originalId} movida al historial con estado: ${status}`)
    } catch (error) {
      logger.error(`Error moviendo notificación ${originalId} al historial:`, error)
    }
  }

  async stop() {
    if (!this.isRunning) {
      return
    }

    logger.info("Deteniendo workers de notificaciones...")

    try {
      await queueManager.close()
      await db.close()
      this.isRunning = false
      logger.info("Workers detenidos exitosamente")
    } catch (error) {
      logger.error("Error al detener workers:", error)
      throw error
    }
  }
}

// Crear instancia del worker
const worker = new NotificationWorker()

// Manejo de señales para cierre graceful
process.on("SIGTERM", async () => {
  logger.info("Recibida señal SIGTERM, deteniendo worker...")
  await worker.stop()
  process.exit(0)
})

process.on("SIGINT", async () => {
  logger.info("Recibida señal SIGINT, deteniendo worker...")
  await worker.stop()
  process.exit(0)
})

process.on("uncaughtException", (error) => {
  logger.error("Error no capturado:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Promesa rechazada no manejada:", reason)
  process.exit(1)
})

// Iniciar worker si se ejecuta directamente
if (require.main === module) {
  worker
    .start()
    .then(() => {
      logger.info("Worker iniciado, presiona Ctrl+C para detener")
    })
    .catch((error) => {
      logger.error("Error al iniciar worker:", error)
      process.exit(1)
    })
}

module.exports = worker
