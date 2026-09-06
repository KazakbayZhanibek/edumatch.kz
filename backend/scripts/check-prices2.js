const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

// IDs that had prices from batch4 (from unis-prices.json)
const hadPrices = {
  100: 836000, 101: 0, 105: 0, 106: 0, 108: 680000,
  110: 450000, 113: 0, 117: 0, 119: 0, 121: 0,
  125: 680000, 127: 0, 131: 0, 133: 0, 135: 0,
  149: 0, 153: 0, 154: 0, 158: 0, 160: 0
};

console.log('=== Checking batch4 price IDs ===');
for (const [id, origPrice] of Object.entries(hadPrices)) {
  const r = db.prepare('SELECT id, name, price_from FROM universities WHERE id = ?').get(parseInt(id));
  const current = r.price_from;
  const match = current === origPrice ? 'OK' : `OVERWRITTEN (was ${origPrice})`;
  console.log(`  ${id}: price=${current} — ${match} — ${r.name.trim().slice(0,40)}`);
}

db.close();
