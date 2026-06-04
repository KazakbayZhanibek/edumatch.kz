/**
 * AI SERVICE LAYER
 * Retrieval logic + OpenRouter API call
 * 
 * Ключевая идея:
 * 1. Анализируем вопрос пользователя
 * 2. Выбираем релевантные данные из SQLite
 * 3. Отправляем ограниченный контекст в OpenRouter
 * 4. LLM не может "додумать" данные вне контекста
 */

// fetch is built-in global in Node.js 18+, no need to import
const { getDb } = require('./database');
const { getSystemPrompt, FALLBACK_MESSAGE_FEW_MATCHES } = require('./ai-prompts');

/**
 * Retrieve university matches based on user query
 * Pragmatic keyword extraction + SQL filtering
 */
function retrieveRelevantUniversities(question) {
  const db = getDb();
  const question_lower = (question || '').toLowerCase();
  
  // Извлекаем параметры из вопроса (simple pattern matching)
  const params = {
    budget_max: extractBudget(question),
    specialties: extractSpecialties(question),
    languages: extractLanguages(question),
    has_dorm: question_lower.includes('общежитие') || question_lower.includes('общежит') || question_lower.includes('проживание'),
    top_n: 8  // вернуть top 8 релевантных вузов
  };

  let query = `
    SELECT DISTINCT u.* FROM universities u
  `;
  let where = [];
  let params_sql = [];

  // Filter by budget
  if (params.budget_max) {
    where.push('u.price_from <= ?');
    params_sql.push(params.budget_max);
  }

  // Filter by specialty (если есть)
  if (params.specialties.length > 0) {
    query += ` LEFT JOIN university_specialties us ON u.id = us.university_id
               LEFT JOIN specialties s ON us.specialty_id = s.id`;
    
    const spec_conditions = params.specialties.map(() => '(s.name LIKE ? OR s.category = ?)').join(' OR ');
    where.push(`(${spec_conditions})`);
    
    params.specialties.forEach(spec => {
      params_sql.push(`%${spec}%`, spec);
    });
  }

  // Filter by dorm if mentioned
  if (params.has_dorm) {
    where.push('u.has_dorm = 1');
  }

  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
  }

  // Sort by relevance: QS world ranking (nulls last), then by price
  query += ` ORDER BY 
    CASE WHEN u.qs_world IS NULL THEN 1 ELSE 0 END ASC,
    u.qs_world ASC,
    u.price_from ASC
    LIMIT ?`;
  
  params_sql.push(params.top_n);

  const universities = [];
  try {
    const stmt = db.prepare(query);
    const rows = stmt.all(...params_sql);
    
    // Post-process: fetch specialties for each uni
    rows.forEach(u => {
      const specs = db.prepare(
        `SELECT s.id, s.name, s.category FROM specialties s
         JOIN university_specialties us ON s.id = us.specialty_id
         WHERE us.university_id = ?`
      ).all(u.id);
      
      universities.push({
        id: u.id,
        name: u.name,
        short_name: u.short_name,
        price_from: u.price_from,
        price_to: u.price_to,
        qs_world: u.qs_world,
        qs_asia: u.qs_asia,
        website: u.website,
        languages: u.languages ? JSON.parse(u.languages) : [],
        has_dorm: u.has_dorm === 1,
        dorm_price: u.dorm_price,
        avg_salary: u.avg_salary,
        specialties: specs,
        description: u.description,
        founded: u.founded,
        students_count: u.students_count,
        accreditations: u.accreditations ? JSON.parse(u.accreditations) : [],
        last_updated_at: u.last_updated_at,
        data_status: u.data_status
      });
    });
  } catch (err) {
    console.error('[ai-service] retrieval error:', err.message);
  }

  return { universities, extractedParams: params };
}

/**
 * Extract budget from question (pattern: "миллион", "млн", "тг", numbers)
 */
function extractBudget(question) {
  if (!question) return null;
  
  // Search for patterns like "500k", "1млн", "1.5 млн", "500000"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:млн|миллион)/i,      // 1.5 млн
    /(\d+)\s*(?:тыс|k|K)/i,                      // 500k или 500 тыс
    /(\d{6,})/,                                   // 500000
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      // Normalize: if 500k → 500000, if 1.5млн → 1500000
      if (question.toLowerCase().includes('млн') || question.toLowerCase().includes('миллион')) {
        value = value * 1000000;
      } else if (question.match(/\d+\s*(?:тыс|k)/i)) {
        value = value * 1000;
      }
      return Math.round(value);
    }
  }
  
  return null;
}

