const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');

try {
  // Загрузить JSON
  const data = JSON.parse(fs.readFileSync('../../Parcerscript/universities.json', 'utf8'));
  
  // Подготовить inserts
  const insertUniversity = db.prepare(`
    INSERT INTO universities (id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to, website, description, founded, students_count, languages, accreditations, has_dorm, dorm_price, avg_salary, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const uni of data.slice(0, 15)) {
    try {
      insertUniversity.run(
        uni.id,
        uni.name,
        uni.short_name,
        uni.city_id || 1,
        uni.qs_world || null,
        uni.qs_asia || null,
        uni.price_from || 500000,
        uni.price_to || 2000000,
        uni.website || '',
        uni.description || '',
        uni.founded || 2000,
        uni.students_count || 0,
        JSON.stringify(uni.languages || ['Казахский', 'Русский']),
        JSON.stringify(uni.accreditations || ['Национальная']),
        uni.has_dorm ? 1 : 0,
        uni.dorm_price || 0,
        uni.avg_salary || 0,
        uni.lat || 0,
        uni.lng || 0
      );
      count++;
    } catch (err) {
      console.log('Error inserting uni', uni.id, ':', err.message);
    }
  }

  console.log(`Loaded ${count} universities`);
} catch (err) {
  console.error('Error:', err.message);
}
