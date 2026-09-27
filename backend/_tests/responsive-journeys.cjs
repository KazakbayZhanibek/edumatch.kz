// UI journeys against local read-only data. No real API writes or AI calls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const out=path.resolve(__dirname,'../../artifacts/responsive-after');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const reports=[];
 // Cache real read-only responses within this run, so breakpoint sweeps do not
 // flood the local server's production rate limiter with identical requests.
 const responses=new Map();
 try{for(const width of [320,360,390,512,768,1280,1440]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<800,isMobile:width<800,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=request.url();
   if(!url.startsWith('http://localhost:3000/'))return route.abort();
   if(!['GET','HEAD'].includes(request.method()))return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Войдите в аккаунт для этого действия.'})});
   if(!responses.has(url)){
    const response=await route.fetch();
    assert.notEqual(response.status(),429,`Local rate limiter reached: ${url}`);
    responses.set(url,{status:response.status(),headers:response.headers(),body:await response.body()});
   }
   await route.fulfill(responses.get(url));
  });
  await page.goto('http://localhost:3000/#home');
  await page.locator('.uni-card').first().waitFor();
  await page.locator('.hero-primary-btn').click();
  await page.waitForFunction(()=>state.currentPage==='planner');
  const back=await page.locator('#global-back-button').boundingBox();
  const shell=await page.locator('#page-planner .container').evaluate(el=>{const r=el.getBoundingClientRect();return r.x+parseFloat(getComputedStyle(el).paddingLeft)});
  assert.ok(Math.abs(back.x-shell)<2,`Back alignment ${width}: ${back.x}/${shell}`);
  await page.locator('#global-back-button').click();
  await page.waitForFunction(()=>state.currentPage==='home');
  await page.locator('.uni-card .btn-compare').first().click();
  await page.locator('#sticky-compare.visible').waitFor({state:'visible'});
  assert.equal(await page.locator('#sticky-compare-count').textContent(),'1');
  await page.locator('.uni-card .btn-compare').nth(1).click();
  await page.locator('#sticky-compare .btn-primary').click();
  await page.locator('.compare-table').waitFor();
  assert.equal(await page.locator('#sticky-compare').isVisible(),false);
  await page.locator('#burger').click();
  await page.waitForFunction(()=>document.querySelector('#mobile-menu').contains(document.activeElement));
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.querySelector('#mobile-menu').contains(document.activeElement)),true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('#burger'));
  await page.evaluate(()=>navigate('home'));
  if(width<1100){
   await page.locator('.filter-sheet-btn').click();
   const footer=await page.locator('#filter-sheet .sheet-footer').boundingBox();
   assert.ok(footer.y+footer.height<=901,`Sheet actions clipped ${width}`);
   await page.locator('#sheet-city').selectOption({index:1});
   await page.locator('#filter-sheet .btn-primary').click();
   await page.waitForFunction(()=>!document.querySelector('#filter-sheet').classList.contains('open'));
   await page.evaluate(()=>resetFilters());
  }
  await page.evaluate(()=>navigate('tips'));
  const tip=page.locator('.tip-card-header').first();
  await tip.focus();await page.keyboard.press('Enter');
  assert.equal(await tip.getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Space');assert.equal(await tip.getAttribute('aria-expanded'),'false');
  await page.locator('.footer-bottom-links [onclick*="modal-privacy"]').click();
  await page.locator('#modal-privacy.active').waitFor();
  assert.ok(await page.locator('#modal-privacy .modal-close').getAttribute('aria-label'));
  await page.keyboard.press('Escape');
  const rows=[];
  for(const route of ['home','planner','grants','compare','university','advisor','admission','career','tips','login','register','profile','map','404']){
   await page.evaluate(route=>navigate(route,route==='university'?1:undefined),route);
   if(route==='home')await page.locator('.uni-card').first().waitFor();
   if(route==='grants')await page.locator('.grant-catalog-card').first().waitFor();
   if(route==='university')await page.locator('#uni-detail-content h1').waitFor();
   if(route==='compare')await page.locator('.compare-table').waitFor();
   const m=await page.evaluate(()=>({route:state.currentPage,scroll:document.documentElement.scrollWidth,width:innerWidth,active:document.querySelectorAll('.page.active').length}));
   assert.ok(m.scroll<=m.width+1,`Overflow ${width} ${route}: ${m.scroll}`);assert.equal(m.active,1,`Route ${route} active`);
   if(route==='grants'&&width<=600){
    const tabs=await page.locator('.grant-tab-btn').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:innerWidth})));
    assert.ok(tabs.every(t=>t.x>=0&&t.right<=t.width+1),'All grant tabs reachable');
    await page.locator('[data-tab=myPlan]').click();
    await page.locator('[data-tab=grants]').click();await page.locator('.grant-catalog-card').first().waitFor();
   }
   if(route==='advisor'){
    assert.ok(await page.locator('.chat-send').getAttribute('aria-label'));
    await page.locator('#chat-input').fill('Проверка интерфейса без отправки');
    if(width<=512){await page.setViewportSize({width,height:460});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const r=await page.locator('.chat-send').boundingBox();assert.ok(r.y>=0&&r.y+r.height<=461,`Composer at keyboard height ${width}: ${JSON.stringify(r)}`);await page.setViewportSize({width,height:900});}
   }
   rows.push(m);
   if([360,1280].includes(width)&&['home','planner','grants','compare','university','advisor','tips','login'].includes(route))await page.screenshot({path:path.join(out,`${route}-${width}-light.png`),fullPage:false});
  }
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;navigate('home');},theme);
   await page.locator('.uni-card').first().waitFor();
   if([390,1440].includes(width))await page.screenshot({path:path.join(out,`home-${width}-${theme}.png`)});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  // Reflow at text zoom: real content must remain reachable, not clipped at fixed heights.
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';navigate('planner');});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Text zoom ${width}`);
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  if(width===390){
   await page.setViewportSize({width:844,height:390});
   await page.evaluate(()=>navigate('home'));
   await page.locator('.filter-sheet-btn').click();
   const footer=await page.locator('#filter-sheet .sheet-footer').boundingBox();
   assert.ok(footer.y>=0&&footer.y+footer.height<=391,'Landscape filter actions');
   await page.keyboard.press('Escape');
   await page.locator('.footer-bottom-links [onclick*="modal-privacy"]').click();
   await page.locator('#modal-privacy.active').waitFor();await page.keyboard.press('Escape');
   await page.evaluate(()=>navigate('advisor'));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const send=await page.locator('.chat-send').boundingBox();
   assert.ok(send.y>=0&&send.y+send.height<=391,'Landscape composer');
   await page.locator('#burger').click();
   await page.waitForFunction(()=>document.querySelector('#mobile-menu').contains(document.activeElement));
   await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[],`JS errors ${width}`);
  reports.push({width,routes:rows,errors});console.log(`PASS ${width}: real-data routes, comparison, back, menu, filters, tips, policy, composer, reflow`);
  await page.close();
 }
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
