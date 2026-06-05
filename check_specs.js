const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, 'edumatch.db');

console.log('DB path:', dbPath);
console.log('DB exists:', fs.existsSync(dbPath));
console.log('DB size:', fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0);

try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables count:', tables.length);
  console.log('Tables:', JSON.stringify(tables));
  
  if (tables.length > 0) {
    tables.forEach(t => {
      try {
        const cnt = db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get();
        console.log(`  ${t.name}: ${cnt.c} rows`);
      } catch(e2) {
        console.log(`  ${t.name}: error - ${e2.message}`);
      }
    });
  }
  db.close();
} catch(e) {
  console.error('Error opening DB:', e.message);
}
