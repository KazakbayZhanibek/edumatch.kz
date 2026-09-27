const Database = require('better-sqlite3');
const db = new Database('./edumatch.db');

const checks = [
  ['price_from', "price_from = 0"],
  ['description', "description IS NULL OR description = ''"],
  ['students_count', "students_count IS NULL"],
  ['founded', "founded IS NULL"],
  ['lat', "lat IS NULL"],
  ['lng', "lng IS NULL"],
  ['admission_phone', "admission_phone IS NULL"],
  ['has_dorm', "has_dorm = 0"],
  ['website', "website IS NULL OR website = ''"],
];

console.log('=== Data Quality After Batch4 ===');
for (const [label, where] of checks) {
  const v = db.prepare(`SELECT COUNT(*) as n FROM universities WHERE ${where}`).get();
  console.log(`${label}: ${v.n} missing`);
}
const t = db.prepare('SELECT COUNT(*) as n FROM universities').get();
console.log(`\nTotal: ${t.n}`);

// Check descriptions from batch4
console.log('\n=== Batch4 Descriptions (101, 102, 103, 105, 106, 108, 113, 118, 126, 159) ===');
[101,102,103,105,106,108,113,118,126,159].forEach(id => {
  const r = db.prepare('SELECT name, description, description_kk, description_en FROM universities WHERE id = ?').get(id);
  const d = r?.description ? r.description.slice(0, 80) : 'NULL';
  const dkk = r?.description_kk ? r.description_kk.slice(0, 80) : 'NULL';
  const den = r?.description_en ? r.description_en.slice(0, 80) : 'NULL';
  console.log(`${id}: desc=[${d}]... kk=[${dkk}]... en=[${den}]...`);
});

db.close();
