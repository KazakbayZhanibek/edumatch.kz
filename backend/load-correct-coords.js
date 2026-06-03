const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('eduMatch.db');
db.pragma('foreign_keys = OFF');

console.log('📍 Загружаю точные координаты для всех университетов...\n');

// Загружаем правильные данные
const correctData = JSON.parse(fs.readFileSync('./correct_universities.json', 'utf8'));

// Получаем города из БД с маппингом по названию
const citiesData = JSON.parse(fs.readFileSync('./data.json', 'utf8')).cities || [];
const cityNameToId = {};

for (const city of citiesData) {
  const normalized = city.name.toLowerCase().trim();
  cityNameToId[normalized] = city.id;
}

console.log('🏙️  Города в БД:');
Object.entries(cityNameToId).forEach(([name, id]) => {
  console.log(`   ${id}: ${name}`);
});

// Маппируем названия городов из JSON на city_id
const cityMappings = {
  'астана': cityNameToId['нур-султан'] || 1,
  'алматы': cityNameToId['алматы'] || 2,
  'акмола': cityNameToId['акмола'] || cityNameToId['аксай'] || 11,
  'темиртау': cityNameToId['темиртау'] || 4,
  'караганда': cityNameToId['караганда'] || 4,
  'павлодар': cityNameToId['павлодар'] || 9,
  'усть-каменогорск': cityNameToId['усть-каменогорск'] || 10,
  'семей': cityNameToId['семей'] || 5,
  'шымкент': cityNameToId['шымкент'] || 3,
  'кызылорда': cityNameToId['кызылорда'] || 11,
  'актау': cityNameToId['актау'] || cityNameToId['мангистау'] || 12,
  'атырау': cityNameToId['атырау'] || 7,
  'уральск': cityNameToId['уральск'] || cityNameToId['западноказахстанская'] || 8,
  'петропавловск': cityNameToId['петропавловск'] || 8,
  'каскелен': cityNameToId['алматы'] || 2,
  'актюбе': cityNameToId['актюбе'] || 6,
  'кокшетау': cityNameToId['кокшетау'] || 8,
  'жезказган': cityNameToId['жезказган'] || 4,
};

console.log('\n🔄 Обновляю координаты...\n');

let updated = 0;
let errors = [];

const updateStmt = db.prepare(`
  UPDATE universities 
  SET lat = ?, lng = ?, city_id = ?
  WHERE id = ?
`);

for (const uni of correctData) {
  const cityId = cityMappings[uni.city.toLowerCase()] || 1;
  
  try {
    updateStmt.run(uni.lat, uni.lng, cityId, uni.id);
    updated++;
    console.log(`✅ ID ${uni.id}: ${uni.name} (${uni.city}) - ${uni.lat}, ${uni.lng}`);
  } catch (err) {
    errors.push(`❌ ID ${uni.id}: ${err.message}`);
  }
}

console.log(`\n✅ Обновлено ${updated} университетов\n`);

if (errors.length > 0) {
  console.log('⚠️  Ошибки:');
  errors.forEach(e => console.log(e));
}

// Проверяем результаты
console.log('\n📊 Университеты по городам:\n');

const results = db.prepare(`
  SELECT c.name as city, COUNT(*) as cnt, 
         GROUP_CONCAT(SUBSTR(u.name, 1, 40), ', ') as unis,
         ROUND(AVG(u.lat), 4) as avg_lat, ROUND(AVG(u.lng), 4) as avg_lng
  FROM universities u
  LEFT JOIN cities c ON u.city_id = c.id
  GROUP BY u.city_id
  ORDER BY c.name
`).all();

for (const row of results) {
  console.log(`📍 ${row.city} (${row.cnt}):`);
  console.log(`   Координаты: ${row.avg_lat}, ${row.avg_lng}`);
}

// Проверяем Шымкент
console.log('\n🔍 Шымкентские университеты:');
const shimkent = db.prepare(`
  SELECT u.id, u.name, u.lat, u.lng, c.name as city
  FROM universities u
  JOIN cities c ON u.city_id = c.id
  WHERE c.name LIKE '%Шымкент%' OR u.city_id = 3
`).all();

console.log(`Найдено: ${shimkent.length}`);
shimkent.forEach(u => {
  console.log(`   ID ${u.id}: ${u.name} (${u.city}) - ${u.lat}, ${u.lng}`);
});

// Проверяем несколько точек
console.log('\n📍 Проверка точных координат:');
const check = db.prepare(`
  SELECT id, name, lat, lng FROM universities 
  WHERE id IN (1, 13, 2, 43)
  ORDER BY id
`).all();

check.forEach(u => {
  console.log(`   ID ${u.id}: ${u.name} - [${u.lat}, ${u.lng}]`);
});

console.log('\n✨ БД успешно обновлена с точными координатами!');
db.close();
