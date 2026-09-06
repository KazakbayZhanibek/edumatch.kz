const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

console.log('=== Data Quality After Deep Search Update ===\n');

const checks = [
  { label: 'Students', q: "SELECT COUNT(*) as c FROM universities WHERE students_count IS NULL OR students_count = 0" },
  { label: 'Founded', q: "SELECT COUNT(*) as c FROM universities WHERE founded IS NULL OR founded = 0" },
  { label: 'Lat', q: "SELECT COUNT(*) as c FROM universities WHERE lat = 0 OR lat IS NULL" },
  { label: 'Lng', q: "SELECT COUNT(*) as c FROM universities WHERE lng = 0 OR lng IS NULL" },
  { label: 'Phone', q: "SELECT COUNT(*) as c FROM universities WHERE admission_phone IS NULL OR admission_phone = ''" },
  { label: 'Website', q: "SELECT COUNT(*) as c FROM universities WHERE website IS NULL OR website = ''" },
  { label: 'Dorm', q: "SELECT COUNT(*) as c FROM universities WHERE has_dorm IS NULL" },
  { label: 'Price', q: "SELECT COUNT(*) as c FROM universities WHERE price_from IS NULL OR price_from = 0" },
  { label: 'Description(RU)', q: "SELECT COUNT(*) as c FROM universities WHERE description IS NULL OR description = ''" },
  { label: 'Description(KK)', q: "SELECT COUNT(*) as c FROM universities WHERE description_kk IS NULL OR description_kk = ''" },
  { label: 'Description(EN)', q: "SELECT COUNT(*) as c FROM universities WHERE description_en IS NULL OR description_en = ''" },
];

for (const check of checks) {
  const r = db.prepare(check.q).get();
  const status = r.c === 0 ? '✓' : `${r.c} missing`;
  console.log(`${check.label}: ${status}`);
}

console.log('\nTotal:', db.prepare('SELECT COUNT(*) as c FROM universities').get().c);
db.close();
