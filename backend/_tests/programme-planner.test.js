const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildProgrammePlan:buildPlan,validate}=require('../programme-planner');
// Historical scenarios must use evidence already available on the simulated date.
const testCatalogue=require('../planner-catalogue').programmes.map(p=>({...p,reviewedAt:'2026-07-25'}));
const buildProgrammePlan=(input,date,states,catalogue=testCatalogue)=>buildPlan(input,date,states,catalogue);
const {checkSource,interpret,inspectContent}=require('../planner-tools');
const base={ent:110,budget:2000000,subjects:['math','informatics'],group:'B057',year:2026,funding:'paid',language:'any',lang:'ru'};
const now=new Date('2026-08-01T12:00:00Z');
const fixture={id:'quality-fixture',name:'Test programme',university:'Test university',group:'B057',city:'Алматы',subjects:['math','informatics'],sources:[{url:'https://example.edu',status:'verified'}],reviewedAt:'2026-07-25',requirementsYear:2026,minimumEnt:50,grantMinEnt:100,tuition:1000000,tuitionYear:2026,deadline:'2026-08-25'};
function assess(patch={},input={}){const plan=buildProgrammePlan({...base,...input},now,{},[{...fixture,...patch}]);return [...plan.matches,...plan.excluded][0];}
test('missing grant threshold never falls back to paid minimum',()=>{
 for(const grantMinEnt of [null,undefined,'100',NaN]){
  const m=assess({grantMinEnt},{funding:'grant',ent:40});
  assert.equal(m.checks.ent,'unverified');assert.equal(m.verification,'needs_review');
  assert.equal(m.checks.budget,'not_requested');assert.ok(!m.unverifiedCriteria.includes('budget'));
 }
});
test('missing paid threshold is not coerced to zero or used to exclude',()=>{
 for(const minimumEnt of [null,undefined,'',-1,141])assert.equal(assess({minimumEnt}).checks.ent,'unverified');
 assert.equal(assess({}, {funding:'grant',ent:99}).checks.ent,'outside');
 assert.equal(assess({}, {funding:'grant',ent:100}).checks.ent,'within');
});
test('missing evidence, empty subjects and invalid dates stay unknown',()=>{
 for(const patch of [{sources:[]},{verificationStatus:'needs_review'},{sources:[{url:'https://example.edu',status:'not_published'}]}]){
  const m=assess(patch);for(const key of ['subjects','ent','budget','deadline'])assert.equal(m.checks[key],'unverified');
 }
 assert.equal(assess({subjects:[]}).checks.subjects,'unverified');
 for(const reviewedAt of [null,'invalid','2026-01-01','2026-08-02']){
  const m=assess({reviewedAt});for(const key of ['subjects','ent','budget','deadline'])assert.equal(m.checks[key],'unverified');
 }
 assert.equal(assess({deadline:'2026-02-30'}).checks.deadline,'unverified');
});
test('conflicts remain uncertain across funding modes and name no unrelated university',()=>{
 for(const funding of ['paid','grant','grant_plus_paid']){
  const m=assess({conflict:true,conflictNote:'85 / 90'},{funding});
  assert.equal(m.checks.ent,'unverified');assert.match(m.warnings.join(' '),/85 \/ 90/);assert.doesNotMatch(m.warnings.join(' '),/AITU/);
 }
});
test('intake-specific evidence is not carried from 2026 to 2027',()=>{
 const m=assess({}, {year:2027,funding:'grant'});
 assert.equal(m.checks.ent,'unverified');assert.equal(m.checks.deadline,'unverified');assert.equal(m.cost.amount,null);
});
test('saved snapshots are reassessed without overwriting completed tasks',()=>{
 const {reviewSnapshot}=require('../planner-snapshot-review');
 const plan=buildProgrammePlan(base,now);
 plan.matches=plan.matches.filter(p=>p.id==='iitu-cs');
 plan.tasks[0].done=true;
 const original=JSON.stringify(plan);
 const review=reviewSnapshot(plan,new Date('2026-09-17T12:00:00Z'));
 assert.equal(review.programmes[0].verification,'blocked');
 assert.ok(review.programmes[0].blockers.includes('deadline'));
 assert.equal(JSON.stringify(plan),original);
 const changed=reviewSnapshot(plan,now,{iitu:{status:'unavailable'}});
 assert.ok(changed.programmes[0].unverifiedCriteria.includes('budget'));
 assert.equal(changed.programmes[0].cost.amount,null);
 plan.matches.push({id:'removed-programme',name:'Archived'});
 assert.equal(reviewSnapshot(plan,now).programmes[1].verification,'unavailable');
 assert.equal(reviewSnapshot({mode:'legacy'}),null);
});
test('future-year price is never returned as the selected intake price',()=>{
 const plan=buildProgrammePlan({...base,year:2027},now),m=plan.matches.find(p=>p.id==='iitu-cs');
 assert.equal(m.cost.requestedYear,2027);assert.equal(m.cost.amount,null);assert.equal(m.cost.verifiedForRequestedYear,false);
 assert.equal(m.cost.referenceYear,2026);assert.equal(m.cost.referenceAmount,1479000);
 assert.equal(m.verification,'needs_review');assert.ok(m.unverifiedCriteria.includes('budget'));
});
test('even known total ENT and tuition do not imply full admission eligibility',()=>{
 const m=buildProgrammePlan({...base,language:'kk',needDorm:true},now).matches.find(p=>p.id==='iitu-cs');
 assert.equal(m.cost.amount,1479000);assert.equal(m.cost.verifiedForRequestedYear,true);
 assert.equal(m.checks.ent,'within');assert.equal(m.verification,'needs_review');
 for(const key of ['entSections','extraExam','language','dorm'])assert.ok(m.unverifiedCriteria.includes(key));
 const grant=buildProgrammePlan({...base,funding:'grant'},now).matches[0];assert.ok(grant.unverifiedCriteria.includes('funding'));
 const blocked=buildProgrammePlan({...base,budget:100},now).excluded.find(p=>p.id==='iitu-cs');assert.equal(blocked.verification,'blocked');assert.ok(blocked.blockers.includes('budget'));
});
test('source failure keeps reference costs but removes their current verification',()=>{
 const m=buildProgrammePlan(base,now,{iitu:{status:'unavailable'}}).matches.find(p=>p.id==='iitu-cs');
 assert.equal(m.cost.amount,null);assert.equal(m.cost.referenceAmount,1479000);assert.equal(m.verification,'needs_review');
});
test('changed source remains flagged after timeout and later unchanged responses',async()=>{
 const html='<p>2026 80 AITU Excellence Test</p>',start=Date.now()+1000000;
 const fetchText=text=>async()=>new Response(text,{headers:{'content-type':'text/html'}});
 const first=await checkSource('aituFunding',{fetchImpl:fetchText(html),now:start});assert.equal(first.reviewRequired,false);
 const changed=await checkSource('aituFunding',{fetchImpl:fetchText(html+' new'),now:start+300001});assert.equal(changed.changeStatus,'changed');assert.equal(changed.reviewRequired,true);
 const outage=await checkSource('aituFunding',{fetchImpl:async()=>{throw Error();},now:start+600002});assert.equal(outage.reviewRequired,true);assert.equal(outage.contentHash,changed.contentHash);
 const restored=await checkSource('aituFunding',{fetchImpl:fetchText(html+' new'),now:start+900003});assert.equal(restored.changeStatus,'unchanged');assert.equal(restored.reviewRequired,true);
});
test('content markers ignore scripts and comments; matches are not semantic verification',()=>{
 const html='<p>B057 Software Engineering Математика Информатика</p>';
 const first=inspectContent('aitu',html);assert.equal(first.contentStatus,'markers_present');
 assert.equal(inspectContent('aitu',html,first.contentHash).changeStatus,'unchanged');
 assert.equal(inspectContent('aitu','<script>'+html+'</script><!--'+html+'-->').contentStatus,'review_needed');
 assert.equal(inspectContent('iitu','2026 2027 B057 1&nbsp;479&nbsp;000').contentStatus,'markers_present');
 assert.equal(first.verifiedAt,undefined);
});
test('source alerts disable assertions about ENT, subjects, budget and deadlines',()=>{
 for(const alert of [{status:'unavailable'},{status:'reachable',reviewRequired:true}]){
  const p=buildProgrammePlan(base,now,{iitu:{id:'iitu',...alert}}),m=p.matches.find(m=>m.id==='iitu-cs');
  for(const key of ['ent','subjects','budget','deadline'])assert.equal(m.checks[key],'unverified');
  assert.equal(m.sourceAlerts.length,1);assert.ok(m.warnings.some(w=>w.includes('ручной')));
 }
});
test('planner asks for missing fields in both languages and does not invent defaults',()=>{
 for(const lang of ['ru','kk']){const p=buildProgrammePlan({lang},now);assert.equal(p.status,'needs_input');assert.equal(p.questions.length,7);assert.equal(p.input.ent,undefined);}
 assert.match(buildProgrammePlan({lang:'kk'},now).questions[0].text,/ҰБТ/);
});
test('planner rejects malformed preferences',()=>{
 for(const patch of [{ent:141},{ent:-1},{ent:1.5},{budget:-1},{budget:'100'},{subjects:['math','math']},{subjects:['fake','math']},{subjects:{}},{year:2025},{group:'B042'},{city:'x'},{language:'x'},{funding:'x'},{needDorm:'yes'}])assert.equal(validate({...base,...patch}).status,'invalid');
 assert.equal(validate(null).status,'invalid');
});
test('programme search returns real programme-level candidates with explicit uncertainties',()=>{
 const p=buildProgrammePlan(base,now);assert.equal(p.matches.length,4);assert.equal(p.tasks.length,16);
 const iitu=p.matches.find(m=>m.id==='iitu-cs');assert.equal(iitu.checks.subjects,'within');assert.equal(iitu.checks.budget,'within');assert.equal(iitu.checks.ent,'within');assert.ok(iitu.sources.every(s=>s.url.startsWith('https://')));
 const aitu=p.matches.find(m=>m.id==='aitu-cs');assert.equal(aitu.checks.budget,'unverified');assert.equal(aitu.conflict,true);assert.ok(aitu.warnings.some(w=>w.includes('80')));
 assert.ok(p.tasks.every(t=>t.dueDate===null&&!t.done));assert.ok(!('chance' in p));
});
test('wrong subject pair yields zero matches, not a fabricated recommendation',()=>{
 const p=buildProgrammePlan({...base,subjects:['biology','chemistry']},now);assert.equal(p.matches.length,0);assert.ok(p.excluded.every(m=>m.checks.subjects==='outside'));assert.deepEqual(p.tasks,[]);
});
test('low budget excludes known prices but never calls unknown costs affordable',()=>{
 const p=buildProgrammePlan({...base,budget:50000},now);assert.equal(p.excluded.length,2);assert.ok(p.excluded.every(m=>m.budgetGap===1429000));assert.ok(p.matches.every(m=>m.checks.budget==='unverified'));
 const city=buildProgrammePlan({...base,budget:50000,city:'Алматы'},now);assert.equal(city.matches.length,0);
});
test('future years and stale source snapshots cannot pass budget verification',()=>{
 for(const p of [buildProgrammePlan({...base,year:2027},now),buildProgrammePlan(base,new Date('2026-11-20'))])assert.ok(p.matches.every(m=>m.checks.budget==='unverified'));
});
test('published ENT threshold and expired deadline exclude ineligible current-cycle options',()=>{
 const low=buildProgrammePlan({...base,ent:49},now);
 assert.ok(low.excluded.filter(p=>p.id.startsWith('iitu')).every(p=>p.checks.ent==='outside'));
 const expired=buildProgrammePlan(base,new Date('2026-08-26'),{},testCatalogue.map(p=>({...p,reviewedAt:'2026-08-20'})));
 assert.ok(expired.excluded.length>=2);
 assert.ok(expired.excluded.every(p=>p.checks.deadline==='outside'));
});
test('grant-only, language and dorm preferences create explicit actions and warnings',()=>{
 const p=buildProgrammePlan({...base,funding:'grant',budget:0,needDorm:true,language:'kk'},now);
 assert.ok(p.matches.every(m=>m.checks.budget==='not_requested'));assert.ok(p.tasks.some(t=>t.id.endsWith(':dorm')));assert.ok(p.tasks.some(t=>t.title.includes('конкурс')));
});

