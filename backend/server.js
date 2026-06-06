require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
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
app.use(cors());
app.use(express.json());

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
  try { res.json(getUniversities(req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/universities/:id', (req, res) => {
  try {
    const u = getUniversity(req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(u);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/compare', (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Min 2' });
    if (ids.length > 3) return res.status(400).json({ error: 'Max 3' });
    res.json(ids.map(id => getUniversity(id)).filter(Boolean));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/specialties', (req, res) => {
  try { res.json(getSpecialtyCategories()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/grants', (req, res) => {
  try { res.json(getGrants()); }
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

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('EduMatch KZ running at http://localhost:' + PORT));