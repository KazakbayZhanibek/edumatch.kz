/**
 * Очистка и переполнение БД
 */

const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');
const path = require('path');

console.log('🗑️  Очищаю таблицы...');

try {
  // Очистить таблицы (но не удалять их)
  db.exec(`
    DELETE FROM university_specialties;
    DELETE FROM grant_specialties;
    DELETE FROM specialties;
    DELETE FROM grants;
    DELETE FROM universities;
    DELETE FROM cities;
  `);
  
  console.log('✓ Таблицы очищены\n');

  // === 1. ДОБАВИТЬ ГОРОДА ===
  console.log('1️⃣  Добавляю города...');
  const insertCity = db.prepare('INSERT INTO cities (id, name) VALUES (?, ?)');
  insertCity.run(1, 'Алматы');
  insertCity.run(2, 'Астана');
  insertCity.run(3, 'Шымкент');
  console.log('✓ Города добавлены\n');

  // === 2. ДОБАВИТЬ СПЕЦИАЛЬНОСТИ ===
  console.log('2️⃣  Добавляю специальности...');
  const insertSpecialty = db.prepare('INSERT INTO specialties (id, name, category) VALUES (?, ?, ?)');
  
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

  // === 3. ЗАГРУЗИТЬ УНИВЕРСИТЕТЫ ===
  console.log('3️⃣  Загружаю университеты...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../universities_full(1).json'), 'utf8'));
  
  const insertUni = db.prepare(`
    INSERT INTO universities (id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to, website, description, founded, students_count, languages, accreditations, has_dorm, dorm_price, avg_salary, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let uniCount = 0;
  for (const uni of data.slice(0, 20)) {
    try {
      insertUni.run(
        uni.id,
        uni.name,
        uni.short_name,
        uni.city === 'Алматы' ? 1 : (uni.city === 'Астана' ? 2 : 3),
        uni.qs_world || null,
        uni.qs_asia || null,
        uni.price_from || 500000,
        uni.price_to || 2000000,
        uni.website || '',
        uni.description || uni.name,
        uni.founded || 2000,
        uni.students_count || 0,
        JSON.stringify(uni.languages || ['Казахский', 'Русский']),
        JSON.stringify(uni.accreditations || ['Национальная']),
        uni.dormitory ? 1 : 0,
        uni.dormitory_price_per_year || 0,
        uni.avg_graduate_salary || 0,
        uni.lat || 0,
        uni.lng || 0
      );
      uniCount++;
    } catch (err) {
      console.log('⚠️  Ошибка загрузки вуза', uni.name, ':', err.message);
    }
  }
  console.log(`✓ ${uniCount} университетов загружено\n`);

  // === 4. СВЯЗАТЬ СПЕЦИАЛЬНОСТИ С УНИВЕРСИТЕТАМИ ===
  console.log('4️⃣  Связываю специальности с университетами...');
  const insertLink = db.prepare('INSERT INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
  
  // Каждому университету назначаем специальности на основе факультетов
  let linkCount = 0;
  for (const uni of data.slice(0, 20)) {
    // Определяем специальности по названию вуза
    let specs = [];
    const name_lower = uni.name.toLowerCase();
    
    // Добавляем IT если в названии или если есть факультет IT/CS
    if (name_lower.includes('назарбаев') || name_lower.includes('политех') || name_lower.includes('кбту')) {
      specs = [1, 2, 3, 4, 6];
    } else if (name_lower.includes('казнпу') || name_lower.includes('медиц')) {
      specs = [8, 9, 10];
    } else if (name_lower.includes('казну')) {
      specs = [1, 2, 3, 11, 12, 13, 8, 15];
    } else {
      specs = [1, 2, 11, 12, 13];  // Default: IT + Business
    }

    for (const specId of specs) {
      try {
        insertLink.run(uni.id, specId);
        linkCount++;
      } catch (e) {
        // Silent
      }
    }
  }
  console.log(`✓ ${linkCount} связей добавлено\n`);

  // === 5. ДОБАВИТЬ ГРАНТЫ ===
  console.log('5️⃣  Добавляю гранты...');
  const insertGrant = db.prepare(`
    INSERT INTO grants (id, name, type, amount, description, requirements, deadline, link)
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
  console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
  const countUnis = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
  const countSpecs = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get();
  const countLinks = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get();
  const countGrants = db.prepare('SELECT COUNT(*) as cnt FROM grants').get();

  console.log(`   • Университетов: ${countUnis.cnt}`);
  console.log(`   • Специальностей: ${countSpecs.cnt}`);
  console.log(`   • Связей (вуз-специальность): ${countLinks.cnt}`);
  console.log(`   • Грантов: ${countGrants.cnt}`);

  console.log('\n✅ БД успешно переполнена! Перезагрузите браузер.');

} catch (err) {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
}
