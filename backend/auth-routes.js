/**
 * auth-routes.js - Authentication API Routes
 * Все endpoints для регистрации, входа, профиля, сохранённых вузов и т.д.
 */

const express = require('express');
const router = express.Router();
const authService = require('./auth-service');
const { verifyAuth } = require('./auth-middleware');
const { tr, getLang } = require('./i18n');

// ============== RATE LIMITING ==============
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW = 15 * 60 * 1000; // 15 минут

function checkLoginRateLimit(email, ip) {
  const key = `${email}:${ip}`;
  const now = Date.now();
  
  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, []);
  }
  
  const attempts = loginAttempts.get(key);
  const recentAttempts = attempts.filter(t => now - t < LOGIN_WINDOW);
  
  if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
    return false; // Rate limited
  }
  
  recentAttempts.push(now);
  loginAttempts.set(key, recentAttempts);
  
  // Cleanup старых ключей если карта слишком большая (memory leak fix)
  if (loginAttempts.size > 1000) {
    const now = Date.now();
    for (const [k, v] of loginAttempts.entries()) {
      const active = v.filter(t => now - t < LOGIN_WINDOW);
      if (active.length === 0) {
        loginAttempts.delete(k);
      }
    }
  }
  
  return true;
}

// ==================== AUTH ENDPOINTS ====================

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 * Body: { email, password, username, fullName? }
 */
