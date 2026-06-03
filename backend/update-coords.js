const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('eduMatch.db');
db.pragma('foreign_keys = OFF');

// Карта городов с правильными координатами
const cityCoordinates = {
  'нур-султан': { lat: 51.1694, lng: 71.4491 },  // Астана
  'алматы': { lat: 43.2380, lng: 76.9450 },
  'шымкент': { lat: 42.3021, lng: 69.5939 },
  'караганда': { lat: 49.8047, lng: 72.7859 },
  'семей': { lat: 50.4109, lng: 80.2275 },
  'актобе': { lat: 50.2839, lng: 57.1700 },
  'атырау': { lat: 43.6629, lng: 51.3675 },
  'костанай': { lat: 53.2141, lng: 63.6245 },
  'павлодар': { lat: 52.2809, lng: 76.9389 },
  'усть-каменогорск': { lat: 49.9824, lng: 82.6093 },
  'кызылорда': { lat: 44.8453, lng: 65.5009 },
};

// Загружаем данные из data.json
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const universities = data.universities || [];

console.log(`📍 Обновляю ${universities.length} университетов с правильными координатами...`);

// Получаем города
const citiesData = data.cities || [];
const citiesMap = {};
const citiesById = {};

for (const city of citiesData) {
  const cityName = city.name.toLowerCase();
  citiesMap[cityName] = city.id;
  citiesById[city.id] = city.name;
}

console.log('🏙️  Города:', citiesById);

// Обновляем университеты - используем city_id из данных
let updated = 0;
for (const uni of universities) {
  const cityId = uni.city_id || 1;
  const cityName = (citiesById[cityId] || '').toLowerCase();
  
  // Ищем координаты по части названия города
  let coords = null;
  for (const [key, coord] of Object.entries(cityCoordinates)) {
    if (cityName.includes(key) || key.includes(cityName.split(' ')[0])) {
      coords = coord;
      break;
    }
  }
  
  // Если не нашли, используем дефолт
  if (!coords) {
    coords = { lat: 51.1694, lng: 71.4491 };
    console.log(`⚠️  Для города "${citiesById[cityId]}" (ID ${cityId}) не найдены координаты`);
  }

  const stmt = db.prepare(`
    UPDATE universities 
    SET lat = ?, lng = ?, city_id = ?
    WHERE id = ?
  `);
  
  stmt.run(coords.lat, coords.lng, cityId, uni.id);
  updated++;
}

console.log(`✅ Обновлено ${updated} университетов`);

// Проверяем результаты
console.log('\n📋 Университеты по городам:');

const results = db.prepare(`
  SELECT c.name as city, COUNT(*) as cnt, 
         GROUP_CONCAT(u.name, ', ') as unis,
         AVG(u.lat) as avg_lat, AVG(u.lng) as avg_lng
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  GROUP BY u.city_id
  ORDER BY c.name
`).all();

for (const row of results) {
  console.log(`\n${row.city} (${row.cnt}):`);
  console.log(`  Координаты: ${row.avg_lat.toFixed(4)}, ${row.avg_lng.toFixed(4)}`);
  console.log(`  Вузы: ${row.unis}`);
}

// Проверяем Шымкент
const shimkent = db.prepare(`
  SELECT u.id, u.name, u.lat, u.lng
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  WHERE c.name LIKE '%Шымкент%'
`).all();

console.log(`\n✨ Шымкентские университеты (${shimkent.length}):`);
shimkent.forEach(u => {
  console.log(`   ${u.name}: ${u.lat}, ${u.lng}`);
});

console.log('\n✅ БД обновлена с правильными координатами!');
db.close();
