const express = require("express")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const logger = require("./utils/logger")
const { initDatabase } = require("./database/init")
const { globalErrorHandler, setupGlobalErrorHandlers, catchAsync } = require("./utils/errorHandler")
const { securityConfig, securityLogger, authenticateApiKey } = require("./middleware/security")
const { generalLimiter, notificationLimiter, batchLimiter } = require("./middleware/rateLimiter")

// Importar rutas
const notificationRoutes = require("./routes/notifications")
const notificationService = require("./services/notificationService")

const app = express()
const PORT = process.env.PORT || 3000

setupGlobalErrorHandlers()

app.use(securityConfig)
app.use(securityLogger)

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

app.use(generalLimiter)

// Middleware para parsing JSON
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Middleware de logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  })
  next()
})

// Aplicar autenticación solo a las rutas de la API
app.use("/api", authenticateApiKey)

// Rate limiters específicos para diferentes endpoints
app.use("/api/notifications/send", notificationLimiter)
app.use("/api/notifications/send-batch", batchLimiter)

// Rutas principales
app.use("/api/notifications", notificationRoutes)

// Ruta de salud (sin autenticación)
app.get(
  "/health",
  catchAsync(async (req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      mode: "direct-processing" // Indicar que no usa workers
    })
  }),
)

// Endpoint para procesar notificaciones programadas manualmente (cron alternativo)
app.post(
  "/api/process-scheduled",
  authenticateApiKey,
  catchAsync(async (req, res) => {
    const result = await notificationService.processScheduledNotifications()
    res.json({
      success: true,
      data: result
    })
  })
)

// Ruta raíz con documentación básica (sin autenticación)
app.get("/", (req, res) => {
  res.json({
    name: "FCM Push Notifications API - Direct Mode",
    version: "1.0.0",
    description: "API simplificada para envío directo de notificaciones push a Firebase Cloud Messaging",
    mode: "direct-processing",
    endpoints: {
      notifications: {
        "POST /api/notifications/send": "Enviar notificación individual (inmediata o programada)",
        "POST /api/notifications/send-batch": "Enviar lote de notificaciones",
        "POST /api/notifications/process-scheduled": "Procesar notificaciones programadas manualmente",
        "GET /api/notifications/history": "Obtener historial de notificaciones",
        "GET /api/notifications/pending": "Obtener notificaciones pendientes",
        "GET /api/notifications/stats": "Obtener estadísticas",
      },
      utility: {
        "GET /health": "Estado de salud del servicio",
        "POST /api/process-scheduled": "Procesar notificaciones programadas (usar como cron alternativo)"
      }
    },
    authentication: "Requerida para todas las rutas /api/* (X-API-Key header)",
    documentation: "Consulta el README.md para ejemplos de uso",
    notes: [
      "Esta versión procesa notificaciones directamente sin workers ni colas",
      "Las notificaciones inmediatas se envían al momento",
      "Las notificaciones programadas se almacenan y pueden procesarse con /api/process-scheduled",
      "Usa /api/process-scheduled en un cron job para procesar notificaciones programadas"
    ]
  })
})

app.use(globalErrorHandler)

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe`,
  })
})

// Función para setup de cron simple (opcional)
function setupSimpleCron() {
  if (process.env.ENABLE_AUTO_SCHEDULED === "true") {
    const cronInterval = parseInt(process.env.CRON_INTERVAL_MINUTES) || 5
    
    setInterval(async () => {
      try {
        logger.info("Procesando notificaciones programadas automáticamente...")
        const result = await notificationService.processScheduledNotifications()
        if (result.processed > 0) {
          logger.info(`Procesadas ${result.processed} notificaciones programadas`)
        }
      } catch (error) {
        logger.error("Error en cron automático:", error)
      }
    }, cronInterval * 60 * 1000) // Convertir minutos a milisegundos
    
    logger.info(`Cron automático configurado para ejecutarse cada ${cronInterval} minutos`)
  }
}

// Inicializar servidor
async function startServer() {
  try {
    // Inicializar base de datos
    await initDatabase()
    logger.info("Base de datos inicializada")

    // Setup cron simple si está habilitado
    setupSimpleCron()

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`Servidor FCM API (modo directo) iniciado en puerto ${PORT}`)
      logger.info(`Documentación disponible en: http://localhost:${PORT}`)
      logger.info(`Estado de salud en: http://localhost:${PORT}/health`)
      logger.info("Modo: Procesamiento directo sin workers ni colas")
      
      if (process.env.ENABLE_AUTO_SCHEDULED === "true") {
        logger.info("Procesamiento automático de notificaciones programadas habilitado")
      } else {
        logger.info("Para procesar notificaciones programadas usa: POST /api/process-scheduled")
      }
    })

    return server
  } catch (error) {
    logger.error("Error al iniciar el servidor:", error)
    process.exit(1)
  }
}

// Manejo de cierre graceful
process.on("SIGTERM", () => {
  logger.info("Recibida señal SIGTERM, cerrando servidor...")
  process.exit(0)
})

process.on("SIGINT", () => {
  logger.info("Recibida señal SIGINT, cerrando servidor...")
  process.exit(0)
})

// Iniciar servidor
startServer()

module.exports = app