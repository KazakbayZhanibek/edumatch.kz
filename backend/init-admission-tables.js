/**
 * Создаёт таблицы Admission Predictor в существующей БД.
 * node init-admission-tables.js
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'edumatch.db'));
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const section = schema.split('-- ==================== ADMISSION PREDICTOR ====================')[1];

if (!section) {
  console.error('Admission section not found in schema.sql');
  process.exit(1);
}

db.exec(section.split('-- ====================')[0] || section);
console.log('✓ Таблицы admission_requirements и prediction_history готовы');
db.close();
