const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'conversations.db');

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database:', DB_PATH);
    initializeSchema();
  }
});

// Initialize database schema
function initializeSchema() {
  db.serialize(() => {
    // Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        user_id TEXT,
        metadata TEXT
      )
    `);

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Tool calls table
    db.run(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        arguments TEXT,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id)
      )
    `);

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)');

    console.log('✅ Database schema initialized');
  });
}

// Session management
function createSession(sessionId, metadata = {}) {
  return new Promise((resolve, reject) => {
    const metadataJson = JSON.stringify(metadata);

    db.run(
      'INSERT INTO sessions (id, metadata) VALUES (?, ?)',
      [sessionId, metadataJson],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(sessionId);
        }
      }
    );
  });
}

function endSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.metadata) {
            row.metadata = JSON.parse(row.metadata);
          }
          resolve(row);
        }
      }
    );
  });
}

function getSessions(limit = 50, offset = 0) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => {
            if (row.metadata) {
              row.metadata = JSON.parse(row.metadata);
            }
            return row;
          });
          resolve(rows);
        }
      }
    );
  });
}

// Message management
function addMessage(sessionId, role, content, metadata = {}) {
  return new Promise((resolve, reject) => {
    const metadataJson = JSON.stringify(metadata);

    db.run(
      'INSERT INTO messages (session_id, role, content, metadata) VALUES (?, ?, ?, ?)',
      [sessionId, role, content, metadataJson],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function getMessages(sessionId, limit = 100, offset = 0) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?',
      [sessionId, limit, offset],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => {
            if (row.metadata) {
              row.metadata = JSON.parse(row.metadata);
            }
            return row;
          });
          resolve(rows);
        }
      }
    );
  });
}

function getRecentMessages(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => {
            if (row.metadata) {
              row.metadata = JSON.parse(row.metadata);
            }
            return row;
          });
          resolve(rows);
        }
      }
    );
  });
}

// Tool call management
function addToolCall(messageId, toolName, args, result) {
  return new Promise((resolve, reject) => {
    const argsJson = JSON.stringify(args);
    const resultJson = JSON.stringify(result);

    db.run(
      'INSERT INTO tool_calls (message_id, tool_name, arguments, result) VALUES (?, ?, ?, ?)',
      [messageId, toolName, argsJson, resultJson],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function getToolCalls(messageId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM tool_calls WHERE message_id = ? ORDER BY timestamp ASC',
      [messageId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => {
            if (row.arguments) {
              row.arguments = JSON.parse(row.arguments);
            }
            if (row.result) {
              row.result = JSON.parse(row.result);
            }
            return row;
          });
          resolve(rows);
        }
      }
    );
  });
}

// Search and analytics
function searchMessages(query, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM messages WHERE content LIKE ? ORDER BY timestamp DESC LIMIT ?',
      [`%${query}%`, limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => {
            if (row.metadata) {
              row.metadata = JSON.parse(row.metadata);
            }
            return row;
          });
          resolve(rows);
        }
      }
    );
  });
}

function getConversationStats(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
        MIN(timestamp) as first_message,
        MAX(timestamp) as last_message
      FROM messages
      WHERE session_id = ?
      `,
      [sessionId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows[0]);
        }
      }
    );
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
}

module.exports = {
  db,
  createSession,
  endSession,
  getSession,
  getSessions,
  addMessage,
  getMessages,
  getRecentMessages,
  addToolCall,
  getToolCalls,
  searchMessages,
  getConversationStats,
  closeDatabase
};
