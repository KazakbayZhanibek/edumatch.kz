const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'eduMatch.db'));

// Получаем все города
const cities = db.prepare('SELECT * FROM cities ORDER BY name').all();

console.log('═══════════════════════════════════════════════════════════');
console.log('ПРОВЕРКА ВСЕХ ГОРОДОВ И УНИВЕРСИТЕТОВ');
console.log('═══════════════════════════════════════════════════════════\n');

cities.forEach(city => {
  // Получаем университеты в этом городе
  const unis = db.prepare(`
    SELECT id, short_name, name, lat, lng 
    FROM universities 
    WHERE city_id = ? 
    ORDER BY short_name
  `).all(city.id);

  console.log(`\n📍 ГОРОД: ${city.name} (ID: ${city.id})`);
  console.log(`   Центр города: (${city.center_lat}, ${city.center_lng})`);
  console.log(`   Вузов: ${unis.length}`);
  console.log('   ─────────────────────────────────────────');

  if (unis.length === 0) {
    console.log('   ⚠️  Нет университетов!');
  } else {
    // Проверяем, все ли университеты в правильном регионе
    let inRegion = 0;
    let outRegion = [];

    unis.forEach(u => {
      // Проверяем, примерно ли координаты находятся в городе (в пределах ~1-2 градусов)
      const latDiff = Math.abs(u.lat - city.center_lat);
      const lngDiff = Math.abs(u.lng - city.center_lng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      if (distance < 2) {
        inRegion++;
        console.log(`   ✓ ${u.short_name.padEnd(15)} (${u.lat}, ${u.lng})`);
      } else {
        outRegion.push({
          short_name: u.short_name,
          lat: u.lat,
          lng: u.lng,
          distance: distance.toFixed(2)
        });
      }
    });

    if (outRegion.length > 0) {
      console.log(`\n   ⚠️  ${outRegion.length} вузов находятся вне региона города:`);
      outRegion.forEach(u => {
        console.log(`      ✗ ${u.short_name.padEnd(15)} (${u.lat}, ${u.lng}) - расстояние: ${u.distance}°`);
      });
    }

    console.log(`\n   Результат: ${inRegion}/${unis.length} вузов в правильном месте`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('ПРОВЕРКА ЗАВЕРШЕНА');
console.log('═══════════════════════════════════════════════════════════\n');

db.close();
