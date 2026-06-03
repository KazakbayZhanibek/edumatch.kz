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
