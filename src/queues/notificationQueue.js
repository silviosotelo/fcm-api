const Queue = require("bull")
const Redis = require("redis")
const logger = require("../utils/logger")
require("dotenv").config()

class NotificationQueueManager {
  constructor() {
    this.redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    }

    // Crear las colas
    this.singleNotificationQueue = new Queue("single notifications", {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Mantener solo los últimos 100 trabajos completados
        removeOnFail: 50, // Mantener solo los últimos 50 trabajos fallidos
        attempts: Number.parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
        backoff: {
          type: "exponential",
          delay: Number.parseInt(process.env.RETRY_DELAY_MS) || 5000,
        },
      },
    })

    this.batchNotificationQueue = new Queue("batch notifications", {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2, // Menos reintentos para lotes
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      },
    })

    this.retryQueue = new Queue("retry notifications", {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 1, // Solo un intento para reintentos
        delay: 30000, // Retrasar reintentos 30 segundos
      },
    })

    this.setupEventListeners()
  }

  setupEventListeners() {
    // Eventos para cola de notificaciones individuales
    this.singleNotificationQueue.on("completed", (job, result) => {
      logger.info(`Trabajo completado: ${job.id}`, { jobId: job.id, result })
    })

    this.singleNotificationQueue.on("failed", (job, err) => {
      logger.error(`Trabajo fallido: ${job.id}`, { jobId: job.id, error: err.message })
    })

    this.singleNotificationQueue.on("stalled", (job) => {
      logger.warn(`Trabajo estancado: ${job.id}`, { jobId: job.id })
    })

    // Eventos para cola de lotes
    this.batchNotificationQueue.on("completed", (job, result) => {
      logger.info(`Lote completado: ${job.id}`, {
        jobId: job.id,
        successCount: result.successCount,
        failureCount: result.failureCount,
      })
    })

    this.batchNotificationQueue.on("failed", (job, err) => {
      logger.error(`Lote fallido: ${job.id}`, { jobId: job.id, error: err.message })
    })

    // Eventos para cola de reintentos
    this.retryQueue.on("completed", (job, result) => {
      logger.info(`Reintento completado: ${job.id}`, { jobId: job.id, result })
    })

    this.retryQueue.on("failed", (job, err) => {
      logger.error(`Reintento fallido: ${job.id}`, { jobId: job.id, error: err.message })
    })
  }

  async addSingleNotification(notificationData, options = {}) {
    try {
      const job = await this.singleNotificationQueue.add("send-single", notificationData, {
        priority: notificationData.priority === "high" ? 10 : 5,
        delay: options.delay || 0,
        ...options,
      })

      logger.info(`Notificación individual agregada a la cola: ${job.id}`)
      return job
    } catch (error) {
      logger.error("Error al agregar notificación individual a la cola:", error)
      throw error
    }
  }

  async addBatchNotifications(notifications, options = {}) {
    try {
      const job = await this.batchNotificationQueue.add("send-batch", { notifications }, options)

      logger.info(`Lote de ${notifications.length} notificaciones agregado a la cola: ${job.id}`)
      return job
    } catch (error) {
      logger.error("Error al agregar lote de notificaciones a la cola:", error)
      throw error
    }
  }

  async addRetryNotification(notificationData, originalJobId, options = {}) {
    try {
      const job = await this.retryQueue.add(
        "retry-notification",
        {
          ...notificationData,
          originalJobId,
          retryAttempt: (notificationData.retryAttempt || 0) + 1,
        },
        options,
      )

      logger.info(`Reintento agregado a la cola: ${job.id} (original: ${originalJobId})`)
      return job
    } catch (error) {
      logger.error("Error al agregar reintento a la cola:", error)
      throw error
    }
  }

  async getQueueStats() {
    try {
      const singleStats = {
        waiting: await this.singleNotificationQueue.getWaiting(),
        active: await this.singleNotificationQueue.getActive(),
        completed: await this.singleNotificationQueue.getCompleted(),
        failed: await this.singleNotificationQueue.getFailed(),
        delayed: await this.singleNotificationQueue.getDelayed(),
      }

      const batchStats = {
        waiting: await this.batchNotificationQueue.getWaiting(),
        active: await this.batchNotificationQueue.getActive(),
        completed: await this.batchNotificationQueue.getCompleted(),
        failed: await this.batchNotificationQueue.getFailed(),
        delayed: await this.batchNotificationQueue.getDelayed(),
      }

      const retryStats = {
        waiting: await this.retryQueue.getWaiting(),
        active: await this.retryQueue.getActive(),
        completed: await this.retryQueue.getCompleted(),
        failed: await this.retryQueue.getFailed(),
        delayed: await this.retryQueue.getDelayed(),
      }

      return {
        single: {
          waiting: singleStats.waiting.length,
          active: singleStats.active.length,
          completed: singleStats.completed.length,
          failed: singleStats.failed.length,
          delayed: singleStats.delayed.length,
        },
        batch: {
          waiting: batchStats.waiting.length,
          active: batchStats.active.length,
          completed: batchStats.completed.length,
          failed: batchStats.failed.length,
          delayed: batchStats.delayed.length,
        },
        retry: {
          waiting: retryStats.waiting.length,
          active: retryStats.active.length,
          completed: retryStats.completed.length,
          failed: retryStats.failed.length,
          delayed: retryStats.delayed.length,
        },
      }
    } catch (error) {
      logger.error("Error al obtener estadísticas de las colas:", error)
      throw error
    }
  }

  async pauseQueues() {
    await Promise.all([
      this.singleNotificationQueue.pause(),
      this.batchNotificationQueue.pause(),
      this.retryQueue.pause(),
    ])
    logger.info("Todas las colas pausadas")
  }

  async resumeQueues() {
    await Promise.all([
      this.singleNotificationQueue.resume(),
      this.batchNotificationQueue.resume(),
      this.retryQueue.resume(),
    ])
    logger.info("Todas las colas reanudadas")
  }

  async cleanQueues() {
    try {
      await Promise.all([
        this.singleNotificationQueue.clean(24 * 60 * 60 * 1000, "completed"), // Limpiar completados de más de 24h
        this.singleNotificationQueue.clean(7 * 24 * 60 * 60 * 1000, "failed"), // Limpiar fallidos de más de 7 días
        this.batchNotificationQueue.clean(24 * 60 * 60 * 1000, "completed"),
        this.batchNotificationQueue.clean(7 * 24 * 60 * 60 * 1000, "failed"),
        this.retryQueue.clean(24 * 60 * 60 * 1000, "completed"),
        this.retryQueue.clean(7 * 24 * 60 * 60 * 1000, "failed"),
      ])
      logger.info("Colas limpiadas exitosamente")
    } catch (error) {
      logger.error("Error al limpiar las colas:", error)
      throw error
    }
  }

  async close() {
    await Promise.all([
      this.singleNotificationQueue.close(),
      this.batchNotificationQueue.close(),
      this.retryQueue.close(),
    ])
    logger.info("Conexiones de colas cerradas")
  }
}

module.exports = new NotificationQueueManager()
