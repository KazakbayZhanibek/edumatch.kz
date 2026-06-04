const db = require('better-sqlite3')('edumatch.db');

try {
  // Создаем стандартные категории специальностей
  const insertSpecialty = db.prepare(`
    INSERT OR IGNORE INTO specialties (id, name, category)
    VALUES (?, ?, ?)
  `);

  const specialties = [
    // IT & Engineering
    { id: 1, name: 'Компьютерные науки', category: 'Информационные технологии' },
    { id: 2, name: 'Разработка программного обеспечения', category: 'Информационные технологии' },
    { id: 3, name: 'Сетевые технологии', category: 'Информационные технологии' },
    { id: 4, name: 'Кибербезопасность', category: 'Информационные технологии' },
    { id: 5, name: 'Инженерия', category: 'Инженерия' },
    { id: 6, name: 'Гражданское строительство', category: 'Инженерия' },
    { id: 7, name: 'Механическая инженерия', category: 'Инженерия' },
    
    // Business & Economics
    { id: 8, name: 'Бизнес и менеджмент', category: 'Бизнес' },
    { id: 9, name: 'Экономика', category: 'Бизнес' },
    { id: 10, name: 'Финансы', category: 'Бизнес' },
    { id: 11, name: 'Бухгалтерский учет', category: 'Бизнес' },
    { id: 12, name: 'Маркетинг', category: 'Бизнес' },
    
    // Medicine & Health
    { id: 13, name: 'Медицина', category: 'Медицина' },
    { id: 14, name: 'Фармацевтика', category: 'Медицина' },
    { id: 15, name: 'Сестринское дело', category: 'Медицина' },
    { id: 16, name: 'Психология', category: 'Здоровье' },
    
    // Humanities
    { id: 17, name: 'Право', category: 'Гуманитарные науки' },
    { id: 18, name: 'История', category: 'Гуманитарные науки' },
    { id: 19, name: 'Философия', category: 'Гуманитарные науки' },
    { id: 20, name: 'Языки и лингвистика', category: 'Гуманитарные науки' },
    
    // Natural Sciences
    { id: 21, name: 'Биология', category: 'Естественные науки' },
    { id: 22, name: 'Химия', category: 'Естественные науки' },
    { id: 23, name: 'Физика', category: 'Естественные науки' },
    { id: 24, name: 'Геология', category: 'Естественные науки' },
    
    // Agriculture
    { id: 25, name: 'Сельское хозяйство', category: 'Сельское хозяйство' },
    { id: 26, name: 'Агрономия', category: 'Сельское хозяйство' },
    { id: 27, name: 'Ветеринария', category: 'Сельское хозяйство' },
    
    // Arts & Design
    { id: 28, name: 'Изобразительное искусство', category: 'Искусство' },
    { id: 29, name: 'Дизайн', category: 'Искусство' },
    { id: 30, name: 'Музыка', category: 'Искусство' },
    
    // Education
    { id: 31, name: 'Педагогика', category: 'Образование' },
    { id: 32, name: 'Физическое воспитание', category: 'Образование' },
    
    // Other
    { id: 33, name: 'Туризм и гостеприимство', category: 'Туризм' },
    { id: 34, name: 'Международные отношения', category: 'Общественные науки' },
    { id: 35, name: 'Политология', category: 'Общественные науки' },
  ];

  let count = 0;
  for (const spec of specialties) {
    try {
      insertSpecialty.run(spec.id, spec.name, spec.category);
      count++;
    } catch (err) {
      console.log('Error:', err.message);
    }
  }

  console.log(`✓ Loaded ${count} specialties`);

  // Привязать специальности к университетам (выбранные по умолчанию)
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO university_specialties (university_id, specialty_id)
    VALUES (?, ?)
  `);

  // Получим все вузы
  const unis = db.prepare('SELECT id, name FROM universities').all();
  
  let linkCount = 0;
  for (const uni of unis) {
    // Каждому вузу привязываем основные специальности
    const defaultSpecs = [1, 2, 8, 9, 13, 17, 28, 31]; // IT, Business, Medicine, Law, Art, Education
    
    for (const specId of defaultSpecs) {
      try {
        insertLink.run(uni.id, specId);
        linkCount++;
      } catch (err) {
        // Skip duplicates
      }
    }
  }

  console.log(`✓ Created ${linkCount} university-specialty links`);

  // Show summary
  const uniCount = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
  const specCount = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get();
  const linkCount2 = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get();
  
  console.log('\n✓ Summary:');
  console.log(`  Universities: ${uniCount.cnt}`);
  console.log(`  Specialties: ${specCount.cnt}`);
  console.log(`  University-Specialty links: ${linkCount2.cnt}`);

} catch (err) {
  console.error('Error:', err.message);
}
