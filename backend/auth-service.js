/**
 * auth-service.js - Authentication Business Logic
 * Функции для регистрации, входа, работы с токенами и профилем
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getDb } = require('./database');
const { tr } = require('./i18n');

// Получить JWT секрет из переменной окружения
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('CRITICAL: JWT_SECRET must be set in .env with minimum 32 characters');
}
const JWT_EXPIRES_IN = '7d'; // Токен действует 7 дней
const BCRYPT_ROUNDS = 10; // Раунды хеширования пароля

// ============== ВАЛИДАЦИЯ ПАРОЛЯ ==============
function validatePassword(password) {
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain digit' };
  }
  if (!/[!@#$%^&*\-_=+]/.test(password)) {
    return { valid: false, error: 'Password must contain special character (!@#$%^&*-_=+)' };
  }
  return { valid: true };
}

// ============== ВАЛИДАЦИЯ EMAIL ==============
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// ============== РЕГИСТРАЦИЯ ==============

/**
 * Регистрация нового пользователя
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль (будет захеширован)
 * @param {string} username - Никнейм
 * @param {string} fullName - Полное имя (опционально)
 * @returns {object} - {success: true/false, user: {...}, error: "..."}
 */
async function registerUser(email, password, username, fullName = '', lang = 'ru') {
  try {
    // Проверить, не зарегистрирован ли уже
    const existingUser = getDb().prepare(
      'SELECT id, email FROM users WHERE lower(email) = lower(?) OR username = ?'
    ).get(email, username);

    if (existingUser) {
      return {
        success: false,
        error: existingUser.email === email 
          ? (tr('auth_email_taken', lang) || 'Email уже зарегистрирован')
          : (tr('auth_username_taken', lang) || 'Никнейм уже занят')
      };
    }

    // Валидация email
    if (!validateEmail(email)) {
      return {
        success: false,
        error: tr('auth_invalid_email', lang) || 'Invalid email format'
      };
    }

    // Валидация пароля
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: tr('auth_password_weak', lang) || passwordValidation.error
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
    const safeError = {
      message: error.message || 'Unknown error',
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
    console.error('Register error:', safeError);
    return {
      success: false,
      error: tr('auth_register_error', lang) || 'Ошибка при регистрации'
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
async function loginUser(email, password, lang = 'ru') {
  try {
    // Найти пользователя
    const user = getDb().prepare(
      'SELECT id, email, username, full_name, password_hash FROM users WHERE email = ?'
    ).get(email);

    if (!user) {
      return {
        success: false,
        error: tr('auth_user_not_found', lang) || 'Пользователь не найден'
      };
    }

    // Проверить пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return {
        success: false,
        error: tr('auth_wrong_password', lang) || 'Неверный пароль'
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
    const safeError = {
      message: error.message || 'Unknown error',
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
    console.error('Login error:', safeError);
    return {
      success: false,
      error: tr('auth_login_error', lang) || 'Ошибка при входе'
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
              ent_score, ent_verified_score, ent_verified_at, military_service,
              preferences, is_admin, created_at, updated_at 
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
 * @param {object} data - {fullName, phone, bio, preferences, profilePicture}
 * @returns {object} - {success: true/false, user: {...}, error: "..."}
 */
function updateUserProfile(userId, data, lang = 'ru') {
  try {
    const { fullName, phone, bio, entScore, preferences, profilePicture } = data;

    if (entScore !== undefined && entScore !== null && (!Number.isInteger(entScore) || entScore < 0 || entScore > 140)) {
      return { success: false, error: 'Балл ЕНТ должен быть целым числом от 0 до 140' };
    }
    for (const [value, limit] of [[fullName, 150], [phone, 40], [bio, 2000]]) {
      if (value != null && (typeof value !== 'string' || value.length > limit)) return { success: false, error: 'Проверьте поля профиля и длину текста' };
    }
    if (preferences != null && (typeof preferences !== 'object' || Array.isArray(preferences))) return { success: false, error: 'Некорректные настройки профиля' };

    const preferencesJson = preferences ? JSON.stringify(preferences) : null;

    const db = getDb();
    db.transaction(() => {
    if (entScore !== undefined) {
      db.prepare(`UPDATE users SET ent_verified_score = CASE WHEN ent_score IS ? THEN ent_verified_score ELSE NULL END,
        ent_verified_at = CASE WHEN ent_score IS ? THEN ent_verified_at ELSE NULL END, ent_score = ? WHERE id = ?`)
        .run(entScore, entScore, entScore, userId);
    }
    db.prepare(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           bio = COALESCE(?, bio),
           preferences = COALESCE(?, preferences),
              profile_picture = COALESCE(?, profile_picture),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
            ).run(fullName ?? null, phone ?? null, bio ?? null, preferencesJson, profilePicture ?? null, userId);
    })();

    const updatedUser = getUserProfile(userId);

    return {
      success: true,
      user: updatedUser
    };
  } catch (error) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: tr('auth_profile_update_error', lang) || 'Ошибка при обновлении профиля'
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
function saveUniversity(userId, universityId, note = '', lang = 'ru') {
  try {
    // Проверить, не сохранён ли уже
    const existing = getDb().prepare(
      'SELECT id FROM saved_universities WHERE user_id = ? AND university_id = ?'
    ).get(userId, universityId);

    if (existing) {
      return {
        success: false,
        error: tr('auth_uni_already_saved', lang) || 'Вуз уже добавлен в избранное'
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
      error: tr('auth_save_error', lang) || 'Ошибка при сохранении'
    };
  }
}

/**
 * Удалить сохранённый вуз
 * @param {number} userId - ID пользователя
 * @param {number} savedUniversityId - ID сохранённого вуза
 * @returns {object} - {success: true/false, error: "..."}
 */
function removeSavedUniversity(userId, savedUniversityId, lang = 'ru') {
  try {
    const result = getDb().prepare(
      'DELETE FROM saved_universities WHERE id = ? AND user_id = ?'
    ).run(savedUniversityId, userId);

    if (result.changes === 0) {
      return {
        success: false,
        error: tr('auth_uni_not_found', lang) || 'Вуз не найден'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Remove saved university error:', error);
    return {
      success: false,
      error: tr('auth_delete_error', lang) || 'Ошибка при удалении'
    };
  }
}

/**
 * Удалить сохранённый вуз по ID университета
 */
function removeSavedUniversityByUniversityId(userId, universityId, lang = 'ru') {
  try {
    const result = getDb().prepare(
      'DELETE FROM saved_universities WHERE university_id = ? AND user_id = ?'
    ).run(universityId, userId);

    if (result.changes === 0) {
      return { success: false, error: tr('auth_uni_not_in_fav', lang) || 'Вуз не найден в избранном' };
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

// ============== ЗАЯВКИ ПОЛЬЗОВАТЕЛЯ ==============

const APPLICATION_STATUSES = ['collecting', 'submitted', 'waiting', 'accepted', 'enrolled', 'rejected'];

function getApplications(userId) {
  try {
    return getDb().prepare(`
      SELECT a.id, a.university_id, u.name, u.short_name, u.city_id, u.website,
             a.status, a.academic_year, a.deadline, a.submitted_at,
             a.notes, a.created_at, a.updated_at
      FROM application_tracker a
      JOIN universities u ON u.id = a.university_id
      WHERE a.user_id = ?
      ORDER BY CASE a.status WHEN 'waiting' THEN 1 WHEN 'collecting' THEN 2 WHEN 'submitted' THEN 3 ELSE 4 END, a.updated_at DESC
    `).all(userId);
  } catch (error) {
    console.error('Get applications error:', error);
    return [];
  }
}

function addApplication(userId, data = {}, lang = 'ru') {
  const universityId = Number.parseInt(data.universityId, 10);
  const status = APPLICATION_STATUSES.includes(data.status) ? data.status : 'collecting';
  const academicYear = String(data.academicYear || '2025-2026').slice(0, 20);
  const notes = String(data.notes || '').slice(0, 2000);
  if (!Number.isInteger(universityId) || universityId < 1) return { success: false, error: 'Некорректный ID вуза' };

  try {
    const db = getDb();
    if (!db.prepare('SELECT id FROM universities WHERE id = ?').get(universityId)) {
      return { success: false, error: 'Вуз не найден' };
    }
    const existing = db.prepare('SELECT id FROM application_tracker WHERE user_id = ? AND university_id = ?').get(userId, universityId);
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
    const result = db.prepare(`INSERT INTO application_tracker
      (user_id, university_id, status, academic_year, deadline, submitted_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        userId, universityId, status, academicYear, data.deadline || null,
        data.submittedAt || null, notes
      );
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('Add application error:', error);
    return { success: false, error: tr('auth_save_error', lang) || 'Ошибка при сохранении' };
  }
}

function updateApplication(userId, applicationId, data = {}, lang = 'ru') {
  const id = Number.parseInt(applicationId, 10);
  if (!Number.isInteger(id) || id < 1) return { success: false, error: 'Некорректный ID заявки' };
  const fields = [];
  const values = [];
  if (data.status !== undefined) {
    if (!APPLICATION_STATUSES.includes(data.status)) return { success: false, error: 'Некорректный статус' };
    fields.push('status = ?'); values.push(data.status);
  }
  if (data.academicYear !== undefined) { fields.push('academic_year = ?'); values.push(String(data.academicYear).slice(0, 20)); }
  if (data.deadline !== undefined) { fields.push('deadline = ?'); values.push(data.deadline || null); }
  if (data.submittedAt !== undefined) { fields.push('submitted_at = ?'); values.push(data.submittedAt || null); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(String(data.notes).slice(0, 2000)); }
  if (!fields.length) return { success: false, error: 'Нет данных для обновления' };
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userId);
  try {
    const result = getDb().prepare(`UPDATE application_tracker SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    return result.changes ? { success: true } : { success: false, error: 'Заявка не найдена' };
  } catch (error) {
    console.error('Update application error:', error);
    return { success: false, error: tr('auth_save_error', lang) || 'Ошибка при сохранении' };
  }
}

function removeApplication(userId, applicationId, lang = 'ru') {
  try {
    const result = getDb().prepare('DELETE FROM application_tracker WHERE id = ? AND user_id = ?').run(applicationId, userId);
    return result.changes ? { success: true } : { success: false, error: 'Заявка не найдена' };
  } catch (error) {
    console.error('Remove application error:', error);
    return { success: false, error: tr('auth_delete_error', lang) || 'Ошибка при удалении' };
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
    const duplicate = getDb().prepare(
      `SELECT id FROM chat_history
       WHERE user_id = ? AND message = ? AND response = ?
         AND created_at >= datetime('now', '-10 minutes')
       LIMIT 1`
    ).get(userId, message, response);
    if (duplicate) return true;

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
async function changePassword(userId, currentPassword, newPassword, lang = 'ru') {
  try {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: tr('auth_password_weak', lang) || passwordValidation.error };
    }

    const user = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) return { success: false, error: tr('auth_user_not_found', lang) || 'Пользователь не найден' };

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return { success: false, error: tr('auth_current_pw_wrong', lang) || 'Текущий пароль неверен' };

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: tr('auth_pw_change_error', lang) || 'Ошибка при смене пароля' };
  }
}

/**
 * Удалить результат теста
 * @param {number} userId - ID пользователя
 * @param {number} resultId - ID результата
 * @returns {object} - {success: true/false, error: "..."}
 */
function deleteTestResult(userId, resultId, lang = 'ru') {
  try {
    const result = getDb().prepare(
      'DELETE FROM test_results WHERE id = ? AND user_id = ?'
    ).run(resultId, userId);

    if (result.changes === 0) {
      return { success: false, error: tr('auth_result_not_found', lang) || 'Результат не найден' };
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
function deleteChatMessage(userId, messageId, lang = 'ru') {
  try {
    const result = getDb().prepare(
      'DELETE FROM chat_history WHERE id = ? AND user_id = ?'
    ).run(messageId, userId);

    if (result.changes === 0) {
      return { success: false, error: tr('auth_msg_not_found', lang) || 'Сообщение не найдено' };
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
    const duplicate = getDb().prepare(
      `SELECT id FROM test_results
       WHERE user_id = ? AND test_type = ? AND score = ? AND max_score = ?
         AND COALESCE(result_data, '') = COALESCE(?, '')
         AND created_at >= datetime('now', '-10 minutes')
       LIMIT 1`
    ).get(userId, testType, score, maxScore, resultDataJson);
    if (duplicate) return true;

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

  // Applications
  getApplications,
  addApplication,
  updateApplication,
  removeApplication,
  
  // Chat & Tests
  saveChatMessage,
  getChatHistory,
  deleteChatMessage,
  saveTestResult,
  getTestResults,
  deleteTestResult
};
