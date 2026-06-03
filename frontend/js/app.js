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

function toggleFavorite(id) {
  const idx = state.favoriteList.indexOf(id);
  if (idx > -1) {
    state.favoriteList.splice(idx, 1);
  } else {
    state.favoriteList.push(id);
  }
  saveFavorites();
  
  // Update card visual
  const btn = document.querySelector(`[data-favorite-btn="${id}"]`);
  if (btn) {
    btn.classList.toggle('favorited');
  }
  
  // Show toast
  const isFav = state.favoriteList.includes(id);
  showToast(isFav ? '♥ Добавлено в избранное' : '✕ Удалено из избранного');
}

function isFavorited(id) {
  return state.favoriteList.includes(id);
}

// ─── ROUTER ──────────────────────────────────
function navigate(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  state.currentPage = page;
  window.scrollTo(0, 0);

  if (page === 'home') {
    document.getElementById('page-home').classList.add('active');
    document.querySelectorAll('.nav-link')[0].classList.add('active');
    if (!state.universities.length) loadUniversities();
  } else if (page === 'university' && param) {
    document.getElementById('page-university').classList.add('active');
    loadUniversityDetail(param);
  } else if (page === 'compare') {
    document.getElementById('page-compare').classList.add('active');
    document.querySelectorAll('.nav-link')[1].classList.add('active');
    renderComparePage();
  } else if (page === 'grants') {
    document.getElementById('page-grants').classList.add('active');
    loadGrants();
  } else if (page === 'map') {
    document.getElementById('page-map').classList.add('active');
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
    loadTips();
  } else if (page === 'advisor') {
    document.getElementById('page-advisor').classList.add('active');
    document.querySelectorAll('.nav-link')[2].classList.add('active');
  } else if (page === 'roi') {
    document.getElementById('page-roi').classList.add('active');
    document.querySelectorAll('.nav-link')[3].classList.add('active');
    initROIPage();
  } else if (page === 'ent') {
    document.getElementById('page-ent').classList.add('active');
    document.querySelectorAll('.nav-link')[4].classList.add('active');
    updateENTScore(document.getElementById('ent-slider').value);
  } else if (page === 'career') {
    document.getElementById('page-career').classList.add('active');
    document.querySelectorAll('.nav-link')[5].classList.add('active');
    initCareerTest();
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
    { selector: '.nav-links .nav-link:nth-child(4)', path: 'nav.roi' },
    { selector: '.nav-links .nav-link:nth-child(5)', path: 'nav.ent' },
    { selector: '.nav-links .nav-link:nth-child(6)', path: 'nav.career' },
    { selector: '.nav-links .nav-link:nth-child(7)', path: 'nav.grants' },
    { selector: '.nav-links .nav-link:nth-child(8)', path: 'nav.map' },
    { selector: '.nav-links .nav-link:nth-child(9)', path: 'nav.tips' },
    
    // Мобильное меню
    { selector: '.mobile-menu-title', path: 'menu.title' },
    
    // Главная страница
    { selector: '.hero-title', path: 'home.hero_title' },
    { selector: '.hero-subtitle', path: 'home.hero_sub' },
    
    // Кнопки на главной странице
    { selector: '.hero-actions .btn-primary', path: 'home.hero_btn1' },
    { selector: '.hero-actions .btn-ghost', path: 'home.hero_btn2' },
    
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
  grid.innerHTML = renderSkeletonGrid(6);

  try {
    const sort = document.getElementById('filter-sort')?.value || 'qs_world';
    const priceMax = document.getElementById('filter-price')?.value || '';
    const specialty = document.getElementById('filter-specialty')?.value || '';
    const cityId = document.getElementById('filter-city')?.value || '';
    const isTop = document.getElementById('filter-top')?.value || '';

    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (priceMax) params.set('price_max', priceMax);
    if (specialty) params.set('specialty', specialty);
    if (cityId) params.set('city_id', cityId);
    if (isTop) params.set('is_top', isTop);

    const res = await fetch(`${API}/universities?${params}`);
    let unis = await res.json();
    state.universities = unis;

    // Client-side search filter
    const search = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (search) unis = unis.filter(u => u.name.toLowerCase().includes(search) || (u.short_name||'').toLowerCase().includes(search));

    // Client-side language filter
    const lang = document.getElementById('filter-language')?.value || '';
    if (lang) unis = unis.filter(u => (u.languages||[]).includes(lang));

    renderUniversityGrid(unis);
    document.getElementById('stat-unis').textContent = state.universities.length;
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
    const sel = document.getElementById('filter-specialty');
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
  } catch (e) { /* silent */ }
}

async function loadCities() {
  try {
    const res = await fetch(`${API}/cities`);
    const cities = await res.json();
    const sel = document.getElementById('filter-city');
    if (!sel) return;
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city.id;
      opt.textContent = `${city.name} (${city.count})`;
      sel.appendChild(opt);
    });
  } catch (e) { /* silent */ }
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
    <div class="uni-card skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-text-sm"></div>
        <div class="skeleton-text-sm"></div>
      </div>
      <div class="skeleton-text-lg"></div>
      <div class="skeleton-description"></div>
      <div class="skeleton-price"></div>
      <div class="skeleton-tags">
        <div class="skeleton-tag"></div>
        <div class="skeleton-tag"></div>
        <div class="skeleton-tag"></div>
      </div>
      <div class="skeleton-buttons">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
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
  return `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;">${html}</div>`;
}

