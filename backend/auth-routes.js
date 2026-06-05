/**
 * auth-routes.js - Authentication API Routes
 * Все endpoints для регистрации, входа, профиля, сохранённых вузов и т.д.
 */

const express = require('express');
const router = express.Router();
const authService = require('./auth-service');
const { verifyAuth } = require('./auth-middleware');

// ==================== AUTH ENDPOINTS ====================

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 * Body: { email, password, username, fullName? }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, fullName } = req.body;

    // Валидация
    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Email, пароль и никнейм обязательны'
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Неверный формат email'
      });
    }

    // Валидация username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: 'Никнейм должен быть от 3 до 20 символов'
      });
    }

    const result = await authService.registerUser(email, password, username, fullName);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/auth/login
 * Вход пользователя
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email и пароль обязательны'
      });
    }

    const result = await authService.loginUser(email, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    return res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/auth/logout
 * Выход пользователя
 * Header: Authorization: Bearer <token>
 */
router.post('/logout', verifyAuth, (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({ error: 'Токен не найден' });
    }

    const deleted = authService.deleteToken(token);

    if (!deleted) {
      return res.status(400).json({ error: 'Ошибка при выходе' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
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
    const user = authService.getUserProfile(userId);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    return res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
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
    const user = authService.getUserProfile(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      phone: user.phone,
      bio: user.bio,
      preferences: user.preferences ? JSON.parse(user.preferences) : {},
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PUT /api/users/profile
 * Обновить профиль
 * Header: Authorization: Bearer <token>
 * Body: { fullName?, phone?, bio?, preferences? }
 */
router.put('/profile', verifyAuth, (req, res) => {
  try {
    const { fullName, phone, bio, preferences } = req.body;

    const result = authService.updateUserProfile(req.userId, {
      fullName,
      phone,
      bio,
      preferences
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
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
    return res.status(500).json({ error: 'Ошибка сервера' });
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

    if (!universityId) {
      return res.status(400).json({ error: 'universityId обязателен' });
    }

    const result = authService.saveUniversity(req.userId, universityId, note);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save university error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/saved-universities/:id
 * Удалить сохранённый вуз (по ID записи)
 */
router.delete('/saved-universities/:id', verifyAuth, (req, res) => {
  try {
    const result = authService.removeSavedUniversity(req.userId, req.params.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove saved university error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/saved-universities/university/:universityId
 * Удалить из избранного по ID вуза
 */
router.delete('/saved-universities/university/:universityId', verifyAuth, (req, res) => {
  try {
    const universityId = parseInt(req.params.universityId, 10);
    if (!universityId) {
      return res.status(400).json({ error: 'Некорректный ID вуза' });
    }

    const result = authService.removeSavedUniversityByUniversityId(req.userId, universityId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove saved university by uni id error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
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
    return res.status(500).json({ error: 'Ошибка сервера' });
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

    if (!message || !response) {
      return res.status(400).json({ error: 'message и response обязательны' });
    }

    const saved = authService.saveChatMessage(req.userId, message, response, context);

    if (!saved) {
      return res.status(400).json({ error: 'Ошибка при сохранении' });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save chat message error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/chat-history/:id
 * Удалить сообщение из истории чатов
 */
router.delete('/chat-history/:id', verifyAuth, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!messageId) {
      return res.status(400).json({ error: 'Некорректный ID сообщения' });
    }

    const result = authService.deleteChatMessage(req.userId, messageId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete chat message error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
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

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword и newPassword обязательны' });
    }

    const result = await authService.changePassword(req.userId, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
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
    return res.status(500).json({ error: 'Ошибка сервера' });
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

    if (!testType || score === undefined || !maxScore) {
      return res.status(400).json({
        error: 'testType, score и maxScore обязательны'
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
      return res.status(400).json({ error: 'Ошибка при сохранении' });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save test result error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/test-results/:id
 * Удалить результат теста
 */
router.delete('/test-results/:id', verifyAuth, (req, res) => {
  try {
    const resultId = parseInt(req.params.id, 10);
    if (!resultId) {
      return res.status(400).json({ error: 'Некорректный ID результата' });
    }

    const result = authService.deleteTestResult(req.userId, resultId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete test result error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
