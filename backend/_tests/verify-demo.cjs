const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../artifacts/planner-full-demo.webm')).href);
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const size=await page.locator('video').evaluate(async video=>{video.pause();await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=12;});return {width:video.videoWidth,height:video.videoHeight,time:video.currentTime};});
  assert.equal(size.width,1280);assert.equal(size.height,860);assert.equal(size.time,12);
  await page.screenshot({path:path.join(os.tmpdir(),'planner-video-check.png')});
  console.log('PASS video decode and seek: '+JSON.stringify(size));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
