/*
 * Admission Calculator Engine — детерминированный расчет без AI
 * 
 * Использует историческую статистику из admission_chance_stats
 * Основан на правилах и историческим данным (hybrid подход)
 */

const { getDb } = require('./database');

// ==================== VALIDATION ====================

/**
 * Валидирует входные данные для расчета
 * @param {object} input
 * @returns {object} { valid: boolean, error?: string, data?: validated }
 */
function validateAdmissionInput(input) {
  const errors = [];

  // entScore
  const entScore = parseInt(input.entScore, 10);
  if (!Number.isInteger(entScore) || entScore < 0 || entScore > 140) {
    errors.push('entScore должен быть от 0 до 140');
  }

  // gpa
  let gpa = null;
  if (input.gpa !== undefined && input.gpa !== null) {
    gpa = parseFloat(input.gpa);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > 5) {
      errors.push('gpa должна быть от 0 до 5');
    }
  }

  // specialtyId
  const specialtyId = parseInt(input.specialtyId, 10);
  if (!Number.isInteger(specialtyId) || specialtyId <= 0) {
    errors.push('specialtyId должен быть положительным числом');
  }

  // cityId (optional)
  let cityId = null;
  if (input.cityId) {
    cityId = parseInt(input.cityId, 10);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      errors.push('cityId должен быть положительным числом');
    }
  }

  // budgetMax (optional)
  let budgetMax = null;
  if (input.budgetMax) {
    budgetMax = parseInt(input.budgetMax, 10);
    if (!Number.isInteger(budgetMax) || budgetMax < 0) {
      errors.push('budgetMax должен быть неотрицательным числом');
    }
  }

  // language (optional)
  let language = null;
  if (input.language) {
    const langStr = String(input.language).trim().toLowerCase();
    const validLangs = ['казахский', 'русский', 'английский', 'kk', 'ru', 'en'];
    if (!validLangs.includes(langStr)) {
      errors.push('language должен быть одним из: казахский, русский, английский');
    }
    language = langStr;
  }

  // needsDorm (optional, boolean)
  const needsDorm = Boolean(input.needsDorm);

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; ')
    };
  }

  return {
    valid: true,
    data: {
      entScore,
      gpa,
      specialtyId,
      cityId,
      budgetMax,
      language,
      needsDorm
    }
  };
}

// ==================== HISTORICAL STATS LOOKUP ====================

/**
 * Ищет историческую статистику для заданного поступления
 * @param {object} query - { entScore, gpa, specialtyId, cityId, budgetMax, language, needsDorm }
 * @returns {array} - массив matching rows из admission_chance_stats
 */
function findHistoricalStats(query) {
  const db = getDb();
  const {
    entScore, gpa, specialtyId, cityId, budgetMax, language, needsDorm
  } = query;

  const currentYear = new Date().getFullYear();

  // Ищем точные совпадения по specialtyId
  let sql = `
    SELECT *
    FROM admission_chance_stats
    WHERE specialty_id = ?
      AND year = ?
      AND ent_score_from <= ?
      AND ent_score_to >= ?
  `;
  const params = [specialtyId, currentYear, entScore, entScore];

  // Фильтруем по городу (если указан)
  if (cityId) {
    sql += ` AND (city_id = ? OR city_id IS NULL)`;
    params.push(cityId);
  }

  // Фильтруем по языку (если указан)
  if (language) {
    sql += ` AND (language = ? OR language IS NULL)`;
    params.push(language);
  }

  // Фильтруем по бюджету (если указан)
  if (budgetMax) {
    sql += ` AND (budget_max IS NULL OR budget_max >= ?)`;
    params.push(budgetMax);
  }

  // Фильтруем по общежитию (если нужно)
  if (needsDorm) {
    sql += ` AND (requires_dorm_support IS NULL OR requires_dorm_support = 1)`;
  }

  // Фильтруем по GPA, если есть
  if (gpa !== null) {
    sql += ` AND (gpa_from IS NULL OR gpa_from <= ?)`;
    params.push(gpa);
    sql += ` AND (gpa_to IS NULL OR gpa_to >= ?)`;
    params.push(gpa);
  }

  sql += ` ORDER BY confidence_level DESC, applicants_count DESC`;

  const stmt = db.prepare(sql);
  const results = stmt.all(...params);

  return results;
}

// ==================== RULES-BASED SCORING ====================

