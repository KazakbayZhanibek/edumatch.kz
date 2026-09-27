const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { schema, importProgrammes, listProgrammes } = require('../programme-store');
const { buildProgrammePlan } = require('../programme-planner');

function fixture(overrides = {}) {
  return {
    university: { name: 'Тестовый университет', short_name: 'ТУ', city: 'Алматы', official_website: 'https://example.edu.kz' },
    programme: { name: 'Телекоммуникации', code: '6B06201', group: 'B059', profile_subjects: ['Математика', 'Физика'], languages: ['ru', 'kk'] },
    admission: { paid_min_ent: 50, grant_application_min_ent: 65, historical_passing_score: null, section_minimums: {}, extra_exams: [], academic_year: '2026-2027', deadline: '2027-08-25', documents: ['Удостоверение личности'] },
    tuition: { first_year: 1200000, other_years: {}, currency: 'KZT', academic_year: '2026-2027', installment_available: true },
    dormitory: { available: true, price: null, price_period: null, guaranteed: false },
    sources: [{ field: 'admission', url: 'https://example.edu.kz/admission', title: 'Приём', checked_at: '2026-09-20', status: 'verified', quote_or_evidence: 'Минимальный балл — 50' }],
    unknown_fields: ['dormitory.price'], conflicts: [], notes: '', ...overrides,
  };
}

function database() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE cities(id INTEGER PRIMARY KEY,name TEXT); CREATE TABLE universities(id INTEGER PRIMARY KEY,name TEXT,short_name TEXT,website TEXT,city_id INTEGER);');
  db.prepare('INSERT INTO cities VALUES (1,?)').run('Алматы');
  db.prepare('INSERT INTO universities VALUES (1,?,?,?,1)').run('Тестовый университет', 'ТУ', 'https://example.edu.kz');
  db.exec(schema);
  return db;
}

test('programme import validates without writing catalogue rows by default', () => {
  const db = database();
  const result = importProgrammes(db, [fixture()], { sourceFile: 'B059.json' });
  assert.equal(result.valid, 1); assert.equal(result.applied, false);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM admission_programmes_catalogue').get().count, 0);
  assert.equal(db.prepare('SELECT applied FROM programme_import_batches').get().applied, 0);
  db.close();
});

test('verified programme import is atomic and idempotent', () => {
  const db = database(), record = fixture();
  assert.equal(importProgrammes(db, [record], { apply: true }).applied, true);
  record.tuition.first_year = 1300000;
  assert.equal(importProgrammes(db, [record], { apply: true }).applied, true);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM admission_programmes_catalogue').get().count, 1);
  assert.equal(db.prepare('SELECT first_year FROM programme_tuition').get().first_year, 1300000);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM programme_sources').get().count, 1);
  const catalogue = listProgrammes(db, 'B059');
  assert.equal(catalogue.length, 1); assert.equal(catalogue[0].minimumEnt, 50);
  assert.deepEqual(catalogue[0].subjects, ['math', 'physics']);
  const plan = buildProgrammePlan({ ent: 80, subjects: ['math', 'physics'], budget: 1500000, group: 'B059', year: 2026, funding: 'paid', language: 'any', city: 'any', needDorm: false }, new Date('2026-09-21T00:00:00Z'), {}, catalogue);
  assert.equal(plan.status, 'ready'); assert.equal(plan.matches.length, 1);
  assert.equal(plan.matches[0].checks.ent, 'within'); assert.equal(plan.matches[0].checks.subjects, 'within');
  db.close();
});

test('bad dates, unsafe sources and unknown universities block the whole batch', () => {
  const db = database();
  const bad = fixture({ university: { name: 'Неизвестный вуз', short_name: 'НВ', official_website: 'https://unknown.example' } });
  bad.admission.deadline = '2027-02-30'; bad.sources[0].url = 'http://example.edu.kz';
  const result = importProgrammes(db, [fixture(), bad], { apply: true });
  assert.ok(result.errors.length >= 1); assert.equal(result.applied, false);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM admission_programmes_catalogue').get().count, 0);
  db.close();
});
