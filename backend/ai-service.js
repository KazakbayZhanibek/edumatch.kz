const { getDb } = require('./database');
const { getSystemPrompt, getAdmissionBriefPrompt, getMissingParamsMessage } = require('./ai-prompts');
const { getAdmissionPrediction } = require('./admission-service');

const INTENT_PATTERNS = [
  {
    name: 'admission',
    weight: 0,
    patterns: [
      /(?:поступ|шанс|пройд|вероятност|могу ли я|получу ли).*/i,
      /(?:ент|бал[а-я]*)\s*:?\s*\d{2,3}/i,
      /\d{2,3}\s*(?:бал[а-я]*)(?:\s*ент)?/i,
    ],
    keywords: ['поступ','шанс','пройду','вероятность','ент','проходной','грант'],
  },
  {
    name: 'comparison',
    patterns: [/сравн/i, /отличи/i, /разниц/i, /\s+vs\s+/i, /\bили\b.*\b(?:и|или)\b.*\b(?:вуз|университет)/i],
    keywords: ['сравни','отличие','разница','vs'],
  },
  {
    name: 'grant',
    patterns: [/грант/i, /стипенди/i, /бесплатно/i, /гос.грант/i],
    keywords: ['грант','стипенди','бесплатно','государственный грант'],
  },
  {
    name: 'recommendation',
    patterns: [
      /(?:рекомендуй|посоветуй|подбери|какой вуз|какие университет|лучший вуз|посоветуйте)/i,
      /(?:интересует|хочу|ищу).*(?:вуз|университет|специальность|направление)/i,
    ],
    keywords: ['рекомендуй','посоветуй','подбери','какой','лучший','интересует'],
  },
];

function classifyIntent(message) {
  const q = (message || '').toLowerCase().trim();
  if (!q) return 'general';

  for (const intent of INTENT_PATTERNS) {
    if (intent.name === 'admission') {
      if (intent.patterns.some(p => p.test(q))) return 'admission';
      const kw = intent.keywords.some(k => q.includes(k));
      if (kw && (/\d{2,3}/.test(q) || q.includes('вуз') || q.includes('университет'))) return 'admission';
      continue;
    }
    if (intent.patterns.some(p => p.test(q))) return intent.name;
    if (intent.keywords.some(k => q.includes(k))) return intent.name;
  }

  return 'general';
}

