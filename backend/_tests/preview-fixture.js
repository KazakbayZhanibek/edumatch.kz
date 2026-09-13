// Local UI fixture, isolated from the working database and external AI services.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'edumatch-ui-'));
process.env.DB_PATH = path.join(fixture, 'preview.db');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = '';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:3037';
process.env.DOTENV_CONFIG_PATH = path.join(fixture, 'absent.env');
const app = require('../server');
const database = require('../database');
const db = database.getDb();
const hash = require('bcrypt').hashSync('DemoPassword123!', 10);
for (const [id, name, isAdmin] of [[1, 'admin', 1], [2, 'student', 0]]) {
  db.prepare('INSERT INTO users (id, email, username, full_name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name + '@fixture.test', name, name === 'admin' ? 'Администратор' : 'Тестовый абитуриент', hash, isAdmin);
}
const documentUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
db.prepare('INSERT INTO ent_uploads (user_id, document_url, ent_score) VALUES (2, ?, 108)').run(documentUrl);
db.prepare("INSERT INTO military_verifications (user_id, document_url, service_type) VALUES (2, ?, 'draft')").run(documentUrl);
db.prepare("INSERT INTO cities (id, name) VALUES (1, 'Алматы')").run();
const server = app.listen(3037, '127.0.0.1', () => console.log('UI fixture: http://127.0.0.1:' + server.address().port));
function stop() { server.close(() => { database.closeDb(); fs.rmSync(fixture, { recursive: true, force: true }); process.exit(0); }); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
