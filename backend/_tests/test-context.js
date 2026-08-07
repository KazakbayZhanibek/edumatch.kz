const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, ...JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('=== CONTEXT-AWARE FOLLOW-UP TEST ===\n');

  // Test 1: Admission context
  console.log('--- Test 1: Admission context ---');
  let history = [];

  let r = await post('/api/ai/advice', { message: 'Мои шансы в КБТУ с ЕНТ 110', lang: 'ru' });
  console.log(`Q: "Мои шансы в КБТУ с ЕНТ 110" → Intent: ${r.intent}`);
  history.push({ role: 'user', content: 'Мои шансы в КБТУ с ЕНТ 110', intent: r.intent });
  history.push({ role: 'assistant', content: r.answer });
  await sleep(3000);

  r = await post('/api/ai/advice', { message: 'Какие требования к ЕНТ?', lang: 'ru', history });
  console.log(`Q: "Какие требования к ЕНТ?" → Intent: ${r.intent} (ожидается admission)`);
  history.push({ role: 'user', content: 'Какие требования к ЕНТ?', intent: r.intent });
  history.push({ role: 'assistant', content: r.answer });
  await sleep(3000);

  // Test 2: Language switch
  console.log('\n--- Test 2: Language switch ---');
  r = await post('/api/ai/advice', { message: 'Ты сможешь объяснить на казахском?', lang: 'ru', history });
  console.log(`Q: "на казахском" → Intent: ${r.intent}, detectedLang: ${r.detectedLang}`);
  await sleep(3000);

  // Test 3: City context
  console.log('\n--- Test 3: City context ---');
  history = [];
  r = await post('/api/ai/advice', { message: 'Какие вузы в Алматы?', lang: 'ru' });
  console.log(`Q: "Какие вузы в Алматы?" → Intent: ${r.intent}`);
  history.push({ role: 'user', content: 'Какие вузы в Алматы?', intent: r.intent });
  history.push({ role: 'assistant', content: r.answer });
  await sleep(3000);

  r = await post('/api/ai/advice', { message: 'Покажи с общежитием', lang: 'ru', history });
  console.log(`Q: "Покажи с общежитием" → Intent: ${r.intent} (ожидается city)`);
  await sleep(3000);

  // Test 4: Recommendation context
  console.log('\n--- Test 4: Recommendation context ---');
  history = [];
  r = await post('/api/ai/advice', { message: 'Какие вузы на IT?', lang: 'ru' });
  console.log(`Q: "Какие вузы на IT?" → Intent: ${r.intent}`);
  history.push({ role: 'user', content: 'Какие вузы на IT?', intent: r.intent });
  history.push({ role: 'assistant', content: r.answer });
  await sleep(3000);

  r = await post('/api/ai/advice', { message: 'А в Астане?', lang: 'ru', history });
  console.log(`Q: "А в Астане?" → Intent: ${r.intent} (ожидается recommendation)`);
  await sleep(3000);

  // Test 5: EN comparison
  console.log('\n--- Test 5: EN comparison ---');
  r = await post('/api/ai/advice', { message: 'Compare KBTU and KazNU', lang: 'en' });
  console.log(`Q: "Compare KBTU and KazNU" → Intent: ${r.intent}, ${r.answer.length} chars`);
  const hasEnglish = /[a-z]/.test(r.answer);
  console.log(`Response in English: ${hasEnglish}`);

  console.log('\n=== DONE ===');
})().catch(e => console.error(e));
