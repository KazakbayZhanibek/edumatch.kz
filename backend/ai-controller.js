/**
 * AI CONTROLLER
 * HTTP request handling + validation + response formatting
 */

const { getAIAdvice } = require('./ai-service');
const authService = require('./auth-service');

/**
 * POST /api/ai/advice
 * 
 * Request body:
 * {
 *   "message": "У меня бюджет 1.2 млн, интересует IT",
 *   "history": [
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "answer": "...",
 *   "matches": [...],
 *   "usedData": {...},
 *   "fallback": false,
 *   "confidence": 0.8
 * }
 */
async function handleAIAdvice(req, res) {
  const startTime = Date.now();

  try {
    // === INPUT VALIDATION ===
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message'
      });
    }

    const msg = message.trim();
    if (msg.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Message too short'
      });
    }

    if (msg.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long (max 2000 chars)'
      });
    }

    // Validate history
    let validHistory = [];
    if (Array.isArray(history)) {
      validHistory = history
        .slice(-20)  // Max 20 messages
        .filter(h => h.role && h.content && typeof h.content === 'string');
    }

    // === CALL AI SERVICE ===
    console.log(`[ai-controller] Processing message (${msg.length} chars), history length: ${validHistory.length}`);
    
    const result = await getAIAdvice(msg, validHistory);

    // === STRUCTURE RESPONSE ===
    const response = {
      success: true,
      answer: result.answer,
      matches: result.matches.map(u => ({
        id: u.id,
        name: u.name,
        short_name: u.short_name,
        price_from: u.price_from,
        price_to: u.price_to,
        qs_world: u.qs_world,
        website: u.website,
        languages: u.languages,
        specialties: u.specialties.map(s => s.name)
      })),
      metadata: {
        confidence: result.confidence,
        fallback: result.fallback,
        universities_analyzed: result.usedData.universities_count,
        grants_analyzed: result.usedData.grants_count,
        took_ms: result.took_ms
      }
    };

    // Log statistics
    console.log(`[ai-controller] Response: confidence=${result.confidence.toFixed(2)}, fallback=${result.fallback}, took=${result.took_ms}ms`);

    // Сохранить в историю, если пользователь авторизован
    if (req.userId && result.answer) {
      authService.saveChatMessage(req.userId, msg, result.answer, {
        confidence: result.confidence,
        fallback: result.fallback,
        matches_count: result.matches?.length || 0
      });
    }

    return res.json(response);

  } catch (err) {
    console.error('[ai-controller] Error:', err.message);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
}

module.exports = {
  handleAIAdvice
};
