/**
 * ADMISSION EXPLANATION SERVICE
 * 
 * Генерирует human-readable объяснения для результатов admission calculator.
 * 
 * ВАЖНО: AI только ОБЪЯСНЯЕТ готовый result.
 * - Не меняет chancePercent
 * - Не придумывает новые числа
 * - Не ищет новые университеты
 * - Использует ТОЛЬКО факты из входного JSON
 * 
 * Fallback: если AI недоступен/timeout → детерминированный template
 */

// Import fetch - try global fetch first (Node 18+), then node-fetch
let fetch;
try {
  const nodeFetch = require('node-fetch');
  // In node-fetch v3, the default export is the fetch function
  fetch = nodeFetch.default || nodeFetch;
} catch (e) {
  // If require fails, try global fetch (Node 18+)
  fetch = globalThis.fetch;
}

if (!fetch) {
  console.warn('[admission-explanation] fetch is not available - AI will always use fallback');
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_TIMEOUT_MS = 8000;

/**
 * Получить AI-объяснение для одного match или списка matches
 * 
 * @param {Object|Array} matchOrMatches - один match или массив matches
 * @param {Object} input - входные параметры пользователя (ent, specialty, budget, etc)
 * @param {Boolean} useAI - использовать ли AI (default: true)
 * @returns {Promise<Object>} - { summary, strengths, risks, strategy, tips, fallback: bool }
 */
async function getExplanationForMatch(matchOrMatches, input, useAI = true) {
  try {
    const matches = Array.isArray(matchOrMatches) ? matchOrMatches : [matchOrMatches];
    
    if (!matches || matches.length === 0) {
      return getFallbackExplanation([], input);
    }

    if (!useAI || !OPENROUTER_API_KEY) {
      console.log('[admission-explanation] AI disabled or no key, using fallback');
      return getFallbackExplanation(matches, input);
    }

    // Пытаемся получить AI-объяснение
    const explanation = await requestAIExplanation(matches, input);
    return explanation;
  } catch (error) {
    console.error('[admission-explanation] Error:', error.message);
    // На любую ошибку → fallback
    const matches = Array.isArray(matchOrMatches) ? matchOrMatches : [matchOrMatches];
    return getFallbackExplanation(matches, input);
  }
}

/**
 * Запрос AI для объяснения
 */
async function requestAIExplanation(matches, input) {
  if (!fetch) {
    throw new Error('fetch is not available');
  }
  
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(matches, input);

  let response;
  let responseText;
  let jsonStr;

  try {
    // Запрос с timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'EduMatch KZ',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 1200,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorBody.slice(0, 100)}`);
    }

    const data = await response.json();
    responseText = data?.choices?.[0]?.message?.content || '';

    if (!responseText) {
      throw new Error('Empty response from AI');
    }

    console.log('[admission-explanation] AI response received, length:', responseText.length);

    // Parse JSON из ответа
    jsonStr = extractJSON(responseText);
    if (!jsonStr) {
      throw new Error('Could not extract JSON from AI response');
    }

    const explanation = JSON.parse(jsonStr);
    validateExplanationObject(explanation);

    console.log('[admission-explanation] Valid explanation from AI');
    return { ...explanation, fallback: false };
  } catch (error) {
    console.error('[admission-explanation] AI request failed:', error.message);
    if (error.name === 'AbortError') {
      console.warn('[admission-explanation] AI request timeout');
    }
    throw error;
  }
}

/**
 * System prompt для ограничения AI
 */
