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
    'психолог с ЕНТ 80',
    'ENT 74 psychology',
    'Менеджер ЕНТ 100',
  ];

  for (const t of tests) {
    console.log(`\n=== "${t}" ===`);
    try {
      const r = await testAI(t);
      console.log('Intent:', r.intent);
      console.log('Answer:', (r.answer || '').slice(0, 500));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
