/**
 * Add specialties for remaining 9 universities
 * Педагогические и медицинские вузы - добавляем IT и Бизнес
 */
const db = require('better-sqlite3')('edumatch.db');

const universities = [
  'ПГПУ', 'СГМУ', 'КНПУим.Абая', 'КГЖПУ', 'КГЛТИ', 
  'КГМУ', 'КазНМУ', 'АГПИ', 'КГПИ'
];

const insertStmt = db.prepare('INSERT OR IGNORE INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');

for (const shortName of universities) {
  const uni = db.prepare('SELECT id FROM universities WHERE short_name = ?').get(shortName);
  if (!uni) {
    console.log(`⚠ Вуз не найден: ${shortName}`);
    continue;
  }

  // Добавляем IT и Бизнес
  insertStmt.run(uni.id, 1); // IT
  insertStmt.run(uni.id, 3); // Бизнес
  console.log(`✓ ${shortName}: добавлены IT и Бизнес`);
}

console.log('\n=== ИТОГОВАЯ СТАТИСТИКА ===');
const stats = db.prepare(`
  SELECT 
    s.name,
    COUNT(DISTINCT us.university_id) as count
  FROM university_specialties us
  JOIN specialties s ON us.specialty_id = s.id
  GROUP BY us.specialty_id
  ORDER BY count DESC
`).all();

for (const stat of stats) {
  console.log(`${stat.name}: ${stat.count} вузов`);
}

const total = db.prepare('SELECT COUNT(DISTINCT university_id) FROM university_specialties').get();
console.log(`\nВсего вузов с любой специальностью: ${total['COUNT(DISTINCT university_id)']}/44`);
