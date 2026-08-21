/* =============================================
   EDUMATCH KZ — AUTH (Phase 2)
   ============================================= */

// ВАЖНО: JWT токены НЕ хранятся в localStorage (XSS уязвимость).
// Вместо этого используются httpOnly cookies, которые автоматически отправляются с запросами.
// Frontend никогда не читает/пишет токен из JS - это делает браузер автоматически.

const AUTH_USER_KEY = 'edumatch_user';

const Auth = {
  user: null,

  init() {
    const saved = localStorage.getItem(AUTH_USER_KEY);
    if (saved) {
      try { this.user = JSON.parse(saved); } catch (e) { this.user = null; }
    }
    this.updateNavUI();
    if (this.user) this.verifySession();
  },

  isLoggedIn() {
    return Boolean(this.user);
  },

  getHeaders(json = true) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async fetch(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
    try {
      const res = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...this.getHeaders(options.body != null), ...(options.headers || {}) },
        credentials: 'include', // автоматически отправляет httpOnly cookies
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
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

  setSession(user) {
    this.user = user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.updateNavUI();
  },

  clearSession() {
    this.user = null;
    localStorage.removeItem(AUTH_USER_KEY);
    this.updateNavUI();
  },

  async register({ email, password, username, fullName }) {
    const res = await this.fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullName: fullName || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_register'));
    this.setSession(data.user);
    await this.mergeLocalFavoritesToServer();
    return data;
  },

  async login(email, password) {
    const res = await this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_login'));
    this.setSession(data.user);
    await this.mergeLocalFavoritesToServer();
    await this.syncFavoritesFromServer();
    return data;
  },

  async logout() {
    try {
      if (this.user) {
        await this.fetch('/auth/logout', { method: 'POST' });
      }
    } catch (e) { /* ignore */ }
    this.clearSession();
    navigate('home');
    showToast(t('profile_page.toast_logout'));
  },

  async getProfile() {
    const res = await this.fetch('/users/profile');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_profile_load'));
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
    if (!res.ok) throw new Error(data.error || t('profile_page.err_profile_save'));
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
      throw new Error(data.error || t('profile_page.err_save'));
    }
    return data;
  },

  async removeUniversity(universityId) {
    const res = await this.fetch(`/saved-universities/university/${universityId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_delete'));
    return data;
  },

  async getSavedUniversities() {
    const res = await this.fetch('/saved-universities');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_load'));
    return data.universities || [];
  },

  async getChatHistory(limit = 50) {
    const res = await this.fetch(`/chat-history?limit=${limit}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_chat_load'));
    return data.messages || [];
  },

  async deleteChatMessage(messageId) {
    const res = await this.fetch(`/chat-history/${messageId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_delete'));
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await this.fetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_pw_change'));
    return data;
  },

  async deleteTestResult(resultId) {
    const res = await this.fetch(`/test-results/${resultId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_delete'));
    return data;
  },

  async getTestResults(testType) {
    const q = testType ? `?testType=${encodeURIComponent(testType)}` : '';
    const res = await this.fetch(`/test-results${q}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_load'));
    return data.results || [];
  },

  async saveTestResult(testType, score, maxScore, resultData) {
    const res = await this.fetch('/test-results', {
      method: 'POST',
      body: JSON.stringify({ testType, score, maxScore, resultData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_profile_save'));
    return data;
  },

  updateNavUI() {
    const guest = document.getElementById('nav-auth-guest');
    const user = document.getElementById('nav-auth-user');
    const label = document.getElementById('nav-auth-username');
    const profileSheet = document.getElementById('more-sheet-profile');
    const loginSheet = document.getElementById('more-sheet-login');
    const logoutSheet = document.getElementById('more-sheet-logout');

    if (!guest || !user) return;

    if (this.isLoggedIn()) {
      guest.style.display = 'none';
      user.style.display = 'flex';
      if (label) label.textContent = this.user.username || this.user.email;
      if (profileSheet) profileSheet.style.display = 'flex';
      if (logoutSheet) logoutSheet.style.display = 'flex';
      if (loginSheet) loginSheet.style.display = 'none';
    } else {
      guest.style.display = 'flex';
      user.style.display = 'none';
      if (profileSheet) profileSheet.style.display = 'none';
      if (logoutSheet) logoutSheet.style.display = 'none';
      if (loginSheet) loginSheet.style.display = 'flex';
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
      showToast(t('profile_page.toast_registered'), 'success');
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
      showToast(t('profile_page.toast_welcome'), 'success');
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
        <div class="auth-prompt-icon" aria-hidden="true"></div>
        <div class="auth-prompt-title">${t('profile_page.auth_prompt') || 'Войдите в аккаунт'}</div>
        <div class="auth-prompt-desc">${t('profile_page.auth_prompt_desc') || 'Чтобы видеть избранные вузы, историю ИИ-советника и результаты тестов'}</div>
        <div class="auth-prompt-actions">
          <button class="btn btn-primary" onclick="navigate('login')">${t('profile_page.login_btn')}</button>
          <button class="btn btn-ghost" onclick="navigate('register')">${t('profile_page.register_btn')}</button>
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

    const initials = (profile.fullName || profile.username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const displayName = profile.fullName || profile.username;
    const bioText = profile.bio || t('profile_page.card_bio_placeholder') || 'Расскажите о себе...';

    content.innerHTML = `
      <div class="profile-layout">

        <!-- LEFT: User Card -->
        <aside class="profile-user-card">
          <div class="profile-user-banner" onclick="showToast(t('profile_page.avatar_soon') || 'Загрузка фото скоро появится')" title="${t('profile_page.avatar_change') || 'Изменить обложку'}"></div>
          <div class="profile-user-avatar" onclick="showToast(t('profile_page.avatar_soon') || 'Загрузка фото скоро появится')" title="${t('profile_page.avatar_change') || 'Изменить фото'}">${initials}</div>
          <div class="profile-user-info">
            <div class="profile-user-name">${escapeHtml(displayName)}</div>
            <div class="profile-user-email">${escapeHtml(profile.email)}</div>
            ${profile.bio ? `<div class="profile-user-bio">${escapeHtml(profile.bio)}</div>` : ''}
          </div>
          <div class="profile-stats">
            <div class="profile-stat">
              <div class="profile-stat-num">${saved.length}</div>
              <div class="profile-stat-label">${t('profile_page.card_saved_title') || 'Вузы'}</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat-num">${chats.length}</div>
              <div class="profile-stat-label">${t('profile_page.card_ai_title') || 'Диалоги'}</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat-num">${tests.length}</div>
              <div class="profile-stat-label">${t('profile_page.card_tests_title') || 'Тесты'}</div>
            </div>
          </div>
          <div class="profile-sidebar-actions">
            <button class="btn btn-ghost btn-sm" onclick="Auth.logout()">
              ${t('profile_page.card_logout') || 'Выйти'}
            </button>
          </div>
        </aside>

        <!-- RIGHT: Main Content -->
        <div class="profile-main">

          <!-- Edit Profile -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_profile') || 'Редактировать профиль'}</h2>
            </div>
            <form id="profile-form" class="auth-form" onsubmit="handleProfileSave(event)">
              <div class="profile-form-row">
                <div class="form-field">
                  <label>${t('profile_page.card_name') || 'Имя'}</label>
                  <input type="text" id="profile-fullname" value="${escapeHtml(profile.fullName || '')}" class="form-input" placeholder="${t('profile_page.card_name_placeholder') || 'Ваше имя'}">
                </div>
                <div class="form-field">
                  <label>${t('profile_page.card_phone') || 'Телефон'}</label>
                  <input type="tel" id="profile-phone" value="${escapeHtml(profile.phone || '')}" class="form-input" placeholder="+7 (___) ___-__-__" oninput="formatPhoneInput(this)">
                </div>
              </div>
              <div class="form-field">
                <label>${t('profile_page.card_bio') || 'О себе'}</label>
                <textarea id="profile-bio" class="form-input" rows="2" maxlength="300" oninput="document.getElementById('profile-bio-count').textContent = this.value.length" placeholder="${t('profile_page.card_bio_placeholder') || 'Расскажите о себе...'}">${escapeHtml(profile.bio || '')}</textarea>
                <div class="form-hint" style="text-align:right;font-size:12px;color:var(--text-muted,#888)"><span id="profile-bio-count">${(profile.bio || '').length}</span>/300</div>
              </div>
              <p class="form-error" id="profile-error"></p>
              <div class="profile-form-actions">
                <button type="submit" class="btn btn-primary">${t('profile_page.card_save') || 'Сохранить'}</button>
              </div>
            </form>
          </section>

          <!-- Saved Universities -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_saved_title') || 'Сохранённые вузы'}</h2>
              <span class="profile-section-badge" id="saved-badge">${saved.length}</span>
            </div>
            ${saved.length ? `
              <div class="profile-saved-grid">
                ${saved.map(u => `
                  <div class="profile-saved-card" onclick="navigate('university', ${u.university_id})">
                    <div class="profile-saved-icon">${(u.short_name || u.name || '?')[0]}</div>
                    <div class="profile-saved-details">
                      <div class="profile-saved-name">${escapeHtml(u.short_name || u.name)}</div>
                      <div class="profile-saved-price">от ${fmtPrice(u.price_from)} тг/год</div>
                    </div>
                    <button class="profile-saved-remove" onclick="event.stopPropagation(); deleteSavedUniversity(${u.university_id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">×</button>
                  </div>
                `).join('')}
              </div>
            ` : `<div class="profile-empty"><div class="profile-empty-icon"></div>${t('profile_page.card_saved_empty') || 'Нет сохранённых вузов'}</div>`}
          </section>

          <!-- Application Tracker -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('tracker.title') || 'Мои заявки'}</h2>
              <span class="profile-section-badge" id="tracker-count"></span>
            </div>
            <div id="profile-tracker-content"></div>
          </section>

          <!-- Password Change -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_password_title') || 'Смена пароля'}</h2>
            </div>
            <form id="password-form" class="auth-form" onsubmit="handlePasswordChange(event)">
              <div class="profile-pw-fields">
                <div class="form-field">
                  <label>${t('profile_page.card_pw_current') || 'Текущий пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-current" class="form-input" required minlength="1">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" tabindex="-1" aria-label="Показать пароль">Показать</button>
                  </div>
                </div>
                <div class="form-field">
                  <label>${t('profile_page.card_pw_new') || 'Новый пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-new" class="form-input" required minlength="12"
                      pattern="(?=.*[A-ZА-Я])(?=.*\d)(?=.*[^A-Za-zА-Яа-я0-9]).{12,}"
                      oninput="updatePasswordHints('pw-new','pw-new-hints')">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" tabindex="-1" aria-label="Показать пароль">Показать</button>
                  </div>
                  <ul class="pw-hints" id="pw-new-hints">
                    <li data-rule="len">Минимум 12 символов</li>
                    <li data-rule="upper">Заглавная буква</li>
                    <li data-rule="digit">Цифра</li>
                    <li data-rule="special">Спецсимвол</li>
                  </ul>
                </div>
                <div class="form-field">
                  <label>${t('profile_page.card_pw_confirm') || 'Подтвердите пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-confirm" class="form-input" required minlength="12">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" tabindex="-1" aria-label="Показать пароль">Показать</button>
                  </div>
                </div>
              </div>
              <p class="form-error" id="password-error"></p>
              <div class="profile-form-actions">
                <button type="submit" class="btn btn-primary">${t('profile_page.card_pw_change') || 'Сменить пароль'}</button>
              </div>
            </form>
          </section>

          <!-- Settings -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_settings') || 'Настройки'}</h2>
            </div>
            <form class="auth-form" onsubmit="handlePreferencesSave(event)">
              <div class="profile-settings-row">
                <label>${t('profile_page.card_lang_label') || 'Язык интерфейса'}</label>
                <select id="pref-lang" class="form-input">
                  <option value="ru"${(profile.preferences && profile.preferences.language === 'ru') ? ' selected' : ''}>Русский</option>
                  <option value="kk"${(profile.preferences && profile.preferences.language === 'kk') ? ' selected' : ''}>Қазақша</option>
                  <option value="en"${(profile.preferences && profile.preferences.language === 'en') ? ' selected' : ''}>English</option>
                </select>
              </div>
              <p class="form-error" id="preferences-error"></p>
              <div class="profile-form-actions">
                <button type="submit" class="btn btn-primary">${t('profile_page.card_settings_save') || 'Сохранить'}</button>
              </div>
            </form>
          </section>

          <!-- AI Chat History -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_ai_title') || 'История ИИ-советника'}</h2>
              <span class="profile-section-badge" id="chat-badge">${chats.length}</span>
            </div>
            ${chats.length ? `
              <div class="profile-chat-list" id="profile-chat-list">
                ${chats.slice(0, 15).map(c => `
                  <div class="profile-chat-item" data-chat-id="${c.id}">
                    <button class="profile-chat-delete" onclick="deleteChatItem(${c.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">×</button>
                    <div class="profile-chat-q">${escapeHtml(c.message.slice(0, 150))}${c.message.length > 150 ? '…' : ''}</div>
                    <div class="profile-chat-a">${escapeHtml(c.response.slice(0, 250))}${c.response.length > 250 ? '…' : ''}</div>
                    <div class="profile-chat-date">${formatDate(c.created_at)}</div>
                  </div>
                `).join('')}
                ${chats.slice(15).map(c => `
                  <div class="profile-chat-item profile-chat-item-hidden" style="display:none" data-chat-id="${c.id}">
                    <button class="profile-chat-delete" onclick="deleteChatItem(${c.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">×</button>
                    <div class="profile-chat-q">${escapeHtml(c.message.slice(0, 150))}${c.message.length > 150 ? '…' : ''}</div>
                    <div class="profile-chat-a">${escapeHtml(c.response.slice(0, 250))}${c.response.length > 250 ? '…' : ''}</div>
                    <div class="profile-chat-date">${formatDate(c.created_at)}</div>
                  </div>
                `).join('')}
              </div>
              ${chats.length > 15 ? `<button type="button" class="btn btn-ghost btn-sm" id="chat-show-more" onclick="showMoreChatItems(this)">${t('profile_page.show_more') || 'Показать ещё'} (${chats.length - 15})</button>` : ''}
            ` : `<div class="profile-empty"><div class="profile-empty-icon"></div>${t('profile_page.card_ai_empty') || 'Нет истории диалогов'}</div>`}
          </section>

          <!-- Test Results -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_tests_title') || 'Результаты тестов'}</h2>
              <span class="profile-section-badge" id="tests-badge">${tests.length}</span>
            </div>
            ${tests.length ? `
              <div class="profile-tests-grid">
                ${tests.map(test => {
                  const data = test.result_data ? JSON.parse(test.result_data) : {};
                  const labelFn = TEST_TYPE_LABELS[test.test_type];
                  const label = typeof labelFn === 'function' ? labelFn() : test.test_type;
                  return `
                    <div class="profile-test-card">
                      <button class="profile-test-delete" onclick="deleteTestResultItem(${test.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">×</button>
                      <div class="profile-test-type">${escapeHtml(label)}</div>
                      <div class="profile-test-score">${test.score}${test.max_score ? ` / ${test.max_score}` : ''}</div>
                      ${data.summary ? `<div class="profile-test-meta">${escapeHtml(data.summary)}</div>` : ''}
                      <div class="profile-test-date">${formatDate(test.created_at)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `<div class="profile-empty"><div class="profile-empty-icon"></div>${t('profile_page.card_tests_empty') || 'Нет результатов тестов'}</div>`}
          </section>

        </div>
      </div>
    `;

    // Рендер трекера в профиле
    renderProfileTracker();

  } catch (e) {
    content.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

function renderProfileTracker() {
  const container = document.getElementById('profile-tracker-content');
  const countEl = document.getElementById('tracker-count');
  if (!container) return;

  loadTracker();
  if (countEl) countEl.textContent = state.trackerList.length || '';

  if (state.trackerList.length === 0) {
    container.innerHTML = `<p class="profile-empty">${t('tracker.empty_desc') || 'Добавляйте вузы из результатов поступления, чтобы отслеживать статус заявок'}</p>
    <button class="btn btn-primary btn-sm" onclick="navigate('advisor')">${t('tracker.go_advisor') || 'Перейти к советнику'}</button>`;
    return;
  }

  const grouped = {};
  state.trackerList.forEach(item => {
    if (!grouped[item.status]) grouped[item.status] = [];
    grouped[item.status].push(item);
  });

  let html = '';
  const statusOrder = ['collecting', 'submitted', 'waiting', 'accepted', 'enrolled', 'rejected'];
  statusOrder.forEach(status => {
    const items = grouped[status];
    if (!items || items.length === 0) return;
    const s = TRACKER_STATUSES[status];
    html += `<div class="tracker-group">
      <div class="tracker-group-header" style="border-left: 3px solid ${s.color}">
        <span>${s.icon} ${s.label}</span>
        <span class="tracker-group-count">${items.length}</span>
      </div>`;
    items.forEach(item => {
      html += `<div class="tracker-card" data-id="${item.id}">
        <div class="tracker-card-head">
          <span class="tracker-card-name" onclick="navigate('university', ${item.university_id})">${escapeAdmissionHtml(item.name)}</span>
          <button class="tracker-card-remove" onclick="removeFromTracker(${item.id}); renderProfileTracker();" title="Удалить">×</button>
        </div>
        <div class="tracker-card-status">
          ${Object.entries(TRACKER_STATUSES).map(([key, val]) =>
            `<button class="tracker-status-btn ${key === status ? 'active' : ''}" style="--status-color: ${val.color}" onclick="updateTrackerStatus(${item.id}, '${key}'); renderProfileTracker();" title="${val.label}">${val.icon}</button>`
          ).join('')}
        </div>
        <input class="tracker-card-notes" placeholder="${t('tracker.notes_placeholder') || 'Заметки...'}" value="${escapeAdmissionHtml(item.notes || '')}" onchange="updateTrackerNotes(${item.id}, this.value)">
      </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

async function deleteSavedUniversity(uniId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.removeUniversity(uniId);
    const item = btn.closest('.profile-saved-card');
    if (item) item.remove();
    const badge = document.getElementById('saved-badge');
    if (badge) {
      const n = parseInt(badge.textContent) - 1;
      badge.textContent = n;
      if (n <= 0) {
        const grid = document.querySelector('.profile-saved-grid');
        if (grid) grid.outerHTML = `<div class="profile-empty"><div class="profile-empty-icon"> </div>${t('profile_page.card_saved_empty') || 'Нет сохранённых вузов'}</div>`;
      }
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '×';
  }
}

async function deleteChatItem(msgId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.deleteChatMessage(msgId);
    const item = btn.closest('.profile-chat-item');
    if (item) item.remove();
    const badge = document.getElementById('chat-badge');
    if (badge) {
      const n = parseInt(badge.textContent) - 1;
      badge.textContent = n;
      if (n <= 0) {
        const list = document.getElementById('profile-chat-list');
        if (list) list.outerHTML = `<div class="profile-empty"><div class="profile-empty-icon"> </div>${t('profile_page.card_ai_empty') || 'Нет истории диалогов'}</div>`;
      }
    }
    // если список видимых пунктов опустел ниже 15, подтягиваем следующий скрытый
    const visibleCount = document.querySelectorAll('.profile-chat-item:not(.profile-chat-item-hidden)').length;
    const nextHidden = document.querySelector('.profile-chat-item-hidden');
    if (visibleCount < 15 && nextHidden) {
      nextHidden.classList.remove('profile-chat-item-hidden');
      nextHidden.style.display = '';
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '×';
  }
}

async function deleteTestResultItem(resultId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await Auth.deleteTestResult(resultId);
    const item = btn.closest('.profile-test-card');
    if (item) item.remove();
    const badge = document.getElementById('tests-badge');
    if (badge) {
      const n = parseInt(badge.textContent) - 1;
      badge.textContent = n;
      if (n <= 0) {
        const grid = document.querySelector('.profile-tests-grid');
        if (grid) grid.outerHTML = `<div class="profile-empty"><div class="profile-empty-icon"> </div>${t('profile_page.card_tests_empty') || 'Нет результатов тестов'}</div>`;
      }
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '×';
  }
}

function handlePasswordChange(e) {
  e.preventDefault();
  const err = document.getElementById('password-error');
  err.textContent = '';
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (newPw !== confirm) { err.textContent = t('profile_page.toast_pw_mismatch'); return; }
  Auth.changePassword(current, newPw)
    .then(() => {
      showToast(t('profile_page.toast_pw_changed'), 'success');
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
    .then(() => {
      showToast(t('profile_page.toast_settings_saved'), 'success');
      setLanguage(language);
    })
    .catch(e => { err.textContent = e.message; });
}

const TEST_TYPE_LABELS = {
  ent_calc: () => t('profile_page.test_ent'),
  career_test: () => t('profile_page.test_career'),
  admission_predict: () => t('profile_page.test_admission'),
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
    .then(() => showToast(t('profile_page.toast_profile_saved'), 'success'))
    .catch(e => { err.textContent = e.message; });
}

function togglePW(btn) {
  const input = btn.previousElementSibling;
  const isPW = input.type === 'password';
  input.type = isPW ? 'text' : 'password';
  btn.textContent = isPW ? 'Скрыть' : 'Показать';
  btn.setAttribute('aria-label', isPW ? t('profile_page.card_pw_hide') : t('profile_page.card_pw_show'));
}

// Простая маска ввода для казахстанского номера: +7 (___) ___-__-__
function formatPhoneInput(input) {
  let digits = input.value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);
  const rest = digits.slice(1);
  let formatted = '+7';
  if (rest.length > 0) formatted += ' (' + rest.slice(0, 3);
  if (rest.length >= 3) formatted += ') ' + rest.slice(3, 6);
  if (rest.length >= 6) formatted += '-' + rest.slice(6, 8);
  if (rest.length >= 8) formatted += '-' + rest.slice(8, 10);
  input.value = formatted;
}

// Живой чек-лист требований к паролю (12+ символов, заглавная, цифра, спецсимвол)
function updatePasswordHints(inputId, listId) {
  const val = document.getElementById(inputId).value;
  const list = document.getElementById(listId);
  if (!list) return;
  const rules = {
    len: val.length >= 12,
    upper: /[A-ZА-Я]/.test(val),
    digit: /\d/.test(val),
    special: /[^A-Za-zА-Яа-я0-9]/.test(val)
  };
  list.querySelectorAll('li[data-rule]').forEach(li => {
    const ok = rules[li.dataset.rule];
    li.classList.toggle('pw-hint-ok', !!ok);
  });
}

// Раскрыть скрытые пункты истории ИИ-советника вместо расхождения бейджа (30) и рендера (15)
function showMoreChatItems(btn) {
  document.querySelectorAll('.profile-chat-item-hidden').forEach(el => {
    el.classList.remove('profile-chat-item-hidden');
    el.style.display = '';
  });
  btn.remove();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(currentLanguage === 'kk' ? 'kk-KZ' : currentLanguage === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

function requireAuth(targetPage) {
  if (!Auth.isLoggedIn()) {
    sessionStorage.setItem('auth_redirect', targetPage || 'profile');
    showToast(t('profile_page.toast_login_required'));
    navigate('login');
    return false;
  }
  return true;
}