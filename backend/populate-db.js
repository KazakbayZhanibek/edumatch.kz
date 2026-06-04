/**
 * Быстрое заполнение БД базовыми данными для демонстрации
 */

const db = require('better-sqlite3')('edumatch.db');

console.log('🚀 Заполняю БД базовыми данными...\n');

try {
  // === 1. ДОБАВИТЬ ГОРОДА ===
  console.log('1️⃣  Добавляю города...');
  const insertCity = db.prepare('INSERT OR IGNORE INTO cities (id, name) VALUES (?, ?)');
  insertCity.run(1, 'Алматы');
  insertCity.run(2, 'Астана');
  insertCity.run(3, 'Шымкент');
  console.log('✓ Города добавлены\n');

  // === 2. ДОБАВИТЬ СПЕЦИАЛЬНОСТИ ===
  console.log('2️⃣  Добавляю специальности...');
  const insertSpecialty = db.prepare('INSERT OR IGNORE INTO specialties (id, name, category) VALUES (?, ?, ?)');
  
  const specialties = [
    [1, 'IT', 'ИТ'],
    [2, 'Компьютерные науки', 'ИТ'],
    [3, 'Программирование', 'ИТ'],
    [4, 'Программная инженерия', 'ИТ'],
    [5, 'Веб-разработка', 'ИТ'],
    [6, 'Искусственный интеллект', 'ИТ'],
    [7, 'Информационные технологии', 'ИТ'],
    [8, 'Медицина', 'Здоровье'],
    [9, 'Сестринское дело', 'Здоровье'],
    [10, 'Фармация', 'Здоровье'],
    [11, 'Экономика', 'Бизнес'],
    [12, 'Финансы', 'Бизнес'],
    [13, 'Менеджмент', 'Бизнес'],
    [14, 'Маркетинг', 'Бизнес'],
    [15, 'Право', 'Право'],
    [16, 'Юриспруденция', 'Право'],
    [17, 'Инженерия', 'Инженерия'],
    [18, 'Строительство', 'Инженерия'],
  ];

  for (const [id, name, category] of specialties) {
    insertSpecialty.run(id, name, category);
  }
  console.log(`✓ ${specialties.length} специальностей добавлено\n`);

  // === 3. СВЯЗАТЬ СПЕЦИАЛЬНОСТИ С УНИВЕРСИТЕТАМИ ===
  console.log('3️⃣  Связываю специальности с университетами...');
  const insertLink = db.prepare('INSERT OR IGNORE INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
  
  // Каждому университету назначаем несколько специальностей
  const universitySpecialties = {
    1: [1, 2, 3, 4, 11, 12, 13],         // Евразийский национальный - много IT
    10: [1, 2, 3, 11, 12, 13],           // Туран-Астана - IT и бизнес
    11: [8, 9, 10],                      // Медицинский вуз
    12: [1, 2, 17, 18],                  // IT и инженерия
    2: [1, 2, 3, 4, 11, 12, 8, 15],      // КазНУ - много направлений
    3: [1, 3, 11, 12, 13],               // КБТУ - IT и бизнес
    4: [17, 18, 11, 12],                 // Политехник - инженерия
  };

  let linkCount = 0;
  for (const [uniId, specIds] of Object.entries(universitySpecialties)) {
    for (const specId of specIds) {
      try {
        insertLink.run(parseInt(uniId), specId);
        linkCount++;
      } catch (e) {
        // Silent fail if uni doesn't exist
      }
    }
  }
  console.log(`✓ ${linkCount} связей добавлено\n`);

  // === 4. ДОБАВИТЬ ГРАНТЫ ===
  console.log('4️⃣  Добавляю гранты...');
  const insertGrant = db.prepare(`
    INSERT OR IGNORE INTO grants (id, name, type, amount, description, requirements, deadline, link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const grants = [
    [1, 'Болашак', 'Государственный грант', '100%', 'Международный грант для обучения за границей', JSON.stringify(['ЕНТ > 80', 'ИИ > 4.0']), '2025-06-01', 'https://bolashak.gov.kz'],
    [2, 'Грант НУ', 'Внутренний грант', '100%', 'Полная стипендия в Назарбаев Университет', JSON.stringify(['ЕНТ > 90']), '2025-05-31', 'https://nu.edu.kz'],
    [3, 'Грант КазНУ', 'Внутренний грант', '75%', 'Частичная стипендия в КазНУ', JSON.stringify(['ЕНТ > 70']), '2025-06-15', 'https://kaznpu.kz'],
    [4, 'Грант КБТУ', 'Внутренний грант', '50%', 'Стипендия в КБТУ', JSON.stringify(['ЕНТ > 65']), '2025-06-20', 'https://kbtu.kz'],
    [5, 'Erasmus+', 'Международная программа', '70%', 'Программа обмена с ЕС', JSON.stringify(['ИИ > 3.5', 'Английский B2']), '2025-07-01', 'https://erasmusplus.eu'],
    [6, 'Атамекен', 'Корпоративный грант', '100%', 'Грант от Национальной палаты предпринимателей', JSON.stringify(['ЕНТ > 75']), '2025-08-01', 'https://atameken.kz'],
    [7, 'Грант Бумекен', 'Местный грант', '30%', 'Грант для студентов Алматы', JSON.stringify(['Жители Алматы']), '2025-09-01', 'https://bumeken.kz'],
  ];

  for (const [id, name, type, amount, desc, reqs, deadline, link] of grants) {
    insertGrant.run(id, name, type, amount, desc, reqs, deadline, link);
  }
  console.log(`✓ ${grants.length} грантов добавлено\n`);

  // === ПРОВЕРКА ===
  console.log('📊 СТАТИСТИКА БД:');
  const countUnis = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
  const countSpecs = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get();
  const countLinks = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get();
  const countGrants = db.prepare('SELECT COUNT(*) as cnt FROM grants').get();

  console.log(`   • Университетов: ${countUnis.cnt}`);
  console.log(`   • Специальностей: ${countSpecs.cnt}`);
  console.log(`   • Связей (вуз-специальность): ${countLinks.cnt}`);
  console.log(`   • Грантов: ${countGrants.cnt}`);

  console.log('\n✅ БД успешно заполнена! Перезагрузите браузер.');

} catch (err) {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
}
