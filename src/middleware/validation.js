const Joi = require("joi")
const logger = require("../utils/logger")

// Esquemas de validación
const notificationSchema = Joi.object({
  fcmToken: Joi.string().required().min(1).messages({
    "string.empty": "El token FCM es requerido",
    "any.required": "El token FCM es requerido",
  }),
  title: Joi.string().required().max(100).messages({
    "string.empty": "El título es requerido",
    "any.required": "El título es requerido",
    "string.max": "El título no puede exceder 100 caracteres",
  }),
  message: Joi.string().required().max(500).messages({
    "string.empty": "El mensaje es requerido",
    "any.required": "El mensaje es requerido",
    "string.max": "El mensaje no puede exceder 500 caracteres",
  }),
  additionalData: Joi.object().optional(),
  notificationType: Joi.string().valid("notification", "data", "both").default("notification"),
  priority: Joi.string().valid("high", "normal").default("normal"),
  scheduledAt: Joi.date().iso().optional(),
})

const batchNotificationSchema = Joi.object({
  notifications: Joi.array().items(notificationSchema).min(1).max(1000).required().messages({
    "array.min": "Debe incluir al menos una notificación",
    "array.max": "No se pueden enviar más de 1000 notificaciones por lote",
    "any.required": "El array de notificaciones es requerido",
  }),
})

const historyQuerySchema = Joi.object({
  fcmToken: Joi.string().optional(),
  status: Joi.string().valid("sent", "failed", "invalid_token").optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
})

// Middleware de validación
const validateNotification = (req, res, next) => {
  const { error, value } = notificationSchema.validate(req.body)

  if (error) {
    logger.warn("Error de validación en notificación:", error.details)
    return res.status(400).json({
      success: false,
      error: "Datos de notificación inválidos",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateBatchNotifications = (req, res, next) => {
  const { error, value } = batchNotificationSchema.validate(req.body)

  if (error) {
    logger.warn("Error de validación en lote de notificaciones:", error.details)
    return res.status(400).json({
      success: false,
      error: "Datos de lote inválidos",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateHistoryQuery = (req, res, next) => {
  const { error, value } = historyQuerySchema.validate(req.query)

  if (error) {
    logger.warn("Error de validación en consulta de historial:", error.details)
    return res.status(400).json({
      success: false,
      error: "Parámetros de consulta inválidos",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.query = value
  next()
}

module.exports = {
  validateNotification,
  validateBatchNotifications,
  validateHistoryQuery,
}
