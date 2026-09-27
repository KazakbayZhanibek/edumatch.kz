const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { importFunding } = require('../funding-store');

function setup() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE universities(id INTEGER PRIMARY KEY,name TEXT,short_name TEXT,website TEXT);
    INSERT INTO universities VALUES(1,'Astana IT University (AITU)','AITU','https://astanait.edu.kz');
    CREATE TABLE grants(id INTEGER PRIMARY KEY,name TEXT,type TEXT,amount TEXT,description TEXT,requirements TEXT,deadline TEXT,link TEXT,source_url TEXT,source_title TEXT,verification_status TEXT,verified_at TEXT,university_id INTEGER,academic_year TEXT,is_active INTEGER,provider_name TEXT,provider_type TEXT,coverage_type TEXT,coverage_amount TEXT,application_url TEXT,application_method TEXT,documents TEXT,eligibility_categories TEXT,study_levels TEXT,programme_codes TEXT,subject_requirements TEXT,last_checked_by TEXT,review_notes TEXT);`);
  return db;
}

function record() {
  return { name: 'Тестовый грант', type: 'government', provider: 'Организатор', universities: ['Astana IT University'], programme_groups: ['B059'], programme_codes: ['6B06202'], coverage: { type: 'tuition_only', amount: null, description: 'Обучение' }, requirements: ['ЕНТ'], eligibility_categories: ['общий конкурс'], documents: [], application_method: 'Онлайн', deadline: null, academic_year: '2026-2027', source_url: 'https://example.edu/grant', checked_at: '2026-09-20', verification_status: 'needs_review', notes: 'Уточнить срок' };
}

test('funding import is dry-run by default and idempotent when applied', () => {
  const db = setup();
  assert.equal(importFunding(db, [record()]).applied, false);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM grants').get().count, 0);
  const first = importFunding(db, [record()], { apply: true });
  const second = importFunding(db, [record()], { apply: true });
  assert.deepEqual([first.inserted, first.updated], [1, 0]);
  assert.deepEqual([second.inserted, second.updated], [0, 1]);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM grants').get().count, 1);
  db.close();
});

test('structured re-import preserves manual verification', () => {
  const db = setup();
  importFunding(db, [record()], { apply: true });
  db.prepare("UPDATE grants SET verification_status='verified',verified_at='2026-09-21'").run();
  importFunding(db, [record()], { apply: true });
  const row = db.prepare('SELECT verification_status,verified_at FROM grants').get();
  assert.deepEqual(row, { verification_status: 'verified', verified_at: '2026-09-21' });
  db.close();
});

test('unknown university blocks the whole funding batch', () => {
  const db = setup();
  const invalid = record();
  invalid.universities = ['Несуществующий вуз'];
  const result = importFunding(db, [invalid], { apply: true });
  assert.equal(result.applied, false);
  assert.match(result.errors[0].errors.join(' '), /not present/);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM grants').get().count, 0);
  db.close();
});

test('one nationwide grant keeps links to multiple universities', () => {
  const db = setup();
  db.prepare("INSERT INTO universities VALUES(2,'Международный университет информационных технологий','IITU','https://iitu.edu.kz')").run();
  const nationwide = record();
  nationwide.universities = ['Astana IT University', 'Международный университет информационных технологий'];
  importFunding(db, [nationwide], { apply: true });
  const grant = db.prepare('SELECT university_id FROM grants').get();
  const links = db.prepare('SELECT university_id FROM grant_universities ORDER BY university_id').all();
  assert.equal(grant.university_id, null);
  assert.deepEqual(links, [{ university_id: 1 }, { university_id: 2 }]);
  db.close();
});
