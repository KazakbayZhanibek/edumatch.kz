/**
 * verify-routes.js — Верификация военной службы и загрузка ЕНТ
 */

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('./auth-middleware');
const Database = require('better-sqlite3');
const path = require('path');

function getDb() {
  return new Database(path.join(__dirname, 'edumatch.db'));
}

// ==================== МИЛИТАРИ ВЕРИФИКАЦИЯ ====================

/**
 * POST /api/verify/military
 * Отправить заявку на верификацию военной службы
 * Body: { documentUrl: string (base64), serviceType: 'draft'|'contract'|'alternative' }
 */
router.post('/military', verifyAuth, (req, res) => {
  const { documentUrl, serviceType } = req.body;
  if (!documentUrl) {
    return res.status(400).json({ error: 'Загрузите документ' });
  }
  const allowedTypes = ['draft', 'contract', 'alternative'];
  const st = allowedTypes.includes(serviceType) ? serviceType : 'draft';

  const db = getDb();
  try {
    const existing = db.prepare(
      'SELECT id, status FROM military_verifications WHERE user_id = ? AND status = ?'
    ).get(req.userId, 'pending');
    if (existing) {
      return res.status(400).json({ error: 'У вас уже есть заявка на рассмотрении' });
    }

    const result = db.prepare(
      'INSERT INTO military_verifications (user_id, document_url, service_type) VALUES (?, ?, ?)'
    ).run(req.userId, documentUrl, st);

    return res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error('Military verify error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/verify/military/status
 * Получить статус верификации текущего пользователя
 */
router.get('/military/status', verifyAuth, (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare(
      'SELECT id, status, service_type, review_note, reviewed_at FROM military_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.userId);

    const user = db.prepare('SELECT military_service FROM users WHERE id = ?').get(req.userId);

    return res.json({
      verified: user?.military_service === 1,
      request: row || null
    });
  } catch (e) {
    console.error('Military status error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/verify/military/pending
 * ADMIN: получить все заявки на рассмотрении
 */
router.get('/military/pending', verifyAuth, (req, res) => {
  const db = getDb();
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const rows = db.prepare(
      `SELECT mv.*, u.username, u.full_name, u.email
       FROM military_verifications mv
       JOIN users u ON mv.user_id = u.id
       WHERE mv.status = 'pending'
       ORDER BY mv.created_at ASC`
    ).all();

    return res.json({ requests: rows });
  } catch (e) {
    console.error('Military pending error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * POST /api/verify/military/:id/review
 * ADMIN: одобрить или отклонить заявку
 * Body: { action: 'approve'|'reject', note?: string }
 */
router.post('/military/:id/review', verifyAuth, (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body;

  const db = getDb();
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const request = db.prepare('SELECT * FROM military_verifications WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(
      'UPDATE military_verifications SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newStatus, req.userId, note || null, id);

    if (action === 'approve') {
      db.prepare('UPDATE users SET military_service = 1 WHERE id = ?').run(request.user_id);
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('Military review error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

// ==================== ЕНТ ЗАГРУЗКА ====================

/**
 * POST /api/verify/ent
 * Загрузить результат ЕНТ (фото/файл)
 * Body: { documentUrl: string (base64), entScore?: number }
 */
router.post('/ent', verifyAuth, (req, res) => {
  const { documentUrl, entScore } = req.body;
  if (!documentUrl) {
    return res.status(400).json({ error: 'Загрузите документ' });
  }

  const db = getDb();
  try {
    const existing = db.prepare(
      "SELECT id, status FROM ent_uploads WHERE user_id = ? AND status = 'pending'"
    ).get(req.userId);
    if (existing) {
      return res.status(400).json({ error: 'У вас уже есть заявка на рассмотрении' });
    }

    const score = (entScore !== undefined && entScore !== null && entScore >= 0 && entScore <= 140)
      ? parseInt(entScore) : null;

    const result = db.prepare(
      'INSERT INTO ent_uploads (user_id, document_url, ent_score) VALUES (?, ?, ?)'
    ).run(req.userId, documentUrl, score);

    return res.json({ success: true, id: result.lastInsertRowid, entScore: score });
  } catch (e) {
    console.error('ENT upload error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/verify/ent/status
 * Получить статус загрузки ЕНТ текущего пользователя
 */
router.get('/ent/status', verifyAuth, (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare(
      'SELECT id, status, ent_score, review_note, reviewed_at FROM ent_uploads WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.userId);

    const user = db.prepare('SELECT ent_score FROM users WHERE id = ?').get(req.userId);

    return res.json({
      entScore: user?.ent_score || null,
      request: row || null
    });
  } catch (e) {
    console.error('ENT status error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/verify/ent/pending
 * ADMIN: заявки ЕНТ на рассмотрении
 */
router.get('/ent/pending', verifyAuth, (req, res) => {
  const db = getDb();
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const rows = db.prepare(
      `SELECT eu.*, u.username, u.full_name, u.email
       FROM ent_uploads eu
       JOIN users u ON eu.user_id = u.id
       WHERE eu.status = 'pending'
       ORDER BY eu.created_at ASC`
    ).all();

    return res.json({ requests: rows });
  } catch (e) {
    console.error('ENT pending error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

/**
 * POST /api/verify/ent/:id/review
 * ADMIN: одобрить или отклонить заявку ЕНТ
 * Body: { action: 'approve'|'reject', note?: string, entScore?: number }
 */
router.post('/ent/:id/review', verifyAuth, (req, res) => {
  const { id } = req.params;
  const { action, note, entScore } = req.body;

  const db = getDb();
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const request = db.prepare('SELECT * FROM ent_uploads WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(
      'UPDATE ent_uploads SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newStatus, req.userId, note || null, id);

    if (action === 'approve') {
      const score = entScore || request.ent_score;
      if (score) {
        db.prepare('UPDATE users SET ent_score = ? WHERE id = ?').run(score, request.user_id);
      }
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('ENT review error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    db.close();
  }
});

module.exports = router;
