const sqlite3 = require("sqlite3").verbose()
const fs = require("fs")
const path = require("path")
require("dotenv").config()

const dbPath = process.env.DATABASE_PATH || "./data/notifications.db"
const schemaPath = path.join(__dirname, "schema.sql")

// Crear directorio de datos si no existe
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Inicializar base de datos
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error al conectar con la base de datos:", err)
        reject(err)
        return
      }
      console.log("Conectado a la base de datos SQLite")
    })

    // Leer y ejecutar el esquema
    const schema = fs.readFileSync(schemaPath, "utf8")

    db.exec(schema, (err) => {
      if (err) {
        console.error("Error al crear las tablas:", err)
        reject(err)
        return
      }
      console.log("Tablas creadas exitosamente")

      db.close((err) => {
        if (err) {
          console.error("Error al cerrar la base de datos:", err)
          reject(err)
          return
        }
        console.log("Base de datos inicializada correctamente")
        resolve()
      })
    })
  })
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { initDatabase }
