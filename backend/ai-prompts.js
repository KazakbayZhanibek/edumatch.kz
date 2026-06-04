const { getDb } = require('./database');

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

function getSystemPrompt(intent, universitiesData, grantsData) {
  const db = getDb();
  const uniCount = db.prepare('SELECT COUNT(*) as c FROM universities').get().c;
  const specCount = db.prepare('SELECT COUNT(*) as c FROM specialties').get().c;
  const grantCount = db.prepare('SELECT COUNT(*) as c FROM grants').get().c;

  if (intent === 'general' || intent === 'comparison') {
    return buildGeneralPrompt(uniCount, specCount, grantCount);
  }

  if (intent === 'grant') {
    return buildGrantPrompt(uniCount, specCount, grantCount, grantsData);
  }

  return buildBasePrompt(universitiesData, grantsData);
}

function buildBasePrompt(universitiesData, grantsData) {
  const tone = pickRandom([PERSONALITIES.professional, PERSONALITIES.friendly]);
  return `Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.

${tone.instruction}

📋 ЧТО ТЫ ЗНАЕШЬ:
База данных содержит информацию о вузах: цены, рейтинги QS, языки, специальности, общежития, зарплаты выпускников, а также данные о грантах.

🚫 ЧЕГО НЕЛЬЗЯ:
- Выдумывать цифры — используй ТОЛЬКО данные из контекста ниже
- Добавлять требования по ЕНТ или проходные баллы (их нет в базе)
- Давать ссылки, которых нет в данных

ВАЖНО: Отвечай естественно, без принудительных шаблонов. Если данных мало — честно скажи об этом.

ДАННЫЕ О ВУЗАХ:
${universitiesData}

ГРАНТЫ:
${grantsData}

Отвечай на русском языке.`;
}

function buildGeneralPrompt(uniCount, specCount, grantCount) {
  const tone = pickRandom([PERSONALITIES.friendly, PERSONALITIES.concise]);
  return `Ты — EduMatch KZ, ИИ-консультант по вузам Казахстана.

${tone.instruction}

У тебя есть доступ к базе данных с:
• ${uniCount} университетами (цены, рейтинги, языки, общежития)
• ${specCount} специальностями
• ${grantCount} грантами и стипендиями

Отвечай на русском языке. Не выдумывай данные. Если не знаешь — так и скажи.

Строй ответ естественно, как живой консультант, а не как автоматический шаблон.`;
}

function buildGrantPrompt(uniCount, specCount, grantCount, grantsData) {
  const tone = pickRandom([PERSONALITIES.detailed, PERSONALITIES.professional]);
  return `Ты — EduMatch KZ, консультант по грантам и стипендиям в Казахстане.

${tone.instruction}

В базе ${grantCount} грантов разных типов (государственные, корпоративные, университетские).

ДАННЫЕ О ГРАНТАХ:
${grantsData}

🚫 НЕЛЬЗЯ:
- Придумывать гранты, которых нет в данных
- Гарантировать получение гранта

Отвечай на русском языке. Если грантов подходящих нет — предложи альтернативы.`;
}

