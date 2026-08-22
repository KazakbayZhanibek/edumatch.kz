/**
 * validation-utils.js
 * Утилиты для валидации и санитизации данных
 */

const crypto = require('crypto');

// ============== JSON VALIDATION ==============
/**
 * Валидация JSON массива строк (для languages, accreditations, requirements)
 */
function validateStringArray(value, fieldName = 'field', maxItems = 10) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      return { valid: false, error: `${fieldName}: Invalid JSON` };
    }
  }
  
  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName}: Must be array` };
  }
  
  if (value.length > maxItems) {
    return { valid: false, error: `${fieldName}: Max ${maxItems} items` };
  }
  
  for (const item of value) {
    if (typeof item !== 'string') {
      return { valid: false, error: `${fieldName}: All items must be strings` };
    }
    if (item.length > 500) {
      return { valid: false, error: `${fieldName}: Item too long (max 500 chars)` };
    }
  }
  
  return { valid: true, value };
}

/**
 * Валидация JSON объекта (для preferences, context)
 */
function validateJsonObject(value, fieldName = 'field', allowedKeys = null) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      return { valid: false, error: `${fieldName}: Invalid JSON` };
    }
  }
  
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { valid: false, error: `${fieldName}: Must be JSON object` };
  }
  
  if (allowedKeys && !Array.isArray(allowedKeys)) {
    allowedKeys = null;
  }
  
  for (const key of Object.keys(value)) {
    if (allowedKeys && !allowedKeys.includes(key)) {
      return { valid: false, error: `${fieldName}: Unknown key "${key}"` };
    }
    
    const val = value[key];
    if (typeof val === 'string' && val.length > 1000) {
      return { valid: false, error: `${fieldName}.${key}: Value too long` };
    }
  }
  
  return { valid: true, value };
}

// ============== XSS PROTECTION ==============
/**
 * HTML escape для безопасной вставки в HTML
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Удаление опасных HTML тегов и атрибутов
 * Оставляет только безопасные теги: b, strong, i, em, u, br, p, ul, ol, li
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  
  // Удаляем script, style, iframe и другие опасные теги
  html = html.replace(/<(script|style|iframe|object|embed|link|meta|form|input|button)[\s\S]*?<\/\1>/gi, '');
  
  // Удаляем event handlers и javascript: ссылки
  html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  
  return html.trim();
}

/**
 * Проверка что строка не содержит HTML тегов
 */
function isPlainText(text) {
  if (typeof text !== 'string') return false;
  return !/<[^>]*>/g.test(text);
}

// ============== FIELD VALIDATION ==============
/**
 * Валидация email
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Валидация URL
 */
function validateUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Валидация номера телефона
 */
function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  // Простая проверка: 7-15 цифр, может содержать +, -, пробелы
  return /^\+?[\d\s\-()]{7,15}$/.test(phone.replace(/[\s\-()]/g, ''));
}

/**
 * Валидация целого числа в диапазоне
 */
function validateInteger(value, min, max) {
  const num = parseInt(value);
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}

// ============== SANITIZATION ==============
/**
 * Очистка строки от опасных символов и излишних пробелов
 */
function sanitizeString(text, maxLength = 500) {
  if (typeof text !== 'string') return '';
  
  // Удаляем управляющие символы
  text = text.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Удаляем HTML теги
  text = text.replace(/<[^>]*>/g, '');
  
  // Экранируем спецсимволы
  text = escapeHtml(text);
  
  // Обрезаем до maxLength
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).trim();
  }
  
  // Удаляем излишние пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Генерация безопасного хеша для аудита
 */
function hashData(data) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

// ============== SUBMISSION VALIDATION ==============
/**
 * Проверка пользовательского текста: длина, запрещённые слова, обязательные слова.
 * Возвращает объект { allowed, reason, ... }.
 */
function evaluateSubmission(input, options = {}) {
  const {
    maxLength = 1500,
    maxTokens,
    bannedTerms = [],
    blockedTerms = [],
    requiredTerms = []
  } = options;

  const effectiveMaxLength = Number.isFinite(maxTokens) ? maxTokens : maxLength;

  if (input == null) {
    return { allowed: false, reason: 'missing_input' };
  }

  const text = String(input).trim();
  if (!text) {
    return { allowed: false, reason: 'empty_input' };
  }

  const normalized = text.replace(/\s+/g, ' ');
  const wordMatches = normalized.toLowerCase().match(/[a-zA-Z0-9'-]+/g) || [];

  if (wordMatches.length > effectiveMaxLength) {
    return {
      allowed: false,
      reason: 'too_long',
      tokenCount: wordMatches.length,
      maxLength: effectiveMaxLength
    };
  }

  const forbidden = [...bannedTerms, ...blockedTerms]
    .filter(Boolean)
    .map(term => String(term).trim())
    .filter(Boolean);

  const detectedBlocked = [];
  const lowerText = normalized.toLowerCase();
  for (const term of forbidden) {
    if (lowerText.includes(String(term).toLowerCase())) {
      detectedBlocked.push(term);
    }
  }

  if (detectedBlocked.length) {
    return {
      allowed: false,
      reason: 'blocked_terms',
      matches: detectedBlocked
    };
  }

  const required = (requiredTerms || [])
    .filter(Boolean)
    .map(term => String(term).trim())
    .filter(Boolean);

  if (required.length) {
    const missing = [];
    for (const term of required) {
      if (!lowerText.includes(String(term).toLowerCase())) {
        missing.push(term);
      }
    }

    if (missing.length) {
      return {
        allowed: false,
        reason: 'missing_required_terms',
        missing
      };
    }
  }

  return {
    allowed: true,
    reason: 'accepted',
    tokenCount: wordMatches.length
  };
}

// ============== EXPORTS ==============
module.exports = {
  validateStringArray,
  validateJsonObject,
  escapeHtml,
  sanitizeHtml,
  isPlainText,
  validateEmail,
  validateUrl,
  validatePhone,
  validateInteger,
  sanitizeString,
  hashData,
  evaluateSubmission
};
