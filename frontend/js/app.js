/* =============================================
   EDUMATCH KZ — APP LOGIC
   ============================================= */

const API = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';

// ─── STATE ───────────────────────────────────
const state = window.state = {
  universities: [],
  universityVisibleCount: 6,
  compareList: [],   // array of ids (max 3)
  favoriteList: [],  // array of ids (from localStorage)
  trackerList: [],   // array of {id, university_id, name, status, added_at, notes}
  chatHistory: [],
  chatHistoryLoaded: false,
  admissionLastResult: null,
  currentPage: 'home',
  currentParam: null,
  pageHistory: [],
  skipPageHistory: false,
  chatReplyDraft: null,
  trackerServerLoaded: false,
};

function saveSessionChatHistory() {
  try {
    sessionStorage.removeItem('edumatch_chat_history');
  } catch (e) {
    console.warn('Failed to clear stale session chat history', e);
  }
}

function loadSessionChatHistory() {
  state.chatHistory = [];
  try {
    sessionStorage.removeItem('edumatch_chat_history');
  } catch (e) {
    console.warn('Failed to clear stale session chat history', e);
  }
}

async function hydrateAdvisorChatHistory() {
  if (state.chatHistoryLoaded) return;
  state.chatHistoryLoaded = true;

  loadSessionChatHistory();

  const msgs = document.getElementById('chat-messages');
  if (msgs) {
    if (state.chatHistory.length > 0) {
      const existingWelcome = msgs.querySelector('.chat-welcome');
      if (existingWelcome) existingWelcome.remove();
      state.chatHistory.forEach(item => appendMessage(item.role, item.content));
    }
  }
}

// ─── TRACKER (localStorage) ──────────────────
function loadTracker() {
  try {
    const saved = localStorage.getItem('edumatch_tracker');
    state.trackerList = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.trackerList = [];
  }
}

function saveTracker() {
  localStorage.setItem('edumatch_tracker', JSON.stringify(state.trackerList));
}

async function addToTracker(university) {
  if (state.trackerList.some(t => t.university_id === university.id)) return false;
  const localItem = {
    id: Date.now(),
    university_id: university.id,
    name: university.short_name || university.name,
    status: 'collecting',
    added_at: new Date().toISOString(),
    notes: '',
  };
  if (Auth.isLoggedIn()) {
    const result = await Auth.addApplication({ universityId: university.id });
    localItem.id = result.id;
  }
  state.trackerList.push(localItem);
  saveTracker();
  return true;
}

async function removeFromTracker(id) {
  if (Auth.isLoggedIn()) await Auth.removeApplication(id);
  state.trackerList = state.trackerList.filter(t => t.id !== id);
  saveTracker();
  return true;
}

async function handleTrackerRemove(id, button) {
  if (button) {
    button.disabled = true;
    button.textContent = '…';
  }
  try {
    await removeFromTracker(id);
    await renderProfileTracker();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = '×';
    }
    showToast(error.message || 'Не удалось удалить заявку', 'error');
  }
}

async function updateTrackerStatus(id, status) {
  return updateTrackerField(id, 'status', status);
}

async function updateTrackerNotes(id, notes) {
  return updateTrackerField(id, 'notes', notes);
}

async function updateTrackerField(id, field, value) {
  const item = state.trackerList.find(t => t.id === id);
  if (!item) return;
  try {
    if (Auth.isLoggedIn()) await Auth.updateApplication(id, { [field]: value });
    item[field === 'academicYear' ? 'academic_year' : field] = value;
    saveTracker();
    return true;
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить заявку', 'error');
    await renderProfileTracker();
    return false;
  }
}

const TRACKER_STATUSES = {
  collecting: { icon: '', label: 'Собираю документы', color: '#3b82f6' },
  submitted: { icon: '', label: 'Подал заявку', color: '#f59e0b' },
  waiting: { icon: '', label: 'Жду ответа', color: '#8b5cf6' },
  accepted: { icon: '', label: 'Зачислен', color: '#22c55e' },
  rejected: { icon: '', label: 'Не прошёл', color: '#ef4444' },
  enrolled: { icon: '', label: 'Оплачиваю', color: '#06b6d4' },
};

async function handleTrackerAdd(universityId, universityName) {
  const existing = state.trackerList.find(t => t.university_id === universityId);
  if (existing) {
    showToast(universityName + ' уже в трекере', 'info');
    return;
  }
  try {
    await addToTracker({ id: universityId, short_name: universityName, name: universityName });
  } catch (error) {
    showToast(error.message || 'Не удалось добавить заявку', 'error');
    return;
  }
  showToast(universityName + ' добавлен в трекер');
  document.querySelectorAll(`.tracker-add-btn`).forEach(btn => {
    const onclickStr = btn.getAttribute('onclick') || '';
    if (onclickStr.includes(universityId)) {
      btn.classList.add('added');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> ${t('tracker.added') || 'В трекере'}`;
    }
  });
}

// ─── FAVORITES (localStorage) ────────────────
function loadFavorites() {
  try {
    const saved = localStorage.getItem('edumatch_favorites');
    state.favoriteList = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.favoriteList = [];
  }
}

function saveFavorites() {
  localStorage.setItem('edumatch_favorites', JSON.stringify(state.favoriteList));
}

async function toggleFavorite(id) {
  const wasFav = state.favoriteList.includes(id);

  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    try {
      if (wasFav) {
        await Auth.removeUniversity(id);
        state.favoriteList = state.favoriteList.filter(x => x !== id);
      } else {
        await Auth.saveUniversity(id);
        if (!state.favoriteList.includes(id)) state.favoriteList.push(id);
      }
      saveFavorites();
    } catch (e) {
      showToast(e.message || t('toast.save_error'));
      return;
    }
  } else {
    const idx = state.favoriteList.indexOf(id);
    if (idx > -1) {
      state.favoriteList.splice(idx, 1);
    } else {
      state.favoriteList.push(id);
    }
    saveFavorites();
    if (!wasFav) {
      showToast(t('toast.saved_offline'), 'warning');
    }
  }

  const btn = document.querySelector(`[data-favorite-btn="${id}"]`);
  if (btn) btn.classList.toggle('favorited', state.favoriteList.includes(id));

  const isFav = state.favoriteList.includes(id);
  if (isFav && !wasFav) showToast(t('toast.added_fav'), 'success');
  else if (!isFav && wasFav) showToast(t('toast.removed_fav'));
}

function isFavorited(id) {
  return state.favoriteList.includes(id);
}

// ─── ROUTER ──────────────────────────────────
function activateNavLink(page) {
  document.querySelectorAll('.nav-links .nav-link').forEach(link => {
    const handler = link.getAttribute('onclick') || '';
    link.classList.toggle('active', handler.includes(`navigate('${page}')`));
  });
  document.querySelectorAll('.mobile-nav-link[data-page]').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function updateBackButton() {
  const button = document.getElementById('global-back-button');
  if (!button) return;
  button.classList.toggle('is-visible', state.currentPage !== 'home');
}

function navigateBack() {
  history.back();
}

function navigate(page, param, pushBrowserHistory) {
  const isMobile = window.innerWidth <= 768;

  if (!state.skipPageHistory && (state.currentPage !== page || state.currentParam !== param)) {
    state.pageHistory.push({ page: state.currentPage, param: state.currentParam });
    if (state.pageHistory.length > 20) state.pageHistory.shift();
  }
  state.skipPageHistory = false;

  if (pushBrowserHistory !== false) {
    const url = param ? `#${page}/${param}` : `#${page}`;
    history.pushState({ page, param: param || null }, '', url);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  state.currentPage = page;
  state.currentParam = param || null;
  updateBackButton();
  window.scrollTo(0, 0);

  // Mobile advisor mode only when the user actually opens the advisor page
  document.body.classList.toggle('chat-page-active', page === 'advisor' && isMobile);
  document.body.classList.toggle('desktop-mode', !isMobile);
  updateStickyCompare();

  if (page === 'home') {
    document.getElementById('page-home').classList.add('active');
    activateNavLink('home');
    if (!state.universities.length) loadUniversities();
  } else if (page === 'university' && param) {
    document.getElementById('page-university').classList.add('active');
    loadUniversityDetail(param);
  } else if (page === 'compare') {
    document.getElementById('page-compare').classList.add('active');
    activateNavLink('compare');
    renderComparePage();
  } else if (page === 'grants') {
    document.getElementById('page-grants').classList.add('active');
    activateNavLink('grants');
    loadGrants();
  } else if (page === 'map') {
    document.getElementById('page-map').classList.add('active');
    activateNavLink('map');
    // Wait for DOM to be ready and element to have size
    setTimeout(() => {
      const mapContainer = document.getElementById('map-container');
      if (mapContainer && mapContainer.offsetHeight > 0) {
        loadMap();
      } else {
        setTimeout(loadMap, 500);
      }
    }, 200);
  } else if (page === 'tips') {
    document.getElementById('page-tips').classList.add('active');
    activateNavLink('tips');
    loadTips();
  } else if (page === 'advisor') {
    document.getElementById('page-advisor').classList.add('active');
    activateNavLink('advisor');
    hydrateAdvisorChatHistory();
  } else if (page === 'career') {
    document.getElementById('page-career').classList.add('active');
    activateNavLink('career');
    initCareerTest();
  } else if (page === 'login') {
    document.getElementById('page-login').classList.add('active');
  } else if (page === 'register') {
    document.getElementById('page-register').classList.add('active');
  } else if (page === 'profile') {
    document.getElementById('page-profile').classList.add('active');
    loadProfilePage();
  } else if (page === 'admission') {
    document.getElementById('page-admission').classList.add('active');
    activateNavLink('admission');
    initAdmissionPage();
  }
}


// ─── TRACKER PAGE ────────────────────────────
// ─── PROFILE PAGE ─────────────────────────
// loadProfilePage() определён в auth.js
// Здесь только вспомогательные функции для профиля

// ─── THEME ───────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function initLanguage() {
  const lang = window.currentLanguage || 'ru';
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById('lang-' + lang)?.classList.add('active');
  document.querySelectorAll('.mobile-lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
  applyTranslations();
  if (typeof applyTranslationsLegacy === 'function') applyTranslationsLegacy();
}

function applyTranslations() {
  const lang = window.currentLanguage || 'ru';
  const trans = window.translations && window.translations[lang] || window.translations.ru;
  
  // Карта селекторов и путей перевода
  const selectorMap = [
    // Навигация
    { selector: '.nav-links .nav-link:nth-child(1)', path: 'nav.universities' },
    { selector: '.nav-links .nav-link:nth-child(2)', path: 'nav.comparison' },
    { selector: '.nav-links .nav-link:nth-child(3)', path: 'nav.advisor' },
    { selector: '.nav-links .nav-link:nth-child(4)', path: 'nav.admission' },
    { selector: '.nav-links .nav-link:nth-child(5)', path: 'nav.career' },
    { selector: '.nav-links .nav-link:nth-child(6)', path: 'nav.grants' },
    { selector: '.nav-links .nav-link:nth-child(7)', path: 'nav.map' },
    { selector: '.nav-links .nav-link:nth-child(8)', path: 'nav.tips' },
    
    // Мобильное меню
    { selector: '.mobile-menu-title', path: 'menu.title' },
    
    // Главная страница
    { selector: '.hero-title .desktop-copy', path: 'home.hero_title' },
    { selector: '.hero-subtitle', path: 'home.hero_sub' },
    
    // Кнопки на главной странице
    { selector: '.hero-actions .btn-primary', path: 'home.hero_btn1' },
    
    // Карта  
    { selector: '#page-map .page-title', path: 'map.title' },
    { selector: '#page-map .page-sub', path: 'map.sub' },
    
    // Поиск на карте
    { selector: '#map-search', path: 'map.search', attr: 'placeholder' }
  ];
  
  if (!trans) return;  // Guard clause if translations not loaded
  
  selectorMap.forEach(item => {
    const el = document.querySelector(item.selector);
    if (el) {
      const value = getNestedTranslation(trans, item.path);
      if (value) {
        if (item.attr) {
          el.setAttribute(item.attr, value);
        } else {
          el.textContent = value;
        }
      }
    }
  });
}

function getNestedTranslation(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current[key] !== undefined) {
      current = current[key];
    } else {
      return null;
    }
  }
  return current;
}

// ─── UNIVERSITIES ────────────────────────────
async function loadUniversities() {
  startProgress();
  const grid = document.getElementById('uni-grid');
  const isMobile = window.innerWidth <= 768;
  grid.innerHTML = renderSkeletonGrid(isMobile ? 3 : 6);

  try {
    const sort = document.getElementById('filter-sort')?.value || 'qs_world';
    const priceMax = document.getElementById('filter-price')?.value || '';
    const specialty = document.getElementById('filter-specialty')?.value || '';
    const cityId = document.getElementById('filter-city')?.value || '';
    const isTop = document.getElementById('filter-top')?.value || '';
    const lang = document.getElementById('filter-language')?.value || '';

    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (priceMax) params.set('price_max', priceMax);
    if (specialty) params.set('specialty', specialty);
    if (cityId) params.set('city_id', cityId);
    if (isTop) params.set('is_top', isTop);
    if (lang) params.set('language', lang);
    params.set('lang', window.currentLanguage || 'ru');

    const res = await fetch(`${API}/universities?${params}`);
    let unis = await res.json();
    if (!Array.isArray(unis)) throw new Error('Invalid response');

    // Client-side search filter
    const search = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (search) {
      unis = unis.filter(u =>
        u.name.toLowerCase().includes(search) ||
        (u.short_name || '').toLowerCase().includes(search)
      );
    }

    state.universities = unis;
    state.universityVisibleCount = 6;
    renderUniversityGrid(unis);
    const statEl = document.getElementById('stat-unis');
    if (statEl) statEl.textContent = unis.length;
    stopProgress();
    // Refresh AOS for new cards
    setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
  } catch (e) {
    stopProgress();
    grid.innerHTML = `<div class="loading-state"><p style="color:var(--red)">${t('error.load_server')}</p><button class="btn btn-outline" onclick="loadUniversities()">${t('error.retry')}</button></div>`;
  }
}

async function loadSpecialties() {
  try {
    const res = await fetch(`${API}/specialties`);
    if (!res.ok) return;
    const data = await res.json();
    const specs = data.specialties || data;

    // Filter bar + mobile filter sheet (category-based with codes)
    const filterSelects = [
      document.getElementById('filter-specialty'),
      document.getElementById('sheet-specialty'),
    ].filter(Boolean);
    filterSelects.forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
      const seen = new Set();
      specs.forEach(spec => {
        const cat = spec.category || spec;
        if (seen.has(cat)) return;
        seen.add(cat);
        const catSpecs = specs.filter(s => (s.category || s) === cat);
        const opt = document.createElement('option');
        opt.value = cat;
        const codes = catSpecs.map(s => s.code).filter(Boolean);
        opt.textContent = codes.length > 0 ? `${cat} (${codes.length} прогр.)` : cat;
        sel.appendChild(opt);
      });
    });

    // Admission form (id-based)
    const admitSelect = document.getElementById('admit-specialty');
    if (admitSelect) {
      while (admitSelect.options.length > 1) admitSelect.remove(1);
      if (Array.isArray(specs)) {
        const groupedByCategory = {};
        specs.forEach(spec => {
          const cat = spec.category || 'Другое';
          if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
          groupedByCategory[cat].push(spec);
        });
        for (const [cat, catSpecs] of Object.entries(groupedByCategory)) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = cat;
          catSpecs.forEach(spec => {
            const opt = document.createElement('option');
            opt.value = spec.id;
            opt.textContent = spec.code ? `${spec.code} ${spec.name}` : spec.name;
            optgroup.appendChild(opt);
          });
          admitSelect.appendChild(optgroup);
        }
      }
    }
  } catch (e) { /* silent */ }
}

