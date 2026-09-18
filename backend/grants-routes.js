const express = require('express');
const router = express.Router();
const { getDb } = require('./database');
const { verifyAuth, verifyAdmin } = require('./auth-middleware');

// ─── PUBLIC: Grants catalog with filters ────────────────────────────
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const {
      q, type, city_id, university_id, coverage_type, academic_year,
      study_level, programme_code, status, verified_only, deadline_active,
      sort, limit: limitRaw, offset: offsetRaw
    } = req.query;

    const limit = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 20, 1), 100);
    const offset = Math.max(Number.parseInt(offsetRaw, 10) || 0, 0);
    const conditions = ['g.is_active = 1'];
    const params = [];

    if (q && q.trim()) {
      conditions.push('(g.name LIKE ? OR g.description LIKE ? OR g.provider_name LIKE ?)');
      const term = `%${q.trim().slice(0, 100)}%`;
      params.push(term, term, term);
    }
    if (type && ['government', 'university', 'corporate', 'regional', 'foundation', 'international', 'discount'].includes(type)) {
      conditions.push('g.type = ?');
      params.push(type);
    }
    if (city_id) {
      conditions.push('(g.city_id = ? OR gc.city_id = ?)');
      params.push(Number(city_id), Number(city_id));
    }
    if (university_id) {
      conditions.push('(g.university_id = ? OR gu.university_id = ?)');
      params.push(Number(university_id), Number(university_id));
    }
    if (coverage_type) {
      conditions.push('g.coverage_type = ?');
      params.push(coverage_type);
    }
    if (academic_year) {
      conditions.push('g.academic_year = ?');
      params.push(academic_year);
    }
    if (study_level) {
      conditions.push("g.study_levels LIKE ?");
      params.push(`%"${study_level}"%`);
    }
    if (programme_code) {
      conditions.push("g.programme_codes LIKE ?");
      params.push(`%"${programme_code}"%`);
    }
    if (status && ['needs_review', 'verified', 'expired', 'rejected', 'source_unavailable'].includes(status)) {
      conditions.push('g.verification_status = ?');
      params.push(status);
    } else if (verified_only === '1') {
      conditions.push("g.verification_status = 'verified'");
    }
    if (deadline_active === '1') {
      conditions.push("(g.deadline IS NULL OR g.deadline = '' OR g.deadline >= date('now'))");
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderMap = {
      verified_first: "CASE g.verification_status WHEN 'verified' THEN 0 WHEN 'needs_review' THEN 1 ELSE 2 END, g.name",
      deadline: "CASE WHEN g.deadline IS NULL OR g.deadline = '' THEN '9999' ELSE g.deadline END ASC",
      newest: 'g.id DESC',
      name: 'g.name ASC',
    };
    const orderBy = orderMap[sort] || orderMap.verified_first;

    // Left-join grant_universities and grant_cities for multi-university grants
    const total = db.prepare(`SELECT COUNT(DISTINCT g.id) as c FROM grants g
      LEFT JOIN grant_universities gu ON gu.grant_id = g.id
      LEFT JOIN grant_cities gc ON gc.grant_id = g.id
      ${where}`).get(...params).c;

    const grants = db.prepare(`SELECT DISTINCT g.*,
      u.short_name as uni_short_name, u.name as uni_name,
      c.name as city_name
      FROM grants g
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      LEFT JOIN grant_universities gu ON gu.grant_id = g.id
      LEFT JOIN grant_cities gc ON gc.grant_id = g.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`).all(...params, limit, offset);

    // Attach related universities for multi-university grants
    const grantIds = grants.map(g => g.id);
    if (grantIds.length) {
      const placeholders = grantIds.map(() => '?').join(',');
      const relatedUnis = db.prepare(`SELECT gu.grant_id, u.id as university_id, u.short_name, u.name
        FROM grant_universities gu JOIN universities u ON u.id = gu.university_id
        WHERE gu.grant_id IN (${placeholders})`).all(...grantIds);
      const uniMap = {};
      for (const r of relatedUnis) {
        if (!uniMap[r.grant_id]) uniMap[r.grant_id] = [];
        uniMap[r.grant_id].push({ id: r.university_id, short_name: r.short_name, name: r.name });
      }
      for (const g of grants) {
        g.related_universities = uniMap[g.id] || [];
      }
    }

    // Parse JSON fields
    for (const g of grants) {
      try { g.requirements = JSON.parse(g.requirements || '[]'); } catch { g.requirements = []; }
      try { g.documents = JSON.parse(g.documents || '[]'); } catch { g.documents = []; }
      try { g.eligibility_categories = JSON.parse(g.eligibility_categories || '[]'); } catch { g.eligibility_categories = []; }
      try { g.study_levels = JSON.parse(g.study_levels || '[]'); } catch { g.study_levels = []; }
      try { g.programme_codes = JSON.parse(g.programme_codes || '[]'); } catch { g.programme_codes = []; }
      try { g.subject_requirements = JSON.parse(g.subject_requirements || '[]'); } catch { g.subject_requirements = []; }
    }

    return res.json({ success: true, grants, total, limit, offset });
  } catch (error) {
    console.error('Grants catalog error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки каталога грантов' });
  }
});