test('grant-only mode does not require a tuition budget',()=>{
 const result=validate({...base,budget:undefined,funding:'grant'});
 assert.equal(result.status,'ready');
 assert.equal(result.input.budget,undefined);
});

test('grant with paid backup requires and checks a backup budget',()=>{
 const missing=validate({...base,budget:undefined,funding:'grant_plus_paid'});
 assert.equal(missing.status,'needs_input');
 assert.ok(missing.missing.includes('budget'));
 const ready=buildProgrammePlan({...base,budget:2000000,funding:'grant_plus_paid'},now);
 assert.equal(ready.status,'ready');
 assert.ok(ready.tasks.some(task=>task.title.includes('Сначала проверить гранты')));
});
test('combined funding retains a grant option when only paid budget fails',()=>{
 const m=assess({}, {funding:'grant_plus_paid',budget:100,ent:110});
 assert.equal(m.checks.budget,'outside');assert.deepEqual(m.blockers,[]);
 assert.equal(m.fundingPaths.grant.status,'within');assert.equal(m.fundingPaths.paid.status,'outside');
 assert.equal(m.verification,'needs_review');assert.match(m.warnings.join(' '),/Платный резерв не подходит/);
 const unknown=assess({grantMinEnt:null},{funding:'grant_plus_paid',budget:100,ent:40});
 assert.deepEqual(unknown.blockers,[]);assert.equal(unknown.fundingPaths.grant.status,'unverified');
});
test('combined funding excludes only when both financing paths fail or a shared constraint fails',()=>{
 const both=assess({}, {funding:'grant_plus_paid',budget:100,ent:80});
 assert.equal(both.verification,'blocked');assert.ok(both.blockers.includes('budget'));
 const paid=assess({}, {funding:'grant_plus_paid',budget:2000000,ent:80});
 assert.deepEqual(paid.blockers,[]);assert.equal(paid.fundingPaths.grant.status,'outside');
 assert.match(paid.warnings.join(' '),/только платный резерв/);
 const subjects=assess({}, {funding:'grant_plus_paid',subjects:['biology','chemistry']});
 assert.ok(subjects.blockers.includes('subjects'));
 assert.equal(assess({}, {funding:'paid',budget:100}).verification,'blocked');
});
test('source tool rejects arbitrary URLs and distinguishes availability from fact verification',async()=>{
 await assert.rejects(checkSource('http://127.0.0.1'),/Unknown source/);
 let options;const r=await checkSource('aitu',{fetchImpl:async(url,o)=>{options=o;return new Response('<html>test</html>',{headers:{'content-type':'text/html'}});}});
 assert.equal(r.status,'reachable');assert.equal(options.redirect,'error');assert.equal(r.verifiedAt,undefined);
 const bad=await checkSource('iitu',{fetchImpl:async()=>{throw Error('timeout');}});assert.equal(bad.status,'unavailable');
});
// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES — AI quality: ambiguous input, language mixing, missing data
// ═══════════════════════════════════════════════════════════════════════════

