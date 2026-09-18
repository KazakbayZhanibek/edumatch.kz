(function(root){
'use strict';

const API='/api';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('ru-RU')+' ₸':'—';
const safeLink=v=>{try{const u=new URL(v);return['https:','http:'].includes(u.protocol)&&!u.username?!u.password?u.href:'':'';}catch{return'';}};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const deadlineStatus=(dl,d=today())=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(dl||''))return'unknown';return dl<d?'expired':'future';};

const typeLabels={government:'Государственный',university:'Вузовский',corporate:'Корпоративный',regional:'Региональный',foundation:'Фонд',international:'Международный',discount:'Скидка'};
const statusLabels={needs_review:'Требует проверки',verified:'Проверено',expired:'Истёк',rejected:'Отклонён',source_unavailable:'Источник недоступен'};
const coverageLabels={full:'Полное покрытие',partial:'Частичное',tuition_only:'Только обучение',tuition_dorm:'Обучение + общежитие',stipend_only:'Только стипендия',unknown:'Неизвестно'};

let activeTab='forMe';
let grantsData=[], savedGrants=[];
let matchResults=null;
let grantFilters={};
let grantLimit=12;
let currentLang='ru';

function t(key){return copy[currentLang]?.[key]||copy.ru[key]||key;}
const copy={ru:{title:'Возможности поступления',sub:'Подберите университет, программу и варианты финансирования по своим результатам',forMe:'Для меня',universities:'Университеты',grantsTab:'Гранты и скидки',myPlan:'Мой план',ent:'Балл ЕНТ',subjects:'Предметы',group:'Направление (группа)',city:'Город',budget:'Бюджет на год, ₸',funding:'Финансирование',language:'Язык',dorm:'Общежитие',category:'Льготная категория',find:'Подобрать',loading:'Загружаем…',empty:'Нет результатов',error:'Ошибка загрузки',matched:'Подходит по известным данным',needsClarification:'Нужно уточнить',notSuitable:'Сейчас не подходит',save:'Сохранить',saved:'Сохранён',unsave:'Убрать',source:'Источник',deadline:'Дедлайн',coverage:'Покрытие',requirements:'Требования',documents:'Документы',provider:'Организатор',disclaimer:'Информация справочная. Условия, сроки и право на участие необходимо проверить на официальном источнике организатора.',reasons:'Причины',warnings:'Уточнения',showMore:'Показать ещё',reset:'Сбросить',filterType:'Тип',filterCoverage:'Покрытие',filterStatus:'Статус',all:'Все',verify:'Проверено',needsReview:'Требует проверки',apply:'Подать заявку',compare:'Сравнить',addToPlan:'В план',noDeadline:'Дедлайн не указан',noSource:'Источник не указан',noRequirements:'Требования не указаны',noDocuments:'Документы не указаны',coverageUnknown:'Размер покрытия неизвестен',deadlinePassed:'Дедлайн истёк',planEmpty:'Сохранённых грантов пока нет. Сохраните подходящие варианты из каталога.',step:'Шаг',steps:'Следующие шаги',checkDocs:'Подготовить документы',checkDeadline:'Проверить дедлайн',checkSource:'Проверить источник',submitApplication:'Подать заявку'},kk:{},en:{title:'Admission Opportunities',sub:'Match universities, programs and funding options by your profile',forMe:'For Me',universities:'Universities',grantsTab:'Grants & Discounts',myPlan:'My Plan',ent:'UNT Score',subjects:'Subjects',group:'Programme group',city:'City',budget:'Annual budget, ₸',funding:'Funding',language:'Language',dorm:'Dormitory',category:'Eligibility category',find:'Search',loading:'Loading…',empty:'No results',error:'Load error',matched:'Fits known data',needsClarification:'Needs clarification',notSuitable:'Does not fit now',save:'Save',saved:'Saved',unsave:'Remove',source:'Source',deadline:'Deadline',coverage:'Coverage',requirements:'Requirements',documents:'Documents',provider:'Provider',disclaimer:'Information is reference only. Verify conditions, deadlines and eligibility on the official source.',reasons:'Reasons',warnings:'Clarifications',showMore:'Show more',reset:'Reset',filterType:'Type',filterCoverage:'Coverage',filterStatus:'Status',all:'All',verify:'Verified',needsReview:'Needs review',apply:'Apply',compare:'Compare',addToPlan:'Add to plan',noDeadline:'No deadline',noSource:'No source',noRequirements:'No requirements listed',noDocuments:'No documents listed',coverageUnknown:'Coverage amount unknown',deadlinePassed:'Deadline passed',planEmpty:'No saved grants yet. Save suitable options from the catalogue.',step:'Step',steps:'Next steps',checkDocs:'Prepare documents',checkDeadline:'Verify deadline',checkSource:'Verify source',submitApplication:'Submit application'}};

