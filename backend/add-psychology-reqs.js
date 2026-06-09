const db = require('better-sqlite3')('C:/Users/Janchik/Desktop/edumatch-kz/backend/edumatch.db');

// Психология (id=16) — добавляем требования для основных вузов
const psychReqs = [
  // КазНУ (2)
  { university_id: 2, min_ent: 85, avg_ent: 100, grant_min_ent: 115, competition_level: 3 },
  // ЕНУ (3)
  { university_id: 3, min_ent: 80, avg_ent: 95, grant_min_ent: 110, competition_level: 3 },
  // Туран (22)
  { university_id: 22, min_ent: 70, avg_ent: 85, grant_min_ent: 100, competition_level: 2 },
  // КазНУ им. Абая (19)
  { university_id: 19, min_ent: 75, avg_ent: 90, grant_min_ent: 105, competition_level: 2 },
  // ПГПУ (9)
  { university_id: 9, min_ent: 65, avg_ent: 80, grant_min_ent: 95, competition_level: 2 },
  // КарГУ (7)
  { university_id: 7, min_ent: 65, avg_ent: 80, grant_min_ent: 95, competition_level: 2 },
  // ЮКГУ (13)
  { university_id: 13, min_ent: 60, avg_ent: 75, grant_min_ent: 90, competition_level: 2 },
  // КГПИ (40)
  { university_id: 40, min_ent: 60, avg_ent: 75, grant_min_ent: 90, competition_level: 2 },
  // СКГУ (18)
  { university_id: 18, min_ent: 60, avg_ent: 75, grant_min_ent: 90, competition_level: 2 },
  // МГУ (15)
  { university_id: 15, min_ent: 55, avg_ent: 70, grant_min_ent: 85, competition_level: 1 },
  // АГУ (16)
  { university_id: 16, min_ent: 55, avg_ent: 70, grant_min_ent: 85, competition_level: 1 },
  // КУ (14)
  { university_id: 14, min_ent: 55, avg_ent: 70, grant_min_ent: 85, competition_level: 1 },
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO admission_requirements (university_id, specialty_id, min_ent, avg_ent, grant_min_ent, competition_level)
  VALUES (?, 16, ?, ?, ?, ?)
`);

let added = 0;
for (const r of psychReqs) {
  try {
    stmt.run(r.university_id, r.min_ent, r.avg_ent, r.grant_min_ent, r.competition_level);
    added++;
  } catch (e) {
    console.log('Skip:', e.message);
  }
}
console.log(`Added ${added} admission requirements for Психология`);
db.close();
