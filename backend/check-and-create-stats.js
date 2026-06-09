const db = require('better-sqlite3')('C:\\Users\\Janchik\\Desktop\\edumatch-kz\\backend\\edumatch.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const hasStats = tables.some(t => t.name === 'admission_chance_stats');
console.log('Has admission_chance_stats:', hasStats);
if (!hasStats) {
  console.log('Creating table...');
  db.exec(`CREATE TABLE IF NOT EXISTS admission_chance_stats (
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
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admission_stats_year ON admission_chance_stats(year);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_university ON admission_chance_stats(university_id);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_specialty ON admission_chance_stats(specialty_id);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_city ON admission_chance_stats(city_id);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_ent_from ON admission_chance_stats(ent_score_from);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_ent_to ON admission_chance_stats(ent_score_to);
  CREATE INDEX IF NOT EXISTS idx_admission_stats_composite ON admission_chance_stats(specialty_id, university_id, year);`);
  console.log('Indexes created. Running seed...');
  // Run the seed script
  require('./scripts/seed-admission-stats.js');
}
db.close();
