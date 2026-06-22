// Полный тест всех интентов и языков — напрямую через getAIAdvice (без rate limit)
const { getAIAdvice } = require('./ai-service');

const TESTS = [
  // === RUSSIAN ===
  { lang: 'ru', message: 'Привет',                        expected: 'greeting' },
  { lang: 'ru', message: 'Здравствуйте',                   expected: 'greeting' },
  { lang: 'ru', message: 'Добрый день',                    expected: 'greeting' },
  { lang: 'ru', message: 'Помощь',                         expected: 'help' },
  { lang: 'ru', message: 'Что ты умеешь',                   expected: 'help' },
  { lang: 'ru', message: 'КБТУ-да оқу қанша тұрады?',      expected: 'uni_info' },
  { lang: 'ru', message: 'Сколько стоит обучение в КБТУ',   expected: 'uni_info' },
  { lang: 'ru', message: 'Мои шансы в КБТУ на программиста с ЕНТ 110', expected: 'admission' },
  { lang: 'ru', message: 'Какие вузы в Алматы?',            expected: 'city' },
  { lang: 'ru', message: 'Вузы Шымкента с общежитием',      expected: 'city' },
  { lang: 'ru', message: 'Гранты на медицину',              expected: 'grant' },
  { lang: 'ru', message: 'Программистом быть',              expected: 'profession' },
  { lang: 'ru', message: 'Сравни КБТУ и КазНУ',            expected: 'comparison' },
  { lang: 'ru', message: 'Подбери вуз для поступления',     expected: 'admission' },
  { lang: 'ru', message: 'Когда регистрация на ЕНТ?',       expected: 'deadlines' },
  { lang: 'ru', message: 'Мне 17 лет',                      expected: 'general' },
  { lang: 'ru', message: 'Как подать документы?',            expected: 'general' },
  { lang: 'ru', message: 'Объясни как работает грантовая система', expected: 'general' },
  { lang: 'ru', message: 'Какая средняя зарплата?',          expected: 'profession' },

  // === KAZAKH ===
  { lang: 'kk', message: 'Сәлеметсіз бе',                  expected: 'greeting' },
  { lang: 'kk', message: 'Сәлем',                           expected: 'greeting' },
  { lang: 'kk', message: 'Көмек',                           expected: 'help' },
  { lang: 'kk', message: 'КБТУ-да оқу қанша тұрады?',      expected: 'uni_info' },
  { lang: 'kk', message: 'Менің ЕНТ 110, КБТУ-ге түсу мүмкіндігім', expected: 'admission' },
  { lang: 'kk', message: 'Алматыдағы университеттер',        expected: 'city' },
  { lang: 'kk', message: 'IT бойынша гранттар',             expected: 'grant' },
  { lang: 'kk', message: 'Программист мамандығы',           expected: 'profession' },
  { lang: 'kk', message: 'КБТУ мен КазНУ-ды салыстыр',     expected: 'comparison' },
  { lang: 'kk', message: 'Университеттерді таңда',          expected: 'recommendation' },
  { lang: 'kk', message: 'Тіркеу кезінде қашан?',           expected: 'deadlines' },
  { lang: 'kk', message: 'Менің жасым 17',                  expected: 'general' },
  { lang: 'kk', message: 'Құжаттарды қалай тапсыру керек?', expected: 'general' },

  // === ENGLISH ===
  { lang: 'en', message: 'Hello',                           expected: 'greeting' },
  { lang: 'en', message: 'Hi',                              expected: 'greeting' },
  { lang: 'en', message: 'Help',                            expected: 'help' },
  { lang: 'en', message: 'What can you do?',                expected: 'help' },
  { lang: 'en', message: 'How much does KBTU cost?',        expected: 'uni_info' },
  { lang: 'en', message: 'My chances at KBTU with ENT 110', expected: 'admission' },
  { lang: 'en', message: 'What universities are in Almaty?', expected: 'city' },
  { lang: 'en', message: 'IT grants',                       expected: 'grant' },
  { lang: 'en', message: 'Want to become a programmer',     expected: 'profession' },
  { lang: 'en', message: 'Compare KBTU and KazNU',          expected: 'comparison' },
  { lang: 'en', message: 'Recommend a university',          expected: 'recommendation' },
  { lang: 'en', message: 'When is ENT registration?',       expected: 'deadlines' },
  { lang: 'en', message: 'I am 17 years old',               expected: 'general' },
  { lang: 'en', message: 'How to apply?',                   expected: 'general' },

  // === AUTO-DETECT (no lang param) ===
  { lang: null, message: 'Привет',                          expected: 'greeting' },
  { lang: null, message: 'Сәлеметсіз бе',                   expected: 'greeting' },
  { lang: null, message: 'Hello',                            expected: 'greeting' },
  { lang: null, message: 'Сколько стоит КБТУ?',             expected: 'uni_info' },
  { lang: null, message: 'КБТУ қанша тұрады?',              expected: 'uni_info' },
  { lang: null, message: 'How much is KBTU?',               expected: 'uni_info' },
  { lang: null, message: 'Сравни КБТУ и КазНУ',            expected: 'comparison' },
  { lang: null, message: 'КБТУ мен КазНУ-ды салыстыр',     expected: 'comparison' },
  { lang: null, message: 'Compare KBTU and KazNU',          expected: 'comparison' },
];

