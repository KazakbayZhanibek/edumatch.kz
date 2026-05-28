/**
 * database.js
 * SQLite инициализация и управление подключением
 * Используется better-sqlite3 для синхронных операций на сервере
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'edumatch.db');

let db = null;

/**
 * Инициализирует БД и создает схему
 */
function initDatabase() {
  // Если БД существует и не повреждена, просто открываем
  if (fs.existsSync(DB_PATH)) {
    try {
      db = new Database(DB_PATH);
      // Проверяем, что БД валидна
      db.exec('SELECT 1');
      console.log('✓ Подключено к существующей БД:', DB_PATH);
      return db;
    } catch (e) {
      // БД повреждена, удаляем и пересоздаем
      console.warn('⚠ БД повреждена, пересоздаю...', e.message);
      fs.unlinkSync(DB_PATH);
    }
  }

  // Создаем новую БД
  db = new Database(DB_PATH);
  console.log('✓ Создана новая БД:', DB_PATH);

  // Читаем и выполняем schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  db.exec(schema);
  console.log('✓ Схема БД создана');

  return db;
}

/**
 * Получает экземпляр БД (инициализирует, если нужно)
 */
function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

/**
 * Закрывает подключение (для корректного завершения)
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDb
};