async function loadCities() {
  try {
    const res = await fetch(`${API}/cities`);
    const cities = await res.json();
    const selects = [
      document.getElementById('filter-city'),
      document.getElementById('sheet-city'),
      document.getElementById('admit-city')
    ].filter(Boolean);

    selects.forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
      cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city.id;
        opt.textContent = `${trRu(city.name)} (${city.count})`;
        sel.appendChild(opt);
      });
    });
  } catch (e) { /* silent */ }
}

function renderUniversityGrid(unis) {
  const grid = document.getElementById('uni-grid');
  if (!unis.length) {
    grid.innerHTML = `<div class="loading-state"><p>${t('error.no_unis_found')}</p></div>`;
    return;
  }

  const visibleCount = Math.min(state.universityVisibleCount, unis.length);
  const visibleUnis = unis.slice(0, visibleCount);
  const remainingCount = unis.length - visibleCount;
  const showMoreLabel = t('universities.show_more') || 'Показать ещё';

  grid.innerHTML = `
    ${visibleUnis.map(u => renderUniversityCard(u)).join('')}
    ${remainingCount > 0 ? `
      <button type="button" class="uni-show-more" onclick="showMoreUniversities()">
        <span>${showMoreLabel}</span>
        <span class="uni-show-more-count">${remainingCount}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    ` : ''}
  `;
}

function showMoreUniversities() {
  state.universityVisibleCount += 6;
  renderUniversityGrid(state.universities);
}

/**
 * Render skeleton card (for loading state)
 */
function renderSkeletonCard() {
  return `
    <div class="skeleton-card">
      <div class="sk-head">
        <div class="sk-badge"></div>
        <div class="sk-rank"></div>
      </div>
      <div class="sk-title"></div>
      <div class="sk-desc"><div class="sk-line"></div><div class="sk-line short"></div></div>
      <div class="sk-price">
        <div class="sk-line" style="width:60%"></div>
        <div class="sk-line" style="width:40%;height:12px;margin-top:4px"></div>
      </div>
      <div class="sk-tags"><div class="sk-tag"></div><div class="sk-tag"></div><div class="sk-tag"></div></div>
      <div class="sk-actions"><div class="sk-btn"></div><div class="sk-btn"></div></div>
    </div>
  `;
}

/**
 * Render multiple skeleton cards
 */
function renderSkeletonGrid(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += renderSkeletonCard();
  }
  return `<div class="uni-grid">${html}</div>`;
}

function renderUniversityCard(u) {
  const isSelected = state.compareList.includes(u.id);
  const isFav = isFavorited(u.id);
  const websiteUrl = normalizeWebsiteUrl(u.website);
  const specialties = u.specialties || [];
  const shown = specialties.slice(0, 4);
  const rest = specialties.length - 4;

  const qs = u.qs_world
    ? `<div class="uni-qs-badge"><span class="qs-label">QS World</span><span class="qs-value">#${u.qs_world}</span></div>`
    : u.qs_asia
      ? `<div class="uni-qs-badge"><span class="qs-label">QS Asia</span><span class="qs-value">#${u.qs_asia}</span></div>`
      : '';

  const specTags = shown.map(s =>
    `<span class="specialty-tag">${trRu(s.name)}</span>`
  ).join('') + (rest > 0 ? `<span class="specialty-tag specialty-tag-more">+${rest}</span>` : '');

  const contactLine = (u.admission_phone || u.admission_email) ? `
    <div class="uni-contact-row">
      ${u.admission_phone ? `<a href="tel:${u.admission_phone.split('\n')[0].replace(/[\s\-\(\)]/g,'')}" class="uni-contact-item" onclick="event.stopPropagation()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        ${u.admission_phone.split('\n')[0]}
      </a>` : ''}
      ${u.admission_email ? `<a href="mailto:${u.admission_email}" class="uni-contact-item" onclick="event.stopPropagation()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
        ${u.admission_email}
      </a>` : ''}
    </div>
  ` : '';

  return `
    <div class="uni-card" id="card-${u.id}">
      <div class="uni-card-header-actions">
        <div class="uni-card-header">
          <span class="uni-short-name">${trRu(u.short_name) || trRu(u.name).split(' ')[0]}</span>
          ${qs}
        </div>
        <button class="btn-favorite ${isFav ? 'favorited' : ''}" data-favorite-btn="${u.id}" onclick="toggleFavorite(${u.id}); event.stopPropagation();" title="${t('card.add_fav')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <div class="uni-name">${trRu(u.name)}</div>
      ${u.data_status === 'pending' ? `<div class="uni-data-pending">${t('card.data_pending') || 'Данные уточняются'}</div>` : ''}
      <div class="uni-description">${u.description || ''}</div>
      <div class="uni-price-row">
        ${u.is_free
          ? `<span class="price-from" style="color:#16a34a;font-weight:700">${t('card.free') || 'Бесплатно'}</span>`
          : `<span class="price-label">${t('card.from')}</span>
             <span class="price-from">${fmtPrice(u.price_from)}</span>
             <span class="price-to"> — ${fmtPrice(u.price_to)}</span>
             <span class="price-period">${t('card.tenge_year')}</span>`
        }
      </div>
      ${u.address ? `<div class="uni-address">${escapeHtml(u.address)}</div>` : ''}
      ${contactLine}
      <div class="uni-specialties">${specTags}</div>
      <div class="uni-card-actions">
        <button class="btn btn-sm btn-compare ${isSelected ? 'selected' : ''}" onclick="toggleCompare(${u.id}, event)" title="${isSelected ? t('card.in_compare') : t('card.compare_add')}" aria-label="${isSelected ? t('card.in_compare') : t('card.compare_add')}">
          <svg class="card-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isSelected ? '<path d="m5 12 4 4L19 6"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg>
          <span>${isSelected ? t('card.in_compare') : t('card.compare_add')}</span>
        </button>
        ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" onclick="event.stopPropagation()"><svg class="card-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg><span>${t('card.website')}</span></a>` : ''}
        <button class="btn btn-sm btn-detail" onclick="navigate('university', ${u.id})" title="${t('card.details')}" aria-label="${t('card.details')}"><span>${t('card.details')}</span><svg class="card-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></button>
      </div>
    </div>
  `;
}

function applyFilters() {
  loadUniversities();
}

function resetFilters() {
  const filterPairs = [
    ['filter-top', 'sheet-top'],
    ['filter-city', 'sheet-city'],
    ['filter-specialty', 'sheet-specialty'],
    ['filter-price', 'sheet-price'],
    ['filter-language', 'sheet-language'],
    ['filter-sort', 'sheet-sort']
  ];
  filterPairs.forEach(([desktopId, sheetId]) => {
    const value = desktopId === 'filter-sort' ? 'qs_world' : '';
    const desktop = document.getElementById(desktopId);
    const sheet = document.getElementById(sheetId);
    if (desktop) desktop.value = value;
    if (sheet) sheet.value = value;
  });
  const search = document.getElementById('search-input');
  if (search) search.value = '';
  loadUniversities();
}

// ─── COMPARE ─────────────────────────────────
function toggleCompare(id, event) {
  event.stopPropagation();
  const idx = state.compareList.indexOf(id);

  if (idx > -1) {
    state.compareList.splice(idx, 1);
  } else {
    if (state.compareList.length >= 3) {
      showToast(t('toast.max_compare'));
      return;
    }
    state.compareList.push(id);
  }

  updateCompareBadge();
  // Re-render affected card
  const uni = state.universities.find(u => u.id === id);
  if (uni) {
    const card = document.getElementById(`card-${id}`);
    if (card) card.outerHTML = renderUniversityCard(uni);
  }
}

function updateCompareBadge() {
  const count = state.compareList.length;
  // Desktop nav badge
  const badge = document.getElementById('compare-badge');
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
  // Mobile menu badge
  const badgeMob = document.getElementById('compare-badge-mob');
  if (badgeMob) { badgeMob.textContent = count; badgeMob.style.display = count > 0 ? 'inline-flex' : 'none'; }
  // Bottom nav badge
  const bnavBadge = document.getElementById('bnav-badge');
  if (bnavBadge) { bnavBadge.textContent = count; bnavBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
  // Sticky compare bar
  updateStickyCompare();
}

async function renderComparePage() {
  const content = document.getElementById('compare-content');

  if (state.compareList.length < 2) {
    content.innerHTML = `
      <div class="compare-empty">
        <div class="compare-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
        </div>
        <p>${t('compare_page.add_minimum')}</p>
        <button class="btn btn-primary" onclick="navigate('home')">${t('compare_page.choose_unis')}</button>
      </div>`;
    return;
  }

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const res = await fetch(`${API}/compare?ids=${state.compareList.join(',')}&lang=${window.currentLanguage || 'ru'}`);
    const unis = await res.json();
    renderCompareTable(unis, content);
  } catch (e) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--red)">${t('error.load_error')}</p></div>`;
  }
}

