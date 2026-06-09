const { getDb } = require('./database');
const db = getDb();

const specs = db.prepare("SELECT * FROM specialties WHERE id = 16").all();
console.log('=== SPECIALTIES (id=16) ===');
specs.forEach(s => console.log(s.id, s.name, s.category));

const reqs = db.prepare("SELECT ar.*, u.name as u_name FROM admission_requirements ar JOIN universities u ON ar.university_id = u.id WHERE ar.specialty_id = 16").all();
console.log('\n=== ADMISSION REQ for Психология (specialty_id=16) ===');
if (reqs.length === 0) console.log('  NONE!');
reqs.forEach(r => console.log(`  univ_id=${r.university_id} ${r.u_name} min_score=${r.min_score} budget=${r.budget_places}`));

const allReqs = db.prepare("SELECT ar.specialty_id, s.name, COUNT(*) as cnt FROM admission_requirements ar JOIN specialties s ON ar.specialty_id = s.id GROUP BY ar.specialty_id ORDER BY cnt DESC").all();
console.log('\n=== ALL SPECIALTIES IN admission_requirements ===');
allReqs.forEach(r => console.log(`  spec_id=${r.specialty_id} "${r.name}" — ${r.cnt} reqs`));

// Check what category the AI chat queries
console.log('\n=== Здоровье category specs ===');
const zd = db.prepare("SELECT * FROM specialties WHERE category = 'Здоровье'").all();
zd.forEach(s => console.log(`  ${s.id} ${s.name} -> category=${s.category}`));
