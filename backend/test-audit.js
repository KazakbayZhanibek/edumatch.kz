const tests = [
  "Привет",
  "Что ты умеешь?",
  "Мои шансы в КБТУ на программиста с ЕНТ 110",
  "Поступлю ли я в КазНУ с ЕНТ 100?",
  "В какой вуз поступить на медицину с ЕНТ 120?",
  "Какие вузы в Алматы?",
  "Какие вузы в Шымкенте?",
  "Сравни КБТУ и КазНУ",
  "Что лучше НУ или ЕНУ?",
  "Какие гранты на IT?",
  "Какие гранты на медицину?",
  "Кем работать с IT образованием?",
  "Дай список вузов на IT",
  "Какие вузы есть в Казахстане?",
  "Когда подавать документы?",
  "Не знаю что выбрать",
  "Мои шансы в Алматы на IT с ЕНТ 95 и бюджетом 1.5 миллиона",
  "Какой вуз самый дешёвый в Казахстане?",
  "Где лучше учиться на медицину — в Алматы или Астане?",
  "Какой средний балл ЕНТ в КБТУ?",
  "Сколько стоит обучение в НУ?",
  "Есть ли общежитие в КазНУ?",
  "Какие документы нужны для поступления?",
  "Какой рейтинг КБТУ в мире?",
  "Какие вузы дают двойной диплом?",
  "Что такое ЕНТ и как к нему готовиться?",
  "Какие предметы нужно сдавать на медицину?",
  "Какие вузы лучше для IT?",
  "Какие вузы лучше для медицины?",
  "Какие вузы лучше для экономики?",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testQuery(query) {
  try {
    const res = await fetch('http://localhost:3000/api/ai/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, history: [] })
    });
    const data = await res.json();
    if (data.success === false) return { q: query.substring(0, 50), intent: 'RATE_LIMIT', ok: false, len: 0, err: data.error };
    const answer = (data.answer || '');
    const hasUni = /университет|вуз|КБТУ|КазНУ|НУ|ЕНУ/i.test(answer);
    const isGeneric = /EduMatch KZ|помочь с|задавай вопрос/i.test(answer) && !hasUni;
    
    return {
      q: query.substring(0, 50),
      intent: data.intent || data.metadata?.intent || 'none',
      ok: answer.length > 20,
      generic: isGeneric,
      len: answer.length,
    };
  } catch (e) {
    return { q: query.substring(0, 50), intent: 'ERROR', ok: false, len: 0, err: e.message };
  }
}

async function run() {
  console.log('=== AI CHAT AUDIT (with rate limit) ===\n');
  
  let passed = 0, generic = 0, failed = 0, rateLimited = 0;
  const issues = [];
  
  for (const q of tests) {
    await sleep(500); // 500ms between requests
    const r = await testQuery(q);
    
    let status;
    if (r.err && r.err.includes('Too many')) { rateLimited++; status = '⏳ RATE_LIMIT'; }
    else if (r.ok && !r.generic) { passed++; status = '✅ OK'; }
    else if (r.generic) { generic++; status = '⚠️ GENERIC'; issues.push({ q: r.q, issue: 'Generic answer' }); }
    else { failed++; status = '❌ FAIL'; issues.push({ q: r.q, issue: r.err || `len=${r.len}` }); }
    
    console.log(`${status} [${r.intent}] "${r.q}" → ${r.len || 0} chars`);
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`⚠️ Generic: ${generic}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log(`⏳ Rate Limited: ${rateLimited}/${tests.length}`);
  
  if (issues.length > 0) {
    console.log(`\n=== ISSUES ===`);
    issues.forEach(i => console.log(`  - "${i.q}" → ${i.issue}`));
  }
}

run();
