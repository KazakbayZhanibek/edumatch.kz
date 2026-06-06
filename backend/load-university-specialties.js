/**
 * Load university-specialty links from universities_full.json
 */
const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');

// Маппинг специальностей из JSON на ID в БД
const specialtyMap = {
  'IT': 1,
  'Информационные технологии': 1,
  'Computer Science': 1,
  'Computer Engineering': 1,
  'Electrical and Computer Engineering': 1,
  'Information Technology': 1,
  
  'Медицина': 2,
  'Medicine': 2,
  'Health Sciences': 2,
  'Clinical Medicine': 2,
  
  'Бизнес': 3,
  'Экономика': 3,
  'Economics': 3,
  'Finance': 3,
  'Business': 3,
  'Business Administration': 3,
  'Management': 3,
};

// Читаем JSON
const data = JSON.parse(fs.readFileSync('../universities_full(1).json', 'utf-8'));

// Очищаем таблицу
db.prepare('DELETE FROM university_specialties').run();

let inserted = 0;
let skipped = 0;
const processed = new Set(); // для дедупликации

// Для каждого вуза
for (const uni of data) {
  // Ищем вуз в БД по имени
  const dbUni = db.prepare('SELECT id FROM universities WHERE name = ? OR short_name = ?')
    .get(uni.name, uni.short_name);
  
  if (!dbUni) {
    console.log(`⚠ Вуз не найден: ${uni.short_name || uni.name}`);
    skipped++;
    continue;
  }

  // Собираем все специальности для этого вуза
  const specialties = new Set();
  if (uni.faculties) {
    for (const faculty of uni.faculties) {
      if (faculty.specialties && Array.isArray(faculty.specialties)) {
        for (const spec of faculty.specialties) {
          specialties.add(spec.trim());
        }
      }
    }
  }

  // Вставляем связи
  const insertStmt = db.prepare('INSERT INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
  
  for (const spec of specialties) {
    const specId = specialtyMap[spec];
    if (!specId) {
      // Пропускаем неизвестные специальности (Инженерия, Право, Гуманитарные и т.д.)
      continue;
    }
    
    // Дедупликация
    const key = `${dbUni.id}_${specId}`;
    if (processed.has(key)) {
      continue;
    }
    processed.add(key);

    try {
      insertStmt.run(dbUni.id, specId);
      inserted++;
    } catch (err) {
      // Может быть дупликат - игнорируем
    }
  }
}

console.log(`\n✓ Загружено: ${inserted} связей вуз-специальность`);
console.log(`⚠ Пропущено: ${skipped} вузов`);

// Проверим результат
console.log('\n=== СТАТИСТИКА ===');
const stats = db.prepare(`
  SELECT 
    s.name,
    COUNT(*) as count
  FROM university_specialties us
  JOIN specialties s ON us.specialty_id = s.id
  GROUP BY us.specialty_id
  ORDER BY count DESC
`).all();

for (const stat of stats) {
  console.log(`${stat.name}: ${stat.count} вузов`);
}
