const { getDb } = require('./database');
const { tr } = require('./i18n');

const PERSONALITIES = {
  professional: {
    name: 'professional',
    instruction: `Дай чёткий, структурированный ответ. Используй профессиональный, но доступный тон.
Форматирование не обязательно — отвечай естественно, как эксперт по образованию.`,
  },
  friendly: {
    name: 'friendly',
    instruction: `Будь дружелюбным и поддерживающим, как старший товарищ.
Отвечай тепло, но информативно. Можешь начать с короткого позитивного вступления.`,
  },
  concise: {
    name: 'concise',
    instruction: `Отвечай максимально кратко и по делу. 2–3 предложения.
Только суть, без воды и лишних деталей.`,
  },
  detailed: {
    name: 'detailed',
    instruction: `Разверни ответ с примерами и конкретикой.
Можешь дать 2-3 варианта с плюсами и минусами каждого.`,
  },
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _countsCache = null;
let _countsCacheTime = 0;
const COUNTS_CACHE_TTL = 5 * 60 * 1000;

function getCachedCounts() {
  if (_countsCache && Date.now() - _countsCacheTime < COUNTS_CACHE_TTL) {
    return _countsCache;
  }
  const db = getDb();
  _countsCache = {
    uniCount: db.prepare('SELECT COUNT(*) as c FROM universities').get().c,
    specCount: db.prepare('SELECT COUNT(*) as c FROM specialties').get().c,
    grantCount: db.prepare('SELECT COUNT(*) as c FROM grants').get().c,
  };
  _countsCacheTime = Date.now();
  return _countsCache;
}

function getSystemPrompt(intent, universitiesData, grantsData, lang = 'ru') {
  const { uniCount, specCount, grantCount } = getCachedCounts();

  if (intent === 'general' || intent === 'comparison') {
    return buildGeneralPrompt(uniCount, specCount, grantCount, lang);
  }

  if (intent === 'grant') {
    return buildGrantPrompt(uniCount, specCount, grantCount, grantsData, lang);
  }

  return buildBasePrompt(universitiesData, grantsData, lang);
}

function buildBasePrompt(universitiesData, grantsData, lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.professional, PERSONALITIES.friendly]);
  const langHint = lang === 'kk' ? 'Қазақ тілінде жауап бер.' : lang === 'en' ? 'Respond in English.' : 'Отвечай на русском языке.';
  const whatLabel = lang === 'kk' ? '📋 НЕ БІЛЕСІЗ:' : lang === 'en' ? '📋 WHAT YOU KNOW:' : '📋 ЧТО ТЫ ЗНАЕШЬ:';
  const whatDesc = lang === 'kk' ? 'Университеттер туралы деректер базасы: бағалар, QS рейтингтер, тілдер, мамандықтар, жатақханалар, түлектер жалақысы және гранттар туралы мәліметтер бар.' : lang === 'en' ? 'Database contains university info: prices, QS rankings, languages, specialties, dorms, graduate salaries, and grant data.' : 'База данных содержит информацию о вузах: цены, рейтинги QS, языки, специальности, общежития, зарплаты выпускников, а также данные о грантах.';
  const noLabel = lang === 'kk' ? '🚫 НЕ ТИЙМЕЙДІ:' : lang === 'en' ? '🚫 WHAT YOU CANNOT:' : '🚫 ЧЕГО НЕЛЬЗЯ:';
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

${whatLabel}
${whatDesc}

${noLabel}
- ${tr('prompt_base_no1', lang) || 'Выдумывать цифры — используй ТОЛЬКО данные из контекста ниже'}
- ${tr('prompt_base_no2', lang) || 'Добавлять требования по ЕНТ или проходные баллы (их нет в базе)'}
- ${tr('prompt_base_no3', lang) || 'Давать ссылки, которых нет в данных'}

