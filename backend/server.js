require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

// Глобальные обработчики ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠ FATAL Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Инициализируем БД перед импортом db модуля
const { initDatabase } = require('./database');
initDatabase();

const { getUniversities, getUniversity, getSpecialtyCategories, getGrants, getTips, getUniversitiesContext, getCities } = require('./db');
const aiRoutes = require('./ai-routes');
const authRoutes = require('./auth-routes');
const admissionRoutes = require('./admission-routes');
const { verifyAuth, verifyAdmin } = require('./auth-middleware');

const app = express();

// Security headers (helmet) with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://openrouter.io'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      'script-src-attr': ["'unsafe-inline'"],
      'style-src-attr': ["'unsafe-inline'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Response compression
app.use(compression());

// Validate required environment variables
const requiredEnv = ['JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(o => o.trim());
app.use(cors({
  origin: function(origin, callback) {
    const isLocalFile = process.env.NODE_ENV !== 'production' && origin === 'null';
    if (!origin || isLocalFile || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTPS redirect for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
    next();
  });
}
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Add logging middleware
app.use((req, res, next) => {
  process.stderr.write(`[${new Date().toISOString()}] ${req.method} ${req.path}\n`);
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

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

// Admin: Update academic year (requires auth + admin)
app.put('/api/admin/academic-year', verifyAuth, verifyAdmin, (req, res) => {
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
const reviewRateLimit = new Map();
const REVIEW_RATE_WINDOW = 300000; // 5 minutes
const MAX_REVIEWS_PER_WINDOW = 3;

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
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const log = reviewRateLimit.get(ip) || [];
    const recent = log.filter(t => now - t < REVIEW_RATE_WINDOW);
    if (recent.length >= MAX_REVIEWS_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many reviews. Please wait 5 minutes.' });
    }
    recent.push(now);
    reviewRateLimit.set(ip, recent);

    const db = require('./database').getDb();
    const { user_name, rating, pros, cons, comment, faculty, study_year } = req.body;
    if (!user_name || !rating) return res.status(400).json({ error: 'user_name and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
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

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const db = require('./database').getDb();
    db.exec('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', message: e.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✓ EduMatch KZ running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Allowed origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    const { closeDb } = require('./database');
    closeDb?.();
    process.exit(0);
  });
  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown after 30 seconds');
    process.exit(1);
  }, 30000);
});