function parseAdmissionQuery(message) {
  const q = (message || '').toLowerCase();
  const db = getDb();
  const result = { ent: null, university_id: null, specialty: null, budget: null, language: null, needDorm: null, attestat: null };

  const entPatterns = [
    /(?:ент|бал[а-я]*)\s*:?\s*(\d{2,3})/i,
    /(\d{2,3})\s*(?:бал[а-я]*)(?:\s*ент)?/i,
  ];
  for (const p of entPatterns) {
    const m = q.match(p);
    if (m) { result.ent = parseInt(m[1], 10); break; }
  }

  if (result.ent !== null && (result.ent < 0 || result.ent > 140)) {
    result.ent = null;
  }

  try {
    const queryWords = new Set(q.toLowerCase().split(/[\s,?!.()«»"':;–—\-]+/).filter(Boolean));
    const unis = db.prepare('SELECT id, short_name, name FROM universities').all();
    for (const u of unis) {
      const shortLower = u.short_name.toLowerCase();
      const nameLower = u.name.toLowerCase();
      const shortWords = shortLower.split(/\s+/);
      const nameWords = nameLower.split(/\s+/);
      let matched = false;
      if (shortWords.length === 1) {
        if (queryWords.has(shortLower)) matched = true;
      } else {
        if (q.includes(shortLower)) matched = true;
      }
      if (!matched) {
        if (nameWords.length === 1) {
          if (queryWords.has(nameLower)) matched = true;
        } else {
          if (q.includes(nameLower)) matched = true;
        }
      }
      if (matched) { result.university_id = u.id; break; }
    }
  } catch (e) {}

  try {
    const queryWords = new Set(q.toLowerCase().split(/[\s,?!.()«»"':;–—\-]+/).filter(Boolean));
    const specs = db.prepare('SELECT name, category FROM specialties').all();
    for (const s of specs) {
      const sLower = s.name.toLowerCase();
      const cLower = s.category.toLowerCase();
      let matched = false;
      const sWords = sLower.split(/\s+/);
      const cWords = cLower.split(/\s+/);
      if (sWords.length === 1) {
        if (queryWords.has(sLower)) matched = true;
      } else {
        if (q.includes(sLower)) matched = true;
      }
      if (!matched) {
        if (cWords.length === 1) {
          if (queryWords.has(cLower)) matched = true;
        } else {
          if (q.includes(cLower)) matched = true;
        }
      }
      if (matched) { result.specialty = s.category; break; }
    }
  } catch (e) {}

  if (!result.specialty) {
    const specMap = {
      'it': 'Информационные технологии',
      'айти': 'Информационные технологии',
      'программирование': 'Информационные технологии',
      'программист': 'Информационные технологии',
      'програмист': 'Информационные технологии',
      'программная инженерия': 'Информационные технологии',
      'программное обеспечение': 'Информационные технологии',
      'computer science': 'Информационные технологии',
      'software': 'Информационные технологии',
      'разработка': 'Информационные технологии',
      'разработчик': 'Информационные технологии',
      'информационные технологии': 'Информационные технологии',
      'медицина': 'Медицина',
      'врач': 'Медицина',
      'экономика': 'Бизнес',
      'бизнес': 'Бизнес',
      'финансы': 'Бизнес',
      'менеджмент': 'Бизнес',
      'маркетинг': 'Бизнес',
      'право': 'Общественные науки',
      'юрист': 'Общественные науки',
      'инженерия': 'Инженерия',
      'инженер': 'Инженерия',
      'гуманитарные': 'Гуманитарные науки',
      'психология': 'Гуманитарные науки',
      'образование': 'Образование',
      'педагог': 'Образование',
      'учитель': 'Образование',
      'искусство': 'Искусство',
      'дизайн': 'Искусство',
      'туризм': 'Туризм',
    };
    for (const [key, val] of Object.entries(specMap)) {
      if (q.includes(key)) { result.specialty = val; break; }
    }
  }

  const budgetMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:млн|миллион)/i);
  if (budgetMatch) result.budget = Math.round(parseFloat(budgetMatch[1]) * 1000000);

  const budgetThous = q.match(/(\d+)\s*(?:тыс|k)\s*(?:тг|тенге)?/i);
  if (budgetThous) result.budget = parseInt(budgetThous[1], 10) * 1000;

  if (q.includes('английск') || q.includes('english')) result.language = 'Английский';
  else if (q.includes('казахск') || q.includes('казах')) result.language = 'Казахский';
  else if (q.includes('русск') || q.includes('рус')) result.language = 'Русский';

  result.needDorm = q.includes('общежитие') || q.includes('проживан');

  return result;
}

function extractBudget(question) {
  if (!question) return null;
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:млн|миллион)/i,
    /(\d+)\s*(?:тыс|k)/i,
    /(\d{6,})/,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      if (question.toLowerCase().includes('млн') || question.toLowerCase().includes('миллион')) {
        value *= 1000000;
      } else if (question.match(/\d+\s*(?:тыс|k)/i)) {
        value *= 1000;
      }
      return Math.round(value);
    }
  }
  return null;
}

function extractSpecialties(question) {
  if (!question) return [];
  const q_lower = question.toLowerCase();
  const db = getDb();
  const allSpecialties = [];
  const categoryMap = {};
  try {
    const stmt = db.prepare('SELECT DISTINCT name, category FROM specialties');
    const rows = stmt.all();
    rows.forEach(row => {
      allSpecialties.push(row.name, row.category);
      categoryMap[row.category.toLowerCase()] = row.category;
    });
  } catch (err) {
    console.error('[ai-service] error fetching specialties:', err.message);
  }

  const matched = [];
  allSpecialties.forEach(spec => {
    const spec_lower = spec.toLowerCase();
    if (q_lower.includes(spec_lower)) {
      matched.push(spec);
    }
  });

  const keywordToCategoryMap = {
    'информационные технологии': 'Информационные технологии',
    'программирование': 'Информационные технологии',
    'программист': 'Информационные технологии',
    'программная инженерия': 'Информационные технологии',
    'программное обеспечение': 'Информационные технологии',
    'разработка': 'Информационные технологии',
    'разработчик': 'Информационные технологии',
    'it': 'Информационные технологии',
    'айти': 'Информационные технологии',
    'software': 'Информационные технологии',
    'медицина': 'Медицина',
    'врач': 'Медицина',
    'экономика': 'Бизнес',
    'финансы': 'Бизнес',
    'бизнес': 'Бизнес',
    'менеджмент': 'Бизнес',
    'маркетинг': 'Бизнес',
    'право': 'Общественные науки',
    'юрист': 'Общественные науки',
    'юриспруденция': 'Общественные науки',
    'инженерия': 'Инженерия',
    'инженер': 'Инженерия',
    'техническая': 'Инженерия',
  };

  for (const [keyword, realCategory] of Object.entries(keywordToCategoryMap)) {
    if (q_lower.includes(keyword)) {
      matched.push(realCategory);
    }
  }

  return [...new Set(matched)];
}

function extractLanguages(question) {
  if (!question) return [];
  const q_lower = question.toLowerCase();
  const languages = [];
  if (q_lower.includes('английск') || q_lower.includes('english')) languages.push('Английский');
  if (q_lower.includes('казах') || q_lower.includes('kazakh')) languages.push('Казахский');
  if (q_lower.includes('русск') || q_lower.includes('russian')) languages.push('Русский');
  return languages;
}

function retrieveRelevantUniversities(question) {
  const db = getDb();
  const question_lower = (question || '').toLowerCase();

  const params = {
    budget_max: extractBudget(question),
    specialties: extractSpecialties(question),
    languages: extractLanguages(question),
    has_dorm: question_lower.includes('общежитие') || question_lower.includes('общежит') || question_lower.includes('проживание'),
    top_n: 8,
  };

  let query = `SELECT DISTINCT u.* FROM universities u`;
  let where = [];
  let params_sql = [];

  if (params.budget_max) {
    where.push('u.price_from <= ?');
    params_sql.push(params.budget_max);
  }

  if (params.specialties.length > 0) {
    query += ` LEFT JOIN university_specialties us ON u.id = us.university_id
               LEFT JOIN specialties s ON us.specialty_id = s.id`;
    const spec_conditions = params.specialties.map(() => '(s.name LIKE ? OR s.category = ?)').join(' OR ');
    where.push(`(${spec_conditions})`);
    params.specialties.forEach(spec => {
      params_sql.push(`%${spec}%`, spec);
    });
  }

  if (params.has_dorm) {
    where.push('u.has_dorm = 1');
  }

  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
  }

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
        data_status: u.data_status,
      });
    });
  } catch (err) {
    console.error('[ai-service] retrieval error:', err.message);
  }

  return { universities, extractedParams: params };
}

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
      link: g.link,
    }));
  } catch (err) {
    console.error('[ai-service] error fetching grants:', err.message);
  }
  return grants;
}