function renderUniversityCard(u) {
  const isSelected = state.compareList.includes(u.id);
  const isFav = isFavorited(u.id);
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
      <div class="uni-specialties">${specTags}</div>
      <div class="uni-card-actions">
        <button class="btn btn-sm btn-compare ${isSelected ? 'selected' : ''}" onclick="toggleCompare(${u.id}, event)">
          ${isSelected ? 'В сравнении' : '+ Сравнить'}
        </button>
        <button class="btn btn-sm btn-detail" onclick="navigate('university', ${u.id})">Подробнее</button>
      </div>
    </div>
  `;
}

function applyFilters() {
  loadUniversities();
}

function resetFilters() {
  document.getElementById('filter-top').value = '';
  document.getElementById('filter-city').value = '';
  document.getElementById('filter-specialty').value = '';
  document.getElementById('filter-price').value = '';
  document.getElementById('filter-sort').value = 'qs_world';
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
    { label: 'Сайт', key: u => u.website ? `<a href="${u.website}" target="_blank" style="color:var(--accent)">${u.website.replace('https://', '')}</a>` : '—' },
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
      <div class="spec-tags">${names.map(n => `<span class="spec-tag">${n}</span>`).join('')}</div>
    </div>
  `).join('');

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
            ${u.website ? `<a href="${u.website}" target="_blank" class="btn btn-primary">Официальный сайт</a>` : ''}
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
      ${specCats ? `
        <div class="detail-specialties-section">
          <h2 class="detail-specialties-title">Специальности</h2>
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
    const res = await fetch(`${API}/ai/advice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-20),  // Last 20 messages
      })
    });
    const data = await res.json();
    removeTyping(typingId);

    if (!data.success) {
      appendMessage('ai', `Ошибка: ${data.error || 'Unknown error'}`);
    } else {
      // Show AI answer
      appendMessage('ai', data.answer);
      state.chatHistory.push({ role: 'assistant', content: data.answer });

      // If there are matches (relevant universities), show them as HTML
      if (data.matches && data.matches.length > 0) {
        appendMatches(data.matches);
      }

      // Log metadata for debugging (optional)
      console.log('[AI Response]', {
        confidence: data.metadata.confidence,
        fallback: data.metadata.fallback,
        universities_analyzed: data.metadata.universities_analyzed,
        took_ms: data.metadata.took_ms
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
 * Render university matches as compact cards
 */
function renderMatches(matches) {
  if (!matches || matches.length === 0) return '';

  let html = '<div class="ai-matches" style="margin-top: 1rem;">';
  html += '<strong>Релевантные вузы:</strong><div style="display: grid; gap: 0.5rem; margin-top: 0.5rem;">';

  matches.slice(0, 5).forEach(u => {
    const languages = (u.languages || []).join(', ');
    const specs = (u.specialties || []).slice(0, 2).join(', ');
    const qs = u.qs_world ? ` QS: ${u.qs_world}` : '';

    html += `
      <div style="padding: 0.75rem; background: #f5f5f5; border-radius: 4px; cursor: pointer;" onclick="navigate('university', ${u.id})">
        <strong>${u.short_name}</strong> (${u.name})<br/>
        <small>💰 ${u.price_from.toLocaleString()}-${u.price_to.toLocaleString()} тг/год${qs}</small><br/>
        <small>🌐 ${languages}</small><br/>
        <small>📚 ${specs}</small>
      </div>
    `;
  });

  html += '</div></div>';
  return html;
}

function appendMessage(role, text) {
  const msgs = document.getElementById('chat-messages');

  // Remove welcome if present
  const welcome = msgs.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'ai'}`;
  div.style.animation = 'fadeInUp 0.3s ease both';

  // Use marked.js for AI responses, plain text for user
  const content = role === 'ai' ? renderMarkdown(text) : `<p>${text}</p>`;
  div.innerHTML = `<div class="chat-bubble chat-bubble-${role === 'user' ? 'user' : 'ai'} markdown-body">${content}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendMatches(matches) {
  const msgs = document.getElementById('chat-messages');

  // Remove welcome if present
  const welcome = msgs.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-ai';
  div.style.animation = 'fadeInUp 0.3s ease both';

  // Add matches HTML directly (no markdown processing)
  const content = renderMatches(matches);
  div.innerHTML = `<div class="chat-bubble chat-bubble-ai">${content}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendTyping() {
  const msgs = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-ai';
  div.id = id;
  div.innerHTML = `<div class="chat-bubble"><div class="chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
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
  initLanguage();  // Initialize language selector
  loadFavorites();  // Initialize favorites from localStorage
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
   ROI CALCULATOR
   ============================================= */

function initROIPage() {
  const sel = document.getElementById('roi-uni');
  if (sel.options.length > 1) return; // already populated
  const unis = state.universities.length ? state.universities : null;
  if (!unis) {
    fetch(`${API}/universities`).then(r => r.json()).then(data => {
      data.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.dataset.price = u.price_from;
        opt.textContent = u.short_name || u.name;
        sel.appendChild(opt);
      });
    });
  } else {
    unis.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.dataset.price = u.price_from;
      opt.textContent = u.short_name || u.name;
      sel.appendChild(opt);
    });
  }

  document.getElementById('roi-uni').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    if (opt.dataset.price) {
      document.getElementById('roi-price').value = opt.dataset.price;
    }
  });

  document.getElementById('roi-salary').addEventListener('change', function() {
    const custom = document.getElementById('roi-salary-custom');
    custom.style.display = this.value === 'custom' ? 'block' : 'none';
  });
}

