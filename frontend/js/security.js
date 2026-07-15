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
  
  // Создаём temporary element для парсинга
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Удаляем опасные теги
  const dangerousTags = ['script', 'iframe', 'style', 'object', 'embed', 'form', 'input', 'button'];
  for (const tag of dangerousTags) {
    temp.querySelectorAll(tag).forEach(el => el.remove());
  }
  
  // Удаляем event handlers и javascript: ссылки
  temp.querySelectorAll('[on*]').forEach(el => {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  
  // Очищаем javascript: ссылки
  temp.querySelectorAll('a, img, source').forEach(el => {
    for (const attr of ['href', 'src', 'srcset']) {
      const value = el.getAttribute(attr);
      if (value && value.includes('javascript:')) {
        el.removeAttribute(attr);
      }
    }
  });
  
  return temp.innerHTML;
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
  
  console.log('Security module initialized');
}

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
