const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2] || 'C:\\Users\\Janchik\\Downloads\\bilim_beru_dengeileri_boiynsha1-v8.json';
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const columns = db.prepare('PRAGMA table_info(universities)').all().map(column => column.name);
if (!columns.includes('address')) db.exec('ALTER TABLE universities ADD COLUMN address TEXT');
if (!columns.includes('source_record_id')) db.exec('ALTER TABLE universities ADD COLUMN source_record_id INTEGER');

const generic = new Set(['некоммерческое', 'акционерное', 'общество', 'товарищество', 'ограниченной', 'ответственностью', 'частное', 'учреждение', 'негосударственное', 'образования', 'образовательное', 'высшее', 'профессиональное', 'университет', 'университеті', 'академия', 'академиясы', 'институт', 'нао', 'тоо', 'ао']);
const normalize = value => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-яәіңғүұқөһ0-9]+/gi, ' ').trim();
const tokens = value => normalize(value).split(/\s+/).filter(token => token.length > 3 && !generic.has(token));
const cityFromAddress = value => {
  const match = String(value || '').match(/(?:г\.|город)\s*([^,]+)/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : 'Не определён';
};
const current = db.prepare('SELECT id, name FROM universities').all();
const currentTokenSets = current.map(row => ({ row, set: new Set(tokens(row.name)) }));
const findCity = db.prepare('SELECT id FROM cities WHERE lower(name) = lower(?)');
const addCity = db.prepare('INSERT OR IGNORE INTO cities (name) VALUES (?)');
const insert = db.prepare(`INSERT INTO universities (
  id, name, short_name, city_id, price_from, price_to, website, description,
  founded, students_count, languages, accreditations, has_dorm, dorm_price,
  avg_salary, lat, lng, is_top, data_status, admission_phone, address, source_record_id
) VALUES (?, ?, ?, ?, 0, 0, '', ?, NULL, NULL, ?, ?, 0, NULL, NULL, NULL, NULL, 0, 'pending', ?, ?, ?)`);

let nextId = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM universities').get().id;
let imported = 0;
let skipped = 0;
const skippedNames = [];
const run = db.transaction(() => {
  for (const record of source) {
    const sourceName = String(record.legaladdress || '').replace(/\s+/g, ' ').trim();
    const sourceTokens = new Set(tokens(sourceName));
    const duplicate = currentTokenSets.some(({ set }) => {
      const overlap = [...sourceTokens].filter(token => set.has(token)).length;
      return overlap >= 2 || normalize(sourceName).includes(normalize([...set].join(' ')));
    });
    if (duplicate) {
      skipped++;
      skippedNames.push(sourceName);
      continue;
    }

    const address = String(record.reportingperiod || '').replace(/\s+/g, ' ').trim();
    const cityName = cityFromAddress(address);
    let city = findCity.get(cityName);
    if (!city && cityName !== 'Не определён') {
      addCity.run(cityName);
      city = findCity.get(cityName);
    }
    if (!city) {
      skipped++;
      skippedNames.push(`${sourceName} (city not found)`);
      continue;
    }

    const shortName = sourceName.replace(/^(Некоммерческое акционерное общество|Товарищество с ограниченной ответственностью|Акционерное общество|Учреждение|Частное высшее профессиональное образовательное учреждение|Негосударственное учреждение образования)\s*/i, '').slice(0, 80);
    const description = `Организация из официального справочника за 2026 год. Адрес и телефон требуют проверки на официальном сайте. Внешний ID источника: ${record.id}.`;
    insert.run(nextId++, sourceName, shortName, city.id, description, JSON.stringify(['Казахский', 'Русский']), JSON.stringify(['Требует проверки']), record.contactphonenumber || '', address, record.id);
    imported++;
  }
});

try {
  run();
  console.log(`Imported pending organizations: ${imported}`);
  console.log(`Skipped likely duplicates/invalid: ${skipped}`);
} finally {
  db.close();
}