/**
 * Расчитывает шанс поступления на основе правил (fallback)
 * @param {object} input - { entScore, gpa, specialtyId, ... }
 * @param {object} universityData - { id, price_from, price_to, languages, has_dorm, ... }
 * @returns {number} - chance percentage (0-95)
 */
function calculateRulesScore(input, universityData) {
  const { entScore, gpa, budgetMax, language, needsDorm } = input;
  let score = 50; // базовое значение

  // ENT score - основной фактор
  if (entScore >= 120) score += 25;
  else if (entScore >= 100) score += 15;
  else if (entScore >= 80) score += 5;
  else if (entScore >= 60) score -= 5;
  else score -= 15;

  // GPA
  if (gpa) {
    if (gpa >= 4.5) score += 8;
    else if (gpa >= 4.0) score += 5;
    else if (gpa >= 3.5) score += 2;
    else if (gpa < 3.0) score -= 5;
  }

  // Budget
  if (universityData && budgetMax) {
    if (budgetMax >= universityData.price_from) {
      score += 10;
    } else if (budgetMax >= universityData.price_from * 0.85) {
      score += 0;
    } else {
      score -= 15;
    }
  }

  // Language
  if (language && universityData && universityData.languages) {
    const langs = universityData.languages;
    if (typeof langs === 'string') {
      if (langs.toLowerCase().includes(language)) {
        score += 5;
      }
    } else if (Array.isArray(langs)) {
      if (langs.some(l => String(l).toLowerCase().includes(language))) {
        score += 5;
      }
    }
  }

  // Dorm
  if (needsDorm && universityData) {
    if (universityData.has_dorm === 1) {
      score += 5;
    } else {
      score -= 10;
    }
  }

  return Math.max(0, Math.min(95, score));
}

// ==================== MODIFIERS ====================

/**
 * Применяет модификатор за бюджет
 * @param {number} baseChance
 * @param {number} budgetMax
 * @param {number} priceFrom
 * @returns {number}
 */
function applyBudgetModifier(baseChance, budgetMax, priceFrom) {
  if (!budgetMax || !priceFrom) return baseChance;

  if (budgetMax >= priceFrom) {
    return Math.min(95, baseChance + 3);
  } else if (budgetMax >= priceFrom * 0.9) {
    return baseChance;
  } else if (budgetMax >= priceFrom * 0.75) {
    return Math.max(0, baseChance - 5);
  } else {
    return Math.max(0, baseChance - 15);
  }
}

/**
 * Применяет модификатор за общежитие
 * @param {number} baseChance
 * @param {boolean} needsDorm
 * @param {number} hasDorm
 * @returns {number}
 */
function applyDormModifier(baseChance, needsDorm, hasDorm) {
  if (!needsDorm) return baseChance;
  if (hasDorm === 1) {
    return Math.min(95, baseChance + 2);
  } else {
    return Math.max(0, baseChance - 8);
  }
}

/**
 * Применяет модификатор за язык
 * @param {number} baseChance
 * @param {string} language
 * @param {array|string} universityLanguages
 * @returns {number}
 */
function applyLanguageModifier(baseChance, language, universityLanguages) {
  if (!language || !universityLanguages) return baseChance;

  const langs = Array.isArray(universityLanguages)
    ? universityLanguages.map(l => String(l).toLowerCase())
    : String(universityLanguages).toLowerCase().split(',').map(l => l.trim());

  if (langs.some(l => l.includes(language))) {
    return Math.min(95, baseChance + 2);
  } else {
    return Math.max(0, baseChance - 5);
  }
}

/**
 * Применяет модификатор за GPA
 * @param {number} baseChance
 * @param {number} gpa
 * @param {number} gpaFrom
 * @param {number} gpaTo
 * @returns {number}
 */
function applyGpaModifier(baseChance, gpa, gpaFrom, gpaTo) {
  if (!gpa) return baseChance;

  if (gpaFrom && gpa < gpaFrom) {
    return Math.max(0, baseChance - 10);
  }
  if (gpaTo && gpa > gpaTo) {
    return Math.min(95, baseChance + 3);
  }

  return baseChance;
}

/**
 * Применяет бонус за confidence level исторических данных
 * @param {number} baseChance
 * @param {string} confidenceLevel
 * @returns {number}
 */
function applyConfidenceModifier(baseChance, confidenceLevel) {
  // Если данные low confidence, немного снижаем шансы
  // high/medium - оставляем как есть
  if (confidenceLevel === 'low') {
    return Math.max(0, baseChance - 3);
  }
  if (confidenceLevel === 'high') {
    return Math.min(95, baseChance + 2);
  }
  return baseChance;
}

