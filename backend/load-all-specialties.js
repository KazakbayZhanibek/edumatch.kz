/**
 * Load ALL specialties from universities JSON into database
 * Replaces existing 3 specialties with complete list
 */
const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');
const path = require('path');

// Читаем JSON
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../universities_full(1).json'), 'utf-8'));

// Собираем все специальности
const specs = new Map(); // name -> category
for (const uni of data) {
  if (uni.faculties) {
    for (const fac of uni.faculties) {
      if (fac.specialties && Array.isArray(fac.specialties)) {
        for (const sp of fac.specialties) {
          if (!specs.has(sp)) {
            specs.set(sp, sp); // используем название как категорию
          }
        }
      }
    }
  }
}

console.log(`\n📊 Найдено ${specs.size} уникальных специальностей\n`);

// Очищаем старые специальности
const oldSpecs = db.prepare('SELECT * FROM specialties').all();
console.log(`🗑️ Удаляю ${oldSpecs.length} старых специальностей...`);
db.prepare('DELETE FROM university_specialties').run();
db.prepare('DELETE FROM specialties').run();

// Вставляем новые специальности с auto-increment ID
const insertSpec = db.prepare('INSERT INTO specialties (name, category) VALUES (?, ?)');
const specIdMap = {}; // Маппинг: название -> новый ID

let specId = 1;
const specList = Array.from(specs.keys()).sort();
for (const name of specList) {
  insertSpec.run(name, name);
  specIdMap[name] = specId;
  console.log(`  ${specId}. ${name}`);
  specId++;
}

console.log(`\n✓ Загружено ${specs.size} специальностей\n`);

// Теперь загружаем связи университет-специальность
const insertLink = db.prepare('INSERT OR IGNORE INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
let linkCount = 0;

for (const uni of data) {
  // Ищем университет по названию
  const dbUni = db.prepare('SELECT id FROM universities WHERE name = ? OR short_name = ?')
    .get(uni.name, uni.short_name);
  
  if (!dbUni) {
    console.log(`⚠️ Вуз не найден: ${uni.short_name || uni.name}`);
    continue;
  }

  // Собираем специальности для этого вуза
  const uniSpecs = new Set();
  if (uni.faculties) {
    for (const fac of uni.faculties) {
      if (fac.specialties && Array.isArray(fac.specialties)) {
        for (const sp of fac.specialties) {
          uniSpecs.add(sp);
        }
      }
    }
  }

  // Вставляем связи
  for (const spec of uniSpecs) {
    const specNewId = specIdMap[spec];
    if (specNewId) {
      insertLink.run(dbUni.id, specNewId);
      linkCount++;
    }
  }
}

console.log(`✓ Загружено ${linkCount} связей университет-специальность\n`);

// Статистика
console.log('='.repeat(50));
console.log('ИТОГОВАЯ СТАТИСТИКА ПО СПЕЦИАЛЬНОСТЯМ:');
console.log('='.repeat(50));

const stats = db.prepare(`
  SELECT 
    s.name,
    COUNT(DISTINCT us.university_id) as uni_count,
    (SELECT COUNT(*) FROM specialties) as total_specs
  FROM university_specialties us
  JOIN specialties s ON us.specialty_id = s.id
  GROUP BY us.specialty_id
  ORDER BY uni_count DESC
`).all();

for (const stat of stats) {
  const percent = Math.round((stat.uni_count / 44) * 100);
  console.log(`${stat.name.padEnd(20)} ${stat.uni_count.toString().padStart(2)} вузов (${percent}%)`);
}

const total = db.prepare('SELECT COUNT(DISTINCT university_id) FROM university_specialties').get();
console.log('='.repeat(50));
console.log(`✅ Всего вузов со специальностями: ${total['COUNT(DISTINCT university_id)']}/44`);
