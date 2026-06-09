/**
 * Admission Predictor API
 */

const express = require('express');
const router = express.Router();
const {
  getAdmissionPrediction,
  savePredictionHistory,
  explainAdmissionChance,
  SPECIALTY_MAP,
} = require('./admission-service');
const {
  calculateAdmissionChance,
} = require('./admission-calculator');
const { verifyAuthOptional } = require('./auth-middleware');
const authService = require('./auth-service');
const { getDb } = require('./database');
const { getExplanationForMatch } = require('./admission-explanation-service');
const { tr, getLang } = require('./i18n');

/**
 * GET /api/admission/specialties
 * Все специальности из БД
 */
router.get('/specialties', (req, res) => {
  try {
    console.log('GET /specialties called');
    const db = getDb();
    const specialties = db.prepare('SELECT id, name FROM specialties ORDER BY name').all();
    console.log(`Found ${specialties.length} specialties`);
    res.json({ specialties });
  } catch (err) {
    console.error('Error fetching specialties:', err);
    res.json({ specialties: [] });
  }
});

/**
 * GET /api/admission/options
 * Специальности для формы (legacy)
 */
router.get('/options', (req, res) => {
  const specialties = Object.entries(SPECIALTY_MAP)
    .filter(([key]) => key.length < 30 && !key.includes(' '))
    .map(([value, category]) => ({ value, label: value, category }));

  const unique = [];
  const seen = new Set();
  for (const s of specialties) {
    if (!seen.has(s.category)) {
      seen.add(s.category);
      unique.push({ value: s.value, label: s.label, category: s.category });
    }
  }

  res.json({ specialties: unique });
});

/**
 * POST /api/admission/predict
 */