function formatUniversitiesForContext(universities) {
  return universities.map(u => {
    const langs = (u.languages || []).join(', ');
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

function formatGrantsForContext(grants) {
  return grants.slice(0, 7).map((g, i) => {
    return `${i + 1}. ${g.name} (${g.type})
    - Сумма: ${g.amount}
    - Требования: ${(g.requirements || []).join(', ')}
    - Дедлайн: ${g.deadline}`;
  }).join('\n\n');
}

async function callOpenRouter(systemPrompt, userMessage, history) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  const messages = [{ role: 'system', content: systemPrompt }];
  (history || []).slice(-8).forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || '').slice(0, 500),
    });
  });
  messages.push({
    role: 'user',
    content: String(userMessage).slice(0, 800),
  });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.75,
    max_tokens: 640,
  };

  console.log('[ai-service] OpenRouter request:', JSON.stringify({
    model, messages_count: messages.length, system_prompt_length: systemPrompt.length,
    user_message_length: userMessage.length, history_count: history.length,
  }));

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'EduMatchKZ/1.0',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error_text = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${error_text}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Unexpected OpenRouter response format');
    }

    return {
      text: data.choices[0].message.content,
      model_used: data.model,
      usage: data.usage,
    };
  } catch (err) {
    console.error('[ai-service] OpenRouter error:', err.message);
    throw err;
  }
}

