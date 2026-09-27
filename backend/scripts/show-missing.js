const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

console.log('=== Missing Students ===');
db.prepare("SELECT id, name FROM universities WHERE students_count IS NULL OR students_count = 0").all()
  .forEach(r => console.log(`  ${r.id}: ${r.name.trim().slice(0, 60)}`));

console.log('\n=== Missing Founded ===');
db.prepare("SELECT id, name FROM universities WHERE founded IS NULL OR founded = 0").all()
  .forEach(r => console.log(`  ${r.id}: ${r.name.trim().slice(0, 60)}`));

console.log('\n=== Missing Website ===');
db.prepare("SELECT id, name FROM universities WHERE website IS NULL OR website = ''").all()
  .forEach(r => console.log(`  ${r.id}: ${r.name.trim().slice(0, 60)}`));

console.log('\n=== Price = 0 (military/free) ===');
db.prepare("SELECT id, name FROM universities WHERE price_from = 0").all()
  .forEach(r => console.log(`  ${r.id}: ${r.name.trim().slice(0, 60)}`));

db.close();