function api(path,opts={}){return fetch(`${API}${path}`,{credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d;});}

// ─── RENDER FUNCTIONS ──────────────────────────────

function renderForMe(host){
  host.innerHTML=`<div class="grant-section-intro"><p>${esc(t('disclaimer'))}</p></div>
  <form id="grant-match-form" class="grant-match-form">
    <label>${esc(t('ent'))}<input name="ent" type="number" min="0" max="140" required></label>
    <label>${esc(t('group'))}<select name="group"><option value="">Любое</option><option value="B057">B057 IT/Software</option><option value="B058">B058 Cybersecurity</option><option value="B059">B059 Техн. науки</option><option value="B042">B042 Творческие</option></select></label>
    <label>${esc(t('city'))}<input name="city" placeholder="Алматы, Астана…"></label>
    <label>${esc(t('budget'))}<input name="budget" type="number" min="0" step="100000" value="2000000"></label>
    <label>${esc(t('funding'))}<select name="funding"><option value="any">${esc(t('all'))}</option><option value="grant">Только грант</option><option value="paid">Платное</option></select></label>
    <label>${esc(t('language'))}<select name="language"><option value="">${esc(t('all'))}</option><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></label>
    <label>${esc(t('dorm'))}<input name="needDorm" type="checkbox"></label>
    <label>${esc(t('category'))}<select name="category"><option value="none">Нет</option><option value="orphan">Сирота</option><option value="disabled">Инвалидность</option><option value="large_family">Многодетная семья</option><option value="rural">Сельская местность</option></select></label>
    <button class="btn btn-primary" type="submit">${esc(t('find'))}</button>
  </form>
  <div id="grant-match-results"></div>`;

  document.getElementById('grant-match-form').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const body={ent:Number(fd.get('ent')),group:fd.get('group')||undefined,city:fd.get('city')||undefined,budget:Number(fd.get('budget')||0),funding:fd.get('funding'),language:fd.get('language')||undefined,needDorm:fd.get('needDorm')==='on',category:fd.get('category')||undefined};
    const box=document.getElementById('grant-match-results');
    box.innerHTML=`<p>${esc(t('loading'))}</p>`;
    try{
      const data=await api('/grants/match',{method:'POST',body:JSON.stringify(body)});
      matchResults=data.results;
      renderMatchResults(box,data);
    }catch(err){box.innerHTML=`<p class="grant-error">${esc(err.message)}</p>`;}
  };
}

