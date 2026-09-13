/**
 * csrf.js — CSRF Protection for cookie-based requests
 * Generates and validates CSRF tokens
 */

const crypto = require('crypto');

// In-memory store (in production, use Redis or session store)
const csrfTokens = new Map();
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const CSRF_EXPIRY = 60 * 60 * 1000; // 1 hour

function generateToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHmac('sha256', CSRF_SECRET).update(token + sessionId).digest('hex');

  csrfTokens.set(hash, {
    sessionId,
    expires: Date.now() + CSRF_EXPIRY,
  });

  // Cleanup old tokens
  if (csrfTokens.size > 10000) {
    const now = Date.now();
    for (const [key, val] of csrfTokens.entries()) {
      if (val.expires < now) csrfTokens.delete(key);
    }
  }

  return token;
}

function validateToken(token, sessionId) {
  if (!token || !sessionId) return false;

  const hash = crypto.createHmac('sha256', CSRF_SECRET).update(token + sessionId).digest('hex');
  const record = csrfTokens.get(hash);

  if (!record) return false;
  if (record.expires < Date.now()) {
    csrfTokens.delete(hash);
    return false;
  }
  if (record.sessionId !== sessionId) return false;

  return true;
}

// Middleware: set CSRF token in cookie and validate on mutations
function csrfProtection(req, res, next) {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Generate and set CSRF token for safe methods
    const sessionId = req.userId || req.ip || 'anonymous';
    const token = generateToken(sessionId);
    res.cookie('csrf_token', token, {
      httpOnly: false, // JS needs to read it
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: CSRF_EXPIRY,
    });
    return next();
  }

  // Validate on POST, PUT, PATCH, DELETE
  const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;
  const sessionId = req.userId || req.ip || 'anonymous';

  if (!csrfToken || !validateToken(csrfToken, sessionId)) {
    console.warn(`[CSRF] Invalid token from ${req.ip} at ${req.path}`);
    return res.status(403).json({ error: 'CSRF токен недействителен' });
  }

  next();
}

module.exports = { generateToken, validateToken, csrfProtection };