СЕРВИСЫ САЙТА EduMatch KZ:
- Калькулятор ЕНТ — расчёт шансов поступления по баллу ЕНТ, GPA, специальности и бюджету
- Профориентация — тест из 8 вопросов для определения подходящих профессий и вузов
- Прогноз поступления — анализ шансов с учётом исторических данных
- Сравнение вузов — до 3 вузов одновременно
- Сохранение вузов — избранное с серверной синхронизацией
- Трекер заявок — отслеживание статуса подачи документов
- Если пользователь спрашивает про ЕНТ балл — предложи использовать калькулятор ЕНТ
- Если пользователь не знает какую профессию выбрать — предложи пройти профориентацию
- Если у пользователя есть балл ЕНТ в профиле — используй его для рекомендаций

${tr('prompt_base_important', lang) || 'ВАЖНО: Отвечай естественно, без принудительных шаблонов. Если данных мало — честно скажи об этом.'}

ДАННЫЕ О ВУЗАХ:
${universitiesData}

ГРАНТЫ:
${grantsData}

${langHint}`;
}

function buildGeneralPrompt(uniCount, specCount, grantCount, lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.friendly, PERSONALITIES.concise]);
  const langHint = lang === 'kk' ? 'Қазақ тілінде жауап бер.' : lang === 'en' ? 'Respond in English.' : 'Отвечай на русском языке.';
  const dbLabel = lang === 'kk' ? 'Деректер қорында бар:' : lang === 'en' ? 'Database contains:' : 'У тебя есть доступ к базе данных с:';
  const uniLabel = lang === 'kk' ? 'университеттер (бағалар, QS рейтингтер, тілдер, жатақханалар)' : lang === 'en' ? 'universities (prices, QS rankings, languages, dorms)' : 'университетами (цены, рейтинги, языки, общежития)';
  const specLabel = lang === 'kk' ? 'мамандықтар' : lang === 'en' ? 'specialties' : 'специальностями';
  const grantLabel = lang === 'kk' ? 'гранттар мен стипендиялар' : lang === 'en' ? 'grants and scholarships' : 'грантами и стипендиями';
  return `${tr('prompt_general', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

${dbLabel}
• ${uniCount} ${uniLabel}
• ${specCount} ${specLabel}
• ${grantCount} ${grantLabel}

${tr('prompt_general_hint', lang) || langHint}

Строй ответ естественно, как живой консультант, а не как автоматический шаблон.
${langHint}`;
}

function buildGrantPrompt(uniCount, specCount, grantCount, grantsData, lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.professional]);
  const langHint = lang === 'kk' ? 'Қазақ тілінде жауап бер.' : lang === 'en' ? 'Respond in English.' : 'Отвечай на русском языке.';
  const dbLabel = lang === 'kk' ? 'Деректер қорында' : lang === 'en' ? 'Database has' : 'В базе';
  const grantTypes = lang === 'kk' ? 'гранттардың әр түрлі түрлері бар (мемлекеттік, корпоративтік, университеттік).' : lang === 'en' ? 'grants of different types (state, corporate, university).' : 'грантов разных типов (государственные, корпоративные, университетские).';
  const noLabel = lang === 'kk' ? '🚫 ТИЙМЕЙДІ:' : lang === 'en' ? '🚫 FORBIDDEN:' : '🚫 НЕЛЬЗЯ:';
  return `${tr('prompt_grant', lang) || 'Ты — EduMatch KZ, консультант по грантам и стипендиям в Казахстане.'}

${tone.instruction}

${dbLabel} ${grantCount} ${grantTypes}

ДАННЫЕ О ГРАНТАХ:
${grantsData}

${noLabel}
- ${lang === 'kk' ? 'Деректерде жоқ гранттарды ойлап табу' : lang === 'en' ? 'Inventing grants not in the data' : 'Придумывать гранты, которых нет в данных'}
- ${lang === 'kk' ? 'Грантты алуға кепілдік беру' : lang === 'en' ? 'Guaranteeing grant receipt' : 'Гарантировать получение гранта'}

${tr('prompt_grant_hint', lang) || langHint}`;
}

function getAdmissionBriefPrompt(params, prediction, lang = 'ru') {
  if (!prediction.success || !prediction.matches?.length) {
    return tr('brief_unfortunately', lang) || 'К сожалению, не удалось рассчитать шансы по вашему запросу. Попробуйте другие параметры.';
  }

  const matches = prediction.matches.slice(0, 12);
  const top = matches[0];
  const ent = prediction.input.ent;

  let text = '';
  const isSingle = matches.length === 1;
  const isAllLow = matches.every(m => m.chance < 40);

  if (isSingle) {
    const m = matches[0];
    text = `## 🎯 ${m.university}\n\n${tr('brief_chance', lang) || '**Вероятность поступления: ${chance}%** — ${rec}'}`.replace('${chance}', m.chance).replace('${rec}', m.recommendation) + '\n\n';
    if (m.requirement) {
      text += `${tr('brief_your_ent', lang) || '📊 **Ваш ЕНТ: ${ent}**'}`.replace('${ent}', ent) + '\n';
      if (ent >= m.requirement.grant_min_ent) {
        text += `${tr('brief_above_grant', lang) || '✅ Выше порога на грант (нужно ${need})'}`.replace('${need}', m.requirement.grant_min_ent) + '\n';
      } else if (ent >= m.requirement.avg_ent) {
        const gap = m.requirement.grant_min_ent - ent;
        text += `${tr('brief_above_avg', lang) || '✅ Выше среднего балла (${avg}), но до гранта не хватает ${gap} баллов'}`.replace('${avg}', m.requirement.avg_ent).replace('${gap}', gap) + '\n';
      } else if (ent >= m.requirement.min_ent) {
        text += `${tr('brief_above_min', lang) || '⚠ Выше минимального порога (${min}), но ниже среднего (${avg})'}`.replace('${min}', m.requirement.min_ent).replace('${avg}', m.requirement.avg_ent) + '\n';
      }
      text += '\n';
    }
    const reasons = m.reasons || [];
    if (reasons.length > 0) {
      const pos = reasons.filter(r => r.type === 'positive');
      const neg = reasons.filter(r => r.type === 'negative');
      if (pos.length > 0) {
        text += `${tr('brief_pros', lang) || '✅ **Что работает в вашу пользу:**'}\n`;
        pos.forEach(r => { text += `• ${r.text}\n`; });
        text += '\n';
      }
      if (neg.length > 0) {
        text += `${tr('brief_cons', lang) || '⚠ **На что обратить внимание:**'}\n`;
        neg.forEach(r => { text += `• ${r.text}\n`; });
        text += '\n';
      }
    }
    const grantGap = m.requirement?.grant_min_ent ? m.requirement.grant_min_ent - ent : null;
    if (grantGap && grantGap > 0 && grantGap <= 10) {
      text += `${tr('brief_grant_gap', lang) || '💡 До гранта не хватает всего ${gap} баллов. Рассмотрите подготовительные курсы или пересдачу ЕНТ.'}`.replace('${gap}', grantGap) + '\n\n';
    }
    text += `${tr('brief_link', lang) || '🔗 [Подробнее о вузе] → нажмите на карточку ниже'}`;
  } else {
    const displaySpec = prediction.input.specialtyName || prediction.input.specialty;
    text = `${tr('brief_results', lang) || '## 🎯 Результаты для ${spec}'}`.replace('${spec}', displaySpec) + '\n\n';
    text += `${tr('brief_ent', lang) || '**Ваш ЕНТ: ${ent} баллов**'}`.replace('${ent}', ent) + '\n';
    if (prediction.input.budget) {
      text += `${tr('brief_budget', lang) || '**Бюджет:** до ${budget}'}`.replace('${budget}', fmtBudget(prediction.input.budget, lang)) + '\n';
    }
    text += '\n';

    const high = matches.filter(m => m.chance >= 70);
    const medium = matches.filter(m => m.chance >= 40 && m.chance < 70);
    const low = matches.filter(m => m.chance < 40);

    if (high.length > 0) {
      text += `${tr('brief_high', lang) || '🟢 **Высокие шансы (${count}):** '}`.replace('${count}', high.length);
      text += high.map(m => {
        const price = m.price_from ? ` (${fmtBudget(m.price_from, lang)})` : '';
        return `${m.university} (${m.chance}%)${price}`;
      }).join(', ');
      text += '\n\n';
    }
    if (medium.length > 0) {
      text += `${tr('brief_medium', lang) || '🟡 **Реальные варианты (${count}):** '}`.replace('${count}', medium.length);
      text += medium.map(m => {
        const price = m.price_from ? ` (${fmtBudget(m.price_from, lang)})` : '';
        return `${m.university} (${m.chance}%)${price}`;
      }).join(', ');
      text += '\n\n';
    }
    if (low.length > 0) {
      text += `${tr('brief_low', lang) || '🔴 **Низкие шансы (${count}):** '}`.replace('${count}', low.length);
      text += low.map(m => {
        const price = m.price_from ? ` (${fmtBudget(m.price_from, lang)})` : '';
        return `${m.university} (${m.chance}%)${price}`;
      }).join(', ');
      text += '\n\n';
    }

    if (top && top.chance >= 70) {
      text += `${tr('brief_best', lang) || '💡 **Лучший вариант:** ${uni} — ${rec}'}`.replace('${uni}', top.university).replace('${rec}', top.recommendation) + '\n\n';
    } else if (top && top.chance >= 40) {
      text += `💡 ${top.university} — ${top.recommendation}\n\n`;
    } else if (isAllLow) {
      text += `${tr('brief_fallback', lang) || '💡 С вашими баллами нужен запасной вариант. Рассмотрите вузы с порогом ЕНТ ниже ${ent}.'}`.replace('${ent}', ent) + '\n\n';
    }
  }

  if (prediction.input.specialty) {
    try {
      const { getProfessionsByCategory } = require('./profession-data');
      const professions = getProfessionsByCategory(prediction.input.specialty);
      if (professions.length > 0) {
        const prof = professions[0];
        const salary = prof.salary;
        const title = prof.title[lang] || prof.title.ru;
        const demand = prof.demandLevel[lang] || prof.demandLevel.ru;
        text += `\n---\n`;
        text += `💼 **${title}** — ${(prof.description[lang] || prof.description.ru).substring(0, 100)}...\n`;
        text += `💰 Зарплата: ${salary.min.toLocaleString()} — ${salary.max.toLocaleString()}₸ (ср. ${salary.avg.toLocaleString()}₸)\n`;
        text += `📊 Спрос: ${demand}\n`;
      }
    } catch (e) {}
  }

  return text;
}