router.post('/register', async (req, res) => {
  // Rate limiting check
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const email = (req.body.email || '').toLowerCase();
  if (!checkLoginRateLimit(email, ip)) {
    return res.status(429).json({
      error: tr('auth_too_many_attempts', getLang(req)) || 'Too many registration attempts. Please try again later.'
    });
  }
  
  try {
    const { email, password, username, fullName } = req.body;
    const lang = getLang(req);

    // Валидация
    if (!email || !password || !username) {
      return res.status(400).json({
        error: tr('auth_fields_required', lang) || 'Email, пароль и никнейм обязательны'
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: tr('auth_invalid_email', lang) || 'Неверный формат email'
      });
    }

    // Валидация username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: tr('auth_username_length', lang) || 'Никнейм должен быть от 3 до 20 символов'
      });
    }

    const result = await authService.registerUser(email, password, username, fullName, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Set httpOnly cookie with JWT token
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    });

    return res.status(201).json({
      success: true,
      user: result.user
    });
  } catch (error) {
    const safeError = {
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
    console.error('Register error:', safeError);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/auth/login
 * Вход пользователя
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  // Rate limiting check
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const email = (req.body.email || '').toLowerCase();
  if (!checkLoginRateLimit(email, ip)) {
    return res.status(429).json({
      error: tr('auth_too_many_attempts', getLang(req)) || 'Too many login attempts. Please try again later.'
    });
  }
  
  try {
    const { email, password } = req.body;
    const lang = getLang(req);

    if (!email || !password) {
      return res.status(400).json({
        error: tr('auth_email_password_required', lang) || 'Email и пароль обязательны'
      });
    }

    const result = await authService.loginUser(email, password, lang);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Set httpOnly cookie with JWT token
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    });

    return res.json({
      success: true,
      user: result.user
    });
  } catch (error) {
    const safeError = {
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
    console.error('Login error:', safeError);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/auth/logout
 * Выход пользователя
 * Cookie: auth_token или Header: Authorization: Bearer <token>
 */
router.post('/logout', verifyAuth, (req, res) => {
  try {
    const token = req.token; // Установлено middleware verifyAuth
    const lang = getLang(req);

    if (!token) {
      return res.status(400).json({ error: tr('auth_token_not_found', lang) || 'Токен не найден' });
    }

    const deleted = authService.deleteToken(token);

    if (!deleted) {
      return res.status(400).json({ error: tr('auth_logout_error', lang) || 'Ошибка при выходе' });
    }

    // Очищаем cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/auth/verify
 * Проверить токен
 * Header: Authorization: Bearer <token>
 */
router.post('/verify', verifyAuth, (req, res) => {
  try {
    const userId = req.userId;
    const lang = getLang(req);
    const user = authService.getUserProfile(userId);

    if (!user) {
      return res.status(404).json({ error: tr('auth_user_not_found_route', lang) || 'Пользователь не найден' });
    }

    return res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        isAdmin: Boolean(user.is_admin)
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

// ==================== PROFILE ENDPOINTS ====================

/**
 * GET /api/users/profile
 * Получить профиль текущего пользователя
 * Header: Authorization: Bearer <token>
 */
router.get('/profile', verifyAuth, (req, res) => {
  try {
    const lang = getLang(req);
    const user = authService.getUserProfile(req.userId);

    if (!user) {
      return res.status(404).json({ error: tr('auth_user_not_found_route', lang) || 'Пользователь не найден' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      phone: user.phone,
      bio: user.bio,
      profilePicture: user.profile_picture,
      isAdmin: Boolean(user.is_admin),
      preferences: user.preferences ? JSON.parse(user.preferences) : {},
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * PUT /api/users/profile
 * Обновить профиль
 * Header: Authorization: Bearer <token>
 * Body: { fullName?, phone?, bio?, preferences?, profilePicture? }
 */
router.put('/profile', verifyAuth, (req, res) => {
  try {
    const { fullName, phone, bio, preferences, profilePicture } = req.body;
    const lang = getLang(req);

    if (profilePicture && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(profilePicture)) {
      return res.status(400).json({ error: 'Недопустимый формат аватара' });
    }
    if (profilePicture && profilePicture.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Размер аватара не должен превышать 2 МБ' });
    }

    const result = authService.updateUserProfile(req.userId, {
      fullName,
      phone,
      bio,
      preferences,
      profilePicture
    }, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

// ==================== SAVED UNIVERSITIES ENDPOINTS ====================

/**
 * GET /api/saved-universities
 * Получить список сохранённых вузов
 * Header: Authorization: Bearer <token>
 */
router.get('/saved-universities', verifyAuth, (req, res) => {
  try {
    const saved = authService.getSavedUniversities(req.userId);

    return res.json({
      success: true,
      count: saved.length,
      universities: saved
    });
  } catch (error) {
    console.error('Get saved universities error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/saved-universities
 * Сохранить вуз
 * Header: Authorization: Bearer <token>
 * Body: { universityId, note? }
 */
router.post('/saved-universities', verifyAuth, (req, res) => {
  try {
    const { universityId, note } = req.body;
    const lang = getLang(req);

    if (!universityId) {
      return res.status(400).json({ error: tr('auth_university_id_required', lang) || 'universityId обязателен' });
    }

    const result = authService.saveUniversity(req.userId, universityId, note, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save university error:', error);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/saved-universities/:id
 * Удалить сохранённый вуз (по ID записи)
 */
router.delete('/saved-universities/:id', verifyAuth, (req, res) => {
  try {
    const lang = getLang(req);
    const result = authService.removeSavedUniversity(req.userId, req.params.id, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove saved university error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/saved-universities/university/:universityId
 * Удалить из избранного по ID вуза
 */
router.delete('/saved-universities/university/:universityId', verifyAuth, (req, res) => {
  try {
    const universityId = parseInt(req.params.universityId, 10);
    const lang = getLang(req);
    if (!universityId) {
      return res.status(400).json({ error: tr('auth_invalid_uni_id', lang) || 'Некорректный ID вуза' });
    }

    const result = authService.removeSavedUniversityByUniversityId(req.userId, universityId, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove saved university by uni id error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

// ==================== APPLICATION TRACKER ====================

router.get('/applications', verifyAuth, (req, res) => {
  try {
    return res.json({ success: true, applications: authService.getApplications(req.userId) });
  } catch (error) {
    console.error('Get applications error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/applications', verifyAuth, (req, res) => {
  const result = authService.addApplication(req.userId, req.body, getLang(req));
  return res.status(result.success ? 201 : 400).json(result);
});

router.patch('/applications/:id', verifyAuth, (req, res) => {
  const result = authService.updateApplication(req.userId, req.params.id, req.body, getLang(req));
  return res.status(result.success ? 200 : 400).json(result);
});

router.delete('/applications/:id', verifyAuth, (req, res) => {
  const result = authService.removeApplication(req.userId, req.params.id, getLang(req));
  return res.status(result.success ? 200 : 400).json(result);
});

// ==================== CHAT HISTORY ENDPOINTS ====================

/**
 * GET /api/chat-history
 * Получить историю чатов
 * Header: Authorization: Bearer <token>
 * Query: ?limit=50
 */
router.get('/chat-history', verifyAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = authService.getChatHistory(req.userId, Math.min(limit, 100));

    return res.json({
      success: true,
      count: history.length,
      messages: history
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat-history
 * Сохранить сообщение чата (внутренний endpoint для AI-сервиса)
 * Header: Authorization: Bearer <token>
 * Body: { message, response, context? }
 */
router.post('/chat-history', verifyAuth, (req, res) => {
  try {
    const { message, response, context } = req.body;
    const lang = getLang(req);

    if (!message || !response) {
      return res.status(400).json({ error: tr('auth_message_response_required', lang) || 'message и response обязательны' });
    }

    const saved = authService.saveChatMessage(req.userId, message, response, context);

    if (!saved) {
      return res.status(400).json({ error: tr('auth_save_error', lang) || 'Ошибка при сохранении' });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save chat message error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/chat-history/:id
 * Удалить сообщение из истории чатов
 */
router.delete('/chat-history/:id', verifyAuth, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const lang = getLang(req);
    if (!messageId) {
      return res.status(400).json({ error: tr('auth_invalid_msg_id', lang) || 'Некорректный ID сообщения' });
    }

    const result = authService.deleteChatMessage(req.userId, messageId, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete chat message error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

// ==================== TEST RESULTS ENDPOINTS ====================

/**
 * POST /api/auth/change-password
 * Сменить пароль
 * Header: Authorization: Bearer <token>
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', verifyAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const lang = getLang(req);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: tr('auth_current_new_pw_required', lang) || 'currentPassword и newPassword обязательны' });
    }

    const result = await authService.changePassword(req.userId, currentPassword, newPassword, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * GET /api/test-results
 * Получить результаты тестов
 * Header: Authorization: Bearer <token>
 * Query: ?testType=ent_calc&limit=20
 */
router.get('/test-results', verifyAuth, (req, res) => {
  try {
    const { testType } = req.query;
    const results = authService.getTestResults(req.userId, testType);

    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Get test results error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * POST /api/test-results
 * Сохранить результат теста
 * Header: Authorization: Bearer <token>
 * Body: { testType, score, maxScore, resultData? }
 */
router.post('/test-results', verifyAuth, (req, res) => {
  try {
    const { testType, score, maxScore, resultData } = req.body;
    const lang = getLang(req);

    if (!testType || score === undefined || !maxScore) {
      return res.status(400).json({
        error: tr('auth_test_fields_required', lang) || 'testType, score и maxScore обязательны'
      });
    }

    const saved = authService.saveTestResult(
      req.userId,
      testType,
      score,
      maxScore,
      resultData
    );

    if (!saved) {
      return res.status(400).json({ error: tr('auth_save_error', lang) || 'Ошибка при сохранении' });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save test result error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/test-results/:id
 * Удалить результат теста
 */
router.delete('/test-results/:id', verifyAuth, (req, res) => {
  try {
    const resultId = parseInt(req.params.id, 10);
    const lang = getLang(req);
    if (!resultId) {
      return res.status(400).json({ error: tr('auth_invalid_result_id', lang) || 'Некорректный ID результата' });
    }

    const result = authService.deleteTestResult(req.userId, resultId, lang);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete test result error:', error);
    const lang = getLang(req);
    return res.status(500).json({ error: tr('auth_server_error', lang) || 'Ошибка сервера' });
  }
});

module.exports = router;
