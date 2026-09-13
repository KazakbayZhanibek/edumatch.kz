const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

// All writes go to a disposable fixture. No local .env credentials or AI calls.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'edumatch-regression-'));
process.env.DB_PATH = path.join(fixture, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = '';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.DOTENV_CONFIG_PATH = path.join(fixture, 'absent.env');

let server, db, base, adminToken, userToken;
async function request(url, { token, ...options } = {}) {
  const response = await fetch(base + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `auth_token=${token}` } : {}), ...options.headers },
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, headers: response.headers, data };
}

before(async () => {
  // Emulate an older database: audit and review statuses have not been migrated.
  const legacy = new Database(process.env.DB_PATH);
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    .replace(/^.*ent_verified_.*\r?\n/gm, '')
    .replace(/^.*moderation_status.*\r?\n/gm, '')
    .replace(/CREATE TABLE IF NOT EXISTS audit_log \([\s\S]*?CREATE INDEX IF NOT EXISTS idx_audit_log_created[^;]+;/, '');
  legacy.exec(schema);
  legacy.prepare('INSERT INTO cities (id, name) VALUES (1, ?)').run('Test city');
  legacy.prepare('INSERT INTO specialties (id, name, category) VALUES (1, ?, ?)').run('Software', 'IT');
  const insertUniversity = legacy.prepare(`INSERT INTO universities
    (id, name, short_name, city_id, price_from, price_to, languages, accreditations, has_dorm, data_status)
    VALUES (?, ?, ?, 1, 100, 200, '[]', '[]', 0, ?)`);
  insertUniversity.run(1, 'Visible university', 'Visible', 'active');
  insertUniversity.run(2, 'Hidden university', 'Hidden', 'inactive');
  insertUniversity.run(3, 'Pending university', 'Pending', 'pending');
  legacy.exec('INSERT INTO university_specialties VALUES (1, 1), (2, 1), (3, 1)');
  legacy.prepare("INSERT INTO reviews (id, university_id, user_name, rating, moderated_at) VALUES (1, 1, 'Reviewer', 5, '2026-01-01')").run();
  legacy.prepare("INSERT INTO reviews (id, university_id, user_name, rating) VALUES (2, 1, 'Other reviewer', 1)").run();
  legacy.close();

  const app = require('../server');
  db = require('../database').getDb();
  const auth = require('../auth-service');
  for (const [id, isAdmin] of [[1, 1], [2, 0]]) {
    db.prepare('INSERT INTO users (id, email, username, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(id, `test${id}@example.test`, `test${id}`, 'unused', isAdmin);
    const token = auth.generateToken(id);
    db.prepare('INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(id, token, new Date(Date.now() + 3600000).toISOString());
    if (isAdmin) adminToken = token; else userToken = token;
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  require('../database').closeDb();
  fs.rmSync(fixture, { recursive: true, force: true });
});

test('old database gains audit support and preserves approved reviews', async () => {
  assert.equal(db.prepare('SELECT moderation_status FROM reviews WHERE id = 1').get().moderation_status, 'approved');
  assert.equal(db.prepare('SELECT moderation_status FROM reviews WHERE id = 2').get().moderation_status, 'pending');
  assert.equal((await request('/api/admin/audit', { token: adminToken })).status, 200);
  assert.equal((await request('/api/admin/overview', { token: adminToken })).data.overview.pendingReviews, 1);
  const database = require('../database');
  database.closeDb();
  db = database.initDatabase();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count, 2);
});

test('health and unknown API endpoints return the correct JSON status', async () => {
  assert.equal((await request('/health')).data.status, 'ok');
  const missing = await request('/api/does-not-exist');
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /application\/json/);
});

test('admin endpoints reject anonymous and ordinary users', async () => {
  assert.equal((await request('/api/admin/audit')).status, 401);
  assert.equal((await request('/api/admin/audit', { token: userToken })).status, 403);
});

test('database startup never grants administrator access based on an email address', () => {
  db.prepare('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)')
    .run(99, 'janibekkaz3@gmail.com', 'email-only-user', 'unused');
  const user = db.prepare('SELECT is_admin FROM users WHERE email = ?').get('janibekkaz3@gmail.com');
  assert.equal(user.is_admin, 0);
});

test('admin document uses a strict script policy', async () => {
  const response = await fetch(base + '/admin.html', { headers: { Cookie: `auth_token=${adminToken}` } });
  assert.equal(response.status, 200);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
});

test('catalog, detail and calculator omit hidden and pending universities', async () => {
  assert.deepEqual((await request('/api/universities')).data.map(row => row.id), [1]);
  assert.deepEqual((await request('/api/universities?is_top=top')).data.map(row => row.id), [1]);
  assert.equal((await request('/api/universities/2')).status, 404);
  const calculation = await request('/api/admission/calculate', { method: 'POST', body: JSON.stringify({ entScore: 100, specialtyId: 1 }) });
  assert.equal(calculation.status, 200);
  assert.deepEqual(calculation.data.matches.map(row => row.universityId), [1]);
});

test('moderation hides a review, updates public rating and can restore it', async () => {
  const before = (await request('/api/universities/1/reviews')).data;
  assert.equal(before.stats.count, 2);
  const hidden = await request('/api/admin/reviews/2/moderate', { token: adminToken, method: 'PATCH', body: JSON.stringify({ approved: false }) });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.data.moderation_status, 'hidden');
  const visible = (await request('/api/universities/1/reviews')).data;
  assert.deepEqual(visible.reviews.map(row => row.id), [1]);
  assert.equal(visible.stats.avg_rating, 5);
  assert.equal((await request('/api/admin/overview', { token: adminToken })).data.overview.pendingReviews, 0);
  const audit = (await request('/api/admin/audit', { token: adminToken })).data.audit;
  assert.ok(audit.some(row => row.table_name === 'reviews' && row.record_id === 2));
  assert.equal((await request('/api/admin/reviews/2/moderate', { token: adminToken, method: 'PATCH', body: JSON.stringify({ approved: true }) })).status, 200);
  assert.equal((await request('/api/universities/1/reviews')).data.stats.count, 2);
  assert.equal((await request('/api/admin/reviews/2/moderate', { token: adminToken, method: 'PATCH', body: '{}' })).status, 400);
});

test('university edits are audited and status changes affect the catalog', async () => {
  const result = await request('/api/admin/universities/2', { token: adminToken, method: 'PATCH', body: JSON.stringify({ data_status: 'active' }) });
  assert.equal(result.status, 200);
  assert.ok((await request('/api/universities')).data.some(row => row.id === 2));
  assert.ok(db.prepare("SELECT id FROM audit_log WHERE table_name = 'universities' AND record_id = 2").get());
  assert.equal((await request('/api/admin/universities/2', { token: adminToken, method: 'PATCH', body: JSON.stringify({ price_from: 300 }) })).status, 400);
});

test('failed audit write rolls back a university edit', async () => {
  db.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
  try {
    const result = await request('/api/admin/universities/1', { token: adminToken, method: 'PATCH', body: JSON.stringify({ data_status: 'inactive' }) });
    assert.equal(result.status, 500);
    assert.equal(db.prepare('SELECT data_status FROM universities WHERE id = 1').get().data_status, 'active');
  } finally { db.exec('DROP TRIGGER reject_audit'); }
});

test('cookie login saves actual calculator fields and avoids duplicate history', async () => {
  const body = JSON.stringify({ input: { entScore: 105, specialtyId: 1 }, matches: [{ universityId: 1, chancePercent: 75 }] });
  assert.equal((await request('/api/admission/save-history', { method: 'POST', body })).data.saved, false);
  const result = await request('/api/admission/save-history', { token: userToken, method: 'POST', body });
  assert.equal(result.status, 200);
  assert.equal(result.data.recordsCount, 1);
  const row = db.prepare('SELECT user_id, ent, specialty_category, university_id, predicted_chance FROM prediction_history').get();
  assert.deepEqual(row, { user_id: 2, ent: 105, specialty_category: 'IT', university_id: 1, predicted_chance: 75 });
  assert.equal((await request('/api/admission/save-history', { token: userToken, method: 'POST', body })).data.recordsCount, 0);
});

test('invalid calculator input returns 400 instead of success', async () => {
  const result = await request('/api/admission/calculate', { method: 'POST', body: JSON.stringify({ entScore: -1, specialtyId: 1 }) });
  assert.equal(result.status, 400);
  assert.ok(result.data.error);
});

test('CORS preflight allows PATCH used by admin and application tracker', async () => {
  const response = await request('/api/admin/universities/1', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'PATCH' } });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods'), /PATCH/);
});