function fmtBudget(n, lang = 'ru') {
  if (!n) return '';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' ' + (tr('fmt_budget_mln', lang) || 'млн ₸/год');
  return (n / 1000).toFixed(0) + ' ' + (tr('fmt_budget_th', lang) || 'тыс ₸/год');
}

function getMissingParamsMessage(params, lang = 'ru') {
  const missing = [];
  if (!params.ent) missing.push(tr('missing_ent', lang) || 'балл ЕНТ (например, "у меня 110 баллов")');
  if (!params.university_id && !params.specialty) missing.push(tr('missing_uni_spec', lang) || 'вуз или специальность (например, "в КБТУ на IT")');

  if (!missing.length) return null;

  return (tr('missing_prompt', lang) || 'Чтобы рассчитать шансы, уточните:\n• ${items}\n\nНапример: *"Поступлю ли я в КБТУ с ЕНТ 110?"*').replace('${items}', missing.join('\n• '));
}

// ─── LLM PROMPTS FOR ALL INTENTS ──────────────────

function buildGreetingPrompt(lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.friendly, PERSONALITIES.concise]);
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Пользователь тебя поздоровался. Поприветствуй его коротко и тепло.
Расскажи, чем ты можешь помочь (расчёт шансов, сравнение вузов, гранты, профессии, города), но КРАТКО — 3-5 предложений.
Не используй нумерованный список — просто перечисли возможности текстом.
Задай вопрос в конце, чтобы поддержать диалог.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

