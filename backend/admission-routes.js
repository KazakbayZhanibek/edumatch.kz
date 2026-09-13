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
const { verifyAuthOptional, verifyAuth } = require('./auth-middleware');
const authService = require('./auth-service');
const { getDb } = require('./database');
const { getExplanationForMatch } = require('./admission-explanation-service');
const { tr, getLang } = require('./i18n');

router.get('/history', verifyAuth, (req, res, next) => {
  try {
    const history = getDb().prepare(`SELECT p.id, p.ent, p.specialty_category, p.predicted_chance, p.created_at,
      u.short_name, u.name AS university_name FROM prediction_history p
      LEFT JOIN universities u ON u.id = p.university_id WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 50`).all(req.userId);
    res.json({ history });
  } catch (error) { next(error); }
});

router.delete('/history/all', verifyAuth, (req, res, next) => {
  try {
    const result = getDb().prepare('DELETE FROM prediction_history WHERE user_id = ?').run(req.userId);
    res.json({ success: true, deleted: result.changes });
  } catch (error) { next(error); }
});

router.delete('/history/:id', verifyAuth, (req, res, next) => {
  try {
    const result = getDb().prepare('DELETE FROM prediction_history WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

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
    res.status(500).json({ specialties: [], error: err.message });
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
  const lang = getLang(req);
  try {
    const {
      ent,
      cityId,
      specialty,
      budget,
      language,
      needDorm,
    } = req.body;

    const result = getAdmissionPrediction({
      ent,
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
 *   "cityId": 1,
 *   "specialtyId": 1,
 *   "budgetMax": 2500000,
 *   "language": "ru",
 *   "needsDorm": true,
 *   "useAiExplanation": false
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
    if (result.error && !result.success) {
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
 * - input: { entScore, specialtyId, cityId, budgetMax, language, needsDorm }
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
    const recordsCount = savePredictionHistory(req.userId, input, matches);
    
    return res.json({ success: true, saved: true, recordsCount });
  } catch (err) {
    console.error('[admission] save-history error:', err);
    const lang = getLang(req);
    return res.status(500).json({ success: false, error: tr('adm_save_error', lang) || 'Ошибка сохранения' });
  }
});

// ─── PERSONAL DOCUMENT PLAN ──────────────────────────────

router.get('/document-plan', verifyAuth, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT ent_score, ent_verified_score, military_service, full_name, phone FROM users WHERE id = ?').get(req.userId);
    const applications = db.prepare(`
      SELECT a.*, u.short_name, u.name AS university_name
      FROM application_tracker a
      JOIN universities u ON u.id = a.university_id
      WHERE a.user_id = ?
      ORDER BY a.deadline ASC NULLS LAST
    `).all(req.userId);

    const entVerified = user?.ent_verified_at != null && user.ent_score === user.ent_verified_score;
    const militaryVerified = user?.military_service === 1;

    // Document checklist based on admission requirements
    const documents = [
      { id: 'ent_result', name: 'Результаты ЕНТ', nameKk: 'ҰБТ нәтижелері', required: true, verified: entVerified, category: 'exam' },
      { id: 'attestat', name: 'Аттестат о среднем образовании', nameKk: 'Орта білім туралы аттестат', required: true, verified: false, category: 'education' },
      { id: 'passport', name: 'Копия удостоверения личности', nameKk: 'Жеке куәліктің көшірмесі', required: true, verified: false, category: 'identity' },
      { id: 'photos', name: 'Фотографии 3×4 (6 шт.)', nameKk: 'Суреттер 3×4 (6 дана)', required: true, verified: false, category: 'identity' },
      { id: 'medical', name: 'Медицинская справка', nameKk: 'Медициналық анықтама', required: true, verified: false, category: 'health' },
      { id: 'military', name: 'Документ о военной службе', nameKk: 'Әскери қызмет туралы құжат', required: false, verified: militaryVerified, category: 'military', conditional: 'Для юношей' },
    ];

    // Add grant-specific documents if applicable
    const hasGrant = applications.some(a => a.notes?.toLowerCase().includes('грант'));
    if (hasGrant) {
      documents.push({ id: 'grant_docs', name: 'Документы для гранта', nameKk: 'Грант құжаттары', required: true, verified: false, category: 'grant' });
    }

    // Check deadlines
    const upcomingDeadlines = db.prepare(`
      SELECT d.*, u.short_name FROM deadlines d
      LEFT JOIN universities u ON u.id = d.university_id
      WHERE d.deadline_date > datetime('now')
      ORDER BY d.deadline_date ASC LIMIT 10
    `).all();

    const completedCount = documents.filter(d => d.verified).length;
    const progress = Math.round((completedCount / documents.length) * 100);

    res.json({
      success: true,
      plan: {
        documents,
        applications: applications.map(a => ({
          id: a.id,
          university: a.short_name || a.university_name,
          status: a.status,
          deadline: a.deadline,
          notes: a.notes,
        })),
        deadlines: upcomingDeadlines,
        progress,
        completedCount,
        totalCount: documents.length,
        profile: {
          name: user?.full_name || null,
          phone: user?.phone || null,
          entScore: user?.ent_score || null,
          entVerified,
          militaryVerified,
        }
      }
    });
  } catch (error) { next(error); }
});

// ─── DEADLINES CALENDAR (for authenticated users) ──────────────────────────────

router.get('/deadlines', verifyAuthOptional, (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 90, 1), 365);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const deadlines = getDb().prepare(`
      SELECT d.*, u.short_name, u.name AS university_name
      FROM deadlines d
      LEFT JOIN universities u ON u.id = d.university_id
      WHERE d.deadline_date BETWEEN datetime('now') AND ?
      ORDER BY d.deadline_date ASC
    `).all(until);

    // Group by month
    const grouped = {};
    for (const d of deadlines) {
      const month = d.deadline_date.slice(0, 7);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(d);
    }

    res.json({ success: true, deadlines, grouped });
  } catch (error) { next(error); }
});

module.exports = router;