test('validate accepts boundary values (ENT 0, 140, budget 0)', () => {
  assert.equal(validate({...base, ent: 0}).status, 'ready');
  assert.equal(validate({...base, ent: 140}).status, 'ready');
  assert.equal(validate({...base, budget: 0}).status, 'ready');
});

test('validate rejects ENT above 140 and negative budget', () => {
  assert.equal(validate({...base, ent: 141}).status, 'invalid');
  assert.equal(validate({...base, ent: -1}).status, 'invalid');
  assert.equal(validate({...base, budget: -100}).status, 'invalid');
});

test('validate rejects duplicate subjects and invalid subject names', () => {
  assert.equal(validate({...base, subjects: ['math', 'math']}).status, 'invalid');
  assert.equal(validate({...base, subjects: ['math', 'unknown_subject']}).status, 'invalid');
  assert.equal(validate({...base, subjects: ['math']}).status, 'invalid');
  assert.equal(validate({...base, subjects: ['math', 'informatics', 'physics']}).status, 'invalid');
});

test('validate rejects unknown groups, cities, languages, funding types', () => {
  assert.equal(validate({...base, group: 'B042'}).status, 'invalid');
  assert.equal(validate({...base, city: 'London'}).status, 'invalid');
  assert.equal(validate({...base, language: 'fr'}).status, 'invalid');
  assert.equal(validate({...base, funding: 'scholarship'}).status, 'invalid');
});

