const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

let db = null;

async function initialize(dbPath = '/data/conversations.db') {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME,
          user_agent TEXT,
          ip_address TEXT,
          message_count INTEGER DEFAULT 0,
          total_audio_duration REAL DEFAULT 0
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        db.run(`CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          audio_duration REAL,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        db.run(`CREATE TABLE IF NOT EXISTS tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          tool_name TEXT NOT NULL,
          arguments TEXT NOT NULL,
          result TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          execution_time REAL,
          FOREIGN KEY (message_id) REFERENCES messages(id)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        db.run(`CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          base64_data TEXT NOT NULL,
          analysis TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (message_id) REFERENCES messages(id)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

async function getTables() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

async function createSession(metadata) {
  const sessionId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    db.run(
      'INSERT INTO sessions (id, user_agent, ip_address) VALUES (?, ?, ?)',
      [sessionId, metadata.userAgent, metadata.ip],
      (err) => {
        if (err) reject(err);
        resolve(sessionId);
      }
    );
  });
}

async function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

async function close() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      db = null;
      resolve();
    });
  });
}

module.exports = {
  initialize,
  getTables,
  createSession,
  getSession,
  close
};