function buildSystemPrompt() {
  return `Ты —助手 для образовательного консультанта EduMatch KZ.

ТВОЯ ЗАДАЧА: Объяснить результаты расчета шансов поступления.

ЖЕСТКИЕ ПРАВИЛА:
1. Ты объясняешь ГОТОВЫЙ результат калькулятора поступления
2. Используй ТОЛЬКО факты из входного JSON
3. НЕ МЕНЯЙ chancePercent — это расчет калькулятора
4. НЕ придумывай новые университеты, баллы, пороги, гранты, статистику, дедлайны, стоимость
5. НЕ добавляй информацию, которой нет в данных
6. Если данных недостаточно → честно скажи об этом
7. Верни ТОЛЬКО валидный JSON, без markdown, без лишнего текста

СТРУКТУРА ОТВЕТА (JSON):
{
  "summary": "Краткое 1-2 предложенное описание результата",
  "strengths": ["фактор 1", "фактор 2", "максимум 3 пункта"],
  "risks": ["риск 1", "риск 2", "максимум 3 пункта"],
  "strategy": "safe|target|ambitious|mixed",
  "tips": ["совет 1", "совет 2", "максимум 3 пункта"]
}

strategy:
- "safe" → почти гарантированное поступление (chance >= 80%)
- "target" → реалистичный вариант (40% <= chance < 80%)
- "ambitious" → нужен запасной план (chance < 40%)
- "mixed" → несколько вузов разного уровня шансов

Примеры совести:
- "Баллы выше среднего — есть хорошие шансы на бюджет"
- "Проверь требования по языку обучения"
- "Рассмотри вузы с похожими параметрами как запасные"

ВАЖНО: Ответь только JSON, ничего больше.`;
}

/**
 * User prompt с данными
 */
function buildUserPrompt(matches, input) {
  const topMatch = matches[0];
  const matchesCount = matches.length;
  const isSingleMatch = matches.length === 1;

  let prompt = `Объясни результаты расчета шансов поступления:

ПАРАМЕТРЫ СТУДЕНТА:
- ЕНТ: ${input.ent || '—'} баллов
- Специальность: ${input.specialty || '—'}
- Бюджет: ${input.budget ? formatBudget(input.budget) : '—'}
- Язык обучения: ${input.language || '—'}
- Нужно общежитие: ${input.needDorm ? 'Да' : 'Нет'}
- Средний балл аттестата: ${input.attestat || '—'}

`;

  if (isSingleMatch && topMatch) {
    prompt += `РЕЗУЛЬТАТ ДЛЯ ВУЗА: ${topMatch.university}\n`;
    prompt += `- Шанс поступления: ${topMatch.chance}%\n`;
    if (topMatch.budgetMatch !== undefined) {
      prompt += `- Бюджет совпадает: ${topMatch.budgetMatch ? 'Да' : 'Нет'}\n`;
    }
    if (topMatch.languageMatch !== undefined) {
      prompt += `- Язык совпадает: ${topMatch.languageMatch ? 'Да' : 'Нет'}\n`;
    }
    if (topMatch.dormAvailable !== undefined) {
      prompt += `- Общежитие: ${topMatch.dormAvailable ? 'Да' : 'Нет'}\n`;
    }
    if (topMatch.reasons && topMatch.reasons.length > 0) {
      const pos = topMatch.reasons.filter(r => r.type === 'positive');
      const neg = topMatch.reasons.filter(r => r.type === 'negative');
      if (pos.length > 0) {
        prompt += `- Положительные факторы: ${pos.map(r => r.text).join('; ')}\n`;
      }
      if (neg.length > 0) {
        prompt += `- Факторы риска: ${neg.map(r => r.text).join('; ')}\n`;
      }
    }
  } else if (matches.length > 0) {
    prompt += `РЕЗУЛЬТАТЫ ДЛЯ НЕСКОЛЬКИХ ВУЗОВ:\n`;
    const high = matches.filter(m => m.chance >= 70);
    const medium = matches.filter(m => m.chance >= 40 && m.chance < 70);
    const low = matches.filter(m => m.chance < 40);

    if (high.length > 0) {
      prompt += `- Высокие шансы (${high.length}): ${high.map(m => `${m.university} (${m.chance}%)`).join(', ')}\n`;
    }
    if (medium.length > 0) {
      prompt += `- Реальные варианты (${medium.length}): ${medium.map(m => `${m.university} (${m.chance}%)`).join(', ')}\n`;
    }
    if (low.length > 0) {
      prompt += `- Низкие шансы (${low.length}): ${low.map(m => `${m.university} (${m.chance}%)`).join(', ')}\n`;
    }
  }

  prompt += `\nОбъясни эти результаты студенту. Возвращай JSON, как указано в инструкции.`;
  return prompt;
}

