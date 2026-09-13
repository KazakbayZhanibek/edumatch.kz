const router = require('express').Router();
const { verifyAuth, verifyAdmin } = require('./auth-middleware');
const { getDb } = require('./database');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DOC_RETENTION_DAYS = 90; // Автоудаление через 90 дней

// Ensure upload dirs exist
['ent', 'military'].forEach(d => {
  const dir = path.join(UPLOAD_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function decodeDocument(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_FILE / 3) * 4 + 80) return null;
  const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_FILE || bytes.toString('base64') !== match[2]) return null;
  const mime = match[1];
  const valid = mime === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return valid ? { bytes, mime } : null;
}

function saveFile(bytes, type, mime) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[mime] || 'bin';
  const filename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, type, filename);
  fs.writeFileSync(filepath, bytes);
  return { filepath, filename, size: bytes.length };
}

function deleteFile(filepath) {
  try {
    if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch (e) { console.warn('Failed to delete file:', filepath, e.message); }
}

function createNotification(db, userId, type, title, message, link) {
  db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message, link || null);
}

const validScore = value => Number.isInteger(value) && value >= 0 && value <= 140;

function audit(db, table, id, action, userId, values) {
  db.prepare('INSERT INTO audit_log (table_name, record_id, action, user_id, new_values) VALUES (?, ?, ?, ?, ?)')
    .run(table, id, action, userId, JSON.stringify(values));
}

