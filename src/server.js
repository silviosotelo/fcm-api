const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")
require("dotenv").config()

const logger = require("./utils/logger")
const { initDatabase } = require("./database/init")
const { globalErrorHandler, setupGlobalErrorHandlers, catchAsync } = require("./utils/errorHandler")
const { securityConfig, securityLogger } = require("./middleware/security")
const { generalLimiter } = require("./middleware/rateLimiter")

// Importar rutas
const notificationRoutes = require("./routes/notifications")
const adminRoutes = require("./routes/admin")

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

// Rutas principales
app.use("/api/notifications", notificationRoutes)
app.use("/api/admin", adminRoutes)

// Ruta de salud
app.get(
  "/health",
  catchAsync(async (req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    })
  }),
)

// Ruta raíz con documentación básica
app.get("/", (req, res) => {
  res.json({
    name: "FCM Push Notifications API",
    version: "1.0.0",
    description: "API completa para envío de notificaciones push a Firebase Cloud Messaging",
    endpoints: {
      notifications: {
        "POST /api/notifications/send": "Enviar notificación individual",
        "POST /api/notifications/send-batch": "Enviar lote de notificaciones",
        "GET /api/notifications/history": "Obtener historial de notificaciones",
        "GET /api/notifications/pending": "Obtener notificaciones pendientes",
        "GET /api/notifications/stats": "Obtener estadísticas",
      },
      admin: {
        "GET /api/admin/queue-stats": "Estadísticas de las colas",
        "POST /api/admin/pause-queues": "Pausar todas las colas",
        "POST /api/admin/resume-queues": "Reanudar todas las colas",
        "POST /api/admin/clean-queues": "Limpiar colas",
      },
      health: {
        "GET /health": "Estado de salud del servicio",
      },
    },
    documentation: "Consulta el README.md para ejemplos de uso",
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

// Inicializar servidor
async function startServer() {
  try {
    // Inicializar base de datos
    await initDatabase()
    logger.info("Base de datos inicializada")

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`Servidor FCM API iniciado en puerto ${PORT}`)
      logger.info(`Documentación disponible en: http://localhost:${PORT}`)
      logger.info(`Estado de salud en: http://localhost:${PORT}/health`)
    })
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