// ==================== NORMALIZATION & REASONING ====================

/**
 * Нормализует chance в диапазон 0-95
 * @param {number} chance
 * @returns {number}
 */
function normalizeChance(chance) {
  return Math.max(0, Math.min(95, Math.round(chance)));
}

/**
 * Строит объяснение расчета
 * @param {object} data
 * @returns {array}
 */
function buildReasoning(data) {
  const {
    entScore, gpa, calculationMode, historicalMatch, university,
    budgetMatch, dormMatch, languageMatch, competitionLevel
  } = data;

  const reasoning = [];

  // ENT score
  if (entScore >= 120) {
    reasoning.push(`ЕНТ ${entScore} — выше среднего, хороший результат`);
  } else if (entScore >= 100) {
    reasoning.push(`ЕНТ ${entScore} — приемлемый результат`);
  } else if (entScore >= 80) {
    reasoning.push(`ЕНТ ${entScore} — ниже среднего, требуется внимание`);
  } else {
    reasoning.push(`ЕНТ ${entScore} — значительно ниже требований`);
  }

  // GPA
  if (gpa) {
    if (gpa >= 4.5) {
      reasoning.push(`GPA ${gpa} — отличный школьный результат`);
    } else if (gpa >= 4.0) {
      reasoning.push(`GPA ${gpa} — хороший школьный результат`);
    } else if (gpa >= 3.5) {
      reasoning.push(`GPA ${gpa} — удовлетворительный результат`);
    }
  }

  // Историческая статистика
  if (calculationMode === 'hybrid' && historicalMatch) {
    reasoning.push(`Используется историческая статистика (шанс ${historicalMatch.chance_percent}% в ${historicalMatch.year} году)`);
    if (historicalMatch.applicants_count && historicalMatch.admitted_count) {
      const ratio = Math.round((historicalMatch.admitted_count / historicalMatch.applicants_count) * 100);
      reasoning.push(`Конкурс: ~${historicalMatch.applicants_count} абитуриентов, принято ${historicalMatch.admitted_count} (${ratio}%)`);
    }
  }

  // Budget
  if (budgetMatch) {
    reasoning.push(`Стоимость обучения совпадает с вашим бюджетом`);
  } else if (university && university.price_from) {
    reasoning.push(`Стоимость обучения: ${university.price_from}₸/год`);
  }

  // Dorm
  if (dormMatch === true) {
    reasoning.push(`Общежитие доступно`);
  } else if (dormMatch === false) {
    reasoning.push(`Общежитие не указано для этого вуза`);
  }

  // Language
  if (languageMatch) {
    reasoning.push(`Обучение на выбранном языке доступно`);
  }

  // Competition level
  if (competitionLevel) {
    reasoning.push(`Уровень конкуренции: ${competitionLevel}`);
  }

  return reasoning;
}

// ==================== MAIN CALCULATION ====================

/**
 * Основная функция расчета шанса поступления
 * @param {object} input - { entScore, gpa, cityId, specialtyId, budgetMax, language, needsDorm }
 * @returns {object} - { matches: [], summary: {} }
 */
