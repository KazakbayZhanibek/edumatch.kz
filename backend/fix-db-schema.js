const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('eduMatch.db');

console.log('🔧 Восстанавливаю полную схему таблицы университетов...');

// Отключаем FOREIGN KEY проверку
db.pragma('foreign_keys = OFF');

// Пересоздаём таблицу со всеми колонками
db.exec(`
  DROP TABLE IF EXISTS universities;
  CREATE TABLE universities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    city_id INTEGER NOT NULL,
    qs_world INTEGER,
    qs_asia INTEGER,
    price_from INTEGER NOT NULL,
    price_to INTEGER NOT NULL,
    website TEXT,
    description TEXT,
    founded INTEGER,
    students_count INTEGER,
    languages TEXT NOT NULL,
    accreditations TEXT NOT NULL,
    has_dorm INTEGER NOT NULL,
    dorm_price INTEGER,
    avg_salary INTEGER,
    lat REAL,
    lng REAL,
    is_top INTEGER DEFAULT 0,
    FOREIGN KEY(city_id) REFERENCES cities(id)
  );
`);

// Загружаем данные из JSON
const jsonPath = path.join(__dirname, './data.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
// Если это массив объектов в поле universities, извлекаем его
const universities = Array.isArray(data) ? data : (data.universities || []);

console.log(`📥 Загружено ${universities.length} университетов из JSON`);

// Получаём города
const citiesMap = {};
const citiesStmt = db.prepare('SELECT id, name FROM cities');
for (const row of citiesStmt.all()) {
  citiesMap[row.name.toLowerCase()] = row.id;
}

console.log(`🏙️  Найдено ${Object.keys(citiesMap).length} городов в БД`);

// Вставляем университеты
const stmt = db.prepare(`
  INSERT INTO universities 
  (id, name, short_name, city_id, lat, lng, price_from, price_to, 
   languages, accreditations, has_dorm, website, founded, description, 
   students_count, qs_world, qs_asia, dorm_price, avg_salary, is_top)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
for (const uni of universities) {
  const cityName = (uni.city || '').toLowerCase();
  const cityId = citiesMap[cityName] || 1;
  
  stmt.run(
    uni.id,
    uni.name,
    uni.short_name || uni.name.substring(0, 10),
    cityId,
    parseFloat(uni.lat) || 0,
    parseFloat(uni.lng) || 0,
    parseInt(uni.price_from) || 0,
    parseInt(uni.price_to) || 0,
    JSON.stringify(['Казахский', 'Русский', 'Английский']),
    JSON.stringify(['Национальная']),
    1,
    uni.website || '',
    parseInt(uni.founded) || 0,
    uni.description || '',
    0,
    null,
    null,
    0,
    0,
    0
  );
  inserted++;
}

console.log(`✅ Вставлено ${inserted} университетов`);

// Проверка
const check = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
console.log(`📊 Всего в БД: ${check.cnt}`);

// Проверяем Шымкент
const shymkent = db.prepare(`
  SELECT u.id, u.name, u.lat, u.lng, c.name as city
  FROM universities u
  LEFT JOIN cities c ON u.city_id = c.id
  WHERE c.name LIKE '%Шымкент%'
  LIMIT 3
`).all();

console.log(`\n🔍 Шымкентские университеты (${shymkent.length}):`);
shymkent.forEach(u => {
  console.log(`   ID ${u.id}: ${u.name} (${u.city}) - ${u.lat}, ${u.lng}`);
});

// Проверяем первые 5
const first5 = db.prepare(`
  SELECT u.id, u.name, u.city_id, u.lat, u.lng
  FROM universities u
  LIMIT 5
`).all();

console.log(`\n📍 Первые 5 университетов:`);
first5.forEach(u => {
  console.log(`   ${u.id}. ${u.name} - ${u.lat}, ${u.lng}`);
});

// Проверяем, есть ли NULL координаты
const nullCoords = db.prepare(`
  SELECT COUNT(*) as cnt FROM universities WHERE lat IS NULL OR lng IS NULL
`).get();

if (nullCoords.cnt > 0) {
  console.log(`\n⚠️  ${nullCoords.cnt} университетов без координат!`);
}

console.log('\n✨ БД успешно восстановлена!');
db.close();