router.use(verifyAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

for (const [type, table] of [['ent', 'ent_uploads'], ['military', 'military_verifications']]) {
  const column = type === 'ent' ? 'ent_score' : 'service_type';

  // Upload document
  router.post('/' + type, (req, res, next) => {
    try {
      const { documentUrl, entScore, serviceType } = req.body || {};
      const doc = decodeDocument(documentUrl);
      if (!doc) return res.status(400).json({ error: 'Загрузите JPG, PNG, WEBP или PDF до 5 МБ. Для подтверждения нужен документ.' });
      if (type === 'ent' && entScore != null && !validScore(entScore)) return res.status(400).json({ error: 'Балл ЕНТ должен быть целым числом от 0 до 140' });
      if (type === 'military' && !['draft', 'contract', 'alternative'].includes(serviceType)) return res.status(400).json({ error: 'Выберите тип службы' });

      const db = getDb();
      const id = db.transaction(() => {
        if (db.prepare("SELECT id FROM " + table + " WHERE user_id = ? AND status = 'pending'").get(req.userId)) return null;

        // Save file to disk
        const { filepath, filename, size } = saveFile(doc.bytes, type, doc.mime);
        const autoDeleteAt = new Date(Date.now() + DOC_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const result = db.prepare('INSERT INTO ' + table + ' (user_id, document_url, file_path, file_size, auto_delete_at, ' + column + ') VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.userId, `file://${filename}`, filepath, size, autoDeleteAt, type === 'ent' ? entScore ?? null : serviceType);
        audit(db, table, result.lastInsertRowid, 'INSERT', req.userId, { status: 'pending' });
        return result.lastInsertRowid;
      })();

      return id === null ? res.status(409).json({ error: 'Заявка уже на проверке. Дождитесь решения или отмените её.' })
        : res.status(201).json({ success: true, id, status: 'pending' });
    } catch (error) { next(error); }
  });

  // Get status and history
  router.get('/' + type + '/status', (req, res, next) => {
    try {
      const db = getDb();
      const history = db.prepare('SELECT id, user_id, status, review_note, reviewed_at, created_at, ' + column + ' FROM ' + table + ' WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(req.userId);
      const user = db.prepare('SELECT ent_score, ent_verified_score, ent_verified_at, military_service FROM users WHERE id = ?').get(req.userId);
      const verified = type === 'ent' ? user?.ent_verified_at != null && user.ent_score === user.ent_verified_score : user?.military_service === 1;
      res.json({ verified, entScore: user?.ent_score ?? null, verifiedAt: type === 'ent' ? user?.ent_verified_at : null, request: history[0] || null, history });
    } catch (error) { next(error); }
  });

  // Admin: list pending requests
  router.get('/' + type + '/pending', verifyAdmin, (req, res, next) => {
    try {
      const status = req.query.status || 'pending';
      if (!['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status)) return res.status(400).json({ error: 'Некорректный статус' });
      const requests = getDb().prepare("SELECT r.id, r.user_id, r.status, r.review_note, r.created_at, r.reviewed_at, r." + column +
        ", r.file_path, r.auto_delete_at, u.username, u.full_name FROM " + table +
        " r JOIN users u ON u.id = r.user_id WHERE (? = 'all' OR r.status = ?) ORDER BY r.id DESC LIMIT 100").all(status, status);
      res.json({ requests });
    } catch (error) { next(error); }
  });

  // Download document
  router.get('/' + type + '/:id/document', (req, res, next) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT user_id, document_url, file_path FROM ' + table + ' WHERE id = ?').get(req.params.id);
      const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId)?.is_admin;
      if (!row || (row.user_id !== req.userId && !admin)) return res.status(404).json({ error: 'Документ не найден' });

      // Try file storage first, fallback to base64
      if (row.file_path && fs.existsSync(row.file_path)) {
        const ext = path.extname(row.file_path).slice(1);
        const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
        res.set('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.set('Content-Disposition', 'attachment; filename="' + type + '-' + Number(req.params.id) + '.' + ext + '"');
        return fs.createReadStream(row.file_path).pipe(res);
      }

      // Fallback to base64 (legacy)
      const doc = decodeDocument(row.document_url);
      if (!doc) return res.status(404).json({ error: 'Документ отсутствует' });
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[doc.mime];
      res.set('Content-Type', doc.mime);
      res.set('Content-Disposition', 'attachment; filename="' + type + '-' + Number(req.params.id) + '.' + ext + '"');
      res.send(doc.bytes);
    } catch (error) { next(error); }
  });

  // Cancel request
  router.post('/' + type + '/:id/cancel', (req, res, next) => {
    try {
      const db = getDb();
      const changed = db.transaction(() => {
        const result = db.prepare("UPDATE " + table + " SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'").run(req.params.id, req.userId);
        if (result.changes) audit(db, table, Number(req.params.id), 'UPDATE', req.userId, { status: 'cancelled' });
        return result.changes;
      })();
      res.status(changed ? 200 : 409).json(changed ? { success: true } : { error: 'Заявка уже рассмотрена или недоступна' });
    } catch (error) { next(error); }
  });

  // Admin: review request
  router.post('/' + type + '/:id/review', verifyAdmin, (req, res, next) => {
    try {
      const { action, note = '', entScore } = req.body || {};
      if (!['approve', 'reject'].includes(action) || typeof note !== 'string' || note.length > 1000) return res.status(400).json({ error: 'Некорректное решение или комментарий' });
      if (action === 'reject' && !note.trim()) return res.status(400).json({ error: 'Укажите причину отказа' });

      const db = getDb();
      const result = db.transaction(() => {
        const row = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
        if (!row) return { status: 404, error: 'Заявка не найдена' };
        if (row.status !== 'pending') return { status: 409, error: 'Заявка уже рассмотрена или отменена' };

        const score = entScore ?? row.ent_score;
        if (action === 'approve') {
          if (type === 'ent' && !validScore(score)) return { status: 400, error: 'Укажите подтверждённый балл от 0 до 140' };
        }

        const status = action === 'approve' ? 'approved' : 'rejected';
        db.prepare('UPDATE ' + table + ' SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(status, req.userId, note.trim() || null, row.id);

        if (action === 'approve') {
          if (type === 'ent') {
            db.prepare('UPDATE ent_uploads SET ent_score = ? WHERE id = ?').run(score, row.id);
            db.prepare('UPDATE users SET ent_score = ?, ent_verified_score = ?, ent_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(score, score, row.user_id);
            createNotification(db, row.user_id, 'ent_reviewed', 'ЕНТ подтверждён', `Ваш балл ЕНТ: ${score} баллов. Документ одобрен.`, null);
          } else {
            db.prepare('UPDATE users SET military_service = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.user_id);
            createNotification(db, row.user_id, 'military_reviewed', 'Военная служба подтверждена', 'Документ о военной службе одобрен.', null);
          }
        } else {
          const reason = note.trim() || 'Не указана';
          if (type === 'ent') {
            createNotification(db, row.user_id, 'ent_reviewed', 'ЕНТ не подтверждён', `Причина отказа: ${reason}. Вы можете загрузить документ повторно.`, null);
          } else {
            createNotification(db, row.user_id, 'military_reviewed', 'Военная служба не подтверждена', `Причина отказа: ${reason}. Вы можете загрузить документ повторно.`, null);
          }
        }

        audit(db, table, row.id, 'UPDATE', req.userId, { status, note: note.trim(), ...(type === 'ent' && action === 'approve' ? { entScore: score } : {}) });
        return { status: 200 };
      })();
      res.status(result.status).json(result.error ? { error: result.error } : { success: true });
    } catch (error) { next(error); }
  });
}

// ─── NOTIFICATIONS ──────────────────────────────

router.get('/notifications', (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const notifications = getDb().prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.userId, limit);
    const unread = getDb().prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.userId).count;
    res.json({ success: true, notifications, unread });
  } catch (error) { next(error); }
});

router.post('/notifications/read', (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      getDb().prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`).run(req.userId, ...ids);
    } else {
      getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── AUTO-CLEANUP OLD DOCUMENTS ──────────────────────────────

router.post('/cleanup-documents', verifyAdmin, (req, res, next) => {
  try {
    const db = getDb();
    const expired = db.prepare("SELECT id, file_path, user_id FROM ent_uploads WHERE auto_delete_at < CURRENT_TIMESTAMP AND status IN ('approved', 'rejected') UNION ALL SELECT id, file_path, user_id FROM military_verifications WHERE auto_delete_at < CURRENT_TIMESTAMP AND status IN ('approved', 'rejected')").all();
    let deleted = 0;
    for (const doc of expired) {
      deleteFile(doc.file_path);
      deleted++;
    }
    // Mark as cleaned (set auto_delete_at to past but keep record)
    db.prepare("UPDATE ent_uploads SET file_path = NULL WHERE auto_delete_at < CURRENT_TIMESTAMP AND status IN ('approved', 'rejected')").run();
    db.prepare("UPDATE military_verifications SET file_path = NULL WHERE auto_delete_at < CURRENT_TIMESTAMP AND status IN ('approved', 'rejected')").run();
    res.json({ success: true, deleted });
  } catch (error) { next(error); }
});

module.exports = router;
