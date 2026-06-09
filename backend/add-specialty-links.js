const db = require('better-sqlite3')('C:/Users/Janchik/Desktop/edumatch-kz/backend/edumatch.db');

// Все специальности без привязки к вузам
const missingLinks = [
  // Кибербезопасность (4) → IT вузы
  { specId: 4, unis: [1, 2, 3, 25, 32, 20] },
  // Сетевые технологии (3) → IT вузы
  { specId: 3, unis: [1, 2, 25, 32, 20] },
  // Инженерия (5) → инженерные вузы
  { specId: 5, unis: [5, 28, 29, 30, 2, 3] },
  // Гражданское строительство (6)
  { specId: 6, unis: [28, 29, 5, 30, 2] },
  // Механическая инженерия (7)
  { specId: 7, unis: [5, 30, 29, 28, 2] },
  // Финансы (10)
  { specId: 10, unis: [2, 3, 44, 22, 9] },
  // Бухгалтерский учет (11)
  { specId: 11, unis: [2, 3, 44, 22, 9] },
  // Маркетинг (12)
  { specId: 12, unis: [2, 44, 22, 3, 9] },
  // Фармацевтика (14)
  { specId: 14, unis: [35, 36, 12, 2] },
  // Сестринское дело (15)
  { specId: 15, unis: [35, 36, 12] },
  // Психология (16)
  { specId: 16, unis: [2, 3, 22, 19, 9, 7, 13, 40, 18, 15, 16, 14] },
  // История (18)
  { specId: 18, unis: [2, 3, 19, 9, 7, 22] },
  // Философия (19)
  { specId: 19, unis: [2, 3, 22] },
  // Языки и лингвистика (20)
  { specId: 20, unis: [2, 3, 19, 22, 9] },
  // Биология (21)
  { specId: 21, unis: [2, 3, 7] },
  // Химия (22)
  { specId: 22, unis: [2, 3, 7] },
  // Физика (23)
  { specId: 23, unis: [2, 3, 7] },
  // Геология (24)
  { specId: 24, unis: [2, 5, 30] },
  // Сельское хозяйство (25)
  { specId: 25, unis: [4, 8, 17] },
  // Агрономия (26)
  { specId: 26, unis: [4, 8, 17] },
  // Ветинария (27)
  { specId: 27, unis: [4, 8] },
  // Дизайн (29)
  { specId: 29, unis: [2, 22, 23, 3] },
  // Музыка (30)
  { specId: 30, unis: [19, 22] },
  // Физическое воспитание (32)
  { specId: 32, unis: [19, 9, 22] },
  // Туризм и гостеприимство (33)
  { specId: 33, unis: [27, 22, 2, 3] },
  // Международные отношения (34)
  { specId: 34, unis: [2, 3, 43, 22] },
  // Политология (35)
  { specId: 35, unis: [2, 3, 43, 22] },
];

const stmt = db.prepare('INSERT OR IGNORE INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
let total = 0;

for (const link of missingLinks) {
  for (const uniId of link.unis) {
    try {
      const result = stmt.run(uniId, link.specId);
      if (result.changes > 0) total++;
    } catch (e) {}
  }
}

console.log(`Added ${total} university_specialty links`);

// Verify
const remaining = db.prepare('SELECT s.id, s.name FROM specialties s WHERE NOT EXISTS (SELECT 1 FROM university_specialties us WHERE us.specialty_id = s.id)').all();
console.log(`Remaining specialties without unis: ${remaining.length}`);
remaining.forEach(r => console.log(`  ${r.id}: ${r.name}`));

console.log(`\nTotal university_specialties: ${db.prepare('SELECT COUNT(*) as c FROM university_specialties').get().c}`);
db.close();