async function runTests() {
  console.log('='.repeat(90));
  console.log('  FULL AI TEST — All Intents × All Languages (direct, no rate limit)');
  console.log('='.repeat(90));
  console.log(`  Total tests: ${TESTS.length}\n`);

  let pass = 0, fail = 0;
  const results = [];

  for (let i = 0; i < TESTS.length; i++) {
    const t = TESTS[i];
    const langLabel = t.lang || 'auto';
    const label = `[${langLabel.toUpperCase().padEnd(4)}] "${t.message}"`;

    try {
      const res = await getAIAdvice(t.message, [], t.lang || undefined);
      const actual = res.intent || 'general';
      const ok = actual === t.expected;
      const status = ok ? ' OK ' : 'FAIL';
      ok ? pass++ : fail++;
      results.push({ lang: langLabel, message: t.message, expected: t.expected, actual, status });
      const detail = ok ? '' : ` (expected="${t.expected}")`;
      console.log(`  ${status}  ${label}  =>  intent="${actual}"${detail}`);
    } catch (err) {
      fail++;
      results.push({ lang: langLabel, message: t.message, expected: t.expected, actual: 'ERROR', status: 'FAIL' });
      console.log(`  FAIL  ${label}  =>  ERROR: ${err.message}`);
    }

    // Small delay to avoid DB locks
    await new Promise(r => setTimeout(r, 100));
  }

  // Summary by language
  const byLang = {};
  for (const r of results) {
    if (!byLang[r.lang]) byLang[r.lang] = { pass: 0, fail: 0 };
    r.status === ' OK ' ? byLang[r.lang].pass++ : byLang[r.lang].fail++;
  }

  console.log('\n' + '='.repeat(90));
  console.log('  SUMMARY');
  console.log('='.repeat(90));
  for (const [lang, stats] of Object.entries(byLang)) {
    console.log(`  ${lang.toUpperCase().padEnd(5)}:  ${stats.pass} OK / ${stats.fail} FAIL / ${stats.pass + stats.fail} total`);
  }
  console.log(`  TOTAL:  ${pass} OK / ${fail} FAIL / ${results.length} total`);
  console.log('='.repeat(90));

  // Detailed table
  console.log('\n  DETAILED RESULTS');
  console.log('  ' + '-'.repeat(86));
  console.log(`  ${'Lang'.padEnd(5)} | ${'Message'.padEnd(42)} | ${'Expected'.padEnd(14)} | ${'Actual'.padEnd(14)} | Result`);
  console.log('  ' + '-'.repeat(86));
  for (const r of results) {
    const msg = r.message.length > 40 ? r.message.slice(0, 37) + '...' : r.message;
    console.log(`  ${r.lang.padEnd(5)} | ${msg.padEnd(42)} | ${r.expected.padEnd(14)} | ${r.actual.padEnd(14)} | ${r.status}`);
  }
  console.log('  ' + '-'.repeat(86));

  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
