/**
 * Добавляет таблицы Phase 2 в существующую БД (если их ещё нет).
 * Запуск: node init-auth-tables.js
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'edumatch.db'));
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const authSection = schema.split('-- ==================== PHASE 2')[1];
if (!authSection) {
  console.error('Phase 2 section not found in schema.sql');
  process.exit(1);
}

db.exec(authSection);
console.log('✓ Таблицы Phase 2 (users, sessions, saved, chat, tests) проверены/созданы');
db.close();
