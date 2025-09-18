const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const fs = require("fs")
require("dotenv").config()

class DatabaseConnection {
  constructor() {
    this.dbPath = process.env.DATABASE_PATH || "./data/notifications.db"
    this.db = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
          return
        }
        this.db.run("PRAGMA foreign_keys = ON")
        resolve(this.db)
      })
    })
  }

  getConnection() {
    if (!this.db) {
      throw new Error("Base de datos no conectada. Llama a connect() primero.")
    }
    return this.db
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err)
            return
          }
          this.db = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // Método para ejecutar consultas con promesas
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Base de datos no conectada"))
        return
      }

      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err)
          return
        }
        resolve({ id: this.lastID, changes: this.changes })
      })
    })
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Base de datos no conectada"))
        return
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
          return
        }
        resolve(row)
      })
    })
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Base de datos no conectada"))
        return
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        resolve(rows)
      })
    })
  }
}

module.exports = new DatabaseConnection()
