const db = require("../database/connection")
const firebaseService = require("./firebaseService")
const logger = require("../utils/logger")

class NotificationService {
  async createAndSendNotification(notificationData) {
    try {
      if (!db.db) {
        await db.connect()
      }

      const {
        fcmToken,
        title,
        message,
        additionalData,
        notificationType = "notification",
        priority = "normal",
        scheduledAt,
      } = notificationData

      // Si está programada para el futuro, insertar en pending
      if (scheduledAt && new Date(scheduledAt) > new Date()) {
        const result = await db.run(
          `INSERT INTO pending_notifications 
           (fcm_token, title, message, additional_data, notification_type, priority, scheduled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            fcmToken,
            title,
            message,
            additionalData ? JSON.stringify(additionalData) : null,
            notificationType,
            priority,
            scheduledAt,
          ],
        )

        logger.info(`Notificación programada creada: ${result.id}`)
        
        return {
          id: result.id,
          status: "scheduled",
          scheduledAt: scheduledAt,
          message: "Notificación programada exitosamente"
        }
      }

      // Enviar inmediatamente
      const sendResult = await firebaseService.sendNotification(notificationData)

      // Guardar en historial
      await this.saveToHistory({
        fcmToken,
        title,
        message,
        additionalData,
        notificationType,
        priority,
        status: sendResult.success ? "sent" : (sendResult.isTokenInvalid ? "invalid_token" : "failed"),
        attempts: 1,
        responseData: sendResult.messageId ? JSON.stringify({ messageId: sendResult.messageId }) : null,
        errorMessage: sendResult.error || null
      })

      if (sendResult.success) {
        logger.info("Notificación enviada exitosamente")
        return {
          status: "sent",
          messageId: sendResult.messageId,
          message: "Notificación enviada exitosamente"
        }
      } else {
        logger.error("Error al enviar notificación:", sendResult.error)
        
        if (sendResult.isTokenInvalid) {
          await this.markTokenAsInvalid(fcmToken, sendResult.error)
        }
        
        throw new Error(`Error al enviar notificación: ${sendResult.error}`)
      }
    } catch (error) {
      logger.error("Error al crear y enviar notificación:", error)
      throw error
    }
  }

  async createAndSendBatchNotifications(notifications) {
    try {
      if (!db.db) {
        await db.connect()
      }

      logger.info(`Procesando lote de ${notifications.length} notificaciones`)

      const results = {
        successful: 0,
        failed: 0,
        invalidTokens: 0,
        details: []
      }

      // Procesar en lotes de 500 (límite de FCM)
      const batchSize = 500
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize)
        
        try {
          const batchResult = await firebaseService.sendBatchNotifications(batch)
          
          // Procesar resultados individuales
          for (let j = 0; j < batchResult.results.length; j++) {
            const notificationResult = batchResult.results[j]
            const originalNotification = batch[j]
            
            const status = notificationResult.success ? "sent" : 
                          (notificationResult.error && this.isTokenInvalid(notificationResult.error) ? "invalid_token" : "failed")
            
            // Guardar en historial
            await this.saveToHistory({
              fcmToken: originalNotification.fcmToken,
              title: originalNotification.title,
              message: originalNotification.message,
              additionalData: originalNotification.additionalData,
              notificationType: originalNotification.notificationType || "notification",
              priority: originalNotification.priority || "normal",
              status,
              attempts: 1,
              responseData: notificationResult.messageId ? JSON.stringify({ messageId: notificationResult.messageId }) : null,
              errorMessage: notificationResult.error?.message || null
            })

            // Contar resultados
            if (notificationResult.success) {
              results.successful++
            } else if (status === "invalid_token") {
              results.invalidTokens++
              await this.markTokenAsInvalid(originalNotification.fcmToken, notificationResult.error?.message)
            } else {
              results.failed++
            }

            results.details.push({
              token: originalNotification.fcmToken,
              status,
              messageId: notificationResult.messageId || null,
              error: notificationResult.error?.message || null
            })
          }
        } catch (error) {
          logger.error(`Error en lote ${Math.floor(i / batchSize) + 1}:`, error)
          
          // Marcar todo el lote como fallido
          for (const notification of batch) {
            await this.saveToHistory({
              fcmToken: notification.fcmToken,
              title: notification.title,
              message: notification.message,
              additionalData: notification.additionalData,
              notificationType: notification.notificationType || "notification",
              priority: notification.priority || "normal",
              status: "failed",
              attempts: 1,
              responseData: null,
              errorMessage: error.message
            })
            
            results.failed++
            results.details.push({
              token: notification.fcmToken,
              status: "failed",
              error: error.message
            })
          }
        }
      }

      logger.info(`Lote completado: ${results.successful} exitosas, ${results.failed} fallidas, ${results.invalidTokens} tokens inválidos`)

      return {
        totalRequested: notifications.length,
        successful: results.successful,
        failed: results.failed,
        invalidTokens: results.invalidTokens,
        details: results.details,
        message: "Lote procesado exitosamente"
      }
    } catch (error) {
      logger.error("Error al crear y enviar lote de notificaciones:", error)
      throw error
    }
  }

  async processScheduledNotifications() {
    try {
      if (!db.db) {
        await db.connect()
      }

      const now = new Date().toISOString()

      // Buscar notificaciones que deben enviarse ahora
      const scheduledNotifications = await db.all(
        `SELECT * FROM pending_notifications 
         WHERE status = 'pending' 
         AND scheduled_at <= ? 
         ORDER BY priority DESC, scheduled_at ASC
         LIMIT 100`,
        [now],
      )

      if (scheduledNotifications.length === 0) {
        return { processed: 0, message: "No hay notificaciones programadas para procesar" }
      }

      logger.info(`Procesando ${scheduledNotifications.length} notificaciones programadas`)

      let successful = 0
      let failed = 0

      for (const notification of scheduledNotifications) {
        try {
          const result = await firebaseService.sendNotification({
            fcmToken: notification.fcm_token,
            title: notification.title,
            message: notification.message,
            additionalData: notification.additional_data,
            notificationType: notification.notification_type,
            priority: notification.priority
          })

          const status = result.success ? "sent" : (result.isTokenInvalid ? "invalid_token" : "failed")

          // Guardar en historial
          await this.saveToHistory({
            originalId: notification.id,
            fcmToken: notification.fcm_token,
            title: notification.title,
            message: notification.message,
            additionalData: notification.additional_data,
            notificationType: notification.notification_type,
            priority: notification.priority,
            status,
            attempts: 1,
            responseData: result.messageId ? JSON.stringify({ messageId: result.messageId }) : null,
            errorMessage: result.error || null
          })

          // Eliminar de pendientes
          await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notification.id])

          if (result.success) {
            successful++
          } else {
            failed++
            if (result.isTokenInvalid) {
              await this.markTokenAsInvalid(notification.fcm_token, result.error)
            }
          }

        } catch (error) {
          logger.error(`Error procesando notificación programada ${notification.id}:`, error)
          failed++
          
          // Marcar como fallida
          await this.saveToHistory({
            originalId: notification.id,
            fcmToken: notification.fcm_token,
            title: notification.title,
            message: notification.message,
            additionalData: notification.additional_data,
            notificationType: notification.notification_type,
            priority: notification.priority,
            status: "failed",
            attempts: 1,
            responseData: null,
            errorMessage: error.message
          })

          await db.run(`DELETE FROM pending_notifications WHERE id = ?`, [notification.id])
        }
      }

      return {
        processed: scheduledNotifications.length,
        successful,
        failed,
        message: `Procesadas ${scheduledNotifications.length} notificaciones programadas`
      }
    } catch (error) {
      logger.error("Error procesando notificaciones programadas:", error)
      throw error
    }
  }

  async saveToHistory(data) {
    try {
      await db.run(
        `INSERT INTO notification_history 
         (original_id, fcm_token, title, message, additional_data, notification_type, priority, 
          status, attempts, response_data, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.originalId || null,
          data.fcmToken,
          data.title,
          data.message,
          data.additionalData,
          data.notificationType,
          data.priority,
          data.status,
          data.attempts,
          data.responseData,
          data.errorMessage,
        ],
      )
    } catch (error) {
      logger.error("Error guardando en historial:", error)
    }
  }

  async markTokenAsInvalid(fcmToken, reason) {
    try {
      await db.run(`INSERT OR IGNORE INTO invalid_tokens (fcm_token, reason) VALUES (?, ?)`, [fcmToken, reason])
      logger.info(`Token marcado como inválido: ${fcmToken}`)
    } catch (error) {
      logger.error("Error al marcar token como inválido:", error)
    }
  }

  isTokenInvalid(error) {
    if (!error) return false
    const errorMessage = error.message?.toLowerCase() || ""
    const errorCode = error.code || ""
    
    const invalidTokenCodes = ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]
    return invalidTokenCodes.includes(errorCode) || 
           errorMessage.includes("not registered") || 
           errorMessage.includes("invalid token")
  }

