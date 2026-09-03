const Database = require('better-sqlite3');
const db = new Database('./edumatch.db');

const t = db.prepare('SELECT COUNT(*) as c FROM universities').get();
const kk = db.prepare("SELECT COUNT(*) as c FROM universities WHERE description_kk IS NOT NULL AND description_kk != ''").get();
const en = db.prepare("SELECT COUNT(*) as c FROM universities WHERE description_en IS NOT NULL AND description_en != ''").get();
const noDesc = db.prepare("SELECT id, name FROM universities WHERE description IS NULL OR description = ''").all();

console.log('Total universities:', t.c);
console.log('Has KK desc:', kk.c + '/' + t.c);
console.log('Has EN desc:', en.c + '/' + t.c);
console.log('No desc at all:', noDesc.length);
noDesc.forEach(r => console.log('  ' + r.id + ': ' + (r.name || '').trim().slice(0, 50)));
db.close();
