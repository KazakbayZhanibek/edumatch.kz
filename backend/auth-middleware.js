/**
 * auth-middleware.js - Authentication Middleware
 * Проверка JWT токенов и защита endpoints
 */

const authService = require('./auth-service');
const { tr, getLang } = require('./i18n');

/**
 * Middleware для проверки аутентификации
 * Проверяет наличие и валидность JWT токена в заголовке Authorization
 * Использование: router.get('/protected', verifyAuth, handler)
 */
function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const lang = getLang(req);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: tr('auth_token_missing', lang) || 'Токен не найден'
      });
    }

    const token = authHeader.slice(7); // Убрать 'Bearer '

    // Проверить, действителен ли токен в БД
    const validation = authService.validateSessionToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        error: tr('auth_token_invalid', lang) || 'Токен недействителен или истёк'
      });
    }

    // Проверить подпись JWT
    const verification = authService.verifyToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        error: tr('auth_token_fake', lang) || 'Токен поддельный или истёк'
      });
    }

    // Сохранить userId в request для использования в handlers
    req.userId = verification.userId;
    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_token_check_error', lang) || 'Ошибка проверки токена' });
  }
}

/**
 * Middleware для опциональной аутентификации
 * Если токен есть, проверяет его; если нет, продолжает выполнение
 */
function verifyAuthOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Токен не предоставлен, продолжаем без него
      return next();
    }

    const token = authHeader.slice(7);

    const validation = authService.validateSessionToken(token);
    const verification = authService.verifyToken(token);

    if (validation.valid && verification.valid) {
      req.userId = verification.userId;
      req.token = token;
      req.authenticated = true;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
}

/**
 * Middleware для проверки прав доступа
 * Проверяет, что пользователь имеет доступ к определённому ресурсу
 */
function verifyOwnership(req, res, next) {
  try {
    const lang = getLang(req);
    // Пример: проверить, что пользователь пытается получить свой профиль
    // Использование: router.get('/users/:id/profile', verifyAuth, verifyOwnership, handler)

    const requestedUserId = req.params.userId || req.params.id;
    const currentUserId = req.userId;

    if (requestedUserId && parseInt(requestedUserId) !== currentUserId) {
      return res.status(403).json({
        error: tr('auth_no_access', lang) || 'У вас нет доступа к этому ресурсу'
      });
    }

    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_access_check_error', lang) || 'Ошибка проверки прав доступа' });
  }
}

/**
 * Middleware для проверки админ-прав
 * (для будущих функций администратора)
 */
function verifyAdmin(req, res, next) {
  try {
    const lang = getLang(req);
    // TODO: Добавить проверку is_admin в таблицу users
    const isAdmin = req.isAdmin; // Получать из БД

    if (!isAdmin) {
      return res.status(403).json({
        error: tr('auth_admin_required', lang) || 'Требуются права администратора'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_admin_check_error', lang) || 'Ошибка проверки прав администратора' });
  }
}

module.exports = {
  verifyAuth,
  verifyAuthOptional,
  verifyOwnership,
  verifyAdmin
};
