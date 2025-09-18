const db = require("../database/connection")
const firebaseService = require("./firebaseService")
const queueManager = require("../queues/notificationQueue")
const logger = require("../utils/logger")

class NotificationService {
  async createNotification(notificationData) {
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

      // Validar token antes de crear la notificación
      const tokenValidation = await firebaseService.validateToken(fcmToken)
      if (!tokenValidation.valid && tokenValidation.isTokenInvalid) {
        await this.markTokenAsInvalid(fcmToken, tokenValidation.error)
        throw new Error(`Token FCM inválido: ${tokenValidation.error}`)
      }

      // Insertar en base de datos
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
          scheduledAt || new Date().toISOString(),
        ],
      )

      const notificationId = result.id

      // Agregar a la cola
      const delay = scheduledAt ? new Date(scheduledAt).getTime() - Date.now() : 0
      await queueManager.addSingleNotification(
        {
          id: notificationId,
          fcmToken,
          title,
          message,
          additionalData,
          notificationType,
          priority,
        },
        { delay: Math.max(0, delay) },
      )

      logger.info(`Notificación creada y agregada a la cola: ${notificationId}`)

      return {
        id: notificationId,
        status: "queued",
        scheduledAt: scheduledAt || new Date().toISOString(),
      }
    } catch (error) {
      logger.error("Error al crear notificación:", error)
      throw error
    }
  }

  async createBatchNotifications(notifications) {
    try {
      if (!db.db) {
        await db.connect()
      }

      const validNotifications = []
      const invalidTokens = []

      // Validar todos los tokens primero
      for (const notification of notifications) {
        const tokenValidation = await firebaseService.validateToken(notification.fcmToken)
        if (!tokenValidation.valid && tokenValidation.isTokenInvalid) {
          await this.markTokenAsInvalid(notification.fcmToken, tokenValidation.error)
          invalidTokens.push({
            token: notification.fcmToken,
            error: tokenValidation.error,
          })
        } else {
          validNotifications.push(notification)
        }
      }

      if (validNotifications.length === 0) {
        throw new Error("No hay notificaciones válidas para procesar")
      }

      // Insertar notificaciones válidas en la base de datos
      const insertedNotifications = []
      for (const notification of validNotifications) {
        const {
          fcmToken,
          title,
          message,
          additionalData,
          notificationType = "notification",
          priority = "normal",
          scheduledAt,
        } = notification

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
            scheduledAt || new Date().toISOString(),
          ],
        )

        insertedNotifications.push({
          id: result.id,
          fcmToken,
          title,
          message,
          additionalData,
          notificationType,
          priority,
        })
      }

      // Agregar lote a la cola
      await queueManager.addBatchNotifications(insertedNotifications)

      logger.info(`Lote de ${insertedNotifications.length} notificaciones creado y agregado a la cola`)

      return {
        totalRequested: notifications.length,
        validNotifications: insertedNotifications.length,
        invalidTokens: invalidTokens.length,
        invalidTokenDetails: invalidTokens,
        status: "queued",
      }
    } catch (error) {
      logger.error("Error al crear lote de notificaciones:", error)
      throw error
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

  async getNotificationHistory(filters = {}) {
    try {
      await db.connect()

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
      await db.connect()

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
      await db.connect()

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

      const queueStats = await queueManager.getQueueStats()

      return {
        today: stats,
        pending: pendingCount.pending,
        queues: queueStats,
      }
    } catch (error) {
      logger.error("Error al obtener estadísticas:", error)
      throw error
    }
  }
}

module.exports = new NotificationService()
