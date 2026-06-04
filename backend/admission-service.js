/**
 * Admission Predictor — rule-based scoring (v1)
 */

const { getDb } = require('./database');

/** Ключ формы → категория специальности в БД */
const SPECIALTY_MAP = {
  IT: 'Информационные технологии',
  'Информационные технологии': 'Информационные технологии',
  'Computer Science': 'Информационные технологии',
  Экономика: 'Бизнес',
  Бизнес: 'Бизнес',
  Медицина: 'Медицина',
  Право: 'Общественные науки',
  Инженерия: 'Инженерия',
  Гуманитарные: 'Гуманитарные науки',
  'Гуманитарные науки': 'Гуманитарные науки',
  Образование: 'Образование',
  'Естественные науки': 'Естественные науки',
  Искусство: 'Искусство',
  Туризм: 'Туризм',
};

const LANG_MAP = {
  английский: 'английский',
  English: 'английский',
  Английский: 'английский',
  русский: 'русский',
  Russian: 'русский',
  Русский: 'русский',
  казахский: 'казахский',
  Kazakh: 'казахский',
  Казахский: 'казахский',
};

function normalizeSpecialty(input) {
  if (!input) return null;
  const key = String(input).trim();
  return SPECIALTY_MAP[key] || key;
}

function normalizeLanguage(input) {
  if (!input) return null;
  return LANG_MAP[String(input).trim()] || String(input).trim().toLowerCase();
}

function scoreToChance(total) {
  const t = Math.max(0, Math.min(100, total));
  if (t >= 92) return 95;
  if (t >= 84) return 88;
  if (t >= 76) return 80;
  if (t >= 68) return 74;
  if (t >= 58) return 65;
  if (t >= 48) return 55;
  if (t >= 38) return 45;
  if (t >= 28) return 35;
  return Math.max(15, Math.round(t * 0.75));
}

function recommendationLabel(chance) {
  if (chance >= 85) return 'Высокая вероятность поступления';
  if (chance >= 70) return 'Хорошие шансы, рассмотрите как основной вариант';
  if (chance >= 55) return 'Реалистичный вариант на платное отделение';
  return 'Низкая вероятность — нужен запасной план';
}

function scoreEnt(ent, req) {
  const { min_ent, avg_ent, grant_min_ent } = req;
  if (ent >= grant_min_ent) return 40;
  if (ent >= avg_ent) {
    const span = Math.max(1, grant_min_ent - avg_ent);
    return 32 + Math.round(((ent - avg_ent) / span) * 7);
  }
  if (ent >= min_ent) {
    const range = Math.max(1, avg_ent - min_ent);
    return 14 + Math.round(((ent - min_ent) / range) * 16);
  }
  if (min_ent <= 0) return 8;
  return Math.max(0, Math.round((ent / min_ent) * 14));
}

function grantGapPenalty(ent, grantMinEnt) {
  if (!grantMinEnt || ent >= grantMinEnt) return 0;
  const gap = grantMinEnt - ent;
  return Math.min(28, Math.round(gap * 1.4));
}

function belowMinPenalty(ent, minEnt) {
  if (!minEnt || ent >= minEnt) return 0;
  return Math.min(18, Math.round((minEnt - ent) * 1.2));
}

function competitionPenalty(level) {
  const comp = level || 3;
  return Math.max(0, (comp - 2) * 3);
}

function scoreBudget(budget, priceFrom, priceTo) {
  if (!budget) return 8;
  if (priceFrom <= budget) return 15;
  if (priceFrom <= budget * 1.15) return 8;
  return -20;
}

function scoreLanguage(lang, universityLanguages) {
  if (!lang) return 5;
  const langs = universityLanguages || [];
  if (langs.some(l => l.toLowerCase() === lang)) return 10;
  return 0;
}

function scoreDorm(needDorm, hasDorm) {
  if (!needDorm) return 5;
  return hasDorm ? 10 : -15;
}

function scoreSpecialty(hasProgram, competitionLevel) {
  if (!hasProgram) return 0;
  const comp = competitionLevel || 3;
  return Math.max(12, 28 - comp * 2);
}

