const cron = require("node-cron")
const db = require("../database/connection")
const queueManager = require("../queues/notificationQueue")
const logger = require("../utils/logger")

class ScheduledWorker {
  constructor() {
    this.isRunning = false
    this.cronJobs = []
  }

  async start() {
    if (this.isRunning) {
      logger.warn("Scheduled worker ya está ejecutándose")
      return
    }

    this.isRunning = true
    logger.info("Iniciando scheduled worker...")

    try {
      await db.connect()

      // Procesar notificaciones programadas cada minuto
      const scheduledJob = cron.schedule("* * * * *", async () => {
        await this.processScheduledNotifications()
      })

      // Limpiar colas cada hora
      const cleanupJob = cron.schedule("0 * * * *", async () => {
        await this.cleanupQueues()
      })

      // Limpiar historial antiguo cada día a las 2 AM
      const historyCleanupJob = cron.schedule("0 2 * * *", async () => {
        await this.cleanupOldHistory()
      })

      this.cronJobs = [scheduledJob, cleanupJob, historyCleanupJob]

      logger.info("Scheduled worker iniciado exitosamente")
    } catch (error) {
      logger.error("Error al iniciar scheduled worker:", error)
      this.isRunning = false
      throw error
    }
  }

  async processScheduledNotifications() {
    try {
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
        return
      }

      logger.info(`Procesando ${scheduledNotifications.length} notificaciones programadas`)

      // Agrupar por prioridad para procesamiento eficiente
      const highPriority = scheduledNotifications.filter((n) => n.priority === "high")
      const normalPriority = scheduledNotifications.filter((n) => n.priority === "normal")

      // Procesar notificaciones de alta prioridad individualmente
      for (const notification of highPriority) {
        await queueManager.addSingleNotification({
          id: notification.id,
          fcmToken: notification.fcm_token,
          title: notification.title,
          message: notification.message,
          additionalData: notification.additional_data,
          notificationType: notification.notification_type,
          priority: notification.priority,
        })
      }

      // Procesar notificaciones normales en lotes
      if (normalPriority.length > 0) {
        const batchSize = 50
        for (let i = 0; i < normalPriority.length; i += batchSize) {
          const batch = normalPriority.slice(i, i + batchSize).map((notification) => ({
            id: notification.id,
            fcmToken: notification.fcm_token,
            title: notification.title,
            message: notification.message,
            additionalData: notification.additional_data,
            notificationType: notification.notification_type,
            priority: notification.priority,
          }))

          await queueManager.addBatchNotifications(batch)
        }
      }

      logger.info(
        `Agregadas a la cola: ${highPriority.length} alta prioridad, ${normalPriority.length} prioridad normal`,
      )
    } catch (error) {
      logger.error("Error procesando notificaciones programadas:", error)
    }
  }

  async cleanupQueues() {
    try {
      await queueManager.cleanQueues()
      logger.info("Limpieza automática de colas completada")
    } catch (error) {
      logger.error("Error en limpieza automática de colas:", error)
    }
  }

  async cleanupOldHistory() {
    try {
      // Eliminar historial de más de 30 días
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const result = await db.run(`DELETE FROM notification_history WHERE sent_at < ?`, [thirtyDaysAgo.toISOString()])

      logger.info(`Limpieza de historial completada: ${result.changes} registros eliminados`)

      // Eliminar tokens inválidos de más de 7 días
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const tokenResult = await db.run(`DELETE FROM invalid_tokens WHERE marked_invalid_at < ?`, [
        sevenDaysAgo.toISOString(),
      ])

      logger.info(`Limpieza de tokens inválidos completada: ${tokenResult.changes} registros eliminados`)
    } catch (error) {
      logger.error("Error en limpieza de historial:", error)
    }
  }

  async stop() {
    if (!this.isRunning) {
      return
    }

    logger.info("Deteniendo scheduled worker...")

    try {
      // Detener todos los cron jobs
      this.cronJobs.forEach((job) => job.destroy())
      this.cronJobs = []

      await db.close()
      this.isRunning = false
      logger.info("Scheduled worker detenido exitosamente")
    } catch (error) {
      logger.error("Error al detener scheduled worker:", error)
      throw error
    }
  }
}

// Crear instancia del worker
const scheduledWorker = new ScheduledWorker()

// Manejo de señales para cierre graceful
process.on("SIGTERM", async () => {
  logger.info("Recibida señal SIGTERM, deteniendo scheduled worker...")
  await scheduledWorker.stop()
  process.exit(0)
})

process.on("SIGINT", async () => {
  logger.info("Recibida señal SIGINT, deteniendo scheduled worker...")
  await scheduledWorker.stop()
  process.exit(0)
})

// Iniciar worker si se ejecuta directamente
if (require.main === module) {
  scheduledWorker
    .start()
    .then(() => {
      logger.info("Scheduled worker iniciado, presiona Ctrl+C para detener")
    })
    .catch((error) => {
      logger.error("Error al iniciar scheduled worker:", error)
      process.exit(1)
    })
}

module.exports = scheduledWorker