// ─── PUBLIC: Single grant detail ────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = Number.parseInt(req.params.id, 10);
    const grant = db.prepare(`SELECT g.*,
      u.short_name as uni_short_name, u.name as uni_name, u.website as uni_website,
      c.name as city_name
      FROM grants g
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      WHERE g.id = ?`).get(id);
    if (!grant) return res.status(404).json({ error: 'Грант не найден' });

    // Related universities
    const relatedUnis = db.prepare(`SELECT u.id, u.short_name, u.name, u.website
      FROM grant_universities gu JOIN universities u ON u.id = gu.university_id
      WHERE gu.grant_id = ?`).all(id);
    grant.related_universities = relatedUnis;

    // Related specialties
    const specs = db.prepare(`SELECT s.id, s.name, s.code
      FROM grant_specialties gs JOIN specialties s ON s.id = gs.specialty_id
      WHERE gs.grant_id = ?`).all(id);
    grant.specialties = specs;

    // Parse JSON fields
    try { grant.requirements = JSON.parse(grant.requirements || '[]'); } catch { grant.requirements = []; }
    try { grant.documents = JSON.parse(grant.documents || '[]'); } catch { grant.documents = []; }
    try { grant.eligibility_categories = JSON.parse(grant.eligibility_categories || '[]'); } catch { grant.eligibility_categories = []; }
    try { grant.study_levels = JSON.parse(grant.study_levels || '[]'); } catch { grant.study_levels = []; }
    try { grant.programme_codes = JSON.parse(grant.programme_codes || '[]'); } catch { grant.programme_codes = []; }
    try { grant.subject_requirements = JSON.parse(grant.subject_requirements || '[]'); } catch { grant.subject_requirements = []; }

    return res.json({ success: true, grant });
  } catch (error) {
    console.error('Grant detail error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки гранта' });
  }
});

