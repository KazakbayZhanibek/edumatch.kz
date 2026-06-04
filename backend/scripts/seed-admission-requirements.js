/**
 * Заполняет admission_requirements на основе вузов и их специальностей.
 * node init-admission-tables.js && node seed-admission-requirements.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'edumatch.db'));

const CATEGORY_BASE = {
  'Информационные технологии': { min: 88, spread: 14, competition: 4 },
  'Инженерия': { min: 72, spread: 12, competition: 3 },
  'Бизнес': { min: 75, spread: 11, competition: 3 },
  'Медицина': { min: 92, spread: 10, competition: 5 },
  'Образование': { min: 65, spread: 10, competition: 2 },
  'Гуманитарные науки': { min: 68, spread: 10, competition: 2 },
  'Искусство': { min: 60, spread: 10, competition: 2 },
  'Естественные науки': { min: 78, spread: 12, competition: 3 },
  'Здоровье': { min: 80, spread: 11, competition: 3 },
  'Сельское хозяйство': { min: 62, spread: 10, competition: 2 },
  'Туризм': { min: 58, spread: 10, competition: 2 },
  'Общественные науки': { min: 70, spread: 10, competition: 2 },
};

function qsBoost(qsWorld) {
  if (!qsWorld) return 0;
  if (qsWorld <= 250) return 18;
  if (qsWorld <= 400) return 12;
  if (qsWorld <= 600) return 6;
  return 0;
}

function priceBoost(priceFrom) {
  if (priceFrom >= 1800000) return 8;
  if (priceFrom >= 1400000) return 4;
  return 0;
}

/** Ручные пороги для известных вузов (категория IT) */
const IT_OVERRIDES = {
  1: { min_ent: 118, avg_ent: 128, grant_min_ent: 135, competition_level: 5 },
  2: { min_ent: 100, avg_ent: 112, grant_min_ent: 122, competition_level: 5 },
  31: { min_ent: 88, avg_ent: 96, grant_min_ent: 105, competition_level: 3 },
  32: { min_ent: 100, avg_ent: 110, grant_min_ent: 118, competition_level: 4 },
  25: { min_ent: 85, avg_ent: 95, grant_min_ent: 105, competition_level: 3 },
  44: { min_ent: 90, avg_ent: 100, grant_min_ent: 110, competition_level: 4 },
};

const rows = db.prepare(`
  SELECT DISTINCT u.id AS university_id, u.qs_world, u.price_from,
         s.id AS specialty_id, s.category
  FROM universities u
  JOIN university_specialties us ON u.id = us.university_id
  JOIN specialties s ON us.specialty_id = s.id
`).all();

const insert = db.prepare(`
  INSERT OR REPLACE INTO admission_requirements
    (university_id, specialty_id, min_ent, avg_ent, grant_min_ent, competition_level)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let count = 0;
const tx = db.transaction(() => {
  db.prepare('DELETE FROM admission_requirements').run();

  for (const row of rows) {
    const base = CATEGORY_BASE[row.category] || { min: 70, spread: 12, competition: 3 };
    const boost = qsBoost(row.qs_world) + priceBoost(row.price_from);
    let minEnt = Math.min(130, base.min + boost);
    let avgEnt = Math.min(138, minEnt + base.spread);
    let grantMin = Math.min(140, avgEnt + 8);
    let competition = Math.min(5, base.competition + (row.qs_world && row.qs_world < 400 ? 1 : 0));

    if (row.category === 'Информационные технологии' && IT_OVERRIDES[row.university_id]) {
      const o = IT_OVERRIDES[row.university_id];
      minEnt = o.min_ent;
      avgEnt = o.avg_ent;
      grantMin = o.grant_min_ent;
      competition = o.competition_level;
    }

    insert.run(row.university_id, row.specialty_id, minEnt, avgEnt, grantMin, competition);
    count++;
  }
});

tx();
console.log(`✓ Записано ${count} требований поступления`);
db.close();
