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

const tests = [
  { msg: 'Қазақстандағы IT мамандықтары туралы айтыңызшы', lang: 'kk', expect: 'recommendation', label: 'KK IT мамандықтары → recommendation' },
  { msg: 'Какие вузы есть в Шымкенте? Сколько их там и какие специальности?', expect: 'city', label: 'Шымкент: подробный ответ' },
  { msg: 'Сколько стоит обучение в МУИТ?', expect: 'uni_info', label: 'Uni info: МУИТ подробный' },
  { msg: 'What universities are in Astana?', lang: 'en', expect: 'city', label: 'EN: universities in Astana' },
  { msg: 'Compare KBTU and KazNU', lang: 'en', expect: 'comparison', label: 'EN: comparison short' },
];

(async () => {
  console.log('=== FOCUSED AI QUALITY TEST ===\n');
  let passed = 0, failed = 0;

  for (const t of tests) {
    process.stdout.write(`\n--- ${t.label} ---\n`);
    try {
      await sleep(4000);
      const r = await post('/api/ai/advice', { message: t.msg, lang: t.lang || 'ru' });
      const answer = r.answer || r.data?.answer || r.raw || 'NO ANSWER';
      const intent = r.intent || r.data?.intent || 'N/A';

      console.log(`Status: ${r.status} | Intent: ${intent}`);
      console.log(`A (${answer.length} chars):`);
      console.log(answer.substring(0, 800));
      if (answer.length > 800) console.log(`... [+${answer.length - 800}]`);

      const issues = [];
      if (r.status === 429) issues.push('RATE LIMITED');
      if (answer.length < 30) issues.push('TOO SHORT');
      if (intent !== t.expect && r.status !== 429) issues.push(`WRONG INTENT (expected ${t.expect})`);

      if (!issues.length) { console.log('✅ PASS'); passed++; }
      else { console.log(`❌ FAIL: ${issues.join(', ')}`); failed++; }
    } catch (e) {
      console.log(`❌ ERROR: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n\n=== ИТОГО: ${passed} OK / ${failed} FAIL / ${tests.length} total ===`);
})().catch(e => console.error(e));