function calcROI() {
  const pricePerYear = parseInt(document.getElementById('roi-price').value) || 0;
  const salarySel = document.getElementById('roi-salary').value;
  const salary = salarySel === 'custom'
    ? parseInt(document.getElementById('roi-salary-custom').value) || 0
    : parseInt(salarySel) || 0;
  const grantCover = parseFloat(document.getElementById('roi-grant').value) || 0;
  const studYears = parseInt(document.getElementById('roi-years').value) || 4;
  const uniName = document.getElementById('roi-uni').options[document.getElementById('roi-uni').selectedIndex]?.textContent || 'Вуз';

  if (!pricePerYear || !salary) {
    showToast('Заполните стоимость обучения и ожидаемую зарплату');
    return;
  }

  const totalCost = pricePerYear * studYears * (1 - grantCover);
  const monthsToPayback = totalCost / salary;
  const yearsToPayback = monthsToPayback / 12;
  const totalEarned5y = salary * 12 * 5;
  const roi5y = ((totalEarned5y - totalCost) / totalCost * 100).toFixed(0);

  const resultEl = document.getElementById('roi-result');
  const color = yearsToPayback < 3 ? 'var(--green)' : yearsToPayback < 6 ? 'var(--gold)' : 'var(--red)';
  const verdict = yearsToPayback < 3 ? 'Отличная инвестиция' : yearsToPayback < 6 ? 'Хорошая инвестиция' : 'Требует обдумывания';

  resultEl.innerHTML = `
    <div class="tool-card roi-result-card">
      <div class="roi-verdict" style="color:${color}">${verdict}</div>
      <div class="roi-main-metric">
        <div class="roi-metric-val" style="color:${color}">${yearsToPayback.toFixed(1)} лет</div>
        <div class="roi-metric-label">до полной окупаемости</div>
      </div>
      <div class="roi-stats-grid">
        <div class="roi-stat">
          <div class="roi-stat-label">Полная стоимость обучения</div>
          <div class="roi-stat-val">${fmtPrice(totalCost)} тг</div>
        </div>
        <div class="roi-stat">
          <div class="roi-stat-label">Срок окупаемости</div>
          <div class="roi-stat-val">${Math.ceil(monthsToPayback)} месяцев</div>
        </div>
        <div class="roi-stat">
          <div class="roi-stat-label">Зарплата за 5 лет</div>
          <div class="roi-stat-val">${fmtPrice(totalEarned5y)} тг</div>
        </div>
        <div class="roi-stat">
          <div class="roi-stat-label">ROI за 5 лет работы</div>
          <div class="roi-stat-val" style="color:${parseInt(roi5y)>0?'var(--green)':'var(--red)'}">+${roi5y}%</div>
        </div>
      </div>
      <div class="roi-tip">
        <strong>Совет:</strong> При зарплате ${fmtPrice(salary)} тг/мес вы покроете стоимость обучения в ${uniName}
        примерно через <strong>${yearsToPayback.toFixed(1)} лет</strong> после окончания.
        ${grantCover > 0 ? `Грант экономит вам <strong>${fmtPrice(pricePerYear * studYears * grantCover)} тг</strong>.` : ''}
      </div>
    </div>
  `;

  // Show comparison bars
  showROIComparison(salary, studYears, grantCover);
}