function getAdmissionBriefPrompt(params, prediction) {
  if (!prediction.success || !prediction.matches?.length) {
    return 'К сожалению, не удалось рассчитать шансы по вашему запросу. Попробуйте другие параметры.';
  }

  const matches = prediction.matches.slice(0, 6);
  const top = matches[0];
  const ent = prediction.input.ent;

  let text = '';
  const isSingle = matches.length === 1;
  const isAllLow = matches.every(m => m.chance < 40);

  if (isSingle) {
    const m = matches[0];
    text = `## 🎯 ${m.university}\n\n**Вероятность поступления: ${m.chance}%** — ${m.recommendation}\n\n`;
    if (m.requirement) {
      text += `📊 **Ваш ЕНТ: ${ent}**\n`;
      if (ent >= m.requirement.grant_min_ent) {
        text += `✅ Выше порога на грант (нужно ${m.requirement.grant_min_ent})\n`;
      } else if (ent >= m.requirement.avg_ent) {
        text += `✅ Выше среднего балла (${m.requirement.avg_ent}), но до гранта не хватает ${m.requirement.grant_min_ent - ent} баллов\n`;
      } else if (ent >= m.requirement.min_ent) {
        text += `⚠ Выше минимального порога (${m.requirement.min_ent}), но ниже среднего (${m.requirement.avg_ent})\n`;
      }
      text += '\n';
    }
    const reasons = m.reasons || [];
    if (reasons.length > 0) {
      const pos = reasons.filter(r => r.type === 'positive');
      const neg = reasons.filter(r => r.type === 'negative');
      if (pos.length > 0) {
        text += '✅ **Что работает в вашу пользу:**\n';
        pos.forEach(r => { text += `• ${r.text}\n`; });
        text += '\n';
      }
      if (neg.length > 0) {
        text += '⚠ **На что обратить внимание:**\n';
        neg.forEach(r => { text += `• ${r.text}\n`; });
        text += '\n';
      }
    }
    const grantGap = m.requirement?.grant_min_ent ? m.requirement.grant_min_ent - ent : null;
    if (grantGap && grantGap > 0 && grantGap <= 10) {
      text += `💡 До гранта не хватает всего ${grantGap} баллов. Рассмотрите подготовительные курсы или пересдачу ЕНТ.\n\n`;
    }
    text += `🔗 [Подробнее о вузе] → нажмите на карточку ниже`;
  } else {
    text = `## 🎯 Результаты для ${prediction.input.specialty}\n\n`;
    text += `**Ваш ЕНТ: ${ent} баллов**\n`;
    if (prediction.input.budget) {
      text += `**Бюджет:** до ${fmtBudget(prediction.input.budget)}\n`;
    }
    text += '\n';

    const high = matches.filter(m => m.chance >= 70);
    const medium = matches.filter(m => m.chance >= 40 && m.chance < 70);
    const low = matches.filter(m => m.chance < 40);

    if (high.length > 0) {
      text += `🟢 **Высокие шансы (${high.length}):** `;
      text += high.map(m => `${m.university} (${m.chance}%)`).join(', ');
      text += '\n\n';
    }
    if (medium.length > 0) {
      text += `🟡 **Реальные варианты (${medium.length}):** `;
      text += medium.map(m => `${m.university} (${m.chance}%)`).join(', ');
      text += '\n\n';
    }
    if (low.length > 0) {
      text += `🔴 **Низкие шансы (${low.length}):** `;
      text += low.map(m => `${m.university} (${m.chance}%)`).join(', ');
      text += '\n\n';
    }

    if (top && top.chance >= 70) {
      text += `💡 **Лучший вариант:** ${top.university} — ${top.recommendation}\n\n`;
    } else if (top && top.chance >= 40) {
      text += `💡 ${top.university} — ${top.recommendation}\n\n`;
    } else if (isAllLow) {
      text += `💡 С вашими баллами нужен запасной вариант. Рассмотрите вузы с порогом ЕНТ ниже ${ent}.\n\n`;
    }
  }

  return text;
}

function fmtBudget(n) {
  if (!n) return '';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' млн ₸/год';
  return (n / 1000).toFixed(0) + ' тыс ₸/год';
}

function getMissingParamsMessage(params) {
  const missing = [];
  if (!params.ent) missing.push('балл ЕНТ (например, "у меня 110 баллов")');
  if (!params.university_id && !params.specialty) missing.push('вуз или специальность (например, "в КБТУ на IT")');

  if (!missing.length) return null;

  return `Чтобы рассчитать шансы, уточните:\n• ${missing.join('\n• ')}\n\nНапример: *"Поступлю ли я в КБТУ с ЕНТ 110?"* или *"Мои шансы на грант с 120 баллами?"*`;
}

module.exports = {
  getSystemPrompt,
  getAdmissionBriefPrompt,
  getMissingParamsMessage,
  PERSONALITIES,
};
