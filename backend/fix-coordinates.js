const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'eduMatch.db'));

// Читаем координаты из твоего файла
const coordsData = fs.readFileSync('c:\\Users\\Janchik\\Desktop\\maps\\universities_coordinates.json', 'utf8');
const universities = JSON.parse(coordsData);

const stmt = db.prepare('UPDATE universities SET lat = ?, lng = ? WHERE id = ?');

let updated = 0;
let errors = [];

universities.forEach(uni => {
  try {
    const result = stmt.run(uni.lat, uni.lng, uni.id);
    if (result.changes > 0) {
      updated++;
      console.log(`✓ ID ${uni.id}: ${uni.name.substring(0, 40)} → (${uni.lat}, ${uni.lng})`);
    } else {
      errors.push(`ID ${uni.id}: Университет не найден в базе`);
    }
  } catch (e) {
    errors.push(`ID ${uni.id}: ${e.message}`);
  }
});

if (errors.length > 0) {
  console.error('\n⚠️ Ошибки:');
  errors.forEach(err => console.error(`  ${err}`));
}

console.log(`\n✅ Обновлено ${updated} из ${universities.length} университетов`);

// Проверим, что данные обновились
const check = db.prepare('SELECT id, name, lat, lng FROM universities WHERE id BETWEEN 1 AND 5').all();
console.log('\n📍 Проверка первых 5 университетов:');
check.forEach(u => {
  console.log(`  ${u.id}. ${u.name.substring(0, 35)} → (${u.lat}, ${u.lng})`);
});

db.close();