// ─── AUTH: Personal matching ────────────────────────────
router.post('/match', verifyAuth, (req, res) => {
  try {
    const db = getDb();
    const { ent, subjects, group, city, budget, funding, language, needDorm, category } = req.body;

    // Get all verified + needs_review grants
    const allGrants = db.prepare(`SELECT g.*,
      u.short_name as uni_short_name, u.name as uni_name,
      c.name as city_name
      FROM grants g
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      WHERE g.is_active = 1 AND g.verification_status IN ('verified', 'needs_review')
      ORDER BY CASE g.verification_status WHEN 'verified' THEN 0 ELSE 1 END
      LIMIT 200`).all();

    const results = { matched: [], needsClarification: [], notSuitable: [] };

    for (const grant of allGrants) {
      const reasons = [];
      const warnings = [];
      let score = 0;
      let maxScore = 0;

      // Parse JSON
      try { grant.requirements = JSON.parse(grant.requirements || '[]'); } catch { grant.requirements = []; }
      try { grant.programme_codes = JSON.parse(grant.programme_codes || '[]'); } catch { grant.programme_codes = []; }
      try { grant.eligibility_categories = JSON.parse(grant.eligibility_categories || '[]'); } catch { grant.eligibility_categories = []; }

      // Check programme match
      if (group && grant.programme_codes.length > 0) {
        maxScore += 2;
        if (grant.programme_codes.includes(group)) {
          score += 2;
          reasons.push('Направление соответствует');
        } else {
          reasons.push('Направление не совпадает');
          results.notSuitable.push({ ...grant, reasons, score, maxScore, matchStatus: 'not_suitable' });
          continue;
        }
      }

      // Check city
      if (city && city !== 'any') {
        maxScore += 1;
        if (!grant.city_name || grant.city_name.toLowerCase().includes(city.toLowerCase())) {
          score += 1;
          reasons.push('Город совпадает');
        } else {
          reasons.push('Город не совпадает');
        }
      }

      // Check coverage vs budget
      if (budget && grant.coverage_type) {
        maxScore += 1;
        if (grant.coverage_type === 'full' || grant.coverage_type === 'tuition_only') {
          score += 1;
          reasons.push('Покрытие обучения подтверждено');
        } else if (grant.coverage_type === 'partial') {
          score += 0.5;
          warnings.push('Частичное покрытие — уточните размер');
        }
      }

      // Check deadline
      maxScore += 1;
      if (grant.deadline) {
        const dl = new Date(grant.deadline);
        if (dl >= new Date()) {
          score += 1;
          reasons.push(`Дедлайн: ${grant.deadline}`);
        } else {
          reasons.push('Дедлайн истёк');
          results.notSuitable.push({ ...grant, reasons, score, maxScore, matchStatus: 'not_suitable' });
          continue;
        }
      } else {
        warnings.push('Дедлайн не указан — требует уточнения');
      }

      // Check funding type preference
      if (funding === 'grant') {
        if (grant.type === 'government' || grant.type === 'university' || grant.type === 'corporate') {
          reasons.push('Тип финансирования подходит');
        }
      }

      // Check category
      if (category && category !== 'none' && grant.eligibility_categories.length > 0) {
        maxScore += 1;
        if (grant.eligibility_categories.includes(category)) {
          score += 1;
          reasons.push('Льготная категория подтверждена');
        } else {
          reasons.push('Льготная категория не подходит');
        }
      }

      // Verification status warnings
      if (grant.verification_status === 'needs_review') {
        warnings.push('Условия требуют проверки по официальному источнику');
      }

      // Unknown fields
      if (!grant.coverage_amount) warnings.push('Размер покрытия не указан');
      if (!grant.deadline) warnings.push('Дедлайн не указан');
      if (!grant.application_method) warnings.push('Способ подачи не указан');

      const coverageUnknown = !grant.coverage_type || grant.coverage_type === 'unknown';
      const deadlineUnknown = !grant.deadline;
      const requirementsPartial = grant.verification_status === 'needs_review';

      const item = { ...grant, reasons, warnings, score, maxScore };

      if (coverageUnknown || deadlineUnknown || requirementsPartial || warnings.length > 2) {
        item.matchStatus = 'needs_clarification';
        results.needsClarification.push(item);
      } else if (score >= maxScore * 0.5) {
        item.matchStatus = 'matched';
        results.matched.push(item);
      } else {
        item.matchStatus = 'not_suitable';
        results.notSuitable.push(item);
      }
    }

    // Sort matched by score
    results.matched.sort((a, b) => b.score - a.score);
    results.needsClarification.sort((a, b) => b.score - a.score);

    return res.json({
      success: true,
      results,
      disclaimer: 'Информация справочная. Условия, сроки и право на участие необходимо проверить на официальном источнике организатора.',
    });
  } catch (error) {
    console.error('Grant match error:', error);
    return res.status(500).json({ error: 'Ошибка подбора грантов' });
  }
});

// ─── AUTH: Save/unsave grant ────────────────────────────
router.post('/:id/save', verifyAuth, (req, res) => {
  try {
    const db = getDb();
    const id = Number.parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT 1 FROM saved_grants WHERE user_id = ? AND grant_id = ?').get(req.userId, id);
    if (existing) {
      db.prepare('DELETE FROM saved_grants WHERE user_id = ? AND grant_id = ?').run(req.userId, id);
      return res.json({ success: true, saved: false });
    }
    db.prepare('INSERT INTO saved_grants (user_id, grant_id) VALUES (?, ?)').run(req.userId, id);
    return res.json({ success: true, saved: true });
  } catch (error) {
    console.error('Save grant error:', error);
    return res.status(500).json({ error: 'Ошибка сохранения гранта' });
  }
});

router.get('/saved/list', verifyAuth, (req, res) => {
  try {
    const db = getDb();
    const grants = db.prepare(`SELECT g.*, u.short_name as uni_short_name, c.name as city_name
      FROM saved_grants sg
      JOIN grants g ON g.id = sg.grant_id
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      WHERE sg.user_id = ?
      ORDER BY sg.created_at DESC`).all(req.userId);
    for (const g of grants) {
      try { g.requirements = JSON.parse(g.requirements || '[]'); } catch { g.requirements = []; }
    }
    return res.json({ success: true, grants });
  } catch (error) {
    console.error('Saved grants error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки сохранённых грантов' });
  }
});

