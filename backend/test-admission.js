const http = require('http');
const data = JSON.stringify({entScore: 100, gpa: 4.0, specialtyId: 1, cityId: 3, language: 'русский'});
const opts = {hostname:'localhost',port:3000,path:'/api/admission/calculate',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opts, res => {
  let body='';
  res.on('data', c => body+=c);
  res.on('end', () => {
    const r = JSON.parse(body);
    console.log('Status:', res.statusCode);
    console.log('Matches:', r.matches?.length);
    console.log('Error:', r.error);
    if(r.matches?.length) console.log('First:', r.matches[0].universityName, r.matches[0].chancePercent+'%');
  });
});
req.write(data);
req.end();
