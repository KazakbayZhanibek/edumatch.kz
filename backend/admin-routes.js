const express = require('express');
const router = express.Router();
const { getDb } = require('./database');
const { verifyAuth, verifyAdmin } = require('./auth-middleware');

// Rate limiting for admin: 60 requests per minute per user
const adminRateMap = new Map();
const ADMIN_RATE_WINDOW = 60000;
const ADMIN_RATE_MAX = 60;

function adminRateLimit(req, res, next) {
  const userId = req.userId;
  const now = Date.now();
  const record = adminRateMap.get(userId);
  if (!record || now - record.start > ADMIN_RATE_WINDOW) {
    adminRateMap.set(userId, { start: now, count: 1 });
    return next();
  }
  record.count++;
  if (record.count > ADMIN_RATE_MAX) {
    console.warn(`Admin rate limit exceeded: userId=${userId} ip=${req.ip}`);
    return res.status(429).json({ error: 'Слишком много запросов. Подождите минуту.' });
  }
  next();
}

router.use(verifyAuth, verifyAdmin, adminRateLimit);

router.get('/overview', (req, res) => {
  try {
    const db = getDb();
    const requestedDays = Number.parseInt(req.query.days, 10) || 30;
    const days = Math.min(Math.max(requestedDays, 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const overview = {
      users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      universities: db.prepare('SELECT COUNT(*) AS count FROM universities').get().count,
      applications: db.prepare('SELECT COUNT(*) AS count FROM application_tracker').get().count,
      reviews: db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count,
      chatMessages: db.prepare('SELECT COUNT(*) AS count FROM chat_history').get().count,
      pendingReviews: db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE moderation_status = 'pending'").get().count,
      period: days,
      periodChats: db.prepare('SELECT COUNT(*) AS count FROM chat_history WHERE created_at >= ?').get(since).count,
      periodUsers: db.prepare('SELECT COUNT(*) AS count FROM users WHERE created_at >= ?').get(since).count,
      periodApplications: db.prepare('SELECT COUNT(*) AS count FROM application_tracker WHERE created_at >= ?').get(since).count,
    };
    const applicationStatuses = db.prepare(`
      SELECT status, COUNT(*) AS count FROM application_tracker GROUP BY status ORDER BY count DESC
    `).all();
    const dailyChats = db.prepare(`
      SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
      FROM chat_history WHERE created_at >= ? GROUP BY day ORDER BY day
    `).all(since);
    const intents = db.prepare(`
      SELECT COALESCE(json_extract(context, '$.intent'), 'unknown') AS intent, COUNT(*) AS count
      FROM chat_history WHERE created_at >= ? GROUP BY intent ORDER BY count DESC LIMIT 8
    `).all(since);
    const popularUniversities = db.prepare(`
      SELECT u.id, u.short_name, u.name, COUNT(a.id) AS applications
      FROM application_tracker a JOIN universities u ON u.id = a.university_id
      GROUP BY a.university_id ORDER BY applications DESC LIMIT 8
    `).all();
    return res.json({ success: true, overview, applicationStatuses, dailyChats, intents, popularUniversities });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

router.get('/applications', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const applications = getDb().prepare(`
      SELECT a.id, a.status, a.academic_year, a.deadline, a.submitted_at, a.created_at,
             u.short_name, u.name AS university_name, usr.email, usr.username
      FROM application_tracker a
      JOIN universities u ON u.id = a.university_id
      JOIN users usr ON usr.id = a.user_id
      ORDER BY a.updated_at DESC LIMIT ?
    `).all(limit);
    return res.json({ success: true, applications });
  } catch (error) {
    console.error('Admin applications error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки заявок' });
  }
});

router.get('/users', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const users = getDb().prepare(`
      SELECT u.id, u.email, u.username, u.full_name, u.is_admin, u.created_at,
             (SELECT COUNT(*) FROM application_tracker a WHERE a.user_id = u.id) AS applications,
             (SELECT COUNT(*) FROM chat_history c WHERE c.user_id = u.id) AS chats
      FROM users u ORDER BY u.created_at DESC LIMIT ?
    `).all(limit);
    return res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

router.get('/universities', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 300);
    const query = String(req.query.q || '').trim().slice(0, 100);
    const status = ['active', 'pending', 'inactive'].includes(req.query.status) ? req.query.status : null;
    const rows = getDb().prepare(`
      SELECT u.id, u.name, u.short_name, u.data_status, u.website, u.address,
             u.price_from, u.price_to, u.last_updated_at, c.name AS city
      FROM universities u LEFT JOIN cities c ON c.id = u.city_id
      WHERE (? IS NULL OR u.data_status = ?)
        AND (? = '' OR u.name LIKE ? OR u.short_name LIKE ?)
      ORDER BY CASE u.data_status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.name
      LIMIT ?
    `).all(status, status, query, `%${query}%`, `%${query}%`, limit);
    return res.json({ success: true, universities: rows });
  } catch (error) {
    console.error('Admin universities error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки вузов' });
  }
});

