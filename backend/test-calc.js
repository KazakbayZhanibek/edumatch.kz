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

async function run() {
  // Психология (specialtyId=16, cityId=3 Алматы)
  console.log('=== Психология, ЕНТ 67, Алматы ===');
  const r1 = await testCalc({ entScore: 67, specialtyId: 16, cityId: 3 });
  console.log('Matches:', r1.matches?.length, 'Error:', r1.error);
  if (r1.matches?.length) r1.matches.slice(0, 3).forEach(m => console.log(`  ${m.universityName}: ${m.chancePercent}%`));

  // IT (specialtyId=1)
  console.log('\n=== IT, ЕНТ 100, Алматы ===');
  const r2 = await testCalc({ entScore: 100, specialtyId: 1, cityId: 3 });
  console.log('Matches:', r2.matches?.length, 'Error:', r2.error);
  if (r2.matches?.length) r2.matches.slice(0, 3).forEach(m => console.log(`  ${m.universityName}: ${m.chancePercent}%`));

  // Медицина (specialtyId=13)
  console.log('\n=== Медицина, ЕНТ 90 ===');
  const r3 = await testCalc({ entScore: 90, specialtyId: 13 });
  console.log('Matches:', r3.matches?.length, 'Error:', r3.error);
  if (r3.matches?.length) r3.matches.slice(0, 3).forEach(m => console.log(`  ${m.universityName}: ${m.chancePercent}%`));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
