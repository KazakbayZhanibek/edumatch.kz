const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2] || path.join('C:\\Users\\Janchik\\Desktop', 'batch2_universities.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

const findCity = db.prepare('SELECT id FROM cities WHERE lower(name) = lower(?)');
const addCity = db.prepare('INSERT OR IGNORE INTO cities (name) VALUES (?)');
const findUni = db.prepare('SELECT id, short_name, name FROM universities WHERE id = ?');
const updateUni = db.prepare(`
  UPDATE universities SET
    description = ?,
    price_from = ?,
    price_to = ?,
    website = ?,
    languages = ?,
    has_dorm = ?,
    dorm_price = ?,
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
    const existing = findUni.get(rec.pending_id);
    if (!existing) {
      notFound++;
      notFoundList.push(`${rec.short_name} (pending_id=${rec.pending_id})`);
      continue;
    }

    const cityName = rec.city;
    let city = findCity.get(cityName);
    if (!city) {
      addCity.run(cityName);
      city = findCity.get(cityName);
    }

    const priceFrom = rec.tuition?.price_from_per_year || 0;
    const priceTo = rec.tuition?.price_to_per_year || 0;
    const hasDorm = rec.dormitory?.available ? 1 : 0;
    const dormPrice = rec.dormitory?.price_per_year || null;
    const languages = JSON.stringify(rec.languages || ['Казахский', 'Русский']);

    updateUni.run(
      rec.description || '',
      priceFrom,
      priceTo,
      rec.official_website || '',
      languages,
      hasDorm,
      dormPrice,
      rec.contacts?.admission_phone || '',
      rec.contacts?.admission_email || '',
      rec.contacts?.whatsapp || '',
      rec.address || '',
      rec.pending_id
    );
    updated++;
    console.log(`OK: ${rec.short_name} → id=${rec.pending_id} (${cityName}) price=${priceFrom}-${priceTo}`);
  }
});

try {
  run();
  console.log(`\n=== RESULTS ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  if (notFoundList.length) {
    console.log(`Missing:`);
    notFoundList.forEach(n => console.log(`  - ${n}`));
  }
} finally {
  db.close();
}