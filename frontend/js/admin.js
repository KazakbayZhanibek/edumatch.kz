const API = '/api';
const root = document.getElementById('admin-root');
const daysSelect = document.getElementById('admin-days');

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

const statusLabels = { collecting: 'Сбор документов', submitted: 'Подано', waiting: 'Ожидание', accepted: 'Зачислены', enrolled: 'Оплачивают', rejected: 'Отказ' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const date = value => value ? new Date(value).toLocaleDateString('ru-RU') : '—';

async function loadAdmin() {
  root.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  try {
    const days = Number(daysSelect.value);
    const [data, reviewsData, applicationsData, usersData, universitiesData, auditData] = await Promise.all([
      api(`/admin/overview?days=${days}`), api('/admin/reviews?limit=100'), api('/admin/applications?limit=100'), api('/admin/users?limit=100'), api('/admin/universities?limit=300'), api('/admin/audit?limit=100')
    ]);
    const o = data.overview;
    const reviews = reviewsData.reviews || [];
    const applications = applicationsData.applications || [];
    const users = usersData.users || [];
    const universities = universitiesData.universities || [];
    const audit = auditData.audit || [];
    root.innerHTML = `
      <section class="admin-section active" data-admin-section="overview"><section class="admin-metrics">
        ${[['Пользователи', o.users, `+${o.periodUsers} за период`], ['Вузы', o.universities, 'В каталоге'], ['Заявки', o.applications, `+${o.periodApplications} за период`], ['Диалоги с ИИ', o.chatMessages, `+${o.periodChats} за период`]].map(item => `<article class="admin-metric"><strong>${item[1] || 0}</strong><span>${item[0]}</span><small>${item[2]}</small></article>`).join('')}
      </section>
      <section class="admin-grid">
        <article class="admin-block"><h2>Заявки по статусам</h2>${(data.applicationStatuses || []).map(item => `<div class="admin-row"><span>${esc(statusLabels[item.status] || item.status)}</span><strong>${item.count}</strong></div>`).join('') || '<p>Нет данных</p>'}</article>
        <article class="admin-block"><h2>Темы ИИ</h2>${(data.intents || []).map(item => `<div class="admin-row"><span>${esc(item.intent)}</span><strong>${item.count}</strong></div>`).join('') || '<p>Нет данных</p>'}</article>
      </section></section>
      <section class="admin-section" data-admin-section="applications"><section class="admin-block"><h2>Последние заявки (${applications.length})</h2><div class="admin-table-wrap"><table><thead><tr><th>Пользователь</th><th>Вуз</th><th>Статус</th><th>Год</th><th>Создана</th></tr></thead><tbody>${applications.slice(0, 20).map(item => `<tr><td>${esc(item.username || item.email)}</td><td>${esc(item.short_name || item.university_name)}</td><td>${esc(statusLabels[item.status] || item.status)}</td><td>${esc(item.academic_year)}</td><td>${date(item.created_at)}</td></tr>`).join('') || '<tr><td colspan="5">Нет заявок</td></tr>'}</tbody></table></div></section></section>
      <section class="admin-section" data-admin-section="users"><section class="admin-block"><h2>Пользователи (${users.length})</h2><div class="admin-table-wrap"><table><thead><tr><th>Логин</th><th>Email</th><th>Заявки</th><th>Чаты</th><th>Регистрация</th></tr></thead><tbody>${users.slice(0, 20).map(item => `<tr><td>${esc(item.username)}${item.is_admin ? ' · ADMIN' : ''}</td><td>${esc(item.email)}</td><td>${item.applications}</td><td>${item.chats}</td><td>${date(item.created_at)}</td></tr>`).join('')}</tbody></table></div></section></section>
      <section class="admin-section" data-admin-section="universities"><section class="admin-block"><h2>Каталог вузов (${universities.length})</h2><div class="admin-table-wrap"><table><thead><tr><th>Вуз</th><th>Город</th><th>Статус</th><th>Цена</th><th>Обновлён</th><th></th></tr></thead><tbody>${universities.map(item => `<tr data-university-id="${item.id}"><td>${esc(item.short_name || item.name)}</td><td>${esc(item.city || '—')}</td><td><select class="admin-status-select" onchange="changeUniversityStatus(${item.id}, this.value)"><option value="active" ${item.data_status === 'active' ? 'selected' : ''}>Активен</option><option value="pending" ${item.data_status === 'pending' ? 'selected' : ''}>На проверке</option><option value="inactive" ${item.data_status === 'inactive' ? 'selected' : ''}>Скрыт</option></select></td><td>${item.price_from ? `${item.price_from.toLocaleString('ru-RU')} ₸` : '—'}</td><td>${date(item.last_updated_at)}</td><td>${item.website ? `<a href="${esc(item.website)}" target="_blank" rel="noopener">Сайт</a>` : '—'}</td></tr>`).join('')}</tbody></table></div></section></section>
      <section class="admin-section" data-admin-section="audit"><section class="admin-block"><h2>Журнал действий</h2><div class="admin-table-wrap"><table><thead><tr><th>Дата</th><th>Таблица</th><th>ID</th><th>Действие</th><th>Администратор</th></tr></thead><tbody>${audit.map(item => `<tr><td>${date(item.created_at)}</td><td>${esc(item.table_name)}</td><td>${item.record_id || '—'}</td><td>${esc(item.action)}</td><td>${esc(item.email || 'system')}</td></tr>`).join('') || '<tr><td colspan="5">Действий пока нет</td></tr>'}</tbody></table></div></section></section>
      <section class="admin-section" data-admin-section="reviews"><section class="admin-block"><h2>Модерация отзывов <small>${o.pendingReviews} требуют проверки</small></h2><div class="admin-review-list">${reviews.map(review => `<article class="admin-review-item"><div class="admin-review-top"><strong>${esc(review.short_name || review.university_name)}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div><div class="admin-review-meta">${esc(review.user_name)} · ${date(review.created_at)}</div><p>${esc(review.comment || review.pros || review.cons || 'Без текста')}</p><div class="admin-review-actions"><button class="btn btn-primary btn-sm" onclick="moderate(${review.id}, true)">Одобрить</button><button class="btn btn-ghost btn-sm" onclick="moderate(${review.id}, false)">Скрыть</button><button class="btn btn-ghost btn-sm admin-danger-btn" onclick="removeReview(${review.id})">Удалить</button></div></article>`).join('') || '<p>Отзывов пока нет</p>'}</div></section></section>`;
  } catch (error) { root.innerHTML = `<div class="admin-error">${esc(error.message)}<br><a href="/">Вернуться на сайт</a></div>`; }
}

async function moderate(id, approved) { try { await api(`/admin/reviews/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ approved }) }); loadAdmin(); } catch (error) { alert(error.message); } }
async function removeReview(id) { if (!confirm('Удалить отзыв?')) return; try { await api(`/admin/reviews/${id}`, { method: 'DELETE' }); loadAdmin(); } catch (error) { alert(error.message); } }
async function changeUniversityStatus(id, status) { try { await api(`/admin/universities/${id}`, { method: 'PATCH', body: JSON.stringify({ data_status: status }) }); } catch (error) { alert(error.message); loadAdmin(); } }
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  document.querySelectorAll('.admin-section').forEach(section => section.classList.toggle('active', section.dataset.adminSection === tab));
  document.getElementById('admin-search').value = '';
}
function filterAdminRows(value) {
  const query = value.trim().toLowerCase();
  document.querySelectorAll('.admin-section.active .admin-row, .admin-section.active tbody tr, .admin-section.active .admin-review-item').forEach(row => {
    row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
}
document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => showAdminTab(button.dataset.adminTab)));
document.getElementById('admin-search').addEventListener('input', event => filterAdminRows(event.target.value));
document.getElementById('admin-refresh').addEventListener('click', loadAdmin);
daysSelect.addEventListener('change', loadAdmin);
loadAdmin();
