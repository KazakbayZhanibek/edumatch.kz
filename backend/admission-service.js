/**
 * Admission Predictor — rule-based scoring (v1)
 */

const { getDb } = require('./database');
const { tr } = require('./i18n');

/** Ключ формы → категория специальности в БД */
const SPECIALTY_MAP = {
  IT: 'Информационные технологии',
  'Информационные технологии': 'Информационные технологии',
  'Computer Science': 'Информационные технологии',
  Экономика: 'Бизнес',
  Бизнес: 'Бизнес',
  'Бизнес и менеджмент': 'Бизнес',
  Медицина: 'Медицина',
  Право: 'Гуманитарные науки',
  Инженерия: 'Инженерия',
  Гуманитарные: 'Гуманитарные науки',
  'Гуманитарные науки': 'Гуманитарные науки',
  Образование: 'Образование',
  'Естественные науки': 'Естественные науки',
  Искусство: 'Искусство',
  Туризм: 'Туризм',
  Психология: 'Здоровье',
  Здоровье: 'Здоровье',
  Фармацевтика: 'Медицина',
  'Сельское хозяйство': 'Сельское хозяйство',
  Политология: 'Гуманитарные науки',
  'Международные отношения': 'Гуманитарные науки',
  Философия: 'Гуманитарные науки',
  История: 'Гуманитарные науки',
  Маркетинг: 'Бизнес',
  Финансы: 'Бизнес',
  'Бухгалтерский учет': 'Бизнес',
  Экономика: 'Бизнес',
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

function portfolioType(chance) {
  if (chance >= 75) return 'safe';
  if (chance >= 45) return 'target';
  return 'ambitious';
}

function portfolioLabel(type, lang = 'ru') {
  const labels = {
    safe: { ru: 'Безопасный', kk: 'Қауіпсіз', en: 'Safe' },
    target: { ru: 'Целевой', kk: 'Мақсатты', en: 'Target' },
    ambitious: { ru: 'Амбициозный', kk: 'Амбициозный', en: 'Ambitious' },
  };
  return labels[type]?.[lang] || labels[type]?.ru || type;
}

function recommendationLabel(chance, lang = 'ru') {
  if (chance >= 85) return tr('rec_high', lang) || 'Высокая вероятность поступления';
  if (chance >= 70) return tr('rec_good', lang) || 'Хорошие шансы, рассмотрите как основной вариант';
  if (chance >= 55) return tr('rec_real', lang) || 'Реалистичный вариант на платное отделение';
  return tr('rec_low', lang) || 'Низкая вероятность — нужен запасной план';
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

function buildReasons(parts, req, ent, lang = 'ru') {
  const reasons = [];
  if (parts.ent >= 30) reasons.push({ type: 'positive', text: tr('reason_ent_high', lang) || 'Ваш балл ЕНТ выше порога для этого направления' });
  else if (parts.ent > 0) reasons.push({ type: 'neutral', text: `${tr('reason_ent_near', lang) || 'ЕНТ близок к минимуму'} (${req.min_ent}+)` });
  else reasons.push({ type: 'negative', text: `${tr('reason_ent_low', lang) || 'ЕНТ ниже минимального порога'} (${req.min_ent})` });

  if (parts.budget >= 12) reasons.push({ type: 'positive', text: tr('reason_budget_ok', lang) || 'Стоимость входит в ваш бюджет' });
  else if (parts.budget < 0) reasons.push({ type: 'negative', text: tr('reason_budget_high', lang) || 'Стоимость выше указанного бюджета' });

  if (parts.lang >= 10) reasons.push({ type: 'positive', text: tr('reason_lang_ok', lang) || 'Есть обучение на выбранном языке' });
  else if (parts.lang === 0 && parts.langMax === 10) reasons.push({ type: 'negative', text: tr('reason_lang_bad', lang) || 'Выбранный язык обучения не подтверждён' });

  if (parts.dorm >= 10) reasons.push({ type: 'positive', text: tr('reason_dorm_ok', lang) || 'Есть общежитие' });
  else if (parts.dorm < 0) reasons.push({ type: 'negative', text: tr('reason_dorm_bad', lang) || 'Общежитие не указано в данных вуза' });

  if (parts.spec >= 20) reasons.push({ type: 'positive', text: tr('reason_spec_ok', lang) || 'Вуз силён в выбранной области' });

  if (ent >= req.grant_min_ent) {
    reasons.push({ type: 'positive', text: `${tr('reason_grant_ok', lang) || 'Есть шанс на грант'} (порог ~${req.grant_min_ent})` });
  } else if (ent < req.avg_ent) {
    reasons.push({ type: 'negative', text: `${tr('reason_ent_low_avg', lang) || 'ЕНТ ниже среднего балла поступивших'} (~${req.avg_ent})` });
  }

  return reasons;
}

function buildScoreBreakdown(parts, req, ent, penalties, lang = 'ru') {
  const grantGap = grantGapPenalty(ent, req.grant_min_ent);
  const belowMin = belowMinPenalty(ent, req.min_ent);
  const compPenalty = competitionPenalty(req.competition_level);

  const factors = [
    {
      key: 'ent',
      label: tr('factor_ent', lang) || 'Балл ЕНТ',
      score: parts.ent,
      maxScore: 40,
      detail: ent >= req.grant_min_ent
        ? `${ent} ≥ ${req.grant_min_ent} (грант)`
        : ent >= req.avg_ent
        ? `${ent} ≥ ${req.avg_ent} (ср.)`
        : ent >= req.min_ent
        ? `${ent} ≥ ${req.min_ent} (мин.)`
        : `${ent} < ${req.min_ent}`,
      impact: grantGap > 0 ? `−${grantGap} грант` : belowMin > 0 ? `−${belowMin} мин.` : '',
    },
    {
      key: 'budget',
      label: tr('factor_budget', lang) || 'Бюджет',
      score: parts.budget,
      maxScore: 15,
      detail: parts.budget >= 12
        ? tr('factor_budget_ok', lang) || 'Цена в бюджете'
        : parts.budget < 0
        ? tr('factor_budget_over', lang) || 'Цена выше бюджета'
        : tr('factor_budget_near', lang) || 'Цена рядом с бюджетом',
      impact: parts.budget < 0 ? `${parts.budget}` : '',
    },
    {
      key: 'lang',
      label: tr('factor_lang', lang) || 'Язык обучения',
      score: parts.lang,
      maxScore: 10,
      detail: parts.lang >= 10
        ? tr('factor_lang_ok', lang) || 'Язык совпадает'
        : tr('factor_lang_bad', lang) || 'Язык не подтверждён',
      impact: '',
    },
    {
      key: 'dorm',
      label: tr('factor_dorm', lang) || 'Общежитие',
      score: parts.dorm,
      maxScore: 10,
      detail: parts.dorm >= 10
        ? tr('factor_dorm_ok', lang) || 'Есть общежитие'
        : parts.dorm < 0
        ? tr('factor_dorm_bad', lang) || 'Нет общежития'
        : tr('factor_dorm_na', lang) || 'Не указано',
      impact: parts.dorm < 0 ? `${parts.dorm}` : '',
    },
    {
      key: 'spec',
      label: tr('factor_spec', lang) || 'Специальность',
      score: parts.spec,
      maxScore: 28,
      detail: tr('factor_spec_detail', lang) || `Конкурс: ${req.competition_level || 3}/5`,
      impact: '',
    },
    {
      key: 'attestat',
      label: tr('factor_attestat', lang) || 'Аттестат',
      score: parts.attestat,
      maxScore: 5,
      detail: parts.attestat >= 4 ? '4.0+' : parts.attestat > 0 ? `${parts.attestat}` : '—',
      impact: '',
    },
  ];

  const totalPenalty = grantGap + belowMin + compPenalty;
  if (totalPenalty > 0) {
    factors.push({
      key: 'penalty',
      label: tr('factor_penalty', lang) || 'Штрафы',
      score: -totalPenalty,
      maxScore: 0,
      detail: [
        grantGap > 0 ? `−${grantGap} грант` : '',
        belowMin > 0 ? `−${belowMin} мин.` : '',
        compPenalty > 0 ? `−${compPenalty} конкурс` : '',
      ].filter(Boolean).join(', ') || '—',
      impact: `−${totalPenalty}`,
    });
  }

  return factors;
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
  const specialtyName = params.specialtyName || null;
  const language = normalizeLanguage(params.language);
  const needDorm = Boolean(params.needDorm);
  const attestat = params.attestat ? parseFloat(params.attestat) : null;
  const lang = params.lang || 'ru';

  if (!Number.isInteger(ent) || ent < 0 || ent > 140) {
    return { success: false, error: tr('ent_too_high', lang) || 'Укажите балл ЕНТ от 0 до 140' };
  }
  if (!specialtyCategory) {
    return { success: false, error: tr('choose_spec', lang) || 'Выберите специальность' };
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
    WHERE s.category = ? AND COALESCE(u.data_status, 'active') = 'active'
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
      message: tr('no_data_specialty', lang) || 'Нет данных по этой специальности. Попробуйте другой город или направление.',
      input: { ent, specialty: specialtyCategory, specialtyName, budget, language, needDorm, cityId, attestat }
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
    const reasons = buildReasons(parts, row, ent, lang);

    const existing = byUniversity.get(row.university_id);
    if (!existing || total > existing.score) {
      const scoreBreakdown = buildScoreBreakdown(parts, row, ent, penalties, lang);
      const portfolio = portfolioType(chance);
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
        portfolio,
        portfolioLabel: portfolioLabel(portfolio, lang),
        recommendation: recommendationLabel(chance, lang),
        reasons,
        scoreBreakdown,
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
    .sort((a, b) => {
      if (params.wantsBudget) {
        const aPrice = a.price_from || 999999999;
        const bPrice = b.price_from || 999999999;
        return aPrice - bPrice || b.chance - a.chance;
      }
      return b.chance - a.chance || b.score - a.score;
    });

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

  const whatIf = [];
  if (ent < 140) {
    const increments = [5, 10, 15].filter(d => ent + d <= 140);
    const top3 = matches.slice(0, 3);
    for (const delta of increments) {
      const scenario = { ent: ent + delta, universities: [] };
      for (const match of top3) {
        const row = candidates.find(c => c.university_id === match.university_id && c.specialty_name === match.specialty_name);
        if (!row) continue;
        const newEnt = ent + delta;
        const newParts = {
          ent: scoreEnt(newEnt, row),
          budget: scoreBudget(budget, row.price_from, row.price_to),
          lang: scoreLanguage(language, row.languages ? JSON.parse(row.languages) : []),
          langMax: language ? 10 : 5,
          dorm: scoreDorm(needDorm, row.has_dorm === 1),
          spec: scoreSpecialty(true, row.competition_level),
          attestat: scoreAttestat(attestat),
        };
        const newPenalties = grantGapPenalty(newEnt, row.grant_min_ent)
          + belowMinPenalty(newEnt, row.min_ent)
          + competitionPenalty(row.competition_level);
        const newTotal = Math.max(0, Math.min(100,
          newParts.ent + newParts.budget + newParts.lang + newParts.dorm + newParts.spec + newParts.attestat - newPenalties
        ));
        const newChance = scoreToChance(newTotal);
        if (newChance > match.chance) {
          scenario.universities.push({
            university: match.university,
            from: match.chance,
            to: newChance,
          });
        }
      }
      if (scenario.universities.length > 0) whatIf.push(scenario);
    }
  }

  const academicYear = candidates.length > 0 ? candidates[0].academic_year : '2025-2026';

  return {
    success: true,
    matches,
    whatIf,
    academicYear,
    input: {
      ent,
      specialty: specialtyCategory,
      specialtyName,
      budget,
      language,
      needDorm,
      cityId,
      attestat,
    },
  };
}

function savePredictionHistory(userId, input, matches) {
  if (!userId || !matches.length) return 0;
  const db = getDb();
  const ent = Number(input.ent ?? input.entScore);
  const specialty = input.specialty || db.prepare('SELECT category FROM specialties WHERE id = ?').get(input.specialtyId ?? null)?.category;
  if (!Number.isInteger(ent) || ent < 0 || ent > 140 || !specialty) {
    throw new Error('Invalid prediction history input');
  }
  const stmt = db.prepare(`
    INSERT INTO prediction_history (user_id, ent, specialty_category, university_id, predicted_chance)
    SELECT ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM prediction_history
      WHERE user_id = ? AND ent = ? AND specialty_category = ?
        AND university_id = ? AND predicted_chance = ?
        AND created_at >= datetime('now', '-10 minutes')
    )
  `);
  const tx = db.transaction(() => {
    let saved = 0;
    for (const m of matches.slice(0, 5)) {
      const universityId = m.university_id ?? m.universityId;
      const chance = m.chance ?? m.chancePercent;
      if (!Number.isInteger(universityId) || !Number.isFinite(chance) || chance < 0 || chance > 100) {
        throw new Error('Invalid prediction history match');
      }
      saved += stmt.run(userId, ent, specialty, universityId, chance,
        userId, ent, specialty, universityId, chance).changes;
    }
    return saved;
  });
  return tx();
}

async function explainAdmissionChance(payload) {
  const {
    university, name, chance, ent, reasons, requirement, budget, language, needDorm,
  } = payload;

  const reasonText = (reasons || [])
    .map(r => `${r.type === 'positive' ? '✓' : r.type === 'negative' ? '✗' : '•'} ${r.text}`)
    .join('\n');

  const lang = payload.lang || 'ru';
  const systemPrompt = tr('explain_system', lang) || 'Ты консультант EduMatch KZ по поступлению в вузы Казахстана. Объясни абитуриенту простым языком (3–5 коротких абзацев), без воды. Не придумывай факты — опирайся только на переданные данные.';

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
