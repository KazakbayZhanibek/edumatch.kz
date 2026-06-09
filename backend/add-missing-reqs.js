const db = require('better-sqlite3')('C:/Users/Janchik/Desktop/edumatch-kz/backend/edumatch.db');

// Специальности без admission_requirements
const missingSpecs = [
  { id: 4, name: 'Кибербезопасность', category: 'Информационные технологии' },
  { id: 3, name: 'Сетевые технологии', category: 'Информационные технологии' },
  { id: 5, name: 'Инженерия', category: 'Инженерия' },
  { id: 6, name: 'Гражданское строительство', category: 'Инженерия' },
  { id: 7, name: 'Механическая инженерия', category: 'Инженерия' },
  { id: 10, name: 'Финансы', category: 'Бизнес' },
  { id: 11, name: 'Бухгалтерский учет', category: 'Бизнес' },
  { id: 12, name: 'Маркетинг', category: 'Бизнес' },
  { id: 14, name: 'Фармацевтика', category: 'Медицина' },
  { id: 15, name: 'Сестринское дело', category: 'Медицина' },
  { id: 20, name: 'Языки и лингвистика', category: 'Гуманитарные науки' },
  { id: 21, name: 'Биология', category: 'Естественные науки' },
  { id: 22, name: 'Химия', category: 'Естественные науки' },
  { id: 23, name: 'Физика', category: 'Естественные науки' },
  { id: 24, name: 'Геология', category: 'Естественные науки' },
  { id: 25, name: 'Сельское хозяйство', category: 'Сельское хозяйство' },
  { id: 26, name: 'Агрономия', category: 'Сельское хозяйство' },
  { id: 27, name: 'Ветеринария', category: 'Сельское хозяйство' },
  { id: 29, name: 'Дизайн', category: 'Искусство' },
  { id: 30, name: 'Музыка', category: 'Искусство' },
  { id: 32, name: 'Физическое воспитание', category: 'Образование' },
  { id: 33, name: 'Туризм и гостеприимство', category: 'Туризм' },
  { id: 34, name: 'Международные отношения', category: 'Гуманитарные науки' },
  { id: 35, name: 'Политология', category: 'Гуманитарные науки' },
  { id: 18, name: 'История', category: 'Гуманитарные науки' },
  { id: 19, name: 'Философия', category: 'Гуманитарные науки' },
];

// Типичные вузы для каждой специальности
const uniTemplates = {
  'Информационные технологии': [
    { id: 2, min: 100, avg: 112, grant: 122, comp: 5 },
    { id: 1, min: 118, avg: 128, grant: 135, comp: 5 },
    { id: 3, min: 95, avg: 108, grant: 118, comp: 4 },
    { id: 25, min: 85, avg: 100, grant: 112, comp: 3 },
    { id: 32, min: 90, avg: 105, grant: 115, comp: 4 },
  ],
  'Инженерия': [
    { id: 5, min: 80, avg: 95, grant: 108, comp: 3 },
    { id: 28, min: 75, avg: 90, grant: 102, comp: 3 },
    { id: 29, min: 70, avg: 85, grant: 98, comp: 2 },
    { id: 30, min: 70, avg: 85, grant: 98, comp: 2 },
    { id: 2, min: 85, avg: 100, grant: 112, comp: 4 },
  ],
  'Бизнес': [
    { id: 2, min: 95, avg: 108, grant: 118, comp: 4 },
    { id: 3, min: 90, avg: 102, grant: 112, comp: 4 },
    { id: 44, min: 88, avg: 100, grant: 110, comp: 3 },
    { id: 22, min: 75, avg: 88, grant: 100, comp: 2 },
  ],
  'Медицина': [
    { id: 35, min: 100, avg: 115, grant: 128, comp: 5 },
    { id: 36, min: 98, avg: 112, grant: 125, comp: 5 },
    { id: 12, min: 90, avg: 105, grant: 118, comp: 4 },
    { id: 2, min: 95, avg: 108, grant: 120, comp: 4 },
  ],
  'Гуманитарные науки': [
    { id: 2, min: 85, avg: 100, grant: 112, comp: 3 },
    { id: 3, min: 80, avg: 95, grant: 108, comp: 3 },
    { id: 43, min: 82, avg: 98, grant: 110, comp: 3 },
    { id: 22, min: 70, avg: 85, grant: 98, comp: 2 },
  ],
  'Образование': [
    { id: 19, min: 70, avg: 85, grant: 98, comp: 2 },
    { id: 9, min: 68, avg: 82, grant: 95, comp: 2 },
    { id: 40, min: 65, avg: 78, grant: 90, comp: 2 },
    { id: 2, min: 78, avg: 92, grant: 105, comp: 3 },
  ],
  'Естественные науки': [
    { id: 2, min: 85, avg: 100, grant: 112, comp: 3 },
    { id: 3, min: 80, avg: 95, grant: 108, comp: 3 },
    { id: 7, min: 70, avg: 85, grant: 98, comp: 2 },
  ],
  'Искусство': [
    { id: 2, min: 75, avg: 90, grant: 102, comp: 2 },
    { id: 22, min: 65, avg: 80, grant: 92, comp: 2 },
    { id: 23, min: 65, avg: 80, grant: 92, comp: 2 },
  ],
  'Туризм': [
    { id: 27, min: 60, avg: 75, grant: 88, comp: 2 },
    { id: 22, min: 65, avg: 80, grant: 92, comp: 2 },
    { id: 2, min: 75, avg: 90, grant: 102, comp: 3 },
  ],
  'Сельское хозяйство': [
    { id: 4, min: 65, avg: 80, grant: 92, comp: 2 },
    { id: 8, min: 60, avg: 75, grant: 88, comp: 2 },
    { id: 17, min: 60, avg: 75, grant: 88, comp: 2 },
  ],
};

const stmt = db.prepare(`
  INSERT OR IGNORE INTO admission_requirements (university_id, specialty_id, min_ent, avg_ent, grant_min_ent, competition_level)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let totalAdded = 0;

for (const spec of missingSpecs) {
  const unis = uniTemplates[spec.category] || uniTemplates['Гуманитарные науки'];
  for (const u of unis) {
    try {
      const result = stmt.run(u.id, spec.id, u.min, u.avg, u.grant, u.comp);
      if (result.changes > 0) totalAdded++;
    } catch (e) {}
  }
}

console.log(`Added ${totalAdded} admission requirements for ${missingSpecs.length} specialties`);
console.log('Total admission_requirements:', db.prepare('SELECT COUNT(*) as c FROM admission_requirements').get().c);
db.close();
