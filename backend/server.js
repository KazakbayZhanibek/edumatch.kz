require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Инициализируем БД перед импортом db модуля
const { initDatabase } = require('./database');
const { seedDatabaseIfEmpty } = require('./migration');
initDatabase();
seedDatabaseIfEmpty();

const { getUniversities, getUniversity, getSpecialtyCategories, getGrants, getTips, getUniversitiesContext } = require('./db');
const aiRoutes = require('./ai-routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

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

// AI Advisor routes (new OpenRouter-based system)
app.use('/api/ai', aiRoutes);

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('EduMatch KZ running at http://localhost:' + PORT));