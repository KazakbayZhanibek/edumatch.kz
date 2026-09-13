const router = require('express').Router();
const { verifyAuth, verifyAdmin } = require('./auth-middleware');
const { getDb } = require('./database');

// ─── DATA SOURCES ──────────────────────────────

router.get('/sources', (req, res, next) => {
  try {
    const db = getDb();
    const sources = db.prepare(`
      SELECT ds.*, u.short_name, u.name AS university_name
      FROM data_sources ds
      LEFT JOIN universities u ON u.id = ds.university_id
      ORDER BY ds.last_updated_at DESC NULLS LAST
      LIMIT 100
    `).all();
    res.json({ success: true, sources });
  } catch (error) { next(error); }
});

router.post('/sources', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const { university_id, source_name, source_url, data_type, notes } = req.body;
    if (!source_name || !source_name.trim()) return res.status(400).json({ error: 'Название источника обязательно' });
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO data_sources (university_id, source_name, source_url, data_type, notes, last_checked_at, last_updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      Number(university_id) || null,
      String(source_name).trim().slice(0, 200),
      String(source_url || '').trim().slice(0, 500) || null,
      String(data_type || 'general').slice(0, 50),
      String(notes || '').trim().slice(0, 1000) || null
    );
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (error) { next(error); }
});

router.delete('/sources/:id', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const result = getDb().prepare('DELETE FROM data_sources WHERE id = ?').run(req.params.id);
    result.changes ? res.json({ success: true }) : res.status(404).json({ error: 'Источник не найден' });
  } catch (error) { next(error); }
});

// ─── OUTDATED DATA FLAG ──────────────────────────────

router.get('/outdated', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 90, 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const outdated = getDb().prepare(`
      SELECT u.id, u.name, u.short_name, u.last_updated_at, u.data_status, c.name AS city,
        CAST((julianday('now') - julianday(u.last_updated_at)) AS INTEGER) AS days_stale
      FROM universities u
      LEFT JOIN cities c ON c.id = u.city_id
      WHERE u.last_updated_at < ? OR u.last_updated_at IS NULL
      ORDER BY u.last_updated_at ASC NULLS FIRST
      LIMIT 100
    `).all(since);
    res.json({ success: true, outdated, threshold_days: days });
  } catch (error) { next(error); }
});

// ─── CSV IMPORT ──────────────────────────────

router.post('/import-csv', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const { csv_data, update_fields } = req.body;
    if (!csv_data || typeof csv_data !== 'string') return res.status(400).json({ error: 'Данные CSV обязательны' });

    const lines = csv_data.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: 'CSV должен содержать заголовок и хотя бы одну строку данных' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const allowedFields = ['name', 'short_name', 'price_from', 'price_to', 'website', 'address', 'admission_phone', 'admission_email', 'founded', 'students_count'];
    const validHeaders = headers.filter(h => allowedFields.includes(h));

    if (validHeaders.length === 0) {
      return res.status(400).json({
        error: 'Не найдено допустимых колонок. Допустимые: ' + allowedFields.join(', '),
        headers_found: headers,
      });
    }

    const db = getDb();
    const results = { total: 0, matched: 0, updated: 0, errors: [], preview: [] };

    for (let i = 1; i < lines.length && i <= 500; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((h, idx) => { if (allowedFields.includes(h)) row[h] = values[idx]; });

      if (!row.name) { results.errors.push({ line: i + 1, error: 'Пустое название' }); continue; }

      results.total++;
      const existing = db.prepare('SELECT id, name FROM universities WHERE name = ? OR short_name = ?').get(row.name, row.name);

      if (existing) {
        results.matched++;
        const updateFields = [];
        const updateValues = [];
        for (const field of validHeaders) {
          if (field === 'name' || !row[field]) continue;
          if (['price_from', 'price_to', 'founded', 'students_count'].includes(field)) {
            const num = Number(row[field]);
            if (!Number.isFinite(num) || num < 0) { results.errors.push({ line: i + 1, error: `Некорректное значение ${field}: ${row[field]}` }); continue; }
            updateFields.push(`${field} = ?`);
            updateValues.push(Math.round(num));
          } else {
            updateFields.push(`${field} = ?`);
            updateValues.push(String(row[field]).slice(0, 500));
          }
        }
        if (updateFields.length > 0) {
          updateFields.push('last_updated_at = CURRENT_TIMESTAMP');
          db.prepare(`UPDATE universities SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues, existing.id);
          results.updated++;
        }
      }

      if (results.preview.length < 10) {
        results.preview.push({ line: i + 1, name: row.name, action: existing ? 'update' : 'skip (not found)', fields: row });
      }
    }

    res.json({ success: true, results });
  } catch (error) { next(error); }
});

// ─── DEADLINES ──────────────────────────────

router.get('/deadlines', (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 60, 1), 365);
    const since = new Date().toISOString();
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const deadlines = getDb().prepare(`
      SELECT d.*, u.short_name, u.name AS university_name
      FROM deadlines d
      LEFT JOIN universities u ON u.id = d.university_id
      WHERE d.deadline_date BETWEEN ? AND ?
      ORDER BY d.deadline_date ASC
    `).all(since, until);
    res.json({ success: true, deadlines });
  } catch (error) { next(error); }
});

router.post('/deadlines', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const { title, description, deadline_date, category, university_id, academic_year } = req.body;
    if (!title || !deadline_date) return res.status(400).json({ error: 'Название и дата обязательны' });
    const result = getDb().prepare(`
      INSERT INTO deadlines (title, description, deadline_date, category, university_id, academic_year)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      String(title).trim().slice(0, 200),
      String(description || '').trim().slice(0, 1000) || null,
      String(deadline_date).slice(0, 30),
      String(category || 'general').slice(0, 50),
      Number(university_id) || null,
      String(academic_year || '2025-2026').slice(0, 20)
    );
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (error) { next(error); }
});

router.delete('/deadlines/:id', verifyAuth, verifyAdmin, (req, res, next) => {
  try {
    const result = getDb().prepare('DELETE FROM deadlines WHERE id = ?').run(req.params.id);
    result.changes ? res.json({ success: true }) : res.status(404).json({ error: 'Дедлайн не найден' });
  } catch (error) { next(error); }
});

module.exports = router;
