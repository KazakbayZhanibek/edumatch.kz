/* =============================================
   SECURITY.JS — XSS Protection Utils
   ============================================= */

/**
 * HTML escape - конвертирует специальные символы в HTML entities
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Безопасно устанавливает текст в element (защита от XSS)
 * Используйте это вместо element.innerHTML = userInput
 */
function setSafeText(element, text) {
  if (!element) return;
  element.textContent = String(text || '');
}

/**
 * Безопасно устанавливает HTML с санитизацией
 * ВНИМАНИЕ: используйте только для контролируемого контента!
 */
function setSafeHtml(element, html) {
  if (!element) return;
  
  // Удаляем опасные теги и атрибуты
  const sanitized = sanitizeHtml(html);
  element.innerHTML = sanitized;
}

/**
 * Санитизация HTML - удаляет опасные теги и атрибуты
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Without the maintained sanitizer, preserve content as text.
  return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html);
}

/**
 * Создаёт element с безопасным текстом
 * Пример: createSafeElement('div', userInputText)
 */
function createSafeElement(tagName, textContent, className = null) {
  const el = document.createElement(tagName);
  if (textContent) {
    el.textContent = String(textContent);
  }
  if (className) {
    el.className = className;
  }
  return el;
}

/**
 * Безопасно устанавливает атрибут (проверяет на javascript:)
 */
function setSafeAttribute(element, name, value) {
  if (!element || !name) return;
  
  // Запрещённые атрибуты
  const forbiddenAttrs = ['on*'];
  if (forbiddenAttrs.some(attr => name.toLowerCase().startsWith('on'))) {
    console.warn(`Forbidden attribute: ${name}`);
    return;
  }
  
  // Проверка javascript: в href и src
  if ((name === 'href' || name === 'src') && String(value).includes('javascript:')) {
    console.warn(`Blocked javascript: URL in ${name}`);
    return;
  }
  
  element.setAttribute(name, value);
}

/**
 * Экранирует специальные символы для использования в RegExp
 */
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Проверяет содержит ли строка HTML теги
 */
function containsHtml(text) {
  return /<[^>]*>/g.test(String(text || ''));
}

/**
 * Удаляет HTML теги из строки (для текстового отображения)
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Безопасно отображает JSON в элементе
 */
function displayJson(element, data) {
  if (!element) return;
  const json = JSON.stringify(data, null, 2);
  element.textContent = json;
}

/**
 * Инициализация - выполнить при загрузке страницы
 */
function initSecurity() {
  // Отключаем inline scripts
  document.addEventListener('beforescriptexecute', (e) => {
    if (e.target.type === 'text/javascript' && !e.target.src) {
      console.warn('Inline script blocked:', e.target);
      e.preventDefault();
    }
  });
  
}

// Attach the CSRF token to every same-origin state-changing request. The
// token is intentionally readable; the authentication cookie remains httpOnly.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const readCookie = name => document.cookie.split('; ').find(row => row.startsWith(name + '='))?.slice(name.length + 1);
  window.fetch = (input, init = {}) => {
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input.url;
    const sameOrigin = !url || url.startsWith('/') || new URL(url, window.location.href).origin === window.location.origin;
    if (!sameOrigin || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return nativeFetch(input, init);
    const token = readCookie('csrf_token');
    if (!token) return nativeFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', decodeURIComponent(token));
    return nativeFetch(input, { ...init, headers });
  };
})();

// Auto-init когда DOM готов
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSecurity);
} else {
  initSecurity();
}

// Export для использования
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    setSafeText,
    setSafeHtml,
    sanitizeHtml,
    createSafeElement,
    setSafeAttribute,
    escapeRegExp,
    containsHtml,
    stripHtml,
    displayJson,
    initSecurity
  };
}
