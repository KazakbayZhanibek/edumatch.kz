#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Пути
const dbPath = path.join(__dirname, 'eduMatch.db');
const jsonPath = 'C:\\Users\\Janchik\\Desktop\\maps\\universities_coordinates.json';

console.log('🔄 Пересоздание БД из JSON...\n');

// Читаем JSON
let jsonData = [];
try {
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  jsonData = JSON.parse(rawData);
  console.log(`✓ Загружено ${jsonData.length} университетов из JSON`);
} catch (err) {
  console.error(`❌ Ошибка чтения JSON: ${err.message}`);
  process.exit(1);
}

// Открываем БД
const db = new Database(dbPath);

try {
  // Отключаем проверку внешних ключей
  db.pragma('foreign_keys = OFF');
  
  // Создаём новую таблицу
  db.exec(`
    DROP TABLE IF EXISTS universities_new;
    CREATE TABLE universities_new (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      city_id INTEGER,
      lat REAL,
      lng REAL,
      qs_world INTEGER,
      price_from REAL,
      price_to REAL,
      is_top INTEGER DEFAULT 0,
      website TEXT,
      founded INTEGER
    );
  `);

  // Вставляем данные из JSON
  const stmt = db.prepare(`
    INSERT INTO universities_new (id, name, short_name, lat, lng)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const uni of jsonData) {
    stmt.run(uni.id, uni.name, uni.short_name, uni.lat, uni.lng);
  }

  console.log(`✓ Вставлено ${jsonData.length} университетов\n`);

  // Удаляем старую таблицу и переименовываем новую
  db.exec(`
    DROP TABLE universities;
    ALTER TABLE universities_new RENAME TO universities;
  `);

  console.log('✓ Таблица заменена\n');

  // Проверяем результат
  console.log('📍 Проверка координат Шымкента:');
  const shimkent = db.prepare(`
    SELECT id, name, short_name, lat, lng
    FROM universities
    WHERE lat >= 42 AND lat <= 42.5 AND lng >= 69 AND lng <= 70
    ORDER BY id
  `).all();

  console.log(`\nНайдено ${shimkent.length} университетов Шымкента:\n`);
  shimkent.forEach(uni => {
    console.log(`  ✓ ID ${uni.id}: ${uni.short_name}`);
    console.log(`    ${uni.name}`);
    console.log(`    Координаты: (${uni.lat}, ${uni.lng})\n`);
  });

  console.log('✅ Проверка первых 5 университетов:');
  const first5 = db.prepare('SELECT id, name, short_name, lat, lng FROM universities LIMIT 5').all();
  first5.forEach(uni => {
    console.log(`  ${uni.id}. ${uni.short_name} (${uni.lat}, ${uni.lng})`);
  });

  console.log('\n✨ Пересоздание БД завершено!');

} catch (err) {
  console.error(`\n❌ Ошибка: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}
