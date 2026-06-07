/* =============================================
   EDUMATCH KZ — APP LOGIC
   ============================================= */

const API = 'http://localhost:3000/api';

// ─── STATE ───────────────────────────────────
const state = window.state = {
  universities: [],
  compareList: [],   // array of ids (max 3)
  favoriteList: [],  // array of ids (from localStorage)
  chatHistory: [],
  admissionLastResult: null,
  currentPage: 'home',
};

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
      showToast(e.message || 'Ошибка сохранения');
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
      showToast('Сохранено локально. Войдите, чтобы синхронизировать', 'warning');
    }
  }

  const btn = document.querySelector(`[data-favorite-btn="${id}"]`);
  if (btn) btn.classList.toggle('favorited', state.favoriteList.includes(id));

  const isFav = state.favoriteList.includes(id);
  if (isFav && !wasFav) showToast('♥ Добавлено в избранное', 'success');
  else if (!isFav && wasFav) showToast('✕ Удалено из избранного');
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
}

function navigate(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  state.currentPage = page;
  window.scrollTo(0, 0);

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
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById('lang-' + lang)?.classList.add('active');
  applyTranslations();
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
    { selector: '.hero-title', path: 'home.hero_title' },
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
    renderUniversityGrid(unis);
    const statEl = document.getElementById('stat-unis');
    if (statEl) statEl.textContent = unis.length;
    stopProgress();
    // Refresh AOS for new cards
    setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
  } catch (e) {
    stopProgress();
    grid.innerHTML = `<div class="loading-state"><p style="color:var(--red)">Ошибка загрузки. Убедитесь, что сервер запущен.</p><button class="btn btn-outline" onclick="loadUniversities()">Повторить</button></div>`;
  }
}

async function loadSpecialties() {
  try {
    const res = await fetch(`${API}/specialties`);
    const cats = await res.json();
    const selects = [
      document.getElementById('filter-specialty'),
      document.getElementById('sheet-specialty')
    ].filter(Boolean);

    selects.forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
      });
    });
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
        opt.textContent = `${city.name} (${city.count})`;
        sel.appendChild(opt);
      });
    });
  } catch (e) { /* silent */ }
}

/**
 * Load specialties from API
 */
async function loadSpecialties() {
  try {
    console.log('Loading specialties from API...');
    const res = await fetch(`${API}/specialties`);
    console.log('Response status:', res.status);
    
    if (!res.ok) {
      console.error('API error:', res.statusText);
      return;
    }
    
    const data = await res.json();
    // Данные приходят как: { specialties: [...] } или как массив
    const specialties = data.specialties || data;
    
    const specSelect = document.getElementById('admit-specialty');
    if (!specSelect) {
      console.warn('Specialty select element not found');
      return;
    }
    
    console.log(`Adding ${Array.isArray(specialties) ? specialties.length : 0} specialties to select`);
    
    // Сохраняем placeholder
    while (specSelect.options.length > 1) {
      specSelect.remove(1);
    }
    
    // Добавляем все специальности
    if (Array.isArray(specialties)) {
      specialties.forEach((spec, idx) => {
        const opt = document.createElement('option');
        // Spec может быть {name, id, category} или просто {name, category}
        opt.value = spec.id || (idx + 1);
        opt.textContent = spec.name || spec;
        specSelect.appendChild(opt);
      });
    }
    console.log('Specialties loaded successfully');
  } catch (e) { 
    console.error('Failed to load specialties:', e);
  }
}

function renderUniversityGrid(unis) {
  const grid = document.getElementById('uni-grid');
  if (!unis.length) {
    grid.innerHTML = `<div class="loading-state"><p>Вузы не найдены. Попробуйте изменить фильтры.</p></div>`;
    return;
  }
  grid.innerHTML = unis.map(u => renderUniversityCard(u)).join('');
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
    `<span class="specialty-tag">${s.name}</span>`
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
          <span class="uni-short-name">${u.short_name || u.name.split(' ')[0]}</span>
          ${qs}
        </div>
        <button class="btn-favorite ${isFav ? 'favorited' : ''}" data-favorite-btn="${u.id}" onclick="toggleFavorite(${u.id}); event.stopPropagation();" title="Добавить в избранное">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <div class="uni-name">${u.name}</div>
      <div class="uni-description">${u.description || ''}</div>
      <div class="uni-price-row">
        <span class="price-label">от</span>
        <span class="price-from">${fmtPrice(u.price_from)}</span>
        <span class="price-to"> — ${fmtPrice(u.price_to)}</span>
        <span class="price-period">тг/год</span>
      </div>
      ${contactLine}
      <div class="uni-specialties">${specTags}</div>
      <div class="uni-card-actions">
        <button class="btn btn-sm btn-compare ${isSelected ? 'selected' : ''}" onclick="toggleCompare(${u.id}, event)">
          ${isSelected ? 'В сравнении' : '+ Сравнить'}
        </button>
        ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" onclick="event.stopPropagation()">Сайт</a>` : ''}
        <button class="btn btn-sm btn-detail" onclick="navigate('university', ${u.id})">Подробнее</button>
      </div>
    </div>
  `;
}

function applyFilters() {
  loadUniversities();
}

function resetFilters() {
  const ids = ['filter-top', 'filter-city', 'filter-specialty', 'filter-price', 'filter-language', 'filter-sort'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'filter-sort' ? 'qs_world' : '';
  });
  const search = document.getElementById('search-input');
  if (search) search.value = '';
  syncSheetFilters();
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
      showToast('Максимум 3 вуза для сравнения');
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
        </div>
        <p>Добавьте минимум 2 вуза на главной странице</p>
        <button class="btn btn-primary" onclick="navigate('home')">Выбрать вузы</button>
      </div>`;
    return;
  }

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const res = await fetch(`${API}/compare?ids=${state.compareList.join(',')}`);
    const unis = await res.json();
    renderCompareTable(unis, content);
  } catch (e) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--red)">Ошибка загрузки</p></div>`;
  }
}