function renderCompareTable(unis, container) {
  const minPrice = Math.min(...unis.map(u => u.price_from));
  const bestQs = Math.min(...unis.map(u => u.qs_world || 9999));

  const rows = [
    { label: t('compare_page.short_name'), key: u => u.short_name || '—' },
    { label: t('compare_page.city'), key: u => trRu(u.city_name) || '—' },
    { label: t('compare_page.founded'), key: u => u.founded || '—' },
    { label: t('compare_page.students'), key: u => u.students_count ? u.students_count.toLocaleString('ru') : '—' },
    { label: 'QS World', key: u => u.qs_world ? `#${u.qs_world}` : '—', isQs: true },
    { label: 'QS Asia', key: u => u.qs_asia ? `#${u.qs_asia}` : '—' },
    { label: t('compare_page.min_price_year'), key: u => fmtPrice(u.price_from) + ' ' + t('common.tenge'), isPrice: true, best: minPrice },
    { label: t('compare_page.max_price_year'), key: u => fmtPrice(u.price_to) + ' ' + t('common.tenge') },
    { label: t('compare_page.price_4yr'), key: u => fmtPrice(u.price_from * 4) + ' ' + t('common.tenge') },
    { label: t('compare_page.specialties_count'), key: u => (u.specialties || []).length },
    { label: t('compare_page.website_label'), key: u => {
      const href = normalizeWebsiteUrl(u.website);
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${formatWebsiteLabel(u.website)}</a>`
        : '—';
    }},
  ];

  const headers = unis.map(u => `<th><div class="compare-uni-head">${trRu(u.name)}</div></th>`).join('');
  const trs = rows.map(row => {
    const cells = unis.map(u => {
      const val = row.key(u);
      let cls = '';
      if (row.isPrice && u.price_from === row.best) cls = 'compare-best';
      if (row.isQs && u.qs_world === bestQs) cls = 'compare-best';
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    return `<tr><td>${row.label}</td>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="compare-header-actions">
      <h2 class="section-title" style="flex:1">${t('compare_page.title')}</h2>
      <button class="btn btn-outline btn-clear" onclick="clearCompare()">${t('compare_page.clear')}</button>
      <button class="btn btn-ghost" onclick="navigate('home')">${t('compare_page.add_more')}</button>
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr><th>${t('compare_page.param')}</th>${headers}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <div style="margin-top:24px;padding:20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:var(--radius-md)">
      <p style="font-size:13px;color:var(--text-secondary)"><strong style="color:var(--accent)">${t('compare_page.finance_advice')}</strong> ${t('compare_page.price_diff')} <strong style="color:var(--text)">${fmtPrice((Math.max(...unis.map(u=>u.price_to)) - Math.min(...unis.map(u=>u.price_from))) * 4)} ${t('common.tenge')}</strong>. ${t('compare_page.budget_tip')}</p>
    </div>`;
}

function clearCompare() {
  state.compareList = [];
  updateCompareBadge();
  updateStickyCompare();
  if (state.universities.length) renderUniversityGrid(state.universities);
  renderComparePage();
}

// ─── UNIVERSITY DETAIL ───────────────────────
async function loadUniversityDetail(id) {
  const content = document.getElementById('uni-detail-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const res = await fetch(`${API}/universities/${id}?lang=${window.currentLanguage || 'ru'}`);
    const u = await res.json();
    renderUniversityDetail(u, content);
  } catch (e) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--red)">${t('error.load_error')}</p><button class="btn btn-outline" onclick="navigate('home')">${t('error.go_home')}</button></div>`;
  }
}

// ─── SVG ICONS ──────────────────────────────
const getSVGIcon = (name) => {
  const icons = {
    globe: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    checkmark: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    building: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="9" x2="9" y2="21"></line><line x1="15" y1="9" x2="15" y2="21"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
    money: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M4 12a8 8 0 0 0 16 0A8 8 0 0 0 4 12"></path><path d="M12 2a8 8 0 0 1 0 16 8 8 0 0 1 0-16"></path></svg>`,
    target: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="9"></circle></svg>`,
    graduation: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    phone: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    email: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`,
    chat: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    book: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`
  };
  return icons[name] || '';
};

function renderUniversityDetail(u, container) {
  const specialties = u.specialties || [];
  const byCategory = {};
  specialties.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s.name);
  });

  const qs4 = u.price_from * 4;
  const qsMax4 = u.price_to * 4;

  const qsBadge = u.qs_world
    ? `<span class="detail-badge badge-qs">QS World #${u.qs_world}</span>`
    : u.qs_asia
      ? `<span class="detail-badge badge-qs">QS Asia #${u.qs_asia}</span>`
      : '';

  const specCats = Object.entries(byCategory).map(([cat, names]) => `
    <div>
      <div class="spec-category-name">${trRu(cat)}</div>
      <div class="spec-tags">${names.map(n => `<span class="spec-tag" onclick="showProfessionAnalysis('${n.replace(/'/g, "\\'")}')">${trRu(n)}</span>`).join('')}</div>
    </div>
  `).join('');

  // Парсим JSON поля
  const languages = u.languages ? (typeof u.languages === 'string' ? JSON.parse(u.languages) : u.languages) : [];
  const accreditations = u.accreditations ? (typeof u.accreditations === 'string' ? JSON.parse(u.accreditations) : u.accreditations) : [];

  // Форматирование языков
  const languagesHTML = languages.length ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('globe')} ${t('uni_detail_page.languages')}</div>
      <div class="tags-list">${languages.map(lang => `<span class="tag-pill">${lang}</span>`).join('')}</div>
    </div>
  ` : '';

  // Форматирование аккредитаций
  const accreditationsHTML = accreditations.length ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('checkmark')} ${t('uni_detail_page.accreditations')}</div>
      <div class="tags-list">${accreditations.map(acc => `<span class="tag-pill">${acc}</span>`).join('')}</div>
    </div>
  ` : '';

  // Информация об общежитии
  const dormitoryHTML = `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('building')} ${t('uni_detail_page.dormitory')}</div>
      <div class="info-block-content">
        ${u.has_dorm ? `
          <div class="info-row">
            <span>${t('uni_detail_page.available')}</span>
            <span style="color: var(--success);">${t('uni_detail_page.yes')}</span>
          </div>
          ${u.dorm_price ? `
            <div class="info-row">
              <span>${t('uni_detail_page.price_year')}</span>
              <span>${fmtPrice(u.dorm_price)} ${t('common.tenge')}</span>
            </div>
          ` : ''}
        ` : `
          <div class="info-row">
            <span>${t('uni_detail_page.available')}</span>
            <span style="color: #999;">${t('uni_detail_page.no')}</span>
          </div>
        `}
      </div>
    </div>
  `;

  // Средняя зарплата выпускников
  const salaryHTML = u.avg_salary ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('money')} ${t('uni_detail_page.avg_salary')}</div>
      <div class="info-block-content">
        <div class="salary-amount">${fmtPrice(u.avg_salary)} ${t('common.tenge')}</div>
        <div class="salary-note">${t('uni_detail_page.per_month')}</div>
      </div>
    </div>
  ` : '';

  // Проходной балл ЕНТ
  const entHTML = u.ent_threshold ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('target')} ${t('uni_detail_page.ent_score')}</div>
      <div class="info-block-content">
        <div class="ent-score">${u.ent_threshold}</div>
        <div class="ent-note">${t('uni_detail_page.ent_note')}</div>
      </div>
    </div>
  ` : '';

  // Стипендии и гранты (плейсхолдер, можно заполнить из API)
  const scholarshipsHTML = u.grants ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('graduation')} ${t('uni_detail_page.scholarships')}</div>
      <div class="info-block-content">
        <div style="color: var(--text-secondary);">
          ${t('uni_detail_page.fin_programs')}
        </div>
        <ul class="grants-list">
          <li>${t('uni_detail_page.gov_grants')}</li>
          <li>${t('uni_detail_page.named_scholarships')}</li>
          <li>${t('uni_detail_page.bolashak')}</li>
          <li>${t('uni_detail_page.corp_grants')}</li>
        </ul>
      </div>
    </div>
  ` : '';

  // Контакты приемной комиссии (плейсхолдер)
  const contactsHTML = `
    <div class="info-block">
      <div class="info-block-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        ${t('uni_detail_page.contacts_title')}
      </div>
      <div class="info-block-content">
        ${u.admission_phone ? u.admission_phone.split('\n').map((ph, i) => `
          <div class="info-row info-contact-row">
            ${i === 0 ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>` : '<span style="width:14px;display:inline-block"></span>'}
            <a href="tel:${ph.replace(/[\s\-\(\)]/g,'')}" style="color: var(--primary)">${ph}</a>
          </div>
        `).join('') : `<div style="color: #999;">${t('uni_detail_page.no_contacts')}</div>`}
        ${u.admission_email ? `
          <div class="info-row info-contact-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
            <a href="mailto:${u.admission_email}" style="color: var(--primary)">${u.admission_email}</a>
          </div>
        ` : ''}
        ${u.admission_whatsapp ? `
          <div class="info-row info-contact-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <a href="https://wa.me/${u.admission_whatsapp.replace(/\D/g, '')}" target="_blank" style="color: var(--primary)">${u.admission_whatsapp}</a>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="uni-detail">
      <div class="uni-detail-hero">
        <div>
          <div class="detail-badges">
            ${qsBadge}
            <span class="detail-badge badge-city">${trRu(u.city_name) || '—'}</span>
            ${u.founded ? `<span class="detail-badge badge-city">${t('compare_page.founded')} ${u.founded}</span>` : ''}
          </div>
          <h1 class="detail-title">${trRu(u.name)}</h1>
          <div class="detail-short">${trRu(u.short_name) || ''}</div>
          <p class="detail-desc">${u.description || ''}</p>
          <div class="detail-actions">
            ${normalizeWebsiteUrl(u.website) ? `<a href="${normalizeWebsiteUrl(u.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">${t('uni_detail_page.official_site')}</a>` : ''}
            <button class="btn btn-ghost" onclick="addToCompareAndGo(${u.id})">${t('uni_detail_page.add_compare')}</button>
            <button class="btn btn-ghost" onclick="navigate('advisor')">${t('uni_detail_page.ask_ai')}</button>
          </div>
        </div>
        <div>
          <div class="detail-card">
            <div class="detail-card-title">${t('uni_detail_page.price_title')}</div>
            ${u.is_free
              ? `<div class="detail-price-main" style="color:#16a34a">${t('card.free') || 'Бесплатно'}</div>
                 <div class="detail-price-note">${t('uni_detail_page.free_note') || 'Государственное обучение'}</div>`
              : `<div class="detail-price-main">${fmtPrice(u.price_from)} ${t('common.tenge')}</div>
                 <div class="detail-price-note">${t('uni_detail_page.min_price_note')}</div>
                 <div class="detail-stat-row">
                   <span class="detail-stat-label">${t('uni_detail_page.max_year')}</span>
                   <span class="detail-stat-val">${fmtPrice(u.price_to)} ${t('common.tenge')}</span>
                 </div>
                 <div class="detail-price-total">
                   <div class="detail-price-total-label">${t('uni_detail_page.four_years')}</div>
                   <div class="detail-price-total-val">${fmtPrice(qs4)} — ${fmtPrice(qsMax4)} ${t('common.tenge')}</div>
                 </div>`
            }
            ${u.students_count ? `
              <div class="detail-stat-row" style="margin-top:16px">
                <span class="detail-stat-label">${t('uni_detail_page.students_count')}</span>
                <span class="detail-stat-val">${u.students_count.toLocaleString('ru')}</span>
              </div>` : ''}
            ${u.qs_world ? `
              <div class="detail-stat-row">
                <span class="detail-stat-label">QS World Ranking</span>
                <span class="detail-stat-val" style="color:var(--gold)">#${u.qs_world}</span>
              </div>` : ''}
            ${u.qs_asia ? `
              <div class="detail-stat-row">
                <span class="detail-stat-label">QS Asia Ranking</span>
                <span class="detail-stat-val" style="color:var(--gold)">#${u.qs_asia}</span>
              </div>` : ''}
          </div>
        </div>
      </div>
      
      <div class="detail-sections">
        ${languagesHTML}
        ${accreditationsHTML}
        ${dormitoryHTML}
        ${salaryHTML}
        ${entHTML}
        ${scholarshipsHTML}
        ${contactsHTML}
      </div>

      ${specCats ? `
        <div class="detail-specialties-section">
          <h2 class="detail-specialties-title">${getSVGIcon('book')} ${t('uni_detail_page.faculties')}</h2>
          <div class="specialties-by-category">${specCats}</div>
        </div>` : ''}

      <div id="reviews-section" class="detail-specialties-section">
        <h2 class="detail-specialties-title">Отзывы студентов</h2>
        <div id="reviews-content"><div class="loading-state"><div class="spinner"></div></div></div>
      </div>
    </div>`;

  loadReviews(u.id);
}

async function submitUniversityReview(universityId, form) {
  const formData = new FormData(form);
  const payload = {
    user_name: (formData.get('user_name') || '').toString().trim(),
    rating: Number(formData.get('rating') || 0),
    faculty: (formData.get('faculty') || '').toString().trim(),
    study_year: (formData.get('study_year') || '').toString().trim(),
    pros: (formData.get('pros') || '').toString().trim(),
    cons: (formData.get('cons') || '').toString().trim(),
    comment: (formData.get('comment') || '').toString().trim(),
  };

  if (!payload.user_name || !payload.rating || payload.rating < 1 || payload.rating > 5) {
    showToast('Укажите имя и оценку от 1 до 5', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/universities/${universityId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка отправки отзыва');
    form.reset();
    showToast('Отзыв добавлен', 'success');
    loadReviews(universityId);
  } catch (e) {
    showToast(e.message || 'Не удалось отправить отзыв', 'error');
  }
}

async function loadReviews(universityId) {
  const container = document.getElementById('reviews-content');
  if (!container) return;
  try {
    const res = await fetch(`${API}/universities/${universityId}/reviews`);
    const data = await res.json();
    const avgRating = data.stats?.avg_rating ? Number(data.stats.avg_rating).toFixed(1) : '—';
    const starStr = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
    const hasReviews = Array.isArray(data.reviews) && data.reviews.length > 0;

    let html = `
      <div class="review-form-wrap">
        <form class="review-form" data-university-id="${universityId}">
          <div class="review-form-grid">
            <label>
              <span>Ваше имя</span>
              <input type="text" name="user_name" maxlength="80" placeholder="Например: Алиса" required>
            </label>
            <label>
              <span>Оценка</span>
              <select name="rating" required>
                <option value="">Выберите</option>
                <option value="5">5 — отлично</option>
                <option value="4">4 — хорошо</option>
                <option value="3">3 — нормально</option>
                <option value="2">2 — плохо</option>
                <option value="1">1 — очень плохо</option>
              </select>
            </label>
            <label>
              <span>Факультет</span>
              <input type="text" name="faculty" maxlength="120" placeholder="Например: IT">
            </label>
            <label>
              <span>Курс</span>
              <input type="text" name="study_year" maxlength="40" placeholder="Например: 2 курс">
            </label>
          </div>
          <label>
            <span>Плюсы</span>
            <textarea name="pros" rows="2" maxlength="500" placeholder="Что понравилось?"></textarea>
          </label>
          <label>
            <span>Минусы</span>
            <textarea name="cons" rows="2" maxlength="500" placeholder="Что можно улучшить?"></textarea>
          </label>
          <label>
            <span>Комментарий</span>
            <textarea name="comment" rows="3" maxlength="1000" placeholder="Поделитесь впечатлениями о вузе"></textarea>
          </label>
          <button type="submit" class="btn btn-primary review-submit-btn">Оставить отзыв</button>
        </form>
      </div>
      <div class="reviews-summary">
        <span class="reviews-avg">Рейтинг: ${avgRating}</span>
        <span class="reviews-count">${data.stats?.count || 0} отзывов</span>
      </div>
      <div class="reviews-list">`;

    if (!hasReviews) {
      html += `<div class="review-empty">Пока нет отзывов. Будьте первым!</div>`;
    } else {
      data.reviews.forEach(r => {
        html += `<div class="review-card">
          <div class="review-head">
            <span class="review-name">${escapeAdmissionHtml(r.user_name)}</span>
            <span class="review-stars">${starStr(r.rating)}</span>
            <span class="review-meta">${escapeAdmissionHtml(r.faculty || '')} ${r.study_year ? '· ' + escapeAdmissionHtml(r.study_year) : ''}</span>
          </div>
          ${r.pros ? `<div class="review-pros"><strong>Плюсы:</strong> ${escapeAdmissionHtml(r.pros)}</div>` : ''}
          ${r.cons ? `<div class="review-cons"><strong>Минусы:</strong> ${escapeAdmissionHtml(r.cons)}</div>` : ''}
          ${r.comment ? `<div class="review-comment">${escapeAdmissionHtml(r.comment)}</div>` : ''}
        </div>`;
      });
    }

    html += `</div>`;
    container.innerHTML = html;

    const form = container.querySelector('.review-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitUniversityReview(universityId, form);
      });
    }
  } catch (e) {
    container.innerHTML = `<p style="color:var(--red)">Ошибка загрузки отзывов</p>`;
  }
}