function renderMatchResults(box,data){
  const groups=[
    {key:'matched',label:t('matched'),icon:'✓',cls:'grant-match-good'},
    {key:'needsClarification',label:t('needsClarification'),icon:'?',cls:'grant-match-warn'},
    {key:'notSuitable',label:t('notSuitable'),icon:'✕',cls:'grant-match-bad'},
  ];
  let html=`<aside class="grant-disclaimer">${esc(data.disclaimer||t('disclaimer'))}</aside>`;
  for(const g of groups){
    const items=data.results[g.key]||[];
    html+=`<section class="grant-match-group"><h2>${g.icon} ${esc(g.label)} <span class="grant-match-count">${items.length}</span></h2>`;
    if(!items.length){html+=`<p class="grant-empty">${esc(t('empty'))}</p>`;}
    else{
      html+=`<div class="grant-match-list">${items.slice(0,10).map(item=>`<article class="grant-match-card ${g.cls}">
        <div class="grant-card-header"><span class="grant-type-badge">${esc(typeLabels[item.type]||item.type)}</span><span class="grant-status-badge grant-status-${item.verification_status}">${esc(statusLabels[item.verification_status]||'')}</span></div>
        <h3>${esc(item.name)}</h3>
        <p class="grant-provider">${esc(item.provider_name||item.uni_name||item.uni_short_name||'')}</p>
        <div class="grant-card-meta">
          ${item.coverage_type?`<span class="grant-meta-item">${esc(coverageLabels[item.coverage_type]||item.coverage_type)}</span>`:''}
          ${item.deadline?`<span class="grant-meta-item">${esc(t('deadline'))}: ${esc(item.deadline)}</span>`:`<span class="grant-meta-item grant-meta-warn">${esc(t('noDeadline'))}</span>`}
          ${item.city_name?`<span class="grant-meta-item">${esc(item.city_name)}</span>`:''}
        </div>
        ${item.reasons?.length?`<ul class="grant-reasons">${item.reasons.map(r=>`<li class="grant-reason-good">${esc(r)}</li>`).join('')}</ul>`:''}
        ${item.warnings?.length?`<ul class="grant-warnings">${item.warnings.map(w=>`<li class="grant-reason-warn">${esc(w)}</li>`).join('')}</ul>`:''}
        <div class="grant-card-actions">
          ${safeLink(item.source_url||item.link)?`<a class="btn btn-ghost btn-sm" href="${esc(safeLink(item.source_url||item.link))}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>`:''}
          <button class="btn btn-ghost btn-sm" data-grant-save="${item.id}" data-saved="${savedGrants.includes(item.id)?1:0}">${savedGrants.includes(item.id)?esc(t('unsave')):esc(t('save'))}</button>
        </div>
      </article>`).join('')}</div>`;
    }
    html+=`</section>`;
  }
  box.innerHTML=html;
}

function renderUniversities(host){
  api('/grants?limit=100&sort=verified_first').then(data=>{
    const uniMap=new Map();
    for(const g of (data.grants||[])){
      const key=g.university_id||'none';
      if(!uniMap.has(key))uniMap.set(key,{name:g.uni_name||g.uni_short_name||'Без вуза',short:g.uni_short_name,city:g.city_name,grants:[]});
      uniMap.get(key).grants.push(g);
    }
    const unis=[...uniMap.values()].sort((a,b)=>b.grants.length-a.grants.length);
    host.innerHTML=`<div class="grant-section-intro"><p>${esc(t('disclaimer'))}</p></div>
    <div class="uni-list">${unis.map(uni=>`<article class="uni-grant-card">
      <h3>${esc(uni.name)}</h3>
      <p class="uni-meta">${esc(uni.city||'')} · ${uni.grants.length} грантов</p>
      <div class="uni-grants-preview">${uni.grants.slice(0,3).map(g=>`<span class="grant-mini-badge grant-status-${g.verification_status}">${esc(g.name)}</span>`).join('')}${uni.grants.length>3?`<span class="grant-mini-more">+${uni.grants.length-3}</span>`:''}</div>
    </article>`).join('')}</div>`;
  }).catch(err=>{host.innerHTML=`<p class="grant-error">${esc(err.message)}</p>`;});
}

function renderGrantsCatalog(host){
  let html=`<div class="grant-section-intro"><p>${esc(t('disclaimer'))}</p></div>
  <form id="grant-filters" class="grant-filters">
    <input name="q" type="search" placeholder="Поиск по названию…">
    <select name="type"><option value="">${esc(t('all'))}</option>${Object.entries(typeLabels).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select>
    <select name="coverage_type"><option value="">${esc(t('all'))}</option>${Object.entries(coverageLabels).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select>
    <select name="status"><option value="">${esc(t('all'))}</option><option value="verified">${esc(t('verify'))}</option><option value="needs_review">${esc(t('needsReview'))}</option></select>
    <select name="sort"><option value="verified_first">По приоритету</option><option value="deadline">По дедлайну</option><option value="name">По названию</option></select>
    <button type="submit" class="btn btn-ghost btn-sm">${esc(t('reset'))}</button>
  </form>
  <div class="grant-results-info" id="grant-results-info"></div>
  <div id="grant-cards" class="grant-cards-grid"></div>
  <button id="grant-more" class="btn btn-ghost" hidden>${esc(t('showMore'))}</button>`;
  loadGrants();
  document.getElementById('grant-filters').onsubmit=e=>{e.preventDefault();grantFilters=Object.fromEntries(new FormData(e.target));grantLimit=12;loadGrants();};
  document.getElementById('grant-filters').oninput=()=>{grantFilters=Object.fromEntries(new FormData(document.getElementById('grant-filters')));grantLimit=12;loadGrants();};
}

