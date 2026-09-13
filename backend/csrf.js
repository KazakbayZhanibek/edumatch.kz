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

function sessionKey(req) {
  // The token is bound to the actual server-side session token, not merely an
  // IP address. This prevents a token issued before login from authorizing a
  // logged-in session and works before verifyAuth runs.
  return req.cookies?.auth_token || `anonymous:${req.ip || 'unknown'}`;
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
}

// Middleware: set a readable double-submit token and validate mutations.
function csrfProtection(req, res, next) {
  const key = sessionKey(req);
  if (isSafeMethod(req.method)) {
    const token = generateToken(key);
    res.cookie('csrf_token', token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CSRF_EXPIRY,
    });
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;
  if (typeof csrfToken !== 'string' || !validateToken(csrfToken, key)) {
    console.warn(`[CSRF] Invalid token from ${req.ip} at ${req.path}`);
    return res.status(403).json({ error: 'CSRF токен недействителен' });
  }

  next();
}

module.exports = { generateToken, validateToken, csrfProtection };
