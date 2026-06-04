/**
 * AI ROUTES
 * Express routing for AI endpoints
 */

const express = require('express');
const { handleAIAdvice } = require('./ai-controller');
const { verifyAuthOptional } = require('./auth-middleware');

const router = express.Router();

/**
 * POST /api/ai/advice
 * AI advisor endpoint (опционально с авторизацией — сохраняет историю)
 */
router.post('/advice', verifyAuthOptional, handleAIAdvice);

module.exports = router;
