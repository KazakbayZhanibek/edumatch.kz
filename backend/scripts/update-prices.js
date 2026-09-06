const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const prices = JSON.parse(fs.readFileSync(path.join(__dirname, 'unis-prices.json'), 'utf8'));

const update = db.prepare(`
  UPDATE universities SET
    price_from = @price_from,
    price_to = @price_to,
    last_updated_at = datetime('now')
  WHERE id = @id
`);

let updated = 0;
for (const [id, data] of Object.entries(prices)) {
  const uid = parseInt(id);
  if (data.price_from > 0) {
    update.run({ id: uid, price_from: data.price_from, price_to: data.price_to });
    const name = db.prepare('SELECT name FROM universities WHERE id = ?').get(uid)?.name?.trim()?.slice(0, 45);
    console.log(`  ✓ ${uid}: ${name} [${data.price_from.toLocaleString()} - ${data.price_to.toLocaleString()} тг]`);
    updated++;
  }
}

console.log(`\nUpdated ${updated} universities with prices`);
db.close();
