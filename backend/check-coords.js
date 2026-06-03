const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'eduMatch.db'));

// Все университеты
const all = db.prepare('SELECT COUNT(*) as count FROM universities').get();
console.log('Всего вузов в БД:', all.count);

// Без координат
const noCoords = db.prepare('SELECT COUNT(*) as count FROM universities WHERE lat IS NULL OR lng IS NULL').get();
console.log('Без координат:', noCoords.count);

// В Алматы (42-44 латуда, 75-78 долгота)
const almaty = db.prepare('SELECT COUNT(*) as count FROM universities WHERE lat BETWEEN 42 AND 44 AND lng BETWEEN 75 AND 78').get();
console.log('В Алматы:', almaty.count);

console.log('\n📍 Вузы в Алматы:');
const unis = db.prepare('SELECT id, short_name, name, lat, lng FROM universities WHERE lat BETWEEN 42 AND 44 AND lng BETWEEN 75 AND 78').all();
unis.forEach(u => {
  console.log(`${u.id}. ${u.short_name} (${u.lat}, ${u.lng})`);
});

console.log('\n📍 Первые 5 вузов с координатами:');
const first5 = db.prepare('SELECT id, short_name, lat, lng FROM universities WHERE lat IS NOT NULL LIMIT 5').all();
first5.forEach(u => {
  console.log(`${u.id}. ${u.short_name} (${u.lat}, ${u.lng})`);
});

db.close();
