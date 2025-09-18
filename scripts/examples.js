/**
 * Ejemplos de uso de la API FCM
 * Ejecutar con: node scripts/examples.js
 */

const axios = require("axios")

// Configuración
const API_BASE_URL = "http://localhost:3000/api"
const API_KEY = "your-api-key" // Cambiar por tu API key real
const TEST_FCM_TOKEN = "test-fcm-token" // Cambiar por un token FCM real

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
})

// Función para manejar errores
function handleError(error) {
  if (error.response) {
    console.error("❌ Error:", error.response.data)
  } else {
    console.error("❌ Error de red:", error.message)
  }
}

// Ejemplo 1: Enviar notificación simple
async function example1_SimpleNotification() {
  console.log("\n🔔 Ejemplo 1: Notificación Simple")
  console.log("=====================================")

  try {
    const response = await apiClient.post("/notifications/send", {
      fcmToken: TEST_FCM_TOKEN,
      title: "¡Hola!",
      message: "Esta es una notificación de prueba simple",
      notificationType: "notification",
      priority: "normal",
    })

    console.log("✅ Notificación enviada:", response.data)
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 2: Notificación con datos adicionales
async function example2_NotificationWithData() {
  console.log("\n📦 Ejemplo 2: Notificación con Datos")
  console.log("====================================")

  try {
    const response = await apiClient.post("/notifications/send", {
      fcmToken: TEST_FCM_TOKEN,
      title: "Nuevo mensaje",
      message: "Tienes un mensaje de Juan",
      additionalData: {
        userId: "12345",
        chatId: "chat_67890",
        action: "open_chat",
        timestamp: new Date().toISOString(),
      },
      notificationType: "both", // Envía tanto notification como data
      priority: "high",
    })

    console.log("✅ Notificación con datos enviada:", response.data)
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 3: Notificación programada
async function example3_ScheduledNotification() {
  console.log("\n⏰ Ejemplo 3: Notificación Programada")
  console.log("====================================")

  // Programar para 1 minuto en el futuro
  const scheduledTime = new Date(Date.now() + 60000)

  try {
    const response = await apiClient.post("/notifications/send", {
      fcmToken: TEST_FCM_TOKEN,
      title: "Recordatorio",
      message: "Esta notificación fue programada hace 1 minuto",
      scheduledAt: scheduledTime.toISOString(),
      notificationType: "notification",
      priority: "normal",
    })

    console.log("✅ Notificación programada:", response.data)
    console.log(`📅 Se enviará a las: ${scheduledTime.toLocaleString()}`)
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 4: Lote de notificaciones
async function example4_BatchNotifications() {
  console.log("\n📬 Ejemplo 4: Lote de Notificaciones")
  console.log("===================================")

  const notifications = [
    {
      fcmToken: TEST_FCM_TOKEN,
      title: "Notificación 1",
      message: "Primera notificación del lote",
      additionalData: { batchId: "batch_001", index: 1 },
    },
    {
      fcmToken: TEST_FCM_TOKEN,
      title: "Notificación 2",
      message: "Segunda notificación del lote",
      additionalData: { batchId: "batch_001", index: 2 },
    },
    {
      fcmToken: TEST_FCM_TOKEN,
      title: "Notificación 3",
      message: "Tercera notificación del lote",
      additionalData: { batchId: "batch_001", index: 3 },
    },
  ]

  try {
    const response = await apiClient.post("/notifications/send-batch", {
      notifications,
    })

    console.log("✅ Lote enviado:", response.data)
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 5: Obtener historial
async function example5_GetHistory() {
  console.log("\n📊 Ejemplo 5: Obtener Historial")
  console.log("===============================")

  try {
    const response = await apiClient.get("/notifications/history", {
      params: {
        limit: 10,
        status: "sent",
      },
    })

    console.log("✅ Historial obtenido:")
    console.log(`📈 Total de registros: ${response.data.count}`)

    response.data.data.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.title} - ${notification.status} (${notification.sent_at})`)
    })
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 6: Obtener estadísticas
async function example6_GetStats() {
  console.log("\n📈 Ejemplo 6: Estadísticas")
  console.log("=========================")

  try {
    const response = await apiClient.get("/notifications/stats")
    const stats = response.data.data

    console.log("✅ Estadísticas obtenidas:")
    console.log("📊 Hoy:")
    console.log(`   - Total enviadas: ${stats.today.total_sent}`)
    console.log(`   - Exitosas: ${stats.today.successful}`)
    console.log(`   - Fallidas: ${stats.today.failed}`)
    console.log(`   - Tokens inválidos: ${stats.today.invalid_tokens}`)
    console.log(`📋 Pendientes: ${stats.pending}`)
    console.log("🔄 Colas:")
    console.log(`   - Individual: ${stats.queues.single.waiting} esperando, ${stats.queues.single.active} activas`)
    console.log(`   - Lotes: ${stats.queues.batch.waiting} esperando, ${stats.queues.batch.active} activas`)
    console.log(`   - Reintentos: ${stats.queues.retry.waiting} esperando, ${stats.queues.retry.active} activas`)
  } catch (error) {
    handleError(error)
  }
}

// Ejemplo 7: Verificar estado del servidor
async function example7_HealthCheck() {
  console.log("\n❤️ Ejemplo 7: Estado del Servidor")
  console.log("=================================")

  try {
    const response = await axios.get(`${API_BASE_URL.replace("/api", "")}/health`)

    console.log("✅ Servidor saludable:")
    console.log(`🟢 Estado: ${response.data.status}`)
    console.log(`⏱️ Uptime: ${Math.floor(response.data.uptime)} segundos`)
    console.log(`🏷️ Versión: ${response.data.version}`)
    console.log(`🌍 Entorno: ${response.data.environment}`)
  } catch (error) {
    handleError(error)
  }
}

// Función principal para ejecutar todos los ejemplos
async function runAllExamples() {
  console.log("🚀 Ejecutando ejemplos de la API FCM")
  console.log("====================================")

  // Verificar que el servidor esté funcionando
  await example7_HealthCheck()

  // Esperar un poco entre ejemplos
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  await wait(1000)
  await example1_SimpleNotification()

  await wait(1000)
  await example2_NotificationWithData()

  await wait(1000)
  await example3_ScheduledNotification()

  await wait(1000)
  await example4_BatchNotifications()

  await wait(2000) // Esperar más tiempo para que se procesen las notificaciones
  await example5_GetHistory()

  await wait(1000)
  await example6_GetStats()

  console.log("\n✨ ¡Todos los ejemplos completados!")
  console.log("===================================")
  console.log("💡 Consejos:")
  console.log("   - Cambia TEST_FCM_TOKEN por un token real para ver notificaciones")
  console.log("   - Cambia API_KEY por tu clave real")
  console.log("   - Verifica que el servidor y workers estén ejecutándose")
  console.log("   - Revisa los logs en ./logs/app.log para más detalles")
}

// Ejecutar ejemplos si se llama directamente
if (require.main === module) {
  runAllExamples().catch(console.error)
}

module.exports = {
  example1_SimpleNotification,
  example2_NotificationWithData,
  example3_ScheduledNotification,
  example4_BatchNotifications,
  example5_GetHistory,
  example6_GetStats,
  example7_HealthCheck,
}
