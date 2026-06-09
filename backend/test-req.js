const http = require('http');
const data = JSON.stringify({ message: 'хочу стать психологом', history: [], lang: 'ru' });
const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/advice',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
};
console.log('Sending...');
const req = http.request(opts, res => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const r = JSON.parse(body);
      console.log('Intent:', r.intent);
      console.log('Answer:', (r.answer || '').slice(0, 500));
    } catch (e) {
      console.log('Body:', body.slice(0, 500));
    }
    process.exit(0);
  });
});
req.on('error', e => { console.log('Error:', e.message); process.exit(1); });
req.setTimeout(30000, () => { console.log('TIMEOUT'); req.destroy(); process.exit(1); });
req.write(data);
req.end();
