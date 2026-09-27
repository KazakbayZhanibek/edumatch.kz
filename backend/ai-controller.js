const { getAIAdvice } = require('./ai-service');
const authService = require('./auth-service');
const { evaluateSubmission } = require('./validation-utils');
const { getDb } = require('./database');

// Rate limiting: store user request timestamps
const requestLogs = new Map();
const MAX_REQUESTS = 30; // max requests per time window
const TIME_WINDOW = 60000; // 60 seconds
const MAX_KEYS = 5000; // Limit map size to prevent memory leak

// Daily limit per user (requests)
const DAILY_LIMIT = 100;
// Daily token budget per user (approximate cost control)
const DAILY_TOKEN_LIMIT = 500000;
// Anonymous daily request limit (stricter than authenticated)
const ANONYMOUS_DAILY_LIMIT = 20;
// Anonymous daily usage tracked in-memory (no DB row needed)
const anonymousDailyUsage = new Map();

function checkRateLimit(userId) {
  const key = userId || 'anonymous';
  const now = Date.now();
  
  if (!requestLogs.has(key)) {
    requestLogs.set(key, []);
  }
  
  const log = requestLogs.get(key);
  const recentRequests = log.filter(t => now - t < TIME_WINDOW);
  requestLogs.set(key, recentRequests);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return { allowed: false, reason: 'rate_limit_minute' };
  }
  
  recentRequests.push(now);
  
  if (requestLogs.size > MAX_KEYS) {
    const keysToDelete = [];
    for (const [k, v] of requestLogs.entries()) {
      const active = v.filter(t => now - t < TIME_WINDOW);
      if (active.length === 0) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => requestLogs.delete(k));
  }
  
  return { allowed: true };
}

function checkDailyLimit(userId) {
  if (!userId) {
    // Anonymous: use in-memory map
    const today = new Date().toISOString().slice(0, 10);
    const key = `anon_${today}`;
    const count = anonymousDailyUsage.get(key) || 0;
    if (count >= ANONYMOUS_DAILY_LIMIT) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: ANONYMOUS_DAILY_LIMIT - count };
  }
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const row = db.prepare('SELECT request_count FROM ai_usage WHERE user_id = ? AND request_date = ?').get(userId, today);
    if (row && row.request_count >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: DAILY_LIMIT - (row?.request_count || 0) };
  } catch (e) {
    return { allowed: true };
  }
}

function checkTokenBudget(userId) {
  if (!userId) return { allowed: true };
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const row = db.prepare('SELECT COALESCE(SUM(total_tokens), 0) as tokens FROM token_usage_log WHERE user_id = ? AND date(checked_at) = ?').get(userId, today);
    if (row && row.tokens >= DAILY_TOKEN_LIMIT) {
      return { allowed: false, remaining: 0, used: row.tokens };
    }
    return { allowed: true, remaining: DAILY_TOKEN_LIMIT - (row?.tokens || 0), used: row?.tokens || 0 };
  } catch (e) {
    return { allowed: true };
  }
}

