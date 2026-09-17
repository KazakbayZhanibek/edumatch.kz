(function () {
  'use strict';
  const lang=window.currentLanguage==='kk'?'kk':'ru', t=(ru,kk)=>lang==='kk'?kk:ru;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>v==null?t('Не подтверждено','Расталмаған'):Number(v).toLocaleString(lang==='kk'?'kk-KZ':'ru-RU')+' ₸';
  const host=document.getElementById('planner-assistant');if(!host)return;
  let revision=0,savedRevision=0,useAgent=false;
  const criterionLabels={subjects:['профильные предметы','бейіндік пәндер'],ent:['общий ЕНТ','жалпы ҰБТ'],entSections:['разделы ЕНТ','ҰБТ бөлімдері'],extraExam:['дополнительный экзамен','қосымша емтихан'],budget:['стоимость','оқу құны'],deadline:['срок подачи','өтініш мерзімі'],language:['язык группы','топтың тілі'],dorm:['место в общежитии','жатақхана орны'],funding:['грант','грант']};
  function assessment(p){
    if(p.verification==='blocked')return t('Не соответствует проверенным ограничениям.','Тексерілген шектеулерге сәйкес емес.');
    const labels=(p.unverifiedCriteria||[]).map(key=>t(...(criterionLabels[key]||[key,key])));
    return t('Требует проверки','Тексеруді қажет етеді')+(labels.length?': '+esc(labels.join(', ')):'.');
  }
  function costMarkup(p){
    const cost=p.cost;
    if(!cost)return '<p>'+t('Сохранённая цена — перепроверьте год и условия.','Сақталған баға — жыл мен шарттарды қайта тексеріңіз.')+'</p>';
    const current='<p>'+t('Первый курс','Бірінші курс')+' · '+esc(cost.requestedYear)+': '+money(cost.amount)+'</p>';
    const reference=!cost.verifiedForRequestedYear&&cost.referenceAmount!=null?'<p class="planner-reference">'+t('Справочно за ','Анықтама үшін ')+esc(cost.referenceYear)+': '+money(cost.referenceAmount)+'. '+t('Не использовать как цену выбранного набора.','Таңдалған қабылдау бағасы ретінде қолданбаңыз.')+'</p>':'';
    return current+reference;
  }
  async function api(path,body,method) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==='/agent'?40000:18000);
    try {
      const response=await fetch('/api/planner'+path,{method:method||(body?'POST':'GET'),credentials:'include',headers:{'Content-Type':'application/json'},signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
      const data=await response.json();
      if(!response.ok)throw Error(response.status===401?t('Войдите в аккаунт для этого действия.','Бұл әрекет үшін аккаунтқа кіріңіз.'):data.error||t('Запрос не выполнен. Повторите попытку.','Сұрау орындалмады. Қайталап көріңіз.'));
      return data;
    }catch(error){if(error.name==='AbortError')throw Error(t('Сервис не ответил вовремя. Повторите попытку.','Қызмет уақытында жауап бермеді. Қайталап көріңіз.'));throw error;}finally{clearTimeout(timer);}
  }
  const options=rows=>'<option value="">—</option>'+rows.map(([v,ru,kk])=>`<option value="${esc(v)}">${esc(t(ru,kk||ru))}</option>`).join('');
  const subjects=options([['math','Математика'],['informatics','Информатика'],['physics','Физика'],['chemistry','Химия'],['biology','Биология'],['geography','География'],['history','Всемирная история','Дүниежүзі тарихы'],['law','Основы права','Құқық негіздері'],['foreign_language','Иностранный язык','Шет тілі']]);
  host.innerHTML=`<details id="planner-panel" class="planner-panel"><summary>${t('Помощник поступления: от подбора до плана','Оқуға түсу көмекшісі: іріктеуден жоспарға')}</summary>
    <p>${t('Пилот: 6 программ МУИТ и AITU, IT и кибербезопасность, после школы. Не весь каталог Казахстана. Источники просмотрены 14.09.2026.','Пилот: МУИТ және AITU-дың 6 бағдарламасы, IT және киберқауіпсіздік, мектептен кейін. Қазақстанның толық каталогы емес. Дереккөздер 14.09.2026 қаралды.')}</p>
    <details><summary>${t('Описать пожелания ИИ','Қалауларымды ЖИ-ге сипаттау')}</summary>
      <p>${t('ИИ заполнит черновик — проверьте его перед подбором. Текст обрабатывает внешний ИИ-сервис. Не указывайте ФИО, ИИН или документы. Нужен вход в аккаунт.','ЖИ жобаны толтырады — іріктеу алдында тексеріңіз. Мәтінді сыртқы ЖИ қызметі өңдейді. Аты-жөніңізді, ЖСН не құжаттарды жібермеңіз. Аккаунтқа кіру қажет.')}</p>
      <label>${t('Ваши пожелания','Қалауларыңыз')}<textarea id="planner-message" rows="3" maxlength="2000"></textarea></label>
      <button type="button" class="btn btn-ghost" id="planner-interpret">${t('Заполнить черновик с ИИ','Жобаны ЖИ көмегімен толтыру')}</button>
    </details>
    <form id="planner-form" class="planner-form" novalidate>
      <label>ЕНТ / ҰБТ<input name="ent" type="number" min="0" max="140" step="1" required></label>
      <label>${t('Бюджет обучения за год, ₸','Жылдық оқу бюджеті, ₸')}<input name="budget" type="number" min="0" max="100000000" required></label>
      <label>${t('Первый профильный предмет','Бірінші бейіндік пән')}<select name="subject1" required>${subjects}</select></label>
      <label>${t('Второй профильный предмет','Екінші бейіндік пән')}<select name="subject2" required>${subjects}</select></label>
      <label>${t('Направление','Бағыт')}<select name="group" required>${options([['B057','B057 · IT'],['B058','B058 · Информационная безопасность','B058 · Ақпараттық қауіпсіздік']])}</select></label>
      <label>${t('Год поступления','Түсу жылы')}<select name="year" required>${options([2026,2027,2028,2029,2030].map(y=>[y,String(y)]))}</select></label>
      <label>${t('Финансирование','Қаржыландыру')}<select name="funding" required>${options([['paid','Рассматриваю платное','Ақылы оқуды қарастырамын'],['grant','Только грант','Тек грант']])}</select></label>
      <label>${t('Язык обучения','Оқу тілі')}<select name="language" required>${options([['any','Любой','Кез келген'],['ru','Русский','Орысша'],['kk','Казахский','Қазақша'],['en','Английский','Ағылшынша']])}</select></label>
      <label>${t('Город','Қала')}<select name="city">${options([['any','Любой','Кез келген'],['Алматы','Алматы'],['Астана','Астана']])}</select></label>
      <label class="planner-check"><input name="needDorm" type="checkbox">${t('Нужно общежитие','Жатақхана қажет')}</label>
      <button class="btn btn-primary" type="submit">${t('Проверить и подобрать','Тексеру және іріктеу')}</button>
    </form><p id="planner-status" role="status" aria-live="polite"></p><div id="planner-result"></div></details>`;
  const form=document.getElementById('planner-form'),status=document.getElementById('planner-status'),result=document.getElementById('planner-result');
  const agentButton=document.createElement('button');agentButton.type='button';agentButton.id='planner-agent';agentButton.className='btn btn-primary';
  agentButton.textContent=t('Подтверждаю анкету — запустить агента','Сауалнаманы растаймын — агентті іске қосу');
  const agentNotice=document.createElement('p');agentNotice.textContent=t('Агент получает параметры анкеты через внешний ИИ-сервис и вызывает инструменты проверки. Нужен вход. Он не сохраняет план и не подаёт заявления без вашего действия.','Агент сауалнама параметрлерін сыртқы ЖИ қызметі арқылы алып, тексеру құралдарын шақырады. Кіру қажет. Ол сіздің әрекетіңізсіз жоспарды сақтамайды және өтініш бермейді.');
  form.after(agentNotice,agentButton);
  agentButton.onclick=()=>{useAgent=true;form.requestSubmit();};
  function readForm(){const f=new FormData(form),input={mode:'programmes',lang,needDorm:form.elements.needDorm.checked};for(const key of ['ent','budget','group','year','funding','language','city']){const v=f.get(key);if(v!=='')input[key]=['ent','budget','year'].includes(key)?Number(v):v;}if(f.get('subject1')&&f.get('subject2'))input.subjects=[f.get('subject1'),f.get('subject2')];return input;}
  function invalidate(){revision++;result.innerHTML='';status.textContent=t('Нажмите «Проверить и подобрать», чтобы применить анкету.','Сауалнаманы қолдану үшін «Тексеру және іріктеу» түймесін басыңыз.');}
  function fill(input){form.reset();for(const [key,v] of Object.entries(input)){if(key==='subjects'){form.elements.subject1.value=v[0];form.elements.subject2.value=v[1];}else if(key==='needDorm')form.elements.needDorm.checked=v;else if(form.elements.namedItem(key))form.elements.namedItem(key).value=v;}invalidate();}
  form.addEventListener('input',invalidate);
  document.getElementById('planner-interpret').onclick=async function(){
    const current=revision;this.disabled=true;status.textContent=t('ИИ разбирает пожелания…','ЖИ қалауларды талдауда…');
    try{
      const data=await api('/interpret',{message:document.getElementById('planner-message').value,lang});if(current!==revision)return;
      if(data.status==='draft'){fill(data.input);status.textContent=t('Черновик готов. Проверьте каждое поле и заполните недостающие значения.','Жоба дайын. Әр өрісті тексеріп, жетіспейтін мәндерді толтырыңыз.');}
      else{
        const reasons={
          not_configured:['ИИ не настроен.','ЖИ бапталмаған.'],
          authentication:['ИИ-сервис отклонил доступ. Сообщите администратору.','ЖИ қызметі кіруге рұқсат бермеді. Әкімшіге хабарлаңыз.'],
          quota:['Исчерпан баланс ИИ-сервиса.','ЖИ қызметінің балансы таусылды.'],
          rate_limited:['Достигнут лимит запросов ИИ-сервиса.','ЖИ қызметінің сұрау шегіне жетті.'],
          timeout:['ИИ не успел ответить.','ЖИ уақытында жауап бермеді.'],
          incomplete_response:['Ответ ИИ оборвался.','ЖИ жауабы үзіліп қалды.'],
          invalid_response:['Не удалось безопасно разобрать ответ ИИ.','ЖИ жауабын қауіпсіз талдау мүмкін болмады.'],
          provider_error:['Ошибка внешнего ИИ-сервиса.','Сыртқы ЖИ қызметінің қатесі.']
        };
        status.textContent=t(...(reasons[data.reason]||reasons.provider_error))+' '+t('Заполните анкету вручную — подбор и сохранение работают без ИИ.','Сауалнаманы қолмен толтырыңыз — іріктеу мен сақтау ЖИ-сіз жұмыс істейді.');
      }
    }catch(e){if(current===revision)status.textContent=e.message;}finally{this.disabled=false;}
  };
  function card(p,selectable){return `<article class="planner-option">${selectable?`<label class="planner-check"><input type="checkbox" value="${esc(p.id)}"><strong>${esc(p.name)}</strong></label>`:`<h4>${esc(p.name)}</h4>`}<p>${esc(p.university)} · ${esc(p.city)}</p>${costMarkup(p)}<p class="planner-warning">${assessment(p)}</p><ul>${p.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><details><summary>${t('Ограничения и что уточнить','Шектеулер және нені нақтылау керек')}</summary><ul>${p.warnings.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details><p class="planner-sources">${p.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join(' · ')}</p></article>`;}
  function selected(){const ids=[...result.querySelectorAll('.planner-option input:checked')].map(e=>e.value);if(ids.length<1||ids.length>3)throw Error(t('Выберите от 1 до 3 программ.','1–3 бағдарламаны таңдаңыз.'));return ids;}
  function renderPlan(p){
    let sourceCheckInProgress=false;
    result.innerHTML=`<h3>${t('Результаты проверки','Тексеру нәтижелері')}</h3><p>${esc(p.summary)}</p><p class="planner-warning">${t('ЕНТ и дедлайны требуют подтверждения. Совпадение предметов и бюджета не гарантирует зачисление.','ҰБТ мен мерзімдер растауды қажет етеді. Пәндер мен бюджет сәйкес болса да, қабылдауға кепілдік жоқ.')}</p><div class="planner-options">${p.matches.map(m=>card(m,true)).join('')}</div>
      <details><summary>${t('Не подошли по ограничениям','Шектеулерге сәйкес емес')} (${p.excluded.length})</summary>${p.excluded.map(m=>card(m,false)).join('')}</details>
      <button type="button" class="btn btn-ghost" id="planner-check-sources">${t('Проверить доступность источников онлайн','Дереккөздердің қолжетімділігін онлайн тексеру')}</button><p id="planner-source-status" role="status"></p>
      ${p.matches.length?`<button type="button" class="btn btn-ghost" id="planner-compare">${t('Сравнить и составить план','Салыстыру және жоспар құру')}</button><div id="planner-comparison"></div><button type="button" class="btn btn-primary" id="planner-save">${t('Подтверждаю: сохранить выбранные в профиль','Растаймын: таңдалғандарды профильге сақтау')}</button>`:''}`;
    document.getElementById('planner-check-sources').onclick=async function(){
      const current=revision,output=document.getElementById('planner-source-status');
      const saveButton=document.getElementById('planner-save');
      sourceCheckInProgress=true;this.disabled=true;if(saveButton)saveButton.disabled=true;
      output.textContent=t('Проверяем страницы и ожидаемые сведения…','Беттер мен күтілетін мәліметтерді тексерудеміз…');
      try{
        const ids=[...new Set([...p.matches,...p.excluded].flatMap(m=>m.sources.map(s=>s.id)))];
        const data=await api('/sources/check',{ids,input:p.input});if(current!==revision)return;
        const messages=data.sources.map(s=>s.id+': '+(s.status==='unavailable'?t('недоступен','қолжетімсіз'):s.contentStatus==='review_needed'?t('ожидаемые сведения не найдены','күтілген мәліметтер табылмады'):s.reviewRequired?t('изменился — нужна сверка','өзгерген — тексеру қажет'):t('ожидаемые фрагменты найдены','күтілген үзінділер табылды'))+' ('+new Date(s.checkedAt).toLocaleTimeString()+')');
        if(data.plan?.status==='ready'){renderPlan(data.plan);status.textContent=t('Подбор пересчитан. Прочитайте предупреждения и заново выберите программы.','Іріктеу қайта есептелді. Ескертулерді оқып, бағдарламаларды қайта таңдаңыз.');}
        document.getElementById('planner-source-status').textContent=messages.join('; ')+'. '+t('Совпадение фрагментов не подтверждает актуальность требований. Кеш — до 5 минут.','Үзінділердің сәйкестігі талаптардың өзектілігін растамайды. Кэш — 5 минутқа дейін.');
      }catch(e){if(current===revision)output.textContent=e.message;}finally{sourceCheckInProgress=false;this.disabled=false;if(saveButton)saveButton.disabled=false;}
    };
    if(!p.matches.length)return;
    document.getElementById('planner-compare').onclick=()=>{try{const ids=selected(),items=p.matches.filter(m=>ids.includes(m.id));document.getElementById('planner-comparison').innerHTML=`<div class="planner-table" tabindex="0"><table><caption>${t('Сравнение программ','Бағдарламаларды салыстыру')}</caption><thead><tr><th>${t('Программа','Бағдарлама')}</th><th>${t('Первый курс','Бірінші курс')}</th><th>${t('ЕНТ / испытания','ҰБТ / сынақтар')}</th></tr></thead><tbody>${items.map(m=>`<tr><td>${esc(m.university)} · ${esc(m.name)}</td><td>${costMarkup(m)}</td><td>${t('Уточнить','Нақтылау')} / ${esc(m.extraExam==='AET'?'AET':t('языковой экзамен','тіл емтиханы'))}</td></tr>`).join('')}</tbody></table></div><h3>${t('Ваш план действий','Әрекет жоспарыңыз')}</h3><ol>${p.tasks.filter(task=>ids.includes(task.programmeId)).map(task=>`<li>${esc(task.title)}</li>`).join('')}</ol>`;}catch(e){status.textContent=e.message;}};
    result.querySelector('.planner-options').addEventListener('change',()=>{document.getElementById('planner-comparison').innerHTML='';document.getElementById('planner-save').disabled=sourceCheckInProgress;});
    document.getElementById('planner-save').onclick=async function(){if(sourceCheckInProgress)return;const current=revision;this.disabled=true;try{await api('/plans',{input:p.input,selectedIds:selected()});if(current===revision)status.textContent=t('Сохранено в профиль → Мои планы поступления. Заявления не отправлялись.','Профильге сақталды → Менің түсу жоспарларым. Өтініштер жіберілген жоқ.');}catch(e){if(current===revision)status.textContent=e.message;this.disabled=false;}};
  }
  form.onsubmit=async e=>{e.preventDefault();const agentMode=useAgent;useAgent=false;const current=++revision,button=form.querySelector('[type=submit]');button.disabled=true;agentButton.disabled=true;result.innerHTML='';status.textContent=t('Ищем программы и проверяем ограничения…','Бағдарламаларды іздеп, шектеулерді тексерудеміз…');try{const data=await api(agentMode?'/agent':'/programme-preview',readForm());if(current!==revision)return;if(data.status==='needs_input'){status.textContent=data.questions.map(q=>q.text).join(' ');form.elements.namedItem(data.missing[0]==='subjects'?'subject1':data.missing[0])?.focus();return;}renderPlan(data);status.textContent=t('Проверка завершена. Прочитайте ограничения перед сохранением.','Тексеру аяқталды. Сақтау алдында шектеулерді оқыңыз.');if(data.agent)status.textContent=(data.agent.mode==='tool_agent'?t('Агент выполнил проверки.','Агент тексерулерді орындады.'):t('Агент недоступен: показан подбор по правилам без ИИ.','Агент қолжетімсіз: ЖИ-сіз ережелер бойынша іріктеу көрсетілді.'))+' '+data.agent.trace.map(step=>step.tool).join(' → ');}catch(e){if(current===revision)status.textContent=e.message;}finally{button.disabled=false;agentButton.disabled=false;}};
  const saved=document.getElementById('planner-saved'),savedList=document.getElementById('planner-saved-list');
  async function loadSaved(){const current=++savedRevision;savedList.textContent=t('Загрузка…','Жүктелуде…');try{const data=await api('/plans');if(current!==savedRevision||!saved.open)return;savedList.innerHTML=data.plans.map(row=>`<article class="planner-saved" data-plan="${row.id}"><h3>${esc(row.plan.specialty)} · ${esc(row.created_at)}</h3><p>ЕНТ / ҰБТ ${esc(row.plan.input.ent)} · ${money(row.plan.input.budget)} · ${esc(row.plan.input.year||'')}</p><ul>${row.plan.matches.map(m=>`<li>${esc(m.university||'')} ${esc(m.name)}</li>`).join('')}</ul><p>${t('Снимок, не подтверждение поступления. Перед подачей перепроверьте условия.','Көшірме, қабылдау растамасы емес. Өтініш алдында шарттарды қайта тексеріңіз.')}</p>${(row.plan.tasks||[]).map(task=>`<label class="planner-check"><input type="checkbox" data-task="${esc(task.id)}" ${task.done?'checked':''}>${esc(task.title)}</label>`).join('')}<button class="btn btn-ghost" data-delete="${row.id}">${t('Удалить план','Жоспарды жою')}</button>${row.plan.mode==='programmes'?`<button class="btn btn-ghost" data-restore="${row.id}">${t('Перепроверить анкету','Сауалнаманы қайта тексеру')}</button>`:''}</article>`).join('')||t('Сохранённых планов пока нет.','Сақталған жоспарлар жоқ.');
      for(const row of data.plans){
        const article=savedList.querySelector(`[data-plan="${row.id}"]`);
        if(row.review){
          const notice=document.createElement('section');notice.className='planner-snapshot-review';
          const heading=document.createElement('h4');heading.textContent=t('Повторная проверка сохранённого плана','Сақталған жоспарды қайта тексеру');
          const explanation=document.createElement('p');explanation.textContent=t('По текущим данным каталога и последним статусам источников, без нового запроса к сайтам. Сохранённые шаги не изменены.','Каталогтың ағымдағы деректері және дереккөздердің соңғы күйлері бойынша, сайттарға жаңа сұраусыз. Сақталған қадамдар өзгерген жоқ.');
          notice.append(heading,explanation);
          if(!row.review.programmes.length){const warning=document.createElement('p');warning.textContent=t('Не удалось пересчитать: перепроверьте анкету.','Қайта есептеу мүмкін болмады: сауалнаманы тексеріңіз.');notice.append(warning);}
          for(const item of row.review.programmes){
            const entry=document.createElement('div');
            entry.innerHTML='<strong>'+esc(item.name)+'</strong><p class="planner-warning">'+(item.verification==='unavailable'?t('Программа больше не найдена в пилотном каталоге.','Бағдарлама пилоттық каталогта табылмады.'):assessment(item))+'</p>';
            if(item.blockers?.length){const reason=document.createElement('p');reason.textContent=t('Ограничения: ','Шектеулер: ')+item.blockers.map(key=>t(...(criterionLabels[key]||[key,key]))).join(', ');entry.append(reason);}
            if(item.cost)entry.insertAdjacentHTML('beforeend',costMarkup(item));
            notice.append(entry);
          }
          article.querySelector('ul').after(notice);
        }
        article.querySelectorAll('ul > li').forEach((li,index)=>{
          for(const source of row.plan.matches[index]?.sources||[]){
            try{const url=new URL(source.url);if(!['http:','https:'].includes(url.protocol))continue;
              const link=document.createElement('a');link.href=url.href;link.textContent=source.title;link.target='_blank';link.rel='noopener noreferrer';link.className='planner-sources';li.append(document.createElement('br'),link);
            }catch{}
          }
        });
      }
      savedList.querySelectorAll('[data-task]').forEach(box=>box.onchange=async()=>{box.disabled=true;try{await api('/plans/'+box.closest('[data-plan]').dataset.plan+'/tasks',{taskId:box.dataset.task,done:box.checked},'PATCH');}catch(e){box.checked=!box.checked;alert(e.message);}finally{box.disabled=false;}});
      savedList.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{if(!confirm(t('Удалить сохранённый план?','Сақталған жоспарды жою керек пе?')))return;button.disabled=true;try{await api('/plans/'+button.dataset.delete,null,'DELETE');loadSaved();}catch(e){alert(e.message);button.disabled=false;}});
      savedList.querySelectorAll('[data-restore]').forEach(button=>button.onclick=()=>{const row=data.plans.find(p=>String(p.id)===button.dataset.restore);fill({...row.plan.input,lang});window.navigate('advisor');document.getElementById('planner-panel').open=true;form.requestSubmit();});
    }catch(e){if(current===savedRevision)savedList.textContent=e.message;}}
  if(saved){saved.querySelector('summary').textContent=t('Мои планы поступления','Менің түсу жоспарларым');saved.addEventListener('toggle',()=>{if(saved.open)loadSaved();else{savedRevision++;savedList.innerHTML='';}});}
  const clearPrivate=()=>{revision++;savedRevision++;if(saved)saved.open=false;if(savedList)savedList.innerHTML='';form.reset();result.innerHTML='';document.getElementById('planner-message').value='';status.textContent='';};
  window.addEventListener('edumatch-auth-changed',clearPrivate);
  window.addEventListener('storage',event=>{if(event.key==='edumatch_user')clearPrivate();});
})();
