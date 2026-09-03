const Database = require('better-sqlite3');
const db = new Database('./edumatch.db');

const missing = db.prepare(`
  SELECT id, name, city_id, description, price_from, students_count, founded, lat, lng, 
         admission_phone, has_dorm, website, address, languages, accreditations
  FROM universities 
  WHERE (description IS NULL OR description = '' 
    OR price_from = 0 
    OR students_count IS NULL 
    OR founded IS NULL
    OR lat IS NULL
    OR admission_phone IS NULL
    OR has_dorm = 0
    OR website IS NULL OR website = '')
  AND id NOT BETWEEN 57 AND 90
  ORDER BY id
`).all();

console.log(`=== Other Universities with Missing Data ===\n`);
missing.forEach(u => {
  const gaps = [];
  if (!u.description) gaps.push('DESC');
  if (!u.price_from || u.price_from === 0) gaps.push('PRICE');
  if (!u.students_count) gaps.push('STUDENTS');
  if (!u.founded) gaps.push('FOUNDED');
  if (!u.lat) gaps.push('COORDS');
  if (!u.admission_phone) gaps.push('PHONE');
  if (!u.has_dorm) gaps.push('DORM');
  if (!u.website) gaps.push('WEB');
  if (gaps.length > 0) {
    console.log(`${u.id}: ${u.name?.trim()?.slice(0, 55)} => [${gaps.join(', ')}]`);
  }
});
console.log(`\nTotal with gaps: ${missing.length}`);
db.close();
