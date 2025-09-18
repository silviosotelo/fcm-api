const express = require("express")
const queueManager = require("../queues/notificationQueue")
const logger = require("../utils/logger")

const router = express.Router()

// Obtener estadísticas de las colas
router.get("/queue-stats", async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Error en endpoint /queue-stats:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron obtener las estadísticas de las colas",
    })
  }
})

// Pausar todas las colas
router.post("/pause-queues", async (req, res) => {
  try {
    await queueManager.pauseQueues()

    res.json({
      success: true,
      message: "Todas las colas han sido pausadas",
    })
  } catch (error) {
    logger.error("Error en endpoint /pause-queues:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron pausar las colas",
    })
  }
})

// Reanudar todas las colas
router.post("/resume-queues", async (req, res) => {
  try {
    await queueManager.resumeQueues()

    res.json({
      success: true,
      message: "Todas las colas han sido reanudadas",
    })
  } catch (error) {
    logger.error("Error en endpoint /resume-queues:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron reanudar las colas",
    })
  }
})

// Limpiar colas
router.post("/clean-queues", async (req, res) => {
  try {
    await queueManager.cleanQueues()

    res.json({
      success: true,
      message: "Colas limpiadas exitosamente",
    })
  } catch (error) {
    logger.error("Error en endpoint /clean-queues:", error)

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "No se pudieron limpiar las colas",
    })
  }
})

module.exports = router
