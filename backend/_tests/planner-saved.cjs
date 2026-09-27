// Isolated UI checks; mock persistence, no real accounts or database writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="planner-assistant"></div><details id="planner-saved"><summary>Plans</summary><div id="planner-saved-list"></div></details>');
  await page.evaluate(()=>{
   window.currentLanguage='ru';window.navigate=()=>{};
   window.plan={specialty:'B057',mode:'programmes',input:{ent:89,year:2027,funding:'grant'},matches:[{name:'Информационные системы',university:'Тестовый университет',sources:[]}],tasks:[{id:'one',title:'Уточнить требования конкурса',done:false},{id:'two',title:'Проверить документы',done:false}]};
   window.fetch=async(url,options={})=>{
    if(options.method==='PATCH'){
     if(window.failUpdate)return {ok:false,status:503,json:async()=>({error:'Сервис недоступен'})};
     const body=JSON.parse(options.body);window.plan.tasks.find(t=>t.id===body.taskId).done=body.done;
     return {ok:true,json:async()=>({})};
    }
    return {ok:true,json:async()=>({plans:[{id:1,created_at:'2026-09-27',plan:structuredClone(window.plan),review:{programmes:[]}}]})};
   };
  });
  for(const name of ['main','planner'])await page.addStyleTag({path:path.resolve(__dirname,`../../frontend/css/${name}.css`)});
  await page.addScriptTag({path:path.resolve(__dirname,'../../frontend/js/planner.js')});
  const summary=page.locator('#planner-saved > summary');
  await summary.click();
  const progress=page.locator('[data-plan-progress]'),next=page.locator('[data-plan-next]'),status=page.locator('[data-plan-status]');
  await page.getByText('Выполнено 0 из 2 шагов',{exact:true}).waitFor();
  assert.match(await next.textContent(),/Уточнить требования/);
  assert.equal(await page.locator('.planner-snapshot-review').getAttribute('open'),null);
  await page.locator('[data-task="one"]').check();
  await page.getByText('Отметка сохранена.',{exact:true}).waitFor();
  assert.match(await progress.textContent(),/1 из 2/);assert.match(await next.textContent(),/Проверить документы/);
  await summary.click();await page.locator('[data-plan]').waitFor({state:'detached'});await summary.click();
  await page.getByText('Выполнено 1 из 2 шагов',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-task="one"]').isChecked(),true);
  await page.evaluate(()=>window.failUpdate=true);
  await page.locator('[data-task="two"]').click();
  await page.getByText(/Отметка не сохранена/).waitFor();
  assert.equal(await page.locator('[data-task="two"]').isChecked(),false);
  assert.match(await progress.textContent(),/1 из 2/);
  await page.evaluate(()=>window.failUpdate=false);await page.locator('[data-task="two"]').check();
  await page.getByText('Отметка сохранена.',{exact:true}).waitFor();
  assert.match(await next.textContent(),/Все шаги отмечены/);
  await page.locator('[data-plan]').screenshot({path:path.resolve(__dirname,`../../artifacts/planner-saved-${width}.png`)});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: progress, reopen, failed update rollback, retry, completion`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
