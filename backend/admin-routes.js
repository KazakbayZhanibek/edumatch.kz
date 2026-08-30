const express = require('express');
const router = express.Router();
const { getDb } = require('./database');
const { verifyAuth, verifyAdmin } = require('./auth-middleware');

router.use(verifyAuth, verifyAdmin);

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
      pendingReviews: db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE moderated_at IS NULL").get().count,
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
    db.prepare(`UPDATE universities SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
    db.prepare(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address) VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`)
      .run('universities', id, JSON.stringify(Object.fromEntries(allowed.map(field => [field, current[field]]))), JSON.stringify(req.body), req.userId, req.ip);
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
             r.study_year, r.created_at, r.moderated_at
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
    const moderated = req.body.approved === false ? 0 : 1;
    const result = getDb().prepare(
      'UPDATE reviews SET moderated_at = ?, moderated_by = ? WHERE id = ?'
    ).run(moderated ? new Date().toISOString() : null, moderated ? req.userId : null, id);
    return result.changes ? res.json({ success: true, approved: Boolean(moderated) }) : res.status(404).json({ error: 'Отзыв не найден' });
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

module.exports = router;
