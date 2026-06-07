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

function getSystemPrompt(intent, universitiesData, grantsData, lang = 'ru') {
  const db = getDb();
  const uniCount = db.prepare('SELECT COUNT(*) as c FROM universities').get().c;
  const specCount = db.prepare('SELECT COUNT(*) as c FROM specialties').get().c;
  const grantCount = db.prepare('SELECT COUNT(*) as c FROM grants').get().c;

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
  return `${tr('prompt_base', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

${tr('prompt_base_what', lang) || '📋 ЧТО ТЫ ЗНАЕШЬ:'}
${tr('prompt_base_what_desc', lang) || 'База данных содержит информацию о вузах: цены, рейтинги QS, языки, специальности, общежития, зарплаты выпускников, а также данные о грантах.'}

${tr('prompt_base_no', lang) || '🚫 ЧЕГО НЕЛЬЗЯ:'}
- ${tr('prompt_base_no1', lang) || 'Выдумывать цифры — используй ТОЛЬКО данные из контекста ниже'}
- ${tr('prompt_base_no2', lang) || 'Добавлять требования по ЕНТ или проходные баллы (их нет в базе)'}
- ${tr('prompt_base_no3', lang) || 'Давать ссылки, которых нет в данных'}

${tr('prompt_base_important', lang) || 'ВАЖНО: Отвечай естественно, без принудительных шаблонов. Если данных мало — честно скажи об этом.'}

ДАННЫЕ О ВУЗАХ:
${universitiesData}

ГРАНТЫ:
${grantsData}

${tr('lang_instruction', lang) || 'Отвечай на русском языке.'}`;
}

function buildGeneralPrompt(uniCount, specCount, grantCount, lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.friendly, PERSONALITIES.concise]);
  return `${tr('prompt_general', lang) || 'Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.'}

${tone.instruction}

У тебя есть доступ к базе данных с:
• ${uniCount} университетами (цены, рейтинги, языки, общежития)
• ${specCount} специальностями
• ${grantCount} грантами и стипендиями

${tr('prompt_general_hint', lang) || 'Отвечай на русском языке. Не выдумывай данные. Если не знаешь — так и скажи.'}

Строй ответ естественно, как живой консультант, а не как автоматический шаблон.`;
}

function buildGrantPrompt(uniCount, specCount, grantCount, grantsData, lang = 'ru') {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.professional]);
  return `${tr('prompt_grant', lang) || 'Ты — EduMatch KZ, консультант по грантам и стипендиям в Казахстане.'}

${tone.instruction}

В базе ${grantCount} грантов разных типов (государственные, корпоративные, университетские).

ДАННЫЕ О ГРАНТАХ:
${grantsData}

🚫 НЕЛЬЗЯ:
- Придумывать гранты, которых нет в данных
- Гарантировать получение гранта

${tr('prompt_grant_hint', lang) || 'Отвечай на русском языке. Если грантов подходящих нет — предложи альтернативы.'}`;
}

function getAdmissionBriefPrompt(params, prediction, lang = 'ru') {
  if (!prediction.success || !prediction.matches?.length) {
    return tr('brief_unfortunately', lang) || 'К сожалению, не удалось рассчитать шансы по вашему запросу. Попробуйте другие параметры.';
  }

  const matches = prediction.matches.slice(0, 6);
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
    text = `${tr('brief_results', lang) || '## 🎯 Результаты для ${spec}'}`.replace('${spec}', prediction.input.specialty) + '\n\n';
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
      text += high.map(m => `${m.university} (${m.chance}%)`).join(', ');
      text += '\n\n';
    }
    if (medium.length > 0) {
      text += `${tr('brief_medium', lang) || '🟡 **Реальные варианты (${count}):** '}`.replace('${count}', medium.length);
      text += medium.map(m => `${m.university} (${m.chance}%)`).join(', ');
      text += '\n\n';
    }
    if (low.length > 0) {
      text += `${tr('brief_low', lang) || '🔴 **Низкие шансы (${count}):** '}`.replace('${count}', low.length);
      text += low.map(m => `${m.university} (${m.chance}%)`).join(', ');
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

module.exports = {
  getSystemPrompt,
  getAdmissionBriefPrompt,
  getMissingParamsMessage,
  PERSONALITIES,
};