function buildHelpPrompt(lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.friendly]);
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Пользователь спрашивает, чем ты можешь помочь.
Объясни свои возможности живым языком, как консультант:
- Расчёт шансов на поступление (с ЕНТ баллом)
- Информация о вузах (цены, рейтинги, специальности)
- Сравнение университетов
- Гранты и стипендии
- Профориентация
- Города и вузы в них

Дай 2-3 примера вопросов, которые пользователь может задать.
Будь дружелюбным и помоги начать диалог.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

function buildDeadlinesPrompt(lang = 'ru', deadlinesData) {
  const tone = pickRandom([PERSONALITIES.professional, PERSONALITIES.concise]);
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Пользователь спрашивает о сроках/календаре поступления.
Ниже РЕАЛЬНЫЕ данные о календаре поступления — расскажи о них живым языком, как эксперт.
Не выдумывай даты, которых нет в данных.
В конце предупреди, что даты могут отличаться в зависимости от вуза.

ДАННЫЕ:
${JSON.stringify(deadlinesData)}

Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

function buildRecommendationPrompt(lang = 'ru', uniData, params) {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.professional]);
  const paramHint = params.specialty ? `Специальность: ${params.specialty}. ` : '';
  const cityHint = params.cityName ? `Город: ${params.cityName}. ` : '';
  const budgetHint = params.budget ? `Бюджет: до ${params.budget.toLocaleString()}₸. ` : '';
  const entHint = params.ent ? `ЕНТ: ${params.ent}. ` : '';
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Пользователь просит подобрать/порекомендовать вузы.
Ниже РЕАЛЬНЫЕ данные о вузах из базы данных. Не выдумывай цифры, которых нет в DATA.
Сгруппируй вузы по городам или категориям для удобства.
Дай краткую рекомендацию по каждому вузу (цена, рейтинг, язык).
В конце предложи уточнить запрос для более точного подбора.

