const admin = require("firebase-admin")
const fs = require("fs")
const path = require("path")
const logger = require("../utils/logger")
require("dotenv").config()

class FirebaseService {
  constructor() {
    this.app = null
    this.messaging = null
    this.initialized = false
  }

  async initialize() {
    try {
      if (this.initialized) {
        return this.messaging
      }

      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH

      if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
        throw new Error(`Archivo de credenciales de Firebase no encontrado: ${serviceAccountPath}`)
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })

      this.messaging = admin.messaging(this.app)
      this.initialized = true

      logger.info("Firebase Admin SDK inicializado correctamente")
      return this.messaging
    } catch (error) {
      logger.error("Error al inicializar Firebase:", error)
      throw error
    }
  }

  async sendNotification(notificationData) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      const { fcmToken, title, message, additionalData, notificationType, priority } = notificationData

      // Validar token FCM
      if (!fcmToken || typeof fcmToken !== "string") {
        throw new Error("Token FCM inválido")
      }

      // Construir el mensaje según el tipo
      const fcmMessage = this.buildMessage(fcmToken, title, message, additionalData, notificationType, priority)

      // Enviar notificación
      const response = await this.messaging.send(fcmMessage)

      logger.info(`Notificación enviada exitosamente: ${response}`)

      return {
        success: true,
        messageId: response,
        token: fcmToken,
      }
    } catch (error) {
      logger.error(`Error al enviar notificación: ${error.message}`)

      // Clasificar tipos de error
      const errorInfo = this.classifyError(error)

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        isRetryable: errorInfo.isRetryable,
        isTokenInvalid: errorInfo.isTokenInvalid,
        token: notificationData.fcmToken,
      }
    }
  }

  async sendBatchNotifications(notifications) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      const messages = notifications.map((notification) => {
        const { fcmToken, title, message, additionalData, notificationType, priority } = notification
        return this.buildMessage(fcmToken, title, message, additionalData, notificationType, priority)
      })

      // Enviar en lotes de máximo 500 (límite de FCM)
      const batchSize = 500
      const results = []

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        const batchResponse = await this.messaging.sendEach(batch)

        results.push(
          ...batchResponse.responses.map((response, index) => ({
            success: response.success,
            messageId: response.messageId,
            error: response.error,
            token: notifications[i + index].fcmToken,
            originalIndex: i + index,
          })),
        )
      }

      const successCount = results.filter((r) => r.success).length
      const failureCount = results.length - successCount

      logger.info(`Lote enviado: ${successCount} exitosas, ${failureCount} fallidas`)

      return {
        successCount,
        failureCount,
        results,
      }
    } catch (error) {
      logger.error(`Error al enviar lote de notificaciones: ${error.message}`)
      throw error
    }
  }

  buildMessage(fcmToken, title, message, additionalData, notificationType = "notification", priority = "normal") {
    const fcmMessage = {
      token: fcmToken,
      android: {
        priority: priority === "high" ? "high" : "normal",
      },
      apns: {
        headers: {
          "apns-priority": priority === "high" ? "10" : "5",
        },
      },
    }

    // Configurar según el tipo de notificación
    switch (notificationType) {
      case "notification":
        fcmMessage.notification = {
          title,
          body: message,
        }
        break

      case "data":
        fcmMessage.data = {
          title,
          message,
          ...this.parseAdditionalData(additionalData),
        }
        break

      case "both":
        fcmMessage.notification = {
          title,
          body: message,
        }
        fcmMessage.data = {
          ...this.parseAdditionalData(additionalData),
        }
        break

      default:
        throw new Error(`Tipo de notificación no válido: ${notificationType}`)
    }

    return fcmMessage
  }

  parseAdditionalData(additionalData) {
    if (!additionalData) return {}

    if (typeof additionalData === "string") {
      try {
        return JSON.parse(additionalData)
      } catch {
        return { data: additionalData }
      }
    }

    if (typeof additionalData === "object") {
      // Convertir todos los valores a string (requerimiento de FCM)
      const stringifiedData = {}
      for (const [key, value] of Object.entries(additionalData)) {
        stringifiedData[key] = String(value)
      }
      return stringifiedData
    }

    return {}
  }

  classifyError(error) {
    const errorCode = error.code
    const errorMessage = error.message?.toLowerCase() || ""

    // Tokens inválidos
    const invalidTokenCodes = ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]

    // Errores que permiten reintento
    const retryableErrors = ["messaging/internal-error", "messaging/server-unavailable", "messaging/timeout"]

    return {
      isTokenInvalid:
        invalidTokenCodes.includes(errorCode) ||
        errorMessage.includes("not registered") ||
        errorMessage.includes("invalid token"),
      isRetryable:
        retryableErrors.includes(errorCode) ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("server error"),
    }
  }

  async validateToken(fcmToken) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      // Intentar enviar un mensaje de prueba (dry run)
      const testMessage = {
        token: fcmToken,
        data: { test: "validation" },
      }

      await this.messaging.send(testMessage, true) // dry run
      return { valid: true }
    } catch (error) {
      const errorInfo = this.classifyError(error)
      return {
        valid: false,
        error: error.message,
        isTokenInvalid: errorInfo.isTokenInvalid,
      }
    }
  }
}

module.exports = new FirebaseService()
