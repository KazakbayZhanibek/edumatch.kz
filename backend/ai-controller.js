const { getAIAdvice } = require('./ai-service');
const authService = require('./auth-service');

async function handleAIAdvice(req, res) {
  const startTime = Date.now();

  try {
    const { message, history } = req.body;

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

    let validHistory = [];
    if (Array.isArray(history)) {
      validHistory = history.slice(-20).filter(h => h.role && h.content && typeof h.content === 'string');
    }

    console.log(`[ai-controller] Processing message (${msg.length} chars), history length: ${validHistory.length}`);

    const result = await getAIAdvice(msg, validHistory);

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
      message: err.message,
    });
  }
}

module.exports = { handleAIAdvice };
