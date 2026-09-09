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
      migrateExistingDb(db);
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

  // Миграции для существующих БД (безопасные ALTER TABLE)
  migrateExistingDb(db);

  return db;
}

/**
 * Миграции для добавления недостающих колонок/таблиц в существующую БД
 */
function migrateExistingDb(db) {
  const migrations = [
    // is_admin колонка в users
    { table: 'users', col: 'is_admin', sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0" },
    { table: 'users', col: 'ent_score', sql: 'ALTER TABLE users ADD COLUMN ent_score INTEGER' },
    { table: 'users', col: 'military_service', sql: 'ALTER TABLE users ADD COLUMN military_service INTEGER DEFAULT 0' },
    { table: 'reviews', col: 'moderated_at', sql: 'ALTER TABLE reviews ADD COLUMN moderated_at DATETIME' },
    { table: 'reviews', col: 'moderated_by', sql: 'ALTER TABLE reviews ADD COLUMN moderated_by INTEGER' },
    // description_kk/en в universities
    { table: 'universities', col: 'description_kk', sql: "ALTER TABLE universities ADD COLUMN description_kk TEXT" },
    { table: 'universities', col: 'description_en', sql: "ALTER TABLE universities ADD COLUMN description_en TEXT" },
    // academic_year в admission_requirements
    { table: 'admission_requirements', col: 'academic_year', sql: "ALTER TABLE admission_requirements ADD COLUMN academic_year TEXT DEFAULT '2025-2026'" },
    // description_kk/en и university_id, city_id, academic_year в grants
    { table: 'grants', col: 'description_kk', sql: "ALTER TABLE grants ADD COLUMN description_kk TEXT" },
    { table: 'grants', col: 'description_en', sql: "ALTER TABLE grants ADD COLUMN description_en TEXT" },
    { table: 'grants', col: 'university_id', sql: "ALTER TABLE grants ADD COLUMN university_id INTEGER" },
    { table: 'grants', col: 'city_id', sql: "ALTER TABLE grants ADD COLUMN city_id INTEGER" },
    { table: 'grants', col: 'academic_year', sql: "ALTER TABLE grants ADD COLUMN academic_year TEXT DEFAULT '2025-2026'" },
    { table: 'universities', col: 'address', sql: 'ALTER TABLE universities ADD COLUMN address TEXT' },
    { table: 'universities', col: 'source_record_id', sql: 'ALTER TABLE universities ADD COLUMN source_record_id INTEGER' },
  ];

  for (const m of migrations) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
      if (!cols.some(c => c.name === m.col)) {
        db.exec(m.sql);
        console.log(`  + ${m.table}.${m.col}`);
      }
    } catch (e) {
      // Игнорируем если колонка уже существует или таблица не найдена
    }
  }

  // Единственный владелец админского профиля задаётся по подтверждённой почте.
  try {
    db.prepare("UPDATE users SET is_admin = 1 WHERE lower(email) = 'janibekkaz3@gmail.com'").run();
  } catch (e) { /* users table may not exist yet */ }

  // Создаём таблицу reviews если нет
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      pros TEXT, cons TEXT, comment TEXT, faculty TEXT, study_year TEXT,
      moderated_at DATETIME, moderated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_reviews_university ON reviews(university_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)");
  } catch (e) { /* exists */ }

  // Создаём таблицу query_log если нет
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS query_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL, intent TEXT, lang TEXT DEFAULT 'ru',
      response_time_ms INTEGER, user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_query_log_intent ON query_log(intent)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_query_log_created ON query_log(created_at)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_query_log_lang ON query_log(lang)");
  } catch (e) { /* exists */ }

  // Трекер заявок пользователя
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS application_tracker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      university_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'collecting',
      academic_year TEXT DEFAULT '2025-2026',
      deadline TEXT,
      submitted_at TEXT,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE,
      UNIQUE(user_id, university_id)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_application_tracker_user ON application_tracker(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_application_tracker_status ON application_tracker(user_id, status)');
  } catch (e) { /* exists */ }
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
