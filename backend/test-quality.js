const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({hostname:'localhost',port:3000,path,method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(d)})}catch(e){resolve({status:res.statusCode,data:d})}});
    });
    req.on('error',reject); req.write(data); req.end();
  });
}

async function test() {
  const tests = [
    {msg:'Какие вузы есть для юрфака?'},
    {msg:'Поступлю ли я в КБТУ с ЕНТ 110?'},
    {msg:'Задай мне вопросы, чтобы выбрать вуз'},
    {msg:'Сравни КБТУ и КазНУ'},
    {msg:'Есть гранты на IT?'},
    {msg:'Расскажи про КБТУ'},
    {msg:'Сколько стоит КБТУ?'},
    {msg:'а если я не знаю кем хочу быть'},
  ];

  for (const t of tests) {
    const r = await post('/api/ai/advice', {message:t.msg, lang:'ru'});
    const intent = r.data.intent || 'general';
    const ans = (r.data.answer||'').substring(0,150).replace(/\n/g,' ');
    console.log('[' + intent + '] "' + t.msg + '"');
    console.log('  -> ' + ans);
    console.log('');
    await new Promise(r=>setTimeout(r,500));
  }
}
test().catch(e=>console.error(e));
