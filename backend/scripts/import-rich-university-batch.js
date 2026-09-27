const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(process.argv[2]);
if (!inputPath || !fs.existsSync(inputPath)) throw new Error('Usage: node scripts/import-rich-university-batch.js <batch.json>');
const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const records = Array.isArray(payload) ? payload : payload.universities;
if (!Array.isArray(records)) throw new Error('Batch must be an array or contain universities');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const findUniversity = db.prepare('SELECT * FROM universities WHERE id = ?');
const findCity = db.prepare('SELECT id FROM cities WHERE lower(name) = lower(?)');
const findSpecialty = db.prepare('SELECT id, name, category FROM specialties WHERE lower(name) = lower(?) OR lower(category) = lower(?) LIMIT 1');
const updateUniversity = db.prepare(`
  UPDATE universities SET name = ?, short_name = ?, city_id = ?, website = ?, description = ?,
    founded = ?, students_count = ?, languages = ?, accreditations = ?, has_dorm = ?, dorm_price = ?,
    avg_salary = ?, lat = ?, lng = ?, data_status = ?, admission_phone = ?, admission_email = ?,
    admission_whatsapp = ?, address = ?, last_updated_at = CURRENT_TIMESTAMP, source_record_id = ?
  WHERE id = ?
`);
const insertGrant = db.prepare(`
  INSERT INTO grants (name, type, amount, description, requirements, deadline, link, university_id, academic_year)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findGrant = db.prepare('SELECT id FROM grants WHERE university_id = ? AND name = ? AND academic_year = ? LIMIT 1');
const linkGrant = db.prepare('INSERT OR IGNORE INTO grant_specialties (grant_id, specialty_id) VALUES (?, ?)');
const upsertRequirement = db.prepare(`
  INSERT INTO admission_requirements (university_id, specialty_id, min_ent, avg_ent, grant_min_ent, academic_year)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(university_id, specialty_id) DO UPDATE SET
    min_ent = excluded.min_ent, avg_ent = excluded.avg_ent,
    grant_min_ent = excluded.grant_min_ent, academic_year = excluded.academic_year
`);

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const valueOr = (value, fallback) => value === null || value === undefined || value === '' ? fallback : value;
const year = payload.academic_year || '2026-2027';
const categoryAliases = {
  it: 'Информационные технологии',
  'инженерия и инженерное дело': 'Инженерия',
  'право и безопасность': 'Гуманитарные науки'
};
function findProgramSpecialty(program) {
  const category = categoryAliases[String(program.category || '').toLowerCase()] || program.category;
  return findSpecialty.get(program.name, category);
}
let updated = 0;
let grants = 0;
let requirements = 0;
const errors = [];

const run = db.transaction(() => {
  for (const record of records) {
    const id = Number(record.pending_id || String(record.external_id || '').replace(/^kz-/, '').replace(/^pending-/, ''));
    const current = findUniversity.get(id);
    if (!current) {
      errors.push(`${record.external_id || id}: university not found`);
      continue;
    }
    const city = findCity.get(clean(record.city)) || { id: current.city_id };
    const tuition = record.tuition || {};
    const dorm = record.dormitory || {};
    const contacts = record.contacts || {};
    const coords = record.coordinates || {};
    const ratings = record.ratings || {};
    const languages = Array.isArray(record.languages) && record.languages.length ? record.languages : JSON.parse(current.languages || '[]');
    const accreditations = Array.isArray(record.accreditations) && record.accreditations.length ? record.accreditations : JSON.parse(current.accreditations || '[]');
    const status = record.data_quality?.status === 'verified' ? 'active' : 'pending';
    const website = clean(record.official_website) || current.website || '';
    const phone = clean(contacts.admission_phone) || current.admission_phone || '';
    const email = clean(contacts.admission_email) || current.admission_email || '';
    const whatsapp = clean(contacts.whatsapp) || current.admission_whatsapp || '';
    const address = clean(record.address) || current.address || '';
    const priceFrom = Number(tuition.price_from_per_year);
    const priceTo = Number(tuition.price_to_per_year);
    const lat = coords.lat === null || coords.lat === undefined || coords.lat === '' ? null : Number(coords.lat);
    const lng = coords.lng === null || coords.lng === undefined || coords.lng === '' ? null : Number(coords.lng);

    updateUniversity.run(
      clean(record.name) || current.name,
      clean(record.short_name) || current.short_name,
      city.id,
      website,
      clean(record.description) || current.description,
      valueOr(record.founded, current.founded),
      valueOr(record.students_count, current.students_count),
      JSON.stringify(languages),
      JSON.stringify(accreditations),
      dorm.available === true ? 1 : dorm.available === false && current.has_dorm ? current.has_dorm : current.has_dorm,
      Number.isFinite(Number(dorm.price_per_year)) ? Number(dorm.price_per_year) : current.dorm_price,
      current.avg_salary,
      Number.isFinite(lat) ? lat : null,
      Number.isFinite(lng) ? lng : null,
      status,
      phone,
      email,
      whatsapp,
      address,
      Number(record.source_record_id) || current.source_record_id,
      id
    );
    if (Number.isFinite(priceFrom) && priceFrom > 0) {
      db.prepare('UPDATE universities SET price_from = ?, price_to = ? WHERE id = ?').run(priceFrom, Number.isFinite(priceTo) && priceTo >= priceFrom ? priceTo : priceFrom, id);
    }
    updated++;

    for (const grant of (record.grants || [])) {
      const grantName = clean(grant.name);
      if (!grantName) continue;
      let grantId = findGrant.get(id, grantName, year)?.id;
      if (!grantId) {
        const result = insertGrant.run(grantName, grant.type || 'university', clean(grant.amount) || 'Уточняется', `Грант университета ${clean(record.short_name || record.name)}.`, JSON.stringify(grant.requirements || []), grant.deadline || '', grant.application_url || grant.source_url || '', id, year);
        grantId = result.lastInsertRowid;
        grants++;
      }
      for (const programCode of (grant.eligible_programs || [])) {
        const program = (record.programs || []).find(item => item.code === programCode);
        const specialty = program && findProgramSpecialty(program);
        if (specialty) linkGrant.run(grantId, specialty.id);
      }
    }

    for (const program of (record.programs || [])) {
      const admission = program.admission || {};
      const specialty = findProgramSpecialty(program);
      if (!specialty || admission.ent_minimum === null || admission.ent_minimum === undefined) continue;
      upsertRequirement.run(id, specialty.id, Number(admission.ent_minimum), Number(admission.ent_minimum), admission.grant_passing_score_last_year || null, year);
      requirements++;
    }
  }
});

try {
  run();
  console.log(`Updated universities: ${updated}`);
  console.log(`Added grants: ${grants}`);
  console.log(`Updated admission requirements: ${requirements}`);
  if (errors.length) {
    console.error('Skipped records:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
  }
} finally {
  db.close();
}
