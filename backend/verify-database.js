#!/usr/bin/env node
/**
 * Universal Database Verification Script
 * Проверяет целостность и полноту всех данных в БД
 */

const Database = require('better-sqlite3');
const db = new Database('edumatch.db');

console.log('📊 EduMatch KZ Database Verification\n');
console.log('═'.repeat(60) + '\n');

// Цвета для терминала
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Утилиты
const check = (condition) => condition ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
const status = (val, total) => {
  const pct = ((val / total) * 100).toFixed(1);
  return `${val}/${total} (${pct}%)`;
};

let issues = [];

// 1. ТАБЛИЦЫ
console.log(`${BOLD}1. ТАБЛИЦЫ${RESET}`);
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

console.log(`   ${check(tables.length > 0)} Всего таблиц: ${tables.length}`);
tables.forEach(t => console.log(`      - ${t.name}`));

// 2. УНИВЕРСИТЕТЫ
console.log(`\n${BOLD}2. УНИВЕРСИТЕТЫ${RESET}`);
const uniStats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN admission_phone IS NOT NULL THEN 1 END) as with_phone,
    COUNT(CASE WHEN admission_email IS NOT NULL THEN 1 END) as with_email,
    COUNT(CASE WHEN admission_whatsapp IS NOT NULL THEN 1 END) as with_whatsapp,
    COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as with_website,
    COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description
  FROM universities
`).get();

console.log(`   ${check(uniStats.total === 44)} Всего: ${uniStats.total}`);
console.log(`   ${check(uniStats.with_phone === 44)} Телефоны: ${status(uniStats.with_phone, uniStats.total)}`);
console.log(`   ${check(uniStats.with_email === 44)} Email: ${status(uniStats.with_email, uniStats.total)}`);
console.log(`   ${check(uniStats.with_whatsapp === 44)} WhatsApp: ${status(uniStats.with_whatsapp, uniStats.total)}`);
console.log(`   ${check(uniStats.with_website > 0)} Вебсайты: ${status(uniStats.with_website, uniStats.total)}`);
console.log(`   ${check(uniStats.with_description === 44)} Описания: ${status(uniStats.with_description, uniStats.total)}`);

if (uniStats.with_phone < 44) issues.push(`${44 - uniStats.with_phone} университетов без телефона`);
if (uniStats.with_email < 44) issues.push(`${44 - uniStats.with_email} университетов без email`);
if (uniStats.with_description < 44) issues.push(`${44 - uniStats.with_description} университетов без описания`);

// 3. СПЕЦИАЛЬНОСТИ
console.log(`\n${BOLD}3. СПЕЦИАЛЬНОСТИ${RESET}`);
const specStats = db.prepare(`
  SELECT COUNT(*) as total FROM specialties
`).get();
console.log(`   ${check(specStats.total > 0)} Всего: ${specStats.total}`);

const specs = db.prepare(`
  SELECT id, name FROM specialties
`).all();
specs.forEach(s => console.log(`      - ${s.name}`));

// 4. ГОРОДА
console.log(`\n${BOLD}4. ГОРОДА${RESET}`);
const cityStats = db.prepare(`
  SELECT COUNT(*) as total FROM cities
`).get();
console.log(`   ${check(cityStats.total > 0)} Всего: ${cityStats.total}`);

// 5. СВЯЗИ УНИВЕРСИТЕТ-СПЕЦИАЛЬНОСТЬ
console.log(`\n${BOLD}5. СВЯЗИ УНИВЕРСИТЕТ-СПЕЦИАЛЬНОСТЬ${RESET}`);
const linkStats = db.prepare(`
  SELECT COUNT(*) as total FROM university_specialties
`).get();
console.log(`   ${check(linkStats.total > 0)} Всего связей: ${linkStats.total}`);

const orphanUnis = db.prepare(`
  SELECT COUNT(*) as count FROM universities u
  WHERE NOT EXISTS (SELECT 1 FROM university_specialties us WHERE us.university_id = u.id)
`).get();
if (orphanUnis.count > 0) {
  issues.push(`${orphanUnis.count} университетов без специальностей`);
  console.log(`   ${RED}✗${RESET} Университеты без специальностей: ${orphanUnis.count}`);
} else {
  console.log(`   ${GREEN}✓${RESET} Все университеты имеют специальности`);
}

// 6. СТАТИСТИКА ПОСТУПЛЕНИЯ
console.log(`\n${BOLD}6. СТАТИСТИКА ПОСТУПЛЕНИЯ${RESET}`);
const statsCount = db.prepare(`
  SELECT COUNT(*) as total FROM admission_chance_stats
`).get();
console.log(`   ${check(statsCount.total > 0)} Записей статистики: ${statsCount.total}`);

const statsYear = db.prepare(`
  SELECT DISTINCT year FROM admission_chance_stats ORDER BY year DESC
`).all();
if (statsYear.length > 0) {
  console.log(`   Годы: ${statsYear.map(y => y.year).join(', ')}`);
}

// 7. ПОЛЬЗОВАТЕЛИ И АУТЕНТИФИКАЦИЯ
console.log(`\n${BOLD}7. ПОЛЬЗОВАТЕЛИ И АУТЕНТИФИКАЦИЯ${RESET}`);
const userStats = db.prepare(`
  SELECT COUNT(*) as total FROM users
`).get();
console.log(`   Зарегистрировано: ${userStats.total}`);

// 8. ИНДЕКСЫ
console.log(`\n${BOLD}8. ИНДЕКСЫ${RESET}`);
const indices = db.prepare(`
  SELECT COUNT(*) as count FROM sqlite_master 
  WHERE type='index' AND name NOT LIKE 'sqlite_%'
`).get();
console.log(`   ${check(indices.count > 0)} Всего индексов: ${indices.count}`);

// 9. ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ
console.log(`\n${BOLD}9. ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ${RESET}`);

// Проверка целостности БД
try {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity.integrity_check === 'ok') {
    console.log(`   ${GREEN}✓${RESET} Целостность БД: OK`);
  } else {
    console.log(`   ${RED}✗${RESET} Целостность БД: ${integrity.integrity_check}`);
    issues.push('Проблемы с целостностью БД');
  }
} catch (e) {
  console.log(`   ${YELLOW}?${RESET} Не удается проверить целостность`);
}

// Размер БД
const dbStats = require('fs').statSync('edumatch.db');
const sizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
console.log(`   ${BOLD}Размер БД:${RESET} ${sizeMB} MB`);

// ИТОГИ
console.log('\n' + '═'.repeat(60));
console.log(`${BOLD}ИТОГИ${RESET}\n`);

if (issues.length === 0) {
  console.log(`${GREEN}✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ${RESET}`);
  console.log(`   БД полностью готова к использованию\n`);
} else {
  console.log(`${YELLOW}⚠ НАЙДЕНЫ ПРОБЛЕМЫ:${RESET}\n`);
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  console.log();
}

// Примеры данных
console.log(`${BOLD}ПРИМЕРЫ ДАННЫХ${RESET}\n`);

const sampleUnis = db.prepare(`
  SELECT name, admission_phone, admission_email FROM universities LIMIT 3
`).all();
console.log('Первые 3 университета:');
sampleUnis.forEach(u => {
  console.log(`   • ${u.name}`);
  console.log(`     ☎️  ${u.admission_phone}`);
  console.log(`     📧 ${u.admission_email}\n`);
});

process.exit(issues.length > 0 ? 1 : 0);
