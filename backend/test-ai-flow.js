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
        try {
          const r = JSON.parse(body);
          resolve(r);
        } catch (e) {
          resolve({ error: body.slice(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('timeout 90s')); });
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Test 1: profession');
  try {
    const r = await testAI('хочу стать психологом');
    console.log('Intent:', r.intent);
    console.log('Answer:', (r.answer || '').slice(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\nTest 2: admission');
  try {
    const r = await testAI('ент сдал на 74');
    console.log('Intent:', r.intent);
    console.log('Answer:', (r.answer || '').slice(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

run().catch(console.error);