function renderCompareTable(unis, container) {
  const minPrice = Math.min(...unis.map(u => u.price_from));
  const bestQs = Math.min(...unis.map(u => u.qs_world || 9999));

  const rows = [
    { label: 'Короткое название', key: u => u.short_name || '—' },
    { label: 'Город', key: u => u.city_name || 'Алматы' },
    { label: 'Основан', key: u => u.founded || '—' },
    { label: 'Кол-во студентов', key: u => u.students_count ? u.students_count.toLocaleString('ru') : '—' },
    { label: 'QS World', key: u => u.qs_world ? `#${u.qs_world}` : '—', isQs: true },
    { label: 'QS Asia', key: u => u.qs_asia ? `#${u.qs_asia}` : '—' },
    { label: 'Мин. стоимость/год', key: u => fmtPrice(u.price_from) + ' тг', isPrice: true, best: minPrice },
    { label: 'Макс. стоимость/год', key: u => fmtPrice(u.price_to) + ' тг' },
    { label: 'Стоимость за 4 года (min)', key: u => fmtPrice(u.price_from * 4) + ' тг' },
    { label: 'Специальностей', key: u => (u.specialties || []).length },
    { label: 'Сайт', key: u => {
      const href = normalizeWebsiteUrl(u.website);
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${formatWebsiteLabel(u.website)}</a>`
        : '—';
    }},
  ];

  const headers = unis.map(u => `<th><div class="compare-uni-head">${u.name}</div></th>`).join('');
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
      <h2 class="section-title" style="flex:1">Сравнение</h2>
      <button class="btn btn-outline btn-clear" onclick="clearCompare()">Очистить</button>
      <button class="btn btn-ghost" onclick="navigate('home')">+ Добавить</button>
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr><th>Параметр</th>${headers}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <div style="margin-top:24px;padding:20px;background:var(--accent-light);border:1px solid var(--accent);border-radius:var(--radius-md)">
      <p style="font-size:13px;color:var(--text-secondary)"><strong style="color:var(--accent)">Совет по финансам:</strong> разница в стоимости за 4 года между выбранными вузами составляет <strong style="color:var(--text)">${fmtPrice((Math.max(...unis.map(u=>u.price_to)) - Math.min(...unis.map(u=>u.price_from))) * 4)} тг</strong>. Учитывайте это при планировании бюджета.</p>
    </div>`;
}

function clearCompare() {
  state.compareList = [];
  updateCompareBadge();
  renderComparePage();
  // Refresh cards if on home
  if (state.currentPage === 'compare') {
    renderComparePage();
  }
}

// ─── UNIVERSITY DETAIL ───────────────────────
async function loadUniversityDetail(id) {
  const content = document.getElementById('uni-detail-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const res = await fetch(`${API}/universities/${id}`);
    const u = await res.json();
    renderUniversityDetail(u, content);
  } catch (e) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--red)">Ошибка загрузки</p><button class="btn btn-outline" onclick="navigate('home')">На главную</button></div>`;
  }
}

// ─── SVG ICONS ──────────────────────────────
const getSVGIcon = (name) => {
  const icons = {
    globe: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    checkmark: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
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
      <div class="spec-category-name">${cat}</div>
      <div class="spec-tags">${names.map(n => `<span class="spec-tag" onclick="showProfessionAnalysis('${n.replace(/'/g, "\\'")}')">${n}</span>`).join('')}</div>
    </div>
  `).join('');

  // Парсим JSON поля
  const languages = u.languages ? (typeof u.languages === 'string' ? JSON.parse(u.languages) : u.languages) : [];
  const accreditations = u.accreditations ? (typeof u.accreditations === 'string' ? JSON.parse(u.accreditations) : u.accreditations) : [];

  // Форматирование языков
  const languagesHTML = languages.length ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('globe')} Языки обучения</div>
      <div class="tags-list">${languages.map(lang => `<span class="tag-pill">${lang}</span>`).join('')}</div>
    </div>
  ` : '';

  // Форматирование аккредитаций
  const accreditationsHTML = accreditations.length ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('checkmark')} Аккредитации</div>
      <div class="tags-list">${accreditations.map(acc => `<span class="tag-pill">${acc}</span>`).join('')}</div>
    </div>
  ` : '';

  // Информация об общежитии
  const dormitoryHTML = `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('building')} Общежитие</div>
      <div class="info-block-content">
        ${u.has_dorm ? `
          <div class="info-row">
            <span>Наличие:</span>
            <span style="color: var(--success);">✓ Есть</span>
          </div>
          ${u.dorm_price ? `
            <div class="info-row">
              <span>Цена в год:</span>
              <span>${fmtPrice(u.dorm_price)} тг</span>
            </div>
          ` : ''}
        ` : `
          <div class="info-row">
            <span>Наличие:</span>
            <span style="color: #999;">✗ Нет</span>
          </div>
        `}
      </div>
    </div>
  `;

  // Средняя зарплата выпускников
  const salaryHTML = u.avg_salary ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('money')} Средняя зарплата выпускников</div>
      <div class="info-block-content">
        <div class="salary-amount">${fmtPrice(u.avg_salary)} тг</div>
        <div class="salary-note">в месяц (ориентировочно)</div>
      </div>
    </div>
  ` : '';

  // Проходной балл ЕНТ
  const entHTML = u.ent_threshold ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('target')} Проходной балл ЕНТ</div>
      <div class="info-block-content">
        <div class="ent-score">${u.ent_threshold}</div>
        <div class="ent-note">минимальный порог для поступления</div>
      </div>
    </div>
  ` : '';

  // Стипендии и гранты (плейсхолдер, можно заполнить из API)
  const scholarshipsHTML = u.grants ? `
    <div class="info-block">
      <div class="info-block-title">${getSVGIcon('graduation')} Стипендии и гранты</div>
      <div class="info-block-content">
        <div style="color: var(--text-secondary);">
          Доступны различные программы финансирования, включая:
        </div>
        <ul class="grants-list">
          <li>Государственные образовательные гранты</li>
          <li>Именные стипендии университета</li>
          <li>Программа Болашак</li>
          <li>Корпоративные гранты</li>
        </ul>
      </div>
    </div>
  ` : '';

  // Контакты приемной комиссии (плейсхолдер)
  const contactsHTML = `
    <div class="info-block">
      <div class="info-block-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        Контакты приемной комиссии
      </div>
      <div class="info-block-content">
        ${u.admission_phone ? u.admission_phone.split('\n').map((ph, i) => `
          <div class="info-row info-contact-row">
            ${i === 0 ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>` : '<span style="width:14px;display:inline-block"></span>'}
            <a href="tel:${ph.replace(/[\s\-\(\)]/g,'')}" style="color: var(--primary)">${ph}</a>
          </div>
        `).join('') : '<div style="color: #999;">Контакты не указаны</div>'}
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
      <div style="margin-bottom:20px">
        <button class="btn btn-ghost btn-sm" onclick="navigate('home')">
          ← Все вузы
        </button>
      </div>
      <div class="uni-detail-hero">
        <div>
          <div class="detail-badges">
            ${qsBadge}
            <span class="detail-badge badge-city">${u.city_name || 'Алматы'}</span>
            ${u.founded ? `<span class="detail-badge badge-city">Основан в ${u.founded}</span>` : ''}
          </div>
          <h1 class="detail-title">${u.name}</h1>
          <div class="detail-short">${u.short_name || ''}</div>
          <p class="detail-desc">${u.description || ''}</p>
          <div class="detail-actions">
            ${normalizeWebsiteUrl(u.website) ? `<a href="${normalizeWebsiteUrl(u.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Официальный сайт</a>` : ''}
            <button class="btn btn-ghost" onclick="addToCompareAndGo(${u.id})">Добавить в сравнение</button>
            <button class="btn btn-ghost" onclick="navigate('advisor')">Спросить ИИ</button>
          </div>
        </div>
        <div>
          <div class="detail-card">
            <div class="detail-card-title">Стоимость обучения 2025–2026</div>
            <div class="detail-price-main">${fmtPrice(u.price_from)} тг</div>
            <div class="detail-price-note">минимальная стоимость в год</div>
            <div class="detail-stat-row">
              <span class="detail-stat-label">Максимум/год</span>
              <span class="detail-stat-val">${fmtPrice(u.price_to)} тг</span>
            </div>
            <div class="detail-price-total">
              <div class="detail-price-total-label">За 4 года обучения</div>
              <div class="detail-price-total-val">${fmtPrice(qs4)} — ${fmtPrice(qsMax4)} тг</div>
            </div>
            ${u.students_count ? `
              <div class="detail-stat-row" style="margin-top:16px">
                <span class="detail-stat-label">Студентов</span>
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
          <h2 class="detail-specialties-title">${getSVGIcon('book')} Факультеты и специальности</h2>
          <div class="specialties-by-category">${specCats}</div>
        </div>` : ''}
    </div>`;
}

function addToCompareAndGo(id) {
  if (!state.compareList.includes(id)) {
    if (state.compareList.length < 3) {
      state.compareList.push(id);
      updateCompareBadge();
      showToast('Вуз добавлен в сравнение', 'success');
    } else {
      showToast('Максимум 3 вуза');
    }
  }
  navigate('compare');
}

// ─── AI ADVISOR CHAT ─────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);

  appendMessage('user', text);
  state.chatHistory.push({ role: 'user', content: text });

  // Typing indicator
  const typingId = appendTyping();
  document.getElementById('chat-send').disabled = true;

  try {
    // Call new OpenRouter-based endpoint
    const headers = { 'Content-Type': 'application/json' };
    if (typeof Auth !== 'undefined' && Auth.getToken()) {
      headers['Authorization'] = `Bearer ${Auth.getToken()}`;
    }

    const res = await fetch(`${API}/ai/advice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-20),
      })
    });
    const data = await res.json();
    removeTyping(typingId);

    if (!data.success) {
      appendMessage('ai', `Ошибка: ${data.error || 'Unknown error'}`);
    } else {
      // Show AI answer
      if (data.intent === 'admission' && data.admission && data.admission.type === 'result') {
        appendMessage('ai', data.answer, [], data.admission);
      } else {
        appendMessage('ai', data.answer, data.matches);
      }
      state.chatHistory.push({ role: 'assistant', content: data.answer });

      // Log metadata
      console.log('[AI Response]', {
        intent: data.intent,
        confidence: data.metadata.confidence,
        fallback: data.metadata.fallback,
        universities_analyzed: data.metadata.universities_analyzed,
        took_ms: data.metadata.took_ms,
      });
    }
  } catch (e) {
    removeTyping(typingId);
    console.error('[Chat Error]', e);
    appendMessage('ai', 'Не удалось подключиться к серверу. Убедитесь, что backend запущен.');
  }

  document.getElementById('chat-send').disabled = false;
}

