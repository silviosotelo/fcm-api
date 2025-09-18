# Colección de Postman - FCM Push Notifications API

Esta colección de Postman contiene todos los endpoints de la API de notificaciones push de Firebase Cloud Messaging con ejemplos completos y casos de prueba.

## 📋 Contenido de la Colección

### 🏥 Health & Info
- **Health Check**: Verificar estado del servidor
- **API Documentation**: Obtener documentación de endpoints

### 🔔 Notifications
- **Send Individual Notification**: Enviar notificación simple
- **Send Notification with Data**: Notificación con datos adicionales
- **Send Scheduled Notification**: Programar notificación
- **Send Batch Notifications**: Enviar lote de notificaciones
- **Get Notification History**: Obtener historial con filtros
- **Get Pending Notifications**: Ver notificaciones pendientes
- **Get Notification Statistics**: Estadísticas del sistema

### 👨‍💼 Admin (Requiere API Key de Administrador)
- **Get Queue Statistics**: Estadísticas detalladas de colas
- **Pause All Queues**: Pausar procesamiento
- **Resume All Queues**: Reanudar procesamiento
- **Clean All Queues**: Limpiar colas

### ❌ Error Examples
- **Invalid API Key**: Ejemplo de error de autenticación
- **Validation Error**: Ejemplo de error de validación

## 🚀 Configuración Inicial

### 1. Importar la Colección
1. Abrir Postman
2. Hacer clic en "Import"
3. Seleccionar el archivo `FCM-API-Collection.json`
4. La colección se importará con todas las variables y ejemplos

### 2. Configurar Variables de Entorno

La colección incluye las siguientes variables que debes configurar:

\`\`\`json
{
  "baseUrl": "http://localhost:3000/api",
  "healthUrl": "http://localhost:3000",
  "apiKey": "your-api-key",
  "adminApiKey": "your-admin-api-key",
  "testFcmToken": "test-fcm-token-replace-with-real-token"
}
\`\`\`

#### Para configurar las variables:
1. Hacer clic derecho en la colección
2. Seleccionar "Edit"
3. Ir a la pestaña "Variables"
4. Actualizar los valores según tu configuración:
   - `apiKey`: Tu clave API real (definida en `API_KEYS` del .env)
   - `adminApiKey`: Tu clave API de administrador (definida en `ADMIN_API_KEYS` del .env)
   - `testFcmToken`: Un token FCM real para pruebas
   - `baseUrl`: Cambiar si tu servidor no está en localhost:3000

### 3. Configurar Autenticación Global

La colección está configurada para usar automáticamente la API key en todos los requests. Si necesitas cambiar la autenticación:

1. Hacer clic derecho en la colección
2. Seleccionar "Edit"
3. Ir a la pestaña "Authorization"
4. La configuración actual usa "API Key" con header "X-API-Key"

## 🧪 Ejecutar Pruebas

### Pruebas Individuales
1. Seleccionar cualquier request
2. Hacer clic en "Send"
3. Verificar la respuesta en la pestaña "Body"

### Pruebas Automáticas
Cada request incluye tests automáticos que verifican:
- Código de estado exitoso (200 o 201)
- Presencia del campo `success` en la respuesta
- Tiempo de respuesta menor a 5 segundos

### Ejecutar Toda la Colección
1. Hacer clic derecho en la colección
2. Seleccionar "Run collection"
3. Configurar las opciones de ejecución
4. Hacer clic en "Run FCM Push Notifications API"

## 📝 Ejemplos de Uso

### Notificación Simple
\`\`\`json
POST /api/notifications/send
{
  "fcmToken": "tu-token-fcm",
  "title": "¡Hola!",
  "message": "Esta es una notificación de prueba",
  "notificationType": "notification",
  "priority": "normal"
}
\`\`\`

### Notificación con Datos
\`\`\`json
POST /api/notifications/send
{
  "fcmToken": "tu-token-fcm",
  "title": "Nuevo mensaje",
  "message": "Tienes un mensaje de Juan",
  "additionalData": {
    "userId": "12345",
    "chatId": "chat_67890",
    "action": "open_chat"
  },
  "notificationType": "both",
  "priority": "high"
}
\`\`\`

### Lote de Notificaciones
\`\`\`json
POST /api/notifications/send-batch
{
  "notifications": [
    {
      "fcmToken": "token1",
      "title": "Notificación 1",
      "message": "Primera notificación"
    },
    {
      "fcmToken": "token2",
      "title": "Notificación 2",
      "message": "Segunda notificación"
    }
  ]
}
\`\`\`

## 🔍 Filtros de Historial

El endpoint de historial soporta varios filtros:

\`\`\`
GET /api/notifications/history?limit=50&status=sent&fromDate=2024-01-01T00:00:00.000Z&toDate=2024-01-31T23:59:59.999Z&fcmToken=token-especifico
\`\`\`

Parámetros disponibles:
- `limit`: Número de registros (1-1000, default: 100)
- `status`: `sent`, `failed`, `invalid_token`
- `fromDate`: Fecha desde (formato ISO)
- `toDate`: Fecha hasta (formato ISO)
- `fcmToken`: Token FCM específico

## 🛠️ Troubleshooting

### Error 401 - No autorizado
- Verificar que la API key esté configurada correctamente
- Asegurarse de que la API key esté en las variables de entorno del servidor

### Error 400 - Datos inválidos
- Verificar que todos los campos requeridos estén presentes
- Revisar que el formato de los datos sea correcto
- Consultar los detalles del error en la respuesta

### Error 500 - Error interno
- Verificar que el servidor esté ejecutándose
- Revisar los logs del servidor para más detalles
- Asegurarse de que Redis y la base de datos estén funcionando

## 📚 Recursos Adicionales

- **Documentación completa**: Consultar `README.md` del proyecto
- **Ejemplos de código**: Revisar `scripts/examples.js`
- **Logs del servidor**: Ubicados en `./logs/app.log`
- **Configuración**: Variables de entorno en `.env`

## 🔄 Actualizaciones

Para mantener la colección actualizada:
1. Exportar la colección actual si has hecho cambios
2. Importar la nueva versión
3. Actualizar las variables de entorno según sea necesario
4. Probar los nuevos endpoints o cambios

---

**Nota**: Esta colección está diseñada para trabajar con la API FCM v1.0.0. Asegúrate de que tu servidor esté ejecutándose y configurado correctamente antes de usar la colección.
