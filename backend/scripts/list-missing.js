const Database = require('better-sqlite3');
const db = new Database('./edumatch.db');

const missing = db.prepare(`
  SELECT id, name, city_id, description, price_from, students_count, founded, lat, lng, 
         admission_phone, has_dorm, website, address
  FROM universities 
  WHERE id >= 57 AND id <= 90
  ORDER BY id
`).all();

console.log(`=== 34 Parcerscript Universities (ID 57-90) ===\n`);
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
  if (!u.address) gaps.push('ADDR');
  console.log(`${u.id}: ${u.name?.trim()?.slice(0, 55)} => [${gaps.join(', ')}]`);
});

db.close();
