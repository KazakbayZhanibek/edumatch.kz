const http = require('http');

function testCalc(input) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(input);
    const opts = {
      hostname: 'localhost', port: 3000,
      path: '/api/admission/calculate',
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function testSpecs() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/specialties', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve([]); }
      });
    }).on('error', reject);
  });
}

async function run() {
  // 1. Check specialties endpoint
  console.log('=== /api/specialties ===');
  const specs = await testSpecs();
  console.log('Count:', specs.length);
  specs.slice(0, 5).forEach(s => console.log(`  id=${s.id} name=${s.name} cat=${s.category}`));

  // 2. Психология (id=16) via form
  console.log('\n=== Психология (id=16), ЕНТ 67, Алматы (id=3) ===');
  const r1 = await testCalc({ entScore: 67, specialtyId: 16, cityId: 3 });
  console.log('Matches:', r1.matches?.length, 'Error:', r1.error);
  if (r1.matches?.length) r1.matches.slice(0, 5).forEach(m => console.log(`  ${m.universityName}: ${m.chancePercent}%`));

  // 3. Психология without city
  console.log('\n=== Психология (id=16), ЕНТ 80, без города ===');
  const r2 = await testCalc({ entScore: 80, specialtyId: 16 });
  console.log('Matches:', r2.matches?.length, 'Error:', r2.error);
  if (r2.matches?.length) r2.matches.slice(0, 5).forEach(m => console.log(`  ${m.universityName}: ${m.chancePercent}%`));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