/**
 * Extract specialty keywords from question
 */
function extractSpecialties(question) {
  if (!question) return [];
  
  const q_lower = question.toLowerCase();
  const db = getDb();
  
  // Get all specialties from DB
  const allSpecialties = [];
  try {
    const stmt = db.prepare('SELECT DISTINCT name, category FROM specialties');
    const rows = stmt.all();
    rows.forEach(row => {
      allSpecialties.push(row.name, row.category);
    });
  } catch (err) {
    console.error('[ai-service] error fetching specialties:', err.message);
  }

  // Match question against specialty names/categories
  const matched = [];
  allSpecialties.forEach(spec => {
    const spec_lower = spec.toLowerCase();
    if (q_lower.includes(spec_lower)) {
      matched.push(spec);
    }
  });

  // Also check for category aliases
  const categoryAliases = {
    'ИТ': ['информационные технологии', 'программирование', 'кодирование', 'разработка', 'it', 'программист'],
    'Медицина': ['медицина', 'врач', 'доктор', 'медицинский'],
    'Экономика': ['экономика', 'финансы', 'бизнес', 'бухгалтерия', 'экономист'],
    'Право': ['право', 'юрист', 'законодательство', 'юриспруденция'],
    'Инженерия': ['инженерия', 'инженер', 'техническая', 'техническое'],
  };

  for (const [category, keywords] of Object.entries(categoryAliases)) {
    for (const keyword of keywords) {
      if (q_lower.includes(keyword)) {
        matched.push(category);
        break;
      }
    }
  }

  return [...new Set(matched)];  // deduplicate
}

/**
 * Extract language preference from question
 */
function extractLanguages(question) {
  if (!question) return [];
  
  const q_lower = question.toLowerCase();
  const languages = [];

  // Check for language keywords
  if (q_lower.includes('английск') || q_lower.includes('english')) {
    languages.push('Английский');
  }
  if (q_lower.includes('казах') || q_lower.includes('kazakh')) {
    languages.push('Казахский');
  }
  if (q_lower.includes('русск') || q_lower.includes('russian')) {
    languages.push('Русский');
  }

  return languages;
}

/**
 * Retrieve grants matching criteria
 */
function retrieveRelevantGrants(specialties, universities_ids) {
  const db = getDb();
  let grants = [];

  try {
    const stmt = db.prepare('SELECT * FROM grants');
    const allGrants = stmt.all();

    grants = allGrants.map(g => ({
      id: g.id,
      name: g.name,
      type: g.type,
      amount: g.amount,
      description: g.description,
      requirements: g.requirements ? JSON.parse(g.requirements) : [],
      deadline: g.deadline,
      link: g.link
    }));
  } catch (err) {
    console.error('[ai-service] error fetching grants:', err.message);
  }

  return grants;
}

/**
 * Format universities for context (compact version)
 */
function formatUniversitiesForContext(universities) {
  return universities.map(u => {
    const langs = (u.languages || []).join(', ');
    // Deduplicate specialties by category to avoid repeats like "IT, IT, IT"
    const unique_specs = [...new Set((u.specialties || []).map(s => s.category))];
    const specs = unique_specs.slice(0, 3).join(', ');
    const dorm_info = u.has_dorm ? ` + общежитие ${u.dorm_price}тг/мес` : '';
    
    return `• ${u.name} (${u.short_name}):
    - Цена: ${u.price_from}-${u.price_to} тг/год
    - QS World: ${u.qs_world || 'не ранжирован'}
    - Специальности: ${specs || 'различные'}
    - Языки: ${langs}
    - Средняя зарплата выпускников: ${u.avg_salary}тг/мес${dorm_info}
    - Сайт: ${u.website}`;
  }).join('\n\n');
}

/**
 * Format grants for context
 */
function formatGrantsForContext(grants) {
  return grants.slice(0, 7).map((g, i) => {
    return `${i + 1}. ${g.name} (${g.type})
    - Сумма: ${g.amount}
    - Требования: ${(g.requirements || []).join(', ')}
    - Дедлайн: ${g.deadline}`;
  }).join('\n\n');
}

/**
 * Call OpenRouter API
 * 
 * Параметры запроса:
 * - model: строка из OPENROUTER_MODEL (.env)
 * - messages: array of { role, content }
 * - temperature: 0.7 (детерминированность vs creativity balance)
 * - max_tokens: 512 (ограничить размер ответа)
 */
