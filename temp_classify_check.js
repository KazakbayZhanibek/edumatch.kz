const { classifyIntent } = require('./backend/ai-service');
const cases = [
  'Поступлю ли я в КБТУ с ЕНТ 110?',
  'Какой универ еще посоветуешь',
  'Покажи другие варианты',
  'Нет я хочу всего пару вариантов',
  'Какие требования к ЕНТ?',
  'Поступлю ли я в КБТУ на программирование с ЕНТ 110?',
  'Куда я могу поступить со своим балом?',
  'какой вуз лучше'
];
for (const msg of cases) {
  console.log(JSON.stringify(msg), '=>', classifyIntent(msg, []));
}
