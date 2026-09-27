const crypto = require('crypto');
const { safeUrl, validDate, findUniversity } = require('./programme-store');

const ALLOWED_TYPES = new Set(['government', 'university', 'corporate', 'regional', 'foundation', 'international', 'discount', 'installment']);
const ALLOWED_STATUSES = new Set(['verified', 'needs_review', 'source_unavailable', 'not_published', 'conflicting']);
const ALLOWED_COVERAGE = new Set(['full', 'partial', 'tuition_only', 'tuition_dorm', 'stipend_only', 'unknown']);

const schema = `
CREATE TABLE IF NOT EXISTS funding_import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS funding_import_records (
  record_key TEXT PRIMARY KEY,
  grant_id INTEGER NOT NULL UNIQUE,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS grant_universities (
  grant_id INTEGER NOT NULL,
  university_id INTEGER NOT NULL,
  PRIMARY KEY(grant_id, university_id),
  FOREIGN KEY(grant_id) REFERENCES grants(id) ON DELETE CASCADE,
  FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE
);`;

function clean(value, max = 2000) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
function array(value) { return Array.isArray(value) ? value : []; }
function recordKey(record) {
  const universities = array(record.universities).map(value => clean(value, 500).toLowerCase()).sort().join(',');
  const identity = [record.name, record.provider, record.academic_year, universities].map(value => clean(value, 500).toLowerCase()).join('|');
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function validateFundingRecord(record, db, index) {
  const errors = [];
  if (!clean(record?.name)) errors.push('name is required');
  if (!ALLOWED_TYPES.has(record?.type)) errors.push('type is invalid');
  if (!clean(record?.provider)) errors.push('provider is required');
  if (!Array.isArray(record?.universities) || !record.universities.length) errors.push('at least one university is required');
  const universityRows = array(record?.universities).map(name => findUniversity(db, { name, short_name: name }));
  array(record?.universities).forEach((name, itemIndex) => {
    if (!universityRows[itemIndex]) errors.push(`universities[${itemIndex}] is not present in the catalogue: ${clean(name, 200)}`);
  });
  if (!Array.isArray(record?.programme_groups) || !record.programme_groups.every(code => /^B\d{3}$/.test(clean(code, 10)))) errors.push('programme_groups must contain Bxxx codes');
  if (!ALLOWED_COVERAGE.has(record?.coverage?.type || 'unknown')) errors.push('coverage.type is invalid');
  if (!Array.isArray(record?.requirements)) errors.push('requirements must be an array');
  if (!Array.isArray(record?.documents)) errors.push('documents must be an array');
  if (record?.deadline && !validDate(record.deadline)) errors.push('deadline must be a real YYYY-MM-DD date or null');
  if (!/^20\d{2}-20\d{2}$/.test(record?.academic_year || '')) errors.push('academic_year must be YYYY-YYYY');
  if (!safeUrl(record?.source_url)) errors.push('source_url must be HTTPS');
  if (!validDate(record?.checked_at)) errors.push('checked_at must be a real YYYY-MM-DD date');
  if (!ALLOWED_STATUSES.has(record?.verification_status)) errors.push('verification_status is invalid');
  return { index, errors, record, universityIds: universityRows.filter(Boolean).map(row => row.id), key: recordKey(record) };
}

function importFunding(db, records, { sourceFile = 'funding.json', apply = false } = {}) {
  db.exec(schema);
  if (!Array.isArray(records) || !records.length) throw new Error('Input must be a non-empty JSON array');
  const checked = records.map((record, index) => validateFundingRecord(record, db, index));
  const errors = checked.filter(item => item.errors.length).map(item => ({ index: item.index, errors: item.errors }));
  const keys = checked.map(item => item.key);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) errors.push({ index: null, errors: ['duplicate funding records in input'] });
  const summary = { sourceFile, records: records.length, valid: checked.length - errors.filter(item => item.index !== null).length, errors, applied: false, inserted: 0, updated: 0 };
  if (errors.length || !apply) {
    db.prepare('INSERT INTO funding_import_batches(source_file,record_count,applied,summary) VALUES (?,?,0,?)').run(sourceFile, records.length, JSON.stringify(summary));
    return summary;
  }

  const findImported = db.prepare('SELECT fir.grant_id,g.verification_status,g.verified_at FROM funding_import_records fir JOIN grants g ON g.id=fir.grant_id WHERE fir.record_key=?');
  const findExisting = db.prepare(`SELECT g.id,g.verification_status,g.verified_at,g.university_id,
    GROUP_CONCAT(gu.university_id) related_ids FROM grants g
    LEFT JOIN grant_universities gu ON gu.grant_id=g.id
    WHERE lower(g.name)=lower(?) AND lower(COALESCE(g.provider_name,''))=lower(?) AND g.academic_year=?
    GROUP BY g.id ORDER BY g.id`);
  const insertGrant = db.prepare(`INSERT INTO grants(id,name,type,amount,description,requirements,deadline,link,source_url,source_title,verification_status,verified_at,university_id,academic_year,is_active,provider_name,provider_type,coverage_type,coverage_amount,application_url,application_method,documents,eligibility_categories,study_levels,programme_codes,subject_requirements,last_checked_by,review_notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const updateGrant = db.prepare(`UPDATE grants SET name=?,type=?,amount=?,description=?,requirements=?,deadline=?,link=?,source_url=?,source_title=?,verification_status=?,verified_at=?,university_id=?,academic_year=?,is_active=1,provider_name=?,provider_type=?,coverage_type=?,coverage_amount=?,application_url=?,application_method=?,documents=?,eligibility_categories=?,study_levels=?,programme_codes=?,subject_requirements=?,last_checked_by=?,review_notes=? WHERE id=?`);
  const upsertMap = db.prepare('INSERT INTO funding_import_records(record_key,grant_id,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(record_key) DO UPDATE SET grant_id=excluded.grant_id,updated_at=CURRENT_TIMESTAMP');
  const removeLegacyMap = db.prepare('DELETE FROM funding_import_records WHERE grant_id=? AND record_key<>?');
  const insertUniversity = db.prepare('INSERT OR IGNORE INTO grant_universities(grant_id,university_id) VALUES (?,?)');
  const existingUniversityIds = db.prepare(`SELECT university_id FROM grant_universities WHERE grant_id=?
    UNION SELECT university_id FROM grants WHERE id=? AND university_id IS NOT NULL`);
  let nextId = db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM grants').get().id;

  db.transaction(() => {
    for (const item of checked) {
      const record = item.record;
      const imported = findImported.get(item.key);
      const existing = findExisting.all(record.name, record.provider, record.academic_year).find(candidate => {
        const linked = [candidate.university_id, ...String(candidate.related_ids || '').split(',').map(Number)].filter(Boolean);
        return item.universityIds.some(universityId => linked.includes(universityId));
      });
      const prior = imported || existing;
      const id = prior?.grant_id || prior?.id || nextId++;
      const universityIds = [...new Set([
        ...(prior ? existingUniversityIds.all(id, id).map(row => row.university_id) : []),
        ...item.universityIds,
      ])];
      const primaryUniversityId = universityIds.length === 1 ? universityIds[0] : null;
      const coverage = record.coverage || {};
      const programmes = [...new Set([...array(record.programme_groups), ...array(record.programme_codes)])];
      const applicationUrl = (clean(record.application_method).match(/https:\/\/[^\s)]+/) || [])[0] || null;
      const preserveManualVerification = prior?.verification_status === 'verified' && record.verification_status !== 'verified';
      const verificationStatus = preserveManualVerification ? prior.verification_status : record.verification_status;
      const verifiedAt = preserveManualVerification ? prior.verified_at : record.verification_status === 'verified' ? record.checked_at : null;
      const values = [clean(record.name, 500), record.type, clean(coverage.description || coverage.amount || 'Не указано'), clean(record.notes), JSON.stringify(record.requirements), record.deadline || null, safeUrl(record.source_url), safeUrl(record.source_url), clean(record.provider, 500), verificationStatus, verifiedAt, primaryUniversityId, record.academic_year, clean(record.provider, 500), record.type, coverage.type || 'unknown', clean(coverage.amount) || null, safeUrl(applicationUrl), clean(record.application_method), JSON.stringify(record.documents), JSON.stringify(record.eligibility_categories || []), JSON.stringify(['bachelor']), JSON.stringify(programmes), JSON.stringify([]), 'structured-import', clean(record.notes)];
      if (prior) { updateGrant.run(...values, id); summary.updated++; }
      else { insertGrant.run(id, ...values); summary.inserted++; }
      removeLegacyMap.run(id, item.key);
      upsertMap.run(item.key, id);
      universityIds.forEach(universityId => insertUniversity.run(id, universityId));
    }
  })();
  summary.applied = true;
  db.prepare('INSERT INTO funding_import_batches(source_file,record_count,applied,summary) VALUES (?,?,1,?)').run(sourceFile, records.length, JSON.stringify(summary));
  return summary;
}

module.exports = { schema, importFunding, validateFundingRecord, recordKey };
