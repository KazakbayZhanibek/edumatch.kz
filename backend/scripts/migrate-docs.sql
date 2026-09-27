-- Migration: Add notifications table and document file paths
-- Run: node -e "require('./database').getDb().exec(require('fs').readFileSync('scripts/migrate-docs.sql','utf8'))"

-- Уведомления пользователям
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,          -- 'ent_reviewed', 'military_reviewed', 'application_update', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- Пути к файлам документов (вместо base64 в БД)
ALTER TABLE ent_uploads ADD COLUMN file_path TEXT;
ALTER TABLE ent_uploads ADD COLUMN file_size INTEGER;
ALTER TABLE ent_uploads ADD COLUMN auto_delete_at DATETIME;

ALTER TABLE military_verifications ADD COLUMN file_path TEXT;
ALTER TABLE military_verifications ADD COLUMN file_size INTEGER;
ALTER TABLE military_verifications ADD COLUMN auto_delete_at DATETIME;

-- Источники данных университетов
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER,
  source_name TEXT NOT NULL,
  source_url TEXT,
  last_checked_at DATETIME,
  last_updated_at DATETIME,
  data_type TEXT,              -- 'prices', 'contacts', 'specialties', 'general'
  notes TEXT,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_data_sources_uni ON data_sources(university_id);

-- Календарь дедлайнов
CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  deadline_date DATETIME NOT NULL,
  category TEXT,              -- 'grant', 'admission', 'document', 'exam'
  university_id INTEGER,
  academic_year TEXT DEFAULT '2025-2026',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_category ON deadlines(category);

-- Лимиты AI-запросов
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  request_date DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  UNIQUE(user_id, request_date),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