${paramHint}${cityHint}${budgetHint}${entHint}

ДАННЫЕ О ВУЗАХ:
${uniData}

Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

function buildOverviewPrompt(lang = 'ru', overviewData) {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.professional]);
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Пользователь указал балл ЕНТ, но не указал специальность.
Ниже РЕАЛЬНЫЕ данные о вузах, которые подходят по баллу — покажи лучшие варианты.
Сгруппируй по шансам (высокие/средние/низкие).
Дай совет, какую специальность выбрать.
В конце предложи уточнить направление для точного расчёта.

ДАННЫЕ:
${JSON.stringify(overviewData)}

Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

function buildEdgeCasePrompt(lang = 'ru', scenario, context) {
  const tone = pickRandom([PERSONALITIES.friendly, PERSONALITIES.concise]);
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

Сценарий: ${scenario}
Контекст: ${JSON.stringify(context)}

Ответь пользователюhelpful иriendly. Если он отправил просто число — попроси уточнить контекст.
Если балл ЕНТ некорректный — вежливо объясни ограничения.
Если не хватает данных — предложи варианты.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}.`;
}

module.exports = {
  getSystemPrompt,
  getAdmissionBriefPrompt,
  getMissingParamsMessage,
  PERSONALITIES,
  buildGreetingPrompt,
  buildHelpPrompt,
  buildDeadlinesPrompt,
  buildRecommendationPrompt,
  buildOverviewPrompt,
  buildEdgeCasePrompt,
};
