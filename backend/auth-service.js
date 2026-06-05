/**
 * auth-service.js - Authentication Business Logic
 * Функции для регистрации, входа, работы с токенами и профилем
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getDb } = require('./database');

// Получить JWT секрет из переменной окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Токен действует 7 дней
const BCRYPT_ROUNDS = 10; // Раунды хеширования пароля

// ============== РЕГИСТРАЦИЯ ==============

/**
 * Регистрация нового пользователя
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль (будет захеширован)
 * @param {string} username - Никнейм
 * @param {string} fullName - Полное имя (опционально)
 * @returns {object} - {success: true/false, user: {...}, error: "..."}
 */
async function registerUser(email, password, username, fullName = '') {
  try {
    // Проверить, не зарегистрирован ли уже
    const existingUser = getDb().prepare(
      'SELECT id FROM users WHERE email = ? OR username = ?'
    ).get(email, username);

    if (existingUser) {
      return {
        success: false,
        error: existingUser.email === email 
          ? 'Email уже зарегистрирован' 
          : 'Никнейм уже занят'
      };
    }

    // Валидация пароля
    if (password.length < 6) {
      return {
        success: false,
        error: 'Пароль должен быть не менее 6 символов'
      };
    }

    // Захешировать пароль
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Вставить пользователя
    const result = getDb().prepare(
      `INSERT INTO users (email, password_hash, username, full_name) 
       VALUES (?, ?, ?, ?)`
    ).run(email, passwordHash, username, fullName);

    // Получить созданного пользователя
    const user = getDb().prepare(
      'SELECT id, email, username, full_name FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    // Создать токен
    const token = generateToken(user.id);

    // Сохранить сессию
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    getDb().prepare(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt.toISOString());

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name
      },
      token
    };
  } catch (error) {
    console.error('Register error:', error);
    return {
      success: false,
      error: 'Ошибка при регистрации'
    };
  }
}

// ============== ВХОД ==============

/**
 * Вход пользователя
 * @param {string} email - Email
 * @param {string} password - Пароль
 * @returns {object} - {success: true/false, user: {...}, token: "..."}
 */
async function loginUser(email, password) {
  try {
    // Найти пользователя
    const user = getDb().prepare(
      'SELECT id, email, username, full_name, password_hash FROM users WHERE email = ?'
    ).get(email);

    if (!user) {
      return {
        success: false,
        error: 'Пользователь не найден'
      };
    }

    // Проверить пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Неверный пароль'
      };
    }

    // Создать токен
    const token = generateToken(user.id);

    // Сохранить сессию
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    getDb().prepare(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt.toISOString());

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name
      },
      token
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Ошибка при входе'
    };
  }
}

// ============== ТОКЕНЫ ==============

/**
 * Создать JWT токен
 * @param {number} userId - ID пользователя
 * @returns {string} - JWT токен
 */
