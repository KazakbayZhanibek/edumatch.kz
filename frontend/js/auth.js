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
    if (this.user?.id !== user?.id) window.resetAdvisorSession?.();
    this.user = user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.updateNavUI();
  },

  clearSession() {
    this.user = null;
    window.resetAdvisorSession?.();
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

  async updateProfile({ fullName, phone, bio, preferences, profilePicture }) {
    const body = { fullName, phone, bio };
    if (preferences) body.preferences = preferences;
    if (profilePicture) body.profilePicture = profilePicture;
    const res = await this.fetch('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('profile_page.err_profile_save'));
    if (data.user) {
      this.user = {
        ...this.user,
        fullName: data.user.full_name,
        email: data.user.email,
        username: data.user.username,
        profilePicture: data.user.profile_picture
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

  async getApplications() {
    const res = await this.fetch('/applications');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить заявки');
    return data.applications || [];
  },

  async getAdminOverview(days = 30) {
    const res = await this.fetch(`/admin/overview?days=${days}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Нет доступа к админ-панели');
    return data;
  },

  async getAdminReviews() {
    const res = await this.fetch('/admin/reviews');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить отзывы');
    return data.reviews || [];
  },

  async getAdminApplications() {
    const res = await this.fetch('/admin/applications?limit=100');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить заявки');
    return data.applications || [];
  },

  async getAdminUsers() {
    const res = await this.fetch('/admin/users?limit=100');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить пользователей');
    return data.users || [];
  },

  async moderateReview(id, approved) {
    const res = await this.fetch(`/admin/reviews/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ approved })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось изменить отзыв');
    return data;
  },

  async deleteAdminReview(id) {
    const res = await this.fetch(`/admin/reviews/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось удалить отзыв');
    return data;
  },

  async getPendingMilitary() {
    const res = await this.fetch('/verify/military/pending');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
    return data.requests || [];
  },

  async reviewMilitary(id, action, note) {
    const res = await this.fetch(`/verify/military/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    return data;
  },

  async getPendingEnt() {
    const res = await this.fetch('/verify/ent/pending');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
    return data.requests || [];
  },

  async reviewEnt(id, action, note, entScore) {
    const res = await this.fetch(`/verify/ent/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, note, entScore })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    return data;
  },

  async addApplication(application) {
    const res = await this.fetch('/applications', {
      method: 'POST',
      body: JSON.stringify(application)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось добавить заявку');
    return data;
  },

  async updateApplication(id, changes) {
    const res = await this.fetch(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось обновить заявку');
    return data;
  },

  async removeApplication(id) {
    const res = await this.fetch(`/applications/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось удалить заявку');
    return data;
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

  async clearAdmissionHistory() {
    const res = await this.fetch('/admission/history/all', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    return data;
  },

  async deleteAdmissionHistoryItem(id) {
    const res = await this.fetch(`/admission/history/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    return data;
  },

  updateNavUI() {
    window.dispatchEvent(new Event('edumatch-auth-changed'));
    const guest = document.getElementById('nav-auth-guest');
    const user = document.getElementById('nav-auth-user');
    const label = document.getElementById('nav-auth-username');
    const profileSheet = document.getElementById('more-sheet-profile');
    const loginSheet = document.getElementById('more-sheet-login');
    const logoutSheet = document.getElementById('more-sheet-logout');
    const mobileGuest = document.getElementById('mobile-account-guest');
    const mobileUser = document.getElementById('mobile-account-user');

    if (!guest || !user) return;

    if (this.isLoggedIn()) {
      guest.style.display = 'none';
      user.style.display = 'flex';
      if (label) label.textContent = this.user.username || this.user.email;
      if (profileSheet) profileSheet.style.display = 'flex';
      if (logoutSheet) logoutSheet.style.display = 'flex';
      if (loginSheet) loginSheet.style.display = 'none';
      if (mobileGuest) mobileGuest.style.display = 'none';
      if (mobileUser) mobileUser.style.display = 'flex';
    } else {
      guest.style.display = 'flex';
      user.style.display = 'none';
      if (profileSheet) profileSheet.style.display = 'none';
      if (logoutSheet) logoutSheet.style.display = 'none';
      if (loginSheet) loginSheet.style.display = 'flex';
      if (mobileGuest) mobileGuest.style.display = 'flex';
      if (mobileUser) mobileUser.style.display = 'none';
    }
  }
};

// ─── AUTH PAGES ───────────────────────────────

function handleRegister(e) {
  e.preventDefault();
  const err = document.getElementById('register-error');
  err.setAttribute('role', 'alert');
  e.target.querySelectorAll('input').forEach(input => {
    const descriptions = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    descriptions.add('register-error');input.setAttribute('aria-describedby', [...descriptions].join(' '));
  });
  err.textContent = '';
  const consent = document.getElementById('reg-consent');
  if (!consent?.checked) {
    err.textContent = t('auth.consent_required');
    consent?.focus();
    return;
  }
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
  err.setAttribute('role', 'alert');
  ['login-email', 'login-password'].forEach(id => document.getElementById(id).setAttribute('aria-describedby', 'login-error'));
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

function handleAvatarSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const user = Auth.user || {};
  const avatarKey = `edumatch_avatar_${user.id || user.email}`;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showToast(t('profile_page.avatar_invalid') || 'Выберите JPG, PNG или WebP', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast(t('profile_page.avatar_too_large') || 'Размер фото не должен превышать 2 МБ', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(avatarKey, reader.result);
    Auth.updateProfile({ profilePicture: reader.result })
      .then(() => {
        loadProfilePage();
        showToast(t('profile_page.avatar_saved') || 'Фото профиля обновлено', 'success');
      })
      .catch(error => showToast(error.message || t('profile_page.avatar_error') || 'Не удалось загрузить фото', 'error'));
  };
  reader.onerror = () => showToast(t('profile_page.avatar_error') || 'Не удалось загрузить фото', 'error');
  reader.readAsDataURL(file);
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

  content.innerHTML = `<div class="loading-state" role="status"><div class="spinner" aria-hidden="true"></div><p>${profileCopy('Загружаем ваш профиль…', 'Профиліңіз жүктелуде…', 'Loading your profile…')}</p></div>`;

  try {
    const profile = await Auth.getProfile();
    const saved = await Auth.getSavedUniversities();
    const chats = await Auth.getChatHistory(30);
    const tests = await Auth.getTestResults();

    const initials = (profile.fullName || profile.username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const displayName = profile.fullName || profile.username;
    const bioText = profile.bio || t('profile_page.card_bio_placeholder') || 'Расскажите о себе...';
    const avatarKey = `edumatch_avatar_${profile.id || profile.email}`;
    const avatar = profile.profilePicture || localStorage.getItem(avatarKey);

    content.innerHTML = `
      <div class="profile-layout">

        <!-- LEFT: User Card -->
        <aside class="profile-user-card">
          <div class="profile-user-avatar" title="${t('profile_page.avatar_change') || 'Изменить фото'}">
            ${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(displayName)}" class="profile-avatar-image">` : `<span>${initials}</span>`}
            <label class="profile-avatar-upload" title="${t('profile_page.avatar_change') || 'Изменить фото'}">
              <input type="file" accept="image/jpeg,image/png,image/webp" onchange="handleAvatarSelect(event)">
              <span aria-hidden="true">+</span>
            </label>
          </div>
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

          <!-- Quick Navigation -->
          <div class="profile-nav-row">
            <a class="profile-nav-item" onclick="navigate('advisor')">
              <span class="profile-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
              <span>${t('nav.advisor') || 'ИИ-советник'}</span>
            </a>
            <a class="profile-nav-item" onclick="navigate('admission')">
              <span class="profile-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              <span>${t('nav.admission') || 'Калькулятор'}</span>
            </a>
            <a class="profile-nav-item" onclick="navigate('career')">
              <span class="profile-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></span>
              <span>${t('nav.career') || 'Профориентация'}</span>
            </a>
            <a class="profile-nav-item" onclick="navigate('home')">
              <span class="profile-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg></span>
              <span>${t('nav.universities') || 'Вузы'}</span>
            </a>
          </div>

          <!-- ENT & Military -->
          <div class="profile-status-row" id="profile-status-row"></div>

          <!-- Edit Profile -->
          <section class="profile-section">
            <h2 class="profile-section-title">${t('profile_page.card_profile') || 'Профиль'}</h2>
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
                <textarea id="profile-bio" class="form-input" rows="2" maxlength="300" oninput="document.getElementById('profile-bio-count').textContent = this.value.length" placeholder="${t('profile_page.card_bio_placeholder') || 'Кратко о целях поступления'}">${escapeHtml(profile.bio || '')}</textarea>
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

          <!-- ENT Upload & Military Verification -->
          <section class="profile-section">
            <h2 class="profile-section-title">${t('profile_page.verification_title')}</h2>
            <div id="ent-upload-content" style="margin-bottom:16px"></div>
            <div id="military-content"></div>
          </section>

          <!-- AI Chat History -->
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_ai_title') || 'История ИИ-советника'}</h2>
              <span class="profile-section-badge" id="chat-badge">${chats.length}</span>
            </div>
            ${chats.length ? `
              <div class="profile-chat-list" id="profile-chat-list">
                ${chats.slice(0, 5).map(c => `
                  <div class="profile-chat-item" data-chat-id="${c.id}">
                    <button class="profile-chat-delete" onclick="deleteChatItem(${c.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div class="profile-chat-q">${escapeHtml(c.message.slice(0, 150))}${c.message.length > 150 ? '…' : ''}</div>
                    <div class="profile-chat-a">${escapeHtml(c.response.slice(0, 250))}${c.response.length > 250 ? '…' : ''}</div>
                    <div class="profile-chat-date">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      ${formatDate(c.created_at)}
                    </div>
                  </div>
                `).join('')}
                ${chats.slice(5).map(c => `
                  <div class="profile-chat-item profile-chat-item-hidden" style="display:none" data-chat-id="${c.id}">
                    <button class="profile-chat-delete" onclick="deleteChatItem(${c.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div class="profile-chat-q">${escapeHtml(c.message.slice(0, 150))}${c.message.length > 150 ? '…' : ''}</div>
                    <div class="profile-chat-a">${escapeHtml(c.response.slice(0, 250))}${c.response.length > 250 ? '…' : ''}</div>
                    <div class="profile-chat-date">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      ${formatDate(c.created_at)}
                    </div>
                  </div>
                `).join('')}
              </div>
              ${chats.length > 5 ? `<button type="button" class="btn btn-ghost btn-sm chat-history-toggle" id="chat-show-more" onclick="toggleChatHistory(this)">${t('profile_page.show_more') || 'Показать ещё'} (${chats.length - 5})</button>` : ''}
            ` : `<div class="profile-empty"><div class="profile-empty-icon"></div>${t('profile_page.card_ai_empty') || 'Нет истории диалогов'}</div>`}
          </section>

          <!-- Test Results -->
          <section class="profile-section" id="profile-admission-history"></section>
          <section class="profile-section">
            <div class="profile-section-header">
              <h2 class="profile-section-title">${t('profile_page.card_tests_title') || 'Результаты тестов'}</h2>
              <span class="profile-section-badge" id="tests-badge">${tests.length}</span>
            </div>
            ${tests.length ? `
              <div class="profile-tests-grid">
                ${tests.map(test => {
                  let data = {};
                  try { data = test.result_data ? JSON.parse(test.result_data) || {} : {}; } catch (_) { /* An old malformed result must not break the profile. */ }
                  const labelFn = TEST_TYPE_LABELS[test.test_type];
                  const label = typeof labelFn === 'function' ? labelFn() : test.test_type;
                  const icon = test.test_type === 'ent_calc' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
                    : test.test_type === 'career_test' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
                  const pct = test.max_score ? Math.round((test.score / test.max_score) * 100) : null;
                  return `
                    <div class="profile-test-card">
                      <button class="profile-test-delete" onclick="deleteTestResultItem(${test.id}, this)" title="${t('profile_page.card_saved_delete') || 'Удалить'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <div class="profile-test-type">${icon} ${escapeHtml(label)}</div>
                      <div class="profile-test-score">${test.score}${test.max_score ? ` / ${test.max_score}` : ''}</div>
                      ${pct !== null ? `<div style="margin-bottom:8px"><div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px"></div></div></div>` : ''}
                      ${data.summary ? `<div class="profile-test-meta">${escapeHtml(data.summary)}</div>` : ''}
                      <div class="profile-test-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${formatDate(test.created_at)}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `<div class="profile-empty"><div class="profile-empty-icon"></div>${t('profile_page.card_tests_empty') || 'Нет результатов тестов'}</div>`}
          </section>

          <!-- Password -->
          <section class="profile-section">
            <h2 class="profile-section-title">${t('profile_page.card_password_title') || 'Смена пароля'}</h2>
            <form id="password-form" class="auth-form" onsubmit="handlePasswordChange(event)">
              <div class="profile-pw-fields">
                <div class="form-field">
                  <label for="pw-current">${t('profile_page.card_pw_current') || 'Текущий пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-current" class="form-input" required minlength="1" autocomplete="current-password" aria-describedby="password-error">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" aria-controls="pw-current" aria-label="${t('profile_page.card_pw_show')}: ${t('profile_page.card_pw_current')}">Показать</button>
                  </div>
                </div>
                <div class="form-field">
                  <label for="pw-new">${t('profile_page.card_pw_new') || 'Новый пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-new" class="form-input" required minlength="12" pattern="(?=.*[A-ZА-Я])(?=.*[0-9])(?=.*[^A-Za-zА-Яа-я0-9]).{12,}" oninput="updatePasswordHints('pw-new','pw-new-hints')" autocomplete="new-password" aria-describedby="pw-new-hints password-error">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" aria-controls="pw-new" aria-label="${t('profile_page.card_pw_show')}: ${t('profile_page.card_pw_new')}">Показать</button>
                  </div>
                  <ul class="pw-hints" id="pw-new-hints">
                    <li data-rule="len">Минимум 12 символов</li>
                    <li data-rule="upper">Заглавная буква</li>
                    <li data-rule="digit">Цифра</li>
                    <li data-rule="special">Спецсимвол</li>
                  </ul>
                </div>
                <div class="form-field">
                  <label for="pw-confirm">${t('profile_page.card_pw_confirm') || 'Подтвердите пароль'}</label>
                  <div class="pw-toggle-wrap">
                    <input type="password" id="pw-confirm" class="form-input" required minlength="12" autocomplete="new-password" aria-describedby="password-error">
                    <button type="button" class="pw-toggle" onclick="togglePW(this)" aria-controls="pw-confirm" aria-label="${t('profile_page.card_pw_show')}: ${t('profile_page.card_pw_confirm')}">Показать</button>
                  </div>
                </div>
              </div>
              <p class="form-error" id="password-error" role="alert"></p>
              <div class="profile-form-actions">
                <button type="submit" class="btn btn-primary">${t('profile_page.card_pw_change') || 'Сменить пароль'}</button>
              </div>
            </form>
          </section>

        </div>
      </div>
    `;

    enhanceProfileOverview(saved, chats, tests);

    // Рендер трекера в профиле
    renderProfileTracker();

    // Рендер статусов ЕНТ и армии
    renderProfileStatusRow();

    // Рендер загрузки ЕНТ
    renderEntUpload();

    // Рендер верификации армии
    renderMilitaryVerification();
    renderAdmissionHistory();

  } catch (e) {
    content.innerHTML = `<div class="profile-empty" role="alert"><p class="form-error">${escapeHtml(e.message)}</p><button class="btn btn-primary" onclick="loadProfilePage()">${profileCopy('Повторить загрузку', 'Қайта жүктеу', 'Try again')}</button></div>`;
  }
}

function profileCopy(ru, kk, en) {
  return window.currentLanguage === 'kk' ? kk : window.currentLanguage === 'en' ? en : ru;
}

function revealProfileSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  if (target.matches('details')) target.open = true;
  const disclosure = target.querySelector('details');
  if (disclosure) disclosure.open = true;
  target.scrollIntoView({ block: 'start', behavior: 'auto' });
  const focus = target.querySelector('summary, input, button') || target;
  if (!focus.hasAttribute('tabindex') && focus === target) focus.tabIndex = -1;
  focus.focus({ preventScroll: true });
}

function enhanceProfileOverview(saved, chats, tests) {
  const main = document.querySelector('#profile-content .profile-main');
  if (!main) return;
  const sections = [...main.querySelectorAll(':scope > .profile-section')];
  const savedSection = document.getElementById('saved-badge')?.closest('section');
  if (savedSection) savedSection.id = 'profile-saved-section';
  const tracker = document.getElementById('profile-tracker-content')?.closest('section');
  if (tracker) tracker.id = 'profile-tracker-section';
  const edit = document.getElementById('profile-form')?.closest('section');
  if (edit) edit.id = 'profile-edit-section';
  const overview = document.createElement('section');
  overview.className = 'profile-overview';
  overview.setAttribute('aria-label', profileCopy('Обзор поступления', 'Түсуге шолу', 'Admission overview'));
  overview.innerHTML = `<h2>${profileCopy('Ваш следующий шаг', 'Келесі қадамыңыз', 'Your next step')}</h2>
    <p>${saved.length ? profileCopy('Вузы уже в избранном. Соберите план и проверьте условия перед подачей.', 'Университеттер сақталды. Жоспар құрып, өтініш алдында талаптарды тексеріңіз.', 'Your shortlist is ready. Build a plan and check requirements before applying.') : profileCopy('Начните с выбора вузов — сохраните подходящие варианты для сравнения.', 'Университеттерді таңдаудан бастаңыз — салыстыру үшін қолайлы нұсқаларды сақтаңыз.', 'Start by choosing universities and save the options you want to compare.')}</p>
    <div class="profile-overview-actions"><button type="button" class="btn btn-primary" onclick="navigate('${saved.length ? 'planner' : 'home'}')">${saved.length ? profileCopy('Составить план', 'Жоспар құру', 'Build a plan') : profileCopy('Выбрать вузы', 'Университет таңдау', 'Explore universities')}</button>
    <button type="button" class="btn btn-ghost" onclick="revealProfileSection('planner-saved')">${profileCopy('Открыть мои планы', 'Жоспарларымды ашу', 'Open my plans')}</button></div>
    <div class="profile-overview-links"><button type="button" onclick="revealProfileSection('profile-saved-section')">${profileCopy('Сохранённые вузы', 'Сақталған университеттер', 'Saved universities')} <span>${saved.length}</span></button><button type="button" onclick="revealProfileSection('profile-tracker-section')">${profileCopy('Заявки и сроки', 'Өтініштер мен мерзімдер', 'Applications and deadlines')}</button><button type="button" onclick="revealProfileSection('profile-edit-section')">${profileCopy('Редактировать профиль', 'Профильді өңдеу', 'Edit profile')}</button></div>`;
  main.prepend(overview);
  // Keep every existing field, ID and listener in place; native details supplies
  // keyboard activation and an accessible expanded state without a second nav.
  for (const section of sections) {
    const isEdit = section === edit;
    const isHistory = section.querySelector('#chat-badge, #tests-badge');
    if (!isEdit && !isHistory) continue;
    const header = section.querySelector(':scope > .profile-section-header, :scope > h2');
    if (!header) continue;
    const details = document.createElement('details');
    details.className = 'profile-disclosure';
    const summary = document.createElement('summary');
    summary.append(header);
    details.append(summary);
    while (section.firstChild) details.append(section.firstChild);
    section.append(details);
  }
  for (const [badge, route, label] of [
    ['saved-badge', 'home', profileCopy('Выбрать вузы', 'Университет таңдау', 'Explore universities')],
    ['chat-badge', 'advisor', profileCopy('Задать вопрос', 'Сұрақ қою', 'Ask a question')],
    ['tests-badge', 'career', profileCopy('Пройти тест', 'Тест тапсыру', 'Take a test')]
  ]) {
    const empty = document.getElementById(badge)?.closest('section')?.querySelector('.profile-empty');
    if (!empty) continue;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-ghost'; button.textContent = label;
    button.addEventListener('click', () => navigate(route)); empty.append(button);
  }
}

async function renderProfileTracker() {
  const container = document.getElementById('profile-tracker-content');
  const countEl = document.getElementById('tracker-count');
  if (!container) return;

  loadTracker();
  if (Auth.isLoggedIn() && !state.trackerServerLoaded) {
    try {
      let applications = await Auth.getApplications();
      if (applications.length === 0 && state.trackerList.length > 0) {
        for (const item of state.trackerList) {
          await Auth.addApplication({
            universityId: item.university_id,
            status: item.status,
            notes: item.notes || ''
          });
        }
        applications = await Auth.getApplications();
      }
      state.trackerList = applications;
      state.trackerServerLoaded = true;
      saveTracker();
    } catch (error) {
      console.warn('Applications sync failed:', error);
    }
  }
  if (countEl) countEl.textContent = state.trackerList.length || '';

  if (state.trackerList.length === 0) {
    container.innerHTML = `
      <div class="tracker-empty">
        <div class="tracker-empty-icon">📋</div>
        <p class="tracker-empty-title">${t('tracker.empty_title') || 'Нет заявок'}</p>
        <p class="tracker-empty-desc">${t('tracker.empty_desc') || 'Добавляйте вузы в трекер из результатов расчёта шансов поступления, чтобы отслеживать статус заявок'}</p>
        <div class="tracker-empty-steps">
          <div class="tracker-empty-step"><span class="tracker-step-num">1</span> ${t('tracker.step1') || 'Рассчитайте шансы в разделе «Мои шансы»'}</div>
          <div class="tracker-empty-step"><span class="tracker-step-num">2</span> ${t('tracker.step2') || 'Нажмите «В трекер» на карточке вуза'}</div>
          <div class="tracker-empty-step"><span class="tracker-step-num">3</span> ${t('tracker.step3') || 'Отслеживайте статус здесь'}</div>
        </div>
        <button class="btn btn-primary" onclick="navigate('admission')">${t('tracker.go_admission') || 'Перейти к расчёту шансов'}</button>
      </div>`;
    return;
  }

  const activeCount = state.trackerList.filter(item => !['rejected', 'enrolled'].includes(item.status)).length;
  const submittedCount = state.trackerList.filter(item => ['submitted', 'waiting', 'accepted', 'enrolled'].includes(item.status)).length;
  const upcomingDeadlines = state.trackerList
    .filter(item => item.deadline && new Date(`${item.deadline}T23:59:59`) >= new Date())
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const nextDeadline = upcomingDeadlines[0];
  const deadlineText = nextDeadline
    ? `${escapeHtml(nextDeadline.name)} · ${new Date(`${nextDeadline.deadline}T00:00:00`).toLocaleDateString('ru-RU')}`
    : 'Дедлайн не указан';

  let html = `<div class="tracker-overview">
    <div class="tracker-overview-item"><strong>${activeCount}</strong><span>В работе</span></div>
    <div class="tracker-overview-item"><strong>${submittedCount}</strong><span>После подачи</span></div>
    <div class="tracker-overview-next"><span>Ближайший дедлайн</span><strong>${deadlineText}</strong></div>
  </div>`;

  const grouped = {};
  state.trackerList.forEach(item => {
    if (!grouped[item.status]) grouped[item.status] = [];
    grouped[item.status].push(item);
  });

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
          <button class="tracker-card-remove" onclick="handleTrackerRemove(${item.id}, this)" title="Удалить заявку" aria-label="Удалить заявку">×</button>
        </div>
        <div class="tracker-card-fields">
          <label class="tracker-field-label">Статус
            <select class="tracker-status-select" onchange="updateTrackerStatus(${item.id}, this.value).then(() => renderProfileTracker())">
              ${Object.entries(TRACKER_STATUSES).map(([key, val]) =>
                `<option value="${key}" ${key === status ? 'selected' : ''}>${val.label}</option>`
              ).join('')}
            </select>
          </label>
          <label class="tracker-field-label">Учебный год
            <input class="tracker-year-input" value="${escapeAdmissionHtml(item.academic_year || '2026-2027')}" maxlength="20" onchange="updateTrackerField(${item.id}, 'academicYear', this.value)">
          </label>
          <label class="tracker-field-label">Дедлайн
            <input type="date" class="tracker-date-input" value="${escapeAdmissionHtml(item.deadline || '')}" onchange="updateTrackerField(${item.id}, 'deadline', this.value)">
          </label>
        </div>
        <input class="tracker-card-notes" placeholder="${t('tracker.notes_placeholder') || 'Заметки...'}" value="${escapeAdmissionHtml(item.notes || '')}" onchange="updateTrackerNotes(${item.id}, this.value)">
      </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

// ==================== STATUS ROW (ENT + Military) ====================

function renderProfileStatusRow() { return Verification.badges(); }
async function renderAdmissionHistory() {
  const container = document.getElementById('profile-admission-history');
  if (!container) return;
  const lang = window.currentLanguage || 'ru';
  const labels = {
    ru: ['История расчётов поступления', 'Последние 50 результатов', 'Расчётов пока нет', 'Обновить', 'Очистить всё', 'Удалить'],
    kk: ['Оқуға түсу есептерінің тарихы', 'Соңғы 50 нәтиже', 'Есептер әлі жоқ', 'Жаңарту', 'Барлығын тазалау', 'Жою'],
    en: ['Admission calculation history', 'Latest 50 results', 'No calculations yet', 'Refresh', 'Clear all', 'Delete']
  }[lang] || ['История расчётов', 'Последние 50 результатов', 'Расчётов пока нет', 'Обновить', 'Очистить всё', 'Удалить'];
  try {
    const response = await Auth.fetch('/admission/history');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка загрузки');
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    container.innerHTML = `
      <div class="profile-section-header">
        <h2 class="profile-section-title">${icon} ${labels[0]}</h2>
        <div style="display:flex;align-items:center;gap:8px">
          ${data.history.length ? `<button class="btn btn-ghost btn-sm" onclick="clearAdmissionHistory()" style="color:var(--error,#ef4444);font-size:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            ${labels[4]}
          </button>` : ''}
          <span class="profile-section-badge">${data.history.length}</span>
        </div>
      </div>
      ${data.history.length ? `<div class="profile-tests-grid">${data.history.map(row => {
        const chance = row.predicted_chance;
        const chanceColor = chance >= 70 ? 'var(--accent)' : chance >= 40 ? 'var(--warning,#f59e0b)' : 'var(--error,#ef4444)';
        return `
          <div class="profile-test-card">
            <button class="profile-test-delete" onclick="deleteAdmissionHistoryItem(${row.id}, this)" title="${labels[5]}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="profile-test-type">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              ${escapeHtml(row.short_name || row.university_name || '—')}
            </div>
            <div class="profile-test-score" style="color:${chanceColor}">${chance != null ? chance + '%' : '—'}</div>
            <div style="margin-bottom:8px"><div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;width:${chance || 0}%;background:${chanceColor};border-radius:4px"></div></div></div>
            <div class="profile-test-meta">${escapeHtml(row.specialty_category || '—')} · ЕНТ ${row.ent ?? '—'}</div>
            <div class="profile-test-date">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${formatDate(row.created_at)}
            </div>
          </div>`;
      }).join('')}</div>` : `<div class="profile-empty"><div class="profile-empty-icon"> </div>${labels[2]}</div>`}`;
  } catch (error) { container.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`; }
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:8px;margin-top:12px';
  const refresh = document.createElement('button');
  refresh.type = 'button'; refresh.className = 'btn btn-ghost btn-sm';
  refresh.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' + labels[3];
  refresh.onclick = renderAdmissionHistory;
  btns.appendChild(refresh);
  container.append(btns);
}

async function clearAdmissionHistory() {
  if (document.getElementById('clear-history-sheet')) return;
  const overlay = document.createElement('div');
  overlay.id = 'clear-history-sheet-overlay';
  overlay.className = 'sheet-overlay open';
  overlay.style.cssText = 'z-index:999;display:block;opacity:1;pointer-events:auto';

  const sheet = document.createElement('div');
  sheet.id = 'clear-history-sheet';
  sheet.className = 'bottom-sheet open';
  sheet.style.cssText = 'z-index:1000;max-height:auto;border-radius:20px;bottom:auto;top:50%;left:50%;transform:translate(-50%,-50%);width:min(380px,90vw);padding:28px 24px;text-align:center';
  sheet.onclick = e => e.stopPropagation();

  sheet.innerHTML = `
    <div style="margin-bottom:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--error,#ef4444)" stroke-width="2" width="40" height="40" style="margin:0 auto 12px;display:block">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
      <h2 id="clear-history-title" style="font-size:17px;font-weight:700;margin-bottom:6px;color:var(--text)">Очистить всю историю?</h2>
      <div style="font-size:13px;color:var(--text-muted)">Это действие нельзя отменить. Будут удалены все сохранённые расчёты.</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" style="flex:1" id="cancel-clear-history">Отмена</button>
      <button class="btn" style="flex:1;background:var(--error,#ef4444);color:#fff;border-color:var(--error,#ef4444)" id="confirm-clear-history">Очистить</button>
    </div><p id="clear-history-error" role="alert"></p>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  const close = () => { sheet.remove(); overlay.remove(); window.syncSiteDialog?.(); };
  sheet.closeDialog = close;
  overlay.onclick = close;
  sheet.querySelector('#cancel-clear-history').onclick = close;
  document.body.style.overflow = 'hidden';
  window.syncSiteDialog?.();

  document.getElementById('confirm-clear-history').onclick = async event => {
    const confirmButton = event.currentTarget;
    confirmButton.disabled = true;
    sheet.querySelector('#clear-history-error').textContent = '';
    try {
      await Auth.clearAdmissionHistory();
      close();
      showToast('История очищена', 'success');
      await renderAdmissionHistory();
    } catch (e) {
      if (sheet.isConnected) sheet.querySelector('#clear-history-error').textContent = e.message;
      confirmButton.disabled = false;
    }
  };
}

async function deleteAdmissionHistoryItem(id, btn) {
  const card = btn.closest('.profile-test-card');
  card.style.opacity = '0.4';
  btn.disabled = true;
  try {
    await Auth.deleteAdmissionHistoryItem(id);
    await renderAdmissionHistory();
  } catch (e) {
    card.style.opacity = '1';
    btn.disabled = false;
    showToast(e.message, 'error');
  }
}
function renderEntUpload() { return Verification.profile('ent'); }
function renderMilitaryVerification() { return Verification.profile('military'); }
function showEntUploadForm() { return Verification.upload('ent'); }
function showMilitaryUploadForm() { return Verification.upload('military'); }

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
      const overviewCount = document.querySelector('.profile-overview-links button:first-child span');
      if (overviewCount) overviewCount.textContent = Math.max(0, n);
      if (n <= 0) {
        const overview = document.querySelector('.profile-overview');
        if (overview) {
          overview.querySelector('p').textContent = profileCopy('Начните с выбора вузов — сохраните подходящие варианты для сравнения.', 'Университеттерді таңдаудан бастаңыз — салыстыру үшін қолайлы нұсқаларды сақтаңыз.', 'Start by choosing universities and save the options you want to compare.');
          const next = overview.querySelector('.profile-overview-actions button');
          next.textContent = profileCopy('Выбрать вузы', 'Университет таңдау', 'Explore universities');
          next.onclick = () => navigate('home');
        }
        const grid = document.querySelector('.profile-saved-grid');
        if (grid) grid.outerHTML = `<div class="profile-empty">${t('profile_page.card_saved_empty') || 'Нет сохранённых вузов'}<button type="button" class="btn btn-ghost" onclick="navigate('home')">${profileCopy('Выбрать вузы', 'Университет таңдау', 'Explore universities')}</button></div>`;
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
    .then(() => {
      showToast(t('profile_page.toast_profile_saved'), 'success'); renderProfileStatusRow(); renderEntUpload();
    })
    .catch(e => { err.textContent = e.message; });
}

function togglePW(btn) {
  const input = btn.previousElementSibling;
  const isPW = input.type === 'password';
  input.type = isPW ? 'text' : 'password';
  btn.textContent = isPW ? 'Скрыть' : 'Показать';
  const action = isPW ? t('profile_page.card_pw_hide') : t('profile_page.card_pw_show');
  btn.setAttribute('aria-label', `${action}: ${input.labels?.[0]?.textContent || ''}`);
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

function toggleChatHistory(btn) {
  const list = document.getElementById('profile-chat-list');
  if (!list) return;
  const items = Array.from(list.querySelectorAll('.profile-chat-item'));
  const expanded = btn.dataset.expanded === 'true';
  const showMoreLabel = t('profile_page.show_more') || 'Показать ещё';

  if (expanded) {
    items.forEach((item, index) => {
      const hidden = index >= 5;
      item.classList.toggle('profile-chat-item-hidden', hidden);
      item.style.display = hidden ? 'none' : '';
    });
    btn.dataset.expanded = 'false';
    btn.textContent = `${showMoreLabel} (${Math.max(0, items.length - 5)})`;
  } else {
    items.forEach(item => {
      item.classList.remove('profile-chat-item-hidden');
      item.style.display = '';
    });
    btn.dataset.expanded = 'true';
    btn.textContent = t('profile_page.show_less') || 'Свернуть';
  }
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

async function loadAdminPanel() {
  const container = document.getElementById('admin-panel-content');
  if (!container) return;
  const days = Number(container.dataset.days || 30);
  try {
    const [overviewData, reviews, applications, users, milRequests, entRequests] = await Promise.all([
      Auth.getAdminOverview(days), Auth.getAdminReviews(), Auth.getAdminApplications(), Auth.getAdminUsers(),
      Auth.getPendingMilitary().catch(() => []), Auth.getPendingEnt().catch(() => [])
    ]);
    const overview = overviewData.overview || {};
    const labels = { collecting: 'Сбор документов', submitted: 'Подано', waiting: 'Ожидание', accepted: 'Зачислены', enrolled: 'Оплачивают', rejected: 'Отказ' };
    const statuses = overviewData.applicationStatuses || [];
    const intents = overviewData.intents || [];
    const serviceTypes = { draft: 'По призыву', contract: 'Контракт', alternative: 'Альтернативная' };
    container.innerHTML = `
      <div class="admin-toolbar"><div><strong>Центр управления</strong><span>Данные за последние ${days} дней</span></div><label>Период <select onchange="changeAdminPeriod(this.value)"><option value="7" ${days === 7 ? 'selected' : ''}>7 дней</option><option value="30" ${days === 30 ? 'selected' : ''}>30 дней</option><option value="90" ${days === 90 ? 'selected' : ''}>90 дней</option><option value="365" ${days === 365 ? 'selected' : ''}>Год</option></select></label><button class="btn btn-ghost btn-sm" onclick="loadAdminPanel()">Обновить</button></div>
      <div class="admin-metrics">
        <div class="admin-metric"><strong>${overview.users || 0}</strong><span>Пользователи</span><small>+${overview.periodUsers || 0} за период</small></div>
        <div class="admin-metric"><strong>${overview.universities || 0}</strong><span>Вузы</span></div>
        <div class="admin-metric"><strong>${overview.applications || 0}</strong><span>Заявки</span><small>+${overview.periodApplications || 0} за период</small></div>
        <div class="admin-metric"><strong>${overview.chatMessages || 0}</strong><span>Диалоги с ИИ</span><small>+${overview.periodChats || 0} за период</small></div>
        <div class="admin-metric" style="border-left:3px solid var(--warning,#f59e0b)"><strong>${milRequests.length + entRequests.length}</strong><span>На верификации</span></div>
      </div>
      <div id="verification-admin" class="admin-data-block"></div>
      <div class="admin-columns"><div class="admin-data-block"><div class="admin-block-title">Заявки по статусам</div>${statuses.map(item => `<div class="admin-list-row"><span>${escapeHtml(labels[item.status] || item.status)}</span><strong>${item.count}</strong></div>`).join('') || '<p class="admin-muted">Нет данных</p>'}</div><div class="admin-data-block"><div class="admin-block-title">Темы ИИ за период</div>${intents.map(item => `<div class="admin-list-row"><span>${escapeHtml(item.intent)}</span><strong>${item.count}</strong></div>`).join('') || '<p class="admin-muted">Нет данных</p>'}</div></div>
      <div class="admin-data-block admin-table-block"><div class="admin-block-title">Последние заявки <span>${applications.length}</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Пользователь</th><th>Вуз</th><th>Статус</th><th>Год</th></tr></thead><tbody>${applications.slice(0, 12).map(item => `<tr><td>${escapeHtml(item.username || item.email)}</td><td>${escapeHtml(item.short_name || item.university_name)}</td><td>${escapeHtml(labels[item.status] || item.status)}</td><td>${escapeHtml(item.academic_year || '')}</td></tr>`).join('') || '<tr><td colspan="4">Нет заявок</td></tr>'}</tbody></table></div></div>
      <div class="admin-data-block admin-table-block"><div class="admin-block-title">Последние пользователи <span>${users.length}</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Пользователь</th><th>Email</th><th>Заявки</th><th>Чаты</th></tr></thead><tbody>${users.slice(0, 12).map(item => `<tr><td>${escapeHtml(item.username || '')}${item.is_admin ? ' · ADMIN' : ''}</td><td>${escapeHtml(item.email)}</td><td>${item.applications}</td><td>${item.chats}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="admin-reviews-head"><strong>Модерация отзывов</strong><span>${overview.pendingReviews || 0} требуют проверки</span></div>
      <div class="admin-review-list">
        ${reviews.length ? reviews.map(review => `
          <article class="admin-review-item" data-admin-review-id="${review.id}">
            <div class="admin-review-top"><strong>${escapeHtml(review.short_name || review.university_name)}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div>
            <div class="admin-review-meta">${escapeHtml(review.user_name)} · ${formatDate(review.created_at)}</div>
            <p>${escapeHtml(review.comment || review.pros || review.cons || 'Без текста')}</p>
            <div class="admin-review-actions">
              <button class="btn btn-primary btn-sm" onclick="moderateAdminReview(${review.id}, true)">${review.moderation_status === 'approved' ? 'Одобрено' : 'Одобрить'}</button>
              <button class="btn btn-ghost btn-sm" onclick="moderateAdminReview(${review.id}, false)">Скрыть</button>
              <button class="btn btn-ghost btn-sm admin-danger-btn" onclick="deleteAdminReview(${review.id})">Удалить</button>
            </div>
          </article>
        `).join('') : '<div class="profile-empty">Отзывов пока нет</div>'}
      </div>`;
    await Verification.admin();
  } catch (error) {
    container.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

function changeAdminPeriod(days) {
  const container = document.getElementById('admin-panel-content');
  if (!container) return;
  container.dataset.days = String(days);
  loadAdminPanel();
}

async function moderateAdminReview(id, approved) {
  try {
    await Auth.moderateReview(id, approved);
    await loadAdminPanel();
  } catch (error) { showToast(error.message, 'error'); }
}

async function deleteAdminReview(id) {
  try {
    await Auth.deleteAdminReview(id);
    await loadAdminPanel();
  } catch (error) { showToast(error.message, 'error'); }
}

async function reviewVerifyRequest(type, id, action) {
  const label = type === 'military' ? 'военную службу' : 'ЕНТ';
  const msg = action === 'approve' ? `Одобрить заявку на ${label}?` : `Отклонить заявку на ${label}?`;
  if (!confirm(msg)) return;
  try {
    if (type === 'military') {
      await Auth.reviewMilitary(id, action);
    } else {
      await Auth.reviewEnt(id, action);
    }
    showToast(action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена', 'success');
    await loadAdminPanel();
  } catch (error) { showToast(error.message, 'error'); }
}