/**
 * Fallback объяснение без AI (детерминированное)
 */
function getFallbackExplanation(matches, input) {
  const explanation = {
    summary: buildFallbackSummary(matches, input),
    strengths: buildFallbackStrengths(matches, input),
    risks: buildFallbackRisks(matches, input),
    strategy: buildFallbackStrategy(matches),
    tips: buildFallbackTips(matches, input),
    fallback: true,
  };
  return explanation;
}

function buildFallbackSummary(matches, input) {
  if (!matches || matches.length === 0) {
    return 'Не удалось рассчитать результаты. Проверьте входные данные.';
  }

  const top = matches[0];
  const isSingle = matches.length === 1;

  if (isSingle) {
    if (top.chance >= 80) {
      return `Высокие шансы на поступление в ${top.university} (${top.chance}%). Это ваш основной вариант.`;
    } else if (top.chance >= 60) {
      return `Реалистичный вариант ${top.university} (${top.chance}%). Рассмотрите несколько альтернатив.`;
    } else if (top.chance >= 40) {
      return `Умеренные шансы в ${top.university} (${top.chance}%). Нужен запасной план.`;
    } else {
      return `Низкие шансы в ${top.university} (${top.chance}%). Необходимо изучить альтернативные варианты.`;
    }
  } else {
    const hasHigh = matches.some(m => m.chance >= 70);
    const hasTarget = matches.some(m => m.chance >= 40 && m.chance < 70);

    if (hasHigh) {
      return `Найдены варианты с хорошими шансами поступления. Выберите подходящий вуз из списка.`;
    } else if (hasTarget) {
      return `Есть реалистичные варианты поступления. Рассмотрите несколько из них.`;
    } else {
      return `Шансы невысокие. Рекомендуем рассмотреть дополнительные варианты или улучшить результаты.`;
    }
  }
}

function buildFallbackStrengths(matches, input) {
  const strengths = [];

  if (!matches || matches.length === 0) {
    return strengths;
  }

  const top = matches[0];
  const entDiff = input.ent && top.requirement ? input.ent - top.requirement.min_ent : 0;

  // ЕНТ
  if (top.requirement) {
    if (input.ent >= top.requirement.grant_min_ent) {
      strengths.push(`ЕНТ выше порога на грант (${top.requirement.grant_min_ent}+)`);
    } else if (input.ent >= top.requirement.avg_ent) {
      strengths.push(`ЕНТ выше среднего балла (${top.requirement.avg_ent})`);
    } else if (input.ent >= top.requirement.min_ent) {
      strengths.push(`ЕНТ соответствует минимальным требованиям`);
    }
  }

  // Бюджет
  if (top.budgetMatch === true) {
    strengths.push('Стоимость входит в ваш бюджет');
  }

  // Язык
  if (top.languageMatch === true) {
    strengths.push(`Обучение на ${input.language || 'выбранном языке'} доступно`);
  }

  // Общежитие
  if (input.needDorm && top.dormAvailable === true) {
    strengths.push('Общежитие доступно');
  }

  // High chance
  if (top.chance >= 70) {
    strengths.push('Высокие шансы на поступление');
  }

  return strengths.slice(0, 3);
}

