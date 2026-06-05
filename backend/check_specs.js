const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, 'edumatch.db');

console.log('DB path:', dbPath);
console.log('DB exists:', fs.existsSync(dbPath));
console.log('DB size:', fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0);

try {
  const db = new Database(dbPath);
  var d1 = db.prepare('SELECT COUNT(*) AS c FROM specialties').get();
  console.log('Total specialties rows:', d1.c);
  var d2 = db.prepare('SELECT COUNT(DISTINCT name) AS c FROM specialties').get();
  console.log('Distinct names:', d2.c);
  var d3 = db.prepare('SELECT COUNT(DISTINCT category) AS c FROM specialties').get();
  console.log('Distinct categories:', d3.c);
  var specs = db.prepare('SELECT id, name, category FROM specialties ORDER BY id').all();
  console.log('Specialties:', JSON.stringify(specs, null, 2));
  db.close();
} catch(e) {
  console.error('Error:', e.message);
}
