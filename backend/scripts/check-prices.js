const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

const ids = [108,110,111,125,124,126,136,137,141,143,146,147];
for (const id of ids) {
  const r = db.prepare('SELECT id, name, price_from FROM universities WHERE id = ?').get(id);
  console.log(`${r.id}: price=${r.price_from} — ${r.name.trim().slice(0,50)}`);
}

db.close();