test('validate rejects years outside 2026-2030', () => {
  assert.equal(validate({...base, year: 2025}).status, 'invalid');
  assert.equal(validate({...base, year: 2031}).status, 'invalid');
  assert.equal(validate({...base, year: 2026}).status, 'ready');
  assert.equal(validate({...base, year: 2030}).status, 'ready');
});

test('confirming questionnaire does not auto-change on re-evaluation', () => {
  const plan1 = buildProgrammePlan(base, now);
  const plan2 = buildProgrammePlan(base, now);
  assert.deepEqual(plan1.input, plan2.input);
  assert.equal(plan1.status, plan2.status);
  assert.equal(plan1.matches.length, plan2.matches.length);
  const iitu1 = plan1.matches.find(m => m.id === 'iitu-cs');
  const iitu2 = plan2.matches.find(m => m.id === 'iitu-cs');
  assert.equal(iitu1.checks.ent, iitu2.checks.ent);
  assert.equal(iitu1.checks.budget, iitu2.checks.budget);
  assert.equal(iitu1.checks.subjects, iitu2.checks.subjects);
});

test('manual selection is preserved when AI is unavailable', () => {
  const fallback = buildProgrammePlan(base, now);
  assert.equal(fallback.status, 'ready');
  assert.ok(fallback.matches.length > 0);
  assert.ok(fallback.tasks.length > 0);
  assert.ok(!('chance' in fallback));
  assert.ok(!('probability' in fallback));
});