router.get('/grants', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    const query = String(req.query.q || '').trim().slice(0, 100);
    const status = ['needs_review', 'verified', 'expired'].includes(req.query.status) ? req.query.status : null;
    const grants = getDb().prepare(`
      SELECT g.id, g.name, g.type, g.amount, g.deadline, g.academic_year,
             g.source_url, g.source_title, g.verification_status, g.verified_at,
             g.requirements, u.short_name AS university_name, c.name AS city_name
      FROM grants g
      LEFT JOIN universities u ON u.id = g.university_id
      LEFT JOIN cities c ON c.id = g.city_id
      WHERE (? IS NULL OR g.verification_status = ?)
        AND (? = '' OR g.name LIKE ? OR COALESCE(u.name, '') LIKE ? OR COALESCE(c.name, '') LIKE ?)
      ORDER BY CASE g.verification_status WHEN 'needs_review' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END, g.id
      LIMIT ?
    `).all(status, status, query, `%${query}%`, `%${query}%`, `%${query}%`, limit)
      .map(grant => {
        let requirements = [];
        try { requirements = JSON.parse(grant.requirements || '[]'); } catch { requirements = []; }
        return { ...grant, requirements: Array.isArray(requirements) ? requirements : [] };
      });
    return res.json({ success: true, grants });
  } catch (error) {
    console.error('Admin grants error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки грантов' });
  }
});

router.patch('/grants/:id/verify', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const db = getDb();
    const current = db.prepare('SELECT * FROM grants WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Грант не найден' });
    const status = String(req.body.verification_status || '').trim();
    if (!['needs_review', 'verified', 'expired'].includes(status)) return res.status(400).json({ error: 'Некорректный статус проверки' });
    const sourceUrl = String(req.body.source_url || '').trim();
    let parsedUrl;
    try { parsedUrl = new URL(sourceUrl); } catch { parsedUrl = null; }
    if (status === 'verified' && (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password)) {
      return res.status(400).json({ error: 'Для подтверждения нужен официальный URL без учётных данных' });
    }
    const verifiedAt = String(req.body.verified_at || '').trim();
    if (status === 'verified' && !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) return res.status(400).json({ error: 'Укажите дату проверки в формате YYYY-MM-DD' });
    const deadline = String(req.body.deadline || '').trim();
    if (status === 'verified' && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return res.status(400).json({ error: 'Для подтверждения нужен дедлайн YYYY-MM-DD' });
    const amount = String(req.body.amount || '').trim().slice(0, 500);
    if (status === 'verified' && !amount) return res.status(400).json({ error: 'Для подтверждения укажите покрытие или размер поддержки' });
    const requirements = Array.isArray(req.body.requirements) ? req.body.requirements.map(value => String(value).trim().slice(0, 500)).filter(Boolean).slice(0, 30) : [];
    if (status === 'verified' && !requirements.length) return res.status(400).json({ error: 'Для подтверждения укажите требования' });
    const next = {
      source_url: sourceUrl || current.source_url || null,
      source_title: String(req.body.source_title || current.source_title || '').trim().slice(0, 500) || null,
      verification_status: status,
      verified_at: status === 'verified' ? verifiedAt : null,
      deadline: deadline || null,
      amount: amount || current.amount,
      requirements: requirements.length ? JSON.stringify(requirements) : current.requirements,
    };
    db.transaction(() => {
      db.prepare(`UPDATE grants SET source_url = ?, source_title = ?, verification_status = ?, verified_at = ?, deadline = ?, amount = ?, requirements = ? WHERE id = ?`)
        .run(next.source_url, next.source_title, next.verification_status, next.verified_at, next.deadline, next.amount, next.requirements, id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`)
        .run('grants', id, JSON.stringify({ verification_status: current.verification_status, verified_at: current.verified_at, deadline: current.deadline }), JSON.stringify(next), req.userId, req.ip);
    })();
    return res.json({ success: true, grant: { id, ...next, requirements } });
  } catch (error) {
    console.error('Admin grant verification error:', error);
    return res.status(500).json({ error: 'Ошибка обновления проверки гранта' });
  }
});

router.patch('/universities/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const allowed = ['name', 'short_name', 'website', 'address', 'admission_phone', 'admission_email', 'data_status', 'price_from', 'price_to'];
  const fields = [];
  const values = [];
  const db = getDb();
  try {
    const current = db.prepare('SELECT * FROM universities WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Вуз не найден' });
    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      if (field === 'data_status' && !['active', 'pending', 'inactive'].includes(req.body[field])) return res.status(400).json({ error: 'Некорректный статус' });
      if (['price_from', 'price_to'].includes(field)) {
        const number = Number(req.body[field]);
        if (!Number.isFinite(number) || number < 0) return res.status(400).json({ error: 'Некорректная цена' });
        fields.push(`${field} = ?`); values.push(Math.round(number));
      } else {
        fields.push(`${field} = ?`); values.push(String(req.body[field]).trim().slice(0, 2000));
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Нет данных для обновления' });
    fields.push('last_updated_at = CURRENT_TIMESTAMP');
    const nextPriceFrom = req.body.price_from === undefined ? current.price_from : Number(req.body.price_from);
    const nextPriceTo = req.body.price_to === undefined ? current.price_to : Number(req.body.price_to);
    if (nextPriceFrom > nextPriceTo) return res.status(400).json({ error: 'Минимальная цена не может превышать максимальную' });
    db.transaction(() => {
      db.prepare(`UPDATE universities SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`)
        .run('universities', id, JSON.stringify(Object.fromEntries(allowed.map(field => [field, current[field]]))), JSON.stringify(req.body), req.userId, req.ip);
    })();
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin university update error:', error);
    return res.status(500).json({ error: 'Ошибка обновления вуза' });
  }
});

router.get('/audit', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const audit = getDb().prepare(`
      SELECT a.id, a.table_name, a.record_id, a.action, a.created_at, u.email
      FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(limit);
    return res.json({ success: true, audit });
  } catch (error) {
    console.error('Admin audit error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки аудита' });
  }
});

