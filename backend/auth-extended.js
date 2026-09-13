/**
 * auth-extended.js — Password Recovery, 2FA, Roles
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb } = require('./database');

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

// ─── PASSWORD RECOVERY ──────────────────────────────

function generateResetToken(userId) {
  const db = getDb();
  // Invalidate old tokens
  db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(userId);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, hashToken(token), expiresAt);

  return { token, expiresAt };
}

function validateResetToken(token) {
  const db = getDb();
  const row = db.prepare(`
    SELECT pr.*, u.email, u.username
    FROM password_resets pr
    JOIN users u ON u.id = pr.user_id
    WHERE pr.token_hash = ? AND pr.used = 0 AND pr.expires_at > datetime('now')
  `).get(hashToken(token));

  if (!row) return { valid: false };
  return { valid: true, userId: row.user_id, email: row.email, username: row.username };
}

function resetPassword(token, newPassword) {
  const db = getDb();
  const validation = validateResetToken(token);
  if (!validation.valid) return { success: false, error: 'Ссылка недействительна или истекла' };

  if (!newPassword || newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[!@#$%^&*\-_=+]/.test(newPassword)) {
    return { success: false, error: 'Пароль должен содержать не менее 12 символов, заглавную букву, цифру и спецсимвол' };
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, validation.userId);
    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(validation.userId);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(validation.userId);
    db.prepare(`INSERT INTO audit_log (table_name, record_id, action, new_values, user_id) VALUES ('users', ?, 'UPDATE', ?, ?)`)
      .run(validation.userId, JSON.stringify({ action: 'password_reset' }), validation.userId);
  })();

  return { success: true, email: validation.email };
}

// ─── TWO-FACTOR AUTHENTICATION ──────────────────────────────

// Generate TOTP secret (for Google Authenticator)
function generateTwoFactorSecret(userId) {
  const db = getDb();
  const secret = crypto.randomBytes(20).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 32);

  // Generate backup codes
  const backupCodes = [];
  for (let i = 0; i < 8; i++) {
    backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  db.prepare('UPDATE users SET two_factor_secret = ?, two_factor_backup_codes = ? WHERE id = ?')
    .run(secret, JSON.stringify(backupCodes), userId);

  return { secret, backupCodes };
}

// Verify TOTP code (6 digits)
function verifyTwoFactorCode(userId, code) {
  const db = getDb();
  const user = db.prepare('SELECT two_factor_secret, two_factor_backup_codes FROM users WHERE id = ?').get(userId);
  if (!user?.two_factor_secret) return { valid: false, error: '2FA не настроена' };

  // Check if it's a backup code
  if (code.length === 8 && /^[A-F0-9]{8}$/i.test(code)) {
    const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');
    const codeIndex = backupCodes.indexOf(code.toUpperCase());
    if (codeIndex === -1) return { valid: false, error: 'Неверный код' };

    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    db.prepare('UPDATE users SET two_factor_backup_codes = ? WHERE id = ?')
      .run(JSON.stringify(backupCodes), userId);

    return { valid: true, type: 'backup' };
  }

  // Check TOTP (6 digits, valid for 30 seconds)
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { valid: false, error: 'Неверный формат кода' };
  }

  // Simple TOTP implementation (time-based, 30s window)
  const epoch = Math.floor(Date.now() / 30000);
  for (const offset of [-1, 0, 1]) {
    const counter = epoch + offset;
    const hmac = crypto.createHmac('sha1', Buffer.from(user.two_factor_secret, 'base64'))
      .update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'))
      .digest();
    const offset2 = hmac[hmac.length - 1] & 0x0f;
    const otp = ((hmac[offset2] & 0x7f) << 24 | (hmac[offset2 + 1] & 0xff) << 16 | (hmac[offset2 + 2] & 0xff) << 8 | (hmac[offset2 + 3] & 0xff)) % 1000000;
    if (otp.toString().padStart(6, '0') === code) {
      return { valid: true, type: 'totp' };
    }
  }

  return { valid: false, error: 'Неверный код' };
}

// Enable 2FA after verifying setup code
function enableTwoFactor(userId, code) {
  const result = verifyTwoFactorCode(userId, code);
  if (!result.valid) return { success: false, error: result.error };

  const db = getDb();
  db.prepare('UPDATE users SET two_factor_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  return { success: true };
}

// Disable 2FA
function disableTwoFactor(userId) {
  const db = getDb();
  db.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  return { success: true };
}

function isTwoFactorEnabled(userId) {
  const user = getDb().prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(userId);
  return user?.two_factor_enabled === 1;
}

// ─── ROLES ──────────────────────────────

const ROLES = {
  admin: { label: 'Полный администратор', permissions: ['all'] },
  moderator_reviews: { label: 'Модератор отзывов', permissions: ['reviews.read', 'reviews.moderate', 'overview.read'] },
  moderator_docs: { label: 'Проверяющий документы', permissions: ['verify.read', 'verify.review', 'overview.read'] },
  user: { label: 'Пользователь', permissions: [] },
};

function getUserRole(userId) {
  const user = getDb().prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return user?.role || 'user';
}

function hasPermission(userId, permission) {
  const role = getUserRole(userId);
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;
  if (roleConfig.permissions.includes('all')) return true;
  return roleConfig.permissions.includes(permission);
}

function setUserRole(userId, role) {
  if (!ROLES[role]) return { success: false, error: 'Некорректная роль' };
  const db = getDb();
  const result = db.prepare('UPDATE users SET role = ?, is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(role, role === 'admin' ? 1 : 0, userId);
  return result.changes ? { success: true } : { success: false, error: 'Пользователь не найден' };
}

// Middleware: check role permission
function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.userId, permission)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = {
  generateResetToken,
  validateResetToken,
  resetPassword,
  generateTwoFactorSecret,
  verifyTwoFactorCode,
  enableTwoFactor,
  disableTwoFactor,
  isTwoFactorEnabled,
  getUserRole,
  hasPermission,
  setUserRole,
  requirePermission,
  ROLES,
};
