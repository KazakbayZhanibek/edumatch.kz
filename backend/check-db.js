const db = require('better-sqlite3')('edumatch.db');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         ПОЛНАЯ ПРОВЕРКА ВОССТАНОВЛЕНИЯ БАЗЫ ДАННЫХ           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// 1. ТАБЛИЦЫ
console.log('📋 ТАБЛИЦЫ:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(`   ✓ ${t.name}`));
console.log(`   ВСЕГО: ${tables.length} таблиц\n`);

// 2. ИНДЕКСЫ
console.log('🔍 ИНДЕКСЫ (admission_chance_stats):');
const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_admission%' ORDER BY name").all();
indices.forEach(i => console.log(`   ✓ ${i.name}`));
console.log(`   ВСЕГО: ${indices.length} индексов для statistics\n`);

// 3. ДАННЫЕ В ТАБЛИЦАХ
console.log('📊 ДАННЫЕ В ТАБЛИЦАХ:\n');

const tables_data = [
  'cities',
  'specialties', 
  'universities',
  'university_specialties',
  'admission_chance_stats',
  'users',
  'grants',
  'tips'
];

let total_records = 0;
for (const table of tables_data) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get().cnt;
    const status = count > 0 ? '✓' : '⚠️';
    console.log(`   ${status} ${table.padEnd(30)} ${String(count).padStart(6)} записей`);
    total_records += count;
  } catch (e) {
    console.log(`   ✗ ${table.padEnd(30)} ошибка`);
  }
}
console.log(`   ${'─'.repeat(50)}`);
console.log(`   ИТОГО:${' '.repeat(24)} ${total_records} записей\n`);

// 4. ДЕТАЛЬНАЯ ПРОВЕРКА admission_chance_stats
console.log('🎯 ДЕТАЛЬНАЯ ПРОВЕРКА admission_chance_stats:\n');
const stats_count = db.prepare('SELECT COUNT(*) as cnt FROM admission_chance_stats').get().cnt;
console.log(`   Всего записей: ${stats_count}`);

const stats_by_specialty = db.prepare(`
  SELECT s.name, COUNT(*) as cnt 
  FROM admission_chance_stats acs
  JOIN specialties s ON acs.specialty_id = s.id
  GROUP BY acs.specialty_id
  ORDER BY cnt DESC
`).all();
console.log(`\n   По специальностям:`);
stats_by_specialty.forEach(s => console.log(`     • ${s.name}: ${s.cnt} записей`));

const stats_sample = db.prepare(`
  SELECT 
    acs.id,
    s.name as specialty,
    u.name as university,
    c.name as city,
    acs.ent_score_from,
    acs.ent_score_to,
    acs.chance_percent,
    acs.confidence_level
  FROM admission_chance_stats acs
  LEFT JOIN specialties s ON acs.specialty_id = s.id
  LEFT JOIN universities u ON acs.university_id = u.id
  LEFT JOIN cities c ON acs.city_id = c.id
  LIMIT 5
`).all();
console.log(`\n   Примеры записей (первые 5):`);
stats_sample.forEach((r, i) => {
  const uni = r.university ? r.university.substring(0, 20) : 'NULL';
  console.log(`     ${i+1}. ${r.specialty}`);
  console.log(`        → ${uni} | ENT ${r.ent_score_from}-${r.ent_score_to} → ${r.chance_percent}% (${r.confidence_level})\n`);
});

// 5. СВЯЗИ МЕЖДУ ТАБЛИЦАМИ
console.log('🔗 СВЯЗИ МЕЖДУ ТАБЛИЦАМИ:\n');

const uni_spec = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get().cnt;
console.log(`   university_specialties: ${uni_spec} связей`);

const uni_spec_details = db.prepare(`
  SELECT s.name, COUNT(DISTINCT us.university_id) as uni_count
  FROM university_specialties us
  JOIN specialties s ON us.specialty_id = s.id
  GROUP BY us.specialty_id
  ORDER BY uni_count DESC
`).all();
uni_spec_details.forEach(u => console.log(`     • ${u.name}: ${u.uni_count} университетов`));

console.log('\n');

// 6. ИНФОРМАЦИЯ О БАЗЕ
console.log('💾 ИНФОРМАЦИЯ О БАЗЕ ДАННЫХ:\n');
try {
  const page_count = db.prepare('PRAGMA page_count').get().page_count;
  const page_size = db.prepare('PRAGMA page_size').get().page_size;
  const size_bytes = page_count * page_size;
  const size_kb = (size_bytes / 1024).toFixed(2);
  console.log(`   Размер: ${size_kb} КБ (${page_count} страниц × ${page_size} байт)`);
  
  const integrity = db.prepare('PRAGMA integrity_check').all();
  console.log(`   Проверка целостности: ${integrity[0].integrity_check}`);
} catch (e) {
  console.log(`   Ошибка при проверке`);
}

console.log('\n');

// 7. ИТОГОВЫЙ СТАТУС
console.log('✅ ИТОГОВЫЙ СТАТУС:\n');
const stats_ok = stats_count > 0 ? '✓' : '✗';
const uni_ok = db.prepare('SELECT COUNT(*) as cnt FROM universities').get().cnt > 0 ? '✓' : '✗';
const spec_ok = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get().cnt > 0 ? '✓' : '✗';
const cities_ok = db.prepare('SELECT COUNT(*) as cnt FROM cities').get().cnt > 0 ? '✓' : '✗';
const links_ok = uni_spec > 0 ? '✓' : '✗';

console.log(`   ${stats_ok} Таблица admission_chance_stats: ${stats_count} записей`);
console.log(`   ${uni_ok} Таблица universities: ${db.prepare('SELECT COUNT(*) as cnt FROM universities').get().cnt} университетов`);
console.log(`   ${spec_ok} Таблица specialties: ${db.prepare('SELECT COUNT(*) as cnt FROM specialties').get().cnt} специальностей`);
console.log(`   ${cities_ok} Таблица cities: ${db.prepare('SELECT COUNT(*) as cnt FROM cities').get().cnt} городов`);
console.log(`   ${links_ok} Связи university_specialties: ${uni_spec} связей`);

const all_ok = [stats_ok, uni_ok, spec_ok, cities_ok, links_ok].every(s => s === '✓');
console.log(`\n   ОБЩИЙ СТАТУС: ${all_ok ? '🟢 ВСЕ ДАННЫЕ ВОССТАНОВЛЕНЫ' : '⚠️ ЕСТЬ ПРОБЛЕМЫ'}`);

console.log('\n╚════════════════════════════════════════════════════════════════╝\n');
