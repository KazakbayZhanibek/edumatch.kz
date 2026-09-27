// Isolated browser test: mocked API, no application database or accounts.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<div id="planner-assistant"></div><details id="planner-saved"><summary>Plans</summary><div id="planner-saved-list"></div></details>');
  await page.evaluate(()=>{
   window.currentLanguage='ru';window.navigate=()=>{};
   window.fetch=async(url,options)=>{
    if(url.endsWith('/programme-preview')){if(window.failPreview)throw Error('offline');return {ok:true,json:async()=>({status:'ready',input:JSON.parse(options.body),summary:'Test',excluded:[],tasks:[],matches:(window.onlySecond?[2]:[1,2]).map(id=>({id:String(id),name:'Programme '+id,university:'University',city:'City',grantMinEnt:id===1?75:null,minimumEnt:50,requirementsYear:2026,language:id===1?['en']:[],extraExam:id===1?'AET':null,deadline:id===1?'2026-08-25':null,checks:{ent:'unverified',deadline:'unverified'},reasons:[],warnings:[],sources:[],unverifiedCriteria:['ent','funding']}))})};}
    if(url.endsWith('/plans')&&options.method==='POST'){await new Promise(resolve=>window.finishSave=resolve);return {ok:true,json:async()=>({id:1})};}
    return {ok:true,json:async()=>({plans:[]})};
   };
  });
  await page.addStyleTag({path:path.resolve(__dirname,'../../frontend/css/main.css')});
  await page.addStyleTag({path:path.resolve(__dirname,'../../frontend/css/planner.css')});
  await page.addScriptTag({path:path.resolve(__dirname,'../../frontend/js/planner.js')});
  const step=()=>page.locator('[aria-current="step"]').getAttribute('data-step');
  assert.equal(await step(),'1');
  assert.equal(await page.locator('.planner-ai-help').getAttribute('open'),null);
  assert.equal(await page.locator('.planner-required:visible').count(),7);
  await page.screenshot({path:path.resolve(__dirname,`../../artifacts/planner-entry-${width}.png`),fullPage:true});
  await page.locator('[name=ent]').fill('89');
  for(const [name,value] of Object.entries({subject1:'math',subject2:'informatics',group:'B057',year:'2027',language:'any'}))await page.locator(`[name=${name}]`).selectOption(value);
  await page.locator('[type=submit]').click();
  await page.locator('[data-programme-select]').first().waitFor();
  assert.equal(await step(),'2');
  assert.equal(await page.locator('#planner-results-heading').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('#planner-questionnaire').getAttribute('open'),null);
  await page.locator('[data-programme-select]').first().check();
  await page.locator('#planner-compare').click();assert.equal(await step(),'3');
  assert.equal(await page.locator('#planner-comparison-heading').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('.planner-options').isVisible(),false);
  const comparison=page.locator('.planner-comparison-table');
  assert.match(await comparison.textContent(),/75 · 2026/);
  assert.match(await comparison.textContent(),/Справочно/);
  assert.match(await comparison.textContent(),/Английский/);
  assert.match(await comparison.textContent(),/AET/);
  assert.doesNotMatch(await comparison.textContent(),/Стоимость платного|Минимум платного/);
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth&&!el.closest('.planner-table')).map(el=>el.tagName+'.'+el.className)}));
  assert.ok(await comparison.evaluate(el=>el.clientWidth<=innerWidth&&getComputedStyle(el).overflowX==='auto'),JSON.stringify(overflow));
  await page.locator('#planner-save').click();
  await page.waitForFunction(()=>!!window.finishSave);
  await page.locator('#planner-change-selection').click();
  await page.locator('[data-programme-select]').last().check();assert.equal(await step(),'2');
  await page.evaluate(()=>window.finishSave());
  assert.equal(await step(),'2');
  await page.locator('#planner-compare').click();
  assert.match(await comparison.textContent(),/Не подтверждено для выбранного набора/);
  assert.equal(await comparison.locator('thead th').count(),3);
  await comparison.screenshot({path:path.resolve(__dirname,`../../artifacts/planner-comparison-${width}.png`)});
  await page.evaluate(()=>{window.finishSave=null;});
  await page.locator('#planner-save').click();await page.waitForFunction(()=>!!window.finishSave);
  await page.evaluate(()=>window.finishSave());
  await page.locator('[data-step="4"][aria-current="step"]').waitFor();
  // Editing must retain the shortlist, disable stale actions and survive failed refresh.
  await page.locator('#planner-questionnaire > summary').click();
  await page.locator('[name=ent]').fill('90');
  assert.equal(await step(),'1');
  assert.equal(await page.locator('[data-programme-select]:checked').count(),2);
  assert.equal(await page.locator('#planner-stale').isVisible(),true);
  assert.equal(await page.locator('#planner-save').isDisabled(),true);
  await page.evaluate(()=>{window.failPreview=true;});
  await page.locator('#planner-refresh').click();
  await page.waitForFunction(()=>document.querySelector('#planner-status').textContent.includes('Не удалось обновить'));
  assert.equal(await page.locator('[data-programme-select]:checked').count(),2);
  await page.evaluate(()=>{window.failPreview=false;window.onlySecond=true;});
  await page.locator('#planner-refresh').click();
  await page.waitForFunction(()=>document.querySelector('[aria-current="step"]').dataset.step==='2');
  assert.equal(await page.locator('[data-programme-select]:checked').count(),1);
  assert.match(await page.locator('#planner-retained').textContent(),/Больше нет в результатах: Programme 1/);
  await page.locator('#planner-questionnaire > summary').click();
  await page.locator('[name=subject2]').selectOption('math');
  await page.locator('[type=submit]').click();
  assert.match(await page.locator('#planner-error-subject2').textContent(),/два разных/);
  // Dark theme uses dark foreground on the bright accent; no invisible active numbers.
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.planner-steps .is-active b')).color==='rgb(17, 17, 16)');
  assert.equal(await page.locator('.planner-steps .is-active b').evaluate(el=>getComputedStyle(el).color),'rgb(17, 17, 16)');
  await page.evaluate(()=>window.dispatchEvent(new Event('edumatch-auth-changed')));
  assert.equal(await step(),'1');assert.equal(await page.locator('#planner-result').textContent(),'');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: selection, comparison, stale save, successful save, logout`);
  await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
