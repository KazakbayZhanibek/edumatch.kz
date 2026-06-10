require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Глобальные обработчики ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠ Uncaught Exception:', error);
  // Не выходим из процесса, чтобы сервер продолжал работать
});

// Инициализируем БД перед импортом db модуля
const { initDatabase } = require('./database');
initDatabase();

const { getUniversities, getUniversity, getSpecialtyCategories, getGrants, getTips, getUniversitiesContext, getCities } = require('./db');
const aiRoutes = require('./ai-routes');
const authRoutes = require('./auth-routes');
const admissionRoutes = require('./admission-routes');

const app = express();

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Response compression
app.use(compression());

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Add logging middleware
app.use((req, res, next) => {
  process.stderr.write(`[${new Date().toISOString()}] ${req.method} ${req.path}\n`);
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/cities', (req, res) => {
  try { res.json(getCities()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/universities', (req, res) => {
  try { res.json(getUniversities({ ...req.query, lang: req.query.lang || 'ru' })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/universities/:id', (req, res) => {
  try {
    const u = getUniversity(req.params.id, req.query.lang || 'ru');
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(u);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/compare', (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Min 2' });
    if (ids.length > 3) return res.status(400).json({ error: 'Max 3' });
    const lang = req.query.lang || 'ru';
    res.json(ids.map(id => getUniversity(id, lang)).filter(Boolean));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/specialties', (req, res) => {
  try { res.json(getSpecialtyCategories()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/grants', (req, res) => {
  try { res.json(getGrants({ lang: req.query.lang || 'ru' })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tips', (req, res) => {
  try { res.json(getTips()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// TEST: Simple endpoint
app.get('/api/test-specialties', (req, res) => {
  try {
    const db = require('./database').getDb();
    const specialties = db.prepare('SELECT id, name FROM specialties ORDER BY name').all();
    res.json({ test: true, specialties });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// AI Advisor routes (new OpenRouter-based system)
app.use('/api/ai', aiRoutes);

// Admission Predictor
app.use('/api/admission', admissionRoutes);

// Authentication & Profile routes (Phase 2)
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);
// saved-universities, chat-history, test-results на /api/*
app.use('/api', authRoutes);

// Admin: Update academic year
app.put('/api/admin/academic-year', (req, res) => {
  try {
    const { year } = req.body;
    if (!year || !/^\d{4}-\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Format: YYYY-YYYY (e.g. 2025-2026)' });
    }
    const db = require('./database').getDb();
    db.prepare('UPDATE admission_requirements SET academic_year = ?').run(year);
    db.prepare('UPDATE grants SET academic_year = ?').run(year);
    const arCount = db.prepare('SELECT COUNT(*) as c FROM admission_requirements').get().c;
    const gCount = db.prepare('SELECT COUNT(*) as c FROM grants').get().c;
    res.json({ success: true, year, admission_requirements: arCount, grants: gCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get current academic year
app.get('/api/admin/academic-year', (req, res) => {
  try {
    const db = require('./database').getDb();
    const row = db.prepare('SELECT academic_year FROM admission_requirements LIMIT 1').get();
    res.json({ year: row?.academic_year || '2025-2026' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REVIEWS API ──────────────────────────────
app.get('/api/universities/:id/reviews', (req, res) => {
  try {
    const db = require('./database').getDb();
    const reviews = db.prepare('SELECT * FROM reviews WHERE university_id = ? ORDER BY created_at DESC').all(req.params.id);
    const stats = db.prepare('SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE university_id = ?').get(req.params.id);
    res.json({ reviews, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/universities/:id/reviews', (req, res) => {
  try {
    const db = require('./database').getDb();
    const { user_name, rating, pros, cons, comment, faculty, study_year } = req.body;
    if (!user_name || !rating) return res.status(400).json({ error: 'user_name and rating required' });
    const result = db.prepare('INSERT INTO reviews (university_id, user_name, rating, pros, cons, comment, faculty, study_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.params.id, user_name, rating, pros || '', cons || '', comment || '', faculty || '', study_year || ''
    );
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ANALYTICS API ────────────────────────────
app.get('/api/analytics/top-queries', (req, res) => {
  try {
    const db = require('./database').getDb();
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 10;
    const queries = db.prepare(`
      SELECT query, intent, COUNT(*) as count, AVG(response_time_ms) as avg_ms
      FROM query_log
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY query
      ORDER BY count DESC
      LIMIT ?
    `).all(days, limit);
    res.json(queries);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/analytics/stats', (req, res) => {
  try {
    const db = require('./database').getDb();
    const days = parseInt(req.query.days) || 7;
    const total = db.prepare("SELECT COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days')").get(days);
    const byIntent = db.prepare("SELECT intent, COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY intent ORDER BY c DESC").all(days);
    const byLang = db.prepare("SELECT lang, COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY lang ORDER BY c DESC").all(days);
    res.json({ total: total.c, byIntent, byLang });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Input sanitization middleware — strip HTML/script tags from JSON body fields
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/<[^>]*>/g, '').trim();
      }
    }
  }
  next();
});

// Global error handler (must be after all routes)
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('EduMatch KZ running at http://localhost:' + PORT));