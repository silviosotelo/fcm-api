const rateLimit = require("express-rate-limit")
const { TooManyRequestsError } = require("../utils/errorHandler")
const logger = require("../utils/logger")

// Rate limiter para endpoints generales
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 100 requests por ventana
  message: {
    success: false,
    error: "Demasiadas solicitudes",
    message: "Has excedido el límite de solicitudes. Intenta nuevamente en 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit excedido:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new TooManyRequestsError("Demasiadas solicitudes. Intenta nuevamente más tarde.")
  },
})

// Rate limiter más estricto para envío de notificaciones
const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // máximo 10 notificaciones por minuto
  message: {
    success: false,
    error: "Límite de notificaciones excedido",
    message: "Has excedido el límite de envío de notificaciones. Intenta nuevamente en 1 minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Límite de notificaciones excedido:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new TooManyRequestsError("Límite de notificaciones excedido. Intenta nuevamente más tarde.")
  },
})

// Rate limiter para lotes de notificaciones
const batchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 1000, // máximo 3 lotes por 5 minutos
  message: {
    success: false,
    error: "Límite de lotes excedido",
    message: "Has excedido el límite de envío de lotes. Intenta nuevamente en 5 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Límite de lotes excedido:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new TooManyRequestsError("Límite de lotes excedido. Intenta nuevamente más tarde.")
  },
})

// Rate limiter para endpoints administrativos
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 20 requests por ventana
  message: {
    success: false,
    error: "Límite administrativo excedido",
    message: "Has excedido el límite de solicitudes administrativas.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Límite administrativo excedido:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new TooManyRequestsError("Límite administrativo excedido.")
  },
})

module.exports = {
  generalLimiter,
  notificationLimiter,
  batchLimiter,
  adminLimiter,
}
