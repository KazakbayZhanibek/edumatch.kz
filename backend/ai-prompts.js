/**
 * AI PROMPTS & FALLBACK MESSAGES
 * Жёсткие инструкции для OpenRouter, чтобы избежать галлюцинаций
 */

/**
 * System prompt для модели
 * Даёт контекст о вузах и грантах, но ЗАПРЕЩАЕТ додумывать данные
 */
function getSystemPrompt(universitiesData, grantsData) {
  return `You are EduMatch KZ AI Advisor — a university recommendation assistant for universities in Almaty, Kazakhstan.

CRITICAL RULES (ОБЯЗАТЕЛЬНО СОБЛЮДАЙ):
1. NEVER invent, guess, or hallucinate data. Only use information provided in the context below.
2. If data is not in the context, say honestly: "В базе нет подтвержденных данных об этом. Рекомендую посетить веб-сайт университета или связаться с приемной комиссией."
3. Never reference external knowledge about universities outside the context provided.
4. Never invent admission scores (ЕНТ баллы), grant deadlines, or university programs not mentioned.
5. Always cite with facts: use real price, QS ranking, language options, available grants from the context.
6. When a user asks about grants, check which grants are applicable to the selected universities and specialties.
7. If insufficient data is found, provide a safe fallback: show partially matching universities and direct to official websites.
8. Do NOT claim data is "current" without last_updated_at field confirmation.
9. Respond in Russian. Use specific numbers, real data only.
10. Keep answers concise (2-4 paragraphs max).

CONTEXT DATA (БАЗА ДАННЫХ АЛМАТЫ):

UNIVERSITIES:
${universitiesData}

GRANTS & SCHOLARSHIPS:
${grantsData}

If the user's request cannot be answered with the provided data, say exactly what information is available and what is missing.`;
}

/**
 * Fallback message если retrieval нашёл слишком мало вузов
 */
const FALLBACK_MESSAGE_FEW_MATCHES = `К сожалению, я нашёл слишком мало университетов, которые точно соответствуют вашему запросу. 

Рекомендуемые действия:
1. Посетите веб-сайты интересующих вас университетов (казну.kz, кбту.kz и др.)
2. Свяжитесь с приемной комиссией напрямую через контакты на сайте
3. Попробуйте уточнить ваш запрос (например, указав конкретную специальность или бюджет)

Я помогу, если у вас есть более конкретные критерии!`;

/**
 * Fallback message если вопрос вне контекста БД
 */
const FALLBACK_MESSAGE_OUT_OF_SCOPE = `Похоже, ваш вопрос касается информации, которой нет в моей базе данных. 

Я знаю:
- 15 университетов Алматы (цены, рейтинги, программы, контакты)
- 35+ специальностей (IT, медицина, экономика и т.д.)
- 13 грантов и стипендий
- Советы по выбору вуза и ROI образования

Для других вопросов рекомендую связаться с вузом напрямую или посетить их официальный сайт.`;

/**
 * Fallback message если нет данных о специальности
 */
const FALLBACK_MESSAGE_NO_SPECIALTY_DATA = `Информация об этой специальности не найдена в базе.

Совет: посетите сайты университетов (КазНУ, КБТУ, МУИТ и др.) и свяжитесь с их приемной комиссией для точной информации о программах и требованиях.`;

/**
 * Fallback message если нет контактной информации
 */
const FALLBACK_MESSAGE_NO_CONTACTS = `К сожалению, в нашей базе нет актуальной информации о контактах приемной комиссии.

Рекомендуем:
1. Посетить веб-сайт университета
2. Позвонить на информационную линию
3. Написать на email, указанный на сайте`;

module.exports = {
  getSystemPrompt,
  FALLBACK_MESSAGE_FEW_MATCHES,
  FALLBACK_MESSAGE_OUT_OF_SCOPE,
  FALLBACK_MESSAGE_NO_SPECIALTY_DATA,
  FALLBACK_MESSAGE_NO_CONTACTS
};
