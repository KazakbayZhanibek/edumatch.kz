/* =============================================
   EDUMATCH KZ — AUTH (Phase 2)
   ============================================= */

const AUTH_TOKEN_KEY = 'edumatch_token';
const AUTH_USER_KEY = 'edumatch_user';

const Auth = {
  user: null,
  token: null,

  init() {
    this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    const saved = localStorage.getItem(AUTH_USER_KEY);
    if (saved) {
      try { this.user = JSON.parse(saved); } catch (e) { this.user = null; }
    }
    this.updateNavUI();
    if (this.token) this.verifySession();
  },

  isLoggedIn() {
    return Boolean(this.token && this.user);
  },

  getToken() {
    return this.token;
  },

  getHeaders(json = true) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  },

  async fetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...this.getHeaders(options.body != null), ...(options.headers || {}) }
    });
    return res;
  },

  async verifySession() {
    try {
      const res = await this.fetch('/auth/verify', { method: 'POST' });
      if (res.status === 401) { this.clearSession(); return false; }
      if (!res.ok) return false; // временная ошибка — не чистим токен
      const data = await res.json();
      this.user = data.user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.user));
      await this.syncFavoritesFromServer();
      this.updateNavUI();
      return true;
    } catch (e) {
      return false; // сеть недоступна — не чистим токен
    }
  },

  setSession(user, token) {
    this.user = user;
    this.token = token;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.updateNavUI();
  },

  clearSession() {
    this.user = null;
    this.token = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    this.updateNavUI();
  },

  async register({ email, password, username, fullName }) {
    const res = await this.fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullName: fullName || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
    this.setSession(data.user, data.token);
    await this.mergeLocalFavoritesToServer();
    return data;
  },

  async login(email, password) {
    const res = await this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    this.setSession(data.user, data.token);
    await this.mergeLocalFavoritesToServer();
    await this.syncFavoritesFromServer();
    return data;
  },

  async logout() {
    try {
      if (this.token) {
        await this.fetch('/auth/logout', { method: 'POST' });
      }
    } catch (e) { /* ignore */ }
    this.clearSession();
    navigate('home');
    showToast('Вы вышли из аккаунта');
  },

  async getProfile() {
    const res = await this.fetch('/users/profile');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки профиля');
    return data;
  },

  async updateProfile({ fullName, phone, bio, preferences }) {
    const body = { fullName, phone, bio };
    if (preferences) body.preferences = preferences;
    const res = await this.fetch('/users/profile', {
      method: 'PUT',
      body: JSON.stringify({ fullName, phone, bio })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
    if (data.user) {
      this.user = {
        ...this.user,
        fullName: data.user.full_name,
        email: data.user.email,
        username: data.user.username
      };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.user));
    }
    return data;
  },

  async syncFavoritesFromServer() {
    if (!this.isLoggedIn()) return;
    try {
      const res = await this.fetch('/saved-universities');
      const data = await res.json();
      if (data.success && Array.isArray(data.universities)) {
        state.favoriteList = data.universities.map(u => u.university_id);
        saveFavorites();
        document.querySelectorAll('[data-favorite-btn]').forEach(btn => {
          const id = parseInt(btn.dataset.favoriteBtn, 10);
          btn.classList.toggle('favorited', state.favoriteList.includes(id));
        });
      }
    } catch (e) {
      console.warn('Sync favorites failed', e);
    }
  },

  async mergeLocalFavoritesToServer() {
    if (!this.isLoggedIn()) return;
    const local = [...state.favoriteList];
    for (const uniId of local) {
      try {
        await this.fetch('/saved-universities', {
          method: 'POST',
          body: JSON.stringify({ universityId: uniId })
        });
      } catch (e) { /* already saved */ }
    }
  },

  async saveUniversity(universityId) {
    const res = await this.fetch('/saved-universities', {
      method: 'POST',
      body: JSON.stringify({ universityId })
    });
    const data = await res.json();
    if (!res.ok && !data.error?.includes('уже')) {
      throw new Error(data.error || 'Не удалось сохранить');
    }
    return data;
  },

  async removeUniversity(universityId) {
    const res = await this.fetch(`/saved-universities/university/${universityId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
    return data;
  },

  async getSavedUniversities() {
    const res = await this.fetch('/saved-universities');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
    return data.universities || [];
  },

  async getChatHistory(limit = 50) {
    const res = await this.fetch(`/chat-history?limit=${limit}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки истории');
    return data.messages || [];
  },

  async deleteChatMessage(messageId) {
    const res = await this.fetch(`/chat-history/${messageId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await this.fetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка смены пароля');
    return data;
  },

  async deleteTestResult(resultId) {
    const res = await this.fetch(`/test-results/${resultId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
    return data;
  },

  async getTestResults(testType) {
    const q = testType ? `?testType=${encodeURIComponent(testType)}` : '';
    const res = await this.fetch(`/test-results${q}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
    return data.results || [];
  },

  async saveTestResult(testType, score, maxScore, resultData) {
    const res = await this.fetch('/test-results', {
      method: 'POST',
      body: JSON.stringify({ testType, score, maxScore, resultData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
    return data;
  },

  updateNavUI() {
    const guest = document.getElementById('nav-auth-guest');
    const user = document.getElementById('nav-auth-user');
    const label = document.getElementById('nav-auth-username');
    if (!guest || !user) return;

    if (this.isLoggedIn()) {
      guest.style.display = 'none';
      user.style.display = 'flex';
      if (label) label.textContent = this.user.username || this.user.email;
    } else {
      guest.style.display = 'flex';
      user.style.display = 'none';
    }
  }
};

// ─── AUTH PAGES ───────────────────────────────

function handleRegister(e) {
  e.preventDefault();
  const err = document.getElementById('register-error');
  err.textContent = '';
  const btn = document.getElementById('register-submit');
  btn.disabled = true;

  Auth.register({
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    username: document.getElementById('reg-username').value.trim(),
    fullName: document.getElementById('reg-fullname').value.trim()
  })
    .then(() => {
      showToast('Аккаунт создан!', 'success');
      navigate('profile');
    })
    .catch(e => { err.textContent = e.message; })
    .finally(() => { btn.disabled = false; });
}

function handleLogin(e) {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  const btn = document.getElementById('login-submit');
  btn.disabled = true;

  Auth.login(
    document.getElementById('login-email').value.trim(),
    document.getElementById('login-password').value
  )
    .then(() => {
      showToast('Добро пожаловать!', 'success');
      const redirect = sessionStorage.getItem('auth_redirect') || 'home';
      sessionStorage.removeItem('auth_redirect');
      navigate(redirect);
    })
    .catch(e => { err.textContent = e.message; })
    .finally(() => { btn.disabled = false; });
}

async function loadProfilePage() {
  const content = document.getElementById('profile-content');
  if (!Auth.isLoggedIn()) {
    content.innerHTML = `
      <div class="auth-prompt">
        <p>Войдите или зарегистрируйтесь, чтобы сохранять вузы и историю.</p>
        <div class="auth-prompt-actions">
          <button class="btn btn-primary" onclick="navigate('login')">Войти</button>
          <button class="btn btn-ghost" onclick="navigate('register')">Регистрация</button>
        </div>
      </div>`;
    return;
  }

  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const profile = await Auth.getProfile();
    const saved = await Auth.getSavedUniversities();
    const chats = await Auth.getChatHistory(30);
    const tests = await Auth.getTestResults();

    content.innerHTML = `
      <div class="profile-grid">
        <section class="profile-card">
          <h2 class="profile-card-title">Профиль</h2>
          <form id="profile-form" class="auth-form" onsubmit="handleProfileSave(event)">
            <div class="form-field">
              <label>Email</label>
              <input type="email" value="${profile.email}" disabled class="form-input">
            </div>
            <div class="form-field">
              <label>Никнейм</label>
              <input type="text" value="${profile.username}" disabled class="form-input">
            </div>
            <div class="form-field">
              <label>Имя</label>
              <input type="text" id="profile-fullname" value="${profile.fullName || ''}" class="form-input" placeholder="Ваше имя">
            </div>
            <div class="form-field">
              <label>Телефон</label>
              <input type="tel" id="profile-phone" value="${profile.phone || ''}" class="form-input" placeholder="+7 ...">
            </div>
            <div class="form-field">
              <label>О себе</label>
              <textarea id="profile-bio" class="form-input" rows="3" placeholder="Кратко о целях поступления">${profile.bio || ''}</textarea>
            </div>
            <p class="form-error" id="profile-error"></p>
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </form>
          <button class="btn btn-ghost" style="margin-top:16px;width:100%" onclick="Auth.logout()">Выйти</button>
        </section>

        <section class="profile-card">
          <h2 class="profile-card-title">Смена пароля</h2>
          <form id="password-form" class="auth-form" onsubmit="handlePasswordChange(event)">
            <div class="form-field">
              <label>Текущий пароль</label>
              <input type="password" id="pw-current" class="form-input" required minlength="6">
            </div>
            <div class="form-field">
              <label>Новый пароль</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="pw-new" class="form-input" required minlength="6">
                <button type="button" class="pw-toggle" onclick="togglePW(this)" tabindex="-1" aria-label="Показать пароль">👁</button>
              </div>
            </div>
            <div class="form-field">
              <label>Подтвердите новый пароль</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="pw-confirm" class="form-input" required minlength="6">
                <button type="button" class="pw-toggle" onclick="togglePW(this)" tabindex="-1" aria-label="Показать пароль">👁</button>
              </div>
            </div>
            <p class="form-error" id="password-error"></p>
            <button type="submit" class="btn btn-primary">Сменить пароль</button>
          </form>
        </section>

        <section class="profile-card">
          <h2 class="profile-card-title">Сохранённые вузы <span class="profile-count">${saved.length}</span></h2>
          ${saved.length ? `
            <div class="profile-saved-list">
              ${saved.map(u => `
                <div class="profile-saved-item" data-uni-id="${u.university_id}">
                  <div>
                    <strong>${u.short_name || u.name}</strong>
                    <div class="profile-saved-meta">от ${fmtPrice(u.price_from)} тг/год</div>
                  </div>
                  <div class="profile-saved-actions">
                    <button class="btn btn-sm btn-ghost" onclick="navigate('university', ${u.university_id})">Открыть</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSavedUniversity(${u.university_id}, this)" title="Удалить">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="profile-empty">Пока нет сохранённых вузов. Нажмите ♥ на карточке.</p>'}
        </section>

        <section class="profile-card">
          <h2 class="profile-card-title">Настройки</h2>
          <form class="auth-form" onsubmit="handlePreferencesSave(event)">
            <div class="form-field">
              <label>Язык интерфейса</label>
              <select id="pref-lang" class="form-input">
                <option value="ru"${(profile.preferences && profile.preferences.language === 'ru') ? ' selected' : ''}>Русский</option>
                <option value="kk"${(profile.preferences && profile.preferences.language === 'kk') ? ' selected' : ''}>Қазақша</option>
                <option value="en"${(profile.preferences && profile.preferences.language === 'en') ? ' selected' : ''}>English</option>
              </select>
            </div>
            <p class="form-error" id="preferences-error"></p>
            <button type="submit" class="btn btn-primary">Сохранить настройки</button>
          </form>
        </section>

        <section class="profile-card profile-card-wide">
          <h2 class="profile-card-title">История ИИ-советника <span class="profile-count">${chats.length}</span></h2>
          ${chats.length ? `
            <div class="profile-chat-list">
              ${chats.slice(0, 15).map(c => `
                <div class="profile-chat-item" data-chat-id="${c.id}">
                  <button class="profile-chat-delete" onclick="deleteChatItem(${c.id}, this)" title="Удалить">✕</button>
                  <div class="profile-chat-q"><strong>Вы:</strong> ${escapeHtml(c.message.slice(0, 120))}${c.message.length > 120 ? '…' : ''}</div>
                  <div class="profile-chat-a">${escapeHtml(c.response.slice(0, 200))}${c.response.length > 200 ? '…' : ''}</div>
                  <div class="profile-chat-date">${formatDate(c.created_at)}</div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="profile-empty">Задайте вопрос в разделе «ИИ-советник» — история сохранится автоматически.</p>'}
        </section>

        <section class="profile-card profile-card-wide">
          <h2 class="profile-card-title">Результаты тестов <span class="profile-count">${tests.length}</span></h2>
          ${tests.length ? `
            <div class="profile-tests-list">
              ${tests.map(t => {
                const data = t.result_data ? JSON.parse(t.result_data) : {};
                const label = TEST_TYPE_LABELS[t.test_type] || t.test_type;
                return `
                  <div class="profile-test-item">
                    <button class="profile-chat-delete" onclick="deleteTestResultItem(${t.id}, this)" title="Удалить">✕</button>
                    <div class="profile-test-type">${label}</div>
                    <div class="profile-test-score">${t.score}${t.max_score ? ` / ${t.max_score}` : ''}</div>
                    ${data.summary ? `<div class="profile-test-meta">${escapeHtml(data.summary)}</div>` : ''}
                    <div class="profile-chat-date">${formatDate(t.created_at)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<p class="profile-empty">Пройдите ЕНТ-калькулятор или профориентацию — результаты появятся здесь.</p>'}
        </section>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

async function deleteSavedUniversity(uniId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.removeUniversity(uniId);
    const item = btn.closest('.profile-saved-item');
    item.remove();
    const countEl = document.querySelector('.profile-grid > section:nth-child(3) .profile-count');
    if (countEl) {
      const n = parseInt(countEl.textContent) - 1;
      countEl.textContent = n;
      const list = document.querySelector('.profile-saved-list');
      if (n === 0 && list) {
        list.outerHTML = '<p class="profile-empty">Пока нет сохранённых вузов. Нажмите ♥ на карточке.</p>';
      }
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✕';
  }
}

async function deleteChatItem(msgId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.deleteChatMessage(msgId);
    const item = btn.closest('.profile-chat-item');
    item.remove();
    const list = document.querySelector('.profile-chat-list');
    const countEl = document.querySelector('.profile-grid > section:nth-child(5) .profile-count');
    if (countEl) {
      const n = parseInt(countEl.textContent) - 1;
      countEl.textContent = n;
      if (n === 0 && list) {
        list.outerHTML = '<p class="profile-empty">Задайте вопрос в разделе «ИИ-советник» — история сохранится автоматически.</p>';
      }
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✕';
  }
}

async function deleteTestResultItem(resultId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.deleteTestResult(resultId);
    const item = btn.closest('.profile-test-item');
    item.remove();
    const list = document.querySelector('.profile-tests-list');
    const countEl = document.querySelector('.profile-grid > section:nth-child(6) .profile-count');
    if (countEl) {
      const n = parseInt(countEl.textContent) - 1;
      countEl.textContent = n;
      if (n === 0 && list) {
        list.outerHTML = '<p class="profile-empty">Пройдите ЕНТ-калькулятор или профориентацию — результаты появятся здесь.</p>';
      }
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✕';
  }
}

function handlePasswordChange(e) {
  e.preventDefault();
  const err = document.getElementById('password-error');
  err.textContent = '';
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (newPw !== confirm) { err.textContent = 'Пароли не совпадают'; return; }
  Auth.changePassword(current, newPw)
    .then(() => {
      showToast('Пароль изменён', 'success');
      document.getElementById('password-form').reset();
    })
    .catch(e => { err.textContent = e.message; });
}

function handlePreferencesSave(e) {
  e.preventDefault();
  const err = document.getElementById('preferences-error');
  err.textContent = '';
  const language = document.getElementById('pref-lang').value;
  Auth.updateProfile({
    fullName: document.getElementById('profile-fullname').value.trim(),
    phone: document.getElementById('profile-phone').value.trim(),
    bio: document.getElementById('profile-bio').value.trim(),
    preferences: { language }
  })
    .then(() => showToast('Настройки сохранены', 'success'))
    .catch(e => { err.textContent = e.message; });
}

const TEST_TYPE_LABELS = {
  ent_calc: 'ЕНТ-калькулятор',
  career_test: 'Профориентация',
  admission_predict: 'Прогноз поступления',
};

function handleProfileSave(e) {
  e.preventDefault();
  const err = document.getElementById('profile-error');
  err.textContent = '';
  Auth.updateProfile({
    fullName: document.getElementById('profile-fullname').value.trim(),
    phone: document.getElementById('profile-phone').value.trim(),
    bio: document.getElementById('profile-bio').value.trim()
  })
    .then(() => showToast('Профиль сохранён', 'success'))
    .catch(e => { err.textContent = e.message; });
}

function togglePW(btn) {
  const input = btn.previousElementSibling;
  const isPW = input.type === 'password';
  input.type = isPW ? 'text' : 'password';
  btn.textContent = isPW ? '🙈' : '👁';
  btn.setAttribute('aria-label', isPW ? 'Скрыть пароль' : 'Показать пароль');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

function requireAuth(targetPage) {
  if (!Auth.isLoggedIn()) {
    sessionStorage.setItem('auth_redirect', targetPage || 'profile');
    showToast('Войдите в аккаунт');
    navigate('login');
    return false;
  }
  return true;
}
