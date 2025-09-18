-- Tabla para notificaciones pendientes
CREATE TABLE IF NOT EXISTS pending_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fcm_token TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    additional_data TEXT, -- JSON string
    notification_type TEXT DEFAULT 'notification', -- 'notification', 'data', 'both'
    priority TEXT DEFAULT 'normal', -- 'high', 'normal'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Tabla para historial de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_id INTEGER, -- ID de pending_notifications
    fcm_token TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    additional_data TEXT,
    notification_type TEXT,
    priority TEXT,
    status TEXT NOT NULL, -- 'sent', 'failed', 'invalid_token'
    attempts INTEGER DEFAULT 1,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    response_data TEXT, -- Respuesta de FCM
    error_message TEXT,
    FOREIGN KEY (original_id) REFERENCES pending_notifications(id)
);

-- Tabla para tokens FCM inválidos
CREATE TABLE IF NOT EXISTS invalid_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fcm_token TEXT UNIQUE NOT NULL,
    reason TEXT,
    marked_invalid_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_notifications(status);
CREATE INDEX IF NOT EXISTS idx_pending_scheduled ON pending_notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_history_token ON notification_history(fcm_token);
CREATE INDEX IF NOT EXISTS idx_history_sent_at ON notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_invalid_tokens ON invalid_tokens(fcm_token);
