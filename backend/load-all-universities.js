/**
 * Загрузить ВСЕ университеты из universities_full(1).json
 */

const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');
const path = require('path');

console.log('🚀 Загружаю ВСЕ университеты...\n');

try {
  // === 1. ОЧИСТИТЬ ТАБЛИЦЫ ===
  console.log('🗑️  Очищаю таблицы...');
  db.exec(`
    DELETE FROM university_specialties;
    DELETE FROM specialties;
    DELETE FROM universities;
    DELETE FROM cities;
  `);
  console.log('✓ Таблицы очищены\n');

  // === 2. ДОБАВИТЬ ГОРОДА ===
  console.log('1️⃣  Добавляю города...');
  const insertCity = db.prepare('INSERT INTO cities (id, name) VALUES (?, ?)');
  insertCity.run(1, 'Алматы');
  insertCity.run(2, 'Астана');
  insertCity.run(3, 'Шымкент');
  insertCity.run(4, 'Караганда');
  insertCity.run(5, 'Павлодар');
  insertCity.run(6, 'Усть-Каменогорск');
  insertCity.run(7, 'Семей');
  insertCity.run(8, 'Кызылорда');
  insertCity.run(9, 'Актау');
  insertCity.run(10, 'Атырау');
  insertCity.run(11, 'Уральск');
  insertCity.run(12, 'Петропавловск');
  insertCity.run(13, 'Каскелен');
  insertCity.run(14, 'Актобе');
  insertCity.run(15, 'Кокшетау');
  insertCity.run(16, 'Жезказган');
  console.log('✓ Города добавлены\n');

  // === 3. ДОБАВИТЬ СПЕЦИАЛЬНОСТИ ===
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
    [8, 'Кибербезопасность', 'ИТ'],
    [9, 'Медицина', 'Здоровье'],
    [10, 'Сестринское дело', 'Здоровье'],
    [11, 'Фармация', 'Здоровье'],
    [12, 'Экономика', 'Бизнес'],
    [13, 'Финансы', 'Бизнес'],
    [14, 'Менеджмент', 'Бизнес'],
    [15, 'Маркетинг', 'Бизнес'],
    [16, 'Право', 'Право'],
    [17, 'Юриспруденция', 'Право'],
    [18, 'Инженерия', 'Инженерия'],
    [19, 'Строительство', 'Инженерия'],
    [20, 'Архитектура', 'Инженерия'],
    [21, 'Сельское хозяйство', 'Сельское хозяйство'],
    [22, 'Педагогика', 'Образование'],
    [23, 'Туризм', 'Туризм'],
  ];

  for (const [id, name, category] of specialties) {
    insertSpecialty.run(id, name, category);
  }
  console.log(`✓ ${specialties.length} специальностей добавлено\n`);

  // === 4. ЗАГРУЗИТЬ УНИВЕРСИТЕТЫ ===
  console.log('3️⃣  Загружаю университеты...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../universities_full(1).json'), 'utf8'));
  
  const insertUni = db.prepare(`
    INSERT INTO universities (id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to, website, description, founded, students_count, languages, accreditations, has_dorm, dorm_price, avg_salary, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Маппинг городов
  const cityMap = {
    'Алматы': 1,
    'Астана': 2,
    'Шымкент': 3,
    'Караганда': 4,
    'Павлодар': 5,
    'Усть-Каменогорск': 6,
    'Семей': 7,
    'Кызылорда': 8,
    'Актау': 9,
    'Атырау': 10,
    'Уральск': 11,
    'Петропавловск': 12,
    'Каскелен': 13,
    'Актобе': 14,
    'Кокшетау': 15,
    'Жезказган': 16,
  };

  let uniCount = 0;
  for (const uni of data) {
    try {
      const cityId = cityMap[uni.city] || 2; // Default Астана
      
      insertUni.run(
        uni.id,
        uni.name || 'Университет',
        uni.short_name || 'УН',
        cityId,
        uni.qs_world || null,
        uni.qs_asia || null,
        uni.price_from || 500000,
        uni.price_to || 2000000,
        uni.website || '',
        uni.name || 'Университет',
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

  // === 5. СВЯЗАТЬ СПЕЦИАЛЬНОСТИ С УНИВЕРСИТЕТАМИ ===
  console.log('4️⃣  Связываю специальности с университетами...');
  const insertLink = db.prepare('INSERT INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
  
  let linkCount = 0;
  for (const uni of data) {
    // Определяем специальности на основе факультетов
    let specs = new Set();

    if (uni.faculties && Array.isArray(uni.faculties)) {
      for (const faculty of uni.faculties) {
        const fName = faculty.name.toLowerCase();
        const specs_arr = faculty.specialties || [];

        // IT факультет
        if (fName.includes('информатик') || fName.includes('компьютер') || fName.includes('ит') || fName.includes('it') || fName.includes('информационн')) {
          specs.add(1);
          specs.add(2);
          specs.add(3);
          specs.add(4);
          specs.add(8);
        }

        // Инженерия
        if (fName.includes('инженер') || fName.includes('технолог') || fName.includes('технич')) {
          specs.add(18);
          specs.add(19);
        }

        // Архитектура и строительство
        if (fName.includes('архитектур') || fName.includes('строител')) {
          specs.add(20);
          specs.add(19);
        }

        // Медицина
        if (fName.includes('медиц') || fName.includes('здоровь')) {
          specs.add(9);
          specs.add(10);
          specs.add(11);
        }

        // Бизнес и экономика
        if (fName.includes('бизнес') || fName.includes('экономи') || fName.includes('финанс') || fName.includes('менеджмент')) {
          specs.add(12);
          specs.add(13);
          specs.add(14);
        }

        // Право
        if (fName.includes('право') || fName.includes('юридическ')) {
          specs.add(16);
          specs.add(17);
        }

        // Педагогика
        if (fName.includes('педагог')) {
          specs.add(22);
        }

        // Сельское хозяйство
        if (fName.includes('сельск') || fName.includes('агро') || fName.includes('аграрн')) {
          specs.add(21);
        }

        // Туризм
        if (fName.includes('туризм')) {
          specs.add(23);
        }
      }
    }

    // Если специальностей не найдено, добавляем по названию вуза
    if (specs.size === 0) {
      const uName = (uni.name || '').toLowerCase();
      if (uName.includes('технолог') || uName.includes('технич') || uName.includes('политех')) {
        specs.add(1);
        specs.add(2);
        specs.add(18);
      } else if (uName.includes('медиц')) {
        specs.add(9);
        specs.add(10);
      } else if (uName.includes('педагог')) {
        specs.add(22);
      } else if (uName.includes('аграрн') || uName.includes('агро')) {
        specs.add(21);
      } else {
        // Default: IT + Business
        specs.add(1);
        specs.add(12);
      }
    }

    // Записываем связи
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

  // === ПРОВЕРКА ===
  console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
  const countUnis = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
  const countSpecs = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get();
  const countLinks = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get();

  console.log(`   • Университетов: ${countUnis.cnt}`);
  console.log(`   • Специальностей: ${countSpecs.cnt}`);
  console.log(`   • Связей (вуз-специальность): ${countLinks.cnt}`);

  console.log('\n✅ БД полностью переполнена! Перезагрузите браузер.');

} catch (err) {
  console.error('❌ Ошибка:', err.message);
  console.error(err.stack);
  process.exit(1);
}