function addToCompareAndGo(id) {
  if (!state.compareList.includes(id)) {
    if (state.compareList.length < 3) {
      state.compareList.push(id);
      updateCompareBadge();
      showToast(t('toast.added_compare'), 'success');
    } else {
      showToast(t('toast.max_3'));
    }
  }
  navigate('compare');
}

// ─── AI ADVISOR CHAT ─────────────────────────
// Rate limiting state
let lastMessageTime = 0;
const MESSAGE_DELAY = 1500; // ms between messages

function getAiInputErrorMessage(data) {
  const reason = data?.reason || '';
  const fallback = data?.error || 'Ошибка обработки запроса';

  const map = {
    blocked_terms: 'Сообщение содержит запрещённые выражения. Сформулируйте вопрос по вузам, ЕНТ, грантам или поступлению без запрещённых слов.',
    missing_required_terms: 'Запрос слишком короткий или не содержит нужного контекста о поступлении.',
    too_long: 'Сообщение слишком длинное. Уточните вопрос короче.',
    empty_input: 'Введите ваш вопрос.',
    missing_input: 'Пустой запрос. Попробуйте сформулировать вопрос заново.',
    invalid_message: 'Запрос не распознан. Попробуйте ещё раз.',
  };

  return map[reason] || fallback;
}

async function sendMessage(retryMessage = null) {
  const input = document.getElementById('chat-input');
  let text = retryMessage || input.value.trim();
  if (!text) return;
  const replyDraft = retryMessage ? null : state.chatReplyDraft;

  // Rate limiting check
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_DELAY) {
    showToast(t('toast.wait_please') || 'Подождите немного...', 'default');
    return;
  }
  lastMessageTime = now;

  if (!retryMessage) {
    input.value = '';
    autoResize(input);
    state.chatReplyDraft = null;
    clearReplyQuotePreview();
    document.querySelectorAll('.chat-bubble.reply-target').forEach(target => target.classList.remove('reply-target'));
    appendMessage('user', text, null, null, { replyQuote: replyDraft ? replyDraft.text : null });
    state.chatHistory.push({ role: 'user', content: text });
    saveSessionChatHistory();
    const intro = document.querySelector('.chat-intro');
    if (intro) intro.remove();
  }

  // Typing indicator
  const typingId = appendTyping();
  document.getElementById('chat-send').disabled = true;

  try {
    const res = await Auth.fetch('/ai/advice', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-20),
        replyTo: replyDraft ? replyDraft.text : null,
        applications: Auth.isLoggedIn() ? state.trackerList.map(item => ({
          university_id: item.university_id,
          name: item.name,
          status: item.status,
          academic_year: item.academic_year || '2026-2027',
          deadline: item.deadline || null,
          notes: item.notes || ''
        })) : [],
        lang: window.currentLanguage || 'ru',
      }),
      timeoutMs: 120000,
    });

    if (!res.ok && res.status === 429) {
      removeTyping(typingId);
      appendMessage('ai', t('error.too_many_requests') || 'Слишком много запросов. Подождите 1 минуту.', null, null, { retryFn: () => sendMessage(text) });
      document.getElementById('chat-send').disabled = false;
      return;
    }

    const data = await res.json();
    removeTyping(typingId);

    if (!data.success) {
      const errorMsg = getAiInputErrorMessage(data);
      appendMessage('ai', errorMsg, null, null, { retryFn: () => sendMessage(text) });
    } else {
      // Handle language switch
      if (data.detectedLang && data.detectedLang !== window.currentLanguage) {
        setLanguage(data.detectedLang);
        localStorage.setItem('edumatch_lang', data.detectedLang);
      }

      // Show AI answer
      if (data.intent === 'admission' && data.admission && data.admission.type === 'result') {
        appendMessage('ai', data.answer, [], data.admission);
      } else {
        appendMessage('ai', data.answer, data.matches);
      }
      state.chatHistory.push({ role: 'assistant', content: data.answer, intent: data.intent });
      saveSessionChatHistory();
      
      // Store intent in history for context
      if (state.chatHistory.length > 0) {
        state.chatHistory[state.chatHistory.length - 1].intent = data.intent;
      }
      
      // Show quick suggestions based on intent
      showQuickSuggestions(data.intent, text);
    }
  } catch (e) {
    console.error('[sendMessage] Error caught:', e.name, e.message, e.stack);
    removeTyping(typingId);
    const isTimeout = e.name === 'AbortError' || e.message.includes('timeout');
    const errorMsg = isTimeout 
      ? (t('error.timeout') || 'Сервер не отвечает')
      : (t('error.server_offline') || 'Сервер недоступен');
    
    appendMessage('ai', `${errorMsg}`, null, null, { retryFn: () => sendMessage(text) });
  }

  document.getElementById('chat-send').disabled = false;
}

function showQuickSuggestions(intent, userMessage) {
  const container = document.getElementById('chat-messages');
  
  let suggestions = [];
  const lang = window.currentLanguage || 'ru';
  
  if (lang === 'ru') {
    if (intent === 'city' || intent === 'recommendation') {
      suggestions = [
        'Покажи вузы на стипендию',
        'Какая средняя зарплата?',
        'Есть ли общежитие?'
      ];
    } else if (intent === 'admission') {
      suggestions = [
        'Покажи другие варианты',
        'Какие требования к ЕНТ?',
        'Есть ли гранты?'
      ];
    } else if (intent === 'grant') {
      suggestions = [
        'Какой минимальный балл?',
        'Есть ли ещё гранты?',
        'Какие вузы участвуют?'
      ];
    } else {
      suggestions = [
        'Какие вузы есть?',
        'Посоветуй специальность',
        'Сколько стоит обучение?'
      ];
    }
  } else if (lang === 'kk') {
    if (intent === 'city' || intent === 'recommendation') {
      suggestions = [
        'Стипендиялы университеттер',
        'Орташа жалақы қанша?',
        'Жатын ойы бар ма?'
      ];
    } else if (intent === 'admission') {
      suggestions = [
        'Басқа нұсқаларды көрсет',
        'ҰБТ талаптары қандай?',
        'Грант бар ма?'
      ];
    } else if (intent === 'grant') {
      suggestions = [
        'Ең төменгі балл қанша?',
        'Басқа грантар бар ма?',
        'Қандай университеттер?'
      ];
    } else {
      suggestions = [
        'Қандай университеттер бар?',
        'Мамандықтарды ұсын',
        'Оқу шығыны қанша?'
      ];
    }
  } else {
    if (intent === 'city' || intent === 'recommendation') {
      suggestions = [
        'Show universities with scholarships',
        'What\'s the average salary?',
        'Is there a dormitory?'
      ];
    } else if (intent === 'admission') {
      suggestions = [
        'Show other options',
        'What are the requirements?',
        'Are there grants?'
      ];
    } else if (intent === 'grant') {
      suggestions = [
        'What\'s the minimum score?',
        'Are there other grants?',
        'Which universities participate?'
      ];
    } else {
      suggestions = [
        'What universities are available?',
        'Suggest a specialty',
        'How much does it cost?'
      ];
    }
  }

  if (suggestions.length > 0) {
    const suggestDiv = document.createElement('div');
    suggestDiv.className = 'chat-suggestions';
    suggestDiv.innerHTML = `
      <div class="chat-suggestions-title">${lang === 'ru' ? 'Ещё вопросы:' : lang === 'kk' ? 'Қосымша сұрақтар:' : 'More questions:'}</div>
      <div class="chat-suggestions-list">
        ${suggestions.map(s => `<button class="chat-suggestion-btn" onclick="sendMessage(${JSON.stringify(s).replace(/"/g, '&quot;')})">${s}</button>`).join('')}
      </div>
    `;
    container.appendChild(suggestDiv);
    scrollChatToBottom();
  }
}

/**
 * Render university matches as professional cards
 */
function renderMatches(matches) {
  if (!matches || matches.length === 0) return '';

  let html = `
  <div class="chat-rec-header">
    <div class="chat-rec-title">
      ${t('chat_page.recommended')} (${matches.length})
    </div>
    <div class="chat-rec-grid">
  `;

  matches.slice(0, 5).forEach((u, idx) => {
    // Handle languages - can be array or comma-separated string
    let languages;
    if (Array.isArray(u.languages)) {
      languages = u.languages.join(', ') || t('chat_page.not_specified');
    } else if (typeof u.languages === 'string') {
      languages = u.languages || t('chat_page.not_specified');
    } else {
      languages = t('chat_page.not_specified');
    }
    
    const specs = (u.specialties || []).map(s => typeof s === 'string' ? s : s.name || s.category).filter(Boolean).slice(0, 3).join(', ') || 'N/A';
    const qs = u.qs_world ? `QS World: #${u.qs_world}` : (u.qs_asia ? `QS Asia: #${u.qs_asia}` : t('chat_page.no_ranking'));
    const priceRange = `${(u.price_from/1000000).toFixed(2)}–${(u.price_to/1000000).toFixed(2)}M ${t('common.tenge')}`;
    
    html += `
    <div class="chat-rec-card" onclick="navigate('university', ${u.id})">
      <div class="chat-rec-head">
        <div>
          <div class="chat-rec-uni-name">${trRu(u.short_name)}</div>
          <div class="chat-rec-uni-full">${trRu(u.name)}</div>
        </div>
        <div class="chat-rec-badge">${qs}</div>
      </div>
      <div class="chat-rec-details">
        <div>
          <div class="chat-rec-label">${t('chat_page.cost')}</div>
          <div class="chat-rec-value-accent">${priceRange}/${t('chat_page.year')}</div>
        </div>
        <div>
          <div class="chat-rec-label">${t('chat_page.study_lang')}</div>
          <div class="chat-rec-value">${languages}</div>
        </div>
        <div class="chat-rec-full">
          <div class="chat-rec-label">${t('chat_page.specs')}</div>
          <div class="chat-rec-value">${specs}${(u.specialties || []).length > 3 ? '...' : ''}</div>
        </div>
      </div>
      <div class="chat-rec-actions">
        <button class="chat-rec-btn-primary" onclick="event.stopPropagation(); navigate('university', ${u.id})">${t('admission_page.uni_details')}</button>
        <button class="chat-rec-btn-ghost" onclick="event.stopPropagation(); toggleFavorite(${u.id})">${state.favoriteList?.includes(u.id) ? t('chat_page.in_fav') : t('chat_page.add_fav')}</button>
      </div>
    </div>
    `;
  });

  html += `
    </div>
  </div>
  `;
  
  return html;
}

/**
 * Render admission prediction cards inside chat bubble
 */
function escapeAdmissionHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderAdmissionChatCards(matches, input, whatIf, academicYear) {
  if (!matches || matches.length === 0) return '';

  const yearLabel = academicYear ? ` · ${t('common.data_year') || 'Данные за'} ${academicYear}` : '';
  let html = `
  <div class="chat-admission-cards">
    <div class="chat-admission-header">
      <span class="chat-admission-badge">${t('chat_page.admission_badge')}</span>
      <span class="chat-admission-input">${t('admission_page.ent_label').replace(':','')} ${input?.ent || '—'} · ${input?.specialty || '—'}${yearLabel}</span>
    </div>
  `;

  matches.slice(0, 5).forEach((m, idx) => {
    const barClass = m.chance >= 80 ? 'chance-high' : m.chance >= 60 ? 'chance-mid' : 'chance-low';
    const rankIcon = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : `#${idx + 1}`;
    const portfolioClass = m.portfolio === 'safe' ? 'portfolio-safe' : m.portfolio === 'target' ? 'portfolio-target' : 'portfolio-ambitious';
    html += `
    <div class="chat-admission-card" onclick="navigate('university', ${m.university_id})">
      <div class="chat-admission-card-head">
        <div>
          <span class="chat-admission-rank">${rankIcon}</span>
          <span class="chat-admission-uni">${escapeAdmissionHtml(m.university)}</span>
          <span class="chat-admission-name">${escapeAdmissionHtml(trRu(m.name) || '')}</span>
        </div>
        <div class="chat-admission-chance ${barClass}">${m.chance}%</div>
      </div>
      <div class="chat-admission-bar">
        <div class="chat-admission-fill ${barClass}" style="width:${m.chance}%"></div>
      </div>
      <div class="chat-admission-meta">
        <span class="portfolio-badge ${portfolioClass}">${escapeAdmissionHtml(m.portfolioLabel || '')}</span>
        <span class="chat-admission-rec">${escapeAdmissionHtml(m.recommendation)}</span>
        <button class="tracker-add-btn ${state.trackerList.some(t => t.university_id === m.university_id) ? 'added' : ''}" onclick="event.stopPropagation(); handleTrackerAdd(${m.university_id}, '${escapeAdmissionHtml(m.university)}')">${state.trackerList.some(t => t.university_id === m.university_id) ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> ${t('tracker.added') || 'В трекере'}` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> ${t('tracker.add_to_tracker') || 'В трекер'}`}</button>
      </div>`;

    if (m.scoreBreakdown && m.scoreBreakdown.length > 0) {
      html += `<div class="score-breakdown">`;
      m.scoreBreakdown.forEach(f => {
        const pct = f.maxScore > 0 ? Math.max(0, Math.min(100, (f.score / f.maxScore) * 100)) : 0;
        const barColor = f.score < 0 ? 'score-negative' : pct >= 70 ? 'score-good' : pct >= 40 ? 'score-mid' : 'score-low';
        html += `
        <div class="score-factor">
          <div class="score-factor-label">${escapeAdmissionHtml(f.label)}</div>
          <div class="score-factor-bar-wrap">
            <div class="score-factor-bar ${barColor}" style="width:${f.maxScore > 0 ? pct : 0}%"></div>
          </div>
          <div class="score-factor-value">${f.score >= 0 ? '+' : ''}${f.score}/${f.maxScore}</div>
          <div class="score-factor-detail">${escapeAdmissionHtml(f.detail)}${f.impact ? ' ' + escapeAdmissionHtml(f.impact) : ''}</div>
        </div>`;
      });
      html += `</div>`;
    }

    html += `
      <ul class="chat-admission-reasons">
        ${(m.reasons || []).slice(0, 3).map(r => {
          const icon = r.type === 'positive' ? '' : r.type === 'negative' ? '' : '•';
          const cls = r.type === 'positive' ? 'reason-pos' : r.type === 'negative' ? 'reason-neg' : 'reason-neu';
          return `<li class="${cls}">${icon} ${escapeAdmissionHtml(r.text)}</li>`;
        }).join('')}
      </ul>
    </div>`;
  });

  if (whatIf && whatIf.length > 0) {
    html += `<div class="chat-whatif">`;
    html += `<div class="chat-whatif-title">${t('chat_page.what_if_title') || 'Что если ЕНТ вырастет?'}</div>`;
    whatIf.forEach(scenario => {
      html += `<div class="chat-whatif-item"><strong>+${scenario.ent - input.ent} ЕНТ (${scenario.ent}):</strong> `;
      html += scenario.universities.map(u => `${escapeAdmissionHtml(u.university)} ${u.from}%→${u.to}%`).join(', ');
      html += `</div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });
}

function appendMessage(role, text, matches = null, admission = null, options = {}) {
  const msgs = document.getElementById('chat-messages');

  // Remove welcome if present
  const welcome = msgs.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'ai'}`;
  div.style.animation = 'fadeInUp 0.3s ease both';

  // Use marked.js for AI responses, escaped plain text for user
  let content = role === 'ai' ? renderMarkdown(text) : `<p>${escapeHtml(text)}</p>`;
  if (role === 'user' && options.replyQuote) {
    const quoteText = String(options.replyQuote).trim();
    const shortQuote = quoteText.length > 180 ? quoteText.slice(0, 180) + '…' : quoteText;
    content = `<div class="chat-message-quote"><div class="chat-message-quote-label">Ответ на сообщение ИИ</div><div class="chat-message-quote-text">${escapeHtml(shortQuote)}</div></div>${content}`;
  }
  if (role === 'ai' && matches && matches.length > 0) {
    content += renderMatches(matches);
  }
  // Render admission prediction cards in chat
  if (admission && admission.type === 'result' && admission.matches && admission.matches.length > 0) {
    content += renderAdmissionChatCards(admission.matches, admission.input, admission.whatIf, admission.academicYear);
  }

  if (role === 'ai') {
    content = wrapExpandableAiMessage(content, text);
  }

  if (role === 'ai') {
    const lang = window.currentLanguage || 'ru';
    const copyText = lang === 'ru' ? 'Копировать' : lang === 'kk' ? 'Көшіру' : 'Copy';
    const replyText = lang === 'ru' ? 'Ответить' : lang === 'kk' ? 'Жауап беру' : 'Reply';
    const actionId = `chat-action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    content += `
      <div class="chat-bubble-actions" data-chat-action-id="${actionId}">
        <button type="button" class="chat-reply-btn" aria-label="${replyText}">${replyText}</button>
        <button type="button" class="chat-copy-btn" data-clipboard-text="${escapeHtml(String(text || '')).replace(/"/g, '&quot;')}">${copyText}</button>
      </div>
    `;
  }
  
  // Add retry button if provided
  if (role === 'ai' && options.retryFn) {
    const lang = window.currentLanguage || 'ru';
    const retryText = lang === 'ru' ? 'Повторить' : lang === 'kk' ? 'Қайталау' : 'Retry';
    // Store the retry function in window to avoid scope issues
    const retryId = 'retry_' + Date.now();
    window[retryId] = options.retryFn;
    content += `<div class="chat-error-actions" style="margin-top:12px;display:flex;gap:8px;"><button class="btn btn-sm btn-outline" onclick="window['${retryId}'](); delete window['${retryId}'];">${retryText}</button></div>`;
  }
  
  div.innerHTML = `<div class="chat-bubble chat-bubble-${role === 'user' ? 'user' : 'ai'} markdown-body">${content}</div>`;
  if (role === 'ai') {
    const toggle = div.querySelector('.chat-ai-expand-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const wrapper = toggle.closest('.chat-ai-expandable');
        if (!wrapper) return;
        const expanded = wrapper.classList.toggle('expanded');
        wrapper.classList.toggle('collapsed', !expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
      });
    }

    const copyBtn = div.querySelector('.chat-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const textToCopy = copyBtn.dataset.clipboardText || '';
        try {
          await navigator.clipboard.writeText(textToCopy);
          const original = copyBtn.textContent;
          copyBtn.textContent = (window.currentLanguage === 'en' ? 'Copied' : window.currentLanguage === 'kk' ? 'Көшірілді' : 'Скопировано');
          setTimeout(() => { copyBtn.textContent = original; }, 1200);
        } catch (e) {
          const range = document.createRange();
          const selection = window.getSelection();
          const target = div.querySelector('.chat-ai-expandable-body');
          if (target) {
            range.selectNodeContents(target);
            selection.removeAllRanges();
            selection.addRange(range);
            try { document.execCommand('copy'); } catch (err) {}
          }
        }
      });
    }

    const bubble = div.querySelector('.chat-bubble-ai');
    const replyBtn = div.querySelector('.chat-reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', () => {
        document.querySelectorAll('.chat-bubble.reply-target').forEach(target => target.classList.remove('reply-target'));
        if (bubble) bubble.classList.add('reply-target');
        applyReplyToInput(String(text || ''));
      });
    }

    if (bubble) {
      const showReplyToolbar = () => {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';
        if (!selectedText) {
          hideReplyToolbar();
          return;
        }

        if (selectedText.length < 2) {
          hideReplyToolbar();
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        const toolbar = document.getElementById('chat-selection-toolbar');
        if (!toolbar) {
          const toolbarEl = document.createElement('div');
          toolbarEl.id = 'chat-selection-toolbar';
          toolbarEl.className = 'chat-selection-toolbar';
          toolbarEl.innerHTML = '<button type="button" class="chat-selection-reply-btn">Ответить</button>';
          document.body.appendChild(toolbarEl);
          toolbarEl.querySelector('button').addEventListener('click', () => {
            applyReplyToInput(toolbarEl.selectedText || '');
            hideReplyToolbar();
            if (window.getSelection) {
              window.getSelection().removeAllRanges();
            }
          });
        }

        const toolbarEl = document.getElementById('chat-selection-toolbar');
        toolbarEl.selectedText = selectedText;
        const finalX = Math.min(Math.max(rect.left + (rect.width / 2) - 44, 12), window.innerWidth - 110);
        const finalY = Math.max(bubbleRect.top - 44, 12);
        toolbarEl.style.left = `${finalX}px`;
        toolbarEl.style.top = `${finalY}px`;
        toolbarEl.style.display = 'block';
      };

      const hideReplyToolbar = () => {
        const toolbar = document.getElementById('chat-selection-toolbar');
        if (toolbar) toolbar.style.display = 'none';
      };

      bubble.addEventListener('mouseup', showReplyToolbar);
      bubble.addEventListener('keyup', showReplyToolbar);
      bubble.addEventListener('mouseleave', hideReplyToolbar);
      document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) {
          hideReplyToolbar();
        }
      });
    }
  }
  msgs.appendChild(div);
  scrollChatToBottom();
}

function appendTyping() {
  const msgs = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-ai chat-msg-typing';
  div.id = id;
  div.innerHTML = `<div class="chat-bubble chat-bubble-ai chat-bubble-typing"><div class="chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  msgs.appendChild(div);
  scrollChatToBottom();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function clearReplyQuotePreview() {
  const preview = document.getElementById('chat-reply-preview');
  if (preview) {
    preview.classList.add('hidden');
    preview.querySelector('.chat-reply-body').textContent = '';
    preview.querySelector('.chat-reply-header').textContent = 'Ответ';
  }
  document.querySelectorAll('.chat-bubble.reply-target').forEach(target => target.classList.remove('reply-target'));
}

function renderReplyQuotePreview() {
  const wrap = document.querySelector('.chat-input-wrap');
  if (!wrap) return;

  let preview = document.getElementById('chat-reply-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'chat-reply-preview';
    preview.className = 'chat-reply-preview hidden';

    const header = document.createElement('div');
    header.className = 'chat-reply-header';
    header.textContent = 'Ответ';

    const body = document.createElement('div');
    body.className = 'chat-reply-body';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'chat-reply-clear';
    clearBtn.setAttribute('aria-label', 'Clear reply');
    clearBtn.innerHTML = '&times;';
    clearBtn.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (!input || !state.chatReplyDraft) return;
      state.chatReplyDraft = null;
      clearReplyQuotePreview();
      autoResize(input);
      input.focus();
    });

    preview.appendChild(header);
    preview.appendChild(body);
    preview.appendChild(clearBtn);
    wrap.insertBefore(preview, wrap.firstChild);
  }

  const body = preview.querySelector('.chat-reply-body');
  const header = preview.querySelector('.chat-reply-header');
  const input = document.getElementById('chat-input');

  if (!state.chatReplyDraft || !input) {
    clearReplyQuotePreview();
    return;
  }

  const draftText = state.chatReplyDraft.text.trim();
  const replyLabel = (window.currentLanguage === 'en' ? 'Replying to' : window.currentLanguage === 'kk' ? 'Жауап беру' : 'Ответ на');
  header.textContent = replyLabel;
  body.textContent = draftText.length > 180 ? draftText.slice(0, 180) + '…' : draftText;
  preview.classList.remove('hidden');
}

function applyReplyToInput(selectedText) {
  const input = document.getElementById('chat-input');
  if (!input || !selectedText || !selectedText.trim()) return;

  const cleanText = selectedText.trim();
  state.chatReplyDraft = { text: cleanText };
  renderReplyQuotePreview();

  input.focus();
  autoResize(input);
}

function usePrompt(btn) {
  const input = document.getElementById('chat-input');
  input.value = btn.textContent.trim();
  autoResize(input);
  input.focus();
}

// ─── HELPERS ─────────────────────────────────
function fmtPrice(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' ' + t('common.million');
  return (n / 1000).toFixed(0) + ' ' + t('common.thousand');
}

function trRu(name) {
  if (!name) return name || '';
  const lang = window.currentLanguage || 'ru';
  if (lang === 'ru') return name;
  const db = window.translations?.[lang]?.db_data;
  if (!db) return name;
  if (db.uni_short?.[name]) return db.uni_short[name];
  if (db.uni_full?.[name]) return db.uni_full[name];
  if (db.spec?.[name]) return db.spec[name];
  if (db.city?.[name]) return db.city[name];
  return name;
}

function normalizeWebsiteUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes('.')) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, '')}`;
}

function formatWebsiteLabel(url) {
  return normalizeWebsiteUrl(url)
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/* ─── NOTYF TOASTS ────────────────────────── */
let notyf;
function showToast(msg, type = 'default') {
  if (!notyf) {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'center', y: 'bottom' },
      ripple: true,
      dismissible: true,
      types: [
        { type: 'default', background: 'var(--text)', icon: false },
        { type: 'success', background: 'var(--green)', icon: { className: 'notyf-icon-success' } },
        { type: 'warning', background: 'var(--gold)', icon: false },
      ]
    });
  }
  if (type === 'success') notyf.success(msg);
  else if (type === 'warning') notyf.open({ type: 'warning', message: msg });
  else notyf.open({ type: 'default', message: msg });
}

/* ─── MARKED — markdown in chat ──────────── */
function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked === 'undefined') return `<p>${escapeHtml(text)}</p>`;
  try {
    const rawHtml = marked.parse(text, { breaks: true, gfm: true });
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
  } catch (e) {
    console.warn('Markdown render failed:', e);
    return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }
}

function wrapExpandableAiMessage(html, text) {
  const plainText = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plainText || plainText.length <= 500) {
    return html;
  }

  const lang = window.currentLanguage || 'ru';
  const label = lang === 'en' ? 'Show more' : lang === 'kk' ? 'Толығырақ көрсету' : 'Показать полностью';
  const collapseLabel = lang === 'en' ? 'Show less' : lang === 'kk' ? 'Азайту' : 'Свернуть';
  const id = `ai-expand-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `
    <div class="chat-ai-expandable expanded" data-ai-expand-id="${id}">
      <div class="chat-ai-expandable-body">${html}</div>
      <button type="button" class="chat-ai-expand-toggle" data-ai-expand-id="${id}" aria-expanded="true">
        <span class="chat-ai-expand-label">${label}</span>
        <span class="chat-ai-collapse-label">${collapseLabel}</span>
      </button>
    </div>
  `;
}

