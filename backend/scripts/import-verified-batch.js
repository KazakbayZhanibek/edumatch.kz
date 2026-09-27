const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(process.argv[2]);
if (!inputPath || !fs.existsSync(inputPath)) {
  throw new Error('Usage: node scripts/import-verified-batch.js <batch.json>');
}

const records = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('Batch must be a JSON array');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const find = db.prepare("SELECT id, data_status FROM universities WHERE id = ? AND data_status = 'pending'");
const update = db.prepare(`
  UPDATE universities SET
    name = ?, short_name = ?, website = ?, description = ?, founded = ?,
    students_count = ?, languages = ?,
    admission_phone = COALESCE(NULLIF(?, ''), admission_phone),
    address = COALESCE(NULLIF(?, ''), address),
    last_updated_at = CURRENT_TIMESTAMP, source_record_id = ?
  WHERE id = ? AND data_status = 'pending'
`);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const valid = [];
const errors = [];
for (const record of records) {
  const match = String(record.external_id || '').match(/^pending-(\d+)$/);
  const id = match ? Number(match[1]) : null;
  const current = id ? find.get(id) : null;
  const problems = [];

  if (!current) problems.push('pending university was not found');
  if (!clean(record.name)) problems.push('name is missing');
  if (!clean(record.city)) problems.push('city is missing');
  if (!clean(record.description)) problems.push('description is missing');
  if (!clean(record.official_website) || !/^https?:\/\/[^\s]+$/i.test(record.official_website)) problems.push('official_website is invalid');
  if (problems.length) {
    errors.push(`${record.external_id || 'unknown'}: ${problems.join(', ')}`);
    continue;
  }
  valid.push({ record, id });
}

try {
  if (errors.length) {
    console.error('Batch import blocked:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    const run = db.transaction(() => {
      for (const { record, id } of valid) {
        const languages = Array.isArray(record.languages) && record.languages.length
          ? record.languages
          : ['Казахский', 'Русский'];
        update.run(
          clean(record.name),
          clean(record.short_name),
          clean(record.official_website),
          clean(record.description),
          Number(record.founded) || null,
          Number(record.students_count) || null,
          JSON.stringify(languages),
          clean(record.contacts?.admission_phone),
          clean(record.address),
          Number(record.source_record_id) || null,
          id
        );
      }
    });
    run();
    console.log(`Updated partial verified batch: ${valid.length}`);
    console.log('Records remain pending until prices, programs, coordinates, and full sources are verified.');
  }
} finally {
  db.close();
}