function generateToken(userId) {
  return jwt.sign(
    { userId, jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Проверить JWT токен
 * @param {string} token - JWT токен
 * @returns {object} - {valid: true/false, userId: number, error: "..."}
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      valid: true,
      userId: decoded.userId
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Проверить, действителен ли токен в БД
 * @param {string} token - JWT токен
 * @returns {object} - {valid: true/false, userId: number}
 */
function validateSessionToken(token) {
  try {
    const session = getDb().prepare(
      'SELECT user_id, expires_at FROM user_sessions WHERE token = ?'
    ).get(token);

    if (!session) {
      return { valid: false };
    }

    if (new Date(session.expires_at) < new Date()) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: session.user_id
    };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Удалить токен (выход)
 * @param {string} token - JWT токен
 * @returns {boolean} - Успешно ли удалён
 */
function deleteToken(token) {
  try {
    getDb().prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
    return true;
  } catch (error) {
    console.error('Delete token error:', error);
    return false;
  }
}

// ============== ПРОФИЛЬ ==============

/**
 * Получить профиль пользователя
 * @param {number} userId - ID пользователя
 * @returns {object} - Профиль или null
 */
function getUserProfile(userId) {
  try {
    return getDb().prepare(
      `SELECT id, email, username, full_name, phone, profile_picture, bio, 
              preferences, created_at, updated_at 
       FROM users WHERE id = ?`
    ).get(userId);
  } catch (error) {
    console.error('Get profile error:', error);
    return null;
  }
}

/**
 * Обновить профиль пользователя
 * @param {number} userId - ID пользователя
 * @param {object} data - {fullName, phone, bio, preferences}
 * @returns {object} - {success: true/false, user: {...}, error: "..."}
 */
function updateUserProfile(userId, data) {
  try {
    const { fullName, phone, bio, preferences } = data;

    const preferencesJson = preferences ? JSON.stringify(preferences) : null;

    getDb().prepare(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           bio = COALESCE(?, bio),
           preferences = COALESCE(?, preferences),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(fullName, phone, bio, preferencesJson, userId);

    const updatedUser = getUserProfile(userId);

    return {
      success: true,
      user: updatedUser
    };
  } catch (error) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: 'Ошибка при обновлении профиля'
    };
  }
}

// ============== СОХРАНЁННЫЕ ВУЗЫ ==============

/**
 * Получить список сохранённых вузов
 * @param {number} userId - ID пользователя
 * @returns {array} - Список сохранённых вузов
 */
function getSavedUniversities(userId) {
  try {
    return getDb().prepare(
      `SELECT su.id, u.id as university_id, u.name, u.short_name, u.city_id, 
              u.price_from, u.price_to, u.website, su.note, su.saved_at
       FROM saved_universities su
       JOIN universities u ON su.university_id = u.id
       WHERE su.user_id = ?
       ORDER BY su.saved_at DESC`
    ).all(userId);
  } catch (error) {
    console.error('Get saved universities error:', error);
    return [];
  }
}

/**
 * Сохранить вуз
 * @param {number} userId - ID пользователя
 * @param {number} universityId - ID вуза
 * @param {string} note - Заметка (опционально)
 * @returns {object} - {success: true/false, error: "..."}
 */
function saveUniversity(userId, universityId, note = '') {
  try {
    // Проверить, не сохранён ли уже
    const existing = getDb().prepare(
      'SELECT id FROM saved_universities WHERE user_id = ? AND university_id = ?'
    ).get(userId, universityId);

    if (existing) {
      return {
        success: false,
        error: 'Вуз уже добавлен в избранное'
      };
    }

    // Вставить
    getDb().prepare(
      'INSERT INTO saved_universities (user_id, university_id, note) VALUES (?, ?, ?)'
    ).run(userId, universityId, note);

    return { success: true };
  } catch (error) {
    console.error('Save university error:', error);
    return {
      success: false,
      error: 'Ошибка при сохранении'
    };
  }
}

/**
 * Удалить сохранённый вуз
 * @param {number} userId - ID пользователя
 * @param {number} savedUniversityId - ID сохранённого вуза
 * @returns {object} - {success: true/false, error: "..."}
 */
function removeSavedUniversity(userId, savedUniversityId) {
  try {
    const result = getDb().prepare(
      'DELETE FROM saved_universities WHERE id = ? AND user_id = ?'
    ).run(savedUniversityId, userId);

    if (result.changes === 0) {
      return {
        success: false,
        error: 'Вуз не найден'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Remove saved university error:', error);
    return {
      success: false,
      error: 'Ошибка при удалении'
    };
  }
}

/**
 * Удалить сохранённый вуз по ID университета
 */
function removeSavedUniversityByUniversityId(userId, universityId) {
  try {
    const result = getDb().prepare(
      'DELETE FROM saved_universities WHERE university_id = ? AND user_id = ?'
    ).run(universityId, userId);

    if (result.changes === 0) {
      return { success: false, error: 'Вуз не найден в избранном' };
    }

    return { success: true };
  } catch (error) {
    console.error('Remove saved university by uni id error:', error);
    return { success: false, error: 'Ошибка при удалении' };
  }
}

/**
 * ID университетов в избранном пользователя
 */
function getSavedUniversityIds(userId) {
  try {
    return getDb().prepare(
      'SELECT university_id FROM saved_universities WHERE user_id = ?'
    ).all(userId).map(row => row.university_id);
  } catch (error) {
    console.error('Get saved university ids error:', error);
    return [];
  }
}

// ============== ИСТОРИЯ И РЕЗУЛЬТАТЫ ==============

/**
 * Сохранить сообщение чата
 * @param {number} userId - ID пользователя
 * @param {string} message - Сообщение пользователя
 * @param {string} response - Ответ ИИ
 * @param {object} context - Контекст запроса
 * @returns {boolean} - Успешно ли сохранено
 */
function saveChatMessage(userId, message, response, context = null) {
  try {
    const contextJson = context ? JSON.stringify(context) : null;
    getDb().prepare(
      'INSERT INTO chat_history (user_id, message, response, context) VALUES (?, ?, ?, ?)'
    ).run(userId, message, response, contextJson);
    return true;
  } catch (error) {
    console.error('Save chat message error:', error);
    return false;
  }
}

/**
 * Получить историю чатов
 * @param {number} userId - ID пользователя
 * @param {number} limit - Количество последних сообщений
 * @returns {array} - История чатов
 */
/**
 * Сменить пароль
 * @param {number} userId - ID пользователя
 * @param {string} currentPassword - Текущий пароль
 * @param {string} newPassword - Новый пароль
 * @returns {object} - {success: true/false, error: "..."}
 */
async function changePassword(userId, currentPassword, newPassword) {
  try {
    if (newPassword.length < 6) {
      return { success: false, error: 'Новый пароль должен быть не менее 6 символов' };
    }

    const user = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) return { success: false, error: 'Пользователь не найден' };

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return { success: false, error: 'Текущий пароль неверен' };

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Ошибка при смене пароля' };
  }
}

/**
 * Удалить результат теста
 * @param {number} userId - ID пользователя
 * @param {number} resultId - ID результата
 * @returns {object} - {success: true/false, error: "..."}
 */
function deleteTestResult(userId, resultId) {
  try {
    const result = getDb().prepare(
      'DELETE FROM test_results WHERE id = ? AND user_id = ?'
    ).run(resultId, userId);

    if (result.changes === 0) {
      return { success: false, error: 'Результат не найден' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete test result error:', error);
    return { success: false, error: 'Ошибка при удалении' };
  }
}

/**
 * Удалить сообщение из истории чатов
 * @param {number} userId - ID пользователя
 * @param {number} messageId - ID сообщения
 * @returns {object} - {success: true/false, error: "..."}
 */
function deleteChatMessage(userId, messageId) {
  try {
    const result = getDb().prepare(
      'DELETE FROM chat_history WHERE id = ? AND user_id = ?'
    ).run(messageId, userId);

    if (result.changes === 0) {
      return { success: false, error: 'Сообщение не найдено' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete chat message error:', error);
    return { success: false, error: 'Ошибка при удалении' };
  }
}

function getChatHistory(userId, limit = 50) {
  try {
    return getDb().prepare(
      `SELECT id, message, response, context, created_at
       FROM chat_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(userId, limit);
  } catch (error) {
    console.error('Get chat history error:', error);
    return [];
  }
}

/**
 * Сохранить результат теста
 * @param {number} userId - ID пользователя
 * @param {string} testType - Тип теста
 * @param {number} score - Баллы
 * @param {number} maxScore - Максимум баллов
 * @param {object} resultData - Результаты
 * @returns {boolean} - Успешно ли сохранено
 */
function saveTestResult(userId, testType, score, maxScore, resultData = null) {
  try {
    const resultDataJson = resultData ? JSON.stringify(resultData) : null;
    getDb().prepare(
      `INSERT INTO test_results (user_id, test_type, score, max_score, result_data)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, testType, score, maxScore, resultDataJson);
    return true;
  } catch (error) {
    console.error('Save test result error:', error);
    return false;
  }
}

/**
 * Получить результаты тестов
 * @param {number} userId - ID пользователя
 * @param {string} testType - Тип теста (опционально)
 * @returns {array} - Результаты тестов
 */
function getTestResults(userId, testType = null) {
  try {
    let query = 'SELECT * FROM test_results WHERE user_id = ?';
    let params = [userId];

    if (testType) {
      query += ' AND test_type = ?';
      params.push(testType);
    }

    query += ' ORDER BY created_at DESC LIMIT 20';

    return getDb().prepare(query).all(...params);
  } catch (error) {
    console.error('Get test results error:', error);
    return [];
  }
}

// ============== ЭКСПОРТ ==============

module.exports = {
  // Auth
  registerUser,
  loginUser,
  changePassword,
  
  // Tokens
  generateToken,
  verifyToken,
  validateSessionToken,
  deleteToken,
  
  // Profile
  getUserProfile,
  updateUserProfile,
  
  // Saved Universities
  getSavedUniversities,
  saveUniversity,
  removeSavedUniversity,
  removeSavedUniversityByUniversityId,
  getSavedUniversityIds,
  
  // Chat & Tests
  saveChatMessage,
  getChatHistory,
  deleteChatMessage,
  saveTestResult,
  getTestResults,
  deleteTestResult
};
