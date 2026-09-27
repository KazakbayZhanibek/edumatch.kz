const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'unis-full-data.json'), 'utf8'));

let updated = 0;
for (const [id, d] of Object.entries(data)) {
  const uid = parseInt(id);
  const sets = [];
  const params = { id: uid };

  if (d.website !== undefined && d.website) { sets.push('website = @website'); params.website = d.website; }
  if (d.phone !== undefined && d.phone) { sets.push('admission_phone = @phone'); params.phone = d.phone; }
  if (d.students_count !== undefined && d.students_count) { sets.push('students_count = @students_count'); params.students_count = d.students_count; }
  if (d.founded !== undefined && d.founded) { sets.push('founded = @founded'); params.founded = d.founded; }
  if (d.lat !== undefined && d.lat) { sets.push('lat = @lat'); params.lat = d.lat; }
  if (d.lng !== undefined && d.lng) { sets.push('lng = @lng'); params.lng = d.lng; }
  if (d.has_dorm !== undefined) { sets.push('has_dorm = @has_dorm'); params.has_dorm = d.has_dorm; }
  if (d.price_from !== undefined && d.price_from === 0) { sets.push('price_from = 0'); }

  if (sets.length > 0) {
    sets.push("last_updated_at = datetime('now')");
    const sql = `UPDATE universities SET ${sets.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(params);
    updated++;
    const name = db.prepare('SELECT name FROM universities WHERE id = ?').get(uid)?.name?.trim()?.slice(0, 45);
    const fields = [];
    if (d.website) fields.push('web');
    if (d.phone) fields.push('phone');
    if (d.students_count) fields.push(d.students_count + ' students');
    if (d.founded) fields.push('est ' + d.founded);
    if (d.lat) fields.push('coords');
    if (d.has_dorm !== undefined) fields.push('dorm:' + d.has_dorm);
    if (d.price_from === 0) fields.push('price:0');
    console.log(`  ${uid}: ${name} [${fields.join(', ')}]`);
  }
}

console.log(`\nUpdated ${updated} universities`);
db.close();
