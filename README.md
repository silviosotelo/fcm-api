# FCM Push Notifications API

API completa para envío de notificaciones push a Firebase Cloud Messaging (FCM) con sistema de colas, reintentos automáticos y manejo robusto de errores.

## 🚀 Características

- ✅ **Autenticación Firebase** con service account
- ✅ **Base de datos SQLite** para persistencia
- ✅ **Sistema de colas** con Redis/Bull para procesamiento asíncrono
- ✅ **Workers** para procesamiento eficiente de notificaciones
- ✅ **Sistema de reintentos** para notificaciones fallidas
- ✅ **Logging completo** de todas las operaciones
- ✅ **Validación de tokens FCM**
- ✅ **Múltiples tipos de notificaciones** (notification, data, both)
- ✅ **Rate limiting** y seguridad
- ✅ **Manejo robusto de errores**
- ✅ **Documentación completa de API**

## 📋 Requisitos

- Node.js 16+
- Redis Server
- Firebase Project con service account
- SQLite3

## 🛠️ Instalación

### 1. Clonar el repositorio

\`\`\`bash
git clone <repository-url>
cd fcm-push-api
\`\`\`

### 2. Instalar dependencias

\`\`\`bash
npm install
\`\`\`

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

\`\`\`bash
cp .env.example .env
\`\`\`

Edita el archivo `.env`:

\`\`\`env
# Puerto del servidor
PORT=3000

# Configuración de Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Configuración de Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Configuración de base de datos
DATABASE_PATH=./data/notifications.db

# Configuración de logs
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Configuración de reintentos
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=5000

# Configuración de seguridad
API_KEYS=your-api-key-1,your-api-key-2
ADMIN_API_KEYS=admin-key-1,admin-key-2
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Entorno
NODE_ENV=development
\`\`\`

### 4. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **Configuración del proyecto** > **Cuentas de servicio**
4. Genera una nueva clave privada
5. Guarda el archivo JSON en `./config/firebase-service-account.json`

### 5. Inicializar base de datos

\`\`\`bash
npm run init-db
\`\`\`

### 6. Iniciar Redis

\`\`\`bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS con Homebrew
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
\`\`\`

## 🚀 Uso

### Iniciar el servidor

\`\`\`bash
# Desarrollo
npm run dev

# Producción
npm start
\`\`\`

### Iniciar workers

En terminales separadas:

\`\`\`bash
# Worker principal de notificaciones
npm run worker

# Worker de tareas programadas
npm run scheduled-worker
\`\`\`

## 📚 API Documentation

### Autenticación

Todas las requests requieren un API key en el header:

\`\`\`bash
X-API-Key: your-api-key
# o
Authorization: Bearer your-api-key
\`\`\`

### Endpoints

#### 1. Enviar Notificación Individual

**POST** `/api/notifications/send`

\`\`\`json
{
  "fcmToken": "token-fcm-del-dispositivo",
  "title": "Título de la notificación",
  "message": "Mensaje de la notificación",
  "additionalData": {
    "key1": "value1",
    "key2": "value2"
  },
  "notificationType": "notification", // "notification", "data", "both"
  "priority": "normal", // "high", "normal"
  "scheduledAt": "2024-01-01T12:00:00Z" // opcional
}
\`\`\`

**Respuesta:**

\`\`\`json
{
  "success": true,
  "message": "Notificación agregada a la cola exitosamente",
  "data": {
    "id": 123,
    "status": "queued",
    "scheduledAt": "2024-01-01T12:00:00Z"
  }
}
\`\`\`

#### 2. Enviar Lote de Notificaciones

**POST** `/api/notifications/send-batch`

\`\`\`json
{
  "notifications": [
    {
      "fcmToken": "token-1",
      "title": "Título 1",
      "message": "Mensaje 1"
    },
    {
      "fcmToken": "token-2",
      "title": "Título 2",
      "message": "Mensaje 2"
    }
  ]
}
\`\`\`

**Respuesta:**

\`\`\`json
{
  "success": true,
  "message": "Lote de notificaciones agregado a la cola exitosamente",
  "data": {
    "totalRequested": 2,
    "validNotifications": 2,
    "invalidTokens": 0,
    "invalidTokenDetails": [],
    "status": "queued"
  }
}
\`\`\`

#### 3. Obtener Historial

**GET** `/api/notifications/history`

**Parámetros de consulta:**
- `fcmToken` (opcional): Filtrar por token específico
- `status` (opcional): `sent`, `failed`, `invalid_token`
- `fromDate` (opcional): Fecha inicio (ISO 8601)
- `toDate` (opcional): Fecha fin (ISO 8601)
- `limit` (opcional): Número máximo de resultados (default: 100)

**Respuesta:**

\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fcm_token": "token-fcm",
      "title": "Título",
      "message": "Mensaje",
      "status": "sent",
      "sent_at": "2024-01-01T12:00:00Z",
      "attempts": 1
    }
  ],
  "count": 1
}
\`\`\`

#### 4. Obtener Notificaciones Pendientes

**GET** `/api/notifications/pending`

**Respuesta:**

\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fcm_token": "token-fcm",
      "title": "Título",
      "message": "Mensaje",
      "status": "pending",
      "scheduled_at": "2024-01-01T12:00:00Z",
      "attempts": 0
    }
  ],
  "count": 1
}
\`\`\`

#### 5. Obtener Estadísticas

**GET** `/api/notifications/stats`

**Respuesta:**

\`\`\`json
{
  "success": true,
  "data": {
    "today": {
      "total_sent": 100,
      "successful": 95,
      "failed": 3,
      "invalid_tokens": 2
    },
    "pending": 5,
    "queues": {
      "single": {
        "waiting": 2,
        "active": 1,
        "completed": 50,
        "failed": 1,
        "delayed": 0
      },
      "batch": {
        "waiting": 0,
        "active": 0,
        "completed": 10,
        "failed": 0,
        "delayed": 0
      },
      "retry": {
        "waiting": 1,
        "active": 0,
        "completed": 5,
        "failed": 1,
        "delayed": 0
      }
    }
  }
}
\`\`\`

### Endpoints Administrativos

Requieren API key de administrador.

#### 1. Estadísticas de Colas

**GET** `/api/admin/queue-stats`

#### 2. Pausar Colas

**POST** `/api/admin/pause-queues`

#### 3. Reanudar Colas

**POST** `/api/admin/resume-queues`

#### 4. Limpiar Colas

**POST** `/api/admin/clean-queues`

## 🔧 Ejemplos de Uso

### cURL

\`\`\`bash
# Enviar notificación individual
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "fcmToken": "token-fcm-del-dispositivo",
    "title": "¡Hola!",
    "message": "Esta es una notificación de prueba",
    "notificationType": "notification",
    "priority": "high"
  }'

# Obtener historial
curl -X GET "http://localhost:3000/api/notifications/history?limit=10&status=sent" \
  -H "X-API-Key: your-api-key"
\`\`\`

### JavaScript/Node.js

\`\`\`javascript
const axios = require('axios');

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  }
});

// Enviar notificación
async function sendNotification() {
  try {
    const response = await apiClient.post('/notifications/send', {
      fcmToken: 'token-fcm-del-dispositivo',
      title: '¡Nueva notificación!',
      message: 'Tienes un nuevo mensaje',
      additionalData: {
        userId: '123',
        action: 'open_chat'
      },
      notificationType: 'both',
      priority: 'high'
    });
    
    console.log('Notificación enviada:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Obtener estadísticas
async function getStats() {
  try {
    const response = await apiClient.get('/notifications/stats');
    console.log('Estadísticas:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}
\`\`\`

### Python

\`\`\`python
import requests
import json

API_BASE_URL = 'http://localhost:3000/api'
API_KEY = 'your-api-key'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Enviar notificación
def send_notification():
    payload = {
        'fcmToken': 'token-fcm-del-dispositivo',
        'title': '¡Hola desde Python!',
        'message': 'Esta notificación fue enviada desde Python',
        'notificationType': 'notification',
        'priority': 'normal'
    }
    
    response = requests.post(
        f'{API_BASE_URL}/notifications/send',
        headers=headers,
        json=payload
    )
    
    if response.status_code == 201:
        print('Notificación enviada:', response.json())
    else:
        print('Error:', response.json())

# Obtener historial
def get_history():
    params = {
        'limit': 50,
        'status': 'sent'
    }
    
    response = requests.get(
        f'{API_BASE_URL}/notifications/history',
        headers=headers,
        params=params
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f'Historial obtenido: {data["count"]} registros')
        for notification in data['data']:
            print(f'- {notification["title"]}: {notification["status"]}')
    else:
        print('Error:', response.json())
\`\`\`

## 🏗️ Arquitectura

### Componentes Principales

1. **API Server** (`src/server.js`): Servidor Express con endpoints REST
2. **Firebase Service** (`src/services/firebaseService.js`): Integración con FCM
3. **Queue Manager** (`src/queues/notificationQueue.js`): Gestión de colas con Bull/Redis
4. **Workers** (`src/workers/`): Procesadores de notificaciones
5. **Database** (`src/database/`): Persistencia con SQLite

### Flujo de Trabajo

1. **Request** → API recibe solicitud de notificación
2. **Validation** → Valida datos y token FCM
3. **Database** → Guarda notificación como pendiente
4. **Queue** → Agrega trabajo a la cola apropiada
5. **Worker** → Procesa y envía notificación via FCM
6. **History** → Mueve resultado al historial
7. **Retry** → Reintenta automáticamente si falla

### Base de Datos

#### Tablas

- `pending_notifications`: Notificaciones en cola
- `notification_history`: Historial de envíos
- `invalid_tokens`: Tokens FCM inválidos

## 🔒 Seguridad

- **Rate Limiting**: Límites por IP y endpoint
- **API Keys**: Autenticación requerida
- **Input Validation**: Validación con Joi
- **Security Headers**: Configuración con Helmet
- **Error Handling**: Manejo seguro de errores
- **Logging**: Registro de actividad sospechosa

## 📊 Monitoreo

### Logs

Los logs se guardan en `./logs/app.log` con diferentes niveles:

- **INFO**: Operaciones normales
- **WARN**: Situaciones de atención
- **ERROR**: Errores y excepciones

### Métricas

- Estadísticas de envío por día
- Estado de las colas en tiempo real
- Tokens inválidos detectados
- Rendimiento de workers

## 🚨 Troubleshooting

### Problemas Comunes

#### 1. Error de conexión a Redis

\`\`\`
Error: connect ECONNREFUSED 127.0.0.1:6379
\`\`\`

**Solución**: Verificar que Redis esté ejecutándose:

\`\`\`bash
redis-cli ping
# Debe responder: PONG
\`\`\`

#### 2. Error de Firebase

\`\`\`
Error: Firebase service account not found
\`\`\`

**Solución**: Verificar que el archivo de credenciales existe y la ruta es correcta en `.env`.

#### 3. Base de datos bloqueada

\`\`\`
Error: SQLITE_BUSY: database is locked
\`\`\`

**Solución**: Verificar que no hay múltiples instancias accediendo a la DB simultáneamente.

#### 4. Token FCM inválido

\`\`\`
Error: messaging/invalid-registration-token
\`\`\`

**Solución**: El token FCM ha expirado o es inválido. El sistema automáticamente lo marca como inválido.

### Comandos de Diagnóstico

\`\`\`bash
# Verificar estado de Redis
redis-cli info

# Verificar logs en tiempo real
tail -f ./logs/app.log

# Verificar base de datos
sqlite3 ./data/notifications.db ".tables"

# Verificar colas
curl -H "X-API-Key: admin-key" http://localhost:3000/api/admin/queue-stats
\`\`\`

## 🔄 Deployment

### Producción

1. **Variables de entorno**:
   \`\`\`env
   NODE_ENV=production
   LOG_LEVEL=warn
   \`\`\`

2. **Process Manager** (PM2):
   \`\`\`bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   \`\`\`

3. **Nginx** (proxy reverso):
   \`\`\`nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   \`\`\`

### Docker

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run init-db

EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## 📝 Licencia

MIT License - ver archivo `LICENSE` para detalles.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico:

- 📧 Email: support@yourcompany.com
- 📖 Documentación: [Wiki del proyecto]
- 🐛 Issues: [GitHub Issues]

---

**¡Gracias por usar FCM Push Notifications API!** 🚀