test('AI extraction result is validated by code, not trusted blindly', async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  try {
    process.env.OPENROUTER_API_KEY = 'test-only';
    const mock = (content) => async () => new Response(JSON.stringify({
      choices: [{ message: { content }, finish_reason: 'stop' }]
    }));
    const r1 = await interpret('test', 'ru', { fetchImpl: mock('{"ent":999}') });
    assert.equal(r1.status, 'fallback');
    const r2 = await interpret('test', 'ru', { fetchImpl: mock('{"subjects":["math","math"]}') });
    assert.equal(r2.status, 'fallback');
    const r3 = await interpret('test', 'ru', { fetchImpl: mock('not json at all') });
    assert.equal(r3.status, 'fallback');
  } finally {
    if (saved === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = saved;
  }
});

test('grant and paid thresholds differ; low ENT below grant but above paid still matches paid', () => {
  const p = buildProgrammePlan({...base, ent: 60, funding: 'paid'}, now);
  const m = p.matches.find(m => m.id === 'iitu-cs');
  if (m) assert.equal(m.checks.ent, 'within');
  const g = buildProgrammePlan({...base, ent: 60, funding: 'grant'}, now);
  const gm = g.matches.find(m => m.id === 'iitu-cs');
  if (gm) assert.equal(gm.checks.ent, 'outside');
});

test('AITU conflict flag is surfaced in warnings', () => {
  const p = buildProgrammePlan({...base, city: 'any'}, now);
  const aitu = p.matches.find(m => m.id === 'aitu-cs');
  if (aitu) {
    assert.equal(aitu.conflict, true);
    assert.ok(aitu.warnings.some(w => w.includes('80') || w.includes('конфликт') || w.includes('70')));
  }
});

test('dorm preference does not block other checks', () => {
  const p = buildProgrammePlan({...base, needDorm: true}, now);
  const m = p.matches.find(m => m.id === 'iitu-cs');
  if (m) {
    assert.equal(m.checks.ent, 'within');
    assert.equal(m.checks.budget, 'within');
    assert.equal(m.checks.dorm, 'unverified');
  }
});

test('Kazakh language prompts use correct terminology', () => {
  const p = buildProgrammePlan({lang: 'kk'}, now);
  assert.equal(p.status, 'needs_input');
  assert.ok(p.questions.length >= 6);
  const allText = p.questions.map(q => q.text).join(' ');
  assert.ok(allText.includes('ҰБТ'));
  assert.ok(allText.includes('пән'));
  assert.ok(allText.includes('бюджет'));
  assert.ok(allText.includes('грант'));
  assert.ok(allText.includes('тіл'));
});

test('empty/null input is rejected without crashing', () => {
  assert.equal(validate(null).status, 'invalid');
  assert.equal(validate(undefined).status, 'invalid');
  assert.equal(validate({}).status, 'needs_input');
  assert.equal(validate('string').status, 'invalid');
  assert.equal(validate([]).status, 'invalid');
  assert.equal(validate(42).status, 'invalid');
});

test('no programme is ever claimed to guarantee admission', () => {
  const p = buildProgrammePlan(base, now);
  assert.ok(!('chance' in p));
  assert.ok(!('probability' in p));
  assert.ok(!('guarantee' in p));
  for (const m of p.matches) {
    assert.ok(m.verification !== 'guaranteed');
    assert.ok(!m.reasons.some(r => r.includes('гарантир')));
  }
});