// ─── ADMIN: Grant management ────────────────────────────
const adminRouter = express.Router();
adminRouter.use(verifyAuth, verifyAdmin);

adminRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, university_id, type, q, limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(offsetRaw, 10) || 0, 0);
    const conditions = [];
    const params = [];

    if (status) { conditions.push('g.verification_status = ?'); params.push(status); }
    if (university_id) { conditions.push('g.university_id = ?'); params.push(Number(university_id)); }
    if (type) { conditions.push('g.type = ?'); params.push(type); }
    if (q && q.trim()) {
      conditions.push('(g.name LIKE ? OR g.description LIKE ?)');
      const term = `%${q.trim().slice(0, 100)}%`;
      params.push(term, term);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as c FROM grants g ${where}`).get(...params).c;
    const grants = db.prepare(`SELECT g.*, u.short_name as uni_short_name, c.name as city_name
      FROM grants g
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      ${where}
      ORDER BY CASE g.verification_status WHEN 'needs_review' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END, g.name
      LIMIT ? OFFSET ?`).all(...params, limit, offset);

    for (const g of grants) {
      try { g.requirements = JSON.parse(g.requirements || '[]'); } catch { g.requirements = []; }
      try { g.documents = JSON.parse(g.documents || '[]'); } catch { g.documents = []; }
    }

    return res.json({ success: true, grants, total, limit, offset });
  } catch (error) {
    console.error('Admin grants error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки грантов' });
  }
});

adminRouter.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = Number.parseInt(req.params.id, 10);
    const current = db.prepare('SELECT * FROM grants WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Грант не найден' });

    const allowed = [
      'name', 'type', 'amount', 'description', 'requirements', 'deadline', 'link',
      'source_url', 'source_title', 'verification_status', 'university_id', 'city_id',
      'academic_year', 'is_active', 'provider_name', 'provider_type',
      'coverage_type', 'coverage_amount', 'application_url', 'application_method',
      'documents', 'eligibility_categories', 'study_levels', 'programme_codes',
      'subject_requirements', 'review_notes', 'reviewed_until',
    ];
    const jsonFields = ['requirements', 'documents', 'eligibility_categories', 'study_levels', 'programme_codes', 'subject_requirements'];
    const fields = [];
    const values = [];
    const oldValues = {};
    const newValues = {};

    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      oldValues[field] = current[field];
      let val = req.body[field];
      if (jsonFields.includes(field) && Array.isArray(val)) {
        val = JSON.stringify(val);
      }
      if (field === 'verification_status') {
        if (!['needs_review', 'verified', 'expired', 'rejected', 'source_unavailable'].includes(val)) {
          return res.status(400).json({ error: 'Некорректный статус' });
        }
        // Verify before marking as verified
        if (val === 'verified') {
          const missing = [];
          if (!current.source_url) missing.push('source_url');
          if (!current.deadline && !req.body.deadline) missing.push('deadline');
          if (!current.coverage_type && !req.body.coverage_type) missing.push('coverage_type');
          if (!current.requirements || current.requirements === '[]') missing.push('requirements');
          if (missing.length) {
            return res.status(400).json({
              error: 'Нельзя подтвердить без: ' + missing.join(', '),
              missing,
            });
          }
          values.push(new Date().toISOString());
          fields.push('verified_at = ?');
          values.push(req.userId);
          fields.push('last_checked_by = ?');
        }
      }
      if (field === 'is_active') {
        val = val ? 1 : 0;
      }
      if (field === 'university_id' || field === 'city_id') {
        val = val ? Number(val) : null;
      }
      fields.push(`${field} = ?`);
      values.push(val);
      newValues[field] = req.body[field];
    }

    if (!fields.length) return res.status(400).json({ error: 'Нет данных для обновления' });

    db.transaction(() => {
      db.prepare(`UPDATE grants SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('grants', ?, 'UPDATE', ?, ?, ?, ?)`)
        .run(id, JSON.stringify(oldValues), JSON.stringify(newValues), req.userId, req.ip);
    })();

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin grant update error:', error);
    return res.status(500).json({ error: 'Ошибка обновления гранта' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
