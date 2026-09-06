const Database = require('better-sqlite3');
const db = new Database('./edumatch.db');

const rows = db.prepare(`
  SELECT u.id, u.name, c.name as city,
    u.price_from, u.students_count, u.founded, u.lat, u.lng,
    u.admission_phone, u.has_dorm, u.website, u.address
  FROM universities u
  LEFT JOIN cities c ON u.city_id = c.id
  WHERE u.price_from = 0 OR u.students_count IS NULL OR u.founded IS NULL 
    OR u.lat IS NULL OR u.admission_phone IS NULL OR u.has_dorm = 0 
    OR u.website IS NULL OR u.website = ''
  ORDER BY u.id
`).all();

console.log(`Universities with missing data: ${rows.length}\n`);
rows.forEach(r => {
  const gaps = [];
  if (!r.price_from) gaps.push('PRICE');
  if (!r.students_count) gaps.push('STUDENTS');
  if (!r.founded) gaps.push('FOUNDED');
  if (!r.lat) gaps.push('COORDS');
  if (!r.admission_phone) gaps.push('PHONE');
  if (!r.has_dorm) gaps.push('DORM');
  if (!r.website) gaps.push('WEB');
  console.log(`${r.id}|${r.name?.trim()?.slice(0,55)}|${r.city}|${gaps.join(',')}`);
});

db.close();
