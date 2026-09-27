/**
 * database.js
 * SQLite инициализация и управление подключением
 * Используется better-sqlite3 для синхронных операций на сервере
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'edumatch.db');

let db = null;

/**
 * Инициализирует БД и создает схему
 */
function initDatabase() {
  if (db) return db;
  // Если БД существует и не повреждена, просто открываем
  if (fs.existsSync(DB_PATH)) {
    try {
      db = new Database(DB_PATH);
      // Проверяем, что БД валидна
      if (db.pragma('quick_check', { simple: true }) !== 'ok') {
        throw new Error('SQLite integrity check failed');
      }
      console.log('✓ Подключено к существующей БД:', DB_PATH);
      migrateExistingDb(db);
      return db;
    } catch (e) {
      db?.close();
      db = null;
      throw new Error(`Cannot initialize database; original file preserved: ${e.message}`, { cause: e });
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
    { table: 'users', col: 'role', sql: "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'" },
    { table: 'users', col: 'two_factor_enabled', sql: 'ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0' },
    { table: 'users', col: 'two_factor_secret', sql: 'ALTER TABLE users ADD COLUMN two_factor_secret TEXT' },
    { table: 'users', col: 'two_factor_backup_codes', sql: 'ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT' },
    { table: 'users', col: 'ent_score', sql: 'ALTER TABLE users ADD COLUMN ent_score INTEGER' },
    { table: 'users', col: 'military_service', sql: 'ALTER TABLE users ADD COLUMN military_service INTEGER DEFAULT 0' },
    { table: 'specialties', col: 'code', sql: 'ALTER TABLE specialties ADD COLUMN code TEXT' },
    { table: 'reviews', col: 'moderated_at', sql: 'ALTER TABLE reviews ADD COLUMN moderated_at DATETIME' },
    { table: 'reviews', col: 'moderated_by', sql: 'ALTER TABLE reviews ADD COLUMN moderated_by INTEGER' },
    // description_kk/en в universities
    { table: 'universities', col: 'description_kk', sql: "ALTER TABLE universities ADD COLUMN description_kk TEXT" },
    { table: 'universities', col: 'description_en', sql: "ALTER TABLE universities ADD COLUMN description_en TEXT" },
    { table: 'universities', col: 'is_free', sql: 'ALTER TABLE universities ADD COLUMN is_free INTEGER NOT NULL DEFAULT 0' },
    // academic_year в admission_requirements
    { table: 'admission_requirements', col: 'academic_year', sql: "ALTER TABLE admission_requirements ADD COLUMN academic_year TEXT DEFAULT '2025-2026'" },
    // description_kk/en и university_id, city_id, academic_year в grants
    { table: 'grants', col: 'name_kk', sql: 'ALTER TABLE grants ADD COLUMN name_kk TEXT' },
    { table: 'grants', col: 'name_en', sql: 'ALTER TABLE grants ADD COLUMN name_en TEXT' },
    { table: 'grants', col: 'requirements_kk', sql: 'ALTER TABLE grants ADD COLUMN requirements_kk TEXT' },
    { table: 'grants', col: 'requirements_en', sql: 'ALTER TABLE grants ADD COLUMN requirements_en TEXT' },
    { table: 'grants', col: 'description_kk', sql: "ALTER TABLE grants ADD COLUMN description_kk TEXT" },
    { table: 'grants', col: 'description_en', sql: "ALTER TABLE grants ADD COLUMN description_en TEXT" },
    { table: 'grants', col: 'university_id', sql: "ALTER TABLE grants ADD COLUMN university_id INTEGER" },
    { table: 'grants', col: 'city_id', sql: "ALTER TABLE grants ADD COLUMN city_id INTEGER" },
    { table: 'grants', col: 'academic_year', sql: "ALTER TABLE grants ADD COLUMN academic_year TEXT DEFAULT '2025-2026'" },
    { table: 'grants', col: 'is_active', sql: 'ALTER TABLE grants ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1' },
    { table: 'grants', col: 'source_url', sql: 'ALTER TABLE grants ADD COLUMN source_url TEXT' },
    { table: 'grants', col: 'source_title', sql: 'ALTER TABLE grants ADD COLUMN source_title TEXT' },
    { table: 'grants', col: 'verification_status', sql: "ALTER TABLE grants ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'needs_review'" },
    { table: 'grants', col: 'verified_at', sql: 'ALTER TABLE grants ADD COLUMN verified_at TEXT' },
    { table: 'grants', col: 'provider_name', sql: 'ALTER TABLE grants ADD COLUMN provider_name TEXT' },
    { table: 'grants', col: 'provider_type', sql: 'ALTER TABLE grants ADD COLUMN provider_type TEXT' },
    { table: 'grants', col: 'coverage_type', sql: 'ALTER TABLE grants ADD COLUMN coverage_type TEXT' },
    { table: 'grants', col: 'coverage_amount', sql: 'ALTER TABLE grants ADD COLUMN coverage_amount TEXT' },
    { table: 'grants', col: 'application_url', sql: 'ALTER TABLE grants ADD COLUMN application_url TEXT' },
    { table: 'grants', col: 'application_method', sql: 'ALTER TABLE grants ADD COLUMN application_method TEXT' },
    { table: 'grants', col: 'documents', sql: "ALTER TABLE grants ADD COLUMN documents TEXT DEFAULT '[]'" },
    { table: 'grants', col: 'eligibility_categories', sql: "ALTER TABLE grants ADD COLUMN eligibility_categories TEXT DEFAULT '[]'" },
    { table: 'grants', col: 'study_levels', sql: "ALTER TABLE grants ADD COLUMN study_levels TEXT DEFAULT '[]'" },
    { table: 'grants', col: 'programme_codes', sql: "ALTER TABLE grants ADD COLUMN programme_codes TEXT DEFAULT '[]'" },
    { table: 'grants', col: 'subject_requirements', sql: "ALTER TABLE grants ADD COLUMN subject_requirements TEXT DEFAULT '[]'" },
    { table: 'grants', col: 'last_checked_by', sql: 'ALTER TABLE grants ADD COLUMN last_checked_by TEXT' },
    { table: 'grants', col: 'review_notes', sql: 'ALTER TABLE grants ADD COLUMN review_notes TEXT' },
    { table: 'grants', col: 'reviewed_until', sql: 'ALTER TABLE grants ADD COLUMN reviewed_until TEXT' },
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

  // Do not let a partially migrated database start and fail later in public APIs.
  for (const [table, required] of Object.entries({ universities: ['is_free'], grants: ['is_active'] })) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
    for (const column of required) {
      if (!columns.includes(column)) throw new Error(`Database migration incomplete: missing ${table}.${column}`);
    }
  }

  // Keep legacy administrators functional while introducing explicit roles.
  db.prepare("UPDATE users SET role = 'admin' WHERE is_admin = 1 AND (role IS NULL OR role = 'user')").run();
  db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);

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

  // Верификация военной службы и загрузка результатов ЕНТ
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS military_verifications (
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
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_military_user ON military_verifications(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_military_status ON military_verifications(status)');

    db.exec(`CREATE TABLE IF NOT EXISTS ent_uploads (
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
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_ent_uploads_user ON ent_uploads(user_id)');
  } catch (e) { /* verification tables may already exist */ }

  // File-backed verification uploads were introduced after the original
  // document_url-only schema. Add the fields to real, pre-existing databases.
  for (const table of ['ent_uploads', 'military_verifications']) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    for (const [name, type] of [['file_path', 'TEXT'], ['file_size', 'INTEGER'], ['auto_delete_at', 'DATETIME']]) {
      if (!columns.some(column => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
  db.exec(require('./planner-source-store').schema);
  db.exec(require('./programme-store').schema);
  db.exec(require('./funding-store').schema);
  // Catalog and source APIs must also work on fresh or pre-catalog databases.
  // Only additive, idempotent DDL; failure aborts startup instead of leaving broken routes.
  db.transaction(() => db.exec(fs.readFileSync(path.join(__dirname, 'catalog-support-schema.sql'), 'utf8')))();
  db.exec(`CREATE TABLE IF NOT EXISTS admission_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_admission_plans_user ON admission_plans(user_id);`);
  db.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);`);

  // Required by the admin panel, including databases created before audit support.
  // Run these migrations atomically and propagate errors instead of silently skipping them.
  db.transaction(() => {
    const userColumns = db.prepare('PRAGMA table_info(users)').all();
    for (const [name, type] of [['ent_verified_score', 'INTEGER'], ['ent_verified_at', 'TEXT']]) {
      if (!userColumns.some(column => column.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    }
    db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
      old_values TEXT, new_values TEXT, user_id INTEGER, ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);`);
    const columns = db.prepare('PRAGMA table_info(reviews)').all();
    if (!columns.some(column => column.name === 'moderation_status')) {
      db.exec("ALTER TABLE reviews ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'hidden'))");
      db.exec("UPDATE reviews SET moderation_status = 'approved' WHERE moderated_at IS NOT NULL");
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON reviews(moderation_status)');
  })();
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
