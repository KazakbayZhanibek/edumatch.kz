/*
 * Explicit, local-only administrator role assignment.
 * Usage: npm run admin:grant -- person@example.com
 */
const { initDatabase, closeDb } = require('../database');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:grant -- person@example.com');
  process.exitCode = 1;
  return;
}

try {
  const db = initDatabase();
  const user = db.prepare('SELECT id, email, is_admin FROM users WHERE lower(email) = ?').get(email);
  if (!user) {
    console.error('User not found. The user must register before an administrator grants the role.');
    process.exitCode = 1;
  } else if (user.is_admin) {
    console.log(`User ${user.email} is already an administrator.`);
  } else {
    db.transaction(() => {
      db.prepare('UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
      db.prepare("INSERT INTO audit_log (table_name, record_id, action, new_values) VALUES ('users', ?, 'UPDATE', ?)")
        .run(user.id, JSON.stringify({ is_admin: true, assigned_by: 'local-cli' }));
    })();
    console.log(`Administrator role granted to ${user.email}.`);
  }
} catch (error) {
  console.error(`Could not grant administrator role: ${error.message}`);
  process.exitCode = 1;
} finally {
  closeDb();
}
