const db = require('better-sqlite3')('edumatch.db');

console.log('=== SPECIALTIES ===');
const specs = db.prepare('SELECT * FROM specialties').all();
console.log(JSON.stringify(specs, null, 2));

console.log('\n=== UNIVERSITY_SPECIALTIES (первые 10) ===');
const uniSpecs = db.prepare('SELECT us.*, s.name as spec_name FROM university_specialties us JOIN specialties s ON us.specialty_id = s.id LIMIT 10').all();
console.log(JSON.stringify(uniSpecs, null, 2));

console.log('\n=== СКОЛЬКО ВУЗ НА СПЕЦИАЛЬНОСТЬ 1 (IT) ===');
const count = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties WHERE specialty_id = 1').get();
console.log('Количество ВУЗов с IT:', count.cnt);

console.log('\n=== ВУЗы ДЛЯ IT (specialty_id=1) ===');
const itsUnis = db.prepare(`
  SELECT u.id, u.name, u.short_name, s.id as spec_id, s.name as spec_name
  FROM universities u 
  JOIN university_specialties us ON u.id = us.university_id 
  JOIN specialties s ON us.specialty_id = s.id
  WHERE us.specialty_id = 1
`).all();
console.log(JSON.stringify(itsUnis, null, 2));

console.log('\n=== ВСЕ СВЯЗИ (университет - специальность) ===');
const allLinks = db.prepare(`
  SELECT u.id as uni_id, u.short_name, s.id as spec_id, s.name as spec_name
  FROM universities u 
  JOIN university_specialties us ON u.id = us.university_id 
  JOIN specialties s ON us.specialty_id = s.id
  ORDER BY s.id, u.short_name
`).all();
console.log(JSON.stringify(allLinks, null, 2));
