const router = require('express').Router();
const { verifyAuth, verifyAdmin } = require('./auth-middleware');
const { getDb } = require('./database');
const MAX_FILE = 5 * 1024 * 1024;

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
const validScore = value => Number.isInteger(value) && value >= 0 && value <= 140;
function audit(db, table, id, action, userId, values) {
  db.prepare('INSERT INTO audit_log (table_name, record_id, action, user_id, new_values) VALUES (?, ?, ?, ?, ?)')
    .run(table, id, action, userId, JSON.stringify(values));
}
router.use(verifyAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

for (const [type, table] of [['ent', 'ent_uploads'], ['military', 'military_verifications']]) {
  const column = type === 'ent' ? 'ent_score' : 'service_type';
  router.post('/' + type, (req, res, next) => {
    try {
      const { documentUrl, entScore, serviceType } = req.body || {};
      if (!decodeDocument(documentUrl)) return res.status(400).json({ error: 'Загрузите JPG, PNG, WEBP или PDF до 5 МБ. Для подтверждения нужен документ.' });
      if (type === 'ent' && entScore != null && !validScore(entScore)) return res.status(400).json({ error: 'Балл ЕНТ должен быть целым числом от 0 до 140' });
      if (type === 'military' && !['draft', 'contract', 'alternative'].includes(serviceType)) return res.status(400).json({ error: 'Выберите тип службы' });
      const db = getDb();
      const id = db.transaction(() => {
        if (db.prepare("SELECT id FROM " + table + " WHERE user_id = ? AND status = 'pending'").get(req.userId)) return null;
        const result = db.prepare('INSERT INTO ' + table + ' (user_id, document_url, ' + column + ') VALUES (?, ?, ?)')
          .run(req.userId, documentUrl, type === 'ent' ? entScore ?? null : serviceType);
        audit(db, table, result.lastInsertRowid, 'INSERT', req.userId, { status: 'pending' });
        return result.lastInsertRowid;
      })();
      return id === null ? res.status(409).json({ error: 'Заявка уже на проверке. Дождитесь решения или отмените её.' })
        : res.status(201).json({ success: true, id, status: 'pending' });
    } catch (error) { next(error); }
  });
  router.get('/' + type + '/status', (req, res, next) => {
    try {
      const db = getDb();
      const history = db.prepare('SELECT id, user_id, status, review_note, reviewed_at, created_at, ' + column + ' FROM ' + table + ' WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(req.userId);
      const user = db.prepare('SELECT ent_score, ent_verified_score, ent_verified_at, military_service FROM users WHERE id = ?').get(req.userId);
      const verified = type === 'ent' ? user?.ent_verified_at != null && user.ent_score === user.ent_verified_score : user?.military_service === 1;
      res.json({ verified, entScore: user?.ent_score ?? null, verifiedAt: type === 'ent' ? user?.ent_verified_at : null, request: history[0] || null, history });
    } catch (error) { next(error); }
  });
  router.get('/' + type + '/pending', verifyAdmin, (req, res, next) => {
    try {
      const status = req.query.status || 'pending';
      if (!['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status)) return res.status(400).json({ error: 'Некорректный статус' });
      const requests = getDb().prepare("SELECT r.id, r.user_id, r.status, r.review_note, r.created_at, r.reviewed_at, r." + column +
        ", u.username, u.full_name, CASE WHEN r.document_url LIKE 'data:%' THEN 1 ELSE 0 END AS has_document FROM " + table +
        " r JOIN users u ON u.id = r.user_id WHERE (? = 'all' OR r.status = ?) ORDER BY r.id DESC LIMIT 100").all(status, status);
      res.json({ requests });
    } catch (error) { next(error); }
  });
  router.get('/' + type + '/:id/document', (req, res, next) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT user_id, document_url FROM ' + table + ' WHERE id = ?').get(req.params.id);
      const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId)?.is_admin;
      if (!row || (row.user_id !== req.userId && !admin)) return res.status(404).json({ error: 'Документ не найден' });
      const doc = decodeDocument(row.document_url);
      if (!doc) return res.status(404).json({ error: 'Документ отсутствует или его формат не поддерживается. Нужна повторная загрузка.' });
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[doc.mime];
      res.set('Content-Type', doc.mime);
      res.set('Content-Disposition', 'attachment; filename="' + type + '-' + Number(req.params.id) + '.' + extension + '"');
      res.send(doc.bytes);
    } catch (error) { next(error); }
  });
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
        if (action === 'approve' && !decodeDocument(row.document_url)) return { status: 400, error: 'Нельзя подтвердить заявку без документа. Запросите повторную загрузку.' };
        if (type === 'ent' && action === 'approve' && !validScore(score)) return { status: 400, error: 'Укажите подтверждённый балл от 0 до 140' };
        const status = action === 'approve' ? 'approved' : 'rejected';
        db.prepare('UPDATE ' + table + ' SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.userId, note.trim() || null, row.id);
        if (action === 'approve') {
          if (type === 'ent') {
            db.prepare('UPDATE ent_uploads SET ent_score = ? WHERE id = ?').run(score, row.id);
            db.prepare('UPDATE users SET ent_score = ?, ent_verified_score = ?, ent_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(score, score, row.user_id);
          } else db.prepare('UPDATE users SET military_service = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.user_id);
        }
        audit(db, table, row.id, 'UPDATE', req.userId, { status, note: note.trim(), ...(type === 'ent' && action === 'approve' ? { entScore: score } : {}) });
        return { status: 200 };
      })();
      res.status(result.status).json(result.error ? { error: result.error } : { success: true });
    } catch (error) { next(error); }
  });
}
module.exports = router;
