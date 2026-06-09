const http = require('http');

function testAI(message, lang = 'ru') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message, history: [], lang });
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai/advice',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ error: body.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function run() {
  const tests = [
    { msg: 'хочу стать психологом', expect: 'profession' },
    { msg: 'врач зарплата', expect: 'profession' },
    { msg: 'ент сдал на 74', expect: 'admission' },
    { msg: 'у меня бюджет 1.2 млн тг/год, интересует IT', expect: 'recommendation' },
  ];

  for (const t of tests) {
    console.log(`\n=== "${t.msg}" ===`);
    try {
      const r = await testAI(t.msg);
      console.log('Intent:', r.intent, r.intent === t.expect ? '✓' : `✗ (expected ${t.expect})`);
      console.log('Answer:', (r.answer || '').slice(0, 300));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
