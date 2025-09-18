const logger = require("./logger")

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error"

    Error.captureStackTrace(this, this.constructor)
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400)
    this.details = details
  }
}

class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404)
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401)
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Acceso prohibido") {
    super(message, 403)
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflicto de recursos") {
    super(message, 409)
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = "Demasiadas solicitudes") {
    super(message, 429)
  }
}

class InternalServerError extends AppError {
  constructor(message = "Error interno del servidor") {
    super(message, 500, false)
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = "Servicio no disponible") {
    super(message, 503, false)
  }
}

// Manejador global de errores para Express
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message

  // Log del error
  logger.error("Error capturado:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  })

  // Errores de validación de Joi
  if (err.isJoi) {
    const message = "Datos de entrada inválidos"
    const details = err.details.map((detail) => detail.message)
    error = new ValidationError(message, details)
  }

  // Errores de SQLite
  if (err.code === "SQLITE_CONSTRAINT") {
    const message = "Violación de restricción de base de datos"
    error = new ConflictError(message)
  }

  if (err.code === "SQLITE_BUSY") {
    const message = "Base de datos ocupada, intente nuevamente"
    error = new ServiceUnavailableError(message)
  }

  // Errores de Firebase
  if (err.code && err.code.startsWith("messaging/")) {
    switch (err.code) {
      case "messaging/invalid-registration-token":
      case "messaging/registration-token-not-registered":
        error = new ValidationError("Token FCM inválido o no registrado")
        break
      case "messaging/invalid-payload":
        error = new ValidationError("Payload de notificación inválido")
        break
      case "messaging/server-unavailable":
        error = new ServiceUnavailableError("Servicio FCM no disponible")
        break
      default:
        error = new InternalServerError("Error del servicio de notificaciones")
    }
  }

  // Errores de Redis/Bull
  if (err.code === "ECONNREFUSED" && err.address) {
    error = new ServiceUnavailableError("Servicio de colas no disponible")
  }

  // Si no es un error operacional, convertirlo
  if (!error.isOperational) {
    error = new InternalServerError()
  }

  // Respuesta de error
  const response = {
    success: false,
    error: error.message,
    status: error.status,
  }

  // Agregar detalles en desarrollo o para errores de validación
  if (process.env.NODE_ENV === "development" || error instanceof ValidationError) {
    if (error.details) {
      response.details = error.details
    }
    if (process.env.NODE_ENV === "development") {
      response.stack = err.stack
    }
  }

  res.status(error.statusCode || 500).json(response)
}

// Manejador de promesas rechazadas no capturadas
const handleUnhandledRejection = (reason, promise) => {
  logger.error("Promesa rechazada no manejada:", {
    reason: reason.message || reason,
    stack: reason.stack,
    promise: promise,
  })

  // En producción, cerrar el servidor gracefully
  if (process.env.NODE_ENV === "production") {
    process.exit(1)
  }
}

// Manejador de excepciones no capturadas
const handleUncaughtException = (error) => {
  logger.error("Excepción no capturada:", {
    message: error.message,
    stack: error.stack,
  })

  // Cerrar el servidor inmediatamente
  process.exit(1)
}

// Función para envolver funciones async y capturar errores
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Función para validar y sanitizar entrada
const sanitizeInput = (input, type = "string") => {
  if (input === null || input === undefined) {
    return null
  }

  switch (type) {
    case "string":
      return String(input).trim()
    case "number":
      const num = Number(input)
      return isNaN(num) ? null : num
    case "boolean":
      return Boolean(input)
    case "array":
      return Array.isArray(input) ? input : []
    case "object":
      return typeof input === "object" && input !== null ? input : {}
    default:
      return input
  }
}

// Configurar manejadores globales
const setupGlobalErrorHandlers = () => {
  process.on("unhandledRejection", handleUnhandledRejection)
  process.on("uncaughtException", handleUncaughtException)

  logger.info("Manejadores globales de errores configurados")
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  globalErrorHandler,
  catchAsync,
  sanitizeInput,
  setupGlobalErrorHandlers,
}
