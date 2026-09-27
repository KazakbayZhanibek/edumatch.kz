// Full public shell, isolated fixtures. Never starts the application or opens SQLite.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../frontend');
const universities=[1,2,3].map(id=>({id,name:'Тестовый университет '+id,short_name:'Вуз '+id,city_name:'Алматы',price_from:1200000,price_to:1500000,languages:['ru','en'],specialties:[],description:'Описание учебных программ. Условия поступления необходимо проверять по официальным источникам.',website:'https://example.org',qs_world:null}));
const grant={id:1,name:'Учебный грант — тестовая запись',type:'university',verification_status:'needs_review',coverage_type:'full',academic_year:'2026–2027',requirements:[],documents:[],programme_codes:[],source_url:'https://example.org'};
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!filename.startsWith(root+path.sep)&&filename!==root)throw Error('path');const file=filename===root?path.join(root,'index.html'):filename;const body=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of process.env.UI_WIDTH?[Number(process.env.UI_WIDTH)]:[390,512,1280]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    let data={},status=200;
    if(url.pathname==='/api/universities'||url.pathname==='/api/compare')data=universities;
    else if(/^\/api\/universities\/\d+$/.test(url.pathname))data=universities[0];
    else if(url.pathname==='/api/cities')data=[{id:1,name:'Алматы'}];
    else if(url.pathname==='/api/specialties'||url.pathname.endsWith('/reviews'))data=[];
    else if(url.pathname.includes('/grants/catalog'))data={grants:[grant],total:1};
    else if(url.pathname.includes('/grants/saved'))data={grants:[]};
    else if(url.pathname.includes('/planner/plans'))data={plans:[]};
    else if(url.pathname.includes('/auth/')||url.pathname.includes('/save')){status=401;data={error:'Войдите в аккаунт для этого действия.'};}
    else if(url.pathname==='/api/admin/academic-year')data={year:'2026-2027'};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/#planner');
   await page.waitForFunction(()=>window.state?.currentPage==='planner');
   assert.equal(await page.locator('#page-planner').isVisible(),true,'Deep link');
   await page.locator('#global-back-button').click();
   await page.locator('.uni-card').first().waitFor();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.uni-card')).opacity==='1');
   assert.equal(await page.evaluate(()=>state.currentPage),'home');
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const target of ['home','planner','grants','compare','university','career','advisor','admission','tips','login','register','map']){
     await page.evaluate(target=>{if(target==='compare')state.compareList=[1,2];navigate(target,target==='university'?1:null);},target);
     if(target==='grants')await page.locator('.grant-catalog-card').waitFor();
     if(target==='home')await page.locator('.uni-card').first().waitFor();
     if(target==='university')await page.locator('#uni-detail-content h1').waitFor();
     if(target==='map')await page.locator('#map-container [role=status]').waitFor();
     const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(overflow.scroll<=overflow.width+1,target+' '+width+' '+JSON.stringify(overflow));
     if(target==='advisor'){
      await page.locator('#chat-input').focus();
      assert.equal(await page.locator('#chat-input').evaluate(el=>getComputedStyle(el).outlineStyle),'none','No square focus outline');
      assert.equal(await page.locator('.chat-input-wrap').evaluate(el=>getComputedStyle(el).outlineStyle),'solid','Visible composer focus');
     }
     if(process.env.CAPTURE_UI==='1'&&['home','advisor'].includes(target))await page.screenshot({path:path.resolve(__dirname,'../../artifacts/site-'+target+'-'+width+'-'+theme+'.png'),fullPage:target==='home'});
    }
   }
   await page.evaluate(()=>navigate('career'));
   await page.locator('.career-option').first().click();
   const question=await page.locator('#career-progress-text').textContent();
   await page.evaluate(()=>{navigate('home');navigate('career');});
   assert.equal(await page.locator('#career-progress-text').textContent(),question,'Preserve career progress');
   await page.locator('.career-back').click();
   assert.equal(await page.evaluate(()=>careerState.current),0);
   assert.equal(await page.evaluate(()=>Object.keys(careerState.scores).length),0);
   await page.locator('#burger').click();
   assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.querySelector('#mobile-menu').contains(document.activeElement)),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
   assert.equal(await page.locator('#burger').evaluate(el=>el===document.activeElement),true);
   await page.evaluate(()=>navigate('grants'));
   await page.locator('[role=tab][aria-selected=true]').focus();
   await page.keyboard.press('ArrowLeft');
   assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab'),'universities');
   await page.locator('[data-tab=grants]').click();
   await page.locator('[data-grant-save]').click();
   assert.match(await page.locator('#page-grants .site-inline-status').textContent(),/Войдите/);
   await page.evaluate(()=>navigate('home'));
   await page.locator('#search-input').fill('Нет такого университета');
   await page.waitForFunction(()=>state.universities.length===0);
   await page.evaluate(()=>resetFilters());
   await page.locator('.uni-card').first().waitFor();
   for(const language of ['kk','en','ru']){
    await Promise.all([page.waitForEvent('load'),page.evaluate(language=>setLanguage(language),language)]);
    await page.waitForFunction(language=>window.currentLanguage===language,language);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Language overflow: '+language);
   }
   await page.evaluate(()=>navigate('profile'));
   assert.equal(await page.locator('#profile-content .auth-prompt-actions button').count(),2,'Guest profile offers login and registration');
   // A failed catalogue request can be retried without reloading the application.
   await page.route('**/api/universities?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.evaluate(()=>{state.universities=[];navigate('home');});
   await page.locator('#uni-grid button').waitFor();
   assert.equal(await page.locator('#uni-grid').getAttribute('aria-busy'),null);
   await page.unroute('**/api/universities?**');
   await page.locator('#uni-grid button').click();
   await page.locator('.uni-card').first().waitFor();
   assert.deepEqual(errors,[]);
   console.log('PASS '+width+': 12 routes × 2 themes, deep link, menu, grant tabs/save error, search, career progress');
   await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
