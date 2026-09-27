const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'pending-universities.json'));
if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);

const records = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('Input must be a JSON array');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const findPending = db.prepare("SELECT id FROM universities WHERE id = ? AND data_status = 'pending'");
const findCity = db.prepare('SELECT id FROM cities WHERE name = ?');
const update = db.prepare(`
  UPDATE universities SET
    name = ?, short_name = ?, city_id = ?, website = ?, description = ?,
    price_from = ?, price_to = ?, languages = ?, has_dorm = ?, dorm_price = ?,
    lat = ?, lng = ?, data_status = 'active', last_updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND data_status = 'pending'
`);

function validUrl(value) { return /^https:\/\/[^\s]+$/i.test(String(value || '')); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

let activated = 0;
const errors = [];
const validRecords = [];
for (const record of records) {
  const problems = [];
    const lat = Number(record.coordinates?.lat);
    const lng = Number(record.coordinates?.lng);
    const priceFrom = Number(record.price_from);
    const priceTo = Number(record.price_to);
    const city = findCity.get(clean(record.city));

    if (!findPending.get(record.id)) problems.push('not a pending university');
    if (!clean(record.name) || !clean(record.short_name)) problems.push('name/short_name missing');
    if (!city) problems.push('city is not in the database');
    if (!validUrl(record.official_website)) problems.push('official_website must be HTTPS');
    if (!validUrl(record.source_url)) problems.push('source_url must be HTTPS');
    if (!validDate(record.verified_at)) problems.push('verified_at must be YYYY-MM-DD');
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 56 || lng < 45 || lng > 88 || (lat === 50 && lng === 70)) problems.push('coordinates are invalid');
    if (!Number.isFinite(priceFrom) || !Number.isFinite(priceTo) || priceFrom <= 0 || priceTo < priceFrom) problems.push('prices are invalid');
    if (!Array.isArray(record.programs) || record.programs.length === 0) problems.push('programs are missing');

  if (problems.length) {
    errors.push(`${record.id}: ${problems.join(', ')}`);
  } else {
    validRecords.push({ record, city, lat, lng, priceFrom, priceTo });
  }
}

const run = db.transaction(() => {
  for (const { record, city, lat, lng, priceFrom, priceTo } of validRecords) {
    const description = `Проверено ${record.verified_at}. Источник: ${record.source_url}. Программы: ${record.programs.map(clean).join(', ')}`;
    const languages = Array.isArray(record.languages) && record.languages.length ? record.languages : ['Казахский', 'Русский'];
    update.run(clean(record.name), clean(record.short_name), city.id, record.official_website, description, priceFrom, priceTo, JSON.stringify(languages), record.has_dorm ? 1 : 0, Number(record.dorm_price) || null, lat, lng, record.id);
    activated++;
  }
});

try {
  if (errors.length) {
    console.error('Import blocked. Fix these records first:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    run();
    console.log(`Activated verified universities: ${activated}`);
  }
} finally {
  db.close();
}
