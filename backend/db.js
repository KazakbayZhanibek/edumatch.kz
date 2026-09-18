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
      u.admission_phone, u.admission_email, u.data_status, u.address,
      u.is_free,
      c.name as city_name
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
  `;

  const conditions = ["COALESCE(u.data_status, 'active') = 'active'"];
  const params = [];

  // ТОП-20: 20 лучших по QS (мировой → азиатский → число студентов)
  if (is_top === 'top') {
    conditions.push(`u.id IN (
      SELECT id FROM universities
      WHERE COALESCE(data_status, 'active') = 'active'
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

  // Оптимизация: вместо отдельных запросов для специальностей,
  // получаем их все одним запросом (избегаем N+1 проблемы)
  const allSpecialties = db.prepare(`
    SELECT DISTINCT
      us.university_id,
      s.id,
      s.name,
      s.category
    FROM university_specialties us
    JOIN specialties s ON us.specialty_id = s.id
  `).all();

  // Группируем специальности по университету
  const specialtiesByUni = {};
  allSpecialties.forEach(spec => {
    if (!specialtiesByUni[spec.university_id]) {
      specialtiesByUni[spec.university_id] = [];
    }
    specialtiesByUni[spec.university_id].push({
      id: spec.id,
      name: spec.name,
      category: spec.category
    });
  });

  const stmt = db.prepare(query);
  let unis = stmt.all(...params);

  // Постобработка: добавляем specialties массив из кеша
  unis = unis.map(u => {
    // Парсим JSON поля с error handling
    let languages = [];
    let accreditations = [];
    
    try {
      if (!u.languages) {
        languages = [];
      } else if (Array.isArray(u.languages)) {
        languages = u.languages;
      } else {
        const parsed = JSON.parse(u.languages);
        languages = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) {
      // Comma-separated string format (e.g. "ru,kk,en")
      languages = u.languages.split(',').map(s => s.trim()).filter(Boolean);
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
      specialties: specialtiesByUni[u.id] || [],
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
      u.admission_phone, u.admission_email, u.admission_whatsapp, u.data_status, u.address,
      u.is_free,
      c.name as city_name
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE u.id = ? AND COALESCE(u.data_status, 'active') = 'active'
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
    if (!u.languages) {
      languages = [];
    } else if (Array.isArray(u.languages)) {
      languages = u.languages;
    } else {
      const parsed = JSON.parse(u.languages);
      languages = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (e) {
    languages = u.languages.split(',').map(s => s.trim()).filter(Boolean);
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
    SELECT DISTINCT s.id, s.name, s.code, s.category
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
      g.deadline, g.link, g.source_url, g.source_title, g.verification_status, g.verified_at,
      g.academic_year, g.university_id, g.city_id, g.is_active,
      u.name AS university_name, c.name AS city_name
    FROM grants g
    LEFT JOIN universities u ON u.id = g.university_id
    LEFT JOIN cities c ON c.id = g.city_id
    WHERE g.is_active = 1 OR g.is_active IS NULL
    ORDER BY g.deadline ASC NULLS LAST, g.id ASC
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
      if (!Array.isArray(requirements)) requirements = [];
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
 * Consolidated read model for the admission opportunities page.
 * It intentionally returns stored facts, not an admission decision.
 */
function getAdmissionOpportunities({ lang } = {}) {
  const db = getDb();
  const universities = getUniversities({ lang });
  const grants = getGrants({ lang });
  const specialties = getSpecialtyCategories();
  const requirements = db.prepare(`
    SELECT ar.university_id, ar.specialty_id, ar.min_ent, ar.avg_ent,
           ar.grant_min_ent, ar.competition_level, ar.academic_year,
           s.name AS specialty_name, s.code AS specialty_code, s.category
    FROM admission_requirements ar
    JOIN specialties s ON s.id = ar.specialty_id
    JOIN universities u ON u.id = ar.university_id
    WHERE COALESCE(u.data_status, 'active') = 'active'
    ORDER BY ar.university_id, s.category, s.name
  `).all();

  const requirementsByUniversity = new Map();
  for (const requirement of requirements) {
    if (!requirementsByUniversity.has(requirement.university_id)) requirementsByUniversity.set(requirement.university_id, []);
    requirementsByUniversity.get(requirement.university_id).push(requirement);
  }
  const grantsByUniversity = new Map();
  for (const grant of grants) {
    if (!grant.university_id) continue;
    if (!grantsByUniversity.has(grant.university_id)) grantsByUniversity.set(grant.university_id, []);
    grantsByUniversity.get(grant.university_id).push(grant);
  }

  return {
    universities: universities.map(university => ({
      ...university,
      requirements: requirementsByUniversity.get(university.id) || [],
      grants: grantsByUniversity.get(university.id) || [],
    })),
    specialties,
    grants,
    meta: {
      universityCount: universities.length,
      grantCount: grants.length,
      requirementCount: requirements.length,
      academicYears: [...new Set([...requirements.map(row => row.academic_year), ...grants.map(row => row.academic_year)].filter(Boolean))].sort().reverse(),
      note: 'Stored catalogue data; applicants must verify current rules with official sources.',
    },
  };
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
  getAdmissionOpportunities,
  getTips,
  getUniversitiesContext,
  getCities
};