function scoreAttestat(attestat) {
  if (!attestat || attestat <= 0) return 0;
  if (attestat >= 4.8) return 5;
  if (attestat >= 4.3) return 3;
  if (attestat >= 3.5) return 1;
  return 0;
}

function buildReasons(parts, req, ent) {
  const reasons = [];
  if (parts.ent >= 30) reasons.push({ type: 'positive', text: 'Ваш балл ЕНТ выше порога для этого направления' });
  else if (parts.ent > 0) reasons.push({ type: 'neutral', text: `ЕНТ близок к минимуму (${req.min_ent}+)` });
  else reasons.push({ type: 'negative', text: `ЕНТ ниже минимального порога (${req.min_ent})` });

  if (parts.budget >= 12) reasons.push({ type: 'positive', text: 'Стоимость входит в ваш бюджет' });
  else if (parts.budget < 0) reasons.push({ type: 'negative', text: 'Стоимость выше указанного бюджета' });

  if (parts.lang >= 10) reasons.push({ type: 'positive', text: 'Есть обучение на выбранном языке' });
  else if (parts.lang === 0 && parts.langMax === 10) reasons.push({ type: 'negative', text: 'Выбранный язык обучения не подтверждён' });

  if (parts.dorm >= 10) reasons.push({ type: 'positive', text: 'Есть общежитие' });
  else if (parts.dorm < 0) reasons.push({ type: 'negative', text: 'Общежитие не указано в данных вуза' });

  if (parts.spec >= 20) reasons.push({ type: 'positive', text: 'Вуз силён в выбранной области' });

  if (ent >= req.grant_min_ent) {
    reasons.push({ type: 'positive', text: `Есть шанс на грант (порог ~${req.grant_min_ent} баллов)` });
  } else if (ent < req.avg_ent) {
    reasons.push({ type: 'negative', text: `ЕНТ ниже среднего балла поступивших (~${req.avg_ent})` });
  }

  return reasons;
}

/**
 * @param {object} params
 * @returns {object}
 */
