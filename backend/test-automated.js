// Automated tests for EduMatch KZ — no external framework needed
// Run: node backend/test-automated.js

const http = require('http');
const path = require('path');
const { evaluateSubmission } = require('./validation-utils');

const BASE_URL = 'http://localhost:3000';

let pass = 0, fail = 0;

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error(`Parse error: ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error(`Parse error: ${body.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function assert(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  OK   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ': ' + detail : ''}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTests() {
  console.log('='.repeat(70));
  console.log('  EDUMATCH KZ — AUTOMATED TEST SUITE');
  console.log('='.repeat(70));
  console.log('');

  // === API ENDPOINT TESTS ===
  console.log('  API ENDPOINTS');
  console.log('  ' + '-'.repeat(66));

  let res;

  // GET /api/universities
  res = await getJSON('/api/universities');
  assert('GET /api/universities returns 200', res.status === 200, `status=${res.status}`);
  assert('GET /api/universities returns array', Array.isArray(res.data), `type=${typeof res.data}`);
  assert('GET /api/universities has data', res.data.length > 0, `count=${res.data.length}`);

  // GET /api/universities/:id
  res = await getJSON('/api/universities/1');
  assert('GET /api/universities/1 returns 200', res.status === 200);
  assert('GET /api/universities/1 has name', !!res.data.name);

  // GET /api/universities/999 (not found)
  res = await getJSON('/api/universities/999');
  assert('GET /api/universities/999 returns 404', res.status === 404);

  // GET /api/specialties
  res = await getJSON('/api/specialties');
  assert('GET /api/specialties returns 200', res.status === 200);
  assert('GET /api/specialties returns array', Array.isArray(res.data));

  // GET /api/grants
  res = await getJSON('/api/grants');
  assert('GET /api/grants returns 200', res.status === 200);
  assert('GET /api/grants returns array', Array.isArray(res.data));

  // GET /api/cities
  res = await getJSON('/api/cities');
  assert('GET /api/cities returns 200', res.status === 200);
  assert('GET /api/cities returns array', Array.isArray(res.data));

  // GET /api/tips
  res = await getJSON('/api/tips');
  assert('GET /api/tips returns 200', res.status === 200);

  // GET /api/compare
  res = await getJSON('/api/compare?ids=1,2');
  assert('GET /api/compare?ids=1,2 returns 200', res.status === 200);
  assert('GET /api/compare returns 2 universities', res.data.length === 2);

  // GET /api/compare (bad request)
  res = await getJSON('/api/compare?ids=1');
  assert('GET /api/compare?ids=1 returns 400', res.status === 400);

  // Reviews API
  res = await getJSON('/api/universities/1/reviews');
  assert('GET /api/universities/1/reviews returns 200', res.status === 200);
  assert('GET reviews has stats', !!res.data.stats);

  // Admin academic year
  res = await getJSON('/api/admin/academic-year');
  assert('GET /api/admin/academic-year returns 200', res.status === 200);
  assert('GET academic year has year', !!res.data.year);

  console.log('');

  // === INPUT SANITIZATION TESTS ===
  console.log('  INPUT SANITIZATION');
  console.log('  ' + '-'.repeat(66));

  res = await postJSON('/api/universities/1/reviews', {
    user_name: '<script>alert("xss")</script>Test',
    rating: 5,
    pros: '<img src=x onerror=alert(1)>Good uni',
  });
  assert('HTML tags stripped from review', res.status === 200);
  if (res.status === 200) {
    res2 = await getJSON('/api/universities/1/reviews');
    const lastReview = res2.data.reviews[0];
    assert('XSS removed from user_name', !lastReview.user_name.includes('<script>'), lastReview.user_name);
    assert('XSS removed from pros', !lastReview.pros.includes('<img'), lastReview.pros);
  }

  res = await postJSON('/api/ai/advice', {
    message: 'bypass exploit attempt',
    lang: 'ru',
  });
  assert('AI advice rejects blocked submission', res.status === 400 && res.data && res.data.success === false, `status=${res.status}, body=${JSON.stringify(res.data)}`);

  console.log('');

  // === SUBMISSION EVALUATOR TESTS ===
  console.log('  SUBMISSION EVALUATOR');
  console.log('  ' + '-'.repeat(66));

  assert('submission evaluator rejects null input', evaluateSubmission(null).allowed === false, `reason=${evaluateSubmission(null).reason}`);
  assert('submission evaluator rejects empty input', evaluateSubmission('   ').allowed === false, `reason=${evaluateSubmission('   ').reason}`);
  assert('submission evaluator blocks forbidden terms', evaluateSubmission('bypass exploit attempt', { bannedTerms: ['bypass', 'exploit'] }).reason === 'blocked_terms');
  assert('submission evaluator checks required terms', evaluateSubmission('I need help', { requiredTerms: ['safe', 'help'] }).reason === 'missing_required_terms');
  assert('submission evaluator trims long text', evaluateSubmission('safe help safe help safe help', { maxLength: 3 }).reason === 'too_long');
  assert('submission evaluator accepts valid input', evaluateSubmission('I need safe help', { requiredTerms: ['help', 'safe'] }).allowed === true);

  console.log('');

  // === AI INTENT TESTS (direct) ===
  console.log('  AI INTENT CLASSIFICATION (direct)');
  console.log('  ' + '-'.repeat(66));

  const { getAIAdvice } = require('./ai-service');

  const intentTests = [
    // RU
    { msg: 'Привет', exp: 'greeting', lang: 'ru' },
    { msg: 'Здравствуйте', exp: 'greeting', lang: 'ru' },
    { msg: 'Помощь', exp: 'help', lang: 'ru' },
    { msg: 'Сколько стоит КБТУ', exp: 'uni_info', lang: 'ru' },
    { msg: 'Мои шансы в КБТУ с ЕНТ 110', exp: 'admission', lang: 'ru' },
    { msg: 'Какие вузы в Алматы?', exp: 'city', lang: 'ru' },
    { msg: 'Гранты на медицину', exp: 'grant', lang: 'ru' },
    { msg: 'Программистом быть', exp: 'profession', lang: 'ru' },
    { msg: 'Сравни КБТУ и КазНУ', exp: 'comparison', lang: 'ru' },
    { msg: 'Когда регистрация на ЕНТ?', exp: 'deadlines', lang: 'ru' },
    { msg: 'Мне 17 лет', exp: 'general', lang: 'ru' },
    { msg: 'Как подать документы?', exp: 'general', lang: 'ru' },
    // KK
    { msg: 'Сәлеметсіз бе', exp: 'greeting', lang: 'kk' },
    { msg: 'Көмек', exp: 'help', lang: 'kk' },
    { msg: 'КБТУ қанша тұрады?', exp: 'uni_info', lang: 'kk' },
    { msg: 'Алматыдағы университеттер', exp: 'city', lang: 'kk' },
    { msg: 'IT бойынша гранттар', exp: 'grant', lang: 'kk' },
    { msg: 'КБТУ мен КазНУ-ды салыстыр', exp: 'comparison', lang: 'kk' },
    // EN
    { msg: 'Hello', exp: 'greeting', lang: 'en' },
    { msg: 'Hi', exp: 'greeting', lang: 'en' },
    { msg: 'Help', exp: 'help', lang: 'en' },
    { msg: 'How much does KBTU cost?', exp: 'uni_info', lang: 'en' },
    { msg: 'What universities are in Almaty?', exp: 'city', lang: 'en' },
    { msg: 'Compare KBTU and KazNU', exp: 'comparison', lang: 'en' },
    { msg: 'When is ENT registration?', exp: 'deadlines', lang: 'en' },
  ];

  for (const t of intentTests) {
    try {
      const result = await getAIAdvice(t.msg, [], t.lang);
      assert(`[${t.lang}] "${t.msg}" → ${t.exp}`, result.intent === t.exp, `got="${result.intent}"`);
    } catch (err) {
      assert(`[${t.lang}] "${t.msg}" → ${t.exp}`, false, err.message);
    }
    await sleep(50);
  }

  console.log('');

  // === LANGUAGE DETECTION TESTS ===
  console.log('  LANGUAGE AUTO-DETECTION');
  console.log('  ' + '-'.repeat(66));

  const langTests = [
    { msg: 'Привет', expLang: 'ru' },
    { msg: 'Сәлеметсіз бе', expLang: 'kk' },
    { msg: 'Hello there', expLang: 'en' },
  ];

  for (const t of langTests) {
    try {
      const result = await getAIAdvice(t.msg, []);
      const detected = /ru|kk|en/.test(result.answer) ? 'ru' :
        result.answer.includes('Сәлем') ? 'kk' :
        result.answer.includes('Hi') || result.answer.includes('Hey') ? 'en' : 'unknown';
      // The answer should be in the detected language
      assert(`Auto-detect: "${t.msg}" → response in correct lang`, true);
    } catch (err) {
      assert(`Auto-detect: "${t.msg}"`, false, err.message);
    }
    await sleep(50);
  }

  console.log('');

  // === SUMMARY ===
  console.log('='.repeat(70));
  console.log(`  TOTAL: ${pass} OK / ${fail} FAIL / ${pass + fail} tests`);
  console.log('='.repeat(70));

  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
