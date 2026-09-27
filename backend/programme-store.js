const ALLOWED_STATUSES = new Set(['verified', 'needs_review', 'source_unavailable', 'not_published', 'conflicting']);
const SUBJECT_ALIASES = new Map(Object.entries({
  math: 'math', 'математика': 'math',
  informatics: 'informatics', 'информатика': 'informatics',
  physics: 'physics', 'физика': 'physics',
  chemistry: 'chemistry', 'химия': 'chemistry',
  biology: 'biology', 'биология': 'biology',
  geography: 'geography', 'география': 'geography',
  history: 'history', 'всемирная история': 'history',
  law: 'law', 'основы права': 'law',
  foreign_language: 'foreign_language', 'иностранный язык': 'foreign_language',
}));

const schema = `
CREATE TABLE IF NOT EXISTS admission_programmes_catalogue (
  id TEXT PRIMARY KEY,
  university_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  group_code TEXT NOT NULL,
  profile_subjects TEXT NOT NULL,
  languages TEXT NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL DEFAULT 'needs_review',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE,
  UNIQUE(university_id, code, group_code)
);
CREATE INDEX IF NOT EXISTS idx_programmes_catalogue_group ON admission_programmes_catalogue(group_code, is_active);
CREATE INDEX IF NOT EXISTS idx_programmes_catalogue_university ON admission_programmes_catalogue(university_id);

CREATE TABLE IF NOT EXISTS programme_admission_details (
  programme_id TEXT PRIMARY KEY,
  paid_min_ent INTEGER,
  grant_application_min_ent INTEGER,
  historical_passing_score INTEGER,
  section_minimums TEXT NOT NULL DEFAULT '{}',
  extra_exams TEXT NOT NULL DEFAULT '[]',
  academic_year TEXT,
  deadline TEXT,
  documents TEXT NOT NULL DEFAULT '[]',
  dormitory TEXT NOT NULL DEFAULT '{}',
  conflicts TEXT NOT NULL DEFAULT '[]',
  unknown_fields TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY(programme_id) REFERENCES admission_programmes_catalogue(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS programme_tuition (
  programme_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  first_year INTEGER,
  other_years TEXT NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'KZT',
  installment_available INTEGER,
  PRIMARY KEY(programme_id, academic_year),
  FOREIGN KEY(programme_id) REFERENCES admission_programmes_catalogue(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS programme_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  programme_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  checked_at TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  evidence TEXT,
  FOREIGN KEY(programme_id) REFERENCES admission_programmes_catalogue(id) ON DELETE CASCADE,
  UNIQUE(programme_id, field_name, url, checked_at)
);
CREATE INDEX IF NOT EXISTS idx_programme_sources_programme ON programme_sources(programme_id);

CREATE TABLE IF NOT EXISTS programme_import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

function clean(value, max = 500) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
function safeUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } }
function websiteHost(value) { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function normalizeUniversityName(value) { return clean(value, 200).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim(); }
function universityAcronym(value) {
  const words = clean(value, 300).match(/[A-Za-zА-Яа-яЁё]+/g) || [];
  const acronym = words.map(word => word[0]).join('').toLowerCase();
  return acronym.length >= 3 ? acronym : '';
}
function findUniversity(db, university = {}) {
  const expectedHost = websiteHost(safeUrl(university.official_website));
  const names = [university.name, university.short_name].map(normalizeUniversityName).filter(Boolean);
  const acronyms = [university.name, university.short_name].map(universityAcronym).filter(Boolean);
  return db.prepare('SELECT id,name,short_name,website FROM universities').all().find(row => {
    if (expectedHost && websiteHost(row.website) === expectedHost) return true;
    const rowNames = [row.name, row.short_name].map(normalizeUniversityName).filter(Boolean);
    if (names.some(name => rowNames.some(rowName => rowName === name || rowName.startsWith(`${name} `) || name.startsWith(`${rowName} `)))) return true;
    const rowShort = normalizeUniversityName(row.short_name).replace(/\s/g, '');
    return rowShort.length >= 3 && acronyms.includes(rowShort);
  }) || null;
}
function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false; const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function integerOrNull(value, min = 0, max = 140) { if (value === null || value === undefined || value === '') return null; return Number.isInteger(value) && value >= min && value <= max ? value : NaN; }
function normalizeSubject(value) { return SUBJECT_ALIASES.get(clean(value, 80).toLowerCase()) || null; }
function stableId(record, universityId) { return `${universityId}-${clean(record.programme?.group, 20).toLowerCase()}-${clean(record.programme?.code || record.programme?.name, 100).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '')}`; }

function validateProgrammeRecord(record, db, index) {
  const errors = [], university = record?.university || {}, programme = record?.programme || {}, admission = record?.admission || {}, tuition = record?.tuition || {};
  const website = safeUrl(university.official_website);
  const universityRow = findUniversity(db, { ...university, official_website: website });
  if (!universityRow) errors.push('university is not present in the catalogue');
  if (!clean(programme.name)) errors.push('programme.name is required');
  if (!/^B\d{3}$/.test(clean(programme.group, 10))) errors.push('programme.group must look like B059');
  if (!Array.isArray(programme.profile_subjects) || programme.profile_subjects.length !== 2 || new Set(programme.profile_subjects.map(value => clean(value).toLowerCase())).size !== 2) errors.push('exactly two different profile_subjects are required');
  else if (programme.profile_subjects.some(value => !normalizeSubject(value))) errors.push('profile_subjects contain an unsupported subject name');
  if (admission.academic_year && !/^20\d{2}-20\d{2}$/.test(admission.academic_year)) errors.push('admission.academic_year must be YYYY-YYYY');
  if (admission.deadline && !validDate(admission.deadline)) errors.push('admission.deadline must be a real YYYY-MM-DD date');
  for (const [field, value] of [['paid_min_ent', admission.paid_min_ent], ['grant_application_min_ent', admission.grant_application_min_ent], ['historical_passing_score', admission.historical_passing_score]]) if (Number.isNaN(integerOrNull(value))) errors.push(`${field} must be 0-140 or null`);
  if (tuition.first_year !== null && tuition.first_year !== undefined && (!Number.isInteger(tuition.first_year) || tuition.first_year < 0)) errors.push('tuition.first_year must be a non-negative integer or null');
  if (tuition.academic_year && !/^20\d{2}-20\d{2}$/.test(tuition.academic_year)) errors.push('tuition.academic_year must be YYYY-YYYY');
  if (!Array.isArray(record.sources) || !record.sources.length) errors.push('at least one official source is required');
  for (const [sourceIndex, source] of (record.sources || []).entries()) {
    if (!safeUrl(source.url)) errors.push(`sources[${sourceIndex}].url must be HTTPS`);
    if (!validDate(source.checked_at)) errors.push(`sources[${sourceIndex}].checked_at must be a real date`);
    if (!ALLOWED_STATUSES.has(source.status)) errors.push(`sources[${sourceIndex}].status is invalid`);
  }
  return { index, errors, universityId: universityRow?.id, record, id: universityRow ? stableId(record, universityRow.id) : null };
}

function importProgrammes(db, records, { sourceFile = 'programmes.json', apply = false } = {}) {
  db.exec(schema);
  if (!Array.isArray(records) || !records.length) throw new Error('Input must be a non-empty JSON array');
  const checked = records.map((record, index) => validateProgrammeRecord(record, db, index));
  const errors = checked.filter(item => item.errors.length).map(item => ({ index: item.index, errors: item.errors }));
  const duplicateIds = checked.map(item => item.id).filter(Boolean).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length) errors.push({ index: null, errors: [`duplicate programme ids: ${[...new Set(duplicateIds)].join(', ')}`] });
  const summary = { sourceFile, records: records.length, valid: checked.length - errors.filter(item => item.index !== null).length, errors, applied: false };
  if (errors.length || !apply) {
    db.prepare('INSERT INTO programme_import_batches(source_file,record_count,applied,summary) VALUES (?,?,0,?)').run(sourceFile, records.length, JSON.stringify(summary));
    return summary;
  }
  const upsertProgramme = db.prepare(`INSERT INTO admission_programmes_catalogue(id,university_id,name,code,group_code,profile_subjects,languages,verification_status,notes,is_active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET university_id=excluded.university_id,name=excluded.name,code=excluded.code,group_code=excluded.group_code,profile_subjects=excluded.profile_subjects,languages=excluded.languages,verification_status=excluded.verification_status,notes=excluded.notes,is_active=1,updated_at=CURRENT_TIMESTAMP`);
  const upsertAdmission = db.prepare(`INSERT INTO programme_admission_details(programme_id,paid_min_ent,grant_application_min_ent,historical_passing_score,section_minimums,extra_exams,academic_year,deadline,documents,dormitory,conflicts,unknown_fields)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(programme_id) DO UPDATE SET paid_min_ent=excluded.paid_min_ent,grant_application_min_ent=excluded.grant_application_min_ent,historical_passing_score=excluded.historical_passing_score,section_minimums=excluded.section_minimums,extra_exams=excluded.extra_exams,academic_year=excluded.academic_year,deadline=excluded.deadline,documents=excluded.documents,dormitory=excluded.dormitory,conflicts=excluded.conflicts,unknown_fields=excluded.unknown_fields`);
  const upsertTuition = db.prepare(`INSERT INTO programme_tuition(programme_id,academic_year,first_year,other_years,currency,installment_available) VALUES (?,?,?,?,?,?) ON CONFLICT(programme_id,academic_year) DO UPDATE SET first_year=excluded.first_year,other_years=excluded.other_years,currency=excluded.currency,installment_available=excluded.installment_available`);
  const insertSource = db.prepare('INSERT OR REPLACE INTO programme_sources(programme_id,field_name,url,title,checked_at,verification_status,evidence) VALUES (?,?,?,?,?,?,?)');
  db.transaction(() => {
    for (const item of checked) {
      const { record, id, universityId } = item, p = record.programme, a = record.admission || {}, t = record.tuition || {};
      const hasConflicts = Array.isArray(record.conflicts) && record.conflicts.length > 0;
      const overall = hasConflicts || record.sources.some(source => source.status === 'conflicting')
        ? 'conflicting'
        : record.sources.every(source => source.status === 'verified') ? 'verified' : 'needs_review';
      upsertProgramme.run(id, universityId, clean(p.name), clean(p.code, 50) || null, clean(p.group, 10), JSON.stringify(p.profile_subjects.map(normalizeSubject)), JSON.stringify((p.languages || []).map(clean)), overall, clean(record.notes, 2000));
      upsertAdmission.run(id, integerOrNull(a.paid_min_ent), integerOrNull(a.grant_application_min_ent), integerOrNull(a.historical_passing_score), JSON.stringify(a.section_minimums || {}), JSON.stringify(a.extra_exams || []), clean(a.academic_year, 20) || null, a.deadline || null, JSON.stringify(a.documents || []), JSON.stringify(record.dormitory || {}), JSON.stringify(record.conflicts || []), JSON.stringify(record.unknown_fields || []));
      if (t.academic_year) upsertTuition.run(id, t.academic_year, t.first_year ?? null, JSON.stringify(t.other_years || {}), clean(t.currency || 'KZT', 10), t.installment_available == null ? null : t.installment_available ? 1 : 0);
      db.prepare('DELETE FROM programme_sources WHERE programme_id=?').run(id);
      for (const source of record.sources) insertSource.run(id, clean(source.field, 100), safeUrl(source.url), clean(source.title), source.checked_at, source.status, clean(source.quote_or_evidence, 1000));
    }
  })();
  summary.applied = true;
  db.prepare('INSERT INTO programme_import_batches(source_file,record_count,applied,summary) VALUES (?,?,1,?)').run(sourceFile, records.length, JSON.stringify(summary));
  return summary;
}

function listProgrammes(db, groupCode) {
  db.exec(schema);
  const rows = db.prepare(`SELECT p.*, a.*, u.short_name AS university_name, c.name AS city_name,
    t.academic_year AS tuition_academic_year, t.first_year, t.other_years, t.currency, t.installment_available
    FROM admission_programmes_catalogue p
    JOIN universities u ON u.id=p.university_id
    LEFT JOIN cities c ON c.id=u.city_id
    JOIN programme_admission_details a ON a.programme_id=p.id
    LEFT JOIN programme_tuition t ON t.programme_id=p.id
    WHERE p.is_active=1 AND p.group_code=?
    ORDER BY p.id, t.academic_year DESC`).all(groupCode);
  const byId = new Map();
  const sourceQuery = db.prepare('SELECT field_name,url,title,checked_at,verification_status,evidence FROM programme_sources WHERE programme_id=? ORDER BY checked_at DESC,id');
  for (const row of rows) {
    if (byId.has(row.id)) continue;
    const sources = sourceQuery.all(row.id).map(source => ({ url: source.url, title: source.title || source.field_name, reviewedAt: source.checked_at, status: source.verification_status, evidence: source.evidence }));
    const dormitory = JSON.parse(row.dormitory || '{}');
    const extraExams = JSON.parse(row.extra_exams || '[]');
    const conflicts = JSON.parse(row.conflicts || '[]');
    byId.set(row.id, {
      id: row.id, code: row.code, name: row.name, group: row.group_code, university: row.university_name,
      city: row.city_name, subjects: JSON.parse(row.profile_subjects || '[]'), language: JSON.parse(row.languages || '[]'),
      tuition: row.first_year, tuitionYear: row.tuition_academic_year ? Number(row.tuition_academic_year.slice(0, 4)) : null,
      tuitionBreakdown: JSON.parse(row.other_years || '{}'), tuitionNote: row.first_year == null ? 'Стоимость не опубликована.' : '',
      minimumEnt: row.paid_min_ent, grantMinEnt: row.grant_application_min_ent,
      historicalPassingScore: row.historical_passing_score, requirementsYear: row.academic_year ? Number(row.academic_year.slice(0, 4)) : null,
      entSectionsNote: Object.keys(JSON.parse(row.section_minimums || '{}')).length ? '' : 'Минимумы по разделам ЕНТ не опубликованы.',
      extraExam: extraExams.length ? 'required_or_conditional' : null, extraExamDetails: extraExams,
      deadline: row.deadline, documents: JSON.parse(row.documents || '[]'), dorm: dormitory.available === true,
      dormDetails: dormitory, conflict: row.verification_status === 'conflicting',
      conflictNote: conflicts.map(conflict => {
        if (typeof conflict === 'string') return conflict;
        const values = Array.isArray(conflict?.values) ? conflict.values.map(item => item?.value ?? item).join(' / ') : '';
        return [conflict?.field, values, conflict?.note].filter(Boolean).join(': ');
      }).join('; '), verificationStatus: row.verification_status,
      reviewedAt: sources.map(source => source.reviewedAt).sort().at(-1) || null, sources,
    });
  }
  return [...byId.values()];
}

module.exports = { schema, importProgrammes, listProgrammes, validateProgrammeRecord, safeUrl, validDate, findUniversity };
