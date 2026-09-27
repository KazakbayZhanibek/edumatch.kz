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
const csrfTokens = new Map();
async function request(url, { token, ...options } = {}) {
  const csrfToken = csrfTokens.get(token || 'anonymous');
  const response = await fetch(base + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `auth_token=${token}` } : {}), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers },
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
  db.prepare(`INSERT INTO grants
    (id, name, type, amount, requirements, university_id, city_id, academic_year, verification_status)
    VALUES (1, 'Test grant', 'government', 'Уточняется', ?, 1, 1, '2026-2027', 'needs_review')`).run(JSON.stringify(['ЕНТ от 50']));
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
  for (const token of ['anonymous', adminToken, userToken]) {
    const response = await fetch(base + '/health', { headers: token === 'anonymous' ? {} : { Cookie: `auth_token=${token}` } });
    const cookie = response.headers.get('set-cookie') || '';
    const value = /csrf_token=([^;]+)/.exec(cookie)?.[1];
    if (!value) throw new Error('Test server did not issue a CSRF token');
    csrfTokens.set(token, decodeURIComponent(value));
  }
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  require('../database').closeDb();
  fs.rmSync(fixture, { recursive: true, force: true });
});

test('admin user buttons work without inline handlers and require confirmation', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin.js'), 'utf8');
  assert.doesNotMatch(source, /\bon(?:click|change)\s*=\s*["']/i);
  assert.match(source, /data-admin-action="deleteUser" data-id="\$\{item.id\}"/);
  const listeners = {};
  const confirm = {};
  const calls = [];
  const context = vm.createContext({
    document: {
      getElementById: id => id === 'modal-confirm' ? confirm : { addEventListener() {} },
      querySelectorAll: () => [],
      addEventListener: (type, handler) => { listeners[type] = handler; },
    },
    calls,
  });
  // Skip only the initial network bootstrap; exercise real delegated actions and deleteUser.
  vm.runInContext(source.replace(/loadAdmin\(\);\s*$/, ''), context);
  vm.runInContext(`
    showModal = (title, content) => calls.push({ modal: title, content });
    closeModal = () => calls.push({ closed: true });
    showToast = (message, type) => calls.push({ message, type });
    loadAdmin = () => calls.push({ refreshed: true });
    api = async (url, options) => { calls.push({ url, method: options.method }); };
  `, context);
  const click = (action, id) => listeners.click({
    target: { closest: () => ({ dataset: { adminAction: action, id: String(id) } }) },
    preventDefault() {},
  });
  click('deleteUser', 42);
  assert.match(calls[0].modal, /Удалить пользователя/);
  assert.equal(calls.some(call => call.url), false);
  click('closeModal');
  assert.equal(calls.some(call => call.url), false);
  click('deleteUser', 42);
  await confirm.onclick();
  assert.equal(calls.filter(call => call.url).length, 1);
  assert.equal(calls.find(call => call.url).url, '/admin/users/42');
  assert.equal(calls.find(call => call.url).method, 'DELETE');
  assert.ok(calls.some(call => call.refreshed));
  vm.runInContext(`api = async () => { throw new Error('Удаление отклонено'); };`, context);
  click('deleteUser', 42);
  await confirm.onclick();
  assert.ok(calls.some(call => call.message === 'Удаление отклонено' && call.type === 'error'));
});

test('grant verification requires evidence and writes an audit record', async () => {
  const list = await request('/api/admin/grants?limit=10', { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.data.grants[0].verification_status, 'needs_review');
  assert.deepEqual(list.data.grants[0].requirements, ['ЕНТ от 50']);

  const incomplete = await request('/api/admin/grants/1/verify', {
    token: adminToken,
    method: 'PATCH',
    body: JSON.stringify({ verification_status: 'verified', source_url: 'https://example.edu/grant' }),
  });
  assert.equal(incomplete.status, 400);

  const verified = await request('/api/admin/grants/1/verify', {
    token: adminToken,
    method: 'PATCH',
    body: JSON.stringify({
      verification_status: 'verified',
      source_url: 'https://example.edu/grant',
      source_title: 'Official grant rules',
      verified_at: '2026-09-17',
      deadline: '2026-10-30',
      amount: 'Полное покрытие обучения',
      requirements: ['ЕНТ от 50', 'Документ об образовании'],
    }),
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.grant.verification_status, 'verified');
  assert.deepEqual(verified.data.grant.requirements, ['ЕНТ от 50', 'Документ об образовании']);
  const stored = db.prepare('SELECT verification_status, source_url, deadline, verified_at, requirements FROM grants WHERE id = 1').get();
  assert.equal(stored.verification_status, 'verified');
  assert.equal(stored.source_url, 'https://example.edu/grant');
  assert.equal(stored.deadline, '2026-10-30');
  assert.equal(stored.verified_at, '2026-09-17');
  assert.deepEqual(JSON.parse(stored.requirements), ['ЕНТ от 50', 'Документ об образовании']);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE table_name = 'grants' AND record_id = 1").get().count, 1);
});

test('admin deletion removes dependent data, preserves audit, and enforces access', async () => {
  const id = 401;
  db.prepare('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)')
    .run(id, 'delete@example.test', 'delete-fixture', 'unused');
  db.prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, 'delete-session', '2099-01-01')").run(id);
  db.prepare("INSERT INTO chat_history (user_id, message, response) VALUES (?, 'test', 'test')").run(id);
  db.prepare("INSERT INTO test_results (user_id, test_type) VALUES (?, 'ent_calc')").run(id);
  db.prepare('INSERT INTO saved_universities (user_id, university_id) VALUES (?, 1)').run(id);
  const url = `/api/admin/users/${id}`;
  assert.equal((await request(url, { method: 'DELETE' })).status, 401);
  assert.equal((await request(url, { method: 'DELETE', token: userToken })).status, 403);
  assert.equal((await request(url, { method: 'DELETE', token: adminToken, headers: { 'X-CSRF-Token': 'invalid' } })).status, 403);
  assert.equal((await request(url, { method: 'DELETE', token: adminToken })).status, 200);
  for (const table of ['user_sessions', 'chat_history', 'test_results', 'saved_universities']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(id).n, 0);
  }
  assert.equal(db.prepare('SELECT id FROM users WHERE id = ?').get(id), undefined);
  assert.equal(db.prepare("SELECT user_id FROM audit_log WHERE table_name = 'users' AND record_id = ? AND action = 'DELETE'").get(id).user_id, 1);
  assert.equal((await request(url, { method: 'DELETE', token: adminToken })).status, 404);
  assert.equal((await request('/api/admin/users/1', { method: 'DELETE', token: adminToken })).status, 400);
  assert.equal((await request('/api/admin/users/2junk', { method: 'DELETE', token: adminToken })).status, 400);
});

test('admin deletion rolls back when audit writing fails', async () => {
  db.prepare("INSERT INTO users (id, email, username, password_hash) VALUES (402, 'rollback@example.test', 'rollback-delete', 'unused')").run();
  db.prepare("INSERT INTO chat_history (user_id, message, response) VALUES (402, 'test', 'test')").run();
  db.exec("CREATE TRIGGER reject_user_delete_audit BEFORE INSERT ON audit_log WHEN NEW.table_name = 'users' AND NEW.action = 'DELETE' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
  try {
    assert.equal((await request('/api/admin/users/402', { method: 'DELETE', token: adminToken })).status, 500);
    assert.ok(db.prepare('SELECT id FROM users WHERE id = 402').get());
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chat_history WHERE user_id = 402').get().n, 1);
  } finally {
    db.exec('DROP TRIGGER reject_user_delete_audit');
  }
});

test('grants API includes year and organiser and handles malformed requirements', async () => {
  db.prepare(`INSERT INTO grants (id,name,type,amount,requirements,academic_year,university_id,city_id,deadline)
    VALUES (901,'Test grant','university','variable','{}','2026-2027',1,1,'2026-07-20')`).run();
  try {
    const response = await request('/api/grants?lang=en');
    assert.equal(response.status, 200);
    const grant = response.data.find(g => g.id === 901);
    assert.equal(grant.academic_year, '2026-2027');
    assert.equal(grant.university_name, 'Visible university');
    assert.equal(grant.city_name, 'Test city');
    assert.deepEqual(grant.requirements, []);
  } finally { db.prepare('DELETE FROM grants WHERE id = 901').run(); }
});

test('unfinished recovery and 2FA are disabled without issuing secrets',async()=>{
 for(const url of ['/api/auth/forgot-password','/api/auth/reset-password','/api/auth/2fa/setup','/api/auth/2fa/enable']){
  const result=await request(url,{method:'POST',token:userToken,body:JSON.stringify({email:'test2@example.test'})});
  assert.equal(result.status,503);assert.equal(result.data.code,'FEATURE_UNAVAILABLE');assert.equal(result.data._dev_link,undefined);assert.equal(result.data.secret,undefined);
 }
 assert.equal((await request('/api/auth/2fa/status',{token:userToken})).status,503);
 assert.equal((await request('/api/auth/reset-password/validate?token=test')).status,503);
 assert.equal((await request('/api/auth/capabilities')).data.twoFactor,false);
});

test('planner asks questions, checks constraints, and isolates saved plans', async () => {
  const input={ent:110,subjects:['Математика','Информатика'],budget:200,specialtyId:1};
  assert.equal((await request('/api/planner/preview',{method:'POST',body:'{}'})).data.status,'needs_input');
  for(const patch of [{ent:141},{budget:-1},{subjects:['Math','Math']}]) {
    assert.equal((await request('/api/planner/preview',{method:'POST',body:JSON.stringify({...input,...patch})})).status,400);
  }
  const preview=await request('/api/planner/preview',{method:'POST',body:JSON.stringify(input)});
  assert.equal(preview.data.status,'ready');
  assert.deepEqual(preview.data.matches.map(m=>m.id),[1]);
  assert.equal(preview.data.matches[0].checks.subjects,'unverified');
  assert.equal(preview.data.matches[0].checks.ent,'unverified');
  const limited=await request('/api/planner/preview',{method:'POST',body:JSON.stringify({...input,budget:50})});
  assert.equal(limited.data.matches.length,0);
  assert.equal(limited.data.excluded[0].checks.budget,'outside');
  const payload=JSON.stringify({input,selectedIds:[1]});
  assert.equal((await request('/api/planner/plans',{method:'POST',body:payload})).status,401);
  assert.equal((await request('/api/planner/plans',{method:'POST',token:userToken,body:JSON.stringify({input,selectedIds:[2]})})).status,400);
  const saved=await request('/api/planner/plans',{method:'POST',token:userToken,body:payload});
  assert.equal(saved.status,201);
  assert.equal((await request('/api/planner/plans',{token:adminToken})).data.plans.length,0);
  assert.equal((await request('/api/planner/plans',{token:userToken})).data.plans.length,1);
  assert.equal((await request('/api/planner/plans/'+saved.data.id,{method:'DELETE',token:adminToken})).status,404);
  assert.equal((await request('/api/planner/plans/'+saved.data.id,{method:'DELETE',token:userToken})).status,200);
});

test('programme planner saves server-owned snapshots and isolates task updates',async()=>{
  const input={mode:'programmes',ent:110,budget:2000000,subjects:['math','informatics'],group:'B057',year:2027,funding:'paid',language:'any'};
  const preview=await request('/api/planner/programme-preview',{method:'POST',body:JSON.stringify(input)});
  assert.equal((await request('/api/planner/agent',{method:'POST',body:JSON.stringify(input)})).status,401);
  const agent=await request('/api/planner/agent',{method:'POST',token:userToken,body:JSON.stringify(input)});
  assert.equal(agent.data.agent.mode,'rules_fallback');
  assert.equal(preview.status,200);assert.equal(preview.data.status,'ready');
  const payload=JSON.stringify({input,selectedIds:['iitu-cs'],tasks:[{id:'fake',done:true}]});
  const saved=await request('/api/planner/plans',{method:'POST',token:userToken,body:payload});assert.equal(saved.status,201);
  assert.ok(saved.data.plan.tasks.every(t=>t.programmeId==='iitu-cs'&&!t.done));
  const url='/api/planner/plans/'+saved.data.id+'/tasks',body=JSON.stringify({taskId:saved.data.plan.tasks[0].id,done:true});
  assert.equal((await request(url,{method:'PATCH',token:adminToken,body})).status,404);
  assert.equal((await request(url,{method:'PATCH',token:userToken,body:JSON.stringify({taskId:'fake',done:true})})).status,404);
  assert.equal((await request(url,{method:'PATCH',token:userToken,body})).status,200);
  const history=await request('/api/planner/plans',{token:userToken});assert.equal(history.data.plans.find(p=>p.id===saved.data.id).plan.tasks[0].done,true);
  assert.match(history.headers.get('cache-control'),/no-store/);
  const reviewed=history.data.plans.find(p=>p.id===saved.data.id);
  assert.equal(reviewed.review.status,'reviewed');
  assert.equal(reviewed.review.programmes[0].cost.amount,null);
  assert.equal(reviewed.review.programmes[0].verification,'needs_review');
  assert.equal((await request('/api/planner/interpret',{method:'POST',body:JSON.stringify({message:'ЕНТ 110'})})).status,401);
  assert.equal((await request('/api/planner/interpret',{method:'POST',token:userToken,body:JSON.stringify({message:'ЕНТ 110'})})).data.status,'fallback');
  assert.equal((await request('/api/planner/sources/check',{method:'POST',body:JSON.stringify({ids:['http://localhost']})})).status,400);
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=(url,options)=>String(url)==='https://iitu.edu.kz/ru/applicants/bachelor/'?Promise.resolve(new Response('<p>Page changed</p>',{headers:{'content-type':'text/html'}})):originalFetch(url,options);
    const checked=await request('/api/planner/sources/check',{method:'POST',body:JSON.stringify({ids:['iitu'],input})});
    assert.equal(checked.status,200);assert.equal(checked.data.sources[0].reviewRequired,true);
    assert.equal((await request('/api/planner/sources/iitu/history')).status,401);
    assert.equal((await request('/api/planner/sources/iitu/history',{token:userToken})).status,403);
    const journal=await request('/api/planner/sources/iitu/history',{token:adminToken});
    assert.equal(journal.status,200);assert.equal(journal.data.observations[0].reviewRequired,true);
    assert.equal(checked.data.plan.matches.find(m=>m.id==='iitu-cs').sourceAlerts.length,1);
    const refreshed=(await request('/api/planner/plans',{token:userToken})).data.plans.find(p=>p.id===saved.data.id);
    assert.ok(refreshed.review.programmes[0].unverifiedCriteria.includes('subjects'));
    assert.equal(refreshed.plan.tasks[0].done,true);
    const next=await request('/api/planner/plans',{method:'POST',token:userToken,body:payload});
    assert.equal(next.status,201);assert.equal(next.data.plan.matches[0].sourceAlerts[0].reviewRequired,true);
    await request('/api/planner/plans/'+next.data.id,{method:'DELETE',token:userToken});
  }finally{globalThis.fetch=originalFetch;}
  assert.equal((await request('/api/planner/plans/'+saved.data.id,{method:'DELETE',token:userToken})).status,200);
});

test('imported programme survives preview, save and reload; catalogue changes do not overwrite its checklist', async () => {
  const { importProgrammes } = require('../programme-store');
  const record = {
    university: { name: 'Visible university', short_name: 'Visible', official_website: 'https://example.edu' },
    programme: { name: 'Imported IT programme', code: '6B06199', group: 'B057', profile_subjects: ['math', 'informatics'], languages: ['en'] },
    admission: { paid_min_ent: 50, grant_application_min_ent: null, historical_passing_score: null, section_minimums: {}, extra_exams: [], academic_year: '2026-2027', deadline: null, documents: [] },
    tuition: { first_year: null, other_years: {}, currency: 'KZT', academic_year: '2026-2027', installment_available: null },
    dormitory: { available: null, price: null, guaranteed: null },
    sources: [{ field: 'programme', url: 'https://example.edu/admission', title: 'Fixture only', checked_at: '2026-09-27', status: 'needs_review', quote_or_evidence: 'Test data, not real admission requirements' }],
    unknown_fields: ['admission.grant_application_min_ent'], conflicts: [], notes: 'Isolated test fixture',
  };
  let programmeId, planId;
  try {
    const imported = importProgrammes(db, [record], { apply: true });
    assert.deepEqual(imported.errors, []);assert.equal(imported.applied, true);
    programmeId = db.prepare("SELECT id FROM admission_programmes_catalogue WHERE code='6B06199'").get().id;
    assert.equal(importProgrammes(db, [record], { apply: true }).applied, true);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM admission_programmes_catalogue WHERE code='6B06199'").get().n, 1);
    const input = { mode: 'programmes', ent: 40, subjects: ['math', 'informatics'], group: 'B057', year: 2027, funding: 'grant', language: 'any' };
    const preview = await request('/api/planner/programme-preview', { method: 'POST', body: JSON.stringify(input) });
    assert.equal(preview.status, 200);
    const match = preview.data.matches.find(item => item.id === programmeId);
    assert.ok(match);assert.equal(match.checks.ent, 'unverified');assert.equal(match.checks.budget, 'not_requested');
    const saved = await request('/api/planner/plans', { method: 'POST', token: userToken, body: JSON.stringify({ input, selectedIds: [programmeId] }) });
    assert.equal(saved.status, 201);planId = saved.data.id;
    const task = saved.data.plan.tasks[0];assert.equal(task.programmeId, programmeId);
    assert.equal((await request(`/api/planner/plans/${planId}/tasks`, { method: 'PATCH', token: userToken, body: JSON.stringify({ taskId: task.id, done: true }) })).status, 200);
    const reopen = async () => (await request('/api/planner/plans', { token: userToken })).data.plans.find(item => item.id === planId);
    const first = await reopen();
    assert.equal(first.plan.tasks[0].done, true);assert.equal(first.review.programmes[0].verification, 'needs_review');
    const snapshot = JSON.stringify(first.plan);
    // Removing a programme from the active catalogue must not erase a saved plan.
    db.prepare('UPDATE admission_programmes_catalogue SET is_active=0 WHERE id=?').run(programmeId);
    const later = await reopen();
    assert.equal(later.review.programmes[0].verification, 'unavailable');
    assert.equal(JSON.stringify(later.plan), snapshot);
    const resave = await request('/api/planner/plans', { method: 'POST', token: userToken, body: JSON.stringify({ input, selectedIds: [programmeId] }) });
    assert.equal(resave.status, 400);
  } finally {
    if (planId) db.prepare('DELETE FROM admission_plans WHERE id=?').run(planId);
    if (programmeId) db.prepare('DELETE FROM admission_programmes_catalogue WHERE id=?').run(programmeId);
  }
});

test('AI university retrieval excludes hidden, pending and duplicate entries before LIMIT', () => {
  const {retrieveRelevantUniversities}=require('../ai-service');
  db.prepare("INSERT INTO universities(id,name,short_name,city_id,data_status,languages,accreditations,price_from,price_to,has_dorm) VALUES (910,'Unknown status','Unknown',1,NULL,'[]','[]',100,200,0)").run();
  db.prepare("INSERT INTO universities(id,name,short_name,city_id,data_status,languages,accreditations,qs_world,price_from,price_to,has_dorm) VALUES (911,'Duplicate university','Duplicate',1,'duplicate_of_1','[]','[]',1,100,200,0)").run();
  try {
    const rows=retrieveRelevantUniversities('Покажи университеты').universities;
    assert.ok(rows.some(row=>row.id===1));
    assert.ok(rows.some(row=>row.id===910)); // Preserve existing NULL policy pending catalogue decisions.
    for(const id of [2,3,911])assert.ok(!rows.some(row=>row.id===id));
  } finally {db.prepare('DELETE FROM universities WHERE id IN (910,911)').run();}
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

test('cookie-authenticated changes require a CSRF token bound to that session', async () => {
  const denied = await fetch(base + '/api/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${userToken}` },
    body: JSON.stringify({ fullName: 'Blocked request' }),
  });
  assert.equal(denied.status, 403);
  assert.equal((await profileUpdate({ fullName: 'CSRF protected' })).status, 200);
});

test('corrupt databases are preserved byte-for-byte on startup failure', () => {
  const corruptPath = path.join(fixture, 'corrupt.db');
  const content = Buffer.from('This is intentionally not a SQLite database');
  fs.writeFileSync(corruptPath, content);
  const result = spawnSync(process.execPath, ['-e', "require('./database').initDatabase()"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: corruptPath }, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.deepEqual(fs.readFileSync(corruptPath), content);
});

test('a fresh database starts with all required tables', () => {
  const result = spawnSync(process.execPath, ['-e', "(async()=>{const d=require('./database');const db=d.initDatabase();db.prepare('SELECT * FROM audit_log').all();db.prepare('SELECT moderation_status FROM reviews').all();const u=db.prepare('PRAGMA table_info(universities)').all().find(c=>c.name==='is_free');const g=db.prepare('PRAGMA table_info(grants)').all().find(c=>c.name==='is_active');if(!u||u.notnull!==1||String(u.dflt_value)!=='0')throw Error('universities.is_free schema mismatch');if(!g||g.notnull!==1||String(g.dflt_value)!=='1')throw Error('grants.is_active schema mismatch');const app=require('./server');const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));for(const url of ['/api/universities','/api/grants']){const response=await fetch('http://127.0.0.1:'+server.address().port+url);if(response.status!==200||!Array.isArray(await response.json()))throw Error(url+' failed on fresh database');}await new Promise(resolve=>server.close(resolve));d.closeDb();})().catch(error=>{console.error(error);process.exitCode=1});"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: path.join(fixture, 'fresh.db') }, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
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
    (year, university_id, specialty_id, ent_score_from, ent_score_to, chance_percent, confidence_level, source_label, source_url)
    VALUES (?, ?, 1, 0, 140, ?, 'high', 'verified: admission report', 'https://example.edu/statistics')`);
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
