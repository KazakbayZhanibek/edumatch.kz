const http = require('http');

const BASE_URL = 'http://localhost:3000';

const TESTS = [
  // KAZAKH TESTS
  { lang: 'kk', message: 'Сәлеметсіз бе',          expected: 'greeting' },
  { lang: 'kk', message: 'Көмек',                   expected: 'help' },
  { lang: 'kk', message: 'КБТУ-да оқу қанша тұрады?', expected: 'uni_info' },
  { lang: 'kk', message: 'Менің ЕНТ 110, КБТУ-ге түсу мүмкіндігім', expected: 'admission' },
  { lang: 'kk', message: 'Алматыдағы университеттер',  expected: 'city' },
  { lang: 'kk', message: 'IT бойынша гранттар',       expected: 'grant' },
  { lang: 'kk', message: 'Программист мамандығы',     expected: 'profession' },
  { lang: 'kk', message: 'КБТУ мен КазНУ-ды салыстыр', expected: 'comparison' },
  // ENGLISH TESTS
  { lang: 'en', message: 'Hello',                    expected: 'greeting' },
  { lang: 'en', message: 'Help',                     expected: 'help' },
  { lang: 'en', message: 'How much does KBTU cost?', expected: 'uni_info' },
  { lang: 'en', message: 'My chances at KBTU with ENT 110', expected: 'admission' },
  { lang: 'en', message: 'What universities are in Almaty?', expected: 'city' },
  { lang: 'en', message: 'IT grants',                expected: 'grant' },
  { lang: 'en', message: 'Want to become a programmer', expected: 'profession' },
  { lang: 'en', message: 'Compare KBTU and KazNU',   expected: 'comparison' },
];

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('  AI CHAT INTENT CLASSIFICATION TEST');
  console.log('  Target: http://localhost:3000/api/ai/advice');
  console.log('='.repeat(80));
  console.log('');
  console.log('  Waiting 70s for rate limit to fully reset...');
  await sleep(70000);
  console.log('  Rate limit cleared. Starting tests.\n');

  let passKK = 0, failKK = 0, passEN = 0, failEN = 0;
  const results = [];

  for (let i = 0; i < TESTS.length; i++) {
    const t = TESTS[i];
    const label = `[${t.lang.toUpperCase()}] "${t.message}"`;

    try {
      const res = await postJSON('/api/ai/advice', {
        message: t.message,
        lang: t.lang,
      });

      if (!res.success) {
        const status = 'FAIL';
        if (t.lang === 'kk') failKK++; else failEN++;
        results.push({ ...t, actual: res.error || 'error', status });
        console.log(`  ${status}  ${label}  =>  error: ${res.error}`);
      } else {
        const actual = res.intent || 'general';
        const ok = actual === t.expected;
        const status = ok ? ' OK ' : 'FAIL';
        if (t.lang === 'kk') { ok ? passKK++ : failKK++; } else { ok ? passEN++ : failEN++; }
        results.push({ ...t, actual, status });
        console.log(`  ${status}  ${label}  =>  intent="${actual}"${ok ? '' : ` (expected="${t.expected}")`}`);
      }
    } catch (err) {
      const status = 'FAIL';
      if (t.lang === 'kk') failKK++; else failEN++;
      results.push({ ...t, actual: 'CONNECTION ERROR', status });
      console.log(`  ${status}  ${label}  =>  ${err.message}`);
    }

    if (i < TESTS.length - 1) {
      // Pause 65s between KK and EN sections to reset rate limit window
      if (i === 7) {
        console.log('\n  ... waiting 65s for rate limit to reset ...\n');
        await sleep(65000);
      } else {
        await sleep(500);
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Kazakh (kk):  ${passKK} OK / ${failKK} FAIL / ${passKK + failKK} total`);
  console.log(`  English (en): ${passEN} OK / ${failEN} FAIL / ${passEN + failEN} total`);
  console.log(`  TOTAL:        ${passKK + passEN} OK / ${failKK + failEN} FAIL / ${results.length} total`);
  console.log('='.repeat(80));

  // Print detailed table
  console.log('');
  console.log('  DETAILED RESULTS TABLE');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Lang'.padEnd(5)} | ${'Message'.padEnd(40)} | ${'Expected'.padEnd(12)} | ${'Actual'.padEnd(12)} | Result`);
  console.log('  ' + '-'.repeat(76));
  for (const r of results) {
    const msg = r.message.length > 38 ? r.message.slice(0, 35) + '...' : r.message;
    console.log(`  ${r.lang.padEnd(5)} | ${msg.padEnd(40)} | ${r.expected.padEnd(12)} | ${r.actual.padEnd(12)} | ${r.status}`);
  }
  console.log('  ' + '-'.repeat(76));
  console.log('');

  process.exit(failKK + failEN > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
