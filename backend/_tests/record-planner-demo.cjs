// Prerecorded full core workflow. Only use isolated preview-fixture.js.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),frames=[];
  const shot=async title=>frames.push({title,data:'data:image/png;base64,'+(await page.screenshot()).toString('base64')});
  await page.goto('http://127.0.0.1:3037',{waitUntil:'networkidle'});
  await page.evaluate(()=>Auth.login('student@fixture.test','DemoPassword123!'));
  await page.evaluate(()=>navigate('advisor'));
  await page.locator('#planner-panel > summary').click();
  await page.locator('#planner-form [name=ent]').fill('110');
  await page.locator('#planner-form [name=budget]').fill('2000000');
  for(const [name,value] of Object.entries({subject1:'math',subject2:'informatics',group:'B057',year:'2027',funding:'paid',language:'any'}))await page.locator(`#planner-form [name=${name}]`).selectOption(value);
  await page.locator('#planner-form').scrollIntoViewIfNeeded();await shot('1. Подтверждаем анкету: ЕНТ, предметы, бюджет и год');
  await page.locator('#planner-form [type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('planner-status').textContent.includes('Проверка завершена'));
  await page.locator('#planner-status').scrollIntoViewIfNeeded();await shot('2. Структурированные правила проверяют ограничения и источники');
  await page.locator('.planner-options input[value="iitu-cs"]').check();
  await page.locator('#planner-compare').click();
  await page.locator('#planner-comparison').scrollIntoViewIfNeeded();await shot('3. Сравнение и план: неизвестные условия явно отмечены');
  await page.locator('#planner-save').click();
  await page.waitForFunction(()=>document.getElementById('planner-status').textContent.includes('Сохранено'));
  await page.evaluate(()=>navigate('profile'));
  await page.locator('#planner-saved > summary').click();
  await page.locator('[data-task]').first().check();
  await page.waitForFunction(()=>!document.querySelector('[data-task]').disabled);
  await page.locator('.planner-saved').first().scrollIntoViewIfNeeded();await shot('4. План сохранён в профиль; отмечаем выполненный шаг');
  await page.locator('[data-restore]').first().click();
  await page.locator('.planner-options input[value="iitu-cs"]').waitFor();
  await page.locator('#planner-form [name=subject1]').selectOption('biology');
  await page.locator('#planner-form [name=subject2]').selectOption('chemistry');
  await page.locator('#planner-form [type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('planner-result').textContent.includes('Совпадений'));
  await page.locator('#planner-result').scrollIntoViewIfNeeded();await shot('5. Биология + химия для IT: подходящих программ в пилоте нет');
  await page.locator('#planner-form [name=subject1]').selectOption('math');
  await page.locator('#planner-form [name=subject2]').selectOption('informatics');
  await page.locator('#planner-form [name=year]').selectOption('2026');
  await page.locator('#planner-form [name=budget]').fill('50000');
  await page.locator('#planner-form [name=city]').selectOption('Алматы');
  await page.locator('#planner-form [type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('planner-result').textContent.includes('не хватает'));
  await page.locator('#planner-result > details > summary').click();
  await page.locator('#planner-result > details .planner-option').last().scrollIntoViewIfNeeded();await shot('6. Исторический набор 2026: не хватает бюджета, срок истёк');
  const encoder=await browser.newPage();
  const bytes=await encoder.evaluate(async frames=>{
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=860;
   const ctx=canvas.getContext('2d'),stream=canvas.captureStream(10),chunks=[];
   const mime='video/webm;codecs=vp8';if(!MediaRecorder.isTypeSupported(mime))throw Error('WebM encoder unavailable');
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1500000});
   const finished=new Promise(resolve=>{recorder.onstop=resolve;});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
   for(const frame of frames){const img=new Image();img.src=frame.data;await img.decode();ctx.fillStyle='#173c31';ctx.fillRect(0,0,1280,860);ctx.fillStyle='white';ctx.font='20px sans-serif';ctx.fillText(frame.title,20,26);ctx.font='14px sans-serif';ctx.fillText('Полный основной сценарий • вымышленные данные • серверные правила без внешней модели • не результаты исследования',20,49);ctx.drawImage(img,0,60);await new Promise(resolve=>setTimeout(resolve,4500));}
   recorder.stop();await finished;stream.getTracks().forEach(track=>track.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
  },frames);
  const output=path.resolve(__dirname,'../../artifacts/planner-full-demo.webm');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.from(bytes));
  console.log('Generated full workflow demo: '+output+' ('+bytes.length+' bytes)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
