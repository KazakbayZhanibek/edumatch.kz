const {programmes,sources,reviewedAt}=require('./planner-catalogue');
const fields=['ent','subjects','budget','group','year','funding','language'];
const subjects=['math','informatics','physics','chemistry','biology','geography','history','law','foreign_language'];
const labels={ent:['Сколько баллов ЕНТ у вас?','ҰБТ балыңыз қанша?'],subjects:['Какие два профильных предмета вы сдаёте?','Қандай екі бейіндік пән тапсырасыз?'],budget:['Какой бюджет на обучение за год, без проживания?','Тұру құнынсыз жылдық оқу бюджетіңіз қанша?'],group:['Выберите направление: IT или информационная безопасность.','Бағытты таңдаңыз: IT немесе ақпараттық қауіпсіздік.'],year:['В каком году планируете поступать?','Қай жылы оқуға түспексіз?'],funding:['Рассматриваете платное обучение или только грант?','Ақылы оқуды қарастырасыз ба, әлде тек грант па?'],language:['На каком языке хотите учиться?','Қай тілде оқығыңыз келеді?']};
const say=(lang,ru,kk)=>lang==='kk'?kk:ru;
function staleReview(value,now){
  const timestamp=Date.parse(value),age=now.getTime()-timestamp;
  return !Number.isFinite(timestamp)||age<0||age>30*86400000;
}
function validate(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {status:'invalid',error:'Некорректная анкета / Қате сауалнама'};
  const input=Object.fromEntries([...fields,'city','needDorm','lang'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
  input.mode='programmes';input.lang=raw.lang==='kk'?'kk':'ru';
  const present=k=>input[k]!==undefined&&input[k]!==null&&input[k]!=='';
  const bad=(present('ent')&&(!Number.isInteger(input.ent)||input.ent<0||input.ent>140))||
    (present('budget')&&(!Number.isFinite(input.budget)||input.budget<0||input.budget>100000000))||
    (present('year')&&(!Number.isInteger(input.year)||input.year<2026||input.year>2030))||
    (present('group')&&!['B057','B058','B059'].includes(input.group))||
    (present('subjects')&&(!Array.isArray(input.subjects)||input.subjects.length!==2||new Set(input.subjects).size!==2||!input.subjects.every(s=>subjects.includes(s))))||
    (present('funding')&&!['paid','grant','grant_plus_paid'].includes(input.funding))||
    (present('language')&&!['ru','kk','en','any'].includes(input.language))||
    (present('city')&&!['Алматы','Астана','any'].includes(input.city))||
    (present('needDorm')&&typeof input.needDorm!=='boolean');
  if(bad)return {status:'invalid',error:say(input.lang,'Проверьте значения: ЕНТ 0–140, два разных предмета, год 2026–2030 и неотрицательный бюджет.','Мәндерді тексеріңіз: ҰБТ 0–140, екі бөлек пән, 2026–2030 жыл және теріс емес бюджет.')};
  const missing=fields.filter(k=>!present(k)&&(k!=='budget'||input.funding!=='grant'));
  return {status:missing.length?'needs_input':'ready',input,missing,questions:missing.map(key=>({key,text:labels[key][input.lang==='kk'?1:0]}))};
}
function buildProgrammePlan(raw,now=new Date(),sourceStates={},catalogue=programmes) {
  const checked=validate(raw);if(checked.status!=='ready')return checked;
  const {input}=checked, t=(ru,kk)=>say(input.lang,ru,kk);
  const candidates=catalogue.filter(p=>p.group===input.group).map(p=>{
    const reasons=[],warnings=[],checks={};
    const programmeReviewedAt=p.reviewedAt||(programmes.includes(p)?reviewedAt:null);
    const stale=staleReview(programmeReviewedAt,now);
    const sourceAlerts=(p.sources||[]).map(source=>typeof source==='string'?sourceStates[source]:source).filter(s=>s&&(s.status==='unavailable'||s.status==='source_unavailable'||s.status==='needs_review'||s.status==='conflicting'||s.contentStatus==='review_needed'||s.changeStatus==='changed'||s.reviewRequired));
    const hasSources=(p.sources||[]).length>0&&(p.sources||[]).every(source=>typeof source==='string'?!!sources[source]:source?.status==='verified');
    const sourcesUsable=hasSources&&!sourceAlerts.length&&(!p.verificationStatus||p.verificationStatus==='verified');
    const check=(key,ok,pass,fail)=>{checks[key]=ok?'within':'outside';reasons.push(t(...(ok?pass:fail)));};
    if(sourcesUsable&&!stale&&p.requirementsYear===input.year&&Array.isArray(p.subjects)&&p.subjects.length===2&&new Set(p.subjects).size===2)check('subjects',p.subjects.every(s=>input.subjects.includes(s)),['Пара профильных предметов соответствует опубликованной.','Бейіндік пәндер жұбы жарияланған талапқа сәйкес.'],['Пара предметов не соответствует программе.','Пәндер жұбы бағдарламаға сәйкес емес.']);
    else {checks.subjects='unverified';warnings.push(t('Источник недоступен, изменился или ожидаемые сведения не найдены. Правила из снимка требуют ручной перепроверки.','Дереккөз қолжетімсіз, өзгерген немесе күтілген мәліметтер табылмады. Көшірмедегі талаптарды қолмен қайта тексеру қажет.'));}
    check('city',!input.city||input.city==='any'||input.city===p.city,['Город соответствует предпочтениям.','Қала қалауыңызға сәйкес.'],['Не соответствует выбранному городу.','Таңдалған қалаға сәйкес емес.']);
    const grantFocused=input.funding==='grant'||input.funding==='grant_plus_paid';
    const hasPaidBackup=input.funding==='paid'||input.funding==='grant_plus_paid';
    const usablePrice=Number.isFinite(p.tuition)&&p.tuition>=0&&p.tuitionYear===input.year&&!stale&&sourcesUsable;
    checks.budget=!hasPaidBackup?'not_requested':!usablePrice?'unverified':p.tuition<=input.budget?'within':'outside';
    if(checks.budget==='outside')reasons.push(t(`На первый курс не хватает ${p.tuition-input.budget} ₸ без проживания.`,`Бірінші курсқа тұру құнынсыз ${p.tuition-input.budget} ₸ жетпейді.`));
    else if(checks.budget==='within')reasons.push(t('Бюджет покрывает опубликованную стоимость первого курса (4-летняя форма).','Бюджет жарияланған бірінші курс құнын жабады (4 жылдық оқу).'));
    else if(hasPaidBackup)warnings.push(t('Стоимость платного резерва для выбранного года не подтверждена.','Таңдалған жылға ақылы резерв құны расталмаған.'));
    if(grantFocused)warnings.push(t('Грант не гарантирован. Конкурс, квоты и финансирование проверяются отдельно.','Грантқа кепілдік жоқ. Конкурс, квоталар мен қаржыландыру бөлек тексеріледі.'));
    checks.ent='unverified';
    if(p.requirementsYear===input.year&&!stale&&sourcesUsable){
      const threshold=input.funding==='grant'?p.grantMinEnt:p.minimumEnt;
      const label=input.funding==='grant'?'участие в конкурсе грантов':'платное поступление';
      if(p.conflict||!Number.isInteger(threshold)||threshold<0||threshold>140){
        warnings.push(t('Применимый минимум ЕНТ не подтверждён. Уточните его для выбранного типа финансирования.','Қолданылатын ҰБТ минимумы расталмаған. Таңдалған қаржыландыру түрі үшін нақтылаңыз.'));
        checks.ent='unverified';
      }else{
        check('ent',input.ent>=threshold,[`Минимум ЕНТ на ${label}: ${threshold}; ваш балл ${input.ent}. Это не полная проверка допуска.`,` ${label} үшін ең төменгі ҰБТ: ${threshold}; сіздің балыңыз ${input.ent}. Бұл толық рұқсат тексеруі емес.`],[`ЕНТ ${input.ent} ниже опубликованного минимума на ${label} ${threshold}.`,`ҰБТ ${input.ent} жарияланған ${label} үшін ${threshold} шегінен төмен.`]);
        if(input.funding==='grant_plus_paid'&&Number.isInteger(p.grantMinEnt)&&p.grantMinEnt>=0&&p.grantMinEnt<=140){
          if(input.ent>=p.grantMinEnt)reasons.push(t(`Балл не ниже известного минимума для участия в конкурсе грантов: ${p.grantMinEnt}. Это не проходной балл и не гарантия гранта.`,`Балл грант конкурсына қатысудың белгілі минимумынан төмен емес: ${p.grantMinEnt}. Бұл өту балы да, грант кепілдігі де емес.`));
          else warnings.push(t(`Для известного минимума участия в конкурсе грантов нужно ${p.grantMinEnt}; платный резерв проверяется отдельно.`,`Грант конкурсына қатысудың белгілі минимумы ${p.grantMinEnt}; ақылы резерв бөлек тексеріледі.`));
        }
      }
    }else warnings.push(t('Минимальный ЕНТ для этого набора не подтверждён.','Бұл қабылдауға ең төменгі ҰБТ балы расталмаған.'));
    if(p.conflict)warnings.push(t('В источниках есть противоречия. Уточните требования в приёмной комиссии.','Дереккөздерде қайшылықтар бар. Талаптарды қабылдау комиссиясынан нақтылаңыз.')+(p.conflictNote?' '+p.conflictNote:''));
    checks.entSections='unverified';checks.extraExam='unverified';
    checks.language=input.language==='any'?'not_requested':'unverified';
    checks.dorm=input.needDorm?'unverified':'not_requested';
    checks.funding=grantFocused?'unverified':'not_requested';
    warnings.push(t('Баллы по отдельным разделам ЕНТ и дополнительные условия требуют проверки.','ҰБТ бөлімдері бойынша балдар мен қосымша шарттарды тексеру қажет.'));
    if(input.language!=='any')warnings.push(t('Наличие группы на выбранном языке уточните в приёмной комиссии.','Таңдалған тілдегі топтың барын қабылдау комиссиясынан нақтылаңыз.'));
    if(input.needDorm)warnings.push(t('Место и стоимость общежития не подтверждены; проживание не включено в бюджет обучения.','Жатақхана орны мен құны расталмаған; тұру оқу бюджетіне кірмейді.'));
    const sameDeadlineYear=sourcesUsable&&!stale&&typeof p.deadline==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.deadline)&&Number.isFinite(Date.parse(p.deadline))&&new Date(p.deadline).toISOString().slice(0,10)===p.deadline&&Number(p.deadline.slice(0,4))===input.year;
    checks.deadline=sameDeadlineYear?(now.getTime()>Date.parse(p.deadline+'T23:59:59+05:00')?'outside':'within'):'unverified';
    if(checks.deadline==='outside')reasons.push(t(`Опубликованный срок приёма ${p.deadline} истёк. Уточните следующий набор.`,`Жарияланған қабылдау мерзімі ${p.deadline} аяқталды. Келесі қабылдауды нақтылаңыз.`));
    else if(sameDeadlineYear)warnings.push(t(`Опубликованный срок подачи: ${p.deadline}. Перепроверьте изменения.`,`Жарияланған өтініш мерзімі: ${p.deadline}. Өзгерістерді қайта тексеріңіз.`));
    else warnings.push(t('Дедлайн выбранного набора не подтверждён. Не переносите прошлогодние даты на новый год.','Таңдалған қабылдау мерзімі расталмаған. Өткен жылғы күндерді жаңа жылға қолданбаңыз.'));
    if(stale||input.year!==p.requirementsYear)warnings.push(t('Снимок источников нужно обновить для выбранного набора.','Таңдалған қабылдау үшін дереккөздер көшірмесін жаңарту қажет.'));
    // Funding alternatives are OR branches, not cumulative admission requirements.
    const thresholdStatus=value=>p.requirementsYear===input.year&&!stale&&sourcesUsable&&!p.conflict&&Number.isInteger(value)&&value>=0&&value<=140
      ?input.ent>=value?'within':'outside':'unverified';
    const paidEnt=thresholdStatus(p.minimumEnt),grantEnt=thresholdStatus(p.grantMinEnt);
    const paidStatus=paidEnt==='outside'||checks.budget==='outside'?'outside':paidEnt==='within'&&checks.budget==='within'?'within':'unverified';
    const fundingPaths={grant:{ent:grantEnt,status:grantEnt},paid:{ent:paidEnt,budget:checks.budget,status:paidStatus}};
    const combined=input.funding==='grant_plus_paid';
    const bothUnavailable=grantEnt==='outside'&&paidStatus==='outside';
    if(combined&&paidStatus==='outside'&&grantEnt!=='outside')warnings.push(t('Платный резерв не подходит, но грантовый вариант остаётся для проверки. Получение гранта не подтверждено.','Ақылы резерв сәйкес емес, бірақ грант нұсқасын тексеруге болады. Грант алу расталмаған.'));
    if(combined&&grantEnt==='outside'&&paidStatus!=='outside')warnings.push(t('Балл ниже известного грантового минимума; остаётся только платный резерв для проверки.','Балл белгілі грант минимумынан төмен; тек ақылы резервті тексеруге болады.'));
    const blockers=Object.keys(checks).filter(key=>checks[key]==='outside'&&(!combined||!['ent','budget'].includes(key)||bothUnavailable));
    const unverifiedCriteria=Object.keys(checks).filter(key=>checks[key]==='unverified');
    const verification=blockers.length?'blocked':unverifiedCriteria.length?'needs_review':'criteria_checked';
    const cost={requestedYear:input.year,amount:usablePrice?p.tuition:null,verifiedForRequestedYear:usablePrice,referenceAmount:p.tuition,referenceYear:p.tuitionYear};
    return {...p,checks,fundingPaths,reasons,warnings,verification,blockers,unverifiedCriteria,cost,sourceAlerts,sources:(p.sources||[]).map(source=>typeof source==='string'?sources[source]:source).filter(Boolean),budgetGap:usablePrice&&hasPaidBackup?Math.max(0,p.tuition-input.budget):null};
  });
  const matches=candidates.filter(p=>!p.blockers.length);
  const excluded=candidates.filter(p=>p.blockers.length);
  const catalogueReviewedAt=candidates.map(item=>item.reviewedAt).filter(Boolean).sort().at(-1)||reviewedAt;
  const catalogueStale=staleReview(catalogueReviewedAt,now);
  return {status:'ready',mode:'programmes',input,specialty:input.group,matches,excluded,createdAt:now.toISOString(),reviewedAt:catalogueReviewedAt,
    tools:[{name:'programme_search',count:candidates.length},{name:'requirements_check',count:candidates.length},{name:'budget_check',count:candidates.length},{name:'source_review',reviewedAt:catalogueReviewedAt,stale:catalogueStale}],
    summary:matches.length?t(`Вариантов для дальнейшей проверки: ${matches.length}. Полный допуск к поступлению не подтверждён.`,`Әрі қарай тексеруге арналған нұсқалар: ${matches.length}. Оқуға түсуге толық рұқсат расталмаған.`):t('Совпадений в проверенном наборе нет. Измените ограничения или обратитесь в приёмную комиссию; это не означает отсутствие вариантов по Казахстану.','Тексерілген жинақта сәйкестік жоқ. Шектеулерді өзгертіңіз немесе қабылдау комиссиясына хабарласыңыз; Қазақстанда басқа нұсқалар болуы мүмкін.'),
    tasks:makeTasks(input,matches)};
}
function makeTasks(input,matches) {
  const t=(ru,kk)=>say(input.lang,ru,kk), tasks=[];
  for(const p of matches){
    const add=(code,title)=>tasks.push({id:`${p.id}:${code}`,programmeId:p.id,title:`${p.university} · ${p.name}: ${title}`,done:false,dueDate:null,source:p.sources?.[0]?.url||null});
    add('requirements',t(`Подтвердить набор ${input.year}, порог ЕНТ и баллы по разделам; мой балл — ${input.ent}.`,`${input.year} қабылдауын, ҰБТ шегін және бөлім балдарын растау; менің балым — ${input.ent}.`));
    add('funding',input.funding==='grant'?t('Уточнить конкурс, квоты и другие доступные гранты.','Конкурсты, квоталарды және басқа қолжетімді гранттарды нақтылау.'):input.funding==='grant_plus_paid'?t(`Сначала проверить гранты; затем запросить платный резерв на весь срок в пределах ${input.budget} ₸ в год.`,`Алдымен гранттарды тексеру; кейін жылына ${input.budget} ₸ шегінде бүкіл оқу мерзіміне ақылы резерв сұрау.`):t(`Получить расчёт оплаты на весь срок; мой годовой бюджет — ${input.budget} ₸.`,`Барлық оқу мерзіміне төлем есебін алу; жылдық бюджетім — ${input.budget} ₸.`));
    add('exam',p.extraExam==='AET'?t('Уточнить и пройти AET, проверить освобождения.','AET шарттарын және босатылу мүмкіндігін нақтылап, тест тапсыру.'):t('Уточнить языковой экзамен и условия освобождения.','Тіл емтиханын және босатылу шарттарын нақтылау.'));
    if(input.needDorm)add('dorm',t('Запросить наличие мест и отдельную смету проживания.','Бос орындар мен тұру құнының бөлек есебін сұрау.'));
    add('documents',t('Проверить список документов и сроки; подать самостоятельно только после проверки.','Құжаттар тізімі мен мерзімдерін тексеру; тек тексергеннен кейін өзіңіз тапсыру.'));
  }
  return tasks;
}
module.exports={buildProgrammePlan,validate,makeTasks,subjects};
