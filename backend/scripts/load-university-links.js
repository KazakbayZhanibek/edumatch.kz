#!/usr/bin/env node
/**
 * Load university links and website data
 * Загружает официальные веб-сайты для всех 44 университетов
 */

const fs = require('fs');
const readline = require('readline');
const Database = require('better-sqlite3');
const db = new Database('edumatch.db');

console.log('🌐 Loading university official websites...\n');

const fileStream = fs.createReadStream('universities_links_all_now_visible.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let updated = 0;
let skipped = 0;

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    
    // Обновляем веб-сайт если есть
    if (data.official_website) {
      const result = db.prepare(`
        UPDATE universities 
        SET website = ?
        WHERE id = ?
      `).run(data.official_website, data.id);
      
      if (result.changes > 0) {
        console.log(`✓ ${data.name}`);
        console.log(`  🌐 ${data.official_website}\n`);
        updated++;
      } else {
        skipped++;
      }
    } else {
      console.log(`⊘ ${data.name} (нет веб-сайта)\n`);
      skipped++;
    }
  } catch (err) {
    console.error(`❌ Error parsing line:`, err.message);
  }
});

rl.on('close', () => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as with_website
    FROM universities
  `).get();

  console.log('\n' + '═'.repeat(60));
  console.log('✅ ЗАВЕРШЕНО\n');
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Пропущено: ${skipped}`);
  console.log(`\n📊 Итого в БД:`);
  console.log(`   Всего: ${stats.total}`);
  console.log(`   С веб-сайтом: ${stats.with_website}/${stats.total} (${((stats.with_website/stats.total)*100).toFixed(1)}%)`);
});