function calculateAdmissionChance(input) {
  // Валидация
  const validation = validateAdmissionInput(input);
  if (!validation.valid) {
    return {
      matches: [],
      error: validation.error,
      summary: { totalMatches: 0 }
    };
  }

  const query = validation.data;
  const db = getDb();

  // Получаем университеты по специальности
  let universitySql = `
    SELECT DISTINCT
      u.id, u.name, u.short_name, u.city_id, u.price_from, u.price_to,
      u.languages, u.has_dorm, u.qs_world,
      u.admission_phone, u.admission_email, u.admission_whatsapp,
      c.name as city_name,
      s.name as specialty_name
    FROM universities u
    JOIN university_specialties us ON u.id = us.university_id
    JOIN specialties s ON us.specialty_id = s.id
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE us.specialty_id = ?
  `;
  const universityParams = [query.specialtyId];

  if (query.cityId) {
    universitySql += ` AND u.city_id = ?`;
    universityParams.push(query.cityId);
  }

  const universities = db.prepare(universitySql).all(...universityParams);

  if (!universities.length) {
    return {
      matches: [],
      error: 'Не найдено университетов для выбранной специальности',
      summary: { totalMatches: 0 }
    };
  }

  const matches = [];

  // Для каждого университета расчитываем шанс
  for (const uni of universities) {
    // Ищем историческую статистику
    const historicalStats = findHistoricalStats({
      ...query,
      cityId: uni.city_id || query.cityId
    });

    let chancePercent = 50;
    let calculationMode = 'rules_only';
    let historicalStatsUsed = false;
    let historicalMatch = null;
    let confidenceLevel = 'medium';

    if (historicalStats.length > 0) {
      // Используем историческую статистику
      historicalMatch = historicalStats[0];
      chancePercent = historicalMatch.chance_percent;
      calculationMode = 'hybrid';
      historicalStatsUsed = true;
      confidenceLevel = historicalMatch.confidence_level || 'medium';

      // Применяем модификаторы
      if (query.budgetMax) {
        chancePercent = applyBudgetModifier(
          chancePercent,
          query.budgetMax,
          uni.price_from
        );
      }

      if (query.needsDorm) {
        chancePercent = applyDormModifier(
          chancePercent,
          query.needsDorm,
          uni.has_dorm
        );
      }

      if (query.language) {
        chancePercent = applyLanguageModifier(
          chancePercent,
          query.language,
          uni.languages
        );
      }

      if (query.gpa && historicalMatch.gpa_from) {
        chancePercent = applyGpaModifier(
          chancePercent,
          query.gpa,
          historicalMatch.gpa_from,
          historicalMatch.gpa_to
        );
      }

      // Применяем modifier за confidence level
      chancePercent = applyConfidenceModifier(chancePercent, confidenceLevel);
    } else {
      // Fallback к правилам
      chancePercent = calculateRulesScore(query, uni);
      calculationMode = 'rules_only';
      historicalStatsUsed = false;
      confidenceLevel = 'low';

      // Применяем модификаторы и для rules mode
      if (query.budgetMax) {
        chancePercent = applyBudgetModifier(
          chancePercent,
          query.budgetMax,
          uni.price_from
        );
      }

      if (query.needsDorm) {
        chancePercent = applyDormModifier(
          chancePercent,
          query.needsDorm,
          uni.has_dorm
        );
      }

      if (query.language) {
        chancePercent = applyLanguageModifier(
          chancePercent,
          query.language,
          uni.languages
        );
      }
    }

    // Нормализуем шанс
    chancePercent = normalizeChance(chancePercent);

    // Строим reasoning
    const budgetMatch = query.budgetMax && uni.price_from <= query.budgetMax;
    const dormMatch = query.needsDorm === true
      ? uni.has_dorm === 1
      : uni.has_dorm === 1 ? true : null;
    const languageMatch = query.language && uni.languages
      ? String(uni.languages).toLowerCase().includes(query.language)
      : false;

    const reasoning = buildReasoning({
      entScore: query.entScore,
      gpa: query.gpa,
      calculationMode,
      historicalMatch,
      university: uni,
      budgetMatch,
      dormMatch,
      languageMatch
    });

    matches.push({
      universityId: uni.id,
      universityName: uni.short_name || uni.name,
      universityCity: uni.city_name,
      specialtyId: query.specialtyId,
      specialtyName: uni.specialty_name,
      chancePercent,
      confidenceLevel,
      calculationMode,
      matchType: historicalStatsUsed ? 'exact' : 'estimated',
      historicalStatsUsed,
      reasoning,
      contacts: {
        phone: uni.admission_phone,
        email: uni.admission_email,
        whatsapp: uni.admission_whatsapp
      }
    });
  }

  // Сортируем по шансам
  matches.sort((a, b) => b.chancePercent - a.chancePercent);

  // DEBUG: verify contacts are included
  if (matches.length > 0 && process.env.DEBUG) {
    console.log('[calc-DEBUG] Returning matches with contacts:', matches[0].contacts ? 'YES' : 'NO');
  }

  return {
    success: true,
    matches,
    summary: {
      totalMatches: matches.length,
      bestChance: matches.length > 0 ? matches[0].chancePercent : 0,
      calculationDate: new Date().toISOString()
    }
  };
}

module.exports = {
  validateAdmissionInput,
  findHistoricalStats,
  calculateRulesScore,
  applyBudgetModifier,
  applyDormModifier,
  applyLanguageModifier,
  applyGpaModifier,
  applyConfidenceModifier,
  normalizeChance,
  buildReasoning,
  calculateAdmissionChance
};
