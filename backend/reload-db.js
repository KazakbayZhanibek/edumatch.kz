const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('eduMatch.db');
db.pragma('foreign_keys = OFF');

// Карта городов с правильными координатами
const cityCoordinates = {
  'нур-султан': { lat: 51.1694, lng: 71.4491 },
  'алматы': { lat: 43.2380, lng: 76.9450 },
  'шымкент': { lat: 42.3021, lng: 69.5939 },
  'караганда': { lat: 49.8047, lng: 72.7859 },
  'семей': { lat: 50.4109, lng: 80.2275 },
  'актобе': { lat: 50.2839, lng: 57.1700 },
  'атырау': { lat: 43.6629, lng: 51.3675 },
  'костанай': { lat: 53.2141, lng: 63.6245 },
  'павлодар': { lat: 52.2809, lng: 76.9389 },
  'тараз': { lat: 42.9019, lng: 71.3722 },
  'уральск': { lat: 51.2161, lng: 51.3787 },
};

console.log('🔧 Полностью пересоздаю таблицу университетов с правильной загрузкой...');

// Пересоздаём таблицу
db.exec(`DROP TABLE IF EXISTS universities`);
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

// Загружаем данные
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const universities = data.universities || [];
const citiesData = data.cities || [];

console.log(`📥 Загружено ${universities.length} университетов`);

// Создаём маппинг городов
const citiesById = {};
for (const city of citiesData) {
  citiesById[city.id] = city.name.toLowerCase();
}

console.log(`🏙️  Города: ${JSON.stringify(citiesById)}`);

// Вставляем университеты с правильными координатами
const stmt = db.prepare(`
  INSERT INTO universities 
  (id, name, short_name, city_id, lat, lng, price_from, price_to, 
   languages, accreditations, has_dorm, website, founded, description, 
   students_count, qs_world, qs_asia, dorm_price, avg_salary, is_top)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
for (const uni of universities) {
  const cityId = uni.city_id || 1;
  const cityName = citiesById[cityId] || 'нур-султан';
  
  // Ищем координаты по части названия города
  let coords = null;
  for (const [key, coord] of Object.entries(cityCoordinates)) {
    if (cityName.includes(key) || key.includes(cityName.split(' ')[0])) {
      coords = coord;
      break;
    }
  }
  
  if (!coords) {
    coords = { lat: 51.1694, lng: 71.4491 };
  }

  const languages = Array.isArray(uni.languages) ? JSON.stringify(uni.languages) : '["Казахский","Русский","Английский"]';
  const accreditations = Array.isArray(uni.accreditations) ? JSON.stringify(uni.accreditations) : '["Национальная"]';

  stmt.run(
    uni.id,
    uni.name,
    uni.short_name || uni.name.substring(0, 10),
    cityId,
    coords.lat,
    coords.lng,
    uni.price_from || 0,
    uni.price_to || 0,
    languages,
    accreditations,
    uni.has_dorm ? 1 : 0,
    uni.website || '',
    uni.founded || 0,
    uni.description || '',
    uni.students_count || 0,
    uni.qs_world || null,
    uni.qs_asia || null,
    uni.dorm_price || 0,
    uni.avg_salary || 0,
    uni.is_top ? 1 : 0
  );
  inserted++;
}

console.log(`✅ Вставлено ${inserted} университетов\n`);

// Проверяем результаты
console.log('📋 Университеты по городам:');

const results = db.prepare(`
  SELECT c.name as city, COUNT(*) as cnt, 
         MIN(u.lat) as min_lat, MAX(u.lat) as max_lat,
         AVG(u.lat) as avg_lat, AVG(u.lng) as avg_lng
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  GROUP BY u.city_id
  ORDER BY c.name
`).all();

let totalCount = 0;
for (const row of results) {
  console.log(`\n${row.city} (${row.cnt} вузов):`);
  console.log(`  Координаты: ${row.avg_lat.toFixed(4)}, ${row.avg_lng.toFixed(4)}`);
  totalCount += row.cnt;
}

console.log(`\n📊 Всего университетов: ${totalCount}`);

// Выводим несколько университетов каждого города
console.log('\n📍 Примеры университетов по городам:');
const examples = db.prepare(`
  SELECT c.name as city, u.name, u.lat, u.lng
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  ORDER BY c.name, u.name
`).all();

let currentCity = '';
let cityCount = 0;
for (const ex of examples) {
  if (ex.city !== currentCity) {
    currentCity = ex.city;
    cityCount = 0;
  }
  if (cityCount < 2) {
    console.log(`  ${ex.city}: ${ex.name} (${ex.lat.toFixed(4)}, ${ex.lng.toFixed(4)})`);
    cityCount++;
  }
}

console.log('\n✨ БД полностью пересоздана с правильными координатами!');
db.close();
