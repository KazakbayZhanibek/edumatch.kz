const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'eduMatch.db'));

// Правильные координаты центров городов Казахстана
const cityCoordinates = {
  'Нур-Султан (Астана)': { lat: 51.1694, lng: 71.4491 },
  'Алматы': { lat: 43.2380, lng: 76.9453 },
  'Шымкент': { lat: 42.3019, lng: 69.5897 },
  'Караганда': { lat: 49.8047, lng: 73.1033 },
  'Семей': { lat: 50.4206, lng: 80.2500 },
  'Актобе': { lat: 50.2840, lng: 57.1700 },
  'Атырау': { lat: 43.6524, lng: 51.3717 },
  'Костанай': { lat: 53.2140, lng: 63.6250 },
  'Павлодар': { lat: 52.2835, lng: 76.9450 },
  'Тараз': { lat: 42.9019, lng: 71.3722 },
  'Уральск': { lat: 51.2094, lng: 51.3697 },
  'Астана': { lat: 51.1694, lng: 71.4491 },
  'Акмола': { lat: 51.2500, lng: 70.1667 },
  'Темиртау': { lat: 50.0333, lng: 72.9667 },
  'Усть-Каменогорск': { lat: 49.9711, lng: 82.6122 },
  'Кызылорда': { lat: 44.8389, lng: 65.4750 },
  'Актау': { lat: 43.6516, lng: 51.2007 },
  'Петропавловск': { lat: 54.8707, lng: 69.1958 },
  'Каскелен': { lat: 43.1722, lng: 77.0889 },
  'Актюбе': { lat: 50.2840, lng: 57.1700 },
  'Кокшетау': { lat: 53.2883, lng: 69.3969 },
  'Жезказган': { lat: 47.7997, lng: 67.7197 }
};

const updateStmt = db.prepare('UPDATE cities SET center_lat = ?, center_lng = ? WHERE name = ?');

let updated = 0;
let errors = [];

Object.entries(cityCoordinates).forEach(([cityName, coords]) => {
  try {
    const result = updateStmt.run(coords.lat, coords.lng, cityName);
    if (result.changes > 0) {
      updated++;
      console.log(`✓ ${cityName.padEnd(30)} → (${coords.lat}, ${coords.lng})`);
    } else {
      errors.push(`${cityName}: город не найден в БД`);
    }
  } catch (e) {
    errors.push(`${cityName}: ${e.message}`);
  }
});

if (errors.length > 0) {
  console.error('\n⚠️ Ошибки:');
  errors.forEach(err => console.error(`  ${err}`));
}

console.log(`\n✅ Обновлено ${updated} городов`);

// Проверим результаты
const check = db.prepare('SELECT name, center_lat, center_lng FROM cities WHERE center_lat IS NOT NULL ORDER BY name').all();
console.log(`\n📍 Города с координатами (${check.length}):`);
check.forEach(c => {
  console.log(`  ${c.name.padEnd(30)} (${c.center_lat}, ${c.center_lng})`);
});

db.close();
