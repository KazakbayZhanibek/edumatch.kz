const fs = require('fs');
const data = JSON.parse(fs.readFileSync('all_universities.json', 'utf8'));

console.log('🔍 ОРИГИНАЛЬНЫЕ ДАННЫЕ - all_universities.json\n');

// Все университеты Шымкента
const shimkent = data.universities.filter(u => u.city_id === 3 || u.name.toLowerCase().includes('шымкент'));

console.log(`Университеты Шымкента (всего: ${shimkent.length}):\n`);
shimkent.forEach((u, i) => {
  console.log(`${i + 1}. ${u.name}`);
  console.log(`   ID: ${u.id}, City ID: ${u.city_id}`);
  console.log();
});

// Статистика по городам
console.log('\n📊 Статистика по городам:');
const cities = {};
data.universities.forEach(u => {
  const city = u.city_id;
  if (!cities[city]) cities[city] = 0;
  cities[city]++;
});

Object.keys(cities).sort((a,b) => cities[b] - cities[a]).forEach(city => {
  console.log(`  City ID ${city}: ${cities[city]} университетов`);
});
