-- schema.sql
-- SQLite schema для EduMatchKZ
-- Нормализованная структура с индексами и future-fields

-- Города
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Специальности (категория) 
CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_specialties_category ON specialties(category);

-- Университеты (основная таблица)
-- Future-fields: last_updated_at, data_status, admission_*
CREATE TABLE IF NOT EXISTS universities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  city_id INTEGER NOT NULL,
  qs_world INTEGER,
  qs_asia INTEGER,
  price_from INTEGER NOT NULL,
  price_to INTEGER NOT NULL,
  website TEXT,
  description TEXT,
  founded INTEGER,
  students_count INTEGER,
  languages TEXT NOT NULL,           -- JSON array: ["Казахский", "Русский", "Английский"]
  accreditations TEXT NOT NULL,      -- JSON array: ["Национальная", "QS Stars"]
  has_dorm INTEGER NOT NULL,         -- 0 или 1
  dorm_price INTEGER,
  avg_salary INTEGER,
  lat REAL,
  lng REAL,
  is_top INTEGER DEFAULT 0,          -- 0 или 1 (входит ли в ТОП-20)
  last_updated_at DATETIME,          -- future-field
  data_status TEXT,                  -- future-field: 'active', 'inactive', 'pending'
  admission_phone TEXT,              -- future-field
  admission_email TEXT,              -- future-field
  admission_whatsapp TEXT,           -- future-field
  FOREIGN KEY(city_id) REFERENCES cities(id)
);
CREATE INDEX IF NOT EXISTS idx_universities_city_id ON universities(city_id);
CREATE INDEX IF NOT EXISTS idx_universities_price_from ON universities(price_from);
CREATE INDEX IF NOT EXISTS idx_universities_qs_world ON universities(qs_world);
CREATE INDEX IF NOT EXISTS idx_universities_is_top ON universities(is_top);

-- Связь: Университет ↔ Специальность (многие-ко-многим)
CREATE TABLE IF NOT EXISTS university_specialties (
  university_id INTEGER NOT NULL,
  specialty_id INTEGER NOT NULL,
  PRIMARY KEY(university_id, specialty_id),
  FOREIGN KEY(university_id) REFERENCES universities(id),
  FOREIGN KEY(specialty_id) REFERENCES specialties(id)
);

-- Гранты
CREATE TABLE IF NOT EXISTS grants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'government', 'regional', 'corporate', 'university'
  amount TEXT NOT NULL,
  description TEXT,
  requirements TEXT NOT NULL,        -- JSON array: ["Требование 1", "Требование 2", ...]
  deadline TEXT,
  link TEXT
);
CREATE INDEX IF NOT EXISTS idx_grants_type ON grants(type);

-- Связь: Грант ↔ Специальность (многие-ко-многим)
CREATE TABLE IF NOT EXISTS grant_specialties (
  grant_id INTEGER NOT NULL,
  specialty_id INTEGER NOT NULL,
  PRIMARY KEY(grant_id, specialty_id),
  FOREIGN KEY(grant_id) REFERENCES grants(id),
  FOREIGN KEY(specialty_id) REFERENCES specialties(id)
);

-- Советы / Рекомендации
CREATE TABLE IF NOT EXISTS tips (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  tip TEXT
);

-- ==================== PHASE 2: AUTHENTICATION ====================

-- Пользователи (новое в Phase 2)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  profile_picture TEXT,
  bio TEXT,
  preferences TEXT,                  -- JSON: {"theme": "light", "language": "kk"}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Сохранённые вузы (избранные)
CREATE TABLE IF NOT EXISTS saved_universities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  university_id INTEGER NOT NULL,
  note TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE,
  UNIQUE(user_id, university_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_universities_user_id ON saved_universities(user_id);

-- Сессии пользователя (JWT токены)
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);

-- История чатов с ИИ
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  context TEXT,                      -- JSON с параметрами запроса
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- Результаты тестов (ЕНТ, профориентация и т.д.)
CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,           -- 'ent_calc', 'career_test', 'personality'
  score INTEGER,
  max_score INTEGER,
  result_data TEXT,                  -- JSON с результатами
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_type ON test_results(test_type);

-- ==================== ADMISSION PREDICTOR ====================

CREATE TABLE IF NOT EXISTS admission_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,
  specialty_id INTEGER NOT NULL,
  min_ent INTEGER NOT NULL,
  avg_ent INTEGER NOT NULL,
  grant_min_ent INTEGER,
  competition_level INTEGER DEFAULT 3,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE,
  FOREIGN KEY(specialty_id) REFERENCES specialties(id) ON DELETE CASCADE,
  UNIQUE(university_id, specialty_id)
);
CREATE INDEX IF NOT EXISTS idx_admission_req_uni ON admission_requirements(university_id);
CREATE INDEX IF NOT EXISTS idx_admission_req_spec ON admission_requirements(specialty_id);

-- История предсказаний (для улучшения модели в будущем)
CREATE TABLE IF NOT EXISTS prediction_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ent INTEGER,
  specialty_category TEXT,
  university_id INTEGER,
  predicted_chance INTEGER,
  actual_result INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_prediction_history_user ON prediction_history(user_id);

-- ==================== ADMISSION CHANCE STATISTICS ====================
-- Историческая статистика для детерминированного калькулятора
-- Хранит данные о вероятности поступления по различным сценариям

CREATE TABLE IF NOT EXISTS admission_chance_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  university_id INTEGER,
  specialty_id INTEGER NOT NULL,
  city_id INTEGER,
  grant_id INTEGER,
  ent_score_from INTEGER NOT NULL,
  ent_score_to INTEGER NOT NULL,
  gpa_from REAL,
  gpa_to REAL,
  budget_max INTEGER,
  language TEXT,
  requires_dorm_support INTEGER,
  competition_level TEXT,
  applicants_count INTEGER,
  admitted_count INTEGER,
  grant_winners_count INTEGER,
  chance_percent REAL NOT NULL,
  confidence_level TEXT DEFAULT 'medium',
  source_label TEXT,
  source_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE SET NULL,
  FOREIGN KEY(specialty_id) REFERENCES specialties(id) ON DELETE CASCADE,
  FOREIGN KEY(city_id) REFERENCES cities(id) ON DELETE SET NULL,
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE SET NULL
);

-- Индексы для быстрого поиска статистики
CREATE INDEX IF NOT EXISTS idx_admission_stats_year ON admission_chance_stats(year);
CREATE INDEX IF NOT EXISTS idx_admission_stats_university ON admission_chance_stats(university_id);
CREATE INDEX IF NOT EXISTS idx_admission_stats_specialty ON admission_chance_stats(specialty_id);
CREATE INDEX IF NOT EXISTS idx_admission_stats_city ON admission_chance_stats(city_id);
CREATE INDEX IF NOT EXISTS idx_admission_stats_ent_from ON admission_chance_stats(ent_score_from);
CREATE INDEX IF NOT EXISTS idx_admission_stats_ent_to ON admission_chance_stats(ent_score_to);
CREATE INDEX IF NOT EXISTS idx_admission_stats_composite ON admission_chance_stats(specialty_id, university_id, year);
