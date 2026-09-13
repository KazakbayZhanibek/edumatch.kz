const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

const migrations = [
  `CREATE TABLE IF NOT EXISTS military_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_url TEXT NOT NULL,
    service_type TEXT DEFAULT 'draft',
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    review_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_military_user ON military_verifications(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_military_status ON military_verifications(status)`,
  `CREATE TABLE IF NOT EXISTS ent_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_url TEXT NOT NULL,
    ent_score INTEGER,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    review_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ent_uploads_user ON ent_uploads(user_id)`,
];

for (const sql of migrations) {
  db.exec(sql);
  console.log('OK:', sql.slice(0, 60));
}

db.close();
console.log('\nAll migrations done');