async function handleAdmissionChatQuery(msg, history) {
  const startTime = Date.now();
  const params = parseAdmissionQuery(msg);

  const hasEntNumber = /(?:ент|бал[а-я]*)\s*:?\s*(1(?:4[1-9]|[5-9]\d)|[2-9]\d{2,})\b/i.test(msg) ||
    /(1(?:4[1-9]|[5-9]\d)|[2-9]\d{2,})\s*(?:бал[а-я]*)/i.test(msg);
  if (hasEntNumber) {
    return {
      answer: 'Максимальный балл ЕНТ — 140. Укажите корректное значение (0–140).',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'invalid_ent', params },
    };
  }

  if (!params.ent && !params.specialty && !params.university_id) {
    return {
      answer: 'Укажите балл ЕНТ и направление, чтобы я рассчитал шансы.\n\nНапример: *"Поступлю ли я в КБТУ на IT с ЕНТ 110?"*',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'missing_params', params },
    };
  }

  const db = getDb();
  let specialtyToUse = params.specialty;

  if (!specialtyToUse && params.university_id) {
    try {
      const uniSpecs = db.prepare(`
        SELECT DISTINCT s.category FROM specialties s
        JOIN university_specialties us ON s.id = us.specialty_id
        WHERE us.university_id = ?
        LIMIT 1
      `).get(params.university_id);
      if (uniSpecs) specialtyToUse = uniSpecs.category;
    } catch (e) {}
  }

  if (!specialtyToUse) {
    if (params.ent) {
      // Try to find any matching universities across all specialties
      try {
        // Find best specialty per university: the one with highest avg_ent where user qualifies
        const allCandidates = db.prepare(`
          SELECT ar.*, u.id AS uid, u.short_name, u.name, u.qs_world, s.category
          FROM admission_requirements ar
          JOIN universities u ON ar.university_id = u.id
          JOIN specialties s ON ar.specialty_id = s.id
          WHERE ar.min_ent <= ?
          ORDER BY u.qs_world ASC NULLS LAST
        `).all(params.ent);

        if (allCandidates.length > 0) {
          // For each university, find the BEST specialty:
          // - First try: specialty with highest avg_ent where ent >= avg_ent (most competitive that user can enter)
          // - Second try: specialty with smallest gap between ent and avg_ent (closest match)
          const bestPerUni = new Map();
          for (const c of allCandidates) {
            if (!bestPerUni.has(c.uid)) {
              bestPerUni.set(c.uid, []);
            }
            bestPerUni.get(c.uid).push(c);
          }

          const results = [];
          for (const [uid, rows] of bestPerUni) {
            const qualifying = rows.filter(r => params.ent >= r.avg_ent);
            let chosen;
            if (qualifying.length > 0) {
              chosen = qualifying.sort((a, b) => b.avg_ent - a.avg_ent)[0];
            } else {
              chosen = rows.sort((a, b) => (b.avg_ent - a.avg_ent))[0];
            }
            const diff = params.ent - chosen.avg_ent;
            results.push({ id: uid, short_name: chosen.short_name, name: chosen.name, qs_world: chosen.qs_world, category: chosen.category, avg_ent: chosen.avg_ent, min_ent: chosen.min_ent, grant: chosen.grant_min_ent, diff, qualifies: diff >= 0 });
          }

          const top = results
            .sort((a, b) => {
              if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
              if (a.diff !== b.diff) return b.diff - a.diff;
              return (a.qs_world || 999) - (b.qs_world || 999);
            })
            .slice(0, 7);

          const qualifyCount = results.filter(r => r.qualifies).length;
          const totalCount = results.length;

          let text = `🎯 **С вашим баллом ${params.ent}**\n\n`;
          if (qualifyCount > 0) {
            text += `Ваш балл подходит для **${qualifyCount}** вузов (из ${totalCount} с данными):\n\n`;
          } else {
            text += `Ваш балл чуть ниже среднего по всем вузам, но есть варианты:\n\n`;
          }

          top.forEach((u, i) => {
            const emoji = u.qualifies ? '🟢' : '🟡';
            const qs = u.qs_world ? ` (QS #${u.qs_world})` : '';
            text += `${emoji} **${u.short_name}**${qs} — ${u.category}, средний ЕНТ ${u.avg_ent}`;
            if (u.qualifies) {
              text += `, вы **на ${u.diff} выше**`;
            } else {
              text += `, вам не хватает ${Math.abs(u.diff)}`;
            }
            if (u.grant && params.ent >= u.grant) text += ` ✅ грант`;
            text += '\n';
          });
          text += `\n💡 Напишите вуз и направление для точного расчёта.\nНапример: *"Мои шансы в КБТУ на IT"*`;

          return {
            answer: text,
            matches: [],
            usedData: { universities_count: totalCount, grants_count: 0, extraction_params: params, admission_result: null },
            fallback: false,
            confidence: 0.9,
            took_ms: Date.now() - startTime,
            intent: 'admission',
            admission: { type: 'overview', params },
          };
        }
      } catch (e) {
        console.error('[ai-service] overview query error:', e.message);
      }

      // Fallback: suggest popular specialties
      const popularSpecs = ['Информационные технологии', 'Медицина', 'Бизнес', 'Инженерия', 'Образование'];
      let specHint = popularSpecs.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return {
        answer: `Я вижу ЕНТ: **${params.ent}** баллов. На какое направление хотите поступить?\n\n${specHint}\n\nНапишите, например: *"Шансы на IT с ${params.ent} баллами"* или *"Поступлю ли в КБТУ на программиста"*`,
        matches: [],
        usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
        fallback: false,
        confidence: 0.9,
        took_ms: Date.now() - startTime,
        intent: 'admission',
        admission: { type: 'missing_specialty', params },
      };
    }
    return {
      answer: 'Укажите балл ЕНТ и направление.\n\nНапример: *"Поступлю ли я в КБТУ на IT с ЕНТ 110?"*',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'missing_params', params },
    };
  }

  const prediction = getAdmissionPrediction({
    ent: params.ent || 100,
    specialty: specialtyToUse,
    budget: params.budget || undefined,
    language: params.language || undefined,
    needDorm: params.needDorm || false,
    cityId: params.university_id ? undefined : undefined,
    attestat: params.attestat || undefined,
  });

  if (!prediction.success) {
    return {
      answer: prediction.error || 'Ошибка при расчёте шансов. Попробуйте другие параметры.',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.7,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'error', params },
    };
  }

  let filtered = prediction.matches;
  if (params.university_id) {
    filtered = prediction.matches.filter(m => m.university_id === params.university_id);
    if (filtered.length === 0) {
      const uni = db.prepare('SELECT short_name, name FROM universities WHERE id = ?').get(params.university_id);
      return {
        answer: `По направлению "${specialtyToUse}" данных для ${uni?.short_name || 'этого вуза'} пока нет. Попробуйте другое направление или посмотрите другие вузы.`,
        matches: [],
        usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
        fallback: false,
        confidence: 0.8,
        took_ms: Date.now() - startTime,
        intent: 'admission',
        admission: { type: 'no_match', params, prediction },
      };
    }
  }

  const answer = getAdmissionBriefPrompt(params, { ...prediction, matches: filtered });

  return {
    answer,
    matches: [],
    usedData: {
      universities_count: prediction.matches.length,
      grants_count: 0,
      extraction_params: params,
      admission_result: { matches: filtered.slice(0, 5), input: prediction.input },
    },
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'admission',
    admission: {
      type: 'result',
      params,
      matches: filtered.slice(0, 8),
      input: prediction.input,
    },
  };
}

