const helmet = require("helmet")
const { UnauthorizedError, ForbiddenError } = require("../utils/errorHandler")
const logger = require("../utils/logger")

// Configuración de seguridad con Helmet
const securityConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
})

// Middleware de autenticación básica (API Key)
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "")

  if (!apiKey) {
    logger.warn("Intento de acceso sin API key:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new UnauthorizedError("API key requerida")
  }

  // En un entorno real, validarías la API key contra una base de datos
  const validApiKeys = process.env.API_KEYS?.split(",") || ["default-api-key"]

  if (!validApiKeys.includes(apiKey)) {
    logger.warn("Intento de acceso con API key inválida:", {
      ip: req.ip,
      apiKey: apiKey.substring(0, 8) + "...",
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new UnauthorizedError("API key inválida")
  }

  req.apiKey = apiKey
  next()
}

// Middleware de autorización para endpoints administrativos
const requireAdminAccess = (req, res, next) => {
  const adminApiKeys = process.env.ADMIN_API_KEYS?.split(",") || ["admin-api-key"]

  if (!adminApiKeys.includes(req.apiKey)) {
    logger.warn("Intento de acceso administrativo sin permisos:", {
      ip: req.ip,
      apiKey: req.apiKey?.substring(0, 8) + "...",
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    })

    throw new ForbiddenError("Acceso administrativo requerido")
  }

  next()
}

// Middleware para validar origen de requests
const validateOrigin = (allowedOrigins = []) => {
  return (req, res, next) => {
    const origin = req.headers.origin

    if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
      logger.warn("Request desde origen no permitido:", {
        origin,
        ip: req.ip,
        url: req.originalUrl,
      })

      throw new ForbiddenError("Origen no permitido")
    }

    next()
  }
}

// Middleware para logging de seguridad
const securityLogger = (req, res, next) => {
  const securityInfo = {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get("User-Agent"),
    origin: req.headers.origin,
    referer: req.headers.referer,
    timestamp: new Date().toISOString(),
  }

  // Log requests sospechosos
  const suspiciousPatterns = [/\.\./, /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i]

  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(req.originalUrl + JSON.stringify(req.body)))

  if (isSuspicious) {
    logger.warn("Request sospechoso detectado:", securityInfo)
  }

  next()
}

module.exports = {
  securityConfig,
  authenticateApiKey,
  requireAdminAccess,
  validateOrigin,
  securityLogger,
}
