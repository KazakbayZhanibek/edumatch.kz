const { getDb } = require('./database');
const db = getDb();

const rows = db.prepare(`
  SELECT u.short_name, s.name as spec_name, s.category, ar.avg_ent, ar.min_ent
  FROM admission_requirements ar
  JOIN universities u ON ar.university_id = u.id
  JOIN specialties s ON ar.specialty_id = s.id
  WHERE u.short_name IN ('КазАТУ', 'АНК', 'КарГУ', 'КНАУ', 'ПГПУ', 'ПГУ', 'ВКГТУ')
  ORDER BY u.short_name, ar.avg_ent DESC
`).all();

rows.forEach(r => console.log(r.short_name, '|', r.spec_name, '|', r.category, '| avg_ent:', r.avg_ent, '| min_ent:', r.min_ent));