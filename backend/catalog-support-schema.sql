-- Additive startup schema shared by fresh and existing databases.
CREATE TABLE IF NOT EXISTS grant_cities (
  grant_id INTEGER NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (grant_id, city_id)
);
CREATE INDEX IF NOT EXISTS idx_grant_cities_grant ON grant_cities(grant_id);
CREATE TABLE IF NOT EXISTS saved_grants (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_id INTEGER NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, grant_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_grants_user ON saved_grants(user_id);
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  last_checked_at DATETIME,
  last_updated_at DATETIME,
  data_type TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_sources_uni ON data_sources(university_id);
CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  deadline_date DATETIME NOT NULL,
  category TEXT,
  university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
  academic_year TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_category ON deadlines(category);