router.get('/reviews', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
    const reviews = getDb().prepare(`
      SELECT r.id, r.university_id, u.short_name, u.name AS university_name,
             r.user_name, r.rating, r.pros, r.cons, r.comment, r.faculty,
             r.study_year, r.created_at, r.moderated_at, r.moderation_status
      FROM reviews r
      JOIN universities u ON u.id = r.university_id
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(limit);
    return res.json({ success: true, reviews });
  } catch (error) {
    console.error('Admin reviews error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки отзывов' });
  }
});

router.patch('/reviews/:id/moderate', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (typeof req.body.approved !== 'boolean') return res.status(400).json({ error: 'Укажите решение о публикации отзыва' });
    const status = req.body.approved ? 'approved' : 'hidden';
    const db = getDb();
    const current = db.prepare('SELECT moderation_status FROM reviews WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Отзыв не найден' });
    db.transaction(() => {
      db.prepare('UPDATE reviews SET moderated_at = ?, moderated_by = ?, moderation_status = ? WHERE id = ?')
        .run(new Date().toISOString(), req.userId, status, id);
      db.prepare("INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('reviews', ?, 'UPDATE', ?, ?, ?, ?)")
        .run(id, JSON.stringify(current), JSON.stringify({ moderation_status: status }), req.userId, req.ip);
    })();
    return res.json({ success: true, approved: req.body.approved, moderation_status: status });
  } catch (error) {
    console.error('Moderate review error:', error);
    return res.status(500).json({ error: 'Ошибка модерации отзыва' });
  }
});

router.delete('/reviews/:id', (req, res) => {
  try {
    const result = getDb().prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    return result.changes ? res.json({ success: true }) : res.status(404).json({ error: 'Отзыв не найден' });
  } catch (error) {
    console.error('Admin delete review error:', error);
    return res.status(500).json({ error: 'Ошибка удаления отзыва' });
  }
});

// ─── USER MANAGEMENT ──────────────────────────────

router.get('/users/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const user = getDb().prepare(`
      SELECT u.id, u.email, u.username, u.full_name, u.phone, u.bio, u.ent_score,
             u.is_admin, u.is_banned, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM application_tracker a WHERE a.user_id = u.id) AS applications,
             (SELECT COUNT(*) FROM chat_history c WHERE c.user_id = u.id) AS chats,
             (SELECT COUNT(*) FROM saved_universities s WHERE s.user_id = u.id) AS saved
      FROM users u WHERE u.id = ?
    `).get(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Admin get user error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки пользователя' });
  }
});

router.patch('/users/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const db = getDb();
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Пользователь не найден' });
    if (current.email === 'janibekkaz3@gmail.com') return res.status(400).json({ error: 'Нельзя изменить главного администратора' });

    const allowed = ['full_name', 'username', 'phone', 'bio', 'ent_score', 'is_admin', 'is_banned'];
    const fields = [];
    const values = [];
    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      if (field === 'is_admin' || field === 'is_banned') {
        fields.push(`${field} = ?`); values.push(req.body[field] ? 1 : 0);
      } else {
        fields.push(`${field} = ?`); values.push(String(req.body[field]).trim().slice(0, 500));
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Нет данных для обновления' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    db.transaction(() => {
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`)
        .run('users', id, JSON.stringify({ email: current.email, is_admin: current.is_admin, is_banned: current.is_banned }), JSON.stringify(req.body), req.userId, req.ip);
    })();
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный ID пользователя' });
    }
    if (id === req.userId) return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
    const db = getDb();
    const user = db.prepare('SELECT email, is_admin FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.email === 'janibekkaz3@gmail.com') return res.status(400).json({ error: 'Нельзя удалить главного администратора' });
    db.transaction(() => {
      db.prepare('DELETE FROM chat_history WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM application_tracker WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM saved_universities WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('users', ?, 'DELETE', ?, ?, ?, ?)`)
        .run(id, JSON.stringify({ email: user.email }), '{}', req.userId, req.ip);
    })();
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

router.post('/users/:id/reset-password', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const db = getDb();
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let newPass = '';
    const bytes = crypto.randomBytes(32);
    for (let i = 0; i < 16; i++) newPass += chars[bytes[i] % chars.length];
    const hash = bcrypt.hashSync(newPass, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);
    db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('users', ?, 'UPDATE', ?, ?, ?, ?)`)
      .run(id, '{}', JSON.stringify({ action: 'password_reset' }), req.userId, req.ip);
    return res.json({ success: true, newPassword: newPass });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
});

// ─── SOURCE MANAGEMENT ──────────────────────────────

router.get('/sources', (req, res) => {
  try {
    const { sources } = require('./planner-catalogue');
    const { createSourceStore } = require('./planner-source-store');
    const store = createSourceStore(() => getDb());
    const states = store.all();
    const result = Object.values(sources).map(src => {
      const state = states[src.id] || {};
      return {
        id: src.id,
        url: src.url,
        title: src.title,
        dataType: src.dataType,
        reviewedAt: src.reviewedAt,
        notes: src.notes,
        checkedMs: state.checked_ms || null,
        status: state.status || 'unchecked',
        reviewRequired: state.reviewRequired || false,
        changeStatus: state.changeStatus || 'unchanged',
        contentHash: state.contentHash || null,
        missingMarkers: state.missingMarkers || [],
      };
    });
    return res.json({ success: true, sources: result });
  } catch (error) {
    console.error('Admin sources error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки источников' });
  }
});

router.get('/sources/:id/history', (req, res) => {
  try {
    const { createSourceStore } = require('./planner-source-store');
    const store = createSourceStore(() => getDb());
    const history = store.history(req.params.id);
    return res.json({ success: true, history });
  } catch (error) {
    console.error('Admin source history error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки истории источника' });
  }
});

router.post('/sources/:id/check', async (req, res) => {
  try {
    const { checkSource } = require('./planner-tools');
    const result = await checkSource(req.params.id, { now: Date.now() });
    return res.json({ success: true, result });
  } catch (error) {
    console.error('Admin source check error:', error);
    return res.status(500).json({ error: 'Ошибка проверки источника' });
  }
});

// ─── UNIVERSITY MANAGEMENT ──────────────────────────────

router.get('/universities/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const uni = getDb().prepare(`
      SELECT u.*, c.name AS city_name
      FROM universities u LEFT JOIN cities c ON c.id = u.city_id
      WHERE u.id = ?
    `).get(id);
    if (!uni) return res.status(404).json({ error: 'Вуз не найден' });
    const specialties = getDb().prepare('SELECT id, name, code, direction FROM specialties WHERE university_id = ? ORDER BY name').all(id);
    const reviews = getDb().prepare("SELECT id, user_name, rating, comment, moderation_status FROM reviews WHERE university_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
    return res.json({ success: true, university: uni, specialties, reviews });
  } catch (error) {
    console.error('Admin get university error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки вуза' });
  }
});

router.put('/universities/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const db = getDb();
    const current = db.prepare('SELECT * FROM universities WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Вуз не найден' });

    const allowed = ['name', 'short_name', 'website', 'address', 'admission_phone', 'admission_email',
      'data_status', 'price_from', 'price_to', 'founded_year', 'total_students', 'dormitory',
      'description', 'latitude', 'longitude'];
    const fields = [];
    const values = [];
    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      if (field === 'data_status' && !['active', 'pending', 'inactive'].includes(req.body[field])) return res.status(400).json({ error: 'Некорректный статус' });
      if (['price_from', 'price_to', 'founded_year', 'total_students'].includes(field)) {
        const num = Number(req.body[field]);
        if (!Number.isFinite(num) || num < 0) return res.status(400).json({ error: `Некорректное значение ${field}` });
        fields.push(`${field} = ?`); values.push(Math.round(num));
      } else if (field === 'dormitory') {
        fields.push(`${field} = ?`); values.push(req.body[field] ? 1 : 0);
      } else if (['latitude', 'longitude'].includes(field)) {
        const num = Number(req.body[field]);
        if (!Number.isFinite(num)) return res.status(400).json({ error: `Некорректное значение ${field}` });
        fields.push(`${field} = ?`); values.push(num);
      } else {
        fields.push(`${field} = ?`); values.push(String(req.body[field]).trim().slice(0, 2000));
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Нет данных для обновления' });
    fields.push('last_updated_at = CURRENT_TIMESTAMP');
    db.transaction(() => {
      db.prepare(`UPDATE universities SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`)
        .run('universities', id, JSON.stringify({ name: current.name }), JSON.stringify(req.body), req.userId, req.ip);
    })();
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin update university error:', error);
    return res.status(500).json({ error: 'Ошибка обновления вуза' });
  }
});

router.post('/universities', (req, res) => {
  try {
    const db = getDb();
    const { name, short_name, website, address, city_id, admission_phone, admission_email, price_from, price_to, data_status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название вуза обязательно' });
    const result = db.prepare(`
      INSERT INTO universities (name, short_name, website, address, city_id, admission_phone, admission_email, price_from, price_to, data_status, created_at, last_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      String(name).trim().slice(0, 500),
      String(short_name || '').trim().slice(0, 100) || null,
      String(website || '').trim().slice(0, 500) || null,
      String(address || '').trim().slice(0, 500) || null,
      Number(city_id) || null,
      String(admission_phone || '').trim().slice(0, 50) || null,
      String(admission_email || '').trim().slice(0, 100) || null,
      Math.round(Number(price_from) || 0),
      Math.round(Number(price_to) || 0),
      ['active', 'pending', 'inactive'].includes(data_status) ? data_status : 'pending'
    );
    db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('universities', ?, 'CREATE', '{}', ?, ?, ?)`)
      .run(result.lastInsertRowid, JSON.stringify(req.body), req.userId, req.ip);
    return res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create university error:', error);
    return res.status(500).json({ error: 'Ошибка создания вуза' });
  }
});

router.delete('/universities/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const db = getDb();
    const uni = db.prepare('SELECT id, name FROM universities WHERE id = ?').get(id);
    if (!uni) return res.status(404).json({ error: 'Вуз не найден' });
    db.transaction(() => {
      db.prepare('DELETE FROM specialties WHERE university_id = ?').run(id);
      db.prepare('DELETE FROM reviews WHERE university_id = ?').run(id);
      db.prepare('DELETE FROM saved_universities WHERE university_id = ?').run(id);
      db.prepare('DELETE FROM application_tracker WHERE university_id = ?').run(id);
      db.prepare('DELETE FROM universities WHERE id = ?').run(id);
      db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES ('universities', ?, 'DELETE', ?, '{}', ?, ?)`)
        .run(id, JSON.stringify({ name: uni.name }), req.userId, req.ip);
    })();
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete university error:', error);
    return res.status(500).json({ error: 'Ошибка удаления вуза' });
  }
});

module.exports = router;