async function getAIAdvice(userMessage, history = []) {
  const startTime = Date.now();

  if (!userMessage || typeof userMessage !== 'string') {
    throw new Error('Invalid message');
  }

  const msg = userMessage.trim().slice(0, 1000);
  if (msg.length < 3) {
    throw new Error('Message too short');
  }

  console.log(`\n[ai-service] User message: "${msg}"`);
  console.log(`[ai-service] History length: ${history.length}`);

  const intent = classifyIntent(msg);
  console.log(`[ai-service] Classified intent: "${intent}"`);

  if (intent === 'admission') {
    console.log('[ai-service] Routing to admission handler');
    return handleAdmissionChatQuery(msg, history);
  }

  const { universities, extractedParams } = retrieveRelevantUniversities(msg);
  console.log(`[ai-service] Retrieved ${universities.length} universities`);
  const grants = retrieveRelevantGrants(extractedParams.specialties, universities.map(u => u.id));

  const dataFound = universities.length > 0;
  const confidence = Math.min(0.9, Math.max(0.3, universities.length / 8));

  if (!dataFound) {
    return {
      answer: `Я не нашёл университеты, соответствующие вашему запросу. Попробуйте:\n- Указать конкретный вуз или специальность\n- Уточнить бюджет\n\nВ моей базе есть информация о вузах Казахстана, 35+ специальностях и грантах.`,
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: extractedParams },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime,
      intent,
    };
  }

  const universitiesContext = formatUniversitiesForContext(universities.slice(0, 8));
  const grantsContext = formatGrantsForContext(grants);
  const systemPrompt = getSystemPrompt(intent, universitiesContext, grantsContext);

  let aiResponse = null;
  try {
    aiResponse = await callOpenRouter(systemPrompt, msg, history);
  } catch (err) {
    console.error('[ai-service] LLM call failed:', err.message);
    return {
      answer: `Извините, произошла ошибка. Попробуйте позже.`,
      matches: universities.slice(0, 3),
      usedData: {
        universities_count: universities.length,
        grants_count: grants.length,
        extraction_params: extractedParams,
      },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime,
      intent,
      error: err.message,
    };
  }

  return {
    answer: aiResponse.text,
    matches: universities.slice(0, 5),
    usedData: {
      universities_count: universities.length,
      grants_count: grants.length,
      extraction_params: extractedParams,
      model_used: aiResponse.model_used,
    },
    fallback: confidence < 0.4,
    confidence,
    took_ms: Date.now() - startTime,
    intent,
  };
}

module.exports = {
  getAIAdvice,
  classifyIntent,
  parseAdmissionQuery,
  retrieveRelevantUniversities,
  retrieveRelevantGrants,
  callOpenRouter,
  formatUniversitiesForContext,
  formatGrantsForContext,
};
