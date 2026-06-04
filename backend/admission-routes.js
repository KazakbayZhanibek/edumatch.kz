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
const { verifyAuthOptional } = require('./auth-middleware');
const authService = require('./auth-service');

/**
 * GET /api/admission/options
 * Специальности для формы
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

    const result = getAdmissionPrediction({
      ent,
      attestat,
      cityId,
      specialty,
      budget,
      language,
      needDorm: needDorm === true || needDorm === 'true' || needDorm === 1,
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
    return res.status(500).json({ success: false, error: 'Ошибка расчёта' });
  }
});

/**
 * POST /api/admission/explain
 * ИИ-объяснение для одного вуза
 */
router.post('/explain', verifyAuthOptional, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.university_id && !payload.university) {
      return res.status(400).json({ error: 'Нужны данные вуза' });
    }

    const explanation = await explainAdmissionChance(payload);
    return res.json({ success: true, explanation });
  } catch (err) {
    console.error('[admission] explain error:', err);
    const fallback = 'ИИ-объяснение временно недоступно. Ориентируйтесь на процент и список факторов выше.';
    return res.json({ success: true, explanation: fallback, fallback: true });
  }
});

module.exports = router;
