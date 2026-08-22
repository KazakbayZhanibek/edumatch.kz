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
