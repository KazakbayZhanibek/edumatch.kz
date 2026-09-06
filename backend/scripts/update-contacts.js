const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const contacts = JSON.parse(fs.readFileSync(path.join(__dirname, 'unis-contacts.json'), 'utf8'));

const update = db.prepare(`
  UPDATE universities SET
    website = COALESCE(@website, website),
    admission_phone = COALESCE(@phone, admission_phone),
    last_updated_at = datetime('now')
  WHERE id = @id
`);

let updated = 0;
for (const [id, data] of Object.entries(contacts)) {
  const uid = parseInt(id);
  if (data.website || data.phone) {
    update.run({ id: uid, website: data.website, phone: data.phone });
    const name = db.prepare('SELECT name FROM universities WHERE id = ?').get(uid)?.name?.trim()?.slice(0, 45);
    console.log(`  ✓ ${uid}: ${name} [web: ${data.website || '—'}, phone: ${data.phone || '—'}]`);
    updated++;
  }
}

console.log(`\nUpdated ${updated} universities with contacts`);
db.close();
