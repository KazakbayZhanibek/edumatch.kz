-- Migration: Roles, Password Reset, 2FA
-- Run: node -e "require('./database').getDb().exec(require('fs').readFileSync('scripts/migrate-roles.sql','utf8'))"

-- Роли пользователей (вместо is_admin)
-- admin=полный доступ, moderator_reviews=модератор отзывов, moderator_docs=проверяющий ЕНТ/военки, user=обычный
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Заполняем роли на основе is_admin
UPDATE users SET role = 'admin' WHERE is_admin = 1;
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Токены восстановления пароля
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- 2FA для администраторов
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT; -- JSON array of backup codes

-- Лимиты в файл (состояние)
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  window_start DATETIME NOT NULL,
  count INTEGER DEFAULT 1,
  UNIQUE(key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
