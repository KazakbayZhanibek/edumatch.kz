require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
initDatabase();
const aiRoutes = require('./ai-routes');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ai/advice', (req, res, next) => {
  console.log('[TEST] POST /api/ai/advice received, body:', JSON.stringify(req.body).slice(0, 200));
  next();
}, aiRoutes);

app.listen(3001, () => console.log('Test server on http://localhost:3001'));
