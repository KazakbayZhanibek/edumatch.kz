/**
 * AI PROMPTS & FALLBACK MESSAGES
 * Жёсткие инструкции для OpenRouter, чтобы избежать галлюцинаций
 */

/**
 * System prompt для модели
 * Даёт контекст о вузах и грантах, но ЗАПРЕЩАЕТ додумывать данные
 */
function getSystemPrompt(universitiesData, grantsData) {
  return `You are EduMatch KZ AI Advisor — a professional university selection assistant for Kazakhstan.

📋 YOUR ROLE:
- Analyze student requirements (budget, specialties, languages, preferences)
- Recommend universities from the database with specific matching criteria
- Provide professional, structured advice with real data
- Direct to official sources when data is unavailable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RESPONSE FORMAT (MUST FOLLOW EXACTLY):

Use this structure for recommendations:

## 📊 Анализ вашего запроса
Brief summary of requirements extracted from the message.

## 🎓 Рекомендуемые университеты
Present universities with:
- **Название (аббревиатура)**: Full name
- 💰 Цена: X.XM - X.XM тг/год
- 📚 Направления: Program names
- 🌐 Языки: Languages supported
- 📈 Рейтинг: QS World ranking (if available)

## ✅ Почему эти университеты подходят
2-3 sentences explaining the match with their criteria.

## 💡 Советы по выбору
- Specific actionable advice
- Links to websites when relevant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 CRITICAL RULES (НИКОГДА НЕ НАРУШАЙ):
1. NEVER invent data. ONLY use context provided below.
2. NEVER fabricate: ЕНТ scores, admission requirements, or programs not in database.
3. If data missing: "К сожалению, эта информация отсутствует в базе. Рекомендуем посетить официальный веб-сайт университета."
4. ALL prices must be exact from database (no estimates).
5. Never reference external knowledge about universities.
6. Keep professional, concise tone. Max 3-4 paragraphs.
7. Use exact names/abbreviations from database.
8. When uncertainty exists, explicitly state: "Данные не подтверждены базой".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATABASE CONTEXT:

UNIVERSITIES:
${universitiesData}

GRANTS & SCHOLARSHIPS:
${grantsData}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond in Russian. Use structured markdown. No emoji except provided icons.`;
}

/**
 * Fallback message если retrieval нашёл слишком мало вузов
 */
const FALLBACK_MESSAGE_FEW_MATCHES = `## ⚠️ Ограниченные результаты поиска

К сожалению, в базе найдено мало университетов, соответствующих вашему запросу.

### Возможные причины:
- Очень узкие критерии поиска
- Редкие специальности
- Небольшой бюджет для специализированных программ

### Рекомендуемые действия:
1. **Расширьте критерии**: попробуйте указать несколько специальностей
2. **Уточните бюджет**: найдите информацию о стоимости интересующих программ
3. **Посетите официальные сайты**:
   - казну.kz (КазНУ)
   - kbtu.kz (КБТУ)
   - cu.edu.kz (Caspian)
   - muirckz.com (МУИТ)
   - karaganda.kz (КарГТУ)

Я помогу, если уточните параметры поиска! 💡`;

/**
 * Fallback message если вопрос вне контекста БД
 */
const FALLBACK_MESSAGE_OUT_OF_SCOPE = `## 📚 Эта информация вне моей базы

Похоже, ваш вопрос касается данных, которых нет в моей системе.

### Я знаю (в базе есть):
✓ 45 университетов Казахстана (полная информация)
✓ 24+ специальности по категориям
✓ Цены обучения и гранты
✓ Рейтинги QS World/Asia
✓ Условия проживания и средние зарплаты выпускников

### Информация, которой НЕТ в базе:
✗ Минимальные баллы ЕНТ/ПСА
✗ Проходные баллы прошлых лет
✗ Условия общежитий
✗ Расписание занятий
✗ Конкретные контакты приемных комиссий

### Для других вопросов:
🌐 Посетите официальный сайт университета
📞 Позвоните на горячую линию приемной комиссии
✉️ Напишите на email приемной комиссии`;

/**
 * Fallback message если нет данных о специальности
 */
const FALLBACK_MESSAGE_NO_SPECIALTY_DATA = `## 📋 Данные по этой специальности недоступны

К сожалению, в моей базе нет подробной информации о программах по этой специальности.

### Как найти информацию:
1. Перейдите на официальный сайт интересующего университета
2. Найдите раздел "Приемная комиссия" или "Программы обучения"
3. Свяжитесь с приемной комиссией напрямую
4. Возьмите документ о приеме (обычно содержит все детали)

Я могу помочь рекомендовать университеты, если укажете другие критерии (бюджет, город, направление).`;

/**
 * Fallback message если нет контактной информации
 */
const FALLBACK_MESSAGE_NO_CONTACTS = `## 📞 Контакты приемной комиссии

К сожалению, актуальные контакты отсутствуют в моей базе данных.

### Как получить контакты:
1. **Официальный сайт** → раздел "Контакты" или "Приемная комиссия"
2. **Google Maps** → найдите университет и наберите номер
3. **Официальные социальные сети** (Instagram, Facebook, LinkedIn)
4. **Портал edumatch.kz** может иметь актуальные контакты

### Типовой формат поиска:
- **Веб-сайт**: [название университета].kz
- **Email**: info@[название].kz или abit@[название].kz
- **Телефон**: обычно указан на главной странице сайта`;

module.exports = {
  getSystemPrompt,
  FALLBACK_MESSAGE_FEW_MATCHES,
  FALLBACK_MESSAGE_OUT_OF_SCOPE,
  FALLBACK_MESSAGE_NO_SPECIALTY_DATA,
  FALLBACK_MESSAGE_NO_CONTACTS
};