/* ─── NPROGRESS ───────────────────────────── */
function startProgress() {
  if (typeof NProgress !== 'undefined') {
    NProgress.configure({ showSpinner: false, trickleSpeed: 200 });
    NProgress.start();
  }
}
function stopProgress() {
  if (typeof NProgress !== 'undefined') NProgress.done();
}

/* ─── COUNTUP — animated hero stats ──────── */
function animateCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    if (typeof CountUp !== 'undefined' && !isNaN(target)) {
      new CountUp.CountUp(el, target, { duration: 2, useEasing: true }).start();
    }
  });
}

async function loadAcademicYear() {
  try {
    const response = await fetch(`${API}/admin/academic-year`);
    if (!response.ok) return;
    const { year } = await response.json();
    if (!/^\d{4}-\d{4}$/.test(year)) return;
    const displayYear = year.replace('-', '–');
    document.querySelectorAll('[data-academic-year]').forEach(element => {
      element.textContent = element.textContent.replace(/\d{4}[–-]\d{4}/, displayYear);
    });
  } catch (error) {
    console.warn('Academic year loading failed', error);
  }
}

/* ─── CONFETTI — on compare ──────────────── */
function celebrateCompare() {
  if (typeof confetti !== 'undefined') {
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 },
      colors: ['#2d6a4f', '#52b788', '#e9c46a', '#1a1917'] });
  }
}

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  loadFavorites();
  loadTracker();
  if (typeof Auth !== 'undefined') Auth.init();
  loadSpecialties();
  loadCities();

  const isMobile = window.innerWidth <= 768;

  // Handle browser back/forward buttons (mouse side buttons)
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page) {
      navigate(e.state.page, e.state.param, false);
    } else {
      navigate('home', null, false);
    }
  });

  navigate('home');
  loadAcademicYear();

  // Mobile: show bottom nav, but do not force the advisor page on every resize.
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = isMobile ? 'flex' : 'none';
  }

  window.addEventListener('resize', () => {
    const nowMobile = window.innerWidth <= 768;
    if (bottomNav) {
      bottomNav.style.display = nowMobile ? 'flex' : 'none';
    }
  });

  // AOS scroll animations
  if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, offset: 60, duration: 650, easing: 'ease-out-cubic' });
  }

  // Animate hero counters
  setTimeout(animateCounters, 400);

  // Scroll nav shadow + scroll-to-top
  const scrollTopBtn = document.getElementById('scroll-top');
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) nav.style.boxShadow = window.scrollY > 10 ? 'var(--shadow-sm)' : 'none';
    if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  });
});

function openModal(id) {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeMobileMenu(); } });