/**
 * Render university matches as professional cards
 */
function renderMatches(matches) {
  if (!matches || matches.length === 0) return '';

  let html = `
  <div class="chat-rec-header">
    <div class="chat-rec-title">
      📋 Рекомендуемые университеты (${matches.length})
    </div>
    <div class="chat-rec-grid">
  `;

  matches.slice(0, 5).forEach((u, idx) => {
    const languages = (u.languages || []).join(', ') || 'Не указано';
    const specs = (u.specialties || []).map(s => typeof s === 'string' ? s : s.name || s.category).filter(Boolean).slice(0, 3).join(', ') || 'N/A';
    const qs = u.qs_world ? `QS World: #${u.qs_world}` : (u.qs_asia ? `QS Asia: #${u.qs_asia}` : 'Рейтинг не указан');
    const priceRange = `${(u.price_from/1000000).toFixed(2)}–${(u.price_to/1000000).toFixed(2)}M тг`;
    
    html += `
    <div class="chat-rec-card" onclick="navigate('university', ${u.id})">
      <div class="chat-rec-head">
        <div>
          <div class="chat-rec-uni-name">${u.short_name}</div>
          <div class="chat-rec-uni-full">${u.name}</div>
        </div>
        <div class="chat-rec-badge">${qs}</div>
      </div>
      <div class="chat-rec-details">
        <div>
          <div class="chat-rec-label">Стоимость</div>
          <div class="chat-rec-value-accent">💰 ${priceRange}/год</div>
        </div>
        <div>
          <div class="chat-rec-label">Языки обучения</div>
          <div class="chat-rec-value">🌐 ${languages}</div>
        </div>
        <div class="chat-rec-full">
          <div class="chat-rec-label">Специальности</div>
          <div class="chat-rec-value">📚 ${specs}${(u.specialties || []).length > 3 ? '...' : ''}</div>
        </div>
      </div>
      <div class="chat-rec-actions">
        <button class="chat-rec-btn-primary" onclick="event.stopPropagation(); navigate('university', ${u.id})">Подробнее</button>
        <button class="chat-rec-btn-ghost" onclick="event.stopPropagation(); toggleFavorite(${u.id})">${state.favoriteList?.includes(u.id) ? '♥ В избранном' : '♡ В избранное'}</button>
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
function renderAdmissionChatCards(matches, input) {
  if (!matches || matches.length === 0) return '';

  let html = `
  <div class="chat-admission-cards">
    <div class="chat-admission-header">
      <span class="chat-admission-badge">🎯 Прогноз поступления</span>
      <span class="chat-admission-input">ЕНТ ${input?.ent || '—'} · ${input?.specialty || '—'}</span>
    </div>
  `;

  matches.slice(0, 5).forEach((m, idx) => {
    const barClass = m.chance >= 80 ? 'chance-high' : m.chance >= 60 ? 'chance-mid' : 'chance-low';
    const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    html += `
    <div class="chat-admission-card" onclick="navigate('university', ${m.university_id})">
      <div class="chat-admission-card-head">
        <div>
          <span class="chat-admission-rank">${rankIcon}</span>
          <span class="chat-admission-uni">${escapeAdmissionHtml(m.university)}</span>
          <span class="chat-admission-name">${escapeAdmissionHtml(m.name || '')}</span>
        </div>
        <div class="chat-admission-chance ${barClass}">${m.chance}%</div>
      </div>
      <div class="chat-admission-bar">
        <div class="chat-admission-fill ${barClass}" style="width:${m.chance}%"></div>
      </div>
      <div class="chat-admission-rec">${escapeAdmissionHtml(m.recommendation)}</div>
      <ul class="chat-admission-reasons">
        ${(m.reasons || []).slice(0, 3).map(r => {
          const icon = r.type === 'positive' ? '✓' : r.type === 'negative' ? '✗' : '•';
          const cls = r.type === 'positive' ? 'reason-pos' : r.type === 'negative' ? 'reason-neg' : 'reason-neu';
          return `<li class="${cls}">${icon} ${escapeAdmissionHtml(r.text)}</li>`;
        }).join('')}
      </ul>
    </div>`;
  });

  html += `</div>`;
  return html;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
}

function appendMessage(role, text, matches = null, admission = null) {
  const msgs = document.getElementById('chat-messages');

  // Remove welcome if present
  const welcome = msgs.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'ai'}`;
  div.style.animation = 'fadeInUp 0.3s ease both';

  // Use marked.js for AI responses, plain text for user
  let content = role === 'ai' ? renderMarkdown(text) : `<p>${text}</p>`;
  if (role === 'ai' && matches && matches.length > 0) {
    content += renderMatches(matches);
  }
  // Render admission prediction cards in chat
  if (admission && admission.type === 'result' && admission.matches && admission.matches.length > 0) {
    content += renderAdmissionChatCards(admission.matches, admission.input);
  }
  div.innerHTML = `<div class="chat-bubble chat-bubble-${role === 'user' ? 'user' : 'ai'} markdown-body">${content}</div>`;
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

function usePrompt(btn) {
  const input = document.getElementById('chat-input');
  input.value = btn.textContent.trim();
  autoResize(input);
  input.focus();
}

// ─── HELPERS ─────────────────────────────────
function fmtPrice(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' млн';
  return (n / 1000).toFixed(0) + ' тыс';
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
  if (typeof marked === 'undefined') return text;
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(text);
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
  if (typeof Auth !== 'undefined') Auth.init();
  loadSpecialties();
  loadCities();
  navigate('home');

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
  menu.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── BOTTOM NAV ──────────────────────────── */
function setBottomNav(id) {
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
  const map = { home:'bnav-home', compare:'bnav-compare', advisor:'bnav-advisor', tools:'bnav-tools', more:'bnav-more' };
  const el = document.getElementById(map[id] || 'bnav-home');
  if (el) el.classList.add('active');
}

/* ─── STICKY COMPARE BAR ─────────────────── */
function updateStickyCompare() {
  const bar = document.getElementById('sticky-compare');
  const count = state.compareList.length;
  if (bar) {
    bar.classList.toggle('visible', count >= 1);
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

function openToolsSheet() { openSheet('tools-sheet-overlay', 'tools-sheet'); }
function closeToolsSheet() { closeSheet('tools-sheet-overlay', 'tools-sheet'); }
function openMoreSheet()  { openSheet('more-sheet-overlay', 'more-sheet'); }
function closeMoreSheet() { closeSheet('more-sheet-overlay', 'more-sheet'); }

/* =============================================
   ADMISSION PREDICTOR
   ============================================= */

function initAdmissionPage() {
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
      <p>Рассчитываем ваши шансы...</p>
    </div>
  `;
}

function showAdmissionError(message) {
  const resultsEl = document.getElementById('admission-results');
  resultsEl.innerHTML = `
    <div class="tool-card" style="border: 1px solid var(--red, #ef4444);">
      <p style="color: var(--red, #ef4444); margin: 0;">
        <strong>⚠ Ошибка:</strong> ${escapeHtml(message)}
      </p>
    </div>
  `;
}

function showAdmissionEmpty(message) {
  const resultsEl = document.getElementById('admission-results');
  resultsEl.innerHTML = `
    <div class="tool-card empty-state">
      <p>${escapeHtml(message || 'Подходящих вузов не найдено')}</p>
    </div>
  `;
}

// ─── MAIN CALCULATOR FUNCTION ─────────────────────────
async function calculateAdmissionChance() {
  const btn = document.getElementById('admit-submit');
  const resultsEl = document.getElementById('admission-results');
  
  // Получаем значения из формы
  const entScore = parseInt(document.getElementById('admit-ent').value, 10);
  const gpa = parseFloat(document.getElementById('admit-gpa').value);
  const specialtyId = parseInt(document.getElementById('admit-specialty').value, 10);
  const cityId = document.getElementById('admit-city').value ? parseInt(document.getElementById('admit-city').value, 10) : null;
  const budgetMax = document.getElementById('admit-budget').value ? parseInt(document.getElementById('admit-budget').value, 10) : null;
  const language = document.getElementById('admit-language').value || null;
  const needsDorm = document.getElementById('admit-dorm').checked;

  // Валидация
  if (!entScore || entScore < 0 || entScore > 140) {
    showToast('ЕНТ должен быть от 0 до 140', 'warning');
    return;
  }
  if (!gpa || gpa < 0 || gpa > 5) {
    showToast('GPA должен быть от 0 до 5', 'warning');
    return;
  }
  if (!specialtyId) {
    showToast('Выберите специальность', 'warning');
    return;
  }

  btn.disabled = true;
  showAdmissionLoading();

  try {
    // Отправляем запрос на новый endpoint
    const headers = { 'Content-Type': 'application/json' };
    if (typeof Auth !== 'undefined' && Auth.getToken()) {
      headers.Authorization = `Bearer ${Auth.getToken()}`;
    }

    const payload = {
      entScore,
      gpa,
      specialtyId,
      cityId,
      budgetMax,
      language,
      needsDorm,
      useAiExplanation: true,  // Запрашиваем AI объяснение
    };

    const res = await fetch(`${API}/admission/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    // Если ошибка
    if (result.error) {
      showAdmissionError(result.error);
      return;
    }

    // Если нет совпадений
    if (!result.matches || result.matches.length === 0) {
      showAdmissionEmpty('К сожалению, вузов, соответствующих вашим критериям, не найдено. Попробуйте изменить параметры.');
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
    showAdmissionError('Сервер недоступен. Убедитесь, что backend запущен.');
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
  const cityName = input.cityId ? getCityName(input.cityId) : 'все города';

  let summaryHtml = `
    <div class="admission-summary tool-card">
      <h3 class="tool-card-title">✓ Результаты расчета</h3>
      <p class="admission-summary-text">
        <strong>ЕНТ:</strong> ${input.entScore} · 
        <strong>Специальность:</strong> ${escapeHtml(specialtyName)}
        ${input.budgetMax ? ` · <strong>Бюджет:</strong> до ${(input.budgetMax / 1000000).toFixed(1)} млн тг/год` : ''}
      </p>
      <p class="admission-summary-note">
        Найдено <strong>${matches.length}</strong> вузов. 
        Расчет основан на ЕНТ, GPA, бюджете, языке обучения и потребности в общежитии.
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
      ${contacts.whatsapp ? `<div class="contact-item"><strong>💬:</strong> <a href="https://wa.me/${contacts.whatsapp.replace(/[^\d]/g, '')}" target="_blank">${escapeHtml(contacts.whatsapp)}</a></div>` : ''}
    </div>
  ` : '';

  return `
    <article class="admission-card tool-card" data-uni-id="${universityId}">
      <div class="admission-card-head">
        <div>
          <span class="admission-rank">#${index + 1}</span>
          <h4 class="admission-uni-name">${escapeHtml(universityName)}</h4>
          <p class="admission-uni-full" style="font-size: 0.9rem; color: var(--gray, #666);">${escapeHtml(universityCity)}</p>
        </div>
        <div class="admission-chance-wrap">
          <div class="admission-chance-value ${barClass}">${chancePercent}%</div>
          <div class="admission-chance-bar"><div class="admission-chance-fill ${barClass}" style="width:${chancePercent}%"></div></div>
        </div>
      </div>

      <div class="admission-card-confidence" style="margin: 8px 0; font-size: 0.85rem; color: var(--gray, #666);">
        <strong>Надежность:</strong> ${escapeHtml(confidenceLevel || 'средняя')}
      </div>

      <div class="admission-card-specialty" style="margin: 8px 0; font-size: 0.9rem; color: var(--blue, #3b82f6);">
        <strong>Специальность:</strong> ${escapeHtml(specialtyName)}
      </div>

      <ul class="admission-reasons" style="margin: 12px 0; padding-left: 20px; list-style: none;">
        ${reasoningHtml}
      </ul>

      ${contactsHtml}

      <div class="admission-card-actions" style="margin-top: 12px; display: flex; gap: 8px;">
        <button class="btn btn-sm btn-detail" onclick="navigate('university', ${universityId})" style="flex: 1;">
          Подробнее о вузе
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
    'safe': '✓ Безопасный вариант',
    'target': '◉ Целевой вариант',
    'ambitious': '▲ Амбициозный вариант',
    'mixed': '✓ Комбинированная стратегия'
  }[strategy] || 'Стратегия';

  const strategyClass = {
    'safe': 'explanation-safe',
    'target': 'explanation-target',
    'ambitious': 'explanation-ambitious',
    'mixed': 'explanation-mixed'
  }[strategy] || '';

  let html = `
    <div class="ai-explanation ${strategyClass}" style="margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--bg-light, #f9fafb); border-left: 4px solid ${getStrategyColor(strategy)};">
      ${fallback ? '<p style="font-size: 0.8rem; color: var(--gray, #999); margin: 0 0 8px 0;">💡 Шаблонное объяснение (AI недоступен)</p>' : '<p style="font-size: 0.8rem; color: var(--gray, #999); margin: 0 0 8px 0;">🤖 AI-объяснение</p>'}
      
      <p style="font-weight: 500; margin: 0 0 8px 0; color: var(--text);">${escapeHtml(summary || '')}</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; font-size: 0.9rem;">
        <div>
          <strong style="color: var(--green, #10b981);">✓ Плюсы:</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
            ${strengths.slice(0, 3).map(s => `<li>• ${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <strong style="color: var(--orange, #f59e0b);">⚠ Риски:</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0; list-style: none;">
            ${risks.slice(0, 3).map(r => `<li>• ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="margin-top: 12px;">
        <strong style="color: var(--blue, #3b82f6);">Стратегия:</strong> ${escapeHtml(strategyLabel)}
      </div>

      ${tips.length > 0 ? `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border, #e5e7eb);">
        <strong style="color: var(--purple, #8b5cf6);">💡 Советы:</strong>
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
  return opt ? opt.textContent : 'Неизвестная специальность';
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
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Auth.getToken()}`
    };

    await fetch(`${API}/admission/save-history`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input, matches }),
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
    q: 'Что вам больше всего нравится делать?',
    opts: [
      { text: 'Решать логические задачи и писать код', tags: ['IT'] },
      { text: 'Помогать людям и лечить болезни', tags: ['Медицина'] },
      { text: 'Анализировать данные и управлять финансами', tags: ['Экономика'] },
      { text: 'Общаться, переговоры и международные дела', tags: ['Гуманитарные'] },
    ]
  },
  {
    q: 'Какой предмет в школе вам давался лучше всего?',
    opts: [
      { text: 'Математика и физика', tags: ['IT', 'Инженерия'] },
      { text: 'Биология и химия', tags: ['Медицина', 'Естественные науки'] },
      { text: 'Экономика и история', tags: ['Экономика', 'Право'] },
      { text: 'Языки и литература', tags: ['Гуманитарные', 'Образование'] },
    ]
  },
  {
    q: 'Где вы видите себя через 10 лет?',
    opts: [
      { text: 'В IT-компании или своём стартапе', tags: ['IT'] },
      { text: 'Врачом или учёным', tags: ['Медицина'] },
      { text: 'Бизнесменом или финансовым директором', tags: ['Экономика'] },
      { text: 'Дипломатом, юристом или журналистом', tags: ['Право', 'Гуманитарные'] },
    ]
  },
  {
    q: 'Ваш бюджет на обучение в год:',
    opts: [
      { text: 'До 1 млн тг — ищу бюджетный вариант', budget: 1000000, tags: [] },
      { text: '1–2 млн тг', budget: 2000000, tags: [] },
      { text: '2–3 млн тг', budget: 3000000, tags: [] },
      { text: 'Более 3 млн тг или есть грант', budget: 5000000, tags: [] },
    ]
  },
  {
    q: 'Как вы предпочитаете учиться?',
    opts: [
      { text: 'Практические проекты и лаборатории', tags: ['IT', 'Инженерия', 'Медицина'] },
      { text: 'Теория, исследования, научные работы', tags: ['Естественные науки', 'Гуманитарные'] },
      { text: 'Кейсы, бизнес-симуляции, дебаты', tags: ['Экономика', 'Право'] },
      { text: 'Общение с людьми, командная работа', tags: ['Образование', 'Гуманитарные'] },
    ]
  },
  {
    q: 'Что для вас важнее в будущей карьере?',
    opts: [
      { text: 'Высокая зарплата', tags: ['IT', 'Медицина', 'Экономика'] },
      { text: 'Стабильность и статус', tags: ['Право', 'Государственная служба'] },
      { text: 'Возможность путешествовать и работать за рубежом', tags: ['Гуманитарные', 'Экономика'] },
      { text: 'Польза обществу и людям', tags: ['Образование', 'Медицина'] },
    ]
  },
  {
    q: 'Насколько важен международный рейтинг вуза?',
    opts: [
      { text: 'Очень важен — хочу диплом мирового уровня', prestige: 'high', tags: [] },
      { text: 'Важен, но не первостепенен', prestige: 'medium', tags: [] },
      { text: 'Главное — специальность, не рейтинг', prestige: 'low', tags: [] },
      { text: 'Важна практика и связи с работодателями', prestige: 'practical', tags: [] },
    ]
  },
  {
    q: 'Вы уже знаете, чем хотите заниматься?',
    opts: [
      { text: 'Да, чётко определился(ась)', tags: [] },
      { text: 'Примерно понимаю направление', tags: [] },
      { text: 'Нет, ещё в поиске', tags: [] },
      { text: 'Хочу попробовать несколько направлений', tags: [] },
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
  document.getElementById('career-progress-text').textContent = `Вопрос ${careerState.current + 1} из ${total}`;

  document.getElementById('career-question-wrap').innerHTML = `
    <div class="career-question-card">
      <div class="career-q-num">Вопрос ${careerState.current + 1}</div>
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
    const res = await fetch(`${API}/universities`);
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
    'IT': 'Информационные технологии',
    'Медицина': 'Медицина и здравоохранение',
    'Экономика': 'Экономика и бизнес',
    'Право': 'Юриспруденция',
    'Инженерия': 'Инженерия',
    'Гуманитарные': 'Гуманитарные науки',
    'Образование': 'Педагогика',
    'Естественные науки': 'Естественные науки',
  };

  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    Auth.saveTestResult('career_test', recommendedUnis.length, 4, {
      summary: `Направления: ${topCats.join(', ')}`,
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
      <h2 class="career-result-title">Ваш профиль готов</h2>
      <p class="career-result-sub">На основе ваших ответов мы определили подходящие направления и университеты</p>
    </div>

    <div class="career-cats">
      <h3 class="career-section-label">Рекомендуемые направления</h3>
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
      <h3 class="career-section-label">Подходящие университеты</h3>
      <div class="career-unis-grid">
        ${recommendedUnis.map((u, i) => `
          <div class="career-uni-card ${i === 0 ? 'career-uni-top' : ''}">
            ${i === 0 ? '<div class="career-uni-badge">Лучший выбор</div>' : ''}
            <div class="career-uni-name">${u.short_name || u.name}</div>
            <div class="career-uni-fullname">${u.name}</div>
            <div class="career-uni-price">от ${fmtPrice(u.price_from)} тг/год</div>
            ${u.qs_world ? `<div class="career-uni-qs">QS World #${u.qs_world}</div>` : ''}
            <button class="btn btn-sm btn-detail" style="margin-top:12px" onclick="navigate('university', ${u.id})">Подробнее</button>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="career-fin-tip">
      <div class="career-tip-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6M12 18h.01"/></svg>
      </div>
      <div>
        <strong>Финансовый совет:</strong> при вашем бюджете до <strong>${fmtPrice(careerState.budget)} тг/год</strong>
        за 4 года вы потратите от <strong>${fmtPrice(recommendedUnis[0]?.price_from * 4)} тг</strong>.
        Используйте наш <a href="#" onclick="navigate('tips')" style="color:var(--accent);text-decoration:underline">калькулятор</a> чтобы рассчитать окупаемость.
      </div>
    </div>
  `;
  setTimeout(celebrateCompare, 400);
}

function restartCareerTest() {
  initCareerTest();
}
// ─── GRANTS ──────────────────────────────────
let allGrants = [];

async function loadGrants() {
  const grid = document.getElementById('grants-grid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/grants`);
    allGrants = await res.json();
    renderGrants(allGrants);
    initGrantMatching();
  } catch(e) {
    if(grid) grid.innerHTML = '<div class="loading-state"><p>Ошибка загрузки</p></div>';
  }
}

function filterGrants(type, btn) {
  document.querySelectorAll('.grant-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = type === 'all' ? allGrants : allGrants.filter(g => g.type === type);
  renderGrants(filtered);
}

function renderGrants(grants) {
  const grid = document.getElementById('grants-grid');
  if (!grid) return;
  if (!grants.length) { grid.innerHTML = '<div class="loading-state"><p>Нет грантов в этой категории</p></div>'; return; }

  const typeLabels = { government: 'Государственный', regional: 'Региональный', corporate: 'Корпоративный', university: 'Вузовский' };
  const typeColors = { government: 'accent', regional: 'gold', corporate: 'blue', university: 'purple' };

  grid.innerHTML = grants.map(g => `
    <div class="grant-card">
      <div class="grant-card-header">
        <span class="grant-type grant-type-${typeColors[g.type] || 'accent'}">${typeLabels[g.type] || g.type}</span>
        <span class="grant-amount">${g.amount}</span>
      </div>
      <h3 class="grant-name">${g.name}</h3>
      <p class="grant-desc">${g.description}</p>
      <div class="grant-requirements">
        <div class="grant-req-title">Требования:</div>
        <ul class="grant-req-list">
          ${(g.requirements || []).map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      <div class="grant-footer">
        <div class="grant-deadline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Дедлайн: ${g.deadline}
        </div>
        ${g.link ? `<a href="${g.link}" target="_blank" class="btn btn-sm btn-outline">Подробнее</a>` : ''}
      </div>
    </div>
  `).join('');
}

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
    <div class="prof-badge">AI Анализ профессии</div>
    <div class="prof-title">${data.title}</div>
    <div class="prof-subtitle">${name}</div>
    <div class="prof-grid">
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="prof-card-label">Средняя зарплата</div>
        <div class="prof-card-val">${data.salary}</div>
      </div>
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div class="prof-card-label">Рост рынка</div>
        <div class="prof-card-val" style="color:${data.growth !== '—' ? '#52b788' : 'var(--text-muted)'}">${data.growth}</div>
      </div>
      <div class="prof-card">
        <div class="prof-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="prof-card-label">Спрос</div>
        <div class="prof-card-val" style="color:${demandColor}">${data.demand}</div>
      </div>
    </div>
    <div class="prof-note">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      Данные основаны на анализе рынка труда Казахстана и международных тенденций 2025–2026 гг.
    </div>
  `;
  openModal('modal-profession');
}

// ─── GRANT MATCHING ───────────────────────────
function initGrantMatching() {
  const sel = document.getElementById('grant-ai-spec');
  if (!sel || sel.options.length > 1) return;
  const names = new Set();
  state.universities.forEach(u => {
    (u.specialties || []).forEach(s => names.add(s.name));
  });
  [...names].sort().forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });
}

function runGrantMatching() {
  const ent = parseInt(document.getElementById('grant-ai-ent').value) || 0;
  const spec = document.getElementById('grant-ai-spec').value;
  const resultEl = document.getElementById('grant-ai-result');

  if (!ent || !spec) {
    showToast('Введите балл ЕНТ и выберите специальность');
    return;
  }

  const matched = allGrants.filter(g => {
    const reqs = (g.requirements || []).join(' ').toLowerCase();
    const desc = (g.description || '').toLowerCase();
    const name = (g.name || '').toLowerCase();
    const specLower = spec.toLowerCase();
    return reqs.includes(specLower) || desc.includes(specLower) || name.includes(specLower);
  });

  const professionTitle = professionData[spec]?.title || spec;
  const hasDemand = professionData[spec];

  const demandHTML = hasDemand ? `
    <div class="gm-demand">
      <span>Спрос на рынке: <strong style="color:${demandColors[hasDemand.demand] || 'var(--text)'}">${hasDemand.demand}</strong></span>
      <span>Рост: <strong style="color:#52b788">${hasDemand.growth}</strong></span>
      <span>Средняя зарплата: <strong>${hasDemand.salary}</strong></span>
    </div>
  ` : '';

  resultEl.style.display = 'block';

  if (matched.length === 0) {
    resultEl.innerHTML = `
      <div class="gm-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Для специальности <strong>${spec}</strong> подходящих грантов пока не найдено.</span>
      </div>
    `;
    return;
  }

  resultEl.innerHTML = `
    <div class="gm-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>ИИ подобрал <strong>${matched.length}</strong> грант${matched.length !== 1 ? 'ов' : ''} для вас</span>
    </div>
    ${demandHTML}
    <div class="gm-list">
      ${matched.map(g => `
        <div class="gm-item">
          <div class="gm-check">✓</div>
          <div class="gm-info">
            <div class="gm-name">${g.name}</div>
            <div class="gm-meta">${g.type === 'university' ? 'Вузовский' : g.type} · ${g.amount}</div>
          </div>
          ${g.link ? `<a href="${g.link}" target="_blank" class="btn btn-sm btn-outline">Подробнее</a>` : ''}
        </div>
      `).join('')}
    </div>
  `;
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

  // Алматы центр: 43.2, 76.9
  mapInstance = window.mapInstance = L.map('map-container', { minZoom: 5, maxZoom: 18 }).setView([43.2, 76.9], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapInstance);

  const res = await fetch(`${API}/universities`);
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
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${u.short_name}</div>
        <div style="font-size:12px;color:#666;margin-bottom:6px">${u.name}</div>
        <div style="font-size:13px;color:#2d6a4f;font-weight:600">от ${fmtPrice(u.price_from)} тг/год</div>
        ${u.qs_world ? `<div style="font-size:12px;color:#888">QS World #${u.qs_world}</div>` : ''}
        <button onclick="navigate('university',${u.id})" style="margin-top:8px;padding:4px 10px;background:#2d6a4f;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer">Подробнее</button>
      </div>
    `);
    state.mapMarkers.push({ marker, uni: u });
    bounds.extend([u.lat, u.lng]);
  });

  // List under map
  const list = document.getElementById('map-uni-list');
  if (list) {
    list.innerHTML = `<div class="map-legend-title">Все университеты на карте (${unis.filter(u=>u.lat).length})</div><div class="map-uni-chips" id="map-chips">${unis.filter(u=>u.lat).map(u=>`<button class="map-uni-chip" onclick="mapFlyTo(${u.lat},${u.lng},'${u.short_name}')">${u.short_name}</button>`).join('')}</div>`;
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
    m.uni.short_name.toLowerCase().includes(query)
  ) : state.mapMarkers;
  
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
}

// ─── TIPS ────────────────────────────────────
function loadTips() {}