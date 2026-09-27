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
        console.log('STATUS:', res.statusCode);
        console.log('RAW (first 500):', body.substring(0, 500));
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const failing = [
    'Мои шансы в КБТУ, МУИТ и КазНУ на программирование с ЕНТ 115?',
    'Хочу на психологию. Какие вузы в Казахстане, какие проходные баллы и сколько стоит?',
    'Какие гранты доступны на 2025-2026 учебный год? Есть ли что-то на медицину?',
    'Я живу в Астане, мне 19 лет, ЕНТ 108. Хочу поступить на экономику или менеджмент. Расскажи все подробно.',
    'Что такое образовательная платформа EduMatch? Чем она помогает абитуриентам?',
  ];

  for (const msg of failing) {
    console.log(`\n=== ${msg.substring(0, 60)}... ===`);
    try {
      const r = await post('/api/ai/advice', { message: msg, lang: 'ru' });
      console.log('KEYS:', Object.keys(r));
      console.log('answer:', typeof r.answer, r.answer ? r.answer.substring(0, 200) : 'undefined/null');
      console.log('data:', r.data ? JSON.stringify(r.data).substring(0, 200) : 'undefined');
      console.log('success:', r.success);
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  }
})();
