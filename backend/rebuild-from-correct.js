const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('eduMatch.db');
db.pragma('foreign_keys = OFF');

console.log('🔧 Пересоздаю таблицу университетов с правильными данными...\n');

// Загружаем правильные данные
const correctData = JSON.parse(fs.readFileSync('./correct_universities.json', 'utf8'));

// Получаем или создаём города
const citiesMap = {};
const cityNames = new Set();

for (const uni of correctData) {
  cityNames.add(uni.city);
}

console.log('📋 Уникальные города:', Array.from(cityNames));

// Получаем существующие города
const existingCities = db.prepare('SELECT id, name FROM cities').all();
const existingCityMap = {};
for (const city of existingCities) {
  existingCityMap[city.name.toLowerCase()] = city.id;
}

// Добавляем недостающие города
const insertCity = db.prepare('INSERT OR IGNORE INTO cities (name) VALUES (?)');
for (const cityName of cityNames) {
  insertCity.run(cityName);
}

// Перезагружаем города
const allCities = db.prepare('SELECT id, name FROM cities').all();
for (const city of allCities) {
  citiesMap[city.name] = city.id;
}

console.log(`✅ Всего городов: ${allCities.length}\n`);

// Пересоздаём таблицу университетов
db.exec(`DROP TABLE IF EXISTS universities;`);
db.exec(`
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

console.log('🔄 Вставляю 44 университета с правильными координатами...\n');

const insertUni = db.prepare(`
  INSERT INTO universities 
  (id, name, short_name, city_id, lat, lng, price_from, price_to, 
   languages, accreditations, has_dorm, website, founded, description, 
   students_count, qs_world, qs_asia, dorm_price, avg_salary, is_top)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
for (const uni of correctData) {
  const cityId = citiesMap[uni.city] || 1;
  
  insertUni.run(
    uni.id,
    uni.name,
    uni.short_name,
    cityId,
    uni.lat,
    uni.lng,
    0,  // price_from
    0,  // price_to
    JSON.stringify(['Казахский', 'Русский', 'Английский']),
    JSON.stringify(['Национальная']),
    1,  // has_dorm
    uni.website || '',
    0,  // founded
    uni.address || '',
    0,  // students_count
    null,  // qs_world
    null,  // qs_asia
    0,  // dorm_price
    0,  // avg_salary
    0   // is_top
  );
  inserted++;
  console.log(`✅ ${uni.id}. ${uni.name} (${uni.city}) - [${uni.lat}, ${uni.lng}]`);
}

console.log(`\n✨ Вставлено ${inserted} университетов\n`);

// Проверяем Шымкент
console.log('🔍 Шымкентские университеты:');
const shimkent = db.prepare(`
  SELECT u.id, u.name, u.lat, u.lng, c.name as city
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  WHERE c.name = 'Шымкент'
`).all();

console.log(`Найдено: ${shimkent.length}`);
shimkent.forEach(u => {
  console.log(`   ID ${u.id}: ${u.name}`);
  console.log(`   Город: ${u.city}`);
  console.log(`   Координаты: [${u.lat}, ${u.lng}]`);
});

// Проверяем распределение по городам
console.log('\n📊 Распределение по городам:');
const byCity = db.prepare(`
  SELECT c.name, COUNT(*) as cnt
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  GROUP BY u.city_id
  ORDER BY c.name
`).all();

for (const row of byCity) {
  console.log(`   ${row.name}: ${row.cnt}`);
}

// Проверяем несколько ключевых университетов
console.log('\n✅ Проверка ключевых университетов:');
const check = db.prepare(`
  SELECT id, name, city_id, lat, lng FROM universities 
  WHERE id IN (1, 2, 13, 31, 43, 44)
  ORDER BY id
`).all();

for (const u of check) {
  const city = db.prepare('SELECT name FROM cities WHERE id = ?').get(u.city_id);
  console.log(`   ID ${u.id}: ${u.name} (${city ? city.name : '?'})`);
  console.log(`      Координаты: [${u.lat}, ${u.lng}]`);
}

console.log('\n✨ БД полностью пересоздана с правильными данными!');
db.close();
