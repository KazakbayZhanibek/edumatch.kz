const { classifyIntent } = require('./ai-service');
const { findProfession } = require('./profession-data');

const tests = [
  'хочу стать психологом',
  'профессия программист',
  'кем работать после университета',
  'психолог в Казахстане',
  'врач зарплата',
  'ент сдал на 74',
  'какой вуз лучше для IT',
  'сравни КазНУ и ЕНУ',
  'расскажи о грантах',
  'у меня бюджет 1.2 млн',
];

console.log('=== Intent Classification Tests ===\n');
for (const t of tests) {
  const intent = classifyIntent(t);
  const prof = findProfession(t);
  console.log(`"${t}"`);
  console.log(`  Intent: ${intent}`);
  if (prof) console.log(`  Profession: ${prof.title.ru}`);
  console.log('');
}
