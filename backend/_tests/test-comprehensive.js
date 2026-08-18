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
  // Простые вопросы
  { msg: 'Привет', label: 'Greeting' },
  { msg: 'Помощь', label: 'Help' },
  { msg: 'Какая средняя зарплата?', label: 'Salary overview' },
  { msg: 'Какие вузы?', label: 'Какие вузы (без фильтра)' },
  { msg: 'Какие гранты?', label: 'Grants overview' },
  { msg: 'Когда регистрация на ЕНТ?', label: 'Deadlines' },
  // Средней сложности
  { msg: 'Сколько стоит обучение в КБТУ?', label: 'Uni price' },
  { msg: 'Какие вузы в Алматы?', label: 'City: Алматы' },
  { msg: 'Гранты на медицину', label: 'Grants: медицина' },
  { msg: 'Сравни КБТУ и КазНУ', label: 'Comparison' },
  { msg: 'Хочу на программиста', label: 'Profession: программист' },
  { msg: 'Мои шансы в КБТУ с ЕНТ 110', label: 'Admission: КБТУ' },
  // Сложные
  { msg: 'Мне 18 лет, ЕНТ 125, Алматы, IT, бюджет', label: 'Complex query' },
  { msg: 'Какие документы нужны для поступления?', label: 'Документы' },
  { msg: 'Расскажи о НУ', label: 'Uni info: НУ' },
  { msg: 'На казахском', label: 'Language switch KK' },
  { msg: 'In English please', label: 'Language switch EN' },
];

(async () => {
  console.log('=== COMPREHENSIVE AI TEST ===\n');
  let passed = 0, failed = 0;

  for (const t of tests) {
    await sleep(2500);
    process.stdout.write(`\n--- ${t.label} ---\n`);
    process.stdout.write(`Q: ${t.msg}\n`);
    try {
      const r = await post('/api/ai/advice', { message: t.msg, lang: 'ru' });
      const answer = r.answer || r.raw || 'NO ANSWER';
      const intent = r.intent || 'N/A';
      const len = answer.length;

      console.log(`Intent: ${intent} | ${len} chars`);
      // Show first 400 chars
      console.log(answer.substring(0, 400));
      if (len > 400) console.log(`... [+${len - 400}]`);

      // Quality checks
      const issues = [];
      if (r.status === 429) issues.push('RATE_LIMITED');
      if (len < 10) issues.push('TOO_SHORT');
      if (len > 3000) issues.push('TOO_LONG');
      if (answer.includes('[object')) issues.push('RAW_OBJECT');
      if (answer.includes('Вузов по вашему запросу не найдено') && t.label.includes('Какие вузы')) issues.push('NO_RESULTS');
      if (answer.includes('нет информации') && t.label.includes('зарплата')) issues.push('NO_SALARY_DATA');

      if (!issues.length) { console.log('✅ PASS'); passed++; }
      else { console.log(`❌ FAIL: ${issues.join(', ')}`); failed++; }
    } catch (e) {
      console.log(`❌ ERROR: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n\n=== ИТОГО: ${passed} OK / ${failed} FAIL / ${tests.length} total ===`);
})().catch(e => console.error(e));