  async getNotificationHistory(filters = {}) {
    try {
      if (!db.db) {
        await db.connect()
      }

      let query = `SELECT * FROM notification_history WHERE 1=1`
      const params = []

      if (filters.fcmToken) {
        query += ` AND fcm_token = ?`
        params.push(filters.fcmToken)
      }

      if (filters.status) {
        query += ` AND status = ?`
        params.push(filters.status)
      }

      if (filters.fromDate) {
        query += ` AND sent_at >= ?`
        params.push(filters.fromDate)
      }

      if (filters.toDate) {
        query += ` AND sent_at <= ?`
        params.push(filters.toDate)
      }

      query += ` ORDER BY sent_at DESC`

      if (filters.limit) {
        query += ` LIMIT ?`
        params.push(filters.limit)
      }

      const history = await db.all(query, params)
      return history
    } catch (error) {
      logger.error("Error al obtener historial de notificaciones:", error)
      throw error
    }
  }

  async getPendingNotifications() {
    try {
      if (!db.db) {
        await db.connect()
      }

      const pending = await db.all(
        `SELECT * FROM pending_notifications 
         WHERE status = 'pending' 
         ORDER BY scheduled_at ASC`,
      )

      return pending
    } catch (error) {
      logger.error("Error al obtener notificaciones pendientes:", error)
      throw error
    }
  }

  async getNotificationStats() {
    try {
      if (!db.db) {
        await db.connect()
      }

      const stats = await db.get(`
        SELECT 
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'invalid_token' THEN 1 ELSE 0 END) as invalid_tokens
        FROM notification_history
        WHERE DATE(sent_at) = DATE('now')
      `)

      const pendingCount = await db.get(`
        SELECT COUNT(*) as pending 
        FROM pending_notifications 
        WHERE status = 'pending'
      `)

      return {
        today: stats,
        pending: pendingCount.pending,
        message: "Sin sistema de colas - procesamiento directo"
      }
    } catch (error) {
      logger.error("Error al obtener estadísticas:", error)
      throw error
    }
  }
}

module.exports = new NotificationService()