async function showROIComparison(salary, studYears, grantCover) {
  const compWrap = document.getElementById('roi-comparison');
  compWrap.style.display = 'block';

  let unis = state.universities;
  if (!unis.length) {
    const res = await fetch(`${API}/universities`);
    unis = await res.json();
  }

  const items = unis.map(u => {
    const cost = u.price_from * studYears * (1 - grantCover);
    const months = cost / salary;
    return { name: u.short_name, months, cost };
  }).sort((a, b) => a.months - b.months);

  // Chart.js horizontal bar chart
  const barsEl = document.getElementById('roi-bars');
  barsEl.innerHTML = '<canvas id="roi-chart" height="320"></canvas>';

  if (typeof Chart !== 'undefined') {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#9c9890' : '#6b6760';

    new Chart(document.getElementById('roi-chart'), {
      type: 'bar',
      data: {
        labels: items.map(i => i.name),
        datasets: [{
          label: 'Лет до окупаемости',
          data: items.map(i => parseFloat((i.months/12).toFixed(1))),
          backgroundColor: items.map(i =>
            i.months < 36 ? '#52b788' : i.months < 72 ? '#e9c46a' : '#e63946'
          ),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.x} лет до окупаемости`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter' } },
            title: { display: true, text: 'лет', color: textColor }
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Inter', size: 12 } }
          }
        }
      }
    });
  } else {
    // Fallback bars
    const maxMonths = Math.max(...items.map(i => i.months));
    barsEl.innerHTML = items.map(item => {
      const pct = (item.months / maxMonths * 100).toFixed(1);
      const color = item.months < 36 ? 'var(--green)' : item.months < 72 ? 'var(--gold)' : 'var(--red)';
      return `<div class="roi-bar-row">
        <div class="roi-bar-label">${item.name}</div>
        <div class="roi-bar-track"><div class="roi-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="roi-bar-val">${(item.months/12).toFixed(1)} лет</div>
      </div>`;
    }).join('');
  }
}

/* =============================================
   ENT CALCULATOR
   ============================================= */

// Grant thresholds by specialty category (approximate 2025 data)
const ENT_THRESHOLDS = {
  'IT':               { grant: 90, paid: 50 },
  'Медицина':         { grant: 92, paid: 60 },
  'Право':            { grant: 82, paid: 50 },
  'Экономика':        { grant: 80, paid: 45 },
  'Инженерия':        { grant: 70, paid: 40 },
  'Гуманитарные':     { grant: 78, paid: 45 },
  'Образование':      { grant: 65, paid: 35 },
  'default':          { grant: 75, paid: 40 },
};

// Per-university approximate grant thresholds (top unis are more competitive)
const UNI_DIFFICULTY = {
  1: 1.05,  // КазНУ — slightly more competitive
  2: 1.10,  // КБТУ — highest
  3: 1.08,  // КазНМУ
  4: 0,     // КИМЭП — private, no state grants
  5: 0.95,
  6: 0,     // AlmaU — private
  7: 0.95,
  8: 0.95,
  9: 0.90,  // КазНПУ — easier to get grant
  10: 0.92,
  11: 0,    // Каспийский — private
};

function updateENTScore(val) {
  document.getElementById('ent-score-display').textContent = val;
  document.getElementById('ent-slider').value = val;
  const exact = document.getElementById('ent-exact');
  if (exact) exact.value = val;
}

function syncENTInput(val) {
  const clamped = Math.min(140, Math.max(0, parseInt(val) || 0));
  document.getElementById('ent-slider').value = clamped;
  document.getElementById('ent-score-display').textContent = clamped;
}

async function calcENT() {
  const score = parseInt(document.getElementById('ent-slider').value) || 0;
  const specialty = document.getElementById('ent-specialty').value;
  const resultsEl = document.getElementById('ent-results');

  let unis = state.universities;
  if (!unis.length) {
    const res = await fetch(`${API}/universities`);
    unis = await res.json();
  }

  const thresholds = ENT_THRESHOLDS[specialty] || ENT_THRESHOLDS['default'];

  const results = unis.map(u => {
    const diff = UNI_DIFFICULTY[u.id];
    const hasGrant = diff > 0; // private unis (diff=0) have no state grants

    if (!hasGrant) {
      return { u, status: 'paid', label: 'Платное', note: 'Частный вуз — госгрант не предусмотрен', color: 'var(--text2)' };
    }

    const grantThreshold = Math.round(thresholds.grant * diff);
    const paidThreshold = thresholds.paid;

    if (score >= grantThreshold) {
      return { u, status: 'grant', label: 'Грант', note: `Порог гранта ~${grantThreshold} баллов`, color: 'var(--green)' };
    } else if (score >= paidThreshold) {
      const gap = grantThreshold - score;
      return { u, status: 'paid_possible', label: 'Платное', note: `До гранта не хватает ${gap} баллов`, color: 'var(--gold)' };
    } else {
      return { u, status: 'unlikely', label: 'Мало шансов', note: `Минимум для поступления ~${paidThreshold} баллов`, color: 'var(--red)' };
    }
  });

  // Sort: grant first, then paid, then unlikely
  const order = { grant: 0, paid_possible: 1, unlikely: 2, paid: 3 };
  results.sort((a, b) => order[a.status] - order[b.status]);

  const grantCount = results.filter(r => r.status === 'grant').length;
  const paidCount = results.filter(r => r.status === 'paid_possible').length;

  resultsEl.innerHTML = `
    <div class="ent-summary">
      <div class="ent-summary-stat" style="color:var(--green)">
        <div class="ent-summary-num">${grantCount}</div>
        <div class="ent-summary-label">вузов — грант</div>
      </div>
      <div class="ent-summary-stat" style="color:var(--gold)">
        <div class="ent-summary-num">${paidCount}</div>
        <div class="ent-summary-label">вузов — платно</div>
      </div>
      <div class="ent-summary-stat">
        <div class="ent-summary-num">${score}</div>
        <div class="ent-summary-label">ваш балл</div>
      </div>
    </div>
    <div class="ent-uni-list">
      ${results.map(r => `
        <div class="ent-uni-row">
          <div class="ent-uni-info">
            <div class="ent-uni-name">${r.u.short_name}</div>
            <div class="ent-uni-note">${r.note}</div>
          </div>
          <div class="ent-uni-price">${fmtPrice(r.u.price_from)} тг/год</div>
          <div class="ent-status-badge" style="background:${r.color}20;color:${r.color};border-color:${r.color}40">${r.label}</div>
        </div>
      `).join('')}
    </div>
    <p class="ent-disclaimer">* Пороговые баллы — ориентировочные на основе данных МОН РК за 2024 год. Точные пороги публикуются после объявления результатов ЕНТ.</p>
  `;
}

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

  document.getElementById('career-result-inner').innerHTML = `
  // 🎉 Confetti on career result
  setTimeout(celebrateCompare, 400);
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
        Используйте наш <a href="#" onclick="navigate('roi')" style="color:var(--accent);text-decoration:underline">ROI-калькулятор</a> чтобы рассчитать окупаемость.
      </div>
    </div>
  `;
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

  const unis = state.universities.length ? state.universities : await fetch(`${API}/universities`).then(r=>r.json());
  state.mapUniversities = unis;

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
async function loadTips() {
  const grid = document.getElementById('tips-grid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/tips`);
    const tips = await res.json();
    renderTips(tips);
  } catch(e) {
    if(grid) grid.innerHTML = '<div class="loading-state"><p>Ошибка загрузки</p></div>';
  }
}

function renderTips(tips) {
  const grid = document.getElementById('tips-grid');
  if (!grid) return;

  const catColors = {
    'Финансы': 'accent',
    'Рейтинги': 'gold',
    'Качество образования': 'blue',
    'Выбор вуза': 'purple'
  };

  grid.innerHTML = tips.map((t, i) => `
    <div class="tip-card" onclick="toggleTip(${t.id})">
      <div class="tip-card-header">
        <div class="tip-num">${String(i+1).padStart(2,'0')}</div>
        <div class="tip-info">
          <span class="tip-cat tip-cat-${catColors[t.category] || 'accent'}">${t.category}</span>
          <h3 class="tip-title">${t.title}</h3>
        </div>
        <div class="tip-arrow" id="tip-arrow-${t.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="tip-body" id="tip-body-${t.id}" style="display:none">
        <p class="tip-content">${t.content}</p>
        <div class="tip-highlight">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          ${t.tip}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleTip(id) {
  const body = document.getElementById(`tip-body-${id}`);
  const arrow = document.getElementById(`tip-arrow-${id}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
}