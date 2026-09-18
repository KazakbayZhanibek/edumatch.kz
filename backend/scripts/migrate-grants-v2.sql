-- Migration: Extend grants table with full catalog fields
-- Run: node -e "require('./database').getDb().exec(require('fs').readFileSync('scripts/migrate-grants-v2.sql','utf8'))"

-- Новые поля для полного каталога грантов
ALTER TABLE grants ADD COLUMN provider_name TEXT;
ALTER TABLE grants ADD COLUMN provider_type TEXT;        -- 'government', 'university', 'corporate', 'foundation', 'akimat', 'international'
ALTER TABLE grants ADD COLUMN coverage_type TEXT;         -- 'full', 'partial', 'tuition_only', 'tuition_dorm', 'stipend_only', 'unknown'
ALTER TABLE grants ADD COLUMN coverage_amount TEXT;       -- e.g. '100%', '500000 ₸/год', 'полное покрытие'
ALTER TABLE grants ADD COLUMN application_url TEXT;
ALTER TABLE grants ADD COLUMN application_method TEXT;    -- 'online', 'offline', 'portal', 'email'
ALTER TABLE grants ADD COLUMN documents TEXT;             -- JSON array of required documents
ALTER TABLE grants ADD COLUMN eligibility_categories TEXT; -- JSON array: ['orphan', 'disabled', 'large_family', 'rural', 'general']
ALTER TABLE grants ADD COLUMN study_levels TEXT;          -- JSON array: ['bachelor', 'master', 'phd']
ALTER TABLE grants ADD COLUMN programme_codes TEXT;        -- JSON array: ['B057', 'B058']
ALTER TABLE grants ADD COLUMN subject_requirements TEXT;  -- JSON array: ['math', 'informatics']
ALTER TABLE grants ADD COLUMN last_checked_by TEXT;       -- admin username
ALTER TABLE grants ADD COLUMN review_notes TEXT;
ALTER TABLE grants ADD COLUMN reviewed_until TEXT;        -- when to re-check

-- Связь: Грант ↔ Университет (многие-ко-многим, для грантов охватывающих несколько вузов)
CREATE TABLE IF NOT EXISTS grant_universities (
  grant_id INTEGER NOT NULL,
  university_id INTEGER NOT NULL,
  PRIMARY KEY(grant_id, university_id),
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE CASCADE,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_grant_universities_grant ON grant_universities(grant_id);

-- Связь: Грант ↔ Город (многие-ко-многим)
CREATE TABLE IF NOT EXISTS grant_cities (
  grant_id INTEGER NOT NULL,
  city_id INTEGER NOT NULL,
  PRIMARY KEY(grant_id, city_id),
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE CASCADE,
  FOREIGN KEY(city_id) REFERENCES cities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_grant_cities_grant ON grant_cities(grant_id);

-- Сохранённые гранты пользователей
CREATE TABLE IF NOT EXISTS saved_grants (
  user_id INTEGER NOT NULL,
  grant_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, grant_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_saved_grants_user ON saved_grants(user_id);
