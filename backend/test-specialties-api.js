const http = require('http');

http.get('http://localhost:3000/api/admission/specialties', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error('Parse error:', e.message);
      console.error('Raw response:', data);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
});