async function loadGrants(){
  try{
    const params=new URLSearchParams({limit:String(grantLimit),sort:grantFilters.sort||'verified_first'});
    if(grantFilters.q)params.set('q',grantFilters.q);
    if(grantFilters.type)params.set('type',grantFilters.type);
    if(grantFilters.coverage_type)params.set('coverage_type',grantFilters.coverage_type);
    if(grantFilters.status)params.set('status',grantFilters.status);
    const data=await api('/grants?'+params);
    grantsData=data.grants||[];
    const info=document.getElementById('grant-results-info');
    if(info)info.textContent=`${t('showMore')}: ${grantsData.length} / ${data.total}`;
    renderGrantCards();
  }catch(err){
    const box=document.getElementById('grant-cards');
    if(box)box.innerHTML=`<p class="grant-error">${esc(err.message)}</p>`;
  }
}

function renderGrantCards(){
  const box=document.getElementById('grant-cards');
  if(!box)return;
  box.innerHTML=grantsData.map(g=>{
    const status=deadlineStatus(g.deadline);
    const link=safeLink(g.source_url||g.link);
    const isSaved=savedGrants.includes(g.id);
    const cov=g.coverage_type?coverageLabels[g.coverage_type]||g.coverage_type:'—';
    return`<article class="grant-catalog-card">
      <div class="grant-card-header">
        <span class="grant-type-badge">${esc(typeLabels[g.type]||g.type)}</span>
        <span class="grant-status-badge grant-status-${g.verification_status}">${esc(statusLabels[g.verification_status]||'')}</span>
      </div>
      <h3>${esc(g.name)}</h3>
      <p class="grant-provider">${esc([g.provider_name,g.uni_short_name,g.city_name].filter(Boolean).join(' · '))}</p>
      <div class="grant-card-meta">
        <span class="grant-meta-item">${esc(cov)}</span>
        ${g.deadline?`<span class="grant-meta-item">${esc(g.deadline)}</span>`:`<span class="grant-meta-item grant-meta-warn">${esc(t('noDeadline'))}</span>`}
        ${g.academic_year?`<span class="grant-meta-item">${esc(g.academic_year)}</span>`:''}
      </div>
      ${g.description?`<p class="grant-desc">${esc(g.description).slice(0,200)}${g.description.length>200?'…':''}</p>`:''}
      <div class="grant-card-actions">
        ${link?`<a class="btn btn-ghost btn-sm" href="${esc(link)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>`:`<span class="grant-no-source">${esc(t('noSource'))}</span>`}
        <button class="btn btn-ghost btn-sm" data-grant-save="${g.id}" data-saved="${isSaved?1:0}">${isSaved?esc(t('unsave')):esc(t('save'))}</button>
      </div>
    </article>`;
  }).join('')||`<p class="grant-empty">${esc(t('empty'))}</p>`;
  const moreBtn=document.getElementById('grant-more');
  if(moreBtn)moreBtn.hidden=grantsData.length>=grantsData.length;
}

function renderMyPlan(host){
  host.innerHTML=`<div class="grant-section-intro"><p>${esc(t('disclaimer'))}</p></div>
  <div id="my-plan-content"><p>${esc(t('loading'))}</p></div>`;
  api('/grants/saved/list').then(data=>{
    savedGrants=(data.grants||[]).map(g=>g.id);
    const box=document.getElementById('my-plan-content');
    if(!data.grants?.length){box.innerHTML=`<p class="grant-empty">${esc(t('planEmpty'))}</p>`;return;}
    box.innerHTML=data.grants.map(g=>`<article class="plan-grant-card">
      <div class="grant-card-header"><span class="grant-type-badge">${esc(typeLabels[g.type]||g.type)}</span><span class="grant-status-badge grant-status-${g.verification_status}">${esc(statusLabels[g.verification_status]||'')}</span></div>
      <h3>${esc(g.name)}</h3>
      <p class="grant-provider">${esc([g.provider_name,g.uni_short_name,g.city_name].filter(Boolean).join(' · '))}</p>
      <div class="plan-steps">
        <div class="plan-step">${g.documents?.length?`✓ ${esc(t('checkDocs'))}`:`? ${esc(t('checkDocs'))}`}</div>
        <div class="plan-step">${g.deadline?`✓ ${esc(t('checkDeadline'))}: ${esc(g.deadline)}`:`? ${esc(t('checkDeadline'))}`}</div>
        <div class="plan-step">${g.source_url?`✓ ${esc(t('checkSource'))}`:`? ${esc(t('checkSource'))}`}</div>
        <div class="plan-step">→ ${esc(t('submitApplication'))}</div>
      </div>
      <div class="grant-card-actions">
        ${safeLink(g.source_url||g.link)?`<a class="btn btn-ghost btn-sm" href="${esc(safeLink(g.source_url||g.link))}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>`:''}
        <button class="btn btn-ghost btn-sm" data-grant-save="${g.id}" data-saved="1">${esc(t('unsave'))}</button>
      </div>
    </article>`).join('');
  }).catch(err=>{
    document.getElementById('my-plan-content').innerHTML=`<p class="grant-error">${esc(err.message)}</p>`;
  });
}

// ─── TAB SWITCHING ──────────────────────────────

function switchTab(tab,host){
  activeTab=tab;
  host.querySelectorAll('.grant-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const content=document.getElementById('grant-tab-content');
  content.innerHTML=`<p>${esc(t('loading'))}</p>`;
  if(tab==='forMe')renderForMe(content);
  else if(tab==='universities')renderUniversities(content);
  else if(tab==='grants')renderGrantsCatalog(content);
  else if(tab==='myPlan')renderMyPlan(content);
}

// ─── SAVE/UNSAVE ──────────────────────────────

async function toggleSaveGrant(grantId,btn){
  const isSaved=savedGrants.includes(grantId);
  try{
    const data=await api(`/grants/${grantId}/save`,{method:'POST'});
    if(data.saved){savedGrants.push(grantId);}
    else{savedGrants=savedGrants.filter(id=>id!==grantId);}
    if(btn){btn.textContent=isSaved?t('save'):t('unsave');btn.dataset.saved=isSaved?'0':'1';}
  }catch(err){console.error(err);}
}

// ─── INIT ──────────────────────────────

function load(host){
  if(!host)return;
  currentLang=root.currentLanguage||'ru';
  // Load saved grants from server
  api('/grants/saved/list').then(data=>{
    savedGrants=(data.grants||[]).map(g=>g.id);
  }).catch(()=>{});

  host.innerHTML=`<div class="grant-page-header">
    <h1 class="page-title">${esc(t('title'))}</h1>
    <p class="page-sub">${esc(t('sub'))}</p>
  </div>
  <nav class="grant-tabs" role="tablist">
    <button class="grant-tab-btn active" data-tab="forMe">${esc(t('forMe'))}</button>
    <button class="grant-tab-btn" data-tab="universities">${esc(t('universities'))}</button>
    <button class="grant-tab-btn" data-tab="grants">${esc(t('grantsTab'))}</button>
    <button class="grant-tab-btn" data-tab="myPlan">${esc(t('myPlan'))}</button>
  </nav>
  <div id="grant-tab-content"></div>`;

  host.querySelectorAll('.grant-tab-btn').forEach(btn=>{
    btn.onclick=()=>switchTab(btn.dataset.tab,host);
  });

  host.addEventListener('click',e=>{
    const saveBtn=e.target.closest('[data-grant-save]');
    if(saveBtn)toggleSaveGrant(Number(saveBtn.dataset.grantSave),saveBtn);
  });

  switchTab('forMe',host);
}

if(typeof module==='object'&&module.exports)module.exports={safeLink,deadlineStatus,esc,today};
else root.GrantsPage={load};
})(typeof window==='undefined'?globalThis:window);
