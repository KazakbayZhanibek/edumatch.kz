const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2] || path.join('C:\\Users\\Janchik\\Downloads', 'batch4_universities.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

const findCity = db.prepare('SELECT id FROM cities WHERE lower(name) = lower(?)');
const addCity = db.prepare('INSERT OR IGNORE INTO cities (name) VALUES (?)');
const findUni = db.prepare('SELECT id, name FROM universities WHERE id = ? OR lower(short_name) LIKE lower(?) OR lower(name) LIKE lower(?)');
const updateUni = db.prepare(`
  UPDATE universities SET
    description = ?,
    price_from = ?,
    price_to = ?,
    website = ?,
    languages = ?,
    has_dorm = ?,
    admission_phone = ?,
    admission_email = ?,
    admission_whatsapp = ?,
    address = ?,
    data_status = 'active',
    last_updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

let updated = 0;
let notFound = 0;
const notFoundList = [];

const run = db.transaction(() => {
  for (const rec of source.universities) {
    // Find existing university by short_name or name (fuzzy match)
    const shortNamePattern = `%${rec.short_name.split('(')[0].trim()}%`;
    const namePattern = `%${rec.name.replace(/["«»]/g, '').slice(0, 30)}%`;
    const existing = findUni.get(rec.pending_id, shortNamePattern, namePattern);

    if (!existing) {
      notFound++;
      notFoundList.push(`${rec.short_name} (pending_id=${rec.pending_id})`);
      continue;
    }

    // Resolve city
    const cityName = rec.city;
    let city = findCity.get(cityName);
    if (!city) {
      addCity.run(cityName);
      city = findCity.get(cityName);
    }

    // Parse tuition
    const priceFrom = rec.tuition?.price_from_per_year || 0;
    const priceTo = rec.tuition?.price_to_per_year || 0;

    // Parse dorm
    const hasDorm = rec.dormitory?.available ? 1 : 0;

    // Languages
    const languages = JSON.stringify(rec.languages || ['Казахский', 'Русский']);

    // Build enriched description
    const desc = rec.description || '';

    // Contacts
    const phone = rec.contacts?.admission_phone || '';
    const email = rec.contacts?.admission_email || '';
    const whatsapp = rec.contacts?.whatsapp || '';

    updateUni.run(
      desc,
      priceFrom,
      priceTo,
      rec.official_website || '',
      languages,
      hasDorm,
      phone,
      email,
      whatsapp,
      rec.address || '',
      existing.id
    );
    updated++;
    console.log(`Updated: ${rec.short_name} → id=${existing.id} (${cityName})`);
  }
});

try {
  run();
  console.log(`\n=== RESULTS ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  if (notFoundList.length) {
    console.log(`Missing universities:`);
    notFoundList.forEach(n => console.log(`  - ${n}`));
  }
} finally {
  db.close();
}