test('corrupt databases are preserved byte-for-byte on startup failure', () => {
  const corruptPath = path.join(fixture, 'corrupt.db');
  const content = Buffer.from('This is intentionally not a SQLite database');
  fs.writeFileSync(corruptPath, content);
  const result = spawnSync(process.execPath, ['-e', "require('./database').initDatabase()"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: corruptPath }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.deepEqual(fs.readFileSync(corruptPath), content);
});

test('a fresh database starts with all required tables', () => {
  const result = spawnSync(process.execPath, ['-e', "const d=require('./database');const db=d.initDatabase();db.prepare('SELECT * FROM audit_log').all();db.prepare('SELECT moderation_status FROM reviews').all();d.closeDb();"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: path.join(fixture, 'fresh.db') }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

const documentUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const post = (url, body, token = userToken) => request(url, { token, method: 'POST', body: JSON.stringify(body) });
const profileUpdate = body => request('/api/users/profile', { token: userToken, method: 'PUT', body: JSON.stringify(body) });

test('manual ENT is unverified, validates 0..140 and can be cleared', async () => {
  assert.equal((await profileUpdate({ entScore: 0 })).status, 200);
  let status = (await request('/api/verify/ent/status', { token: userToken })).data;
  assert.equal(status.entScore, 0);
  assert.equal(status.verified, false);
  for (const entScore of [-1, 141, 100.5, '120', {}, []]) assert.equal((await profileUpdate({ entScore })).status, 400);
  assert.equal((await profileUpdate({ entScore: null })).status, 200);
  assert.equal((await request('/api/verify/ent/status', { token: userToken })).data.entScore, null);
});

test('document submission rejects fake formats, manual placeholders and invalid scores', async () => {
  for (const doc of ['manual_123', 'https://example.test/a.png', 'data:image/png;base64,YWJj', 'data:text/html;base64,PHNjcmlwdD4=']) {
    assert.equal((await post('/api/verify/ent', { documentUrl: doc, entScore: 100 })).status, 400);
  }
  assert.equal((await post('/api/verify/ent', { documentUrl, entScore: 141 })).status, 400);
  assert.equal((await post('/api/verify/military', { documentUrl, serviceType: 'invalid' })).status, 400);
});

test('ENT approval corrects the score, exposes document only to owner/admin, and is final', async () => {
  const submit = await post('/api/verify/ent', { documentUrl, entScore: 100 });
  assert.equal(submit.status, 201);
  const id = submit.data.id;
  assert.equal((await post('/api/verify/ent', { documentUrl, entScore: 100 })).status, 409);
  assert.equal((await request('/api/verify/ent/pending', { token: userToken })).status, 403);
  const pending = (await request('/api/verify/ent/pending', { token: adminToken })).data.requests;
  assert.equal(pending[0].has_document, 1);
  assert.equal(pending[0].document_url, undefined);
  const owner = await fetch(base + '/api/verify/ent/' + id + '/document', { headers: { Cookie: 'auth_token=' + userToken } });
  assert.equal(owner.status, 200); assert.equal(owner.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await owner.arrayBuffer()), Buffer.from(documentUrl.split(',')[1], 'base64'));
  db.prepare("INSERT INTO users (id, email, username, password_hash) VALUES (3, 'third@example.test', 'third', 'unused')").run();
  const token = require('../auth-service').generateToken(3);
  db.prepare('INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(3, token, new Date(Date.now() + 60000).toISOString());
  assert.equal((await request('/api/verify/ent/' + id + '/document', { token })).status, 404);
  assert.equal((await post('/api/verify/ent/' + id + '/review', { action: 'approve', entScore: 105 }, userToken)).status, 403);
  assert.equal((await post('/api/verify/ent/' + id + '/review', { action: 'approve', entScore: 105 }, adminToken)).status, 200);
  const status = (await request('/api/verify/ent/status', { token: userToken })).data;
  assert.equal(status.entScore, 105); assert.equal(status.verified, true); assert.equal(status.request.ent_score, 105);
  assert.equal((await request('/api/users/profile', { token: userToken })).data.entVerified, true);
  assert.equal((await post('/api/verify/ent/' + id + '/review', { action: 'reject', note: 'second decision' }, adminToken)).status, 409);
  assert.equal((await profileUpdate({ fullName: 'Test User', entScore: 105 })).status, 200);
  assert.equal((await request('/api/verify/ent/status', { token: userToken })).data.verified, true);
  await profileUpdate({ entScore: 110 });
  assert.equal((await request('/api/verify/ent/status', { token: userToken })).data.verified, false);
});

test('rejection needs a reason, supports retry and owner cancellation', async () => {
  const id = (await post('/api/verify/military', { documentUrl, serviceType: 'draft' })).data.id;
  assert.equal((await post('/api/verify/military/' + id + '/review', { action: 'oops' }, adminToken)).status, 400);
  assert.equal((await post('/api/verify/military/' + id + '/review', { action: 'reject' }, adminToken)).status, 400);
  assert.equal((await post('/api/verify/military/' + id + '/review', { action: 'reject', note: 'Please upload a clearer scan' }, adminToken)).status, 200);
  let status = (await request('/api/verify/military/status', { token: userToken })).data;
  assert.equal(status.verified, false); assert.equal(status.request.review_note, 'Please upload a clearer scan');
  const second = (await post('/api/verify/military', { documentUrl, serviceType: 'draft' })).data.id;
  assert.equal((await post('/api/verify/military/' + second + '/cancel', {}, adminToken)).status, 409);
  assert.equal((await post('/api/verify/military/' + second + '/cancel', {})).status, 200);
  assert.equal((await post('/api/verify/military/' + second + '/review', { action: 'approve' }, adminToken)).status, 409);
  const third = (await post('/api/verify/military', { documentUrl, serviceType: 'draft' })).data.id;
  assert.equal((await post('/api/verify/military/' + third + '/review', { action: 'approve' }, adminToken)).status, 200);
  status = (await request('/api/verify/military/status', { token: userToken })).data;
  assert.equal(status.verified, true); assert.equal(status.history.length, 3);
});

test('a 5 MB upload fits the JSON route limit and files above 5 MB are rejected', async () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024, 32); bytes.write('%PDF-1.7');
  const submit = await post('/api/verify/ent', { documentUrl: 'data:application/pdf;base64,' + bytes.toString('base64'), entScore: 0 });
  assert.equal(submit.status, 201);
  assert.equal((await post('/api/verify/ent/' + submit.data.id + '/review', { action: 'approve', entScore: 0 }, adminToken)).status, 200);
  assert.equal((await request('/api/verify/ent/status', { token: userToken })).data.entScore, 0);
  assert.equal((await request('/api/verify/ent/status', { token: userToken })).data.verified, true);
  const over = Buffer.concat([bytes, Buffer.from('x')]);
  assert.equal((await post('/api/verify/ent', { documentUrl: 'data:application/pdf;base64,' + over.toString('base64') })).status, 400);
});

test('an audit failure rolls back verification and the profile update together', async () => {
  const id = (await post('/api/verify/ent', { documentUrl, entScore: 90 })).data.id;
  db.exec("CREATE TRIGGER reject_verification_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  try {
    assert.equal((await post('/api/verify/ent/' + id + '/review', { action: 'approve' }, adminToken)).status, 500);
    assert.equal(db.prepare('SELECT status FROM ent_uploads WHERE id = ?').get(id).status, 'pending');
    assert.equal(db.prepare('SELECT ent_score FROM users WHERE id = 2').get().ent_score, 0);
  } finally { db.exec('DROP TRIGGER reject_verification_audit'); }
});

test('admission history is private to the user', async () => {
  assert.equal((await request('/api/admission/history')).status, 401);
  assert.ok((await request('/api/admission/history', { token: userToken })).data.history.length > 0);
  assert.deepEqual((await request('/api/admission/history', { token: adminToken })).data.history, []);
});

test('historical admission statistics cannot leak between universities', () => {
  const insert = db.prepare(`INSERT INTO admission_chance_stats
    (year, university_id, specialty_id, ent_score_from, ent_score_to, chance_percent, confidence_level)
    VALUES (?, ?, 1, 0, 140, ?, 'high')`);
  insert.run(new Date().getFullYear(), 1, 80); insert.run(new Date().getFullYear(), 2, 20);
  const { findHistoricalStats } = require('../admission-calculator');
  const rows = findHistoricalStats({ entScore: 100, specialtyId: 1, universityId: 1 });
  assert.equal(rows.length, 1); assert.equal(rows[0].university_id, 1);
});

test('malformed login and registration requests receive 400', async () => {
  assert.equal((await post('/api/auth/login', { email: {}, password: [] })).status, 400);
  assert.equal((await post('/api/auth/register', { email: 10, password: 'x', username: 'test' })).status, 400);
});

test('application tracker validates fields and isolates each user', async () => {
  const created = await post('/api/applications', { universityId: 1, academicYear: '2026-2027', deadline: '2026-12-01' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  for (const body of [{ academicYear: '2026-2026' }, { deadline: '2026-02-30' }, { status: 'unknown' }]) {
    assert.equal((await request('/api/applications/' + id, { token: userToken, method: 'PATCH', body: JSON.stringify(body) })).status, 400);
  }
  const patch = await request('/api/applications/' + id, { token: userToken, method: 'PATCH', body: JSON.stringify({ status: 'submitted', notes: 'Documents ready' }) });
  assert.equal(patch.status, 200);
  assert.equal((await request('/api/applications', { token: userToken })).data.applications[0].notes, 'Documents ready');
  assert.equal((await request('/api/applications/' + id, { token: adminToken, method: 'PATCH', body: '{"notes":"not mine"}' })).status, 400);
  assert.equal((await request('/api/applications/' + id, { token: adminToken, method: 'DELETE' })).status, 400);
  assert.equal((await request('/api/applications/' + id, { token: userToken, method: 'DELETE' })).status, 200);
});

test('deleting prediction history never deletes another user records', async () => {
  const row = db.prepare('SELECT id FROM prediction_history WHERE user_id = 2 LIMIT 1').get();
  assert.equal((await request('/api/admission/history/' + row.id, { token: adminToken, method: 'DELETE' })).status, 404);
  assert.equal((await request('/api/admission/history/all', { token: adminToken, method: 'DELETE' })).data.deleted, 0);
  assert.ok(db.prepare('SELECT id FROM prediction_history WHERE id = ?').get(row.id));
  assert.equal((await request('/api/admission/history/' + row.id, { token: userToken, method: 'DELETE' })).status, 200);
});
