(function () {
  'use strict';
  const lang=window.currentLanguage==='kk'?'kk':'ru', t=(ru,kk)=>lang==='kk'?kk:ru;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>v==null?t('Не подтверждено','Расталмаған'):Number(v).toLocaleString(lang==='kk'?'kk-KZ':'ru-RU')+' ₸';
  const host=document.getElementById('planner-assistant');if(!host)return;
  let revision=0,savedRevision=0,stale=false,previewBusy=false;
  let retainedSelection=new Map();
  const focusSection=element=>{if(!element)return;element.setAttribute('tabindex','-1');element.focus({preventScroll:true});element.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
  function loadingMarkup(message){return `<div class="planner-loading"><p role="status">${esc(message)}</p><div class="planner-skeleton" aria-hidden="true"><span></span><span></span><span></span></div><div class="planner-skeleton" aria-hidden="true"><span></span><span></span></div></div>`;}
  function feedback(target,message,actions=[]){target.replaceChildren();const text=document.createElement('span');text.className='planner-feedback-copy';text.textContent=message;target.append(text);for(const [label,run] of actions){const button=document.createElement('button');button.type='button';button.className='btn btn-ghost';button.textContent=label;button.onclick=run;target.append(button);}}
  function showFailure(target,error,retry,message=error.message){feedback(target,message,error.status===401?[[t('Войти в аккаунт','Аккаунтқа кіру'),()=>window.navigate('login')]]:retry?[[t('Повторить','Қайталау'),retry]]:[]);}
  const safeSource=url=>{try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password?parsed.href:null;}catch{return null;}};
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
  function comparisonMarkup(items,input){
    const scrollHint=`<p class="planner-scroll-hint">${t('Прокрутите таблицу вправо, чтобы увидеть остальные программы →','Қалған бағдарламаларды көру үшін кестені оңға жылжытыңыз →')}</p>`;
    const unknown=t('Не подтверждено для выбранного набора','Таңдалған қабылдау үшін расталмаған');
    const reference=value=>`${esc(value)} <small>${t('Справочно; уточните актуальные условия','Анықтама үшін; өзекті шарттарды нақтылаңыз')}</small>`;
    const threshold=(m,grant)=>{
      const value=grant?m.grantMinEnt:m.minimumEnt;
      if(value==null)return esc(unknown);
      const label=`${value} · ${m.requirementsYear||t('год не указан','жылы көрсетілмеген')}`;
      const applies=grant?input.funding==='grant':input.funding!=='grant';
      return applies&&m.checks?.ent==='within'&&m.requirementsYear===input.year&&!m.conflict
        ?`${esc(label)} <small>${t('Ваш балл не ниже минимума. Это не гарантия поступления.','Балыңыз минимумнан төмен емес. Бұл оқуға түсу кепілдігі емес.')}</small>`:reference(label);
    };
    const rows=[
      [t('Город','Қала'),m=>esc(m.city||unknown)],
      [t('Минимум для конкурса грантов','Грант конкурсының минимумы'),m=>threshold(m,true)],
      [t('Язык обучения','Оқу тілі'),m=>Array.isArray(m.language)&&m.language.length?reference(m.language.map(code=>({ru:t('Русский','Орысша'),kk:t('Казахский','Қазақша'),en:t('Английский','Ағылшынша')}[code]||code)).join(', ')):esc(unknown)],
      [t('Дополнительный экзамен','Қосымша емтихан'),m=>m.extraExam?reference(m.extraExam):esc(unknown)],
      [t('Срок подачи','Өтініш мерзімі'),m=>m.deadline&&m.checks?.deadline==='within'?esc(m.deadline):m.deadline?reference(m.deadline):esc(unknown)],
    ];
    if(input.funding!=='grant')rows.push([t('Минимум платного поступления','Ақылы оқудың минимумы'),m=>threshold(m,false)],[t('Стоимость платного резерва','Ақылы резерв құны'),costMarkup]);
    if(input.needDorm)rows.push([t('Общежитие','Жатақхана'),()=>esc(t('Наличие места и стоимость нужно уточнить','Орынның бар-жоғын және құнын нақтылау қажет'))]);
    rows.push([t('Что сделать первым','Алдымен не істеу керек'),m=>esc(m.conflict?t('Уточнить противоречия в требованиях у приёмной комиссии.','Қабылдау комиссиясынан талаптардағы қайшылықтарды нақтылаңыз.'):m.checks?.ent!=='within'?t(`Подтвердить минимум ЕНТ на ${input.year} год.`,`ҰБТ минимумын ${input.year} жылға растаңыз.`):t('Проверить баллы по разделам ЕНТ и условия конкурса.','ҰБТ бөлімдерінің балдарын және конкурс шарттарын тексеріңіз.'))]);
    return `<p>${t('Минимум участия в конкурсе — не проходной балл. Получение гранта здесь не подтверждается.','Конкурсқа қатысу минимумы — өту балы емес. Мұнда грант алу расталмайды.')}</p>${scrollHint}<div class="planner-table planner-comparison-table" tabindex="0" role="region" aria-label="${t('Сравнение программ; прокрутите по горизонтали','Бағдарламаларды салыстыру; көлденең айналдырыңыз')}"><table><caption>${t('Условия выбранных программ','Таңдалған бағдарламалардың шарттары')} · ${esc(input.year)}</caption><thead><tr><th scope="col">${t('Условие','Шарт')}</th>${items.map(m=>`<th scope="col">${esc(m.university)}<br>${esc(m.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,render])=>`<tr><th scope="row">${label}</th>${items.map(m=>`<td>${render(m)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${t('Далее сохраните план: в нём можно отмечать выполненные шаги. Сохранение не отправляет заявление в вуз.','Әрі қарай жоспарды сақтаңыз: онда орындалған қадамдарды белгілеуге болады. Сақтау университетке өтініш жібермейді.')}</p>`;
  }
  async function api(path,body,method) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==='/agent'?40000:18000);
    try {
      const response=await fetch('/api/planner'+path,{method:method||(body?'POST':'GET'),credentials:'include',headers:{'Content-Type':'application/json'},signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
      const data=await response.json();
      if(!response.ok)throw Object.assign(Error(response.status===401?t('Войдите в аккаунт для этого действия.','Бұл әрекет үшін аккаунтқа кіріңіз.'):data.error||t('Запрос не выполнен. Повторите попытку.','Сұрау орындалмады. Қайталап көріңіз.')),{status:response.status});
      return data;
    }catch(error){if(error.name==='AbortError')throw Error(t('Сервис не ответил вовремя. Повторите попытку.','Қызмет уақытында жауап бермеді. Қайталап көріңіз.'));throw error;}finally{clearTimeout(timer);}
  }
  const options=rows=>'<option value="">—</option>'+rows.map(([v,ru,kk])=>`<option value="${esc(v)}">${esc(t(ru,kk||ru))}</option>`).join('');
  const subjects=options([['math','Математика'],['informatics','Информатика'],['physics','Физика'],['chemistry','Химия'],['biology','Биология'],['geography','География'],['history','Всемирная история','Дүниежүзі тарихы'],['law','Основы права','Құқық негіздері'],['foreign_language','Иностранный язык','Шет тілі']]);
  host.innerHTML=`<section id="planner-panel" class="planner-panel">
    <nav class="planner-steps" aria-label="${t('Этапы поступления','Түсу кезеңдері')}"><span class="is-active" data-step="1"><b>1</b>${t('Анкета','Сауалнама')}</span><span data-step="2"><b>2</b>${t('Подбор','Іріктеу')}</span><span data-step="3"><b>3</b>${t('Сравнение','Салыстыру')}</span><span data-step="4"><b>4</b>${t('План','Жоспар')}</span></nav>
    <details id="planner-questionnaire" open><summary>${t('Ваша анкета','Сіздің сауалнамаңыз')} <span id="planner-input-summary"></span></summary>
    <details class="planner-ai-help"><summary>${t('Заполнить анкету по описанию с ИИ — необязательно','Сауалнаманы ЖИ көмегімен толтыру — міндетті емес')}</summary><div class="planner-ai-box"><p id="planner-ai-hint">${t('Например: «112 баллов, математика и информатика, хочу в Алматы на грант». ИИ подготовит черновик: проверьте поля. Не указывайте ФИО, ИИН и документы.','Мысалы: «112 балл, математика және информатика, Алматыда грантқа оқығым келеді». ЖИ жоба дайындайды: өрістерді тексеріңіз. Аты-жөніңізді, ЖСН және құжаттарды көрсетпеңіз.')}</p><div class="planner-ai-input"><label for="planner-message">${t('Ваши пожелания','Қалауларыңыз')}</label><textarea id="planner-message" aria-describedby="planner-ai-hint" rows="3" maxlength="2000"></textarea><button type="button" class="btn btn-ghost" id="planner-interpret">${t('Заполнить с ИИ','ЖИ көмегімен толтыру')}</button></div></div></details>
    <p id="planner-form-hint">${t('Поля со звёздочкой обязательны. Остальные уточняют ваши предпочтения.','Жұлдызшамен белгіленген өрістер міндетті. Қалғандары қалауларыңызды нақтылайды.')}</p>
    <form id="planner-form" class="planner-form" novalidate>
      <label>ЕНТ / ҰБТ<input name="ent" type="number" min="0" max="140" step="1" aria-describedby="planner-ent-hint" required><small id="planner-ent-hint">${t('Общий балл от 0 до 140','Жалпы балл: 0–140')}</small></label>
      <label>${t('Первый профильный предмет','Бірінші бейіндік пән')}<select name="subject1" required>${subjects}</select></label>
      <label>${t('Второй профильный предмет','Екінші бейіндік пән')}<select name="subject2" required>${subjects}</select></label>
      <label>${t('Направление','Бағыт')}<select name="group" required>${options([['B057','B057 · IT'],['B058','B058 · Информационная безопасность','B058 · Ақпараттық қауіпсіздік'],['B059','B059 · Коммуникации и телекоммуникации','B059 · Коммуникациялар және телекоммуникациялар']])}</select></label>
      <label>${t('Год поступления','Түсу жылы')}<select name="year" required>${options([2026,2027,2028,2029,2030].map(y=>[y,String(y)]))}</select></label>
      <label>${t('Финансирование','Қаржыландыру')}<select name="funding" required><option value="grant">${t('Только грант','Тек грант')}</option><option value="grant_plus_paid">${t('Грант + резервный платный вариант','Грант + қосалқы ақылы нұсқа')}</option></select></label>
      <label id="planner-budget-field" hidden>${t('Бюджет платного резерва за год, ₸','Ақылы резервтің жылдық бюджеті, ₸')}<input name="budget" type="number" min="0" max="100000000" step="50000"><small>${t('Используется только для резервного варианта, если грант не получен.','Грант алынбаған жағдайда тек қосалқы нұсқа үшін қолданылады.')}</small></label>
      <label>${t('Язык обучения','Оқу тілі')}<select name="language" required>${options([['any','Любой','Кез келген'],['ru','Русский','Орысша'],['kk','Казахский','Қазақша'],['en','Английский','Ағылшынша']])}</select></label>
      <label>${t('Город','Қала')}<select name="city">${options([['any','Любой','Кез келген'],['Алматы','Алматы'],['Астана','Астана']])}</select></label>
      <label class="planner-check"><input name="needDorm" type="checkbox">${t('Нужно общежитие','Жатақхана қажет')}</label>
      <button class="btn btn-primary planner-submit" type="submit">${t('Подобрать программы','Бағдарламаларды іріктеу')}</button>
    </form></details><p class="planner-privacy">${t('Подбор не гарантирует грант. Сохранение плана не отправляет заявление в университет.','Іріктеу грантқа кепілдік бермейді. Жоспарды сақтау университетке өтініш жібермейді.')}</p><p id="planner-status" role="status" aria-live="polite"></p><section id="planner-stale" hidden role="status"><p>${t('Анкета изменена. Выбранные программы сохранены, но прежние результаты нужно пересчитать.','Сауалнама өзгерді. Таңдалған бағдарламалар сақталды, бірақ нәтижелерді қайта есептеу қажет.')}</p><button type="button" class="btn btn-primary" id="planner-refresh">${t('Обновить подбор','Іріктеуді жаңарту')}</button></section><div id="planner-result"></div></section>`;
  const form=document.getElementById('planner-form'),status=document.getElementById('planner-status'),result=document.getElementById('planner-result');
  function setStep(step){host.querySelectorAll('.planner-steps [data-step]').forEach(item=>{const number=Number(item.dataset.step),bubble=item.querySelector('b');item.classList.toggle('is-active',number===step);item.classList.toggle('is-complete',number<step);if(number===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');bubble.textContent=number<step?'✓':number;});}
  setStep(1);
  const questionnaire=document.getElementById('planner-questionnaire');
  form.elements.language.value='any';form.elements.city.value='any';
  function clearFieldError(field){field.removeAttribute('aria-invalid');document.getElementById('planner-error-'+field.name)?.remove();if(field.name==='ent')field.setAttribute('aria-describedby','planner-ent-hint');else field.removeAttribute('aria-describedby');}
  function fieldError(field,message){clearFieldError(field);field.setAttribute('aria-invalid','true');const error=document.createElement('small');error.id='planner-error-'+field.name;error.className='planner-field-error';error.textContent=message;field.setAttribute('aria-describedby',[field.name==='ent'?'planner-ent-hint':'',error.id].filter(Boolean).join(' '));field.after(error);}
  function markRequired(){form.querySelectorAll('input,select').forEach(field=>{const label=field.closest('label');if(!label||field.type==='checkbox')return;let title=label.querySelector('.planner-field-label');if(!title){title=document.createElement('span');title.className='planner-field-label';title.textContent=label.firstChild.textContent;label.firstChild.replaceWith(title);}let mark=title.querySelector('.planner-required');if(field.required&&!mark){mark=document.createElement('span');mark.className='planner-required';mark.textContent=' *';mark.setAttribute('aria-hidden','true');title.append(mark);}if(mark)mark.hidden=!field.required;});}
  const budgetField=document.getElementById('planner-budget-field'),budgetInput=form.elements.budget;
  function syncFunding(){const show=form.elements.funding.value==='grant_plus_paid';budgetField.hidden=!show;budgetInput.required=show;if(!show){budgetInput.value='';clearFieldError(budgetInput);}markRequired();}
  function readForm(){const f=new FormData(form),input={mode:'programmes',lang,needDorm:form.elements.needDorm.checked};for(const key of ['ent','budget','group','year','funding','language','city']){const v=f.get(key);if(v!=='')input[key]=['ent','budget','year'].includes(key)?Number(v):v;}if(input.funding==='grant')input.budget=0;if(f.get('subject1')&&f.get('subject2'))input.subjects=[f.get('subject1'),f.get('subject2')];return input;}
  function rememberSelection(){result.querySelectorAll('[data-programme-select]').forEach(box=>{if(box.checked)retainedSelection.set(box.value,box.closest('label').querySelector('strong').textContent);else retainedSelection.delete(box.value);});}
  function invalidate(){revision++;rememberSelection();if(result.querySelector('.planner-loading'))result.replaceChildren();stale=!!result.children.length;status.textContent='';document.getElementById('planner-stale').hidden=!stale;result.classList.toggle('is-stale',stale);result.querySelectorAll('button,input').forEach(control=>control.disabled=true);document.getElementById('planner-comparison')?.replaceChildren();result.querySelector('.planner-options')?.removeAttribute('hidden');setStep(1);}
  function fill(input){form.reset();for(const [key,v] of Object.entries(input)){if(key==='subjects'){form.elements.subject1.value=v[0];form.elements.subject2.value=v[1];}else if(key==='needDorm')form.elements.needDorm.checked=v;else if(key==='funding'&&v==='paid')form.elements.funding.value='grant_plus_paid';else if(form.elements.namedItem(key))form.elements.namedItem(key).value=v;}syncFunding();invalidate();}
  form.addEventListener('input',event=>{if(event.target.name){clearFieldError(event.target);form.elements.subject2.setCustomValidity('');invalidate();}});form.elements.funding.addEventListener('change',syncFunding);syncFunding();
  document.getElementById('planner-refresh').onclick=()=>{questionnaire.open=true;form.requestSubmit();};
  document.getElementById('planner-message').addEventListener('input',()=>{revision++;});
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
  function card(p,index,grantOnly){
    const checks=p.checks||{},reasons=p.reasons||[],warnings=p.warnings||[];
    const known=['subjects','ent','language','deadline'].filter(key=>checks[key]==='within').map(key=>key==='ent'?t('минимум ЕНТ','ҰБТ минимумы')+(Number.isFinite(grantOnly?p.grantMinEnt:p.minimumEnt)?' '+(grantOnly?p.grantMinEnt:p.minimumEnt):''):t(...criterionLabels[key]));
    const missing=(p.unverifiedCriteria||[]).filter(key=>!grantOnly||key!=='budget');
    const priority=['ent','subjects','funding','deadline','language','entSections','extraExam','dorm'].find(key=>missing.includes(key));
    const risk=p.conflict?t('В источниках есть противоречия — уточните требования у приёмной комиссии.','Дереккөздерде қайшылық бар — қабылдау комиссиясынан талаптарды нақтылаңыз.'):priority?t('Нужно уточнить: ','Нақтылау қажет: ')+t(...criterionLabels[priority]):t('Подтвердите условия конкурса и наличие грантов.','Конкурс шарттары мен гранттардың бар-жоғын растаңыз.');
    const sources=(p.sources||[]).filter(s=>safeSource(s.url)),source=sources[0];
    const next=p.conflict?t('Сверить противоречивые условия с приёмной комиссией','Қайшы шарттарды қабылдау комиссиясымен салыстыру'):priority==='ent'?t('Проверить минимум ЕНТ для выбранного года','Таңдалған жылға ҰБТ минимумын тексеру'):t('Проверить условия конкурса в официальном источнике','Ресми дереккөзден конкурс шарттарын тексеру');
    return `<article class="planner-option" ${index>=5?'hidden':''}><label class="planner-check"><input data-programme-select type="checkbox" value="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc(p.university)} · ${esc(p.city)}</small></span></label>
      <div class="planner-option-summary"><p><b>${t('Подтверждённое соответствие:','Расталған сәйкестік:')}</b> ${esc(known.length?known.join(', '):t('пока недостаточно данных','әзірге дерек жеткіліксіз'))}</p>
      <p><b>${t('Что уточнить:','Нені нақтылау керек:')}</b> ${esc(risk)}</p>
      <p class="planner-reference">${t('Год требований:','Талаптар жылы:')} ${esc(p.requirementsYear||t('не указан','көрсетілмеген'))}. ${t('Для другого года нужна отдельная проверка.','Басқа жыл үшін бөлек тексеру қажет.')}</p>
      <p><b>${t('Следующий шаг:','Келесі қадам:')}</b> ${esc(next)}.</p>
      ${source?`<a class="planner-source-link" href="${esc(safeSource(source.url))}" target="_blank" rel="noopener noreferrer">${t('Открыть источник','Дереккөзді ашу')} · ${esc(source.title||p.university)} <span>${t('(новая вкладка)','(жаңа бет)')}</span></a>`:`<p class="planner-reference">${t('Ссылка на источник отсутствует — обратитесь в приёмную комиссию.','Дереккөз сілтемесі жоқ — қабылдау комиссиясына хабарласыңыз.')}</p>`}</div>
      <details><summary>${t('Все требования и источники','Барлық талаптар мен дереккөздер')}</summary>${grantOnly?'':costMarkup(p)}<p class="planner-warning">${assessment(p)}</p><ul>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>${warnings.length?`<ul>${warnings.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}<p class="planner-sources">${sources.map(s=>`<a href="${esc(safeSource(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title||t('Источник','Дереккөз'))}</a>`).join(' · ')}</p></details></article>`;
  }
  function selected(){const ids=[...result.querySelectorAll('[data-programme-select]:checked')].map(e=>e.value);if(ids.length<1||ids.length>3)throw Error(t('Выберите от 1 до 3 программ.','1–3 бағдарламаны таңдаңыз.'));return ids;}
  function renderPlan(p){
    setStep(2);
    let sourceCheckInProgress=false;
    rememberSelection();const previousSelection=new Map(retainedSelection);
    stale=false;document.getElementById('planner-stale').hidden=true;result.classList.remove('is-stale');
    result.innerHTML=`<div class="planner-section-title"><span>2</span><div><h2 id="planner-results-heading" tabindex="-1">${t('Варианты по вашей анкете','Сауалнамаңыз бойынша нұсқалар')}</h2><p>${t('Отметьте до трёх программ и сравните условия. Подбор не гарантирует грант.','Үшке дейін бағдарлама таңдап, шарттарын салыстырыңыз. Іріктеу грантқа кепілдік бермейді.')}</p></div></div><p id="planner-retained" role="status"></p>
      ${!p.matches.length?`<p>${t('По этим параметрам вариантов не найдено. Попробуйте другой город или проверьте предметы. Неизвестные условия не означают отказ в поступлении.','Бұл параметрлер бойынша нұсқалар табылмады. Басқа қаланы таңдаңыз немесе пәндерді тексеріңіз. Белгісіз шарттар оқуға қабылдамауды білдірмейді.')}</p><button type="button" class="btn btn-ghost" id="planner-edit-empty">${t('Изменить анкету','Сауалнаманы өзгерту')}</button>`:''}
      ${p.matches.length?`<div class="planner-result-actions"><strong id="planner-selected-count" aria-live="polite" aria-atomic="true">${t('Выбрано: 0 из 3','Таңдалды: 0 / 3')}</strong><span id="planner-next-hint">${t('Выберите программы — затем появится следующий шаг','Бағдарламаларды таңдаңыз — содан кейін келесі қадам пайда болады')}</span><button type="button" class="btn btn-primary" id="planner-compare">${t('Далее: посмотреть сравнение','Келесі: салыстыруды көру')}</button><button type="button" class="btn btn-primary" id="planner-save" hidden>${t('Далее: сохранить план','Келесі: жоспарды сақтау')}</button><button type="button" class="btn btn-ghost" id="planner-change-selection" hidden>${t('Изменить выбор','Таңдауды өзгерту')}</button><p id="planner-action-status" role="status"></p></div>`:''}
      <div class="planner-options">${p.matches.map((m,index)=>card(m,index,p.input.funding==='grant')).join('')}</div>
      ${p.matches.length>5?`<button type="button" class="btn btn-ghost" id="planner-show-more">${t('Показать ещё 5','Тағы 5 көрсету')}</button>`:''}
      <details class="planner-excluded"><summary>${t('Почему остальные варианты не показаны','Неліктен қалған нұсқалар көрсетілмеген')} (${p.excluded.length})</summary><p>${t('Они не прошли выбранные фильтры: направление, профильные предметы, город или известные требования. Измените анкету, чтобы пересчитать подбор.','Олар таңдалған сүзгілерден өтпеді: бағыт, бейіндік пәндер, қала немесе белгілі талаптар. Іріктеуді қайта есептеу үшін сауалнаманы өзгертіңіз.')}</p></details>
      <details class="planner-source-tools"><summary>${t('Проверка официальных источников','Ресми дереккөздерді тексеру')}</summary><button type="button" class="btn btn-ghost" id="planner-check-sources">${t('Проверить источники онлайн','Дереккөздерді онлайн тексеру')}</button><p id="planner-source-status" role="status"></p></details><div id="planner-comparison"></div>`;
    document.getElementById('planner-edit-empty')?.addEventListener('click',()=>{questionnaire.open=true;focusSection(form);});
    const kept=p.matches.filter(m=>previousSelection.has(String(m.id)));
    retainedSelection=new Map(kept.map(m=>[String(m.id),m.name]));
    result.querySelectorAll('[data-programme-select]').forEach(box=>{box.checked=retainedSelection.has(box.value);if(box.checked)box.closest('.planner-option').hidden=false;});
    const removed=[...previousSelection].filter(([id])=>!retainedSelection.has(id)).map(([,name])=>name);
    document.getElementById('planner-retained').textContent=previousSelection.size?t(`Сохранено в выборе: ${kept.length}.`,`Таңдауда сақталды: ${kept.length}.`)+(removed.length?' '+t('Больше нет в результатах: ','Нәтижелерде енді жоқ: ')+removed.join(', '):''):'';
    questionnaire.open=false;document.getElementById('planner-input-summary').textContent=` · ${p.input.ent} · ${p.input.group} · ${p.input.year}`;
    document.getElementById('planner-check-sources').onclick=async function(){if(stale||previewBusy)return;
      const current=revision,output=document.getElementById('planner-source-status');
      const saveButton=document.getElementById('planner-save');
      sourceCheckInProgress=true;this.disabled=true;if(saveButton)saveButton.disabled=true;
      output.textContent=t('Проверяем страницы и ожидаемые сведения…','Беттер мен күтілетін мәліметтерді тексерудеміз…');
      try{
        const ids=[...new Set([...p.matches,...p.excluded].flatMap(m=>m.sources.map(s=>s.id)).filter(Boolean))];
        if(!ids.length){output.textContent=t('Для этих вариантов пока нет источников, поддерживающих автоматическую онлайн-проверку. Откройте официальный сайт в карточке.','Бұл нұсқалар үшін автоматты онлайн тексеруді қолдайтын дереккөздер әзірге жоқ. Карточкадағы ресми сайтты ашыңыз.');return;}
        const data=await api('/sources/check',{ids,input:p.input});if(current!==revision)return;
        const messages=data.sources.map(s=>s.id+': '+(s.status==='unavailable'?t('недоступен','қолжетімсіз'):s.contentStatus==='review_needed'?t('ожидаемые сведения не найдены','күтілген мәліметтер табылмады'):s.reviewRequired?t('изменился — нужна сверка','өзгерген — тексеру қажет'):t('ожидаемые фрагменты найдены','күтілген үзінділер табылды'))+' ('+new Date(s.checkedAt).toLocaleTimeString()+')');
        if(data.plan?.status==='ready'){renderPlan(data.plan);status.textContent=t('Подбор пересчитан. Ваш выбор сохранён, если программы остались в результатах.','Іріктеу қайта есептелді. Бағдарламалар нәтижелерде қалса, таңдауыңыз сақталды.');}
        document.getElementById('planner-source-status').textContent=messages.join('; ')+'. '+t('Совпадение фрагментов не подтверждает актуальность требований. Кеш — до 5 минут.','Үзінділердің сәйкестігі талаптардың өзектілігін растамайды. Кэш — 5 минутқа дейін.');
      }catch(e){if(current===revision)output.textContent=e.message;}finally{sourceCheckInProgress=false;this.disabled=false;if(saveButton?.isConnected)saveButton.disabled=stale||previewBusy||!result.querySelector('[data-programme-select]:checked');}
    };
    if(!p.matches.length)return;
    let visible=5;const actionStatus=document.getElementById('planner-action-status'),count=document.getElementById('planner-selected-count');
    const updateSelection=()=>{const boxes=[...result.querySelectorAll('[data-programme-select]')],checked=boxes.filter(box=>box.checked),saveButton=document.getElementById('planner-save'),compareButton=document.getElementById('planner-compare');count.textContent=t(`Выбрано: ${checked.length} из 3`,`Таңдалды: ${checked.length} / 3`);boxes.forEach(box=>box.disabled=!box.checked&&checked.length>=3);compareButton.disabled=stale||previewBusy||!checked.length;saveButton.disabled=stale||previewBusy||sourceCheckInProgress||!checked.length;document.getElementById('planner-next-hint').textContent=checked.length?t('Нажмите «Далее», чтобы проверить различия','Айырмашылықтарды тексеру үшін «Келесі» түймесін басыңыз'):t('Сначала отметьте от 1 до 3 программ','Алдымен 1–3 бағдарламаны белгілеңіз');};
    function showShortlist(show){
      result.querySelectorAll('.planner-options,.planner-excluded,.planner-source-tools,#planner-show-more').forEach(el=>el.hidden=!show);
      document.getElementById('planner-change-selection').hidden=show;
      document.getElementById('planner-comparison').hidden=show;
    }
    document.getElementById('planner-change-selection').onclick=()=>{revision++;showShortlist(true);setStep(2);document.getElementById('planner-save').hidden=true;document.getElementById('planner-compare').hidden=false;actionStatus.textContent='';updateSelection();focusSection(document.getElementById('planner-results-heading'));};
    result.querySelector('.planner-options').addEventListener('change',()=>{revision++;rememberSelection();setStep(2);document.getElementById('planner-comparison').innerHTML='';document.getElementById('planner-save').hidden=true;document.getElementById('planner-compare').hidden=false;actionStatus.textContent='';updateSelection();});
    document.getElementById('planner-show-more')?.addEventListener('click',function(){visible+=5;result.querySelectorAll('.planner-option').forEach((item,index)=>item.hidden=index>=visible);if(visible>=p.matches.length)this.remove();});
document.getElementById('planner-compare').onclick=function(){if(stale||previewBusy)return;try{const ids=selected(),items=p.matches.filter(m=>ids.includes(m.id)),comparison=document.getElementById('planner-comparison');comparison.innerHTML=`<div class="planner-section-title"><span>3</span><div><h2 id="planner-comparison-heading" tabindex="-1">${t('Сравнение выбранных программ','Таңдалған бағдарламаларды салыстыру')}</h2><p>${t('Здесь показано, что известно сейчас. «Уточнить» означает, что вуз ещё нужно проверить по официальному источнику.','Мұнда қазір белгілі ақпарат көрсетілген. «Нақтылау» университетті ресми дереккөзден тексеру керегін білдіреді.')}</p></div></div>${comparisonMarkup(items,p.input)}<div class="planner-section-title"><span>4</span><div><h3>${t('Ваш чек-лист','Сіздің чек-парағыңыз')}</h3><p>${t('Откройте программу, чтобы увидеть её шаги. После сохранения их можно отмечать выполненными в профиле.','Қадамдарын көру үшін бағдарламаны ашыңыз. Сақтағаннан кейін профильде орындалғанын белгілей аласыз.')}</p></div></div><div class="planner-task-groups">${items.map(item=>`<details><summary>${esc(item.university)} · ${esc(item.name)}</summary><ol class="planner-action-list">${p.tasks.filter(task=>task.programmeId===item.id).map(task=>`<li>${esc(task.title.replace(item.university+' · '+item.name+': ',''))}</li>`).join('')}</ol></details>`).join('')}</div>`;showShortlist(false);setStep(3);this.hidden=true;document.getElementById('planner-save').hidden=false;document.getElementById('planner-next-hint').textContent=t('Проверьте сравнение ниже, затем сохраните чек-лист','Төмендегі салыстыруды тексеріп, содан кейін чек-парақты сақтаңыз');focusSection(document.getElementById('planner-comparison-heading'));}catch(e){actionStatus.textContent=e.message;}};
    document.getElementById('planner-save').onclick=async function(){if(this.disabled||stale||previewBusy||sourceCheckInProgress)return;const current=revision,originalLabel=this.textContent;this.disabled=true;this.setAttribute('aria-busy','true');this.textContent=t('Сохраняем план…','Жоспар сақталуда…');actionStatus.textContent=t('Сохраняем выбранные программы и шаги в вашем профиле…','Таңдалған бағдарламалар мен қадамдар профиліңізге сақталуда…');try{await api('/plans',{input:p.input,selectedIds:selected()});if(current===revision){this.textContent=t('План сохранён','Жоспар сақталды');setStep(4);actionStatus.innerHTML=`<strong>${t('План сохранён.','Жоспар сақталды.')}</strong> ${t('Теперь откройте личный чек-лист и отмечайте выполненные действия.','Енді жеке чек-парақты ашып, орындалған әрекеттерді белгілеңіз.')} <button type="button" class="btn btn-ghost" id="planner-open-saved">${t('Открыть мой чек-лист','Менің чек-парағымды ашу')}</button>`;focusSection(actionStatus);document.getElementById('planner-open-saved').onclick=()=>{window.navigate('profile');if(saved){saved.open=true;loadSaved();setTimeout(()=>focusSection(saved.querySelector('summary')),0);}}}}catch(e){if(current===revision){this.disabled=false;this.textContent=originalLabel;showFailure(actionStatus,e,()=>this.click());}}finally{this.removeAttribute('aria-busy');}};
    updateSelection();
  }
  form.onsubmit=async e=>{
    e.preventDefault();if(previewBusy)return;
    form.querySelectorAll('input,select').forEach(clearFieldError);
    form.elements.subject2.setCustomValidity(form.elements.subject1.value&&form.elements.subject1.value===form.elements.subject2.value?t('Выберите два разных профильных предмета.','Екі түрлі бейіндік пәнді таңдаңыз.'):'');
    const invalid=[...form.querySelectorAll('input,select')].filter(field=>!field.validity.valid);
    if(invalid.length){questionnaire.open=true;invalid.forEach(field=>fieldError(field,field.validationMessage));status.textContent=t('Проверьте отмеченные поля.','Белгіленген өрістерді тексеріңіз.');invalid[0].focus();return;}
    rememberSelection();invalidate();const current=revision,button=form.querySelector('[type=submit]');
    previewBusy=true;button.disabled=true;document.getElementById('planner-refresh').disabled=true;result.setAttribute('aria-busy','true');
    const hasPrevious=!!result.querySelector('#planner-results-heading');status.textContent=hasPrevious?t('Обновляем подбор. Ваш выбор сохранён…','Іріктеу жаңартылуда. Таңдауыңыз сақталды…'):t('Подбираем программы по вашей анкете…','Сауалнамаңыз бойынша бағдарламалар іріктелуде…');if(!hasPrevious)result.innerHTML=loadingMarkup(t('Проверяем программы и известные требования…','Бағдарламалар мен белгілі талаптар тексерілуде…'));
    try{
      const data=await api('/programme-preview',readForm());if(current!==revision)return;
      if(data.status==='needs_input'){
        if(result.querySelector('.planner-loading'))result.replaceChildren();questionnaire.open=true;status.textContent=data.questions.map(q=>q.text).join(' ');
        const field=form.elements.namedItem(data.missing[0]==='subjects'?'subject1':data.missing[0]);
        if(field){fieldError(field,status.textContent);field.focus();}return;
      }
      previewBusy=false;renderPlan(data);
      status.textContent=t('Подбор обновлён. Выберите программы для сравнения.','Іріктеу жаңартылды. Салыстыру үшін бағдарламаларды таңдаңыз.');
      focusSection(document.getElementById('planner-results-heading'));
    }catch(error){if(current===revision){if(result.querySelector('.planner-loading'))result.replaceChildren();showFailure(status,error,()=>{questionnaire.open=true;form.requestSubmit();},t('Не удалось обновить подбор. Анкета и выбор сохранены. ','Іріктеу жаңартылмады. Сауалнама мен таңдауыңыз сақталды. ')+error.message);}}
    finally{previewBusy=false;button.disabled=false;document.getElementById('planner-refresh').disabled=false;result.removeAttribute('aria-busy');}
  };
  const saved=document.getElementById('planner-saved'),savedList=document.getElementById('planner-saved-list');
  function updatePlanProgress(article){
    const boxes=[...article.querySelectorAll('[data-task]')],done=boxes.filter(box=>box.checked).length;
    article.querySelector('[data-plan-progress]').textContent=t(`Выполнено ${done} из ${boxes.length} шагов`,`Орындалды: ${done} / ${boxes.length}`);
    const next=boxes.find(box=>!box.checked);
    article.querySelector('[data-plan-next]').textContent=next
      ?t('Следующий шаг: ','Келесі қадам: ')+next.closest('label').textContent.trim()
      :boxes.length?t('Все шаги отмечены. Это не подтверждение подачи заявления или получения гранта.','Барлық қадам белгіленді. Бұл өтініш берілгенін немесе грант алынғанын растамайды.')
      :t('В этом плане нет шагов. Перепроверьте анкету, чтобы составить новый чек-лист.','Бұл жоспарда қадамдар жоқ. Жаңа чек-парақ жасау үшін сауалнаманы қайта тексеріңіз.');
  }
  async function loadSaved(){const current=++savedRevision;savedList.setAttribute('aria-busy','true');savedList.innerHTML=loadingMarkup(t('Загружаем сохранённые планы…','Сақталған жоспарлар жүктелуде…'));try{const data=await api('/plans');if(current!==savedRevision||!saved.open)return;savedList.innerHTML=data.plans.map(row=>`<article class="planner-saved" data-plan="${row.id}"><h3>${esc(row.plan.specialty)} · ${esc(row.created_at)}</h3><p>ЕНТ / ҰБТ ${esc(row.plan.input.ent)} · ${esc(row.plan.input.year||'')} · ${row.plan.input.funding==='grant'?t('только грант','тек грант'):row.plan.input.funding==='grant_plus_paid'?t('грант + платный резерв','грант + ақылы резерв'):money(row.plan.input.budget)}</p><ul>${row.plan.matches.map(m=>`<li>${esc(m.university||'')} ${esc(m.name)}</li>`).join('')}</ul><p>${t('Снимок, не подтверждение поступления. Перед подачей перепроверьте условия.','Көшірме, қабылдау растамасы емес. Өтініш алдында шарттарды қайта тексеріңіз.')}</p>${(row.plan.tasks||[]).map(task=>`<label class="planner-check"><input type="checkbox" data-task="${esc(task.id)}" ${task.done?'checked':''}>${esc(task.title)}</label>`).join('')}<button class="btn btn-ghost" data-delete="${row.id}">${t('Удалить план','Жоспарды жою')}</button>${row.plan.mode==='programmes'?`<button class="btn btn-ghost" data-restore="${row.id}">${t('Перепроверить анкету','Сауалнаманы қайта тексеру')}</button>`:''}</article>`).join('');if(!data.plans.length)feedback(savedList,t('Сохранённых планов пока нет. Заполните анкету, сравните программы и сохраните свой чек-лист.','Сақталған жоспарлар жоқ. Сауалнаманы толтырып, бағдарламаларды салыстырыңыз және чек-парағыңызды сақтаңыз.'),[[t('Составить план','Жоспар құру'),()=>window.navigate('planner')]]);
      for(const row of data.plans){
        const article=savedList.querySelector(`[data-plan="${row.id}"]`);
        const progress=document.createElement('section');progress.className='planner-plan-progress';
        progress.innerHTML='<h4 data-plan-progress></h4><p data-plan-next></p><p data-plan-status role="status"></p>';
        article.querySelector('h3').after(progress);
        updatePlanProgress(article);
        if(row.review){
          const notice=document.createElement('details');notice.className='planner-snapshot-review';
          const heading=document.createElement('summary');heading.textContent=t('Актуальность условий: раскрыть проверку','Шарттардың өзектілігі: тексеруді ашу');
          const explanation=document.createElement('p');explanation.textContent=t('По текущим данным каталога и последним статусам источников, без нового запроса к сайтам. Сохранённые шаги не изменены.','Каталогтың ағымдағы деректері және дереккөздердің соңғы күйлері бойынша, сайттарға жаңа сұраусыз. Сақталған қадамдар өзгерген жоқ.');
          notice.append(heading,explanation);
          if(!row.review.programmes.length){const warning=document.createElement('p');warning.textContent=t('Не удалось пересчитать: перепроверьте анкету.','Қайта есептеу мүмкін болмады: сауалнаманы тексеріңіз.');notice.append(warning);}
          for(const item of row.review.programmes){
            const entry=document.createElement('div');
            entry.innerHTML='<strong>'+esc(item.name)+'</strong><p class="planner-warning">'+(item.verification==='unavailable'?t('Программа больше не найдена в текущем каталоге.','Бағдарлама ағымдағы каталогта табылмады.'):assessment(item))+'</p>';
            if(item.blockers?.length){const reason=document.createElement('p');reason.textContent=t('Ограничения: ','Шектеулер: ')+item.blockers.map(key=>t(...(criterionLabels[key]||[key,key]))).join(', ');entry.append(reason);}
            if(item.cost&&row.plan.input.funding!=='grant')entry.insertAdjacentHTML('beforeend',costMarkup(item));
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
      savedList.querySelectorAll('[data-task]').forEach(box=>box.onchange=async()=>{
        const article=box.closest('[data-plan]'),message=article.querySelector('[data-plan-status]'),desired=box.checked;
        // Serialize updates within this plan so a shared status never hides an earlier failure.
        article.querySelectorAll('input,button').forEach(control=>control.disabled=true);
        message.textContent=t('Сохраняем отметку…','Белгі сақталуда…');
        try{
          await api('/plans/'+article.dataset.plan+'/tasks',{taskId:box.dataset.task,done:desired},'PATCH');
          if(current!==savedRevision||!article.isConnected)return;
          updatePlanProgress(article);message.textContent=t('Отметка сохранена.','Белгі сақталды.');
        }catch(e){
          if(current!==savedRevision||!article.isConnected)return;
          box.checked=!desired;updatePlanProgress(article);
          message.textContent=t('Отметка не сохранена. Попробуйте ещё раз. ','Белгі сақталмады. Қайта көріңіз. ')+e.message;
        }finally{if(article.isConnected)article.querySelectorAll('input,button').forEach(control=>control.disabled=false);}
      });
      savedList.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{if(button.disabled||!confirm(t('Удалить сохранённый план?','Сақталған жоспарды жою керек пе?')))return;const article=button.closest('[data-plan]'),message=article.querySelector('[data-plan-status]');article.querySelectorAll('input,button').forEach(control=>control.disabled=true);button.setAttribute('aria-busy','true');message.textContent=t('Удаляем план…','Жоспар жойылуда…');try{await api('/plans/'+button.dataset.delete,null,'DELETE');if(current===savedRevision&&saved.open)loadSaved();}catch(e){if(current===savedRevision&&article.isConnected)showFailure(message,e,()=>button.click());}finally{if(article.isConnected){article.querySelectorAll('input,button').forEach(control=>control.disabled=false);button.removeAttribute('aria-busy');}}});
      savedList.querySelectorAll('[data-restore]').forEach(button=>button.onclick=()=>{const row=data.plans.find(p=>String(p.id)===button.dataset.restore);fill({...row.plan.input,lang});window.navigate('planner');form.requestSubmit();});
    }catch(e){if(current===savedRevision&&saved.open)showFailure(savedList,e,loadSaved);}finally{if(current===savedRevision)savedList.removeAttribute('aria-busy');}}
  if(saved){saved.querySelector('summary').textContent=t('Мои планы поступления','Менің түсу жоспарларым');saved.addEventListener('toggle',()=>{if(saved.open)loadSaved();else{savedRevision++;savedList.innerHTML='';}});}
  const clearPrivate=()=>{revision++;savedRevision++;retainedSelection.clear();stale=false;document.getElementById('planner-stale').hidden=true;questionnaire.open=true;document.getElementById('planner-input-summary').textContent='';if(saved)saved.open=false;if(savedList)savedList.innerHTML='';form.reset();form.querySelectorAll('input,select').forEach(clearFieldError);form.elements.subject2.setCustomValidity('');syncFunding();result.innerHTML='';document.getElementById('planner-message').value='';status.textContent='';setStep(1);};
  window.addEventListener('edumatch-auth-changed',clearPrivate);
  window.addEventListener('storage',event=>{if(event.key==='edumatch_user')clearPrivate();});
})();
