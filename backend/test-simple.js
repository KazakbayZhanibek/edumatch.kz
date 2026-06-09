const http = require('http');

// Simple test - check if POST works at all
const data = JSON.stringify({ message: 'test', history: [], lang: 'ru' });
const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/advice',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
};

console.log('Sending request...');
const req = http.request(opts, res => {
  console.log('Response status:', res.statusCode);
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Body length:', body.length);
    console.log('Body:', body.slice(0, 500));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.setTimeout(10000, () => { console.log('TIMEOUT'); req.destroy(); });
req.write(data);
req.end();
