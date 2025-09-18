const express = require("express")
const notificationService = require("../services/notificationService")
const queueManager = require("../queues/notificationQueue")
const { validateNotification, validateBatchNotifications, validateHistoryQuery } = require("../middleware/validation")
const logger = require("../utils/logger")

const router = express.Router()

// Enviar notificación individual
router.post("/send", validateNotification, async (req, res) => {
  try {
    const result = await notificationService.createNotification(req.body)

    res.status(201).json({
      success: true,
      message: "Notificación agregada a la cola exitosamente",
      data: result,
    })
  } catch (error) {
    logger.error("Error en endpoint /send:", error)

    if (error.message.includes("Token FCM inválido")) {
      return res.status(400).json({
        success: false,
        error: "Token FCM inválido",
        message: error.message,
      })
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo procesar la notificación",
    })
  }
})

// Enviar lote de notificaciones
router.post("/send-batch", validateBatchNotifications, async (req, res) => {
  try {
    const result = await notificationService.createBatchNotifications(req.body.notifications)

    res.status(201).json({
      success: true,
      message: "Lote de notificaciones agregado a la cola exitosamente",
      data: result,
    })
  } catch (error) {
    logger.error("Error en endpoint /send-batch:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo procesar el lote de notificaciones",
    })
  }
})

// Obtener historial de notificaciones
router.get("/history", validateHistoryQuery, async (req, res) => {
  try {
    const history = await notificationService.getNotificationHistory(req.query)

    res.json({
      success: true,
      data: history,
      count: history.length,
    })
  } catch (error) {
    logger.error("Error en endpoint /history:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo obtener el historial",
    })
  }
})

// Obtener notificaciones pendientes
router.get("/pending", async (req, res) => {
  try {
    const pending = await notificationService.getPendingNotifications()

    res.json({
      success: true,
      data: pending,
      count: pending.length,
    })
  } catch (error) {
    logger.error("Error en endpoint /pending:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener las notificaciones pendientes",
    })
  }
})

// Obtener estadísticas
router.get("/stats", async (req, res) => {
  try {
    const stats = await notificationService.getNotificationStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Error en endpoint /stats:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener las estadísticas",
    })
  }
})

module.exports = router
