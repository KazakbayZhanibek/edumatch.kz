/**
 * db.js
 * Data access layer для EduMatchKZ
 * Использует SQLite, но сохраняет текущее API без изменений
 * 
 * Этот слой скрывает детали хранения и возвращает данные в знакомом формате
 */

const { getDb } = require('./database');

function pickDescription(row, lang) {
  if (lang === 'kk' && row.description_kk) return row.description_kk;
  if (lang === 'en' && row.description_en) return row.description_en;
  return row.description;
}

/**
 * getUniversities({ sort, price_max, specialty, language, city_id, is_top })
 * 
 * Возвращает массив университетов с фильтрацией и сортировкой
 * Совместимо со старым API
 */
function getUniversities({ sort, price_max, specialty, language, city_id, is_top, lang } = {}) {
  const db = getDb();
  
  let query = `
    SELECT DISTINCT
      u.id, u.name, u.short_name, u.city_id, u.qs_world, u.qs_asia,
      u.price_from, u.price_to, u.website, u.description, u.description_kk, u.description_en, u.founded,
      u.students_count, u.languages, u.accreditations, u.has_dorm,
      u.dorm_price, u.avg_salary, u.lat, u.lng,
      u.admission_phone, u.admission_email,
      c.name as city_name
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
  `;

  const conditions = [];
  const params = [];

  // ТОП-20: 20 лучших по QS (мировой → азиатский → число студентов)
  if (is_top === 'top') {
    conditions.push(`u.id IN (
      SELECT id FROM universities
      ORDER BY
        CASE WHEN qs_world IS NULL THEN 1 ELSE 0 END,
        qs_world ASC,
        CASE WHEN qs_asia IS NULL THEN 1 ELSE 0 END,
        qs_asia ASC,
        COALESCE(students_count, 0) DESC,
        id ASC
      LIMIT 20
    )`);
  }

  // Фильтр по городу
  if (city_id) {
    conditions.push('u.city_id = ?');
    params.push(parseInt(city_id));
  }

  // Макс. стоимость: минимальный тариф вуза не дороже бюджета
  if (price_max) {
    conditions.push('u.price_from <= ?');
    params.push(parseInt(price_max, 10));
  }

  // Фильтр по языку (в БД: «казахский», «русский», «английский»)
  if (language) {
    const langKey = String(language).trim().toLowerCase();
    conditions.push(`LOWER(u.languages) LIKE ?`);
    params.push(`%${langKey}%`);
  }

  // Фильтр по категории специальности
  if (specialty) {
    conditions.push(`EXISTS (
      SELECT 1 FROM university_specialties us
      JOIN specialties s ON us.specialty_id = s.id
      WHERE us.university_id = u.id AND s.category = ?
    )`);
    params.push(specialty);
  }

  // Добавляем условия WHERE
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Сортировка
  if (sort === 'price_asc') {
    query += ' ORDER BY u.price_from ASC';
  } else if (sort === 'price_desc') {
    query += ' ORDER BY u.price_from DESC';
  } else {
    // Дефолт: по QS World, NULL в конце
    query += ' ORDER BY CASE WHEN u.qs_world IS NULL THEN 1 ELSE 0 END, u.qs_world ASC';
  }

  const stmt = db.prepare(query);
  let unis = stmt.all(...params);

  // Постобработка: добавляем specialties массив
  unis = unis.map(u => {
    const specialtiesStmt = db.prepare(`
      SELECT s.id, s.name, s.category
      FROM specialties s
      JOIN university_specialties us ON s.id = us.specialty_id
      WHERE us.university_id = ?
    `);
    const specialties = specialtiesStmt.all(u.id);

    // Парсим JSON поля с error handling
    let languages = [];
    let accreditations = [];
    
    try {
      languages = u.languages ? JSON.parse(u.languages) : [];
    } catch (e) {
      console.warn(`Invalid languages JSON for university ${u.id}:`, u.languages);
      languages = ['Русский'];
    }
    
    try {
      accreditations = u.accreditations ? JSON.parse(u.accreditations) : [];
    } catch (e) {
      console.warn(`Invalid accreditations JSON for university ${u.id}:`, u.accreditations);
      accreditations = ['Национальная'];
    }

    return {
      ...u,
      description: pickDescription(u, lang),
      languages,
      accreditations,
      specialties,
      city_name: u.city_name || 'Алматы'
    };
  });

  return unis;
}

/**
 * getUniversity(id)
 * Возвращает один университет со всеми деталями
 */