async function callOpenRouter(systemPrompt, userMessage, history) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add history (limit to last 4 exchanges)
  (history || []).slice(-8).forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || '').slice(0, 500)
    });
  });

  // Add current user message
  messages.push({
    role: 'user',
    content: String(userMessage).slice(0, 800)
  });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 512,
  };

  // Log the full request for debugging
  console.log('[ai-service] OpenRouter request:', JSON.stringify({
    model: model,
    messages_count: messages.length,
    system_prompt_length: systemPrompt.length,
    user_message_length: userMessage.length,
    history_count: history.length
  }, null, 2));

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'EduMatchKZ/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error_text = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${error_text}`);
    }

    const data = await response.json();

    // Extract response
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Unexpected OpenRouter response format');
    }

    return {
      text: data.choices[0].message.content,
      model_used: data.model,
      usage: data.usage
    };
  } catch (err) {
    console.error('[ai-service] OpenRouter error:', err.message);
    throw err;
  }
}

/**
 * Main AI advice function
 * 
 * Returns: {
 *   answer: string,
 *   matches: [{id, name, short_name, ...}],
 *   usedData: { universities_count, grants_count, extraction_params },
 *   fallback: false,
 *   confidence: 0.8
 * }
 */
async function getAIAdvice(userMessage, history = []) {
  const startTime = Date.now();

  // === STEP 1: VALIDATE INPUT ===
  if (!userMessage || typeof userMessage !== 'string') {
    throw new Error('Invalid message');
  }

  const msg = userMessage.trim().slice(0, 1000);
  if (msg.length < 3) {
    throw new Error('Message too short');
  }

  // Log incoming user message
  console.log(`\n[ai-service] User message: "${msg}"`);
  console.log(`[ai-service] History length: ${history.length}`);

  // === STEP 2: RETRIEVAL ===
  const { universities, extractedParams } = retrieveRelevantUniversities(msg);
  
  console.log(`[ai-service] Retrieved ${universities.length} universities`);
  const grants = retrieveRelevantGrants(extractedParams.specialties, universities.map(u => u.id));

  // Check if we have enough data
  const dataFound = universities.length > 0;
  const confidence = Math.min(0.9, Math.max(0.3, universities.length / 8));

  // === STEP 3: FALLBACK CHECK ===
  if (!dataFound) {
    return {
      answer: `Я не нашёл университеты, соответствующие вашему запросу. Попробуйте:\n- Указать конкретный вуз или специальность\n- Уточнить бюджет\n- Спросить о грантах\n\nВ моей базе есть информация о 15 вузах Алматы, 35+ специальностях и 13 грантах.`,
      matches: [],
      usedData: {
        universities_count: 0,
        grants_count: 0,
        extraction_params: extractedParams
      },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime
    };
  }

  // === STEP 4: BUILD CONTEXT FOR LLM ===
  const universitiesContext = formatUniversitiesForContext(universities.slice(0, 8));
  const grantsContext = formatGrantsForContext(grants);
  
  const systemPrompt = getSystemPrompt(universitiesContext, grantsContext);

  // === STEP 5: CALL OPENROUTER ===
  let aiResponse = null;
  try {
    aiResponse = await callOpenRouter(systemPrompt, msg, history);
  } catch (err) {
    console.error('[ai-service] LLM call failed:', err.message);
    console.error('[ai-service] Full error:', err);
    // Fallback to safe response
    return {
      answer: `Извините, произошла ошибка при обработке вашего запроса. Попробуйте позже или напишите на edumatchsupport@gmail.com\n\n**Ошибка**: ${err.message}`,
      matches: universities.slice(0, 3),
      usedData: {
        universities_count: universities.length,
        grants_count: grants.length,
        extraction_params: extractedParams
      },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime,
      error: err.message
    };
  }

  // === STEP 6: RETURN STRUCTURED RESPONSE ===
  return {
    answer: aiResponse.text,
    matches: universities.slice(0, 5),  // Top 5 relevant
    usedData: {
      universities_count: universities.length,
      grants_count: grants.length,
      extraction_params: extractedParams,
      model_used: aiResponse.model_used
    },
    fallback: confidence < 0.4,
    confidence: confidence,
    took_ms: Date.now() - startTime
  };
}

module.exports = {
  getAIAdvice,
  retrieveRelevantUniversities,
  retrieveRelevantGrants,
  callOpenRouter,
  formatUniversitiesForContext,
  formatGrantsForContext
};
