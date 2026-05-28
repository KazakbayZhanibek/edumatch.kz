/**
 * AI ROUTES
 * Express routing for AI endpoints
 */

const express = require('express');
const { handleAIAdvice } = require('./ai-controller');

const router = express.Router();

/**
 * POST /api/ai/advice
 * AI advisor endpoint
 */
router.post('/advice', handleAIAdvice);

module.exports = router;