router.post('/predict', verifyAuthOptional, (req, res) => {
  try {
    const {
      ent,
      attestat,
      cityId,
      specialty,
      budget,
      language,
      needDorm,
    } = req.body;
    const lang = getLang(req);

    const result = getAdmissionPrediction({
      ent,
      attestat,
      cityId,
      specialty,
      budget,
      language,
      needDorm: needDorm === true || needDorm === 'true' || needDorm === 1,
      lang: req.body.lang || req.query.lang || 'ru',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (req.userId) {
      savePredictionHistory(req.userId, result.input, result.matches);
      authService.saveTestResult(
        req.userId,
        'admission_predict',
        ent,
        140,
        {
          summary: `Топ: ${result.matches[0]?.university || '—'} (${result.matches[0]?.chance || 0}%)`,
          specialty: result.input.specialty,
          topMatches: result.matches.slice(0, 3).map(m => ({
            id: m.university_id,
            chance: m.chance,
          })),
        }
      );
    }

    return res.json(result);
  } catch (err) {
    console.error('[admission] predict error:', err);
    return res.status(500).json({ success: false, error: tr('adm_calc_error', lang) || 'Ошибка расчёта' });
  }
});

/**
 * POST /api/admission/explain
 * ИИ-объяснение для одного вуза
 */
router.post('/explain', verifyAuthOptional, async (req, res) => {
  try {
    const payload = req.body;
    const lang = getLang(req);
    if (!payload.university_id && !payload.university) {
      return res.status(400).json({ error: tr('adm_uni_data_needed', lang) || 'Нужны данные вуза' });
    }

    payload.lang = payload.lang || req.query.lang || 'ru';
    const explanation = await explainAdmissionChance(payload);
    return res.json({ success: true, explanation });
  } catch (err) {
    console.error('[admission] explain error:', err);
    const fallback = 'ИИ-объяснение временно недоступно. Ориентируйтесь на процент и список факторов выше.';
    return res.json({ success: true, explanation: fallback, fallback: true });
  }
});

/**
 * POST /api/admission/calculate
 * Детерминированный расчет без AI с использованием исторической статистики
 * 
 * Input:
 * {
 *   "entScore": 110,
 *   "gpa": 4.5,
 *   "cityId": 1,
 *   "specialtyId": 1,
 *   "budgetMax": 2500000,
 *   "language": "ru",
 *   "needsDorm": true,
 *   "useAiExplanation": false  // ← NEW: опционально добавить AI объяснение
 * }
 * 
 * Output:
 * {
 *   "success": true,
 *   "matches": [...],
 *   "explanation": {  // ← NEW: если useAiExplanation: true
 *     "summary": "...",
 *     "strengths": ["..."],
 *     "risks": ["..."],
 *     "strategy": "safe|target|ambitious|mixed",
 *     "tips": ["..."],
 *     "fallback": false
 *   }
 * }
 */
router.post('/calculate', verifyAuthOptional, async (req, res) => {
  const lang = getLang(req);
  try {
    const input = req.body;
    const useAiExplanation = input.useAiExplanation === true;
    
    console.log('[admission /calculate] Received request, useAiExplanation:', useAiExplanation);
    
    // Валидируем входные данные
    if (input.entScore === undefined) {
      return res.status(400).json({ error: tr('adm_ent_required', lang) || 'entScore обязателен' });
    }
    if (input.specialtyId === undefined) {
      return res.status(400).json({ error: tr('adm_spec_required', lang) || 'specialtyId обязателен' });
    }

    // Выполняем расчет (чистая логика, без AI)
    const result = calculateAdmissionChance(input);
    
    // DEBUG: Log contacts
    if (result.matches && result.matches.length > 0) {
      console.log('[DEBUG] First match has contacts:', !!result.matches[0].contacts);
    }
    
    console.log('[admission] Result: success=', result.success, 'matches=', result.matches ? result.matches.length : 0);

    // Если ошибка валидации
    if (result.error && !result.matches) {
      return res.status(400).json({ error: result.error });
    }

    // Опционально: добавляем AI объяснение для ВСЕХ matches
    if (useAiExplanation && result.success && result.matches && result.matches.length > 0) {
      try {
        console.log('[admission] Requesting AI explanation for', result.matches.length, 'matches');
        
        // Подготавливаем данные для AI
        const normalizedInput = {
          ent: input.entScore,
          specialty: result.specialty || '—',
          budget: input.budgetMax,
          language: input.language,
          needDorm: input.needsDorm,
          attestat: input.gpa,
        };

        // Получаем объяснение
        const explanation = await getExplanationForMatch(result.matches, normalizedInput, true);
        result.explanation = explanation;
        
        console.log('[admission] AI explanation added, fallback:', explanation.fallback);
      } catch (error) {
        console.error('[admission] AI explanation failed, continuing without:', error.message);
        // Не прерываем запрос, просто не добавляем explanation
      }
    }

    return res.json(result);
  } catch (err) {
    console.error('[admission] calculate error:', err);
    return res.status(500).json({ error: (tr('adm_calc_error_msg', lang) || 'Ошибка расчёта: ') + err.message });
  }
});

/**
 * POST /api/admission/save-history
 * Сохраняет результаты расчета в prediction_history
 * 
 * Требует:
 * - userId (из auth token или не требуется если анонимный)
 * - input: { entScore, specialtyId, gpa, cityId, budgetMax, language, needsDorm }
 * - matches: массив из результатов расчета
 */
router.post('/save-history', verifyAuthOptional, (req, res) => {
  try {
    const { input, matches } = req.body;
    const lang = getLang(req);
    
    // Если не авторизован, просто возвращаем успех (local-only)
    if (!req.userId || !input || !matches || !Array.isArray(matches)) {
      return res.json({ success: true, saved: false, reason: 'Anonymous or incomplete data' });
    }

    // Сохраняем в prediction_history для авторизованных пользователей
    savePredictionHistory(req.userId, input, matches);
    
    return res.json({ success: true, saved: true, recordsCount: Math.min(matches.length, 5) });
  } catch (err) {
    console.error('[admission] save-history error:', err);
    const lang = getLang(req);
    return res.status(500).json({ success: false, error: tr('adm_save_error', lang) || 'Ошибка сохранения' });
  }
});

module.exports = router;
