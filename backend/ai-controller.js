const { getAIAdvice } = require('./ai-service');
const authService = require('./auth-service');
const { evaluateSubmission } = require('./validation-utils');

// Rate limiting: store user request timestamps
const requestLogs = new Map();
const MAX_REQUESTS = 30; // max requests per time window
const TIME_WINDOW = 60000; // 60 seconds
const MAX_KEYS = 5000; // Limit map size to prevent memory leak

function checkRateLimit(userId) {
  const key = userId || 'anonymous';
  const now = Date.now();
  
  if (!requestLogs.has(key)) {
    requestLogs.set(key, []);
  }
  
  const log = requestLogs.get(key);
  // Remove old entries
  const recentRequests = log.filter(t => now - t < TIME_WINDOW);
  requestLogs.set(key, recentRequests);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }
  
  recentRequests.push(now);
  
  // Memory leak prevention: cleanup old entries when map gets too large
  if (requestLogs.size > MAX_KEYS) {
    const now = Date.now();
    const keysToDelete = [];
    for (const [k, v] of requestLogs.entries()) {
      const active = v.filter(t => now - t < TIME_WINDOW);
      if (active.length === 0) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => requestLogs.delete(k));
  }
  
  return true;
}

async function handleAIAdvice(req, res) {
  const startTime = Date.now();

  try {
    const { message, history, applications, replyTo } = req.body;

    // Rate limiting check
    if (!checkRateLimit(req.userId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment before sending another message.',
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message',
      });
    }

    const msg = message.trim();
    if (msg.length < 2) {
      return res.status(400).json({ success: false, error: 'Message too short' });
    }
    if (msg.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 2000 chars)' });
    }

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
        academic_year: String(application.academic_year || '2025-2026').slice(0, 20),
        deadline: application.deadline ? String(application.deadline).slice(0, 30) : null,
        notes: String(application.notes || '').slice(0, 300),
      }));
      validHistory.push({
        role: 'assistant',
        content: `Контекст заявок пользователя (используй только если вопрос относится к заявкам): ${JSON.stringify(safeApplications)}`,
      });
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