function getUniversity(id, lang) {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT
      u.id, u.name, u.short_name, u.city_id, u.qs_world, u.qs_asia,
      u.price_from, u.price_to, u.website, u.description, u.description_kk, u.description_en, u.founded,
      u.students_count, u.languages, u.accreditations, u.has_dorm,
      u.dorm_price, u.avg_salary, u.lat, u.lng,
      u.admission_phone, u.admission_email, u.admission_whatsapp,
      c.name as city_name
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE u.id = ?
  `);

  const u = stmt.get(parseInt(id));
  if (!u) return null;

  // Получаем специальности
  const specialtiesStmt = db.prepare(`
    SELECT s.id, s.name, s.category
    FROM specialties s
    JOIN university_specialties us ON s.id = us.specialty_id
    WHERE us.university_id = ?
  `);
  const specialties = specialtiesStmt.all(u.id);

  // Парсим JSON поля с error handling
  let languages = [];
  let accreditations = [];
  
  try {
    languages = u.languages ? JSON.parse(u.languages) : [];
  } catch (e) {
    console.warn(`Invalid languages JSON for university ${u.id}:`, u.languages);
    languages = ['Русский'];
  }
  
  try {
    accreditations = u.accreditations ? JSON.parse(u.accreditations) : [];
  } catch (e) {
    console.warn(`Invalid accreditations JSON for university ${u.id}:`, u.accreditations);
    accreditations = ['Национальная'];
  }

  return {
    ...u,
    description: pickDescription(u, lang),
    languages,
    accreditations,
    specialties,
    city_name: u.city_name || 'Алматы',
    has_dorm: u.has_dorm === 1
  };
}

/**
 * getSpecialtyCategories()
 * Возвращает массив специальностей с id, name и category для выпадающих списков
 */
function getSpecialtyCategories() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.category
    FROM specialties s
    JOIN university_specialties us ON s.id = us.specialty_id
    ORDER BY s.category ASC, s.name ASC
  `);
  return stmt.all();
}

/**
 * getGrants()
 * Возвращает все гранты с информацией о связанных специальностях
 * 
 * Note: Гранты могут быть связаны со специальностями.
 * Для совместимости с текущим API возвращаем specialty_ids, если они есть.
 */
function getGrants({ lang } = {}) {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT
      g.id, g.name, g.name_kk, g.name_en,
      g.type, g.amount,
      g.description, g.description_kk, g.description_en,
      g.requirements, g.requirements_kk, g.requirements_en,
      g.deadline, g.link
    FROM grants g
    ORDER BY g.id ASC
  `);

  let grants = stmt.all();

  // Постобработка: добавляем specialty_ids, если они есть, и переводим
  grants = grants.map(g => {
    const specialtiesStmt = db.prepare(`
      SELECT specialty_id
      FROM grant_specialties
      WHERE grant_id = ?
    `);
    const specialtyRows = specialtiesStmt.all(g.id);
    const specialty_ids = specialtyRows.map(row => row.specialty_id);

    // Парсим JSON поля с error handling
    let requirements = [];
    try {
      const reqField = lang === 'kk' && g.requirements_kk ? g.requirements_kk
        : lang === 'en' && g.requirements_en ? g.requirements_en
        : g.requirements;
      requirements = reqField ? JSON.parse(reqField) : [];
    } catch (e) {
      console.warn(`Invalid requirements JSON for grant ${g.id}:`, g.requirements);
      requirements = [];
    }

    const result = {
      ...g,
      name: pickDescription({ description: g.name, description_kk: g.name_kk, description_en: g.name_en }, lang),
      description: pickDescription(g, lang),
      requirements,
    };

    // Убираем лишние переводные колонки из ответа
    delete result.name_kk;
    delete result.name_en;
    delete result.description_kk;
    delete result.description_en;
    delete result.requirements_kk;
    delete result.requirements_en;

    // Если есть связанные специальности, добавляем их
    if (specialty_ids.length > 0) {
      result.specialty_ids = specialty_ids;
    }

    return result;
  });

  return grants;
}

/**
 * getTips()
 * Возвращает все советы/рекомендации
 */
function getTips() {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, title, category, content, tip
    FROM tips
    ORDER BY id ASC
  `);

  return stmt.all();
}

/**
 * getCities()
 * Возвращает список городов с количеством университетов
 */
function getCities() {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT 
      c.id,
      c.name,
      COUNT(u.id) as count
    FROM cities c
    LEFT JOIN universities u ON c.id = u.city_id
    GROUP BY c.id, c.name
    ORDER BY count DESC, c.name ASC
  `);

  return stmt.all();
}

/**
 * getUniversitiesContext()
 * Возвращает краткий текстовый контекст всех университетов для ИИ
 * Используется в AI advisor'е
 */
function getUniversitiesContext() {
  const unis = getUniversities();
  return unis.map(u =>
    `${u.short_name}: ${(u.price_from/1000000).toFixed(1)}-${(u.price_to/1000000).toFixed(1)}млн тг/год, QS:${u.qs_world||u.qs_asia||'-'}, зарплата выпускников: ${u.avg_salary ? Math.round(u.avg_salary/1000)+'K тг/мес' : 'нет данных'}`
  ).join('; ');
}

module.exports = {
  getUniversities,
  getUniversity,
  getSpecialtyCategories,
  getGrants,
  getTips,
  getUniversitiesContext,
  getCities
};