function getAdmissionPrediction(params) {
  const ent = parseInt(params.ent, 10);
  const budget = params.budget ? parseInt(params.budget, 10) : null;
  const cityId = params.cityId ? parseInt(params.cityId, 10) : null;
  const specialtyCategory = normalizeSpecialty(params.specialty);
  const language = normalizeLanguage(params.language);
  const needDorm = Boolean(params.needDorm);
  const attestat = params.attestat ? parseFloat(params.attestat) : null;

  if (!ent || ent < 0 || ent > 140) {
    return { success: false, error: 'Укажите балл ЕНТ от 0 до 140' };
  }
  if (!specialtyCategory) {
    return { success: false, error: 'Выберите специальность' };
  }

  const db = getDb();

  let query = `
    SELECT
      ar.*,
      u.id AS university_id,
      u.name, u.short_name, u.price_from, u.price_to,
      u.languages, u.has_dorm, u.qs_world, u.city_id,
      c.name AS city_name,
      s.name AS specialty_name,
      s.category AS specialty_category
    FROM admission_requirements ar
    JOIN universities u ON ar.university_id = u.id
    JOIN specialties s ON ar.specialty_id = s.id
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE s.category = ?
  `;
  const queryParams = [specialtyCategory];

  if (cityId) {
    query += ' AND u.city_id = ?';
    queryParams.push(cityId);
  }

  const candidates = db.prepare(query).all(...queryParams);

  if (!candidates.length) {
    return {
      success: true,
      matches: [],
      message: 'Нет данных по этой специальности. Попробуйте другой город или направление.',
      input: { ent, specialty: specialtyCategory, budget, language, needDorm, cityId, attestat }
    };
  }

  const byUniversity = new Map();

  for (const row of candidates) {
    const langs = row.languages ? JSON.parse(row.languages) : [];
    const parts = {
      ent: scoreEnt(ent, row),
      budget: scoreBudget(budget, row.price_from, row.price_to),
      lang: scoreLanguage(language, langs),
      langMax: language ? 10 : 5,
      dorm: scoreDorm(needDorm, row.has_dorm === 1),
      spec: scoreSpecialty(true, row.competition_level),
      attestat: scoreAttestat(attestat),
    };

    const penalties = grantGapPenalty(ent, row.grant_min_ent)
      + belowMinPenalty(ent, row.min_ent)
      + competitionPenalty(row.competition_level);

    const total = Math.max(0, Math.min(100,
      parts.ent + parts.budget + parts.lang + parts.dorm + parts.spec + parts.attestat - penalties
    ));
    const chance = scoreToChance(total);
    const reasons = buildReasons(parts, row, ent);

    const existing = byUniversity.get(row.university_id);
    if (!existing || total > existing.score) {
      byUniversity.set(row.university_id, {
        university_id: row.university_id,
        university: row.short_name,
        name: row.name,
        city_name: row.city_name,
        price_from: row.price_from,
        price_to: row.price_to,
        qs_world: row.qs_world,
        chance,
        score: total,
        recommendation: recommendationLabel(chance),
        reasons,
        requirement: {
          min_ent: row.min_ent,
          avg_ent: row.avg_ent,
          grant_min_ent: row.grant_min_ent,
          competition_level: row.competition_level,
        },
        specialty_name: row.specialty_name,
      });
    }
  }

  const allSorted = [...byUniversity.values()]
    .sort((a, b) => b.chance - a.chance || b.score - a.score);

  const pinnedIds = [1, 32, 2];
  const matches = allSorted.slice(0, 12);
  const seen = new Set(matches.map((m) => m.university_id));
  for (const id of pinnedIds) {
    if (seen.has(id)) continue;
    const extra = allSorted.find((m) => m.university_id === id);
    if (extra) {
      matches.push(extra);
      seen.add(id);
    }
  }
  matches.sort((a, b) => b.chance - a.chance || b.score - a.score);
  if (matches.length > 15) matches.length = 15;

  return {
    success: true,
    matches,
    input: {
      ent,
      specialty: specialtyCategory,
      budget,
      language,
      needDorm,
      cityId,
      attestat,
    },
  };
}

function savePredictionHistory(userId, input, matches) {
  if (!userId || !matches.length) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO prediction_history (user_id, ent, specialty_category, university_id, predicted_chance)
    VALUES (?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const m of matches.slice(0, 5)) {
      stmt.run(userId, input.ent, input.specialty, m.university_id, m.chance);
    }
  });
  tx();
}

async function explainAdmissionChance(payload) {
  const {
    university, name, chance, ent, reasons, requirement, budget, language, needDorm,
  } = payload;

  const reasonText = (reasons || [])
    .map(r => `${r.type === 'positive' ? '✓' : r.type === 'negative' ? '✗' : '•'} ${r.text}`)
    .join('\n');

  const systemPrompt = `Ты консультант EduMatch KZ по поступлению в вузы Казахстана.
Объясни абитуриенту простым русским языком (3–5 коротких абзацев), без воды.
Не придумывай факты — опирайся только на переданные данные.`;

  const userMessage = `Вуз: ${name} (${university})
Вероятность поступления: ${chance}%
Балл ЕНТ абитуриента: ${ent}
Минимальный ЕНТ: ${requirement?.min_ent}, средний: ${requirement?.avg_ent}, на грант: ${requirement?.grant_min_ent}
Бюджет: ${budget ? budget + ' ₸/год' : 'не указан'}
Язык: ${language || 'любой'}
Нужно общежитие: ${needDorm ? 'да' : 'нет'}

Факторы:
${reasonText}

Дай рекомендацию: стоит ли подавать документы в этот вуз и что улучшить.`;

  const { callOpenRouter } = require('./ai-service');
  const result = await callOpenRouter(systemPrompt, userMessage, []);
  return result.text;
}

module.exports = {
  getAdmissionPrediction,
  savePredictionHistory,
  explainAdmissionChance,
  normalizeSpecialty,
  SPECIALTY_MAP,
};
