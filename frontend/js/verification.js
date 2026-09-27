/* Shared profile/admin document verification UI. */
const Verification = (() => {
  const words = {
    ent: ['ЕНТ', 'ҰБТ', 'ENT'],
    military: ['Военная служба', 'Әскери қызмет', 'Military service'],
    pending: ['На проверке', 'Тексерілуде', 'Pending'],
    approved: ['Подтверждено', 'Расталды', 'Approved'],
    rejected: ['Отклонено', 'Қабылданбады', 'Rejected'],
    cancelled: ['Отменено', 'Бас тартылды', 'Cancelled'],
    manual: ['Указано пользователем', 'Пайдаланушы енгізген', 'Self-reported'],
    empty: ['Не указано', 'Көрсетілмеген', 'Not provided'],
    upload: ['Загрузить документ', 'Құжат жүктеу', 'Upload document'],
    refresh: ['Обновить', 'Жаңарту', 'Refresh'],
    cancel: ['Отменить', 'Бас тарту', 'Cancel'],
    history: ['История заявок', 'Өтінімдер тарихы', 'Request history'],
    formats: ['JPG, PNG, WEBP или PDF до 5 МБ. Перетащите файл или нажмите для выбора.', 'JPG, PNG, WEBP немесе PDF, 5 МБ дейін. Файлды сүйреңіз немесе таңдаңыз.', 'JPG, PNG, WEBP or PDF up to 5 MB. Drop a file or click to choose.'],
    score: ['Балл ЕНТ (0–140)', 'ҰБТ балы (0–140)', 'ENT score (0–140)'],
    optional: ['Необязательно: администратор сверит балл с документом.', 'Міндетті емес: әкімші балды құжатпен тексереді.', 'Optional: an administrator will check the document.'],
    note: ['Комментарий / причина отказа', 'Пікір / бас тарту себебі', 'Comment / reason for rejection'],
    reject: ['Отклонить', 'Қабылдамау', 'Reject'],
    approve: ['Подтвердить', 'Растау', 'Approve'],
    submit: ['Отправить на проверку', 'Тексеруге жіберу', 'Submit for review'],
    download: ['Скачать документ', 'Құжатты жүктеп алу', 'Download document'],
    preview: ['Посмотреть документ', 'Құжатты көру', 'View document'],
    close: ['Закрыть', 'Жабу', 'Close'],
    all: ['Все', 'Барлығы', 'All'],
    none: ['Заявок нет', 'Өтінімдер жоқ', 'No requests'],
    error: ['Не удалось загрузить данные. Попробуйте ещё раз.', 'Деректер жүктелмеді. Қайта көріңіз.', 'Unable to load data. Please try again.'],
    fileError: ['Выберите JPG, PNG, WEBP или PDF до 5 МБ.', '5 МБ дейін JPG, PNG, WEBP немесе PDF таңдаңыз.', 'Choose a JPG, PNG, WEBP or PDF up to 5 MB.'],
    scoreError: ['Укажите целый балл от 0 до 140.', '0–140 аралығындағы бүтін балды енгізіңіз.', 'Enter an integer score from 0 to 140.'],
    draft: ['По призыву', 'Мерзімді қызмет', 'Conscription'],
    contract: ['По контракту', 'Келісімшарт бойынша', 'Contract'],
    alternative: ['Другой тип документа', 'Басқа құжат түрі', 'Other document type'],
    noPromise: ['Подтверждение документа не гарантирует льготы. Условия поступления уточняйте в выбранном вузе.', 'Құжатты растау жеңілдікке кепілдік бермейді. Шарттарды университеттен нақтылаңыз.', 'Document approval does not guarantee benefits. Check admission conditions with your university.'],
    missingDocument: ['В старой заявке нет документа. Нужна повторная загрузка.', 'Ескі өтінімде құжат жоқ. Қайта жүктеу қажет.', 'The old request has no document. Please upload again.'],
    title: ['Проверка документов', 'Құжаттарды тексеру', 'Document verification']
  };
  const tr = key => (words[key] || [key, key, key])[({ ru: 0, kk: 1, en: 2 })[window.currentLanguage] ?? 0];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const date = value => value ? new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toLocaleString(({ kk: 'kk-KZ', en: 'en-GB' })[window.currentLanguage] || 'ru-RU') : '';
  const request = async (path, options = {}) => {
    const response = await fetch('/api/verify' + path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || tr('error'));
    return data;
  };
  const urls = new Map();
  function release(container) { if (urls.has(container)) { URL.revokeObjectURL(urls.get(container)); urls.delete(container); } }
  function error(container, message) {
    const node = container.querySelector('[data-v-error]');
    if (node) node.textContent = message;
  }
  async function badges() {
    const container = document.getElementById('profile-status-row');
    if (!container) return;
    try {
      const rows = await Promise.all(['ent', 'military'].map(type => request('/' + type + '/status')));
      container.innerHTML = rows.map((row, i) => {
        const label = row.verified ? tr('approved') : row.request?.status === 'pending' ? tr('pending') : tr(row.request?.status || 'empty');
        return '<div class="profile-status-card"><div class="profile-status-info"><div class="profile-status-value">' +
          (i === 0 && row.verified && row.entScore != null ? esc(row.entScore) + ' · ' : '') + esc(label) + '</div><div class="profile-status-label">' + tr(i === 0 ? 'ent' : 'military') + '</div></div></div>';
      }).join('');
    } catch (e) { container.textContent = e.message; }
  }
  async function profile(type) {
    const container = document.getElementById(type === 'ent' ? 'ent-upload-content' : 'military-content');
    if (!container) return;
    release(container);
    try {
      const data = await request('/' + type + '/status');
      if (!container.isConnected) return;
      const latest = data.request;
      container.innerHTML = '<section class="verification-card"><h3>' + tr(type) + '</h3>' +
        '<p>' + (type === 'ent' ? esc(data.entScore ?? '—') + ' / 140 · ' : '') +
        tr(data.verified ? 'approved' : 'empty') + '</p>' +
        (type === 'military' ? '<p class="verification-muted">' + tr('noPromise') + '</p>' : '') +
        (latest ? '<p><strong>' + tr(latest.status) + '</strong> · ' + esc(date(latest.reviewed_at || latest.created_at)) + '</p>' +
          (latest.review_note ? '<p>' + esc(latest.review_note) + '</p>' : '') : '') +
        '<div class="verification-actions">' +
        (latest?.status === 'pending' ? '<button class="btn btn-outline" data-v-cancel>' + tr('cancel') + '</button>'
          : '<button class="btn btn-primary" data-v-upload>' + tr('upload') + '</button>') +
        '<button class="btn btn-outline" data-v-refresh>' + tr('refresh') + '</button></div>' +
        '<p class="form-error" role="alert" data-v-error></p>' +
        (data.history.length ? '<details><summary>' + tr('history') + ' (' + data.history.length + ')</summary><ul>' + data.history.map(row =>
          '<li>' + esc(date(row.created_at)) + ' · ' + tr(row.status) +
          (type === 'ent' && row.ent_score != null ? ' · ' + row.ent_score : '') +
          (row.review_note ? '<p>' + esc(row.review_note) + '</p>' : '') + '</li>').join('') + '</ul></details>' : '') + '</section>';
      container.querySelector('[data-v-upload]')?.addEventListener('click', () => upload(type));
      container.querySelector('[data-v-refresh]').addEventListener('click', () => { profile(type); badges(); });
      container.querySelector('[data-v-cancel]')?.addEventListener('click', async event => {
        event.target.disabled = true;
        try { await request('/' + type + '/' + latest.id + '/cancel', { method: 'POST', body: '{}' }); await profile(type); await badges(); }
        catch (e) { error(container, e.message); event.target.disabled = false; }
      });
    } catch (e) { container.innerHTML = '<p class="form-error" role="alert">' + esc(e.message) + '</p><button class="btn btn-outline" data-v-retry>' + tr('refresh') + '</button>'; container.querySelector('button').onclick = () => profile(type); }
  }
  function upload(type) {
    const container = document.getElementById(type === 'ent' ? 'ent-upload-content' : 'military-content');
    if (!container) return;
    release(container);
    container.innerHTML = '<form class="verification-card"><h3>' + tr(type) + '</h3><label class="verification-drop">' + tr('formats') +
      '<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><div data-v-preview></div>' +
      (type === 'ent' ? '<label>' + tr('score') + '<input class="form-input" name="score" type="number" min="0" max="140" step="1"></label><p class="verification-muted">' + tr('optional') + '</p>'
        : '<label>' + tr('military') + '<select name="service" class="form-input">' + ['draft','contract','alternative'].map(key => '<option value="' + key + '">' + tr(key) + '</option>').join('') + '</select></label>') +
      '<div class="verification-actions"><button class="btn btn-primary" type="submit">' + tr('submit') + '</button><button class="btn btn-outline" type="button" data-v-back>' + tr('cancel') + '</button></div><p class="form-error" role="alert" data-v-error></p></form>';
    const form = container.querySelector('form'), input = form.querySelector('input[type=file]');
    const validFile = file => file && file.size > 0 && file.size <= 5 * 1024 * 1024 && ['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type);
    function preview() {
      release(container);
      const file = input.files[0], target = container.querySelector('[data-v-preview]');
      target.replaceChildren();
      error(container, '');
      if (!validFile(file)) { error(container, tr('fileError')); return; }
      const label = document.createElement('p'); label.textContent = file.name; target.append(label);
      if (file.type.startsWith('image/')) { const img = document.createElement('img'); img.alt = file.name; img.src = URL.createObjectURL(file); urls.set(container, img.src); target.append(img); }
    }
    input.onchange = preview;
    const drop = container.querySelector('.verification-drop');
    drop.ondragover = e => e.preventDefault();
    drop.ondrop = e => { e.preventDefault(); input.files = e.dataTransfer.files; preview(); };
    form.querySelector('[data-v-back]').onclick = () => profile(type);
    form.onsubmit = async e => {
      e.preventDefault();
      const file = input.files[0];
      if (!validFile(file)) return error(container, tr('fileError'));
      const value = form.elements.score?.value;
      const score = value === '' || value == null ? null : Number(value);
      if (score != null && (!Number.isInteger(score) || score < 0 || score > 140)) return error(container, tr('scoreError'));
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        const documentUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(tr('fileError'))); reader.readAsDataURL(file); });
        await request('/' + type, { method: 'POST', body: JSON.stringify({ documentUrl, entScore: score, serviceType: form.elements.service?.value }) });
        await profile(type); await badges();
      } catch (err) { error(container, err.message); button.disabled = false; }
    };
  }
  async function previewDocument(type, id, target) {
    try {
      const response = await fetch('/api/verify/' + type + '/' + id + '/document', { credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).error || tr('error'));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const dialog = document.createElement('dialog');
      dialog.className = 'verification-dialog';
      const link = document.createElement('a');
      link.href = url; link.download = type + '-' + id + (blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : blob.type.includes('webp') ? '.webp' : '.jpg');
      link.textContent = tr('download'); link.className = 'btn btn-primary';
      const close = document.createElement('button'); close.textContent = tr('close'); close.className = 'btn btn-outline'; close.onclick = () => dialog.close();
      if (blob.type.startsWith('image/')) { const img = document.createElement('img'); img.src = url; img.alt = tr(type); dialog.append(img); }
      dialog.append(link, close);
      dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); }, { once: true });
      document.body.append(dialog); dialog.showModal();
    } catch (e) { error(target, e.message); }
  }
  async function admin(containerId = 'verification-admin', status = 'pending') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p>' + tr('title') + '…</p>';
    try {
      const results = await Promise.all(['ent','military'].map(async type => ({ type, ...(await request('/' + type + '/pending?status=' + encodeURIComponent(status))) })));
      if (!container.isConnected) return;
      container.innerHTML = '<h2>' + tr('title') + '</h2><div class="verification-actions"><label>' + tr('title') + '<select class="form-input" data-v-filter>' +
        ['pending','approved','rejected','cancelled','all'].map(key => '<option value="' + key + '"' + (status === key ? ' selected' : '') + '>' + tr(key) + '</option>').join('') +
        '</select></label><button class="btn btn-outline" data-v-refresh>' + tr('refresh') + '</button></div><p class="form-error" data-v-error role="alert"></p><div data-v-list></div>';
      const list = container.querySelector('[data-v-list]');
      for (const result of results) for (const row of result.requests) {
        const card = document.createElement('article'); card.className = 'verification-card';
        card.innerHTML = '<h3>' + tr(result.type) + ' · ' + esc(row.full_name || row.username) + '</h3><p>' + tr(row.status) + ' · ' + esc(date(row.created_at)) + '</p>' +
          (row.review_note ? '<p>' + esc(row.review_note) + '</p>' : '') +
          (result.type === 'military' ? '<p>' + tr(row.service_type) + '</p>' : '<p>' + tr('score') + ': ' + esc(row.ent_score ?? '—') + '</p>') +
          (row.has_document ? '<button class="btn btn-outline" data-v-document>' + tr('preview') + '</button>' : '<p>' + tr('missingDocument') + '</p>') +
          (row.status === 'pending' ? '<form>' + (result.type === 'ent' ? '<label>' + tr('score') + '<input class="form-input" name="score" type="number" step="1" min="0" max="140" value="' + esc(row.ent_score ?? '') + '"></label>' : '') +
            '<label>' + tr('note') + '<textarea class="form-input" name="note" maxlength="1000"></textarea></label><div class="verification-actions"><button class="btn btn-primary" name="decision" value="approve">' + tr('approve') + '</button><button class="btn btn-outline" name="decision" value="reject">' + tr('reject') + '</button></div></form>' : '') +
          '<p class="form-error" role="alert" data-v-error></p>';
        card.querySelector('[data-v-document]')?.addEventListener('click', () => previewDocument(result.type, row.id, card));
        const form = card.querySelector('form');
        if (form) form.onsubmit = async e => {
          e.preventDefault();
          const action = e.submitter?.value;
          if (!action) return;
          const note = form.elements.note.value.trim();
          if (action === 'reject' && !note) return error(card, tr('note'));
          const value = form.elements.score?.value;
          const score = value === '' || value == null ? null : Number(value);
          if (result.type === 'ent' && action === 'approve' && (score == null || !Number.isInteger(score) || score < 0 || score > 140)) return error(card, tr('scoreError'));
          const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
          try { await request('/' + result.type + '/' + row.id + '/review', { method: 'POST', body: JSON.stringify({ action, note, entScore: score }) }); await admin(containerId, status); }
          catch (err) { error(card, err.message); buttons.forEach(b => b.disabled = false); }
        };
        list.append(card);
      }
      if (!list.children.length) list.textContent = tr('none');
      container.querySelector('[data-v-filter]').onchange = e => admin(containerId, e.target.value);
      container.querySelector('[data-v-refresh]').onclick = () => admin(containerId, status);
    } catch (e) { container.innerHTML = '<p class="form-error">' + esc(e.message) + '</p><button class="btn btn-outline">' + tr('refresh') + '</button>'; container.querySelector('button').onclick = () => admin(containerId, status); }
  }
  return { profile, upload, badges, admin };
})();
