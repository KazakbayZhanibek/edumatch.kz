#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Пути
const dbPath = path.join(__dirname, 'eduMatch.db');
const jsonPath = 'C:\\Users\\Janchik\\Desktop\\maps\\universities_coordinates.json';

console.log('🔄 Синхронизация университетов из JSON...\n');
console.log(`📍 БД: ${dbPath}`);
console.log(`📁 JSON: ${jsonPath}\n`);

// Читаем JSON
let jsonData = [];
try {
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  jsonData = JSON.parse(rawData);
  console.log(`✓ Загружено ${jsonData.length} университетов из JSON\n`);
} catch (err) {
  console.error(`❌ Ошибка чтения JSON: ${err.message}`);
  process.exit(1);
}

// Открываем БД
const db = new Database(dbPath);

try {
  // Получаем все университеты из БД
  const dbUnis = db.prepare('SELECT id, name FROM universities').all();
  console.log(`📊 В БД: ${dbUnis.length} университетов\n`);

  let matched = 0;
  let unmatched = [];

  // Для каждого JSON университета ищем совпадение в БД
  for (const jsonUni of jsonData) {
    // Ищем по названию (можем быть не очень строгими)
    let dbUni = dbUnis.find(u => {
      const dbName = u.name.toLowerCase().trim();
      const jsonName = jsonUni.name.toLowerCase().trim();
      // Полное совпадение или совпадение первых 20 символов
      return dbName === jsonName || dbName.startsWith(jsonName.substring(0, 20));
    });

    if (dbUni) {
      // Обновляем координаты
      db.prepare('UPDATE universities SET lat = ?, lng = ? WHERE id = ?')
        .run(jsonUni.lat, jsonUni.lng, dbUni.id);
      
      console.log(`✓ ID ${dbUni.id}: ${jsonUni.name}`);
      console.log(`  → ${jsonUni.lat}, ${jsonUni.lng}\n`);
      matched++;
    } else {
      unmatched.push({
        id: jsonUni.id,
        name: jsonUni.name,
        city: jsonUni.city,
        lat: jsonUni.lat,
        lng: jsonUni.lng
      });
    }
  }

  console.log(`\n✅ Обновлено: ${matched} университетов`);
  
  if (unmatched.length > 0) {
    console.log(`\n⚠️  Не найдено совпадений (${unmatched.length}):`);
    unmatched.forEach(uni => {
      console.log(`  - ID ${uni.id}: ${uni.name} (${uni.city})`);
    });
  }

  // Проверяем результат
  console.log('\n📍 Проверка первых 5 университетов Шымкента:');
  const shimkentCheck = db.prepare(`
    SELECT id, name, lat, lng 
    FROM universities 
    WHERE lat >= 42 AND lat <= 42.5 AND lng >= 69 AND lng <= 70
    LIMIT 5
  `).all();
  
  shimkentCheck.forEach(uni => {
    console.log(`  ${uni.id}. ${uni.name} → (${uni.lat}, ${uni.lng})`);
  });

  console.log('\n✨ Синхронизация завершена!');

} catch (err) {
  console.error(`\n❌ Ошибка при обновлении БД: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}
