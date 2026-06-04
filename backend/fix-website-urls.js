/**
 * Fix website field - replace addresses with actual URLs
 * This script updates all universities with correct website URLs
 */

const Database = require('better-sqlite3');
const db = new Database('edumatch.db');

// Mapping of university names to their correct websites
const websiteUpdates = {
  'Назарбаев Университет': 'https://www.nu.edu.kz',
  'Казахский национальный университет имени аль-Фараби': 'https://www.kaznu.kz',
  'Евразийский национальный университет имени Л.Н. Гумилева': 'https://www.enu.kz',
  'Казахский агротехнический университет имени С. Сейфуллина': 'https://www.katu.edu.kz',
  'Карагандинский государственный технический университет': 'https://www.kargtu.kz',
  'Павлодарский государственный педагогический университет': 'https://www.pgpи.edu.kz',
  'Актюбинский государственный педагогический институт': 'https://www.agpi.kz',
  'Кокшетауский государственный педагогический институт': 'https://kgpi.kz',
  'Кызылординский университет имени Коркыта Ата': 'https://www.korkyt.kz',
  'Западно-Казахстанский аграрно-технический университет имени Жангира Хана': 'https://www.zkatu.kz',
  'Университет Туран': 'https://www.turan-edu.kz',
  'КБТУ (Казахский национальный технический университет имени К.И. Сатпаева)': 'https://www.kbtu.kz',
  'Казахский государственный женский педагогический университет': 'https://www.kgzpu.kz',
  'Казахский национальный аграрный исследовательский университет': 'https://www.knau.kz',
  'Казахский национальный медицинский университет имени С.Д. Асфендиярова': 'https://www.kaznmu.kz',
  'МУИЦ': 'https://www.muir.kz',
  'Университет Бизнеса': 'https://www.ubkz.org',
  'Академия образования имени Алтынсарина': 'https://www.aao.kz',
  'Казахский национальный педагогический университет имени Абая': 'https://www.ayu.edu.kz',
};

console.log('🔄 Updating website URLs in database...\n');

let updated = 0;
let notFound = 0;

for (const [name, url] of Object.entries(websiteUpdates)) {
  try {
    const result = db.prepare('UPDATE universities SET website = ? WHERE name = ?').run(url, name);
    if (result.changes > 0) {
      console.log(`✓ Updated: ${name}`);
      console.log(`  Website: ${url}`);
      updated++;
    } else {
      console.log(`⚠️ Not found in DB: ${name}`);
      notFound++;
    }
  } catch (err) {
    console.log(`❌ Error updating ${name}: ${err.message}`);
  }
}

// Check for universities not updated (still have addresses)
const stillWithAddresses = db.prepare(`
  SELECT id, name, website 
  FROM universities 
  WHERE website LIKE 'проспект%' 
     OR website LIKE 'ул.%'
     OR website LIKE 'улица%'
`).all();

console.log('\n📋 Universities still with addresses (need manual updates):');
stillWithAddresses.forEach(u => {
  console.log(`  - ${u.name}: ${u.website.substring(0, 50)}...`);
});

console.log('\n✅ SUMMARY');
console.log(`  Updated: ${updated}`);
console.log(`  Not found: ${notFound}`);
console.log(`  Still with addresses: ${stillWithAddresses.length}`);

// Verify results
const urlCount = db.prepare("SELECT COUNT(*) as cnt FROM universities WHERE website LIKE 'http%'").get();
const addressCount = db.prepare("SELECT COUNT(*) as cnt FROM universities WHERE website LIKE 'проспект%' OR website LIKE 'ул%'").get();

console.log(`\n📊 Final state:`);
console.log(`  URLs: ${urlCount.cnt}`);
console.log(`  Addresses: ${addressCount.cnt}`);

db.close();
