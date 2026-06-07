const sqlite3 = require('better-sqlite3');
const db = sqlite3('./backend/edumatch.db');
const rows = db.prepare("SELECT u.short_name, s.name FROM specialties s JOIN universities u ON s.university_id = u.id WHERE u.short_name LIKE '%КБТУ%'").all();
console.log('KBTU specialties:', rows.length);
rows.forEach(r => console.log(' -', r.short_name, ':', r.name));
const unis = db.prepare("SELECT id, short_name FROM universities WHERE short_name LIKE '%КБТУ%'").all();
console.log('\nKBTU universities:', JSON.stringify(unis));
db.close();
