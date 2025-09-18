const winston = require("winston")
const path = require("path")
require("dotenv").config()

// Crear directorio de logs si no existe
const fs = require("fs")
const logDir = path.dirname(process.env.LOG_FILE || "./logs/app.log")
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "fcm-api" },
  transports: [
    // Escribir logs de error a archivo
    new winston.transports.File({
      filename: process.env.LOG_FILE || "./logs/app.log",
      level: "error",
    }),
    // Escribir todos los logs a archivo
    new winston.transports.File({
      filename: process.env.LOG_FILE || "./logs/app.log",
    }),
  ],
})

// Si no estamos en producción, también log a consola
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  )
}

module.exports = logger
