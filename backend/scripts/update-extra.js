const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'unis-data-extra.json'), 'utf8'));

const update = db.prepare(`
  UPDATE universities SET
    website = COALESCE(@website, website),
    admission_phone = COALESCE(@phone, admission_phone),
    students_count = COALESCE(@students_count, students_count),
    founded = COALESCE(@founded, founded),
    lat = COALESCE(@lat, lat),
    lng = COALESCE(@lng, lng),
    last_updated_at = datetime('now')
  WHERE id = @id
`);

let updated = 0;
for (const [id, d] of Object.entries(data)) {
  const uid = parseInt(id);
  const hasData = d.website || d.phone || d.students_count || d.founded || d.lat;
  if (hasData) {
    update.run({ id: uid, ...d });
    const name = db.prepare('SELECT name FROM universities WHERE id = ?').get(uid)?.name?.trim()?.slice(0, 45);
    const fields = [];
    if (d.website) fields.push('web');
    if (d.phone) fields.push('phone');
    if (d.students_count) fields.push(`${d.students_count} students`);
    if (d.founded) fields.push(`est ${d.founded}`);
    if (d.lat) fields.push('coords');
    console.log(`  ✓ ${uid}: ${name} [${fields.join(', ')}]`);
    updated++;
  }
}

console.log(`\nUpdated ${updated} universities`);
db.close();