function incrementDailyUsage(userId) {
  if (!userId) {
    // Anonymous: increment in-memory
    const today = new Date().toISOString().slice(0, 10);
    const key = `anon_${today}`;
    anonymousDailyUsage.set(key, (anonymousDailyUsage.get(key) || 0) + 1);
    // Evict old entries daily
    if (anonymousDailyUsage.size > 10000) {
      for (const [k] of anonymousDailyUsage) {
        if (!k.endsWith(`_${today}`)) anonymousDailyUsage.delete(k);
      }
    }
    return;
  }
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT INTO ai_usage (user_id, request_date, request_count) VALUES (?, ?, 1)
      ON CONFLICT(user_id, request_date) DO UPDATE SET request_count = request_count + 1`).run(userId, today);
  } catch (e) { /* ignore */ }
}

function logTokenUsage(userId, promptTokens, completionTokens, model) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO token_usage_log (user_id, prompt_tokens, completion_tokens, total_tokens, model, checked_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId || 'anonymous', promptTokens || 0, completionTokens || 0, (promptTokens || 0) + (completionTokens || 0), model || 'unknown', new Date().toISOString());
  } catch (e) { /* ignore */ }
}

const AI_DISCLAIMER = {
  ru: '⚠️ Ответы ИИ носят рекомендательный характер и не являются официальной консультацией. Для точной информации обращайтесь в приёмную комиссию вуза.',
  kk: '⚠️ Жасанды интеллект жауаптары ұсыныс сипатында және ресми кеңес болып табылмайды. Нақты ақпарат үшін университетке хабарласыңыз.',
  en: '⚠️ AI responses are advisory only and do not constitute official consultation. For accurate information, contact the university admissions office.'
};

async function handleAIAdvice(req, res) {
  const startTime = Date.now();

  try {
    const { message, history, applications, replyTo } = req.body;

    // Rate limiting check
    const rateCheck = checkRateLimit(req.userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Слишком много запросов. Подождите минуту.',
        errorKey: 'rate_limit',
      });
    }

    // Daily limit check
    const dailyCheck = checkDailyLimit(req.userId);
    if (!dailyCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: req.userId ? 'Достигнут дневной лимит запросов (100). Попробуйте завтра.' : 'Достигнут дневной лимит для гостевого доступа (20). Зарегистрируйтесь для увеличения лимита.',
        errorKey: 'daily_limit',
      });
    }

    // Token budget check (authenticated users only)
    const tokenCheck = checkTokenBudget(req.userId);
    if (!tokenCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Достигнут дневной лимит по токенам. Попробуйте завтра.',
        errorKey: 'token_limit',
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Некорректное сообщение' });
    }

    const msg = message.trim();
    if (msg.length < 2) return res.status(400).json({ success: false, error: 'Сообщение слишком короткое' });
    if (msg.length > 2000) return res.status(400).json({ success: false, error: 'Сообщение слишком длинное (макс. 2000 символов)' });

    const submissionCheck = evaluateSubmission(msg, {
      maxLength: 1000,
      bannedTerms: ['bypass', 'exploit', 'hack', 'override', 'ignore policy'],
      requiredTerms: [],
    });

    if (!submissionCheck.allowed) {
      const reasons = {
        missing_input: 'Missing input',
        empty_input: 'Empty input',
        too_long: 'Message too long',
        blocked_terms: 'Message contains blocked terms',
        missing_required_terms: 'Message is missing required context',
      };

      return res.status(400).json({
        success: false,
        error: reasons[submissionCheck.reason] || 'Message rejected',
        reason: submissionCheck.reason,
        details: submissionCheck.matches || submissionCheck.missing || null,
      });
    }

    let validHistory = [];
    if (Array.isArray(history)) {
      validHistory = history.slice(-20).filter(h => h.role && h.content && typeof h.content === 'string');
    }

    if (Array.isArray(applications) && applications.length > 0) {
      const safeApplications = applications.slice(0, 30).map(application => ({
        name: String(application.name || '').slice(0, 120),
        status: String(application.status || 'collecting').slice(0, 20),
        academic_year: String(application.academic_year || '2026-2027').slice(0, 20),
        deadline: application.deadline ? String(application.deadline).slice(0, 30) : null,
        notes: String(application.notes || '').slice(0, 300),
      }));
      validHistory.push({
        role: 'assistant',
        content: `Контекст заявок пользователя (используй только если вопрос относится к заявкам): ${JSON.stringify(safeApplications)}`,
      });
    }

    // Добавляем контекст профиля пользователя (ЕНТ, армия)
    if (req.userId) {
      try {
        const profile = authService.getUserProfile(req.userId);
        if (profile) {
          const profileContext = [];
          if (profile.ent_score != null) profileContext.push(`Балл ЕНТ: ${profile.ent_score} (${profile.ent_verified_at ? 'проверен администратором' : 'указан пользователем'})`);
          if (profile.military_service) profileContext.push('Военная служба подтверждена администратором. Не обещай льготы или повышенные шансы: условия конкретного вуза требуют отдельной проверки.');
          if (profile.bio) profileContext.push(`О себе: ${profile.bio}`);
          if (profileContext.length > 0) {
            validHistory.push({
              role: 'assistant',
              content: `Данные профиля пользователя: ${profileContext.join('. ')}. Используй это для персонализации рекомендаций.`,
            });
          }
        }
      } catch (e) {
        // ignore profile fetch errors
      }
    }
    if (typeof replyTo === 'string' && replyTo.trim()) {
      validHistory.push({
        role: 'assistant',
        content: `Пользователь отвечает на это сообщение: ${replyTo.trim().slice(0, 1500)}`,
      });
    }

    const lang = req.body.lang || req.query.lang || 'ru';

    console.log(`[ai-controller] Processing message (${msg.length} chars), history length: ${validHistory.length}`);

    const result = await getAIAdvice(msg, validHistory, lang);

    const response = {
      success: true,
      answer: result.answer,
      matches: (result.matches || []).map(u => ({
        id: u.id,
        name: u.name,
        short_name: u.short_name,
        price_from: u.price_from,
        price_to: u.price_to,
        qs_world: u.qs_world,
        qs_asia: u.qs_asia,
        website: u.website,
        languages: u.languages || [],
        specialties: (u.specialties || []).map(s => s.name || s.category || String(s)).filter(Boolean),
        has_dorm: u.has_dorm,
        avg_salary: u.avg_salary,
        city_name: u.city_name,
      })),
      intent: result.intent || 'general',
      detectedLang: result.detectedLang || null,
      metadata: {
        confidence: result.confidence,
        fallback: result.fallback,
        universities_analyzed: result.usedData?.universities_count || 0,
        grants_analyzed: result.usedData?.grants_count || 0,
        took_ms: result.took_ms,
      },
    };

    if (result.admission) {
      response.admission = {
        type: result.admission.type,
        params: result.admission.params,
        matches: (result.admission.matches || []).map(m => ({
          university_id: m.university_id,
          university: m.university,
          name: m.name,
          chance: m.chance,
          recommendation: m.recommendation,
          reasons: (m.reasons || []).map(r => ({ type: r.type, text: r.text })),
          requirement: m.requirement ? {
            min_ent: m.requirement.min_ent,
            avg_ent: m.requirement.avg_ent,
            grant_min_ent: m.requirement.grant_min_ent,
          } : null,
        })),
        input: result.admission.input,
      };
    }

    console.log(`[ai-controller] Response: intent=${result.intent}, confidence=${result.confidence?.toFixed(2)}, fallback=${result.fallback}, took=${result.took_ms}ms`);

    if (req.userId && result.answer) {
      authService.saveChatMessage(req.userId, msg, result.answer, {
        confidence: result.confidence,
        fallback: result.fallback,
        intent: result.intent,
        matches_count: result.matches?.length || 0,
      });
      incrementDailyUsage(req.userId);
    }

    // Add disclaimer and usage info
    response.disclaimer = AI_DISCLAIMER[lang] || AI_DISCLAIMER.ru;
    response.dailyLimit = {
      used: (dailyCheck.remaining !== undefined ? (req.userId ? DAILY_LIMIT : ANONYMOUS_DAILY_LIMIT) - dailyCheck.remaining : 0),
      limit: req.userId ? DAILY_LIMIT : ANONYMOUS_DAILY_LIMIT,
      tokenUsed: tokenCheck.used || 0,
      tokenLimit: DAILY_TOKEN_LIMIT,
    };

    // Log token usage for cost tracking
    if (result.metadata?.prompt_tokens || result.metadata?.completion_tokens) {
      logTokenUsage(req.userId, result.metadata.prompt_tokens, result.metadata.completion_tokens, result.metadata?.model);
    }

    return res.json(response);
  } catch (err) {
    console.error('[ai-controller] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

module.exports = { handleAIAdvice };
