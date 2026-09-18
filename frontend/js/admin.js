const API = '/api';
const root = document.getElementById('admin-root');
const daysSelect = document.getElementById('admin-days');
let activeAdminTab = 'overview';
let reviewStatusFilter = 'all';
let adminModal = null;

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

const statusLabels = { collecting: 'Сбор документов', submitted: 'Подано', waiting: 'Ожидание', accepted: 'Зачислены', enrolled: 'Оплачивают', rejected: 'Отказ' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const date = value => value ? new Date(value).toLocaleDateString('ru-RU') : '—';
const dateFull = value => value ? new Date(value).toLocaleString('ru-RU') : '—';

function showModal(title, content, onClose) {
  if (adminModal) adminModal.remove();
  adminModal = document.createElement('div');
  adminModal.className = 'admin-modal-overlay';
  adminModal.innerHTML = `<div class="admin-modal"><div class="admin-modal-header"><h3>${esc(title)}</h3><button class="admin-modal-close" id="modal-close">&times;</button></div><div class="admin-modal-body">${content}</div></div>`;
  document.body.appendChild(adminModal);
  adminModal.querySelector('#modal-close').onclick = () => { adminModal.remove(); adminModal = null; if (onClose) onClose(); };
  adminModal.onclick = e => { if (e.target === adminModal) { adminModal.remove(); adminModal = null; if (onClose) onClose(); } };
}

function closeModal() { if (adminModal) { adminModal.remove(); adminModal = null; } }

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `admin-toast admin-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

async function loadAdmin() {
  root.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  try {
    const search = document.getElementById('admin-search').value;
    const days = Number(daysSelect.value);
    const [data, reviewsData, applicationsData, usersData, universitiesData, grantsData, auditData, sourcesData] = await Promise.all([
      api(`/admin/overview?days=${days}`), api('/admin/reviews?limit=100'), api('/admin/applications?limit=100'), api('/admin/users?limit=200'), api('/admin/universities?limit=300'), api('/admin/grants?limit=500'), api('/admin/audit?limit=100'), api('/admin/sources')
    ]);
    const o = data.overview;
    const reviews = reviewsData.reviews || [];
    const applications = applicationsData.applications || [];
    const users = usersData.users || [];
    const universities = universitiesData.universities || [];
    const grants = grantsData.grants || [];
    const audit = auditData.audit || [];
    const sources = sourcesData.sources || [];

    root.innerHTML = `
      <section class="admin-section active" data-admin-section="overview">
        <section class="admin-metrics">
          ${[['Пользователи', o.users, `+${o.periodUsers} за период`], ['Вузы', o.universities, 'В каталоге'], ['Заявки', o.applications, `+${o.periodApplications} за период`], ['Диалоги с ИИ', o.chatMessages, `+${o.periodChats} за период`]].map(item => `<article class="admin-metric"><strong>${item[1] || 0}</strong><span>${item[0]}</span><small>${item[2]}</small></article>`).join('')}
        </section>
        <section class="admin-grid">
          <article class="admin-block"><h2>Заявки по статусам</h2>${(data.applicationStatuses || []).map(item => `<div class="admin-row"><span>${esc(statusLabels[item.status] || item.status)}</span><strong>${item.count}</strong></div>`).join('') || '<p>Нет данных</p>'}</article>
          <article class="admin-block"><h2>Темы ИИ</h2>${(data.intents || []).map(item => `<div class="admin-row"><span>${esc(item.intent)}</span><strong>${item.count}</strong></div>`).join('') || '<p>Нет данных</p>'}</article>
        </section>
      </section>

      <section class="admin-section" data-admin-section="users">
        <div class="admin-block">
          <div class="admin-section-header"><h2>Пользователи (${users.length})</h2></div>
          <div class="admin-table-wrap"><table><thead><tr><th>ID</th><th>Логин</th><th>Email</th><th>Имя</th><th>Админ</th><th>Забанен</th><th>Регистрация</th><th>Действия</th></tr></thead><tbody>
          ${users.map(item => `<tr class="${item.is_banned ? 'admin-row-banned' : ''}" data-user-id="${item.id}">
            <td>${item.id}</td>
            <td>${esc(item.username)}${item.is_admin ? ' <span class="admin-badge admin-badge-admin">ADMIN</span>' : ''}</td>
            <td>${esc(item.email)}</td>
            <td>${esc(item.full_name || '—')}</td>
            <td>${item.is_admin ? '✓' : '—'}</td>
            <td>${item.is_banned ? '<span class="admin-badge admin-badge-red">ЗАБАНЕН</span>' : '—'}</td>
            <td>${date(item.created_at)}</td>
            <td class="admin-actions-cell">
              <button class="btn btn-ghost btn-xs" data-admin-action="viewUser" data-id="${item.id}">Профиль</button>
              <button class="btn btn-ghost btn-xs" data-admin-action="editUser" data-id="${item.id}">Изменить</button>
              ${item.email !== 'janibekkaz3@gmail.com' ? `
                <button class="btn btn-ghost btn-xs" data-admin-action="toggleBanUser" data-id="${item.id}" data-value="${item.is_banned ? 0 : 1}">${item.is_banned ? 'Разбанить' : 'Забанить'}</button>
                <button class="btn btn-ghost btn-xs" data-admin-action="toggleAdminUser" data-id="${item.id}" data-value="${item.is_admin ? 0 : 1}">${item.is_admin ? 'Снять админа' : 'Сделать админом'}</button>
                <button class="btn btn-ghost btn-xs admin-danger-btn" data-admin-action="deleteUser" data-id="${item.id}">Удалить</button>
                <button class="btn btn-ghost btn-xs" data-admin-action="resetUserPassword" data-id="${item.id}">Сброс пароля</button>
              ` : ''}
            </td>
          </tr>`).join('')}
          </tbody></table></div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="universities">
        <div class="admin-block">
          <div class="admin-section-header"><h2>Каталог вузов (${universities.length})</h2><button class="btn btn-primary btn-sm" data-admin-action="createUniversity">+ Добавить вуз</button></div>
          <div class="admin-table-wrap"><table><thead><tr><th>ID</th><th>Название</th><th>Город</th><th>Статус</th><th>Цена от</th><th>Цена до</th><th>Обновлён</th><th>Действия</th></tr></thead><tbody>
          ${universities.map(item => `<tr data-uni-id="${item.id}">
            <td>${item.id}</td>
            <td>${esc(item.short_name || item.name)}</td>
            <td>${esc(item.city || '—')}</td>
            <td><select class="admin-status-select" data-admin-change="university-status" data-id="${item.id}"><option value="active" ${item.data_status === 'active' ? 'selected' : ''}>Активен</option><option value="pending" ${item.data_status === 'pending' ? 'selected' : ''}>На проверке</option><option value="inactive" ${item.data_status === 'inactive' ? 'selected' : ''}>Скрыт</option></select></td>
            <td>${item.price_from ? item.price_from.toLocaleString('ru-RU') + ' ₸' : '—'}</td>
            <td>${item.price_to ? item.price_to.toLocaleString('ru-RU') + ' ₸' : '—'}</td>
            <td>${date(item.last_updated_at)}</td>
            <td class="admin-actions-cell">
              <button class="btn btn-ghost btn-xs" data-admin-action="viewUniversity" data-id="${item.id}">Подробнее</button>
              <button class="btn btn-ghost btn-xs" data-admin-action="editUniversity" data-id="${item.id}">Изменить</button>
              <button class="btn btn-ghost btn-xs admin-danger-btn" data-admin-action="deleteUniversity" data-id="${item.id}">Удалить</button>
            </td>
          </tr>`).join('')}
          </tbody></table></div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="grants">
        <div class="admin-block">
          <div class="admin-section-header"><h2>Гранты и финансирование (${grants.length})</h2><span class="admin-badge admin-badge-yellow">needs_review: ${grants.filter(item => item.verification_status === 'needs_review').length}</span></div>
          <div class="admin-table-wrap"><table><thead><tr><th>Название</th><th>Вуз</th><th>Тип</th><th>Статус</th><th>Источник</th><th>Проверено</th><th>Действия</th></tr></thead><tbody>
          ${grants.map(item => `<tr data-grant-id="${item.id}">
            <td>${esc(item.name)}</td><td>${esc(item.university_name || '—')}</td><td>${esc(item.type)}</td>
            <td><span class="admin-badge ${item.verification_status === 'verified' ? 'admin-badge-green' : item.verification_status === 'expired' ? 'admin-badge-red' : 'admin-badge-yellow'}">${esc(item.verification_status)}</span></td>
            <td>${item.source_url ? `<a href="${esc(item.source_url)}" target="_blank" rel="noopener">Открыть</a>` : '—'}</td><td>${esc(item.verified_at || '—')}</td>
            <td><button class="btn btn-ghost btn-xs" data-admin-action="verifyGrant" data-id="${item.id}">Проверить</button></td>
          </tr>`).join('') || '<tr><td colspan="7">Грантов нет</td></tr>'}
          </tbody></table></div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="applications">
        <div class="admin-block"><h2>Последние заявки (${applications.length})</h2><div class="admin-table-wrap"><table><thead><tr><th>Пользователь</th><th>Вуз</th><th>Статус</th><th>Год</th><th>Создана</th></tr></thead><tbody>${applications.map(item => `<tr><td>${esc(item.username || item.email)}</td><td>${esc(item.short_name || item.university_name)}</td><td>${esc(statusLabels[item.status] || item.status)}</td><td>${esc(item.academic_year)}</td><td>${date(item.created_at)}</td></tr>`).join('') || '<tr><td colspan="5">Нет заявок</td></tr>'}</tbody></table></div></div>
      </section>

      <section class="admin-section" data-admin-section="reviews">
        <div class="admin-block">
          <h2>Модерация отзывов <small>${o.pendingReviews} требуют проверки</small></h2>
          <label>Статус: <select id="admin-review-status" class="admin-status-select"><option value="all">Все</option><option value="pending">На проверке</option><option value="approved">Одобрены</option><option value="hidden">Скрыты</option></select></label>
          <div class="admin-review-list">${reviews.map(review => `<article class="admin-review-item" data-review-status="${review.moderation_status || 'pending'}"><div class="admin-review-top"><strong>${esc(review.short_name || review.university_name)}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div><div class="admin-review-meta">${esc(review.user_name)} · ${date(review.created_at)} · ${esc(review.moderation_status || 'pending')}</div><p>${esc(review.comment || review.pros || review.cons || 'Без текста')}</p><div class="admin-review-actions"><button class="btn btn-primary btn-xs" data-admin-action="moderate" data-id="${review.id}" data-value="true">Одобрить</button><button class="btn btn-ghost btn-xs" data-admin-action="moderate" data-id="${review.id}" data-value="false">Скрыть</button><button class="btn btn-ghost btn-xs admin-danger-btn" data-admin-action="removeReview" data-id="${review.id}">Удалить</button></div></article>`).join('') || '<p>Отзывов пока нет</p>'}</div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="audit">
        <div class="admin-block"><h2>Журнал действий</h2><div class="admin-table-wrap"><table><thead><tr><th>Дата</th><th>Таблица</th><th>ID</th><th>Действие</th><th>Администратор</th></tr></thead><tbody>${audit.map(item => `<tr><td>${dateFull(item.created_at)}</td><td>${esc(item.table_name)}</td><td>${item.record_id || '—'}</td><td>${esc(item.action)}</td><td>${esc(item.email || 'system')}</td></tr>`).join('') || '<tr><td colspan="5">Действий пока нет</td></tr>'}</tbody></table></div></div>
      </section>

      <section class="admin-section" data-admin-section="verification"><div class="admin-block" id="verification-admin"></div></section>

      <section class="admin-section" data-admin-section="sources">
        <div class="admin-block">
          <div class="admin-section-header"><h2>Источники данных (${sources.length})</h2><button class="btn btn-ghost btn-sm" data-admin-action="checkAllSources">Проверить все</button></div>
          <div class="admin-table-wrap"><table><thead><tr><th>Источник</th><th>Тип</th><th>Статус</th><th>Проверка</th><th>Изменения</th><th>Действия</th></tr></thead><tbody>
          ${sources.map(s => {
            const statusBadge = s.status === 'reachable'
              ? (s.reviewRequired ? '<span class="admin-badge admin-badge-yellow">ТРЕБУЕТ ПРОВЕРКИ</span>' : '<span class="admin-badge admin-badge-green">ОК</span>')
              : s.status === 'unavailable'
                ? '<span class="admin-badge admin-badge-red">НЕДОСТУПЕН</span>'
                : '<span class="admin-badge admin-badge-gray">НЕ ПРОВЕРЕН</span>';
            const changeBadge = s.changeStatus === 'changed' ? '<span class="admin-badge admin-badge-yellow">ИЗМЕНЁН</span>' : s.changeStatus === 'first_observation' ? '<span class="admin-badge admin-badge-gray">ПЕРВЫЙ</span>' : '';
            const lastCheck = s.checkedMs ? new Date(s.checkedMs).toLocaleString('ru-RU') : '—';
            const typeLabels = { admission: 'Поступление', tuition: 'Стоимость', subjects: 'Предметы', ent_thresholds: 'ЕНТ пороги', dorm: 'Общежитие', funding: 'Гранты' };
            return `<tr>
              <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></td>
              <td>${esc(typeLabels[s.dataType] || s.dataType)}</td>
              <td>${statusBadge}</td>
              <td>${lastCheck}</td>
              <td>${changeBadge || '—'}</td>
              <td class="admin-actions-cell">
                <button class="btn btn-ghost btn-xs" data-admin-action="checkSource" data-id="${s.id}">Проверить</button>
                <button class="btn btn-ghost btn-xs" data-admin-action="viewSourceHistory" data-id="${s.id}">История</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody></table></div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="grantsAdmin">
        <div class="admin-block">
          <div class="admin-section-header"><h2>Гранты (${grantsAdmin.length})</h2>
            <div style="display:flex;gap:6px">
              <select id="admin-grant-status" class="admin-status-select"><option value="">Все статусы</option><option value="needs_review">Требует проверки</option><option value="verified">Проверено</option><option value="expired">Истёк</option></select>
            </div>
          </div>
          <div class="admin-table-wrap"><table><thead><tr><th>ID</th><th>Название</th><th>Вуз</th><th>Тип</th><th>Покрытие</th><th>Дедлайн</th><th>Статус</th><th>Действия</th></tr></thead><tbody>
          ${grantsAdmin.map(g => {
            const statusBadge = g.verification_status === 'verified'
              ? '<span class="admin-badge admin-badge-green">ПРОВЕРЕНО</span>'
              : g.verification_status === 'expired'
                ? '<span class="admin-badge admin-badge-red">ИСТЁК</span>'
                : '<span class="admin-badge admin-badge-yellow">ТРЕБУЕТ ПРОВЕРКИ</span>';
            const typeLabels = { government:'Гос.', university:'Вуз', corporate:'Корп.', regional:'Рег.', foundation:'Фонд', international:'Межд.', discount:'Скидка' };
            const coverageLabels = { full:'100%', partial:'Частичн.', tuition_only:'Учёба', tuition_dorm:'Учёба+общ.', stipend_only:'Стип.', unknown:'?' };
            return `<tr>
              <td>${g.id}</td>
              <td>${esc(g.name)}</td>
              <td>${esc(g.uni_short_name || '—')}</td>
              <td>${esc(typeLabels[g.type] || g.type)}</td>
              <td>${esc(coverageLabels[g.coverage_type] || g.coverage_type || '—')}</td>
              <td>${esc(g.deadline || '—')}</td>
              <td>${statusBadge}</td>
              <td class="admin-actions-cell">
                ${g.source_url ? `<a class="btn btn-ghost btn-xs" href="${esc(g.source_url)}" target="_blank" rel="noopener">Источник ↗</a>` : ''}
                <button class="btn btn-ghost btn-xs" data-admin-action="editGrant" data-id="${g.id}">Изменить</button>
                ${g.verification_status !== 'verified' ? `<button class="btn btn-ghost btn-xs" data-admin-action="verifyGrant" data-id="${g.id}">✓ Проверено</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
          </tbody></table></div>
        </div>
      </section>`;

    const reviewSection = root.querySelector('[data-admin-section="reviews"] .admin-block');
    root.insertAdjacentHTML('beforeend', '<section class="admin-section" data-admin-section="verification"><div class="admin-block" id="verification-admin"></div></section>');
    if (typeof Verification !== 'undefined') Verification.admin();

    const reviewStatusSelect = document.getElementById('admin-review-status');
    if (reviewStatusSelect) {
      reviewStatusSelect.value = reviewStatusFilter;
      reviewStatusSelect.addEventListener('change', () => {
        reviewStatusFilter = reviewStatusSelect.value;
        filterAdminRows(document.getElementById('admin-search').value);
      });
    }

    showAdminTab(activeAdminTab);
    document.getElementById('admin-search').value = search;
    filterAdminRows(search);
  } catch (error) {
    root.innerHTML = `<div class="admin-error">${esc(error.message)}<br><a href="/">Вернуться на сайт</a></div>`;
  }
}

// ─── USER ACTIONS ──────────────────────────────

async function viewUser(id) {
  try {
    const data = await api(`/admin/users/${id}`);
    const u = data.user;
    showModal(`Профиль: ${esc(u.username)}`, `
      <div class="admin-profile-grid">
        <div><strong>Email:</strong> ${esc(u.email)}</div>
        <div><strong>Имя:</strong> ${esc(u.full_name || '—')}</div>
        <div><strong>Телефон:</strong> ${esc(u.phone || '—')}</div>
        <div><strong>Bio:</strong> ${esc(u.bio || '—')}</div>
        <div><strong>ЕНТ балл:</strong> ${u.ent_score || '—'}</div>
        <div><strong>Админ:</strong> ${u.is_admin ? 'Да' : 'Нет'}</div>
        <div><strong>Забанен:</strong> ${u.is_banned ? 'Да' : 'Нет'}</div>
        <div><strong>Заявок:</strong> ${u.applications}</div>
        <div><strong>Чатов:</strong> ${u.chats}</div>
        <div><strong>Сохранённых вузов:</strong> ${u.saved}</div>
        <div><strong>Зарегистрирован:</strong> ${dateFull(u.created_at)}</div>
      </div>
    `);
  } catch (error) { showToast(error.message, 'error'); }
}

async function editUser(id) {
  try {
    const data = await api(`/admin/users/${id}`);
    const u = data.user;
    showModal(`Редактировать: ${esc(u.username)}`, `
      <form id="edit-user-form" class="admin-form">
        <label>Имя <input name="full_name" value="${esc(u.full_name || '')}" /></label>
        <label>Логин <input name="username" value="${esc(u.username || '')}" /></label>
        <label>Телефон <input name="phone" value="${esc(u.phone || '')}" /></label>
        <label>Bio <textarea name="bio" rows="3">${esc(u.bio || '')}</textarea></label>
        <label>ЕНТ балл <input name="ent_score" type="number" value="${u.ent_score || ''}" /></label>
        <div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-sm">Сохранить</button><button type="button" class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>
      </form>
    `);
    document.getElementById('edit-user-form').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {};
      for (const [k, v] of fd.entries()) body[k] = v;
      try { await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); closeModal(); showToast('Пользователь обновлён'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (error) { showToast(error.message, 'error'); }
}

async function toggleBanUser(id, ban) {
  showModal(ban ? 'Забанить пользователя?' : 'Разбанить пользователя?', `<p>Вы уверены?</p><div class="admin-form-actions"><button class="btn btn-primary btn-sm" id="modal-confirm">Да</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ is_banned: ban }) }); closeModal(); showToast(ban ? 'Пользователь забанен' : 'Пользователь разбанен'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

async function toggleAdminUser(id, admin) {
  showModal(admin ? 'Сделать админом?' : 'Снять админа?', `<p>Вы уверены?</p><div class="admin-form-actions"><button class="btn btn-primary btn-sm" id="modal-confirm">Да</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: admin }) }); closeModal(); showToast(admin ? 'Права администратора выданы' : 'Права администратора сняты'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

async function deleteUser(id) {
  showModal('Удалить пользователя?', `<p>Это действие необратимо. Все данные пользователя будут удалены.</p><div class="admin-form-actions"><button class="btn btn-danger btn-sm" id="modal-confirm">Удалить</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try { await api(`/admin/users/${id}`, { method: 'DELETE' }); closeModal(); showToast('Пользователь удалён'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

async function resetUserPassword(id) {
  showModal('Сбросить пароль?', `<p>Новый пароль будет сгенерирован автоматически.</p><div class="admin-form-actions"><button class="btn btn-primary btn-sm" id="modal-confirm">Сбросить</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try {
      const data = await api(`/admin/users/${id}/reset-password`, { method: 'POST' });
      closeModal();
      showModal('Новый пароль', `<div class="admin-new-password"><code>${esc(data.newPassword)}</code><p>Скопируйте и передайте пользователю.</p></div>`);
      showToast('Пароль сброшен');
    } catch (err) { showToast(err.message, 'error'); }
  };
}

// ─── UNIVERSITY ACTIONS ──────────────────────────────

async function viewUniversity(id) {
  try {
    const data = await api(`/admin/universities/${id}`);
    const u = data.university;
    const specs = data.specialties || [];
    const revs = data.reviews || [];
    showModal(`Вуз: ${esc(u.short_name || u.name)}`, `
      <div class="admin-profile-grid">
        <div><strong>Название:</strong> ${esc(u.name)}</div>
        <div><strong>Короткое:</strong> ${esc(u.short_name || '—')}</div>
        <div><strong>Город:</strong> ${esc(u.city_name || '—')}</div>
        <div><strong>Адрес:</strong> ${esc(u.address || '—')}</div>
        <div><strong>Сайт:</strong> ${u.website ? `<a href="${esc(u.website)}" target="_blank">${esc(u.website)}</a>` : '—'}</div>
        <div><strong>Телефон:</strong> ${esc(u.admission_phone || '—')}</div>
        <div><strong>Email:</strong> ${esc(u.admission_email || '—')}</div>
        <div><strong>Цена от:</strong> ${u.price_from ? u.price_from.toLocaleString('ru-RU') + ' ₸' : '—'}</div>
        <div><strong>Цена до:</strong> ${u.price_to ? u.price_to.toLocaleString('ru-RU') + ' ₸' : '—'}</div>
        <div><strong>Основан:</strong> ${u.founded_year || '—'}</div>
        <div><strong>Студентов:</strong> ${u.total_students || '—'}</div>
        <div><strong>Общежитие:</strong> ${u.dormitory ? 'Есть' : 'Нет'}</div>
        <div><strong>Статус:</strong> ${esc(u.data_status)}</div>
        <div><strong>Обновлён:</strong> ${dateFull(u.last_updated_at)}</div>
      </div>
      ${specs.length ? `<h3 style="margin-top:16px">Специальности (${specs.length})</h3><div class="admin-spec-list">${specs.map(s => `<div class="admin-spec-item"><span>${esc(s.name)}</span><small>${esc(s.code || '')}</small></div>`).join('')}</div>` : ''}
      ${revs.length ? `<h3 style="margin-top:16px">Последние отзывы</h3>${revs.map(r => `<div class="admin-review-mini"><span>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> <strong>${esc(r.user_name)}</strong> <small>(${esc(r.moderation_status)})</small><p>${esc(r.comment || '—')}</p></div>`).join('')}` : ''}
    `);
  } catch (error) { showToast(error.message, 'error'); }
}

async function editUniversity(id) {
  try {
    const data = await api(`/admin/universities/${id}`);
    const u = data.university;
    showModal(`Редактировать: ${esc(u.short_name || u.name)}`, `
      <form id="edit-uni-form" class="admin-form admin-form-grid">
        <label>Полное название <input name="name" value="${esc(u.name)}" required /></label>
        <label>Короткое <input name="short_name" value="${esc(u.short_name || '')}" /></label>
        <label>Сайт <input name="website" value="${esc(u.website || '')}" /></label>
        <label>Адрес <input name="address" value="${esc(u.address || '')}" /></label>
        <label>Телефон <input name="admission_phone" value="${esc(u.admission_phone || '')}" /></label>
        <label>Email <input name="admission_email" value="${esc(u.admission_email || '')}" /></label>
        <label>Цена от <input name="price_from" type="number" value="${u.price_from || ''}" /></label>
        <label>Цена до <input name="price_to" type="number" value="${u.price_to || ''}" /></label>
        <label>Год основания <input name="founded_year" type="number" value="${u.founded_year || ''}" /></label>
        <label>Студентов <input name="total_students" type="number" value="${u.total_students || ''}" /></label>
        <label>Широта <input name="latitude" type="number" step="any" value="${u.latitude || ''}" /></label>
        <label>Долгота <input name="longitude" type="number" step="any" value="${u.longitude || ''}" /></label>
        <label>Статус <select name="data_status"><option value="active" ${u.data_status === 'active' ? 'selected' : ''}>Активен</option><option value="pending" ${u.data_status === 'pending' ? 'selected' : ''}>На проверке</option><option value="inactive" ${u.data_status === 'inactive' ? 'selected' : ''}>Скрыт</option></select></label>
        <label class="admin-checkbox-label"><input type="checkbox" name="dormitory" ${u.dormitory ? 'checked' : ''} /> Общежитие</label>
        <label>Описание <textarea name="description" rows="3">${esc(u.description || '')}</textarea></label>
        <div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-sm">Сохранить</button><button type="button" class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>
      </form>
    `);
    document.getElementById('edit-uni-form').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {};
      for (const [k, v] of fd.entries()) body[k] = v;
      body.dormitory = fd.has('dormitory');
      try { await api(`/admin/universities/${id}`, { method: 'PUT', body: JSON.stringify(body) }); closeModal(); showToast('Вуз обновлён'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (error) { showToast(error.message, 'error'); }
}

function createUniversity() {
  showModal('Новый вуз', `
    <form id="create-uni-form" class="admin-form admin-form-grid">
      <label>Полное название <input name="name" required /></label>
      <label>Короткое <input name="short_name" /></label>
      <label>Сайт <input name="website" /></label>
      <label>Адрес <input name="address" /></label>
      <label>Телефон <input name="admission_phone" /></label>
      <label>Email <input name="admission_email" /></label>
      <label>Цена от <input name="price_from" type="number" /></label>
      <label>Цена до <input name="price_to" type="number" /></label>
      <label>Статус <select name="data_status"><option value="pending">На проверке</option><option value="active">Активен</option></select></label>
      <div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-sm">Создать</button><button type="button" class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>
    </form>
  `);
  document.getElementById('create-uni-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    for (const [k, v] of fd.entries()) body[k] = v;
    try { await api('/admin/universities', { method: 'POST', body: JSON.stringify(body) }); closeModal(); showToast('Вуз создан'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

async function deleteUniversity(id) {
  showModal('Удалить вуз?', `<p>Это действие необратимо. Все специальности и отзывы будут удалены.</p><div class="admin-form-actions"><button class="btn btn-danger btn-sm" id="modal-confirm">Удалить</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try { await api(`/admin/universities/${id}`, { method: 'DELETE' }); closeModal(); showToast('Вуз удалён'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

async function changeUniversityStatus(id, status) {
  try { await api(`/admin/universities/${id}`, { method: 'PATCH', body: JSON.stringify({ data_status: status }) }); showToast('Статус обновлён'); } catch (error) { showToast(error.message, 'error'); loadAdmin(); }
}

async function verifyGrant(id) {
  try {
    const grant = (await api('/admin/grants?limit=500')).grants.find(item => item.id === id);
    if (!grant) throw new Error('Грант не найден');
    showModal(`Проверка гранта: ${esc(grant.name)}`, `
      <form id="verify-grant-form" class="admin-form admin-form-grid">
        <label>Статус <select name="verification_status"><option value="needs_review" ${grant.verification_status === 'needs_review' ? 'selected' : ''}>Требует проверки</option><option value="verified" ${grant.verification_status === 'verified' ? 'selected' : ''}>Подтверждён</option><option value="expired" ${grant.verification_status === 'expired' ? 'selected' : ''}>Истёк</option></select></label>
        <label>Официальная страница конкурса <input name="source_url" type="url" value="${esc(grant.source_url || '')}" required /></label>
        <label>Название источника <input name="source_title" value="${esc(grant.source_title || '')}" /></label>
        <label>Дата проверки <input name="verified_at" type="date" value="${esc(grant.verified_at || '')}" /></label>
        <label>Дедлайн <input name="deadline" type="date" value="${esc(grant.deadline || '')}" /></label>
        <label>Покрытие / размер <input name="amount" value="${esc(grant.amount || '')}" required /></label>
        <label>Требования, по одному в строке <textarea name="requirements" rows="5" required>${esc((grant.requirements || []).join('\n'))}</textarea></label>
        <div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-sm">Сохранить проверку</button><button type="button" class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>
      </form>
    `);
    document.getElementById('verify-grant-form').onsubmit = async event => {
      event.preventDefault();
      const form = event.target;
      const body = Object.fromEntries(new FormData(form));
      body.requirements = body.requirements.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      try { await api(`/admin/grants/${id}/verify`, { method: 'PATCH', body: JSON.stringify(body) }); closeModal(); showToast('Проверка гранта сохранена'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); }
    };
  } catch (error) { showToast(error.message, 'error'); }
}

// ─── REVIEW ACTIONS ──────────────────────────────

async function moderate(id, approved) { try { await api(`/admin/reviews/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ approved }) }); showToast(approved ? 'Отзыв одобрен' : 'Отзыв скрыт'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); } }
async function removeReview(id) {
  showModal('Удалить отзыв?', `<p>Вы уверены?</p><div class="admin-form-actions"><button class="btn btn-danger btn-sm" id="modal-confirm">Удалить</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try { await api(`/admin/reviews/${id}`, { method: 'DELETE' }); closeModal(); showToast('Отзыв удалён'); loadAdmin(); } catch (err) { showToast(err.message, 'error'); }
  };
}

// ─── SOURCE ACTIONS ──────────────────────────────

async function checkSource(id) {
  try {
    showToast('Проверяю источник...', 'info');
    const data = await api(`/admin/sources/${id}/check`, { method: 'POST' });
    const r = data.result;
    const msg = r.status === 'reachable'
      ? (r.reviewRequired ? 'Источник доступен, но требует проверки контента' : 'Источник доступен, всё ОК')
      : 'Источник недоступен';
    showToast(msg, r.status === 'reachable' ? 'success' : 'error');
    loadAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

async function checkAllSources() {
  showToast('Проверяю все источники...', 'info');
  try {
    const data = await api('/admin/sources');
    const sources = data.sources || [];
    let ok = 0, fail = 0;
    for (const s of sources) {
      try {
        await api(`/admin/sources/${s.id}/check`, { method: 'POST' });
        ok++;
      } catch { fail++; }
    }
    showToast(`Проверено: ${ok} ОК, ${fail} ошибок`, fail > 0 ? 'error' : 'success');
    loadAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

async function viewSourceHistory(id) {
  try {
    const data = await api(`/admin/sources/${id}/history`);
    const history = data.history || [];
    showModal(`История: ${esc(id)}`, `
      <div class="admin-source-history">
        ${history.length ? history.map(h => {
          const statusBadge = h.status === 'reachable'
            ? (h.reviewRequired ? '<span class="admin-badge admin-badge-yellow">ПРОВЕРКА</span>' : '<span class="admin-badge admin-badge-green">ОК</span>')
            : '<span class="admin-badge admin-badge-red">НЕДОСТУПЕН</span>';
          const time = h.checkedAt ? new Date(h.checkedAt).toLocaleString('ru-RU') : '—';
          const missing = h.missingMarkers && h.missingMarkers.length ? `<br><small>Отсутствуют: ${esc(h.missingMarkers.join(', '))}</small>` : '';
          return `<div class="admin-source-history-item"><span>${time}</span> ${statusBadge}${missing}</div>`;
        }).join('') : '<p>Нет истории проверок</p>'}
      </div>
    `);
  } catch (error) { showToast(error.message, 'error'); }
}

// ─── GRANT ACTIONS ──────────────────────────────

async function editGrant(id) {
  try {
    const data = await api(`/grants/${id}`);
    const g = data.grant;
    showModal(`Грант #${g.id}: ${esc(g.name)}`, `
      <form id="edit-grant-form" class="admin-form admin-form-grid">
        <label>Название <input name="name" value="${esc(g.name)}" required /></label>
        <label>Тип <select name="type">
          ${['government','university','corporate','regional','foundation','international','discount'].map(v => `<option value="${v}" ${g.type===v?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <label>Организатор <input name="provider_name" value="${esc(g.provider_name || '')}" /></label>
        <label>Покрытие <select name="coverage_type">
          <option value="">Неизвестно</option>
          ${['full','partial','tuition_only','tuition_dorm','stipend_only'].map(v => `<option value="${v}" ${g.coverage_type===v?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <label>Размер покрытия <input name="coverage_amount" value="${esc(g.coverage_amount || '')}" placeholder="100%, 500000 ₸/год…" /></label>
        <label>Дедлайн <input name="deadline" type="date" value="${esc(g.deadline || '')}" /></label>
        <label>Источник URL <input name="source_url" value="${esc(g.source_url || '')}" /></label>
        <label>Источник название <input name="source_title" value="${esc(g.source_title || '')}" /></label>
        <label>URL подачи <input name="application_url" value="${esc(g.application_url || '')}" /></label>
        <label>Способ подачи <select name="application_method">
          <option value="">Неизвестно</option>
          ${['online','offline','portal','email'].map(v => `<option value="${v}" ${g.application_method===v?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <label>Учебный год <input name="academic_year" value="${esc(g.academic_year || '')}" /></label>
        <label>Статус <select name="verification_status">
          ${['needs_review','verified','expired','rejected','source_unavailable'].map(v => `<option value="${v}" ${g.verification_status===v?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <label>Заметки <textarea name="review_notes" rows="3">${esc(g.review_notes || '')}</textarea></label>
        <div class="admin-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">Сохранить</button>
          <button type="button" class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button>
        </div>
      </form>
    `);
    document.getElementById('edit-grant-form').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {};
      for (const [k, v] of fd.entries()) body[k] = v;
      try {
        await api(`/admin/grants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        closeModal(); showToast('Грант обновлён'); loadAdmin();
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (error) { showToast(error.message, 'error'); }
}

async function verifyGrant(id) {
  showModal('Подтвердить грант?', `<p>Грант будет отмечен как проверенный. Убедитесь, что заполнены: источник, дедлайн, покрытие, требования.</p><div class="admin-form-actions"><button class="btn btn-primary btn-sm" id="modal-confirm">Да, проверено</button><button class="btn btn-ghost btn-sm" data-admin-action="closeModal">Отмена</button></div>`);
  document.getElementById('modal-confirm').onclick = async () => {
    try {
      await api(`/admin/grants/${id}`, { method: 'PATCH', body: JSON.stringify({ verification_status: 'verified' }) });
      closeModal(); showToast('Грант подтверждён'); loadAdmin();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

// ─── NAVIGATION & FILTERS ──────────────────────────────

function showAdminTab(tab) {
  activeAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  document.querySelectorAll('.admin-section').forEach(section => section.classList.toggle('active', section.dataset.adminSection === tab));
  document.getElementById('admin-search').value = '';
  filterAdminRows('');
}

function filterAdminRows(value) {
  const query = value.trim().toLowerCase();
  document.querySelectorAll('.admin-section.active .admin-row, .admin-section.active tbody tr, .admin-section.active .admin-review-item').forEach(row => {
    const matchesStatus = !row.dataset.reviewStatus || reviewStatusFilter === 'all' || row.dataset.reviewStatus === reviewStatusFilter;
    row.style.display = matchesStatus && (!query || row.textContent.toLowerCase().includes(query)) ? '' : 'none';
  });
}


const adminClickActions = {
  viewUser: button => viewUser(Number(button.dataset.id)),
  editUser: button => editUser(Number(button.dataset.id)),
  toggleBanUser: button => toggleBanUser(Number(button.dataset.id), Number(button.dataset.value)),
  toggleAdminUser: button => toggleAdminUser(Number(button.dataset.id), Number(button.dataset.value)),
  deleteUser: button => deleteUser(Number(button.dataset.id)),
  resetUserPassword: button => resetUserPassword(Number(button.dataset.id)),
  createUniversity: () => createUniversity(),
  viewUniversity: button => viewUniversity(Number(button.dataset.id)),
  editUniversity: button => editUniversity(Number(button.dataset.id)),
  deleteUniversity: button => deleteUniversity(Number(button.dataset.id)),
  verifyGrant: button => verifyGrant(Number(button.dataset.id)),
  moderate: button => moderate(Number(button.dataset.id), button.dataset.value === 'true'),
  removeReview: button => removeReview(Number(button.dataset.id)),
  closeModal: () => closeModal(),
  checkSource: button => checkSource(button.dataset.id),
  checkAllSources: () => checkAllSources(),
  viewSourceHistory: button => viewSourceHistory(button.dataset.id),
  editGrant: button => editGrant(Number(button.dataset.id)),
  verifyGrant: button => verifyGrant(Number(button.dataset.id)),
};

// Delegation also covers controls rendered after refresh and inside modals.
// Only explicitly allowed actions run; no inline JavaScript or eval is needed.
document.addEventListener('click', event => {
  const button = event.target.closest('[data-admin-action]');
  if (!button || button.disabled || !Object.hasOwn(adminClickActions, button.dataset.adminAction)) return;
  event.preventDefault();
  adminClickActions[button.dataset.adminAction](button);
});
document.addEventListener('change', event => {
  const select = event.target.closest('[data-admin-change="university-status"]');
  if (select) changeUniversityStatus(Number(select.dataset.id), select.value);
});

document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => showAdminTab(button.dataset.adminTab)));
document.getElementById('admin-search').addEventListener('input', event => filterAdminRows(event.target.value));
document.getElementById('admin-refresh').addEventListener('click', loadAdmin);
daysSelect.addEventListener('change', loadAdmin);
loadAdmin();
