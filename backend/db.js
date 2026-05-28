/**
 * db.js
 * Data access layer для EduMatchKZ
 * Использует SQLite, но сохраняет текущее API без изменений
 * 
 * Этот слой скрывает детали хранения и возвращает данные в знакомом формате
 */

const { getDb } = require('./database');

/**
 * getUniversities({ sort, price_max, specialty, language })
 * 
 * Возвращает массив университетов с фильтрацией и сортировкой
 * Совместимо со старым API
 */
function getUniversities({ sort, price_max, specialty, language } = {}) {
  const db = getDb();
  
  let query = `
    SELECT DISTINCT
      u.id, u.name, u.short_name, u.city_id, u.qs_world, u.qs_asia,
      u.price_from, u.price_to, u.website, u.description, u.founded,
      u.students_count, u.languages, u.accreditations, u.has_dorm,
      u.dorm_price, u.avg_salary, u.lat, u.lng,
      c.name as city_name
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
  `;

  const conditions = [];
  const params = [];

  // Фильтр по цене
  if (price_max) {
    conditions.push('u.price_from <= ?');
    params.push(parseInt(price_max));
  }

  // Фильтр по языку
  if (language) {
    conditions.push(`u.languages LIKE ?`);
    params.push(`%${language}%`);
  }

  // Фильтр по специальности (по названию или категории)
  if (specialty) {
    query += `
      LEFT JOIN university_specialties us ON u.id = us.university_id
      LEFT JOIN specialties s ON us.specialty_id = s.id
    `;
    conditions.push(`(s.name = ? OR s.category = ?)`);
    params.push(specialty, specialty);
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

    // Парсим JSON поля
    const languages = u.languages ? JSON.parse(u.languages) : [];
    const accreditations = u.accreditations ? JSON.parse(u.accreditations) : [];

    return {
      ...u,
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
function getUniversity(id) {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT
      u.id, u.name, u.short_name, u.city_id, u.qs_world, u.qs_asia,
      u.price_from, u.price_to, u.website, u.description, u.founded,
      u.students_count, u.languages, u.accreditations, u.has_dorm,
      u.dorm_price, u.avg_salary, u.lat, u.lng,
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

  // Парсим JSON поля
  const languages = u.languages ? JSON.parse(u.languages) : [];
  const accreditations = u.accreditations ? JSON.parse(u.accreditations) : [];

  return {
    ...u,
    languages,
    accreditations,
    specialties,
    city_name: u.city_name || 'Алматы',
    has_dorm: u.has_dorm === 1
  };
}

/**
 * getSpecialtyCategories()
 * Возвращает отсортированный массив уникальных категорий специальностей
 */
function getSpecialtyCategories() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT DISTINCT category
    FROM specialties
    ORDER BY category ASC
  `);
  return stmt.all().map(row => row.category);
}

/**
 * getGrants()
 * Возвращает все гранты с информацией о связанных специальностях
 * 
 * Note: Гранты могут быть связаны со специальностями.
 * Для совместимости с текущим API возвращаем specialty_ids, если они есть.
 */
function getGrants() {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT
      g.id, g.name, g.type, g.amount, g.description, g.requirements, g.deadline, g.link
    FROM grants g
    ORDER BY g.id ASC
  `);

  let grants = stmt.all();

  // Постобработка: добавляем specialty_ids, если они есть
  grants = grants.map(g => {
    const specialtiesStmt = db.prepare(`
      SELECT specialty_id
      FROM grant_specialties
      WHERE grant_id = ?
    `);
    const specialtyRows = specialtiesStmt.all(g.id);
    const specialty_ids = specialtyRows.map(row => row.specialty_id);

    // Парсим JSON поля
    const requirements = g.requirements ? JSON.parse(g.requirements) : [];

    const result = {
      ...g,
      requirements
    };

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
  getUniversitiesContext
};