function buildFallbackRisks(matches, input) {
  const risks = [];

  if (!matches || matches.length === 0) {
    return risks;
  }

  const top = matches[0];

  // ЕНТ ниже гранта
  if (top.requirement && input.ent && input.ent < top.requirement.grant_min_ent) {
    const gap = top.requirement.grant_min_ent - input.ent;
    if (gap > 0) {
      risks.push(`ЕНТ ниже порога на грант на ${gap} баллов`);
    }
  }

  // ЕНТ ниже минимума
  if (top.requirement && input.ent && input.ent < top.requirement.min_ent) {
    risks.push('ЕНТ ниже минимального порога для этого вуза');
  }

  // Бюджет
  if (top.budgetMatch === false) {
    risks.push('Стоимость выше указанного бюджета');
  }

  // Язык
  if (input.language && top.languageMatch === false) {
    risks.push(`Обучение на ${input.language} может быть недоступно`);
  }

  // Общежитие
  if (input.needDorm && top.dormAvailable === false) {
    risks.push('Общежитие не упоминается в данных вуза');
  }

  // Low chance
  if (top.chance < 40) {
    risks.push('Низкие шансы на поступление на бюджет');
  }

  return risks.slice(0, 3);
}

function buildFallbackStrategy(matches) {
  if (!matches || matches.length === 0) {
    return 'mixed';
  }

  if (matches.length === 1) {
    const chance = matches[0].chance;
    if (chance >= 80) return 'safe';
    if (chance >= 60) return 'target';
    if (chance >= 40) return 'ambitious';
    return 'ambitious';
  }

  const hasHigh = matches.some(m => m.chance >= 70);
  const hasMedium = matches.some(m => m.chance >= 40 && m.chance < 70);
  const hasLow = matches.some(m => m.chance < 40);

  if (hasHigh && hasMedium && hasLow) {
    return 'mixed';
  } else if (hasHigh && hasMedium) {
    return 'target';
  } else if (hasHigh) {
    return 'safe';
  }

  return 'mixed';
}

function buildFallbackTips(matches, input) {
  const tips = [];

  if (!matches || matches.length === 0) {
    return tips;
  }

  const top = matches[0];

  // Совет про баллы
  if (top.requirement && input.ent) {
    const grantGap = top.requirement.grant_min_ent - input.ent;
    if (grantGap > 0 && grantGap <= 10) {
      tips.push(`До гранта не хватает ${grantGap} баллов. Рассмотрите подготовительные курсы.`);
    }
  }

  // Совет про альтернативы
  if (matches.length > 1) {
    const alternatives = matches.filter(m => m.chance >= 40);
    if (alternatives.length > 1) {
      tips.push('Подайте документы в несколько вузов — это повышает шансы.');
    }
  }

  // Совет про платное
  if (top.chance < 50) {
    tips.push('На бюджет шансы невысокие. Рассмотрите вариант платного обучения или другие специальности.');
  }

  return tips.slice(0, 3);
}

/**
 * Утилиты
 */

function extractJSON(text) {
  if (!text) return null;

  // Попытка 1: найти { ... }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return match[0];
  }

  return null;
}

function validateExplanationObject(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Explanation must be an object');
  }

  if (typeof obj.summary !== 'string' || obj.summary.length === 0) {
    throw new Error('summary must be non-empty string');
  }

  if (!Array.isArray(obj.strengths) || !Array.isArray(obj.risks) || !Array.isArray(obj.tips)) {
    throw new Error('strengths, risks, tips must be arrays');
  }

  const validStrategies = ['safe', 'target', 'ambitious', 'mixed'];
  if (!validStrategies.includes(obj.strategy)) {
    throw new Error('strategy must be one of: safe, target, ambitious, mixed');
  }

  // Обрезаем массивы
  obj.strengths = obj.strengths.filter(s => typeof s === 'string').slice(0, 5);
  obj.risks = obj.risks.filter(r => typeof r === 'string').slice(0, 5);
  obj.tips = obj.tips.filter(t => typeof t === 'string').slice(0, 5);
}

function formatBudget(budget) {
  if (!budget) return '—';
  if (budget >= 1000000) {
    const millions = (budget / 1000000).toFixed(1);
    return `${millions} млн ₸/год`;
  }
  const thousands = Math.round(budget / 1000);
  return `${thousands} тыс ₸/год`;
}

module.exports = {
  getExplanationForMatch,
  requestAIExplanation,
  getFallbackExplanation,
  buildSystemPrompt,
  buildUserPrompt,
};