/* ─── MOBILE MENU ─────────────────────────── */
function toggleMobileMenu() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const isOpen = menu.classList.contains('open');
  if (isOpen) { closeMobileMenu(); } else {
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    menu.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  if (!burger || !menu || !overlay) return;
  burger.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  menu.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── BOTTOM NAV ──────────────────────────── */
/* bottom nav state is now updated centrally from navigate() */

/* ─── STICKY COMPARE BAR ─────────────────── */
function updateStickyCompare() {
  const bar = document.getElementById('sticky-compare');
  const count = state.compareList.length;
  if (bar) {
    bar.classList.toggle('visible', count >= 1 && state.currentPage !== 'compare' && state.currentPage !== 'advisor');
    const countEl = document.getElementById('sticky-compare-count');
    if (countEl) countEl.textContent = count;
  }
}

/* ─── SHEETS ──────────────────────────────── */
function openSheet(overlayId, sheetId) {
  document.getElementById(overlayId).classList.add('open');
  document.getElementById(sheetId).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet(overlayId, sheetId) {
  document.getElementById(overlayId).classList.remove('open');
  document.getElementById(sheetId).classList.remove('open');
  document.body.style.overflow = '';
}

function openFilterSheet() {
  // Sync current desktop filter values to sheet
  const syncVal = (from, to) => {
    const f = document.getElementById(from);
    const t = document.getElementById(to);
    if (f && t) t.value = f.value;
  };
  syncVal('filter-top', 'sheet-top');
  syncVal('filter-city', 'sheet-city');
  syncVal('filter-specialty', 'sheet-specialty');
  syncVal('filter-price', 'sheet-price');
  syncVal('filter-language', 'sheet-language');
  syncVal('filter-sort', 'sheet-sort');

  // Sync specialties options
  const desktop = document.getElementById('filter-specialty');
  const sheet = document.getElementById('sheet-specialty');
  if (desktop && sheet && sheet.options.length < desktop.options.length) {
    sheet.innerHTML = desktop.innerHTML;
  }
  openSheet('filter-sheet-overlay', 'filter-sheet');
}
function closeFilterSheet() { closeSheet('filter-sheet-overlay', 'filter-sheet'); }

function syncSheetFilters() {
  const syncVal = (from, to) => {
    const f = document.getElementById(from);
    const t = document.getElementById(to);
    if (f && t) t.value = f.value;
  };
  syncVal('sheet-top', 'filter-top');
  syncVal('sheet-city', 'filter-city');
  syncVal('sheet-specialty', 'filter-specialty');
  syncVal('sheet-price', 'filter-price');
  syncVal('sheet-language', 'filter-language');
  syncVal('sheet-sort', 'filter-sort');
}

function openToolsSheet() {
  // Close more sheet if open
  const moreOverlay = document.getElementById('more-sheet-overlay');
  const moreSheet = document.getElementById('more-sheet');
  if (moreOverlay?.classList.contains('open')) {
    moreOverlay.classList.remove('open');
    moreSheet.classList.remove('open');
  }
  openSheet('tools-sheet-overlay', 'tools-sheet');
}
function closeToolsSheet() { closeSheet('tools-sheet-overlay', 'tools-sheet'); }
function openMoreSheet() {
  // Close tools sheet if open
  const toolsOverlay = document.getElementById('tools-sheet-overlay');
  const toolsSheet = document.getElementById('tools-sheet');
  if (toolsOverlay?.classList.contains('open')) {
    toolsOverlay.classList.remove('open');
    toolsSheet.classList.remove('open');
  }
  openSheet('more-sheet-overlay', 'more-sheet');
}
function closeMoreSheet() { closeSheet('more-sheet-overlay', 'more-sheet'); }

/* =============================================
   ADMISSION PREDICTOR
   ============================================= */

function initAdmissionPage() {
  const entInput = document.getElementById('admit-ent');
  if (entInput && entInput.value === '' && typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    Auth.getProfile().then(profile => {
      if (entInput.value === '' && profile.entScore != null) entInput.value = profile.entScore;
    }).catch(() => {});
  }
  const citySel = document.getElementById('admit-city');
  if (citySel && citySel.options.length <= 1) {
    loadCities();
  }
  
  // Загружаем специальности
  loadSpecialties();
}

// ─── ADMISSION CALCULATOR STATES ─────────────────────
function showAdmissionLoading() {
  const resultsEl = document.getElementById('admission-results');
  resultsEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>${t('admission_page.loading')}</p>
    </div>
  `;
}

function showAdmissionError(message) {
  const resultsEl = document.getElementById('admission-results');
  resultsEl.innerHTML = `
    <div class="tool-card" style="border: 1px solid var(--red, #ef4444);">
      <p style="color: var(--red, #ef4444); margin: 0;">
        <strong>${t('admission_page.error_prefix')}</strong> ${escapeHtml(message)}
      </p>
    </div>
  `;
}

function showAdmissionEmpty(message) {
  const resultsEl = document.getElementById('admission-results');
  resultsEl.innerHTML = `
    <div class="tool-card empty-state">
      <p>${escapeHtml(message || t('admission_page.not_found'))}</p>
    </div>
  `;
}

// ─── MAIN CALCULATOR FUNCTION ─────────────────────────
async function calculateAdmissionChance() {
  const btn = document.getElementById('admit-submit');
  const resultsEl = document.getElementById('admission-results');
  
  // Получаем значения из формы
  const entValue = document.getElementById('admit-ent').value;
  const entScore = entValue === '' ? NaN : Number(entValue);
  const specialtyId = parseInt(document.getElementById('admit-specialty').value, 10);
  const cityId = document.getElementById('admit-city').value ? parseInt(document.getElementById('admit-city').value, 10) : null;
  const budgetMax = document.getElementById('admit-budget').value ? parseInt(document.getElementById('admit-budget').value, 10) : null;
  const language = document.getElementById('admit-language').value || null;
  const needsDorm = document.getElementById('admit-dorm').checked;

  // Валидация
  if (!Number.isInteger(entScore) || entScore < 0 || entScore > 140) {
    showToast(t('admission_page.ent_must_be'), 'warning');
    return;
  }
  if (!specialtyId) {
    showToast(t('admission_page.choose_spec'), 'warning');
    return;
  }

  btn.disabled = true;
  showAdmissionLoading();

  try {
    const payload = {
      entScore,
      specialtyId,
      cityId,
      budgetMax,
      language,
      needsDorm,
      useAiExplanation: true,
    };

    const res = await Auth.fetch('/admission/calculate', {
      method: 'POST',
      body: JSON.stringify({ ...payload, lang: window.currentLanguage || 'ru' }),
      timeoutMs: 15000,
    });

    const result = await res.json();

    // Если ошибка
    if (result.error) {
      showAdmissionError(result.error);
      return;
    }

    // Если нет совпадений
    if (!result.matches || result.matches.length === 0) {
      showAdmissionEmpty(t('admission_page.no_results_msg'));
      return;
    }

    // Сохраняем результат в state
    state.admissionLastResult = result;

    // Рендерим результаты
    renderAdmissionResults(result, payload);

    // Сохраняем в историю (для авторизованных пользователей)
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      saveAdmissionHistory(payload, result.matches);
    }

  } catch (err) {
    console.error('Admission calculate error:', err);
    showAdmissionError(t('admission_page.server_error'));
  } finally {
    btn.disabled = false;
  }
}

// ─── RENDER FUNCTIONS ─────────────────────────────────
function renderAdmissionResults(result, input) {
  const resultsEl = document.getElementById('admission-results');
  const matches = result.matches || [];

  if (!matches.length) {
    showAdmissionEmpty();
    return;
  }

  const specialtyName = getSpecialtyName(input.specialtyId);
  const cityName = input.cityId ? getCityName(input.cityId) : t('admission_page.all_cities');

  let summaryHtml = `
    <div class="admission-summary tool-card">
      <h3 class="tool-card-title">${t('admission_page.results')}</h3>
      <p class="admission-summary-text">
        <strong>${t('admission_page.ent_label')}</strong> ${input.entScore} · 
        <strong>${t('admission_page.spec_label')}</strong> ${escapeHtml(specialtyName)}
        ${input.budgetMax ? ` · <strong>${t('admission_page.budget_label')}</strong> ${t('admission_page.budget_up_to')} ${(input.budgetMax / 1000000).toFixed(1)} ${t('admission_page.budget_suffix')}` : ''}
      </p>
      <p class="admission-summary-note">
        ${t('admission_page.found')} <strong>${matches.length}</strong> ${t('admission_page.found_unis')} 
        ${t('admission_page.calc_note')}
      </p>
  `;

  // Добавляем AI объяснение если оно есть
  if (result.explanation) {
    summaryHtml += renderExplanationBlock(result.explanation);
  }

  summaryHtml += `
    </div>
    <div class="admission-matches">
      ${matches.map((m, i) => renderAdmissionCard(m, i)).join('')}
    </div>
  `;

  resultsEl.innerHTML = summaryHtml;
}

function renderAdmissionCard(match, index) {
  const { 
    universityId, 
    universityName, 
    universityCity,
    specialtyName,
    chancePercent, 
    confidenceLevel,
    reasoning,
    contacts 
  } = match;

  const barClass = getChanceBarClass(chancePercent);
  const reasoningHtml = (reasoning || [])
    .slice(0, 5)
    .map(reason => `<li>• ${escapeHtml(reason)}</li>`)
    .join('');

  const contactsHtml = contacts ? `
    <div class="admission-card-contacts">
      ${contacts.phone ? `<div class="contact-item"><strong>☎:</strong> ${escapeHtml(contacts.phone)}</div>` : ''}
      ${contacts.email ? `<div class="contact-item"><strong>✉:</strong> <a href="mailto:${escapeHtml(contacts.email)}">${escapeHtml(contacts.email)}</a></div>` : ''}
      ${contacts.whatsapp ? `<div class="contact-item"><strong>WhatsApp:</strong> <a href="https://wa.me/${contacts.whatsapp.replace(/[^\d]/g, '')}" target="_blank">${escapeHtml(contacts.whatsapp)}</a></div>` : ''}
    </div>
  ` : '';

  return `
    <article class="admission-card tool-card" data-uni-id="${universityId}">
      <div class="admission-card-head">
        <div>
          <span class="admission-rank">#${index + 1}</span>
          <h4 class="admission-uni-name">${escapeHtml(trRu(universityName))}</h4>
          <p class="admission-uni-full" style="font-size: 0.9rem; color: var(--gray, #666);">${escapeHtml(trRu(universityCity))}</p>
        </div>
        <div class="admission-chance-wrap">
          <div class="admission-chance-value ${barClass}">${chancePercent}%</div>
          <div class="admission-chance-bar"><div class="admission-chance-fill ${barClass}" style="width:${chancePercent}%"></div></div>
        </div>
      </div>

      <div class="admission-card-confidence">
        <strong>${t('admission_page.reliability')}</strong> ${escapeHtml(confidenceLevel || t('admission_page.reliability_mid'))}
      </div>

      <div class="admission-card-specialty">
        <strong>${t('admission_page.spec_label')}</strong> ${escapeHtml(specialtyName)}
      </div>

      <ul class="admission-reasons">
        ${reasoningHtml}
      </ul>

      ${contactsHtml}

      <div class="admission-card-actions" style="margin-top: 12px; display: flex; gap: 8px;">
        <button class="tracker-add-btn ${state.trackerList.some(t => t.university_id === universityId) ? 'added' : ''}" onclick="event.stopPropagation(); handleTrackerAdd(${universityId}, '${escapeAdmissionHtml(universityName)}')">${state.trackerList.some(t => t.university_id === universityId) ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> ${t('tracker.added') || 'В трекере'}` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> ${t('tracker.add_to_tracker') || 'В трекер'}`}</button>
        <button class="btn btn-sm btn-detail" onclick="navigate('university', ${universityId})">
          ${t('admission_page.uni_details')}
        </button>
      </div>
    </article>
  `;
}

// ─── HELPER FUNCTIONS ─────────────────────────────────
function renderExplanationBlock(explanation) {
  if (!explanation) return '';

  const { 
    summary, 
    strengths = [], 
    risks = [], 
    strategy, 
    tips = [],
    fallback 
  } = explanation;

  const strategyLabel = {
    'safe': t('admission_page.safe_strategy'),
    'target': t('admission_page.target_strategy'),
    'ambitious': t('admission_page.ambitious_strategy'),
    'mixed': t('admission_page.mixed_strategy')
  }[strategy] || t('admission_page.strategy_label');

  const strategyClass = {
    'safe': 'explanation-safe',
    'target': 'explanation-target',
    'ambitious': 'explanation-ambitious',
    'mixed': 'explanation-mixed'
  }[strategy] || '';

  let html = `
    <div class="ai-explanation ${strategyClass}" style="margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--bg-secondary); border-left: 4px solid ${getStrategyColor(strategy)};">
      ${fallback ? `<p style="font-size: 0.8rem; color: var(--gray, #999); margin: 0 0 8px 0;">${t('admission_page.template_explain')}</p>` : `<p style="font-size: 0.8rem; color: var(--gray, #999); margin: 0 0 8px 0;">${t('admission_page.ai_explain')}</p>`}
      
      <p style="font-weight: 500; margin: 0 0 8px 0; color: var(--text);">${escapeHtml(summary || '')}</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; font-size: 0.9rem;">
        <div>
          <strong style="color: var(--green, #10b981);">${t('admission_page.pros')}</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
            ${strengths.slice(0, 3).map(s => `<li>• ${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <strong style="color: var(--orange, #f59e0b);">${t('admission_page.risks')}</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
            ${risks.slice(0, 3).map(r => `<li>• ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="margin-top: 12px;">
        <strong style="color: var(--blue, #3b82f6);">${t('admission_page.strategy_heading')}</strong> ${escapeHtml(strategyLabel)}
      </div>

      ${tips.length > 0 ? `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border, #e5e7eb);">
        <strong style="color: var(--purple, #8b5cf6);">${t('admission_page.tips_heading')}</strong>
        <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
          ${tips.slice(0, 3).map(t => `<li>• ${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
  `;

  return html;
}

function getStrategyColor(strategy) {
  switch(strategy) {
    case 'safe': return 'var(--green, #10b981)';
    case 'target': return 'var(--blue, #3b82f6)';
    case 'ambitious': return 'var(--orange, #f59e0b)';
    case 'mixed': return 'var(--purple, #8b5cf6)';
    default: return 'var(--gray, #6b7280)';
  }
}

function getChanceBarClass(chance) {
  if (chance >= 85) return 'chance-high';
  if (chance >= 65) return 'chance-mid';
  if (chance >= 40) return 'chance-low';
  return 'chance-critical';
}

function getSpecialtyName(specialtyId) {
  const opt = Array.from(document.getElementById('admit-specialty').options).find(o => o.value == specialtyId);
  return opt ? opt.textContent : t('admission_page.unknown_spec');
}

function getCityName(cityId) {
  const opt = Array.from(document.getElementById('admit-city').options).find(o => o.value == cityId);
  return opt ? opt.textContent.split('(')[0].trim() : 'N/A';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─── SAVE HISTORY ─────────────────────────────────────
async function saveAdmissionHistory(input, matches) {
  try {
    await Auth.fetch('/admission/save-history', {
      method: 'POST',
      body: JSON.stringify({ input, matches }),
      timeoutMs: 15000,
    });
  } catch (err) {
    console.error('Failed to save admission history:', err);
    // Silent fail - не прерываем UX если история не сохранилась
  }
}


/* =============================================
   ENT CALCULATOR
   ============================================= */



/* =============================================
   CAREER ORIENTATION TEST
   ============================================= */

const CAREER_QUESTIONS = [
  {
    q: t('career_questions.q1'),
    opts: [
      { text: t('career_questions.q1_o1'), tags: ['IT'] },
      { text: t('career_questions.q1_o2'), tags: ['Медицина'] },
      { text: t('career_questions.q1_o3'), tags: ['Экономика'] },
      { text: t('career_questions.q1_o4'), tags: ['Гуманитарные'] },
    ]
  },
  {
    q: t('career_questions.q2'),
    opts: [
      { text: t('career_questions.q2_o1'), tags: ['IT', 'Инженерия'] },
      { text: t('career_questions.q2_o2'), tags: ['Медицина', 'Естественные науки'] },
      { text: t('career_questions.q2_o3'), tags: ['Экономика', 'Право'] },
      { text: t('career_questions.q2_o4'), tags: ['Гуманитарные', 'Образование'] },
    ]
  },
  {
    q: t('career_questions.q3'),
    opts: [
      { text: t('career_questions.q3_o1'), tags: ['IT'] },
      { text: t('career_questions.q3_o2'), tags: ['Медицина'] },
      { text: t('career_questions.q3_o3'), tags: ['Экономика'] },
      { text: t('career_questions.q3_o4'), tags: ['Право', 'Гуманитарные'] },
    ]
  },
  {
    q: t('career_questions.q4'),
    opts: [
      { text: t('career_questions.q4_o1'), budget: 1000000, tags: [] },
      { text: t('career_questions.q4_o2'), budget: 2000000, tags: [] },
      { text: t('career_questions.q4_o3'), budget: 3000000, tags: [] },
      { text: t('career_questions.q4_o4'), budget: 5000000, tags: [] },
    ]
  },
  {
    q: t('career_questions.q5'),
    opts: [
      { text: t('career_questions.q5_o1'), tags: ['IT', 'Инженерия', 'Медицина'] },
      { text: t('career_questions.q5_o2'), tags: ['Естественные науки', 'Гуманитарные'] },
      { text: t('career_questions.q5_o3'), tags: ['Экономика', 'Право'] },
      { text: t('career_questions.q5_o4'), tags: ['Образование', 'Гуманитарные'] },
    ]
  },
  {
    q: t('career_questions.q6'),
    opts: [
      { text: t('career_questions.q6_o1'), tags: ['IT', 'Медицина', 'Экономика'] },
      { text: t('career_questions.q6_o2'), tags: ['Право', 'Государственная служба'] },
      { text: t('career_questions.q6_o3'), tags: ['Гуманитарные', 'Экономика'] },
      { text: t('career_questions.q6_o4'), tags: ['Образование', 'Медицина'] },
    ]
  },
  {
    q: t('career_questions.q7'),
    opts: [
      { text: t('career_questions.q7_o1'), prestige: 'high', tags: [] },
      { text: t('career_questions.q7_o2'), prestige: 'medium', tags: [] },
      { text: t('career_questions.q7_o3'), prestige: 'low', tags: [] },
      { text: t('career_questions.q7_o4'), prestige: 'practical', tags: [] },
    ]
  },
  {
    q: t('career_questions.q8'),
    opts: [
      { text: t('career_questions.q8_o1'), tags: [] },
      { text: t('career_questions.q8_o2'), tags: [] },
      { text: t('career_questions.q8_o3'), tags: [] },
      { text: t('career_questions.q8_o4'), tags: [] },
    ]
  },
];

// Map category tags to university ids
const SPECIALTY_TO_UNIS = {
  'IT':               [2, 1, 7, 6, 10],
  'Медицина':         [3],
  'Экономика':        [5, 4, 6, 1, 8],
  'Право':            [4, 5, 1, 11],
  'Инженерия':        [2, 7, 1, 10],
  'Гуманитарные':     [8, 4, 1, 9],
  'Образование':      [9, 1],
  'Естественные науки': [1, 7],
};

const careerState = {
  current: 0,
  scores: {},
  budget: 5000000,
  prestige: 'medium',
  answers: [],
};

function initCareerTest() {
  Object.assign(careerState, { current: 0, scores: {}, budget: 5000000, prestige: 'medium', answers: [] });
  document.getElementById('career-quiz-wrap').style.display = 'block';
  document.getElementById('career-result-wrap').style.display = 'none';
  renderCareerQuestion();
}

function renderCareerQuestion() {
  const q = CAREER_QUESTIONS[careerState.current];
  const total = CAREER_QUESTIONS.length;
  const pct = (careerState.current / total * 100).toFixed(0);

  document.getElementById('career-progress-fill').style.width = pct + '%';
  document.getElementById('career-progress-text').textContent = `${t('career_page_js.question_of')} ${careerState.current + 1} ${t('career_page_js.of')} ${total}`;

  document.getElementById('career-question-wrap').innerHTML = `
    <div class="career-question-card">
      <div class="career-q-num">${t('career_page_js.question_of')} ${careerState.current + 1}</div>
      <div class="career-q-text">${q.q}</div>
      <div class="career-options">
        ${q.opts.map((opt, i) => `
          <button class="career-option" onclick="answerCareer(${i})">
            <span class="career-opt-num">${String.fromCharCode(65 + i)}</span>
            <span>${opt.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function answerCareer(optIdx) {
  const q = CAREER_QUESTIONS[careerState.current];
  const opt = q.opts[optIdx];

  // Record tags
  (opt.tags || []).forEach(tag => {
    careerState.scores[tag] = (careerState.scores[tag] || 0) + 1;
  });

  if (opt.budget) careerState.budget = opt.budget;
  if (opt.prestige) careerState.prestige = opt.prestige;

  careerState.answers.push(optIdx);
  careerState.current++;

  if (careerState.current >= CAREER_QUESTIONS.length) {
    showCareerResult();
  } else {
    renderCareerQuestion();
  }
}

async function showCareerResult() {
  document.getElementById('career-quiz-wrap').style.display = 'none';
  document.getElementById('career-result-wrap').style.display = 'block';

  // Find top categories
  const sorted = Object.entries(careerState.scores).sort((a, b) => b[1] - a[1]);
  const topCats = sorted.slice(0, 3).map(([cat]) => cat);
  if (!topCats.length) topCats.push('Экономика', 'IT');

  // Get matching unis
  let unis = state.universities;
  if (!unis.length) {
    const res = await fetch(`${API}/universities?lang=${window.currentLanguage || 'ru'}`);
    unis = await res.json();
  }

  const uniScores = {};
  topCats.forEach((cat, i) => {
    const weight = topCats.length - i;
    (SPECIALTY_TO_UNIS[cat] || []).forEach(uid => {
      uniScores[uid] = (uniScores[uid] || 0) + weight;
    });
  });

  // Filter by budget
  let recommendedUnis = unis
    .filter(u => u.price_from <= careerState.budget)
    .map(u => ({ ...u, score: uniScores[u.id] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!recommendedUnis.length) recommendedUnis = unis.slice(0, 3).map(u => ({ ...u, score: 1 }));

  const catLabels = {
    'IT': t('career_questions.cat_it'),
    'Медицина': t('career_questions.cat_medicine'),
    'Экономика': t('career_questions.cat_economics'),
    'Право': t('career_questions.cat_law'),
    'Инженерия': t('career_questions.cat_engineering'),
    'Гуманитарные': t('career_questions.cat_humanities'),
    'Образование': t('career_questions.cat_education'),
    'Естественные науки': t('career_questions.cat_natural'),
  };

  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    Auth.saveTestResult('career_test', recommendedUnis.length, 4, {
      summary: `${t('career_questions.summary_prefix')} ${topCats.join(', ')}`,
      topCategories: topCats,
      recommendedIds: recommendedUnis.map(u => u.id),
      budget: careerState.budget
    }).catch(() => {});
  }

  document.getElementById('career-result-inner').innerHTML = `
    <div class="career-result-header">
      <div class="career-result-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
      <h2 class="career-result-title">${t('career_page_js.profile_ready')}</h2>
      <p class="career-result-sub">${t('career_page_js.profile_desc')}</p>
    </div>

    <div class="career-cats">
      <h3 class="career-section-label">${t('career_page_js.rec_directions')}</h3>
      <div class="career-cats-list">
        ${topCats.map((cat, i) => `
          <div class="career-cat-item ${i === 0 ? 'career-cat-top' : ''}">
            ${i === 0 ? '<svg class="career-cat-star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' : `<span class="career-cat-rank">${i + 1}</span>`}
            <span>${catLabels[cat] || cat}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="career-unis">
      <h3 class="career-section-label">${t('career_page_js.matching_unis')}</h3>
      <div class="career-unis-grid">
        ${recommendedUnis.map((u, i) => `
          <div class="career-uni-card ${i === 0 ? 'career-uni-top' : ''}">
            ${i === 0 ? `<div class="career-uni-badge">${t('career_page_js.best_choice')}</div>` : ''}
            <div class="career-uni-name">${trRu(u.short_name) || trRu(u.name)}</div>
            <div class="career-uni-fullname">${trRu(u.name)}</div>
            <div class="career-uni-price">${t('career_page_js.from_price')} ${fmtPrice(u.price_from)} ${t('career_page_js.tenge_year')}</div>
            ${u.qs_world ? `<div class="career-uni-qs">QS World #${u.qs_world}</div>` : ''}
            <button class="btn btn-sm btn-detail" style="margin-top:12px" onclick="navigate('university', ${u.id})">${t('admission_page.uni_details')}</button>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="career-fin-tip">
      <div class="career-tip-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6M12 18h.01"/></svg>
      </div>
      <div>
        <strong>${t('career_page_js.finance_advice')}</strong> ${t('career_page_js.budget_up_to')} <strong>${fmtPrice(careerState.budget)} ${t('career_page_js.tenge_year')}</strong>
        ${t('career_page_js.spent_4yr')} <strong>${fmtPrice(recommendedUnis[0]?.price_from * 4)} ${t('common.tenge')}</strong>.
        <a href="#" onclick="event.preventDefault(); navigate('tips')" style="color:var(--accent);text-decoration:underline">${t('career_page_js.calculator')}</a> ${t('career_page_js.calc_roi')}
      </div>
    </div>
  `;
  setTimeout(celebrateCompare, 400);
}

function restartCareerTest() {
  initCareerTest();
}
// ─── GRANTS ──────────────────────────────────
function loadGrants() { return window.GrantsPage.load(); }

// ─── PROFESSION ANALYSIS ─────────────────────
const professionData = {
  'Computer Science': { title: 'AI / ML Engineer', salary: '1 200 000 ₸', growth: '+55%', demand: 'Очень высокий' },
  'Программная инженерия': { title: 'Software Engineer', salary: '1 100 000 ₸', growth: '+50%', demand: 'Очень высокий' },
  'Информационные технологии': { title: 'IT Specialist / Architect', salary: '1 000 000 ₸', growth: '+48%', demand: 'Очень высокий' },
  'Информационные системы': { title: 'System Analyst / IT Project Manager', salary: '950 000 ₸', growth: '+45%', demand: 'Высокий' },
  'Кибербезопасность': { title: 'Cybersecurity Analyst', salary: '1 300 000 ₸', growth: '+60%', demand: 'Очень высокий' },
  'Искусственный интеллект': { title: 'AI Research Scientist', salary: '1 500 000 ₸', growth: '+65%', demand: 'Очень высокий' },
  'Big Data': { title: 'Data Engineer / Data Scientist', salary: '1 400 000 ₸', growth: '+58%', demand: 'Очень высокий' },
  'Медицина': { title: 'Врач / Хирург', salary: '800 000 ₸', growth: '+25%', demand: 'Стабильный' },
  'Педиатрия': { title: 'Педиатр', salary: '700 000 ₸', growth: '+22%', demand: 'Стабильный' },
  'Фармация': { title: 'Фармацевт / Клинический провизор', salary: '650 000 ₸', growth: '+20%', demand: 'Стабильный' },
  'Стоматология': { title: 'Стоматолог', salary: '950 000 ₸', growth: '+28%', demand: 'Высокий' },
  'Экономика': { title: 'Economist / Financial Analyst', salary: '750 000 ₸', growth: '+25%', demand: 'Высокий' },
  'Бизнес-администрирование': { title: 'Business Analyst / Operations Manager', salary: '900 000 ₸', growth: '+30%', demand: 'Высокий' },
  'Менеджмент': { title: 'Project Manager / Team Lead', salary: '850 000 ₸', growth: '+28%', demand: 'Высокий' },
  'Финансы': { title: 'Financial Analyst / Investment Manager', salary: '950 000 ₸', growth: '+30%', demand: 'Высокий' },
  'Учет и аудит': { title: 'Accountant / Auditor', salary: '700 000 ₸', growth: '+18%', demand: 'Стабильный' },
  'Маркетинг': { title: 'Marketing Manager / Brand Strategist', salary: '800 000 ₸', growth: '+30%', demand: 'Высокий' },
  'Право': { title: 'Юрист / Адвокат', salary: '850 000 ₸', growth: '+22%', demand: 'Высокий' },
  'Международное право': { title: 'International Lawyer', salary: '1 000 000 ₸', growth: '+25%', demand: 'Высокий' },
  'Инженерия': { title: 'Engineer / Technical Lead', salary: '850 000 ₸', growth: '+25%', demand: 'Высокий' },
  'Нефтегазовое дело': { title: 'Petroleum Engineer', salary: '1 500 000 ₸', growth: '+20%', demand: 'Высокий' },
  'Строительство': { title: 'Civil Engineer / Project Manager', salary: '750 000 ₸', growth: '+22%', demand: 'Стабильный' },
  'Архитектура': { title: 'Architect / Urban Planner', salary: '800 000 ₸', growth: '+20%', demand: 'Стабильный' },
  'Электротехника': { title: 'Electrical Engineer', salary: '900 000 ₸', growth: '+28%', demand: 'Высокий' },
  'Робототехника': { title: 'Robotics Engineer', salary: '1 200 000 ₸', growth: '+50%', demand: 'Очень высокий' },
  'Гуманитарные науки': { title: 'Analyst / Content Specialist', salary: '500 000 ₸', growth: '+15%', demand: 'Умеренный' },
  'Филология': { title: 'Editor / Linguist / Translator', salary: '450 000 ₸', growth: '+12%', demand: 'Умеренный' },
  'Журналистика': { title: 'Journalist / Media Producer', salary: '550 000 ₸', growth: '+18%', demand: 'Умеренный' },
  'Психология': { title: 'Psychologist / HR Specialist', salary: '600 000 ₸', growth: '+25%', demand: 'Высокий' },
  'Педагогика': { title: 'Teacher / Educational Specialist', salary: '400 000 ₸', growth: '+15%', demand: 'Стабильный' },
  'Биология': { title: 'Biologist / Lab Researcher', salary: '550 000 ₸', growth: '+20%', demand: 'Умеренный' },
  'Химия': { title: 'Chemist / Process Engineer', salary: '600 000 ₸', growth: '+18%', demand: 'Умеренный' },
  'Математика': { title: 'Data Analyst / Actuary', salary: '900 000 ₸', growth: '+35%', demand: 'Высокий' },
  'Физика': { title: 'Physicist / R&D Engineer', salary: '700 000 ₸', growth: '+22%', demand: 'Умеренный' },
  'Дизайн': { title: 'UI/UX Designer / Art Director', salary: '850 000 ₸', growth: '+35%', demand: 'Высокий' },
  'Графический дизайн': { title: 'Graphic Designer / Brand Designer', salary: '650 000 ₸', growth: '+28%', demand: 'Высокий' },
  'Туризм': { title: 'Tourism Manager / Event Coordinator', salary: '500 000 ₸', growth: '+25%', demand: 'Умеренный' },
  'Спорт': { title: 'Sports Manager / Coach', salary: '550 000 ₸', growth: '+20%', demand: 'Умеренный' },
};

const demandColors = {
  'Очень высокий': '#52b788',
  'Высокий': '#74b566',
  'Стабильный': '#e9c46a',
  'Умеренный': '#e9c46a',
};

function showProfessionAnalysis(name) {
  const data = professionData[name] || {
    title: name,
    salary: '—',
    growth: '—',
    demand: '—'
  };

  const demandColor = demandColors[data.demand] || 'var(--text-muted)';

  document.getElementById('profession-modal-content').innerHTML = `
    <div class="prof-badge">${t('prof_page.ai_analysis')}</div>
    <div class="prof-title">${data.title}</div>
    <div class="prof-subtitle">${name}</div>
    <div class="prof-grid">
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="prof-card-label">${t('prof_page.avg_salary')}</div>
        <div class="prof-card-val">${data.salary}</div>
      </div>
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div class="prof-card-label">${t('prof_page.market_growth')}</div>
        <div class="prof-card-val" style="color:${data.growth !== '—' ? '#52b788' : 'var(--text-muted)'}">${data.growth}</div>
      </div>
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="prof-card-label">${t('prof_page.demand')}</div>
        <div class="prof-card-val" style="color:${demandColor}">${t('demand_labels.' + data.demand) || data.demand}</div>
      </div>
    </div>
    <div class="prof-note">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      ${t('prof_page.disclaimer')}
    </div>
  `;
  openModal('modal-profession');
}


// ─── MAP ─────────────────────────────────────
let mapInstance = window.mapInstance = null;

async function loadMap() {
  if (mapInstance) { mapInstance.invalidateSize(); return; }
  if (typeof L === 'undefined') { setTimeout(loadMap, 500); return; }

  const mapContainer = document.getElementById('map-container');
  if (!mapContainer || mapContainer.offsetHeight === 0) {
    setTimeout(loadMap, 500);
    return;
  }

  // Центр Казахстана
  mapInstance = window.mapInstance = L.map('map-container', { minZoom: 5, maxZoom: 18 }).setView([48.0, 66.9], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance);

  const res = await fetch(`${API}/universities?lang=${window.currentLanguage || 'ru'}`);
  const unis = await res.json();
  state.mapUniversities = Array.isArray(unis) ? unis : [];

  const greenIcon = L.divIcon({
    className: '',
    html: `<div style="background:#2d6a4f;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">В</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  // Store markers for later filtering
  state.mapMarkers = [];
  const bounds = L.latLngBounds();
  
  unis.forEach(u => {
    if (!u.lat || !u.lng) return;
    const marker = L.marker([u.lat, u.lng], { icon: greenIcon }).addTo(mapInstance);
    marker.bindPopup(`
      <div style="font-family:sans-serif;min-width:200px;padding:4px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${trRu(u.short_name)}</div>
        <div style="font-size:12px;color:#666;margin-bottom:6px">${trRu(u.name)}</div>
        <div style="font-size:13px;color:#2d6a4f;font-weight:600">от ${fmtPrice(u.price_from)} ${t('common.tenge')}/год</div>
        ${u.qs_world ? `<div style="font-size:12px;color:#888">QS World #${u.qs_world}</div>` : ''}
        <button onclick="navigate('university',${u.id})" style="margin-top:8px;padding:4px 10px;background:#2d6a4f;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer">${t('grants_page_js.more_details')}</button>
      </div>
    `);
    state.mapMarkers.push({ marker, uni: u });
    bounds.extend([u.lat, u.lng]);
  });

  // List under map
  const list = document.getElementById('map-uni-list');
  if (list) {
    list.innerHTML = `<div class="map-legend-title">${t('map_page_js.all_on_map')} (${unis.filter(u=>u.lat).length})</div><div class="map-uni-chips" id="map-chips">${unis.filter(u=>u.lat).map(u=>`<button class="map-uni-chip" onclick="mapFlyTo(${u.lat},${u.lng},'${u.short_name}')">${u.short_name}</button>`).join('')}</div>`;
  }
  
  // Fit all markers in view with padding
  if (state.mapMarkers.length > 0 && bounds.isValid()) {
    mapInstance.fitBounds(bounds, { padding: [100, 100], maxZoom: 11 });
  }
}

function filterMapUniversities() {
  const searchInput = document.getElementById('map-search');
  if (!searchInput || !state.mapMarkers) return;
  
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query ? state.mapMarkers.filter(m => 
    m.uni.name.toLowerCase().includes(query) || 
    (m.uni.short_name || '').toLowerCase().includes(query)
  ) : state.mapMarkers;

  const suggestions = document.getElementById('map-search-suggestions');
  if (suggestions) {
    suggestions.innerHTML = query ? filtered.slice(0, 6).map(m => `
      <button type="button" class="map-search-suggestion" role="option" onclick="mapFlyTo(${m.uni.lat}, ${m.uni.lng})">
        <strong>${escapeHtml(m.uni.short_name || '')}</strong>
        <span>${escapeHtml(trRu(m.uni.name) || m.uni.name)}</span>
      </button>
    `).join('') : '';
    suggestions.classList.toggle('open', Boolean(query && filtered.length));
  }
  
  // Show/hide markers
  state.mapMarkers.forEach(m => {
    const shouldShow = filtered.some(f => f.uni.id === m.uni.id);
    if (shouldShow && !mapInstance.hasLayer(m.marker)) {
      m.marker.addTo(mapInstance);
    } else if (!shouldShow && mapInstance.hasLayer(m.marker)) {
      mapInstance.removeLayer(m.marker);
    }
  });
  
  // Update chips
  const chipsContainer = document.getElementById('map-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = filtered.map(m => 
      `<button class="map-uni-chip" onclick="mapFlyTo(${m.uni.lat},${m.uni.lng},'${m.uni.short_name}')">${m.uni.short_name}</button>`
    ).join('');
  }
  
  // Zoom to filtered results
  if (filtered.length > 0) {
    const bounds = L.latLngBounds();
    filtered.forEach(m => {
      bounds.extend([m.uni.lat, m.uni.lng]);
    });
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    }
  }
}

function mapFlyTo(lat, lng, name) {
  if (mapInstance) {
    mapInstance.flyTo([lat, lng], 14, { duration: 1 });
  }
  const suggestions = document.getElementById('map-search-suggestions');
  if (suggestions) suggestions.classList.remove('open');
}

// ─── TIPS ────────────────────────────────────
function loadTips() {}
