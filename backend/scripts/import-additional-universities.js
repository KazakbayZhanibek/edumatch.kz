const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const sourcePath = path.join(__dirname, '..', '..', 'Parcerscript', 'universities.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const existing = new Set(db.prepare('SELECT id FROM universities').all().map(row => row.id));
const cityExists = db.prepare('SELECT 1 FROM cities WHERE id = ?');
const insert = db.prepare(`
  INSERT INTO universities (
    id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to,
    website, description, founded, students_count, languages, accreditations,
    has_dorm, dorm_price, avg_salary, lat, lng, is_top, data_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')
`);

function cleanText(value, fallback) {
  return String(value || fallback || '').replace(/\s+/g, ' ').trim();
}

let imported = 0;
let skipped = 0;
const run = db.transaction(() => {
  for (const university of source) {
    if (existing.has(university.id)) {
      skipped++;
      continue;
    }
    if (!university.id || !university.name || !cityExists.get(university.city_id)) {
      skipped++;
      continue;
    }

    const name = cleanText(university.name, `Университет №${university.id}`);
    const shortName = cleanText(university.short_name, name.slice(0, 32));
    const description = cleanText(university.description, `Информация об университете ${name} уточняется.`);
    const languages = Array.isArray(university.languages) && university.languages.length
      ? university.languages
      : ['Казахский', 'Русский'];
    const accreditations = Array.isArray(university.accreditations) && university.accreditations.length
      ? university.accreditations
      : ['Требует проверки'];

    insert.run(
      university.id,
      name,
      shortName,
      university.city_id,
      university.qs_world || null,
      university.qs_asia || null,
      Number(university.price_from) || 0,
      Number(university.price_to) || 0,
      cleanText(university.website),
      description,
      Number(university.founded) || null,
      Number(university.students_count) || null,
      JSON.stringify(languages),
      JSON.stringify(accreditations),
      university.has_dorm ? 1 : 0,
      Number(university.dorm_price) || null,
      Number(university.avg_salary) || null,
      null,
      null
    );
    imported++;
  }
});

try {
  run();
  console.log(`Imported pending universities: ${imported}`);
  console.log(`Skipped existing/invalid records: ${skipped}`);
} finally {
  db.close();
}
