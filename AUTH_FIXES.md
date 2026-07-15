# 🔐 Исправления аутентификации EduMatch KZ

## Проблемы которые исправлены:

### 1. ❌ Кнопка входа не работала
**Причина**: Backend middleware `verifyAuth` искал токен только в Authorization header, но фронтенд отправлял токен в httpOnly cookie. Middleware не знал как читать cookies.

**Исправление**: 
- ✅ Добавлен `cookie-parser` middleware в `server.js`
- ✅ Обновлена функция `verifyAuth` в `auth-middleware.js` для чтения токена из cookie И из header (для совместимости)

### 2. ❌ Выход из аккаунта при каждом запуске
**Причина**: Cookie не очищалась правильно, и при перезагрузке страницы `Auth.init()` вызывал `verifySession()` которая всегда возвращала 401.

**Исправление**:
- ✅ Обновлен endpoint `/logout` для правильной очистки cookie
- ✅ Улучшена обработка cookies (path: '/', sameSite: 'lax')

---

## 🚀 Как запустить проект:

```bash
# 1. Установить зависимости (если не установлены)
cd backend
npm install

# 2. Создать .env файл (если не существует)
# Содержимое .env:
JWT_SECRET=your-secret-key-at-least-32-characters-long-for-security
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# 3. Запустить сервер
npm run start
# или просто:
node server.js

# Сервер запустится на http://localhost:3000
```

---

## 📝 Что изменилось в коде:

### backend/server.js
```javascript
// Добавлен импорт
const cookieParser = require('cookie-parser');

// Добавлена строка после express.json()
app.use(cookieParser());
```

### backend/auth-middleware.js
```javascript
// Обновлена функция verifyAuth для чтения токена из cookie
function verifyAuth(req, res, next) {
  try {
    const lang = getLang(req);
    
    // Сначала пытаемся получить токен из httpOnly cookie
    let token = req.cookies?.auth_token;
    
    // Если нет в cookie, пытаемся из Authorization header (для совместимости)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: '...' });
    }
    
    // ... остальной код
  }
}
```

### backend/auth-routes.js
```javascript
// Обновлены cookie настройки:
res.cookie('auth_token', result.token, {
  httpOnly: true,           // Защита от XSS
  secure: NODE_ENV === 'production',  // HTTPS в production
  sameSite: 'lax',          // CSRF защита (lax вместо strict для совместимости)
  path: '/',                // Доступна на всех путях
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
});

// Обновлен logout для очистки cookie
res.clearCookie('auth_token', {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
});
```

---

## 🧪 Как протестировать:

1. **Откройте браузер**: http://localhost:3000
2. **Кликните на кнопку "Войти"**
3. **Введите email и пароль**
   - Если нет аккаунта, нажмите "Регистрация"
4. **Нажмите кнопку "Войти"**
5. **Проверьте что вы вошли в систему**
6. **Перезагрузите страницу (Ctrl+R или Cmd+R)**
7. **Проверьте что вы остались в системе** ✅

---

## 🔒 Технические детали:

### Cookies vs LocalStorage
- ❌ **LocalStorage**: Уязвима для XSS атак (JS может прочитать)
- ✅ **httpOnly Cookies**: Безопаснее (JS не может прочитать, только браузер)

### Как работает сейчас:
1. Пользователь вводит email/пароль
2. Frontend отправляет запрос на `/api/auth/login`
3. Backend проверяет учетные данные
4. Backend устанавливает cookie: `Set-Cookie: auth_token=...`
5. Браузер автоматически сохраняет cookie
6. Для каждого следующего запроса браузер автоматически отправляет cookie
7. `verifyAuth` middleware читает токен из cookie
8. При выходе cookie удаляется

### Cookie параметры:
- `httpOnly`: Недоступна JavaScript (безопасность)
- `secure`: Только HTTPS в production
- `sameSite=lax`: Защита от CSRF атак, но позволяет кроссайтовые запросы где это нужно
- `path=/`: Доступна на всех путях сайта
- `maxAge`: Время жизни (7 дней)

---

## ⚠️ Важно помнить:

1. **Если не работает после обновления**:
   - Очистите браузер cookies: `DevTools → Application → Cookies → Delete all`
   - Очистите localStorage: `DevTools → Application → Local Storage → Clear All`
   - Перезагрузите страницу

2. **Для production**:
   - Установите `NODE_ENV=production`
   - Генерируйте длинный JWT_SECRET (минимум 32 символа, лучше 64+)
   - Используйте HTTPS
   - Установите правильный `ALLOWED_ORIGINS`

3. **Если есть ошибки**:
   - Проверьте консоль браузера (F12 → Console)
   - Проверьте сетевые запросы (F12 → Network)
   - Проверьте логи backend (терминал где запущен сервер)

---

## 📚 Дополнительная документация:

- RFC 6265: HTTP State Management Mechanism (Cookies)
- OWASP: XSS Prevention
- OWASP: CSRF Prevention
- Express.js: cookie-parser middleware
