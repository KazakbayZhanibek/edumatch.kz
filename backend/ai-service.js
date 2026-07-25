const { getDb } = require('./database');
const { getSystemPrompt, getAdmissionBriefPrompt, getMissingParamsMessage } = require('./ai-prompts');
const { getAdmissionPrediction } = require('./admission-service');
const { tr } = require('./i18n');
const { findProfession, formatProfessionForContext, getProfessionsBySpecialty } = require('./profession-data');

// Авто-определение языка по тексту сообщения
function detectLanguage(text) {
  const t = (text || '').trim();
  if (!t) return 'ru';

  // Kazakh-specific characters: ә, ғ, қ, ң, ө, ұ, ү, і, ы, ж, х, ц, ч, ш, щ, ъ, ь, э, ю, я
  // More reliable: look for Kazakh-specific letter combinations
  const kkChars = /[әғқңөұүіӘҒҚҢӨҰҮІ]/;
  const kkWords = /\b(сен|мен|ол|біз|олар|қалай|қайда|неліктен|не|кім|қандай|бар|жоқ|иә|және|немесе|бірақ|сонымен|өйткені|ескертпе|құрметті|сәлеметсіз|сәлем|рақмет|өтініш|көмек|ұсыну|ӛну|ӛнеркәсіп|жатақхана|университет|мектеп|оқу|білім|мамандық|жұмыс|кәсіп|грант|стипендия|тегін|мемлекеттік|республика|қала|астана|алматы|шымкент)\b/i;

  if (kkChars.test(t) || kkWords.test(t)) return 'kk';

  // English: mostly ASCII letters, common English words
  const enWords = /\b(what|how|where|when|which|who|why|the|is|are|was|were|can|could|would|should|will|do|does|did|have|has|had|and|or|but|not|with|for|from|about|into|university|universities|college|school|grant|scholarship|admission|apply|document|tuition|cost|price|salary|compare|recommend|help|hello|hi|hey|thank|please|sorry|good|morning|evening|night|yes|no|i|you|he|she|it|we|they|my|your|his|her|our|their|this|that|these|those)\b/i;

  const words = t.split(/\s+/);
  let enCount = 0;
  for (const w of words) {
    if (enWords.test(w) || /^[a-zA-Z]+$/.test(w)) enCount++;
  }
  if (enCount >= Math.ceil(words.length * 0.5)) return 'en';

  return 'ru';
}

function pickDescription(row, lang) {
  if (lang === 'kk' && row.description_kk) return row.description_kk;
  if (lang === 'en' && row.description_en) return row.description_en;
  return row.description;
}

// Fuzzy matching helper - Levenshtein distance
function levenshteinDistance(a, b) {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array(bLen + 1).fill(null).map(() => Array(aLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[0][i] = i;
  for (let j = 0; j <= bLen; j++) matrix[j][0] = j;

  for (let j = 1; j <= bLen; j++) {
    for (let i = 1; i <= aLen; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[bLen][aLen];
}

// Fuzzy match with threshold
function fuzzyMatch(text, keywords, maxDistance = 2) {
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    for (const keyword of keywords) {
      const distance = levenshteinDistance(word, keyword.toLowerCase());
      if (distance <= maxDistance && keyword.length > 2) {
        return keyword;
      }
    }
  }
  return null;
}

const INTENT_PATTERNS = [
  {
    name: 'city',
    patterns: [
      /(?:в каком городе|в каком городе лучше|город|какой город|где лучше|где поступить|город поступать|лучший город|город для учебы|город для студента)/i,
      /(?:каки[еяй]\s+(?:универ|вуз)|покажи\s+(?:вузы|университеты)\s+в|вузы?\s+(?:в|городе|город))\s+(?:в\s+)?(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      /(?:вузы|университеты)\s+(?:с\s+[\w]+\s+)?(?:в|городе)\s+(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      /(?:вузы|университеты)\s+(?:на|по|с)\s+[\w]+\s+в\s+(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      /(?:вуз|университет)\s+(?:в|городе)\s+(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      // Общежитие + город
      /(?:вузы|университеты|вуз)\s+с\s+общежитием\s+(?:в|городе|города)?\s*(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      // Родительный падеж города: "вузы Шымкента", "вузы Алматы"
      /(?:вузы|университеты|вуз)\s+(?:Алмат[ы]|Астан[ы]|Шымкент[а]?|Караганд[ы]|Актоб[и]|Павлодар[а]?|Уральск[а]?|Атырау[а]?|Актау[а]?|Семей[а]?|Кызылорд[ы]|Петропавловск[а]?|Усть-Каменогорск[а]?|Кокшетау[а]?|Жезказган[а]?|Каскелен[а]?)/i,
      /(?:вузы|университеты|вуз)\s+\S+\s+(?:в|городе|города)?\s*(?:Алмат[ые]|Астан[ае]|Шымкент[ае]?|Караганд[ае]|Актоб[ея]|Павлодар[ае]?|Уральск[ае]?|Атырау[ае]?|Актау[ае]?|Семей[ае]?|Кызылорд[ае]|Петропавловск[ае]?|Усть-Каменогорск[ае]?|Кокшетау[ае]?|Жезказган[ае]?|Каскелен[ае]?)/i,
      // KK
      /(?:\bқала\b|қай қалада|қалада|қалаға|қала бойынша|жақсы қала|оқу үшін қала)/i,
      // KK city + university
      /(?:Алматыдағы|Астанадағы|Шымкенттегі|Қарағандыдағы|Ақтөбедегі|Павлодардағы|Атыраудағы|Семейдегі|Қызылордадағы|Петропавловсктегі|Көкшетаудағы|Жезқазғандағы|Өскемендегі|Түркестандегі|Ақтаудағы|Уральсктегі)\s+(?:универ|мектеп|жоғары)/i,
      // EN
      /(?:which city|what city|best city|city for study|city for student|where to study|city to apply)/i,
      // EN city + university
      /(?:what|which)\s+(?:universities|unis|colleges|schools)\s+(?:are\s+)?(?:in|of|at)\s+\w+/i,
      /(?:universities|unis|colleges)\s+in\s+(?:almaty|astana|shymkent|karagandy|aktobe|pavlodar|atyrau|semey|kyzylorda|kokshetau|oral|aktau)/i,
    ],
    keywords: ['город','какой город','в каком','где лучше','где поступить','лучший город',
               'қай қалада','жақсы қала','оқу үшін қала',
               'which city','best city','where to study'],
  },
  {
    name: 'admission',
    weight: 0,
    patterns: [
      /(?:поступ|шанс|пройд|вероятност|могу ли я|получу ли).*/i,
      /(?:ент|бал[а-я]*)\s*:?\s*\d{2,3}/i,
      /\d{2,3}\s*(?:бал[а-я]*)(?:\s*ент)?/i,
      // KK patterns
      /(?:түсу|мүмкіндік|өту|ықтималдық|ала аламын|түсе аламын).*/i,
      /(?:ұбт|балл)\s*:?\s*\d{2,3}/i,
      /\d{2,3}\s*(?:балл)(?:\s*ұбт)?/i,
      // EN patterns
      /(?:admit|chance|pass|probability|can i get|will i get).*/i,
      /(?:unt|ent|score)\s*:?\s*\d{2,3}/i,
      /\d{2,3}\s*(?:points?)(?:\s*(?:unt|ent))?/i,
      // Специальности: нефть, геология, химия и т.д.
      /(?:хочу|хочеться|буду|поупуп|поступ).*(?:нефт|горн|геол|хим|физик|биол|агрон|ветерин|музык|спорт|педагог|медсест|фарм|архитект|энерг|эколог|историк|журнал|социол|лингвист|перевод)/i,
    ],
    keywords: ['поступ','шанс','пройду','вероятность','ент','проходной',
               'түсу','мүмкіндік','өту','ықтималдық','ұбт',
               'admit','chance','pass','probability','unt','ent'],
  },
  {
    name: 'comparison',
    patterns: [
      /сравн/i, /отлич/i, /разниц/i, /\s+vs\s+/i, /\bили\b.*\b(?:и|или)\b.*\b(?:вуз|университет)/i,
      /(?:что лучше|какой лучше|чем.*лучше|чем.*хуже)/i,
      // KK
      /салыстыр/i, /айырмашылық/i, /өзгешелік/i,
      // EN
      /compar/i, /differen/i, /\bvs\b/i,
    ],
    keywords: ['сравни','отличие','разница','vs','сравнить','сравнение',
               'салыстыр','айырмашылық','өзгешелік',
               'compare','difference','versus'],
  },
  {
    name: 'grant',
    patterns: [/грант/i, /стипенди/i, /бесплатно/i, /гос.грант/i,
      // KK
      /грант/i, /стипендия/i, /тегін/i, /мемлекеттік грант/i,
      // EN
      /grant/i, /scholarship/i, /free tuition/i, /government grant/i,
    ],
    keywords: ['грант','стипенди','бесплатно','государственный грант',
               'грант','стипендия','тегін','мемлекеттік грант',
               'grant','scholarship','free','government'],
  },
  {
    name: 'uni_info',
    patterns: [
      // Конкретные вопросы по вузам
      /(?:сколько стоит|стоимость|цена|оплата|учиться).*(?:в|у)\s+(?:кбт|казну|ну|ену|муит|кимэп|туран|сд)/i,
      /(?:сколько стоит|стоимость|цена|оплата|учиться)\s+(?:кбт|казну|ну|ену|муит|кимэп|туран|сд)/i,
      /(?:общежитие|проживание|жильё|жилье).*(?:в|у)\s+(?:кбт|казну|ну|ену|муит|кимэп|туран|сд)/i,
      /(?:рейтинг|ранг|место|позиция|qs|rating).*(?:вуз|универ|кбт|казну|ну|ену)/i,
      /(?:какие документ|документы|пакет|как поступить|как подавать|процедур).*(?:вуз|универ|кбт|казну|ну|ену)/i,
      /(?:средний балл|проходной балл|минимальный балл|порог|ент|балл).*(?:в|у)\s+(?:кбт|казну|ну|ену|муит|кимэп)/i,
      // Обобщённые вопросы "сколько стоит обучение", "какие документы нужны", "есть ли общежитие"
      /(?:сколько стоит|стоимость|цена|оплата).*(?:обучен|учёб|учеб)/i,
      /(?:какие документ|документы|пакет).*(?:нужн|треб|поступ|подав)/i,
      /(?:есть ли|имеется ли|есть\s+общежитие)/i,
      /(?:рейтинг|ранг|место|позиция|qs|rating)\s+(?:вуза|университета|вуз|университет)?/i,
      /(?:средний балл|проходной|минимальный|порог)\s+(?:ент|балл)?/i,
      // KK
      /(?:қанша тұрады|бағасы|оқу ақысы).*(?:у|аралығында|мектебінде)/i,
      /(?:жатақхана|тұру).*(?:у|аралығында)/i,
      // EN
      /(?:how much|cost|price|tuition|fee).*(?:at|in|of|does)\s+\w+/i,
      /(?:how much does|how much is|what is the cost|what is the price)\s+\w+/i,
      /(?:dormitory|accommodation|dorm).*(?:at|in|of)\s+\w+/i,
      /(?:ranking|rating|qs|position).*(?:university|institute)/i,
    ],
    keywords: ['сколько стоит обучение','стоимость обучения','цена обучения',
               'какие документы нужны','документы для поступления','как поступить',
               'есть ли общежитие','общежитие есть ли',
               'рейтинг вуза','рейтинг университета',
               'средний балл ент','проходной балл',
               'қанша тұрады','бағасы','жатақхана',
               'how much does it cost','how much','what is the cost','what is the price','dormitory'],
  },
  {
    name: 'profession',
    patterns: [
      /(?:хочу стать|кем быть|професси[яи]|работа|карьера|будущая профессия)/i,
      /(?:какой профессии|какая профессия|какие профессии|кем.work+)/i,
      // Профессии как отдельные слова (с любым контекстом)
      /(?:психолог|программист|врач|дизайнер|инженер|юрист|экономист|менеджер|маркетолог|учитель|фармацевт|аналитик)/i,
      // KK
      /(?:кім болғым|мамандық|жұмыс|кәсіп|болашақ мамандық)/i,
      /(?:қандай мамандық|мамандық бойынша)/i,
      // EN
      /(?:want to become|what profession|job|career|future profession)/i,
      /(?:what do you do|profession|occupation)/i,
    ],
    keywords: ['хочу стать','кем быть','профессия','профессии','работа','карьера','будущее',
               'кім болғым','мамандық','жұмыс','кәсіп','bolashaq',
               'want to become','profession','career','job','occupation',
               'зарплата','оклад','salary','жалақы'],
  },
  {
    name: 'recommendation',
    patterns: [
      /(?:рекомендуй|посоветуй|подбери|какой вуз|какие университет|лучший вуз|посоветуйте)/i,
      /(?:интересует|хочу|ищу).*(?:вуз|университет|специальность|направление)/i,
      // KK
      /(?:ұсын|кеңес бер|таңда|қай университет|қандай университет|жәй университет|ұсыныңыз)/i,
      /(?:қызықтырады|қаламын|іздеймін).*(?:университет|мамандық|бағыт)/i,
      // EN
      /(?:recommend|suggest|advise|which uni|which university|best uni|best university)/i,
      /(?:interested in|want|looking for).*(?:university|specialty|major)/i,
    ],
    keywords: ['рекомендуй','посоветуй','подбери','лучший','интересует',
               'ұсын','кеңес бер','таңда','қай','жәй','қызықтырады',
               'recommend','suggest','which','best','interested'],
  },
  {
    name: 'city',
    patterns: [
      /(?:в каком городе|в каком городе лучше|город|какой город|где лучше|где поступить|город поступать|лучший город|город для учебы|город для студента)/i,
      // KK
      /(?:\bқала\b|қай қалада|қалада|қалаға|қала бойынша|жақсы қала|оқу үшін қала)/i,
      // EN
      /(?:which city|what city|best city|city for study|city for student|where to study|city to apply)/i,
    ],
    keywords: ['город','какой город','в каком','где лучше','где поступить','лучший город',
               'қай қалада','жақсы қала','оқу үшін қала',
               'which city','best city','where to study'],
  },
  {
    name: 'uni_info',
    patterns: [
      // Вопросы о конкретном вузе
      /(?:сколько стоит|цена|стоимость|оплат|бюджет).*(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ|МУИТ|КИМЭП|СДУ|АТУ|КАД|ГУК|КазГУ|КазНМУ|КазНПУ|КазЭУ|КазХУ|КазНАУ|КИСО)/i,
      /(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ|МУИТ|КИМЭП|СДУ|АТУ|КАД|ГУК|КазГУ|КазНМУ|КазНПУ|КазЭУ|КазХУ|КазНАУ|КИСО).*(?:сколько стоит|цена|стоимость|оплат|бюджет)/i,
      /(?:общежитие|общага|проживан).*(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ|МУИТ|КИМЭП|СДУ)/i,
      /(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ|МУИТ|КИМЭП|СДУ).*(?:общежитие|общага|проживан)/i,
      /(?:рейтинг|ранг|место|позиция|position|ranking|qs|ranking).*(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ)/i,
      /(?:вуз|университет|КБТУ|КазНУ|НУ|ЕНУ).*(?:рейтинг|ранг|место|позиция)/i,
      /(?:средний балл|минимальный балл|проходной|порог|ЕНТ).*(?:в|унит|университет)/i,
      /(?:в|унит|университет).*(?:средний балл|минимальный балл|проходной|порог|ЕНТ)/i,
      // Документы
      /(?:какие документ|какие бумаг|список документов|пакет документов|что подавать|что нужно для поступления)/i,
      /(?:документы для поступления|бумаги для поступления|как поступить|процедура поступления)/i,
      // Общие вопросы о вузе
      /(?:что за вуз|расскажи о|tell me about|какой вуз| Information о)/i,
      /(?:выбери вуз|помоги выбрать|какой выбрать|какой лучше выбрать)/i,
      // KK
      /(?:қанша тұрады|бағасы|ӛнеркәсіп|жатақхана|рейтинг|орын)/i,
      // EN
      /(?:how much|cost|price|tuition|dormitory|dorm|ranking|position|rating).*(?:university|uni|KBTU|KazNU|NU|ENU)/i,
      /(?:university|uni|KBTU|KazNU|NU|ENU).*(?:how much|cost|price|tuition|dormitory|dorm|ranking)/i,
    ],
    keywords: ['сколько стоит','цена','стоимость','общежитие','рейтинг','средний балл','проходной',
               'документы','как поступить','расскажи о','что за вуз',
               'қанша тұрады','бағасы','жатақхана','рейтинг',
               'how much','cost','price','tuition','dormitory','ranking'],
  },
];

function classifyIntent(message) {
  const q = (message || '').toLowerCase().trim();
  if (!q) return 'general';

  // Приветствия и короткие фразы → general с заготовленным ответом
  if (/^(?:привет|здравствуй(?:те)?|سلام|hello|hi|hey|приветик|добрый|добрый день|добрый вечер|доброе утро|здорово|йо|йоу|хай|здаров|хай|здрасьте|здарова|хелло|хэлло|сәлеметсіз бе|сәлем|сәлеметсің бе|сәлеметсізбе|assalamu alaikum|саған сәлем|жәрекем)(?:[!?.，。]+)?$/i.test(q)) {
    return 'greeting';
  }
  if (/^(?:что (?:ты )?умеешь|чем (?:ты )?поможешь|что (?:ты )?можешь|помощь|help|what (?:can|do) (?:you|u) (?:do|help)|what are you doing|что делать|как пользоваться|көмек|не істей аламын|қалай пайдалану|қандай мүмкіндіктер)(?:[!?.，。]+)?$/i.test(q)) {
    return 'help';
  }

  // Проверяем comparison ДО uni_info (чтобы "сравни стоимость КБТУ и МУИТ" не ловилось как uni_info)
  const compCheck = INTENT_PATTERNS.find(i => i.name === 'comparison');
  if (compCheck && compCheck.patterns.some(p => p.test(q))) {
    return 'comparison';
  }

  // Сильные маркеры admission ДО recommendation (чтобы "Хочу поступить" не ловилось как recommendation)
  // Но НЕ информационные вопросы про процесс поступления — это general
  if (/(?:поступ|шанс|поступлю)/i.test(q) && !/документ/i.test(q) && !/мне\s+\d+\s+лет/i.test(q)) {
    // Информационные вопросы про процесс → general
    if (/(?:как (?:подать|поступить|записаться|заявк)|процедур|заявлен|заявк|порядок|этап|список документов|пакет документов|когда подавать|сроки подач|где подавать|подача заяв|вступительн)/i.test(q)) {
      // пропускаем
    } else {
      return 'admission';
    }
  }

  // Проверяем recommendation ДО uni_info (чтобы "подбери вуз" не ловилось как uni_info)
  const recCheck = INTENT_PATTERNS.find(i => i.name === 'recommendation');
  if (recCheck && recCheck.patterns.some(p => p.test(q))) {
    return 'recommendation';
  }

  // Проверяем grant ДО city (чтобы "гранты в [город]" не ловилось как city)
  const grantCheck = INTENT_PATTERNS.find(i => i.name === 'grant');
  if (grantCheck && (grantCheck.patterns.some(p => p.test(q)) || grantCheck.keywords.some(k => q.includes(k)))) {
    // Но не ловим вопросы-объяснения: "как работает", "объясни", "что такое"
    if (!/(?:как работает|объясни|что такое|объясн|расскажи|что значит)/i.test(q)) {
      return 'grant';
    }
  }

  // Проверяем uni_info ДО city (чтобы "средний балл в КБТУ" не ловилось как city)
  const uniInfoCheck = INTENT_PATTERNS.find(i => i.name === 'uni_info');
  if (uniInfoCheck && (uniInfoCheck.patterns.some(p => p.test(q)) || uniInfoCheck.keywords.some(k => q.includes(k)))) {
    // Не ловим вопросы-объяснения: "как работает", "объясни", "что такое"
    if (/(?:как работает|объясни|что такое|объясн|расскажи|что значит)/i.test(q)) {
      // пропускаем, чтобы упало в general
    }
    // Не ловим информационные вопросы про процесс поступления — это general (LLM)
    else if (/(?:как (?:подать|поступить|записаться)|процедур|заявлен|заявк|порядок|этап|какие документ|список документов|пакет документов|когда подавать|сроки подач|где подавать|подача заяв|вступительн)/i.test(q)) {
      // пропускаем
    }
    // Не ловим обобщённые вопросы "в Казахстане", "в стране" — без конкретного вуза
    else if (/(?:в\s+казахстан|в\s+стране|в\s+рк|во\s+всех|общий)/i.test(q) && !/(?:\bкбт|\bказну|\bну\b|\bену|\bмуит|\bкимэп|\bтуран|\bсд\b|\bкараганд|\bактоб|\bпавлодар|\bатырау|\bактау|\bсемей|\bкызылорд|\bпетропавл|\bусть-камен|\bкокшетау|\bжезказган)/i.test(q)) {
      // пропускаем
    } else {
      return 'uni_info';
    }
  }

  // Проверяем city intent — "какие вузы/универы в [город]"
  if (INTENT_PATTERNS.find(i => i.name === 'city').patterns.some(p => p.test(q))) {
    return 'city';
  }

  // "Какие вузы есть в [стране]" → recommendation (не city)
  if (/каки[еяй]\s+(?:вузы|университеты|универы)\s+(?:есть\s+)?в\s+(?:казахстан|kazakhstan)/i.test(q)) {
    return 'recommendation';
  }

  // Сначала проверяем специальные случаи
  // Онбординг для неопределившихся
  if (/(?:не знаю что выбрать|помоги определиться|не могу выбрать|что выбрать|не определился|помоги с выбором|какой вуз выбрать|не знаю куда)/i.test(q)) {
    return 'onboarding';
  }

  // Дедлайны и сроки (RU + KK + EN)
  if (/(?:дедлайн|сроки|когда подавать|когда регистрация|сроки подачи|когда ент|сроки ент|календарь|план действий|что делать дальше|чеклист|тіркеу кезінде|мерзім|қашан тіркелу|ұбт тіркеу|мерзімдер|күнтізбе|тіркеу мерзімі|deadline|when.*register|when.*ent|registration date|submission deadline|timeline|checklist)/i.test(q)) {
    return 'deadlines';
  }

  // "список вузов", "какие вузы", "дай список", "помоги выбрать" → recommendation
  if (/(?:список|дай список|перечень|назови|помоги выбрать|выбрать вуз|выбрать университет)/i.test(q)) {
    return 'recommendation';
  }

  // Вопросы не по теме → general (чтобы "какая погода" не ловилось как recommendation из-за fuzzy "какая"→"какой")
  if (/(?:погод|дат|врем|число|месяц|год|сегодня|завтра|вчера|который час)/i.test(q)) {
    return 'general';
  }

  // Информационные вопросы про процесс поступления → general (ДО admission)
  if (/(?:как (?:подать|поступить|записаться|заявк)|процедур(?:а|у|ой)|заявлен|заявк|порядок|этап(?:ы|ов)|какие документ|список документов|пакет документов|какие нужны документ|как собрать|когда подавать|сроки подач|где подавать|подача заяв|вступительн|без вступительн)/i.test(q)) {
    return 'general';
  }
  if (/(?:мне\s+\d+\s+лет|возраст|сколько\s+лет|поступить\s+без\s+ент|без\s+ент|принимают\s+без)/i.test(q)) {
    return 'general';
  }

  // Проверяем admission ДО profession (чтобы "мои шансы в КБТУ на программиста" не ловилось как profession)
  const admCheck = INTENT_PATTERNS.find(i => i.name === 'admission');
  if (admCheck && admCheck.patterns.some(p => p.test(q))) {
    return 'admission';
  }

  // Вопросы-объяснения ("объясни как работает", "что такое") → general ДО profession (чтобы "объясни как работает система грантов" не ловилось как profession из-за "работа")
  if (/(?:как работает|объясни|что такое|объясн|расскажи|что значит)/i.test(q)) {
    return 'general';
  }

  // Проверяем profession ДО city (чтобы "кем работать с IT" не ловилось как city из-за fuzzy "it" → "city")
  const profCheck = INTENT_PATTERNS.find(i => i.name === 'profession');
  if (profCheck && profCheck.patterns.some(p => p.test(q))) {
    return 'profession';
  }

  for (const intent of INTENT_PATTERNS) {
    // Grant проверяем ДО admission (чтобы "гранты вузов" не ловилось как admission)
    if (intent.name === 'grant') {
      if (intent.patterns.some(p => p.test(q))) return 'grant';
      if (intent.keywords.some(k => q.includes(k))) return 'grant';
      continue;
    }
    if (intent.name === 'admission') {
      if (intent.patterns.some(p => p.test(q))) return 'admission';
      const kw = intent.keywords.some(k => q.includes(k));
      if (kw && (/\d{2,3}/.test(q) || q.includes('вуз') || q.includes('университет') || q.includes('university'))) return 'admission';
      continue;
    }
    // uni_info проверяется ДО цикла — пропускаем дубли
    if (intent.name === 'uni_info') {
      continue;
    }
    if (intent.patterns.some(p => p.test(q))) {
      return intent.name;
    }
    
    // Fuzzy match keywords for better accuracy (only if words are similar length)
    if (intent.keywords.some(k => q.includes(k))) {
      return intent.name;
    }
  }

  return 'general';
}

function extractParamsFromHistory(history) {
  if (!history || !Array.isArray(history) || history.length === 0) return {};
  const params = {};
  for (const msg of history) {
    const text = (msg.content || msg.text || '').toLowerCase();
    if (params.ent === undefined) {
      const entMatch = text.match(/(?:е?нт|бал[а-я]*)\s*:?\s*(\d{1,3})/i)
        || text.match(/(\d{1,3})\s*(?:бал[а-я]*)(?:\s*ент)?/i)
        || text.match(/(?:ent|unt|score)\s*:?\s*(\d{1,3})/i);
      if (entMatch) {
        const ent = parseInt(entMatch[1], 10);
        if (ent >= 0 && ent <= 140) params.ent = ent;
      }
    }
    if (params.budget === undefined) {
      const budgetMatch = text.match(/(?:бюджет|цен[ауе]|стоимост|максимум|до)\s*:?\s*(\d[\d\s]*(?:\d\s*)?₸?)/i)
        || text.match(/(\d[\d\s]*(?:000|₸))\s*(?:тенге|₸)?/i);
      if (budgetMatch) {
        const budget = parseInt(budgetMatch[1].replace(/\s/g, ''), 10);
        if (budget > 0 && budget < 10000000) params.budget = budget;
      }
    }
    if (params.language === undefined) {
      if (/(?:на|по|учить|учеба)\s+(?:английском|англ)/i.test(text)) params.language = 'english';
      else if (/(?:на|по|учить|учеба)\s+(?:русском|русск)/i.test(text)) params.language = 'russian';
      else if (/(?:на|по|учить|учеба)\s+(?:казахском|казах|қазақ)/i.test(text)) params.language = 'kazakh';
    }
    if (params.needDorm === undefined) {
      if (/общежит/i.test(text)) params.needDorm = true;
    }
  }
  return params;
}

function parseAdmissionQuery(message) {
  const q = (message || '').toLowerCase();
  const db = getDb();
  const result = { ent: null, university_id: null, specialty: null, budget: null, language: null, needDorm: null, attestat: null, cityId: null };

  const entPatterns = [
    /(?:е?нт|бал[а-я]*)\s*:?\s*(\d{1,3})/i,
    /(\d{1,3})\s*(?:бал[а-я]*)(?:\s*ент)?/i,
    // English patterns
    /(?:ent|unt|score)\s*:?\s*(\d{1,3})/i,
    /(\d{1,3})\s*(?:points?)(?:\s*(?:ent|unt))?/i,
  ];
  for (const p of entPatterns) {
    const m = q.match(p);
    if (m) { result.ent = parseInt(m[1], 10); break; }
  }

  if (result.ent !== null && (result.ent < 0 || result.ent > 140)) {
    result.ent = null;
  }

  try {
    const queryWords = new Set(q.toLowerCase().split(/[\s,?!.()«»"':;–—\-]+/).filter(Boolean));
    const unis = db.prepare('SELECT id, short_name, name FROM universities').all();
    for (const u of unis) {
      const shortLower = u.short_name.toLowerCase();
      const nameLower = u.name.toLowerCase();
      const shortWords = shortLower.split(/\s+/);
      const nameWords = nameLower.split(/\s+/);
      let matched = false;
      if (shortWords.length === 1) {
        if (queryWords.has(shortLower)) matched = true;
      } else {
        if (q.includes(shortLower)) matched = true;
      }
      if (!matched) {
        if (nameWords.length === 1) {
          if (queryWords.has(nameLower)) matched = true;
        } else {
          if (q.includes(nameLower)) matched = true;
        }
      }
      if (matched) { result.university_id = u.id; break; }
    }
  } catch (e) {}

  try {
    const queryWords = new Set(q.toLowerCase().split(/[\s,?!.()«»"':;–—\-]+/).filter(Boolean));
    const specs = db.prepare('SELECT name, category FROM specialties').all();
    for (const s of specs) {
      const sLower = s.name.toLowerCase();
      const cLower = s.category.toLowerCase();
      let matchedByName = false;
      let matchedByCategory = false;
      const sWords = sLower.split(/\s+/);
      const cWords = cLower.split(/\s+/);
      if (sWords.length === 1) {
        if (queryWords.has(sLower)) matchedByName = true;
      } else {
        if (q.includes(sLower)) matchedByName = true;
      }
      if (!matchedByName) {
        if (cWords.length === 1) {
          if (queryWords.has(cLower)) matchedByCategory = true;
        } else {
          if (q.includes(cLower)) matchedByCategory = true;
        }
      }
      if (matchedByName) {
        result.specialty = s.category;
        result.specialtyName = s.name;
        break;
      }
      if (matchedByCategory) {
        result.specialty = s.category;
        break;
      }
    }
  } catch (e) {}

  if (!result.specialty) {
    const specMap = {
      // RU — категории
      'it': 'Информационные технологии',
      'айти': 'Информационные технологии',
      'программирование': 'Информационные технологии',
      'программист': 'Информационные технологии',
      'програмист': 'Информационные технологии',
      'программная инженерия': 'Информационные технологии',
      'программное обеспечение': 'Информационные технологии',
      'computer science': 'Информационные технологии',
      'software': 'Информационные технологии',
      'разработка': 'Информационные технологии',
      'разработчик': 'Информационные технологии',
      'информационные технологии': 'Информационные технологии',
      'медицина': 'Медицина',
      'медицину': 'Медицина',
      'медсестра': 'Медицина',
      'медсестру': 'Медицина',
      'фармация': 'Медицина',
      'фармацию': 'Медицина',
      'врач': 'Медицина',
      'врача': 'Медицина',
      'доктор': 'Медицина',
      'доктора': 'Медицина',
      'экономика': 'Бизнес',
      'экономику': 'Бизнес',
      'бизнес': 'Бизнес',
      'бизнеса': 'Бизнес',
      'финансы': 'Бизнес',
      'финансы': 'Бизнес',
      'финансов': 'Бизнес',
      'менеджмент': 'Бизнес',
      'маркетинг': 'Бизнес',
      'маркетинга': 'Бизнес',
      'право': 'Гуманитарные науки',
      'права': 'Гуманитарные науки',
      'юрист': 'Гуманитарные науки',
      'юриста': 'Гуманитарные науки',
      'юриспруденция': 'Гуманитарные науки',
      'инженерия': 'Инженерия',
      'инженерию': 'Инженерия',
      'инженер': 'Инженерия',
      'инженера': 'Инженерия',
      'строитель': 'Инженерия',
      'строителя': 'Инженерия',
      'гуманитарные': 'Гуманитарные науки',
      'психология': 'Здоровье',
      'психологию': 'Здоровье',
      'психолог': 'Здоровье',
      'психолога': 'Здоровье',
      'психологом': 'Здоровье',
      'образование': 'Образование',
      'образования': 'Образование',
      'педагог': 'Образование',
      'педагога': 'Образование',
      'учитель': 'Образование',
      'учителя': 'Образование',
      'преподаватель': 'Образование',
      'искусство': 'Искусство',
      'искусства': 'Искусство',
      'дизайн': 'Искусство',
      'дизайна': 'Искусство',
      'дизайнер': 'Искусство',
      'дизайнера': 'Искусство',
      'туризм': 'Туризм',
      'туризма': 'Туризм',
      'фармацевтика': 'Медицина',
      'фармацевтика': 'Медицина',
      'фармацевт': 'Медицина',
      'кибербезопасность': 'Информационные технологии',
      'кибербезопасности': 'Информационные технологии',
      'сетевые технологии': 'Информационные технологии',
      // Нефть/горное дело/геология
      'нефтяное дело': 'Инженерия',
      'нефть': 'Инженерия',
      'нефти': 'Инженерия',
      'нефтяник': 'Инженерия',
      'нефтяника': 'Инженерия',
      'горное дело': 'Инженерия',
      'горняк': 'Инженерия',
      'горняка': 'Инженерия',
      'шахтёр': 'Инженерия',
      // Строительство/архитектура/энергетика
      'архитектор': 'Инженерия',
      'архитектора': 'Инженерия',
      'энергетика': 'Инженерия',
      'энергетику': 'Инженерия',
      'авиация': 'Инженерия',
      'aviation': 'Инженерия',
      // Естественные науки
      'геология': 'Естественные науки',
      'геолог': 'Естественные науки',
      'химия': 'Естественные науки',
      'химик': 'Естественные науки',
      'физика': 'Естественные науки',
      'физик': 'Естественные науки',
      'биология': 'Естественные науки',
      'биолог': 'Естественные науки',
      'экология': 'Естественные науки',
      'эколог': 'Естественные науки',
      // Сельское хозяйство
      'сельское хозяйство': 'Сельское хозяйство',
      'агрономия': 'Сельское хозяйство',
      'агроном': 'Сельское хозяйство',
      'ветеринария': 'Сельское хозяйство',
      'ветеринар': 'Сельское хозяйство',
      // Искусство
      'музыка': 'Искусство',
      'музыкант': 'Искусство',
      // Образование
      'спорт': 'Образование',
      'физкультура': 'Образование',
      'педагогика': 'Образование',
      // Медицина
      'сестринское дело': 'Медицина',
      'медсестра': 'Медицина',
      'фармация': 'Медицина',
      'аптека': 'Медицина',
      // Гуманитарные науки
      'история': 'Гуманитарные науки',
      'историк': 'Гуманитарные науки',
      'философия': 'Гуманитарные науки',
      'журналистика': 'Гуманитарные науки',
      'социология': 'Гуманитарные науки',
      'лингвистика': 'Гуманитарные науки',
      'переводчик': 'Гуманитарные науки',
      // Общественные науки
      'международные отношения': 'Общественные науки',
      'политология': 'Общественные науки',
      'политолог': 'Общественные науки',
      // Бизнес
      'бухгалтер': 'Бизнес',
      'юриспруденция': 'Гуманитарные науки',
      // KK
      'ақпараттық технологиялар': 'Информационные технологии',
      'бағдарламалау': 'Информационные технологии',
      'бағдарламашы': 'Информационные технологии',
      'медицина': 'Медицина',
      'дәрігер': 'Медицина',
      'экономика': 'Бизнес',
      'бизнес': 'Бизнес',
      'қаржы': 'Бизнес',
      'менеджмент': 'Бизнес',
      'маркетинг': 'Бизнес',
      'құқық': 'Гуманитарные науки',
      'заңгер': 'Гуманитарные науки',
      'инженерия': 'Инженерия',
      'инженер': 'Инженерия',
      'гуманитарлық': 'Гуманитарные науки',
      'психология': 'Здоровье',
      'психолог': 'Здоровье',
      'білім': 'Образование',
      'педагог': 'Образование',
      'мұғалім': 'Образование',
      'өнер': 'Искусство',
      'дизайн': 'Искусство',
      'дизайнер': 'Искусство',
      'туризм': 'Туризм',
      // KK — нефть/геология/сельхоз
      'мұнай ісі': 'Инженерия',
      'мұнай': 'Инженерия',
      'тау ісі': 'Инженерия',
      'геология': 'Естественные науки',
      'химия': 'Естественные науки',
      'физика': 'Естественные науки',
      'биология': 'Естественные науки',
      'экология': 'Естественные науки',
      'ауыл шаруашылығы': 'Сельское хозяйство',
      'агрономия': 'Сельское хозяйство',
      'ветеринария': 'Сельское хозяйство',
      'музыка': 'Искусство',
      'спорт': 'Образование',
      'педагогика': 'Образование',
      'медбике': 'Медицина',
      'фармация': 'Медицина',
      'құрылыс': 'Инженерия',
      'архитектор': 'Инженерия',
      'энергетика': 'Инженерия',
      'тарих': 'Гуманитарные науки',
      'философия': 'Гуманитарные науки',
      'журналистика': 'Гуманитарные науки',
      'социология': 'Гуманитарные науки',
      'лингвистика': 'Гуманитарные науки',
      'халықаралық қатынастар': 'Общественные науки',
      'саясаттану': 'Общественные науки',
      'бухгалтер': 'Бизнес',
      // EN
      'information technology': 'Информационные технологии',
      'programming': 'Информационные технологии',
      'developer': 'Информационные технологии',
      'medicine': 'Медицина',
      'doctor': 'Медицина',
      'economics': 'Бизнес',
      'business': 'Бизнес',
      'finance': 'Бизнес',
      'management': 'Бизнес',
      'marketing': 'Бизнес',
      'law': 'Гуманитарные науки',
      'lawyer': 'Гуманитарные науки',
      'engineering': 'Инженерия',
      'engineer': 'Инженерия',
      'humanities': 'Гуманитарные науки',
      'psychology': 'Здоровье',
      'psychologist': 'Здоровье',
      'education': 'Образование',
      'teacher': 'Образование',
      'art': 'Искусство',
      'design': 'Искусство',
      'designer': 'Искусство',
      'tourism': 'Туризм',
      'pharmacy': 'Медицина',
      'pharmacist': 'Медицина',
      'cybersecurity': 'Информационные технологии',
      // EN — нефть/геология/сельхоз
      'petroleum': 'Инженерия',
      'oil': 'Инженерия',
      'mining': 'Инженерия',
      'geology': 'Естественные науки',
      'geologist': 'Естественные науки',
      'chemistry': 'Естественные науки',
      'physics': 'Естественные науки',
      'biology': 'Естественные науки',
      'ecology': 'Естественные науки',
      'agriculture': 'Сельское хозяйство',
      'farming': 'Сельское хозяйство',
      'veterinary': 'Сельское хозяйство',
      'music': 'Искусство',
      'sport': 'Образование',
      'nursing': 'Медицина',
      'architecture': 'Инженерия',
      'aviation': 'Инженерия',
      'energy': 'Инженерия',
      'history': 'Гуманитарные науки',
      'philosophy': 'Гуманитарные науки',
      'journalism': 'Гуманитарные науки',
      'sociology': 'Гуманитарные науки',
      'linguistics': 'Гуманитарные науки',
      'international relations': 'Общественные науки',
      'political science': 'Общественные науки',
      'accounting': 'Бизнес',
    };
    for (const [key, val] of Object.entries(specMap)) {
      if (q.includes(key)) { result.specialty = val; break; }
    }
    // specialtyName map for display
    const specNameMap = {
      'психолог': 'Психология',
      'психолога': 'Психология',
      'психологом': 'Психология',
      'программист': 'Разработка программного обеспечения',
      'программирование': 'Разработка программного обеспечения',
      'врач': 'Медицина',
      'доктор': 'Медицина',
      'юрист': 'Право',
      'инженер': 'Инженерия',
      'педагог': 'Педагогика',
      'учитель': 'Педагогика',
      'дизайнер': 'Дизайн',
      'финансист': 'Финансы',
      'маркетолог': 'Маркетинг',
      'экономист': 'Экономика',
      'менеджер': 'Бизнес и менеджмент',
      'психолог': 'Психология',
    };
    if (!result.specialtyName) {
      for (const [key, val] of Object.entries(specNameMap)) {
        if (q.includes(key)) { result.specialtyName = val; break; }
      }
    }
  }

  const budgetMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:млн|миллион|млн|миллион)/i);
  if (budgetMatch) result.budget = Math.round(parseFloat(budgetMatch[1]) * 1000000);

  const budgetThous = q.match(/(\d+)\s*(?:тыс|k|мың)\s*(?:тг|тенге)?/i);
  if (budgetThous) result.budget = parseInt(budgetThous[1], 10) * 1000;

  if (q.includes('английск') || q.includes('english') || q.includes('ағылшын')) result.language = 'Английский';
  else if (q.includes('казахск') || q.includes('казах') || q.includes('қазақ')) result.language = 'Казахский';
  else if (q.includes('русск') || q.includes('рус') || q.includes('орыс')) result.language = 'Русский';

  result.needDorm = q.includes('общежитие') || q.includes('проживан') || q.includes('жатақхана') || q.includes('dormitory');

  // Извлечение города
  try {
    const cities = db.prepare('SELECT id, name FROM cities').all();
    for (const c of cities) {
      const cityNameLower = c.name.toLowerCase();
      // Проверяем точное совпадение или по стемму (первые N-1 символов)
      // Это покрывает падежи: Алматы → Алмате, Астана → Астане и т.д.
      const stem = cityNameLower.slice(0, -1); // убираем последний символ
      if (q.includes(cityNameLower) || q.includes(stem)) {
        result.cityId = c.id;
        result.cityName = c.name;
        break;
      }
    }
  } catch (e) {}

  // Определяем ценовой запрос
  result.wantsBudget = /бюджетн|дешевл|недорог|эконом|сам[а-я]* дешев|по cheaper/i.test(q);

  return result;
}

function extractBudget(question) {
  if (!question) return null;
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:млн|миллион)/i,
    /(\d+)\s*(?:тыс|k)/i,
    /(\d{6,})/,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      if (question.toLowerCase().includes('млн') || question.toLowerCase().includes('миллион')) {
        value *= 1000000;
      } else if (question.match(/\d+\s*(?:тыс|k)/i)) {
        value *= 1000;
      }
      return Math.round(value);
    }
  }
  return null;
}

function extractSpecialties(question) {
  if (!question) return [];
  const q_lower = question.toLowerCase();
  const db = getDb();
  const allSpecialties = [];
  const categoryMap = {};
  try {
    const stmt = db.prepare('SELECT DISTINCT name, category FROM specialties');
    const rows = stmt.all();
    rows.forEach(row => {
      allSpecialties.push(row.name, row.category);
      categoryMap[row.category.toLowerCase()] = row.category;
    });
  } catch (err) {
    console.error('[ai-service] error fetching specialties:', err.message);
  }

  const matched = [];
  allSpecialties.forEach(spec => {
    const spec_lower = spec.toLowerCase();
    if (q_lower.includes(spec_lower)) {
      matched.push(spec);
    }
  });

  const keywordToCategoryMap = {
    'информационные технологии': 'Информационные технологии',
    'программирование': 'Информационные технологии',
    'программист': 'Информационные технологии',
    'программная инженерия': 'Информационные технологии',
    'программное обеспечение': 'Информационные технологии',
    'разработка': 'Информационные технологии',
    'разработчик': 'Информационные технологии',
    'it': 'Информационные технологии',
    'айти': 'Информационные технологии',
    'software': 'Информационные технологии',
    'кибербезопасность': 'Информационные технологии',
    'сетевые технологии': 'Информационные технологии',
    'медицина': 'Медицина',
    'врач': 'Медицина',
    'доктор': 'Медицина',
    'фармацевтика': 'Медицина',
    'фармацевт': 'Медицина',
    'экономика': 'Бизнес',
    'финансы': 'Бизнес',
    'бизнес': 'Бизнес',
    'менеджмент': 'Бизнес',
    'маркетинг': 'Бизнес',
    'право': 'Гуманитарные науки',
    'юрист': 'Гуманитарные науки',
    'юриспруденция': 'Гуманитарные науки',
    'инженерия': 'Инженерия',
    'инженер': 'Инженерия',
    'строитель': 'Инженерия',
    'техническая': 'Инженерия',
    'психология': 'Здоровье',
    'психолог': 'Здоровье',
    'дизайн': 'Искусство',
    'дизайнер': 'Искусство',
    'туризм': 'Туризм',
    'образование': 'Образование',
    'учитель': 'Образование',
    'педагог': 'Образование',
    'преподаватель': 'Образование',
    // Нефть/горное дело/геология
    'нефтяное дело': 'Инженерия',
    'нефть': 'Инженерия',
    'горное дело': 'Инженерия',
    'архитектор': 'Инженерия',
    'энергетика': 'Инженерия',
    'авиация': 'Инженерия',
    // Естественные науки
    'геология': 'Естественные науки',
    'химия': 'Естественные науки',
    'физика': 'Естественные науки',
    'биология': 'Естественные науки',
    'экология': 'Естественные науки',
    // Сельское хозяйство
    'сельское хозяйство': 'Сельское хозяйство',
    'агрономия': 'Сельское хозяйство',
    'ветеринария': 'Сельское хозяйство',
    // Искусство
    'музыка': 'Искусство',
    // Образование
    'спорт': 'Образование',
    'физкультура': 'Образование',
    'педагогика': 'Образование',
    // Медицина
    'медсестра': 'Медицина',
    'сестринское дело': 'Медицина',
    'фармация': 'Медицина',
    // Гуманитарные науки
    'история': 'Гуманитарные науки',
    'философия': 'Гуманитарные науки',
    'журналистика': 'Гуманитарные науки',
    'социология': 'Гуманитарные науки',
    'лингвистика': 'Гуманитарные науки',
    // Общественные науки
    'международные отношения': 'Общественные науки',
    'политология': 'Общественные науки',
    // Бизнес
    'бухгалтер': 'Бизнес',
  };

  for (const [keyword, realCategory] of Object.entries(keywordToCategoryMap)) {
    if (q_lower.includes(keyword)) {
      matched.push(realCategory);
    }
  }

  return [...new Set(matched)];
}

function extractLanguages(question) {
  if (!question) return [];
  const q_lower = question.toLowerCase();
  const languages = [];
  if (q_lower.includes('английск') || q_lower.includes('english')) languages.push('Английский');
  if (q_lower.includes('казах') || q_lower.includes('kazakh')) languages.push('Казахский');
  if (q_lower.includes('русск') || q_lower.includes('russian')) languages.push('Русский');
  return languages;
}

// ==================== PROFESSION HANDLER ====================

function handleProfessionQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const profession = findProfession(msg);

  if (!profession) {
    // Попробуем найти по специальности — ищем по category ключевым словам
    const db = getDb();
    const qLower = msg.toLowerCase();
    
    // Прямое соответствие категорий
    const categoryMap = {
      'it': 'Информационные технологии',
      'айти': 'Информационные технологии',
      'программ': 'Информационные технологии',
      'компьютер': 'Информационные технологии',
      'медицин': 'Медицина',
      'врач': 'Медицина',
      'психолог': 'Здоровье',
      'экономик': 'Бизнес',
      'бизнес': 'Бизнес',
      'финанс': 'Бизнес',
      'право': 'Гуманитарные науки',
      'юрид': 'Гуманитарные науки',
      'инженер': 'Инженерия',
      'строитель': 'Инженерия',
      'дизайн': 'Искусство',
      'артист': 'Искусство',
      'музык': 'Искусство',
      'учител': 'Образование',
      'педагог': 'Образование',
    };
    
    let matchedCategory = null;
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (qLower.includes(keyword)) {
        matchedCategory = category;
        break;
      }
    }
    
    if (matchedCategory) {
      const specs = db.prepare('SELECT id, name, category FROM specialties WHERE category = ?').all(matchedCategory);
      const allProfs = [];
      for (const s of specs) {
        const profs = getProfessionsBySpecialty(s.id);
        allProfs.push(...profs);
      }
      // Убираем дубликаты
      const uniqueProfs = [...new Map(allProfs.map(p => [p.id, p])).values()];
      if (uniqueProfs.length > 0) {
        let text = (tr('prof_for_spec', lang) || 'Для направления «${spec}» доступны профессии:\n\n').replace('${spec}', matchedCategory);
        uniqueProfs.forEach(p => {
          const title = p.title[lang] || p.title.ru;
          const desc = p.description[lang] || p.description.ru;
          text += `• **${title}** — ${desc}\n`;
        });
        text += '\n' + (tr('prof_ask_detail', lang) || 'Напишите название профессии для подробной информации.');
        return {
          answer: text,
          matches: [],
          usedData: { profession: null, specialties_matched: specs.map(s => s.name) },
          fallback: false,
          confidence: 0.8,
          took_ms: Date.now() - startTime,
          intent: 'profession',
        };
      }
    }
    
    // Если всё ещё не нашли — пробуем по specialties таблице
    const specs = db.prepare('SELECT id, name, category FROM specialties').all();
    let matchedSpec = null;
    for (const s of specs) {
      if (qLower.includes(s.name.toLowerCase()) || qLower.includes(s.category.toLowerCase())) {
        matchedSpec = s;
        break;
      }
    }

    if (matchedSpec) {
      const profs = getProfessionsBySpecialty(matchedSpec.id);
      if (profs.length > 0) {
        let text = (tr('prof_for_spec', lang) || 'Для специальности «${spec}» доступны профессии:\n\n').replace('${spec}', matchedSpec.name);
        profs.forEach(p => {
          const title = p.title[lang] || p.title.ru;
          const desc = p.description[lang] || p.description.ru;
          text += `• **${title}** — ${desc}\n`;
        });
        text += '\n' + (tr('prof_ask_detail', lang) || 'Напишите название профессии для подробной информации.');
        return {
          answer: text,
          matches: [],
          usedData: { profession: null, specialties_matched: [matchedSpec.name] },
          fallback: false,
          confidence: 0.8,
          took_ms: Date.now() - startTime,
          intent: 'profession',
        };
      }
    }

    // Если спрашивают про зарплату в целом — покажем все профессии
    if (/(?:зарплат|оклад|salary|жалақы)/i.test(qLower)) {
      const { PROFESSIONS: allProfs } = require('./profession-data');
      let text = lang === 'kk' ? '💰 **Мамандықтар бойынша орташа жалақы:**\n\n'
        : lang === 'en' ? '💰 **Average salaries by profession:**\n\n'
        : '💰 **Средняя зарплата по профессиям:**\n\n';
      allProfs.forEach(p => {
        const title = p.title[lang] || p.title.ru;
        const s = p.salary;
        text += `• **${title}**: ${s.min?.toLocaleString()} — ${s.max?.toLocaleString()}₸ (ср. ${s.avg?.toLocaleString()}₸)\n`;
      });
      text += lang === 'kk' ? '\nНазар аударыңыз: нақты жалақы тәжірибе мен компанияға байланысты.\nЖазыңыз: «Программист жалақысы» — нақтырақ ақпарат аласыз.'
        : lang === 'en' ? '\nNote: actual salary depends on experience and company.\nType a profession name (e.g. "Programmer") for details.'
        : '\nОбратите внимание: реальная зарплата зависит от опыта и компании.\nНапишите название профессии (например, "Программист") для подробностей.';
      return {
        answer: text,
        matches: [],
        usedData: { salary_overview: true },
        fallback: false,
        confidence: 0.7,
        took_ms: Date.now() - startTime,
        intent: 'profession',
      };
    }

    return {
      answer: tr('prof_not_found', lang) || 'Я не нашёл такую профессию. Попробуйте:\n• Психолог\n• Программист\n• Врач\n• Экономист\n• Юрист\n• Дизайнер\n• Учитель\n• Инженер\n• Маркетолог\n• Фармацевт',
      matches: [],
      usedData: { profession: null },
      fallback: false,
      confidence: 0.5,
      took_ms: Date.now() - startTime,
      intent: 'profession',
    };
  }

  const db = getDb();
  const profContext = formatProfessionForContext(profession, lang);

  // Получаем вузы для этой профессии
  const uniIds = profession.universities || [];
  let universities = [];
  if (uniIds.length > 0) {
    const placeholders = uniIds.map(() => '?').join(',');
    try {
      universities = db.prepare(`
        SELECT u.id, u.short_name, u.name, u.qs_world, u.price_from, u.price_to, u.city_id,
               c.name as city_name
        FROM universities u
        LEFT JOIN cities c ON u.city_id = c.id
        WHERE u.id IN (${placeholders})
      `).all(...uniIds);
    } catch (e) {}
  }

  // Если вузов нет по ID, ищем по специальностям
  if (universities.length === 0 && profession.specialties.length > 0) {
    const specPlaceholders = profession.specialties.map(() => '?').join(',');
    try {
      universities = db.prepare(`
        SELECT DISTINCT u.id, u.short_name, u.name, u.qs_world, u.price_from, u.price_to, u.city_id,
               c.name as city_name
        FROM universities u
        JOIN university_specialties us ON u.id = us.university_id
        LEFT JOIN cities c ON u.city_id = c.id
        WHERE us.specialty_id IN (${specPlaceholders})
        ORDER BY u.qs_world ASC NULLS LAST
        LIMIT 6
      `).all(...profession.specialties);
    } catch (e) {}
  }

  const title = profession.title[lang] || profession.title.ru;
  const titleGen = profession.titleGen[lang] || profession.titleGen.ru;
  const desc = profession.description[lang] || profession.description.ru;
  const salary = profession.salary;
  const demand = profession.demandLevel[lang] || profession.demandLevel.ru;
  const skills = (profession.skills[lang] || profession.skills.ru);
  const careerPath = profession.careerPath[lang] || profession.careerPath.ru;

  let text = `## 🎓 ${title}\n\n${desc}\n\n`;
  text += `💰 **${tr('prof_salary', lang) || 'Зарплата'}:** ${salary.min.toLocaleString()} — ${salary.max.toLocaleString()}₸\n`;
  text += `   ${tr('prof_avg', lang) || 'Средняя'}: ${salary.avg.toLocaleString()}₸\n`;
  text += `📊 **${tr('prof_demand', lang) || 'Спрос'}:** ${demand}\n\n`;

  text += `🛠 **${tr('prof_skills', lang) || 'Навыки'}:**\n`;
  skills.forEach(s => { text += `• ${s}\n`; });

  text += `\n📈 **${tr('prof_career', lang) || 'Карьерный путь'}:** ${careerPath}\n\n`;

  if (universities.length > 0) {
    const titleWord = (lang === 'kk') ? 'Университеттер' : (lang === 'en') ? 'Universities' : 'Университеты';
    text += `🏛 **${tr('prof_unis', lang) || titleWord}:**\n`;
    universities.forEach(u => {
      const qs = u.qs_world ? ` (QS #${u.qs_world})` : '';
      const city = u.city_name ? `, ${u.city_name}` : '';
      const price = u.price_from ? ` — ${u.price_from.toLocaleString()}₸/год` : '';
      text += `• **${u.short_name || u.name}**${qs}${city}${price}\n`;
    });
    text += `\n💡 ${tr('prof_advice', lang) || 'Чтобы узнать шансы поступления, напишите: «Мои шансы в [вуз] на [направление] с ЕНТ [балл]»'}`;
  }

  return {
    answer: text,
    matches: [],
    usedData: { profession: profession.id, universities_count: universities.length },
    fallback: false,
    confidence: 0.9,
    took_ms: Date.now() - startTime,
    intent: 'profession',
  };
}

// ==================== UNI INFO HANDLER ====================

function handleUniInfoQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const q = msg.toLowerCase();

  // Ищем упоминание конкретного вуза
  const uniAliases = {
    'кбту': 'КБТУ', 'казну': 'КазНУ', 'назарбаев': 'НУ',
    'ену': 'ЕНУ', 'муит': 'МУИТ', 'кимэп': 'KIMEP', 'kimep': 'KIMEP',
    'усд': 'УСД', 'сду': 'УСД', 'atu': 'АТУ', 'казнму': 'КазНМУ',
    'туран-астана': 'Туран-Астана', 'туран': 'Туран',
    'мгу': 'МГУ', 'кгт': 'КГТУ', 'каргт': 'КарГТУ', 'кен': 'СКГУ',
  };

  let foundUni = null;
  for (const [alias, name] of Object.entries(uniAliases)) {
    if (q.includes(alias)) {
      foundUni = db.prepare('SELECT * FROM universities WHERE short_name = ? OR name LIKE ?').get(name, `%${name}%`);
      break;
    }
  }

  // Если не нашли по алиасу, пробуем найти по ключевым словам
  if (!foundUni) {
    const allUnis = db.prepare('SELECT * FROM universities').all();
    for (const u of allUnis) {
      const shortLower = (u.short_name || '').toLowerCase();
      const nameLower = (u.name || '').toLowerCase();
      if (shortLower && q.includes(shortLower)) { foundUni = u; break; }
      if (nameLower && nameLower.length > 5 && q.includes(nameLower.substring(0, 8))) { foundUni = u; break; }
    }
  }

  if (!foundUni) {
    return {
      answer: tr('uni_info_not_found', lang) || 'Не удалось найти конкретный университет. Укажите название, например: «Сколько стоит обучение в КБТУ?»',
      matches: [],
      usedData: {},
      fallback: false,
      confidence: 0.5,
      took_ms: Date.now() - startTime,
      intent: 'uni_info',
    };
  }

  // Определяем что именно спрашивают
  const isPrice = /сколько стоит|цена|стоимость|оплат|бюджет|қанша тұрады|бағасы|cost|price|tuition/i.test(q);
  const isDorm = /общежитие|общага|проживан|жатақхана|dormitory|dorm/i.test(q);
  const isRanking = /рейтинг|ранг|место|позиция|qs|ranking|position|rating/i.test(q);
  const isEnt = /средний балл|минимальный балл|проходной|порог|ент|балл/i.test(q);
  const isDocs = /документ|бумаг|пакет|поступ|процедур|как поступить|подавать/i.test(q);

  // Парсим JSON поля
  const languages = foundUni.languages ? (typeof foundUni.languages === 'string' ? JSON.parse(foundUni.languages) : foundUni.languages) : [];

  let text = `## ${foundUni.short_name || foundUni.name}\n\n`;

  if (isPrice) {
    text += `### 💰 Стоимость обучения\n`;
    text += `• От **${foundUni.price_from?.toLocaleString() || '—'}** до **${foundUni.price_to?.toLocaleString() || '—'}** тг/год\n`;
    if (foundUni.dorm_price) text += `• Общежитие: **${foundUni.dorm_price.toLocaleString()}** тг/год\n`;
    text += `\n`;
  } else if (isDorm) {
    text += `### 🏠 Общежитие\n`;
    text += foundUni.has_dorm
      ? `✅ Общежитие есть\n${foundUni.dorm_price ? `💰 Стоимость: **${foundUni.dorm_price.toLocaleString()}** тг/год\n` : ''}`
      : `❌ Общежития нет\n`;
    text += `\n`;
  } else if (isRanking) {
    text += `### 🏆 Рейтинг\n`;
    if (foundUni.qs_world) text += `• QS World: **#${foundUni.qs_world}**\n`;
    if (foundUni.qs_asia) text += `• QS Asia: **#${foundUni.qs_asia}**\n`;
    if (!foundUni.qs_world && !foundUni.qs_asia) text += `• Рейтинг QS не указан\n`;
    text += `\n`;
  } else if (isEnt) {
    text += `### 📊 ЕНТ пороги\n`;
    const reqs = db.prepare('SELECT s.name, ar.min_ent, ar.avg_ent, ar.grant_min_ent FROM admission_requirements ar JOIN specialties s ON ar.specialty_id = s.id WHERE ar.university_id = ? ORDER BY ar.grant_min_ent DESC LIMIT 10').all(foundUni.id);
    if (reqs.length > 0) {
      reqs.forEach(r => {
        text += `• **${r.name}**: мин. ${r.min_ent}, ср. ${r.avg_ent}, грант ${r.grant_min_ent}\n`;
      });
    } else {
      text += `• Данные по ЕНТ пока не загружены\n`;
    }
    text += `\n`;
  } else if (isDocs) {
    text += `### 📄 Документы для поступления\n`;
    text += `1. Аттестат о среднем образовании\n`;
    text += `2. Результаты ЕНТ (если требуются)\n`;
    text += `3. Паспорт (или свидетельство о рождении)\n`;
    text += `4. Фотографии 3×4 (6 шт.)\n`;
    text += `5. Медицинская справка\n`;
    text += `6. Документы, подтверждающие льготы (если есть)\n\n`;
    text += `📅 **Сроки подачи:** июль–август\n`;
    text += `🌐 Подача онлайн: **egov.kz**\n`;
    text += `\n⚠️ Точный список уточняйте на сайте вуза.\n`;
  } else {
    // Общая информация
    text += `📍 Город: ${foundUni.city_name || '—'}\n`;
    if (foundUni.founded) text += `📅 Основан: ${foundUni.founded}\n`;
    if (foundUni.students_count) text += `👥 Студентов: ${foundUni.students_count.toLocaleString()}\n`;
    text += `💰 Стоимость: ${foundUni.price_from?.toLocaleString() || '—'} – ${foundUni.price_to?.toLocaleString() || '—'} тг/год\n`;
    if (foundUni.has_dorm) text += `🏠 Общежитие: ✅ (${foundUni.dorm_price?.toLocaleString() || '—'} тг/год)\n`;
    if (languages.length) text += `🌐 Языки: ${languages.join(', ')}\n`;
    if (foundUni.qs_world) text += `🏆 QS World: #${foundUni.qs_world}\n`;
    if (foundUni.qs_asia) text += `🏆 QS Asia: #${foundUni.qs_asia}\n`;
    if (foundUni.website) text += `🌐 Сайт: ${foundUni.website}\n`;
    text += `\n`;
    // Специальности
    const specs = db.prepare('SELECT s.name FROM university_specialties us JOIN specialties s ON us.specialty_id = s.id WHERE us.university_id = ? LIMIT 8').all(foundUni.id);
    if (specs.length > 0) {
      text += `📚 **Направления:** ${specs.map(s => s.name).join(', ')}\n`;
    }
  }

  return {
    answer: text,
    matches: [foundUni],
    usedData: { university: foundUni.short_name },
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'uni_info',
  };
}

// ==================== CITY HANDLER ====================

function handleCityQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();

  // Анализируем запрос на предмет баллов и специальности
  const params = parseAdmissionQuery(msg);
  const hasEnt = params.ent !== null;
  const qLower = msg.toLowerCase();

  // Проверяем, спрашивает ли пользователь о конкретном городе
  const isSpecificCityQuery = /каки[еяй]\s+(?:универ|вуз)|в\s+(?:каком|этом)\s+город|покажи\s+(?:вузы|университеты)\s+в|вуз(?:ы|ов)?\s+(?:в|городе)|вуз.*(?:в|городе)/i.test(qLower);

  // Определяем ВСЕ города из запроса (для multi-city)
  let specificCities = [];
  try {
    const cities = db.prepare('SELECT id, name FROM cities').all();
    for (const c of cities) {
      const cityNameLower = c.name.toLowerCase();
      const stem = cityNameLower.slice(0, -1);
      if (qLower.includes(cityNameLower) || qLower.includes(stem)) {
        specificCities.push(c);
      }
    }
  } catch (e) {}
  
  // Если只有一个 город из parseAdmissionQuery — используем его
  if (specificCities.length === 0 && params.cityId) {
    specificCities = [{ id: params.cityId, name: params.cityName }];
  }

  // Если конкретный город — показываем вузы этого города
  if (specificCities.length === 1) {
    const specificCity = specificCities[0];
    let query = `
      SELECT
        u.id, u.short_name, u.name, u.qs_world, u.qs_asia,
        u.price_from, u.price_to, u.has_dorm, u.founded,
        u.students_count, u.languages,
        COUNT(DISTINCT s.id) as spec_count,
        AVG(ar.avg_ent) as avg_ent,
        MIN(ar.min_ent) as min_ent,
        MAX(ar.grant_min_ent) as max_grant_ent
      FROM universities u
      LEFT JOIN university_specialties us ON u.id = us.university_id
      LEFT JOIN specialties s ON us.specialty_id = s.id
      LEFT JOIN admission_requirements ar ON ar.university_id = u.id AND ar.specialty_id = s.id
      WHERE u.city_id = ?
    `;
    const queryParams = [specificCity.id];

    if (params.ent) {
      query += ' AND ar.min_ent <= ?';
      queryParams.push(params.ent);
    }
    if (params.specialty) {
      query += ' AND s.category = ?';
      queryParams.push(params.specialty);
    }
    if (params.needDorm) {
      query += ' AND u.has_dorm = 1';
    }
    if (params.language) {
      query += ` AND u.languages LIKE '%${params.language}%'`;
    }
    if (params.budget) {
      query += ' AND u.price_from <= ?';
      queryParams.push(params.budget);
    }

    query += ' GROUP BY u.id ORDER BY avg_ent DESC, u.qs_world ASC NULLS LAST';

    const unis = db.prepare(query).all(...queryParams);

    if (!unis.length) {
      return {
        answer: `В городе ${specificCity.name} вузов${params.specialty ? ` по направлению "${params.specialty}"` : ''} не найдено.`,
        matches: [],
        usedData: { city: specificCity.name, universities_count: 0 },
        fallback: false,
        confidence: 0.5,
        took_ms: Date.now() - startTime,
        intent: 'city',
      };
    }

    let text = `🏙 **${specificCity.name}** — ${unis.length} ${unis.length === 1 ? 'вуз' : unis.length < 5 ? 'вуза' : 'вузов'}`;
    if (params.specialty) text += ` | ${params.specialty}`;
    if (params.ent) text += ` | ЕНТ ≤ ${params.ent}`;
    text += ':\n\n';

    unis.forEach((u, i) => {
      const qs = u.qs_world ? `QS #${u.qs_world}` : '';
      const price = u.price_from ? `${u.price_from.toLocaleString()}–${(u.price_to || u.price_from).toLocaleString()}₸` : '—';
      const langs = u.languages ? JSON.parse(u.languages).join(', ') : '—';
      const dorm = u.has_dorm ? '🏠' : '';
      const avgEnt = u.avg_ent ? Math.round(u.avg_ent) : '—';
      const minEnt = u.min_ent || '—';
      const grantEnt = u.max_grant_ent || '—';

      text += `**${i + 1}. ${u.short_name || u.name}**`;
      if (qs) text += ` (${qs})`;
      if (dorm) text += ' 🏠';
      text += `\n   💰 ${price} | 🌐 ${langs}`;
      if (u.spec_count > 0) text += ` | 📚 ${u.spec_count} ${u.spec_count === 1 ? 'спец.' : 'спец.'}`;
      text += `\n   📊 средний ЕНТ ${avgEnt}, мин. ${minEnt}, грант до ${grantEnt}\n\n`;
    });

    text += `💡 Напишите *"Мои шансы в [вуз] на [направление] с ЕНТ [балл]"* для расчёта вероятности.`;

    return {
      answer: text,
      matches: [],
      usedData: { city: specificCity.name, universities_count: unis.length, specialty: params.specialty },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'city',
    };
  }

  // Получаем статистику по городам
  let cityStats;
  if (hasEnt && params.specialty) {
    // С конкретной специальностью
    cityStats = db.prepare(`
      SELECT
        c.name as city,
        c.id as city_id,
        COUNT(DISTINCT u.id) as uni_count,
        COUNT(DISTINCT ar.specialty_id) as spec_count,
        AVG(ar.avg_ent) as avg_ent,
        MIN(ar.min_ent) as min_ent,
        MAX(ar.grant_min_ent) as max_grant_ent
      FROM admission_requirements ar
      JOIN universities u ON ar.university_id = u.id
      JOIN cities c ON u.city_id = c.id
      JOIN specialties s ON ar.specialty_id = s.id
      WHERE s.category = ? AND ar.min_ent <= ?
      GROUP BY c.id, c.name
      ORDER BY uni_count DESC, avg_ent ASC
    `).all(params.specialty, params.ent);
  } else if (hasEnt) {
    // Только балл
    cityStats = db.prepare(`
      SELECT
        c.name as city,
        c.id as city_id,
        COUNT(DISTINCT u.id) as uni_count,
        COUNT(DISTINCT ar.specialty_id) as spec_count,
        AVG(ar.avg_ent) as avg_ent,
        MIN(ar.min_ent) as min_ent,
        MAX(ar.grant_min_ent) as max_grant_ent
      FROM admission_requirements ar
      JOIN universities u ON ar.university_id = u.id
      JOIN cities c ON u.city_id = c.id
      WHERE ar.min_ent <= ?
      GROUP BY c.id, c.name
      ORDER BY uni_count DESC, avg_ent ASC
    `).all(params.ent);
  } else {
    // Общая статистика
    cityStats = db.prepare(`
      SELECT
        c.name as city,
        c.id as city_id,
        COUNT(DISTINCT u.id) as uni_count,
        COUNT(DISTINCT ar.specialty_id) as spec_count,
        AVG(ar.avg_ent) as avg_ent,
        MIN(ar.min_ent) as min_ent,
        MAX(ar.grant_min_ent) as max_grant_ent
      FROM admission_requirements ar
      JOIN universities u ON ar.university_id = u.id
      JOIN cities c ON u.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY uni_count DESC
    `).all();
  }

  // Если несколько городов — показываем сравнение
  if (specificCities.length > 1) {
    let text = `🏙 **Сравнение городов:** ${specificCities.map(c => c.name).join(' vs ')}\n\n`;
    
    for (const city of specificCities) {
      let query = `
        SELECT
          COUNT(DISTINCT u.id) as uni_count,
          COUNT(DISTINCT ar.specialty_id) as spec_count,
          AVG(ar.avg_ent) as avg_ent,
          MIN(ar.min_ent) as min_ent,
          MAX(ar.grant_min_ent) as max_grant_ent
        FROM admission_requirements ar
        JOIN universities u ON ar.university_id = u.id
        WHERE u.city_id = ?
      `;
      const queryParams = [city.id];
      
      if (params.specialty) {
        query += ` AND ar.specialty_id IN (SELECT id FROM specialties WHERE category = ?)`;
        queryParams.push(params.specialty);
      }
      
      const stats = db.prepare(query).get(...queryParams);
      
      if (stats && stats.uni_count > 0) {
        text += `### 📍 ${city.name}\n`;
        text += `   🏛 ${stats.uni_count} вузов | 📚 ${stats.spec_count} спец.`;
        text += ` | 📊 ЕНТ: ср. ${Math.round(stats.avg_ent || 0)}, мин. ${stats.min_ent || '—'}`;
        if (stats.max_grant_ent) text += `, грант до ${stats.max_grant_ent}`;
        text += '\n\n';
      }
    }
    
    text += `💡 Выберите город и напишите *"Какие вузы в [город] на [направление]"*`;
    
    return {
      answer: text,
      matches: [],
      usedData: { cities: specificCities.map(c => c.name) },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'city',
    };
  }

  if (!cityStats.length) {
    return {
      answer: tr('city_no_data', lang) || 'Данных по городам пока нет.',
      matches: [],
      usedData: { cities_count: 0 },
      fallback: false,
      confidence: 0.5,
      took_ms: Date.now() - startTime,
      intent: 'city',
    };
  }

  const entText = hasEnt ? (tr('city_ent_prefix', lang) || '🎯 **Для ЕНТ ${ent} баллов:**\n\n').replace('${ent}', params.ent) : '';
  const specText = params.specialty ? (tr('city_spec_prefix', lang) || '📚 **Специальность:** ${spec}\n\n').replace('${spec}', params.specialty) : '';

  let text = `${entText}${specText}${tr('city_intro', lang) || '🏙 **Лучшие города для поступления:**\n\n'}`;

  cityStats.slice(0, 8).forEach((c, i) => {
    const avgEnt = c.avg_ent ? Math.round(c.avg_ent) : '—';
    const minEnt = c.min_ent || '—';
    const grantEnt = c.max_grant_ent ? `, грант до ${c.max_grant_ent}` : '';
    const uniWord = c.uni_count === 1 ? (lang === 'kk' ? 'университет' : lang === 'en' ? 'university' : 'вуз') :
                     c.uni_count < 5 ? (lang === 'kk' ? 'университет' : lang === 'en' ? 'universities' : 'вуза') :
                     (lang === 'kk' ? 'университет' : lang === 'en' ? 'universities' : 'вузов');
    const specWord = c.spec_count === 1 ? (lang === 'kk' ? 'специальность' : lang === 'en' ? 'specialty' : 'специальность') :
                     c.spec_count < 5 ? (lang === 'kk' ? 'специальности' : lang === 'en' ? 'specialties' : 'специальности') :
                     (lang === 'kk' ? 'специальностей' : lang === 'en' ? 'specialties' : 'специальностей');

    text += `${i + 1}. **${c.city}** — ${c.uni_count} ${uniWord}, ${c.spec_count} ${specWord}`;
    text += `, средний ЕНТ ${avgEnt}, мин. ${minEnt}${grantEnt}\n`;
  });

  text += `\n${tr('city_advice', lang) || '💡 Укажите направление и балл ЕНТ для точного рейтинга городов.'}`;

  return {
    answer: text,
    matches: [],
    usedData: { cities_count: cityStats.length, ent: params.ent, specialty: params.specialty },
    fallback: false,
    confidence: 0.9,
    took_ms: Date.now() - startTime,
    intent: 'city',
  };
}

// ==================== GRANT HANDLER ====================

function handleGrantQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  // Получаем все гранты и фильтруем по ключевым словам
  const allGrants = db.prepare('SELECT * FROM grants').all();

  // Ключевые слова для фильтрации по специальности
  const specKeywords = {
    'медицин': ['медицин', 'врач', 'medical', 'doctor', 'health', 'фарм', 'pharm', 'стоматолог', 'лечебн', 'педиатр', 'сестрин', 'сестр'],
    'it': ['it', 'компьютер', 'програм', 'computer', 'software', 'цифров', 'digital', 'информ', 'технолог', 'technology', 'data', 'данных', 'сетев', 'кибербезопас', 'cyber'],
    'инженер': ['инженер', 'engineer', 'технол', 'technology', 'нефт', 'oil', 'горн', 'mining', 'энерг', 'электр', 'electric', 'механик', 'mechanic', 'aviation', 'авиац', 'aviation'],
    'бизнес': ['бизнес', 'business', 'эконом', 'экономик', 'финанс', 'finance', 'менедж', 'management', 'маркетинг', 'marketing', 'бухгалтер', 'accounting'],
    'право': ['право', 'law', 'юрид', 'legal', 'юрист', 'lawyer', 'правов'],
    'образован': ['образован', 'education', 'педагог', 'teacher', 'учител', 'преподават', 'воспитател', 'pedagog'],
    'искусств': ['искусств', 'art', 'дизайн', 'design', 'музык', 'music', 'художеств', 'архитектур', 'architecture'],
    'сельское': ['сельск', 'agriculture', 'ветеринар', 'veterinary', 'агроном', 'agronomy', 'агро'],
  };
  
  // Отображаемые имена для специальностей
  const specDisplayNames = {
    'медицин': 'Медицина',
    'it': 'IT',
    'инженер': 'Инженерия',
    'бизнес': 'Бизнес',
    'право': 'Право',
    'образован': 'Образование',
    'искусств': 'Искусство',
    'сельское': 'Сельское хозяйство',
  };

  // Ищем ключевое слово специальности в запросе
  let matchedSpec = null;
  for (const [spec, keywords] of Object.entries(specKeywords)) {
    if (keywords.some(k => qLower.includes(k))) {
      matchedSpec = spec;
      break;
    }
  }

  // Определяем город из запроса
  let cityName = null;
  let cityId = null;
  const cities = db.prepare('SELECT id, name FROM cities').all();
  for (const c of cities) {
    const cityNameLower = c.name.toLowerCase();
    const stem = cityNameLower.slice(0, -1);
    if (qLower.includes(cityNameLower) || qLower.includes(stem)) {
      cityName = c.name;
      cityId = c.id;
      break;
    }
  }

  let grants = allGrants;
  if (matchedSpec) {
    const specKws = specKeywords[matchedSpec];
    grants = grants.filter(g => {
      const text = `${g.name} ${g.description} ${g.requirements}`.toLowerCase();
      return specKws.some(k => text.includes(k));
    });
  }

  // Фильтр по городу (если указан)
  if (cityId) {
    const cityGrants = grants.filter(g => g.city_id === cityId);
    if (cityGrants.length > 0) {
      grants = cityGrants;
    }
  }

  if (!grants.length) {
    grants = allGrants; // fallback: показываем все
  }

  const specText = matchedSpec ? `📚 **Специальность:** ${specDisplayNames[matchedSpec] || matchedSpec}\n` : '';
  const cityText = cityName ? `🏙 **Город:** ${cityName}\n` : '';
  let text = '';
  if (specText || cityText) text += `${specText}${cityText}\n`;
  text += `💰 **Доступные гранты (${grants.length}):**\n\n`;

  grants.slice(0, 15).forEach((g, i) => {
    const desc = (lang === 'kk' && g.description_kk) ? g.description_kk
      : (lang === 'en' && g.description_en) ? g.description_en
      : g.description || '—';
    const amount = g.amount || '—';
    const type = g.type === 'government' ? '🏛 Государственный'
      : g.type === 'university' ? '🎓 Вузовский'
      : g.type === 'private' ? '🏢 Частный'
      : g.type || '—';

    // Получаем информацию о вузе
    let uniInfo = '';
    if (g.university_id) {
      const uni = db.prepare('SELECT short_name, city_id FROM universities WHERE id = ?').get(g.university_id);
      if (uni) {
        const city = db.prepare('SELECT name FROM cities WHERE id = ?').get(uni.city_id);
        uniInfo = ` | 🏫 ${uni.short_name}${city ? ' (' + city.name + ')' : ''}`;
      }
    }

    text += `${i + 1}. **${g.name}**\n`;
    text += `   ${type} | 💰 ${amount}${uniInfo}\n`;
    text += `   📋 ${desc.slice(0, 250)}${desc.length > 250 ? '...' : ''}\n`;
    if (g.deadline) text += `   📅 Дедлайн: ${g.deadline}\n`;
    if (g.link) text += `   🔗 ${g.link}\n`;
    text += '\n';
  });

  text += `💡 Напишите направление для точного списка: *"Какие есть гранты на IT?"*`;

  return {
    answer: text,
    matches: [],
    usedData: { grants_count: grants.length, specialty: matchedSpec },
    fallback: false,
    confidence: 0.9,
    took_ms: Date.now() - startTime,
    intent: 'grant',
  };
}

// ==================== COMPARISON HANDLER ====================

function handleComparisonQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  // Ищем упоминания вузов в сообщении
  const unis = db.prepare('SELECT id, short_name, name FROM universities').all();
  const mentioned = [];
  for (const u of unis) {
    const shortLower = u.short_name.toLowerCase();
    const nameLower = u.name.toLowerCase();
    if (qLower.includes(shortLower) || qLower.includes(nameLower)) {
      mentioned.push(u);
    }
  }

  if (mentioned.length < 2) {
    return {
      answer: tr('compare_need_two', lang) || 'Укажите два университета для сравнения.\n\nНапример: *"Сравни КазНУ и ЕНУ"* или *"Чем отличается КБТУ от НУ?"*',
      matches: [],
      usedData: { universities_count: mentioned.length },
      fallback: false,
      confidence: 0.5,
      took_ms: Date.now() - startTime,
      intent: 'comparison',
    };
  }

  // Берём первые два из упомянутых в ПОРЯДКЕ ПОЯВЛЕНИЯ в тексте
  // Сортируем по позиции в исходном сообщении
  const qOriginal = msg.toLowerCase();
  const scored = mentioned.map(u => {
    const shortLower = u.short_name.toLowerCase();
    const nameLower = u.name.toLowerCase();
    const shortPos = qOriginal.indexOf(shortLower);
    const namePos = qOriginal.indexOf(nameLower);
    const pos = Math.min(
      shortPos >= 0 ? shortPos : Infinity,
      namePos >= 0 ? namePos : Infinity
    );
    return { ...u, pos };
  }).sort((a, b) => a.pos - b.pos);

  const uni1 = scored[0];
  const uni2 = scored[1];

  // Получаем полную информацию о вузах
  const full1 = db.prepare(`
    SELECT u.*, c.name as city_name,
      (SELECT COUNT(DISTINCT us2.specialty_id) FROM university_specialties us2 WHERE us2.university_id = u.id) as spec_count,
      (SELECT COUNT(DISTINCT ar2.specialty_id) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as req_count
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE u.id = ?
  `).get(uni1.id);

  const full2 = db.prepare(`
    SELECT u.*, c.name as city_name,
      (SELECT COUNT(DISTINCT us2.specialty_id) FROM university_specialties us2 WHERE us2.university_id = u.id) as spec_count,
      (SELECT COUNT(DISTINCT ar2.specialty_id) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as req_count
    FROM universities u
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE u.id = ?
  `).get(uni2.id);

  if (!full1 || !full2) {
    return {
      answer: tr('compare_not_found', lang) || 'Не удалось найти информацию об одном из вузов.',
      matches: [],
      usedData: {},
      fallback: false,
      confidence: 0.3,
      took_ms: Date.now() - startTime,
      intent: 'comparison',
    };
  }

  const desc1 = pickDescription(full1, lang);
  const desc2 = pickDescription(full2, lang);

  let text = `## 📊 Сравнение: ${full1.short_name} vs ${full2.short_name}\n\n`;

  // Таблица сравнения
  text += `| | **${full1.short_name}** | **${full2.short_name}** |\n`;
  text += `|---|---|---|\n`;
  text += `| 🏙 Город | ${full1.city_name || '—'} | ${full2.city_name || '—'} |\n`;
  text += `| 📅 Основан | ${full1.founded || '—'} | ${full2.founded || '—'} |\n`;

  const qs1 = full1.qs_world ? `#${full1.qs_world}` : '—';
  const qs2 = full2.qs_world ? `#${full2.qs_world}` : '—';
  text += `| 🌍 QS World | ${qs1} | ${qs2} |\n`;

  const qsAsia1 = full1.qs_asia ? `#${full1.qs_asia}` : '—';
  const qsAsia2 = full2.qs_asia ? `#${full2.qs_asia}` : '—';
  text += `| 🌏 QS Asia | ${qsAsia1} | ${qsAsia2} |\n`;

  const price1 = full1.price_from ? `${full1.price_from.toLocaleString()}–${(full1.price_to || full1.price_from).toLocaleString()}₸` : '—';
  const price2 = full2.price_from ? `${full2.price_from.toLocaleString()}–${(full2.price_to || full2.price_from).toLocaleString()}₸` : '—';
  text += `| 💰 Стоимость | ${price1} | ${price2} |\n`;

  const students1 = full1.students_count ? full1.students_count.toLocaleString() : '—';
  const students2 = full2.students_count ? full2.students_count.toLocaleString() : '—';
  text += `| 👥 Студентов | ${students1} | ${students2} |\n`;

  const specs1 = full1.spec_count || 0;
  const specs2 = full2.spec_count || 0;
  text += `| 📚 Специальностей | ${specs1} | ${specs2} |\n`;

  const dorm1 = full1.has_dorm ? '✅ Да' : '❌ Нет';
  const dorm2 = full2.has_dorm ? '✅ Да' : '❌ Нет';
  text += `| 🏠 Общежитие | ${dorm1} | ${dorm2} |\n`;

  const langs1 = full1.languages ? JSON.parse(full1.languages).join(', ') : '—';
  const langs2 = full2.languages ? JSON.parse(full2.languages).join(', ') : '—';
  text += `| 🌐 Языки | ${langs1} | ${langs2} |\n`;

  text += '\n';

  // Описания
  if (desc1 || desc2) {
    text += `### Описание\n\n`;
    if (desc1) text += `**${full1.short_name}:** ${desc1.slice(0, 300)}\n\n`;
    if (desc2) text += `**${full2.short_name}:** ${desc2.slice(0, 300)}\n\n`;
  }

  // Рекомендация
  text += `### 💡 Рекомендация\n\n`;
  if (full1.qs_world && full2.qs_world) {
    if (full1.qs_world < full2.qs_world) {
      text += `**${full1.short_name}** выше в рейтинге QS World (${qs1} vs ${qs2}). `;
    } else if (full2.qs_world < full1.qs_world) {
      text += `**${full2.short_name}** выше в рейтинге QS World (${qs2} vs ${qs1}). `;
    } else {
      text += `Оба вуза на одном уровне в рейтинге QS. `;
    }
  }
  if (full1.price_from && full2.price_from) {
    if (full1.price_from < full2.price_from) {
      text += `**${full1.short_name}** дешевле (${price1} vs ${price2}).`;
    } else if (full2.price_from < full1.price_from) {
      text += `**${full2.short_name}** дешевле (${price2} vs ${price1}).`;
    }
  }

  text += `\n\nНапишите *"Мои шансы в ${full1.short_name}"* или *"Мои шансы в ${full2.short_name}"* для расчёта вероятности поступления.`;

  return {
    answer: text,
    matches: [],
    usedData: { universities_count: 2, uni1: full1.short_name, uni2: full2.short_name },
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'comparison',
  };
}

// ==================== RECOMMENDATION HANDLER ====================

function handleRecommendationQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  // Определяем специальность из запроса
  const params = parseAdmissionQuery(msg);
  let specialtyCategory = params.specialty;

  // Ищем специальность по ключевым словам
  if (!specialtyCategory) {
    const specs = db.prepare('SELECT name, category FROM specialties').all();
    for (const s of specs) {
      if (qLower.includes(s.name.toLowerCase()) || qLower.includes(s.category.toLowerCase())) {
        specialtyCategory = s.category;
        break;
      }
    }
  }

  // Определяем бюджет
  const budget = params.budget;

  // Определяем город
  const cityId = params.cityId;

  // Ищем вузы
  let unis;
  if (specialtyCategory) {
    let query = `
      SELECT DISTINCT
        u.id, u.short_name, u.name, u.qs_world, u.qs_asia,
        u.price_from, u.price_to, u.city_id, u.has_dorm, u.founded,
        u.students_count, u.languages,
        c.name as city_name,
        s.name as spec_name, s.category as spec_category,
        ar.avg_ent, ar.min_ent, ar.grant_min_ent, ar.competition_level
      FROM universities u
      JOIN university_specialties us ON u.id = us.university_id
      JOIN specialties s ON us.specialty_id = s.id
      JOIN admission_requirements ar ON ar.university_id = u.id AND ar.specialty_id = s.id
      LEFT JOIN cities c ON u.city_id = c.id
      WHERE s.category = ?
    `;
    const queryParams = [specialtyCategory];

    if (cityId) {
      query += ' AND u.city_id = ?';
      queryParams.push(cityId);
    }
    if (budget) {
      query += ' AND u.price_from <= ?';
      queryParams.push(budget);
    }

    query += ' ORDER BY ar.avg_ent DESC, u.qs_world ASC NULLS LAST';
    unis = db.prepare(query).all(...queryParams);
  } else {
    // Без специальности — список вузов с агрегированными ЕНТ данными
    let query = `
      SELECT DISTINCT
        u.id, u.short_name, u.name, u.qs_world, u.qs_asia,
        u.price_from, u.price_to, u.city_id, u.has_dorm, u.founded,
        u.students_count, u.languages,
        c.name as city_name,
        (SELECT AVG(ar2.avg_ent) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as avg_ent,
        (SELECT MIN(ar2.min_ent) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as min_ent,
        (SELECT MAX(ar2.grant_min_ent) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as grant_min_ent
      FROM universities u
      LEFT JOIN cities c ON u.city_id = c.id
    `;
    const queryParams = [];
    const where = [];

    if (cityId) {
      where.push('u.city_id = ?');
      queryParams.push(cityId);
    }
    if (budget) {
      where.push('u.price_from <= ?');
      queryParams.push(budget);
    }

    if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY u.qs_world ASC NULLS LAST LIMIT 15';
    unis = db.prepare(query).all(...queryParams);
  }

  if (!unis.length) {
    return {
      answer: tr('rec_no_data', lang) || 'Вузов по вашему запросу не найдено. Попробуйте уточнить параметры.',
      matches: [],
      usedData: { universities_count: 0, specialty: specialtyCategory },
      fallback: false,
      confidence: 0.5,
      took_ms: Date.now() - startTime,
      intent: 'recommendation',
    };
  }

  const specText = specialtyCategory ? `📚 **Специальность:** ${specialtyCategory}\n` : '';
  const cityText = params.cityName ? `🏙 **Город:** ${params.cityName}\n` : '';
  const budgetText = budget ? `💰 **Бюджет:** до ${budget.toLocaleString()}₸\n` : '';
  const entText = params.ent ? `🎯 **Ваш ЕНТ:** ${params.ent}\n` : '';

  let text = '';
  if (specText || cityText || budgetText || entText) {
    text += `${specText}${cityText}${budgetText}${entText}\n`;
  }

  // Группируем по вузам
  const byUni = new Map();
  for (const u of unis) {
    if (!byUni.has(u.id)) {
      byUni.set(u.id, {
        ...u,
        specs: [],
        avg_ents: u.avg_ent ? [u.avg_ent] : [],
        min_ents: u.min_ent ? [u.min_ent] : [],
        grant_ents: u.grant_min_ent ? [u.grant_min_ent] : [],
      });
    }
    const entry = byUni.get(u.id);
    if (u.spec_name && !entry.specs.includes(u.spec_name)) entry.specs.push(u.spec_name);
  }

  const grouped = [...byUni.values()]
    .sort((a, b) => {
      const aMins = a.min_ents.filter(v => v !== null && v !== undefined);
      const bMins = b.min_ents.filter(v => v !== null && v !== undefined);
      const aMin = aMins.length ? Math.min(...aMins) : 999;
      const bMin = bMins.length ? Math.min(...bMins) : 999;
      return aMin - bMin;
    })
    .slice(0, 20);

  text += `## 📋 Лучшие вузы (${grouped.length}):\n\n`;

  // Группируем по городам
  const byCity = {};
  for (const u of grouped) {
    const city = u.city_name || 'Другой';
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(u);
  }

  let idx = 1;
  for (const [city, cityUnis] of Object.entries(byCity)) {
    text += `### 🏙 ${city}\n\n`;
    for (const u of cityUnis) {
      const qs = u.qs_world ? `QS #${u.qs_world}` : '';
      const price = u.price_from ? `${u.price_from.toLocaleString()}–${(u.price_to || u.price_from).toLocaleString()}₸` : '—';
      const langs = u.languages ? JSON.parse(u.languages).join(', ') : '—';
      const dorm = u.has_dorm ? '🏠' : '';
      const specs = u.specs.join(', ');
      const avgEnt = u.avg_ents.length ? Math.round(u.avg_ents.reduce((a, b) => a + b, 0) / u.avg_ents.length) : '—';
      const validMins = u.min_ents.filter(v => v !== null && v !== undefined);
      const validGrants = u.grant_ents.filter(v => v !== null && v !== undefined);
      const minEnt = validMins.length ? Math.min(...validMins) : '—';
      const grantEnt = validGrants.length ? Math.max(...validGrants) : '—';

      text += `**${idx}. ${u.short_name || u.name}**`;
      if (qs) text += ` (${qs})`;
      if (dorm) text += ` ${dorm}`;
      text += '\n';
      text += `   💰 ${price} | 🌐 ${langs}\n`;
      if (u.specs.length) text += `   📚 ${u.specs.join(', ')}\n`;
      text += `   📊 средний ЕНТ ${avgEnt}, мин. ${minEnt}, грант до ${grantEnt}\n\n`;
      idx++;
    }
  }

  text += `💡 Напишите *"Мои шансы в [вуз] на [направление] с ЕНТ [балл]"* для расчёта вероятности.`;

  return {
    answer: text,
    matches: [],
    usedData: { universities_count: unis.length, specialty: specialtyCategory, city: params.cityName },
    fallback: false,
    confidence: 0.9,
    took_ms: Date.now() - startTime,
    intent: 'recommendation',
  };
}

function retrieveRelevantUniversities(question) {
  const db = getDb();
  const question_lower = (question || '').toLowerCase();

  const extractedParams = {
    budget: null,
    specialties: extractSpecialties(question),
    languages: extractLanguages(question),
    has_dorm: question_lower.includes('общежитие') || question_lower.includes('общежит') || question_lower.includes('проживание'),
  };

  const params = {
    budget_max: extractedParams.budget,
    specialties: extractedParams.specialties,
    languages: extractedParams.languages,
    has_dorm: extractedParams.has_dorm,
    top_n: 8,
  };

  let query = `SELECT DISTINCT u.* FROM universities u`;
  let where = [];
  let params_sql = [];

  if (params.budget_max) {
    where.push('u.price_from <= ?');
    params_sql.push(params.budget_max);
  }

  if (params.specialties.length > 0) {
    query += ` LEFT JOIN university_specialties us ON u.id = us.university_id
               LEFT JOIN specialties s ON us.specialty_id = s.id`;
    const spec_conditions = params.specialties.map(() => '(s.name LIKE ? OR s.category = ?)').join(' OR ');
    where.push(`(${spec_conditions})`);
    params.specialties.forEach(spec => {
      params_sql.push(`%${spec}%`, spec);
    });
  }

  if (params.has_dorm) {
    where.push('u.has_dorm = 1');
  }

  if (params.languages && params.languages.length > 0) {
    const langConditions = params.languages.map(() => 'u.languages LIKE ?').join(' OR ');
    where.push(`(${langConditions})`);
    params.languages.forEach(lang => {
      params_sql.push(`%${lang}%`);
    });
  }

  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
  }

  query += ` ORDER BY 
    CASE WHEN u.qs_world IS NULL THEN 1 ELSE 0 END ASC,
    u.qs_world ASC,
    u.price_from ASC
    LIMIT ?`;
  params_sql.push(params.top_n);

  const universities = [];
  try {
    const stmt = db.prepare(query);
    const rows = stmt.all(...params_sql);
    rows.forEach(u => {
      const specs = db.prepare(
        `SELECT s.id, s.name, s.category FROM specialties s
         JOIN university_specialties us ON s.id = us.specialty_id
         WHERE us.university_id = ?`
      ).all(u.id);
      universities.push({
        id: u.id,
        name: u.name,
        short_name: u.short_name,
        price_from: u.price_from,
        price_to: u.price_to,
        qs_world: u.qs_world,
        qs_asia: u.qs_asia,
        website: u.website,
        languages: u.languages ? JSON.parse(u.languages) : [],
        has_dorm: u.has_dorm === 1,
        dorm_price: u.dorm_price,
        avg_salary: u.avg_salary,
        specialties: specs,
        description: u.description,
        founded: u.founded,
        students_count: u.students_count,
        accreditations: u.accreditations ? JSON.parse(u.accreditations) : [],
        last_updated_at: u.last_updated_at,
        data_status: u.data_status,
      });
    });
  } catch (err) {
    console.error('[ai-service] retrieval error:', err.message);
  }

  return { universities, extractedParams: params };
}

function retrieveRelevantGrants(specialties, universities_ids) {
  const db = getDb();
  let grants = [];
  try {
    const stmt = db.prepare('SELECT * FROM grants');
    const allGrants = stmt.all();
    grants = allGrants.map(g => ({
      id: g.id,
      name: g.name,
      type: g.type,
      amount: g.amount,
      description: g.description,
      requirements: g.requirements ? JSON.parse(g.requirements) : [],
      deadline: g.deadline,
      link: g.link,
    }));
  } catch (err) {
    console.error('[ai-service] error fetching grants:', err.message);
  }
  return grants;
}

function formatUniversitiesForContext(universities) {
  return universities.map(u => {
    const langs = u.languages ? (typeof u.languages === 'string' ? JSON.parse(u.languages) : u.languages).join(', ') : '—';
    const unique_specs = [...new Set((u.specialties || []).map(s => s.category))];
    const specs = unique_specs.slice(0, 3).join(', ');
    const dorm_info = u.has_dorm ? ` + общежитие ${u.dorm_price}тг/мес` : '';
    return `• ${u.name} (${u.short_name}):
    - Цена: ${u.price_from}-${u.price_to} тг/год
    - QS World: ${u.qs_world || 'не ранжирован'}
    - Специальности: ${specs || 'различные'}
    - Языки: ${langs}
    - Средняя зарплата выпускников: ${u.avg_salary}тг/мес${dorm_info}
    - Сайт: ${u.website}`;
  }).join('\n\n');
}

function formatGrantsForContext(grants) {
  return grants.slice(0, 7).map((g, i) => {
    return `${i + 1}. ${g.name} (${g.type})
    - Сумма: ${g.amount}
    - Требования: ${(g.requirements || []).join(', ')}
    - Дедлайн: ${g.deadline}`;
  }).join('\n\n');
}

async function callOpenRouter(systemPrompt, userMessage, history) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  const messages = [{ role: 'system', content: systemPrompt }];
  (history || []).slice(-8).forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || '').slice(0, 500),
    });
  });
  messages.push({
    role: 'user',
    content: String(userMessage).slice(0, 800),
  });

  const requestBody = {
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    models: ['google/gemini-2.5-pro'],
    provider: {
      only: ['google-ai-studio'],
      data_collection: 'deny',
    },
    messages,
    temperature: 0.75,
    max_tokens: 640,
  };

  console.log('[ai-service] OpenRouter request:', JSON.stringify({
    model: requestBody.model,
    messages_count: messages.length,
    system_prompt_length: systemPrompt.length,
    user_message_length: userMessage.length,
    history_count: (history || []).length,
  }));

  const MAX_RETRIES = 2;
  let lastErr = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'EduMatchKZ/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          lastErr = new Error(`OpenRouter error ${response.status}: ${errorText}`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Unexpected OpenRouter response format');
      }

      logTokenUsage(data.model, data.usage);

      return {
        text: data.choices[0].message.content,
        model_used: data.model,
        usage: data.usage,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastErr = new Error('OpenRouter request timed out after 15s');
        if (attempt < MAX_RETRIES) continue;
        throw lastErr;
      }
      if (attempt === MAX_RETRIES) throw err;
      lastErr = err;
    }
  }

  throw lastErr || new Error('OpenRouter request failed after retries');
}

async function handleAdmissionChatQuery(msg, history, lang = 'ru') {
  const startTime = Date.now();
  const parsed = parseAdmissionQuery(msg);
  const historyParams = extractParamsFromHistory(history);

  const params = {
    ent: parsed.ent ?? historyParams.ent ?? null,
    university_id: parsed.university_id ?? historyParams.university_id ?? null,
    specialty: parsed.specialty ?? historyParams.specialty ?? null,
    budget: parsed.budget ?? historyParams.budget ?? null,
    language: parsed.language ?? historyParams.language ?? null,
    needDorm: parsed.needDorm ?? historyParams.needDorm ?? null,
    attestat: parsed.attestat ?? historyParams.attestat ?? null,
    cityId: parsed.cityId ?? historyParams.cityId ?? null,
  };

  const usedHistory = historyParams.ent !== undefined && parsed.ent === null
    || historyParams.specialty !== undefined && parsed.specialty === null;

  // Проверка на слишком высокий ЕНТ (141+ или 1000+)
  const hasEntNumber = /(?:ент|бал[а-я]*)\s*:?\s*(\d{3,})\b/i.test(msg) ||
    /(\d{3,})\s*(?:бал[а-я]*)/i.test(msg);
  if (hasEntNumber) {
    const match = msg.match(/(?:ент|бал[а-я]*)\s*:?\s*(\d{3,})/i) || msg.match(/(\d{3,})\s*(?:бал[а-я]*)/i);
    const num = match ? parseInt(match[1], 10) : 0;
    if (num > 140) {
      return {
        answer: tr('max_ent', lang) || 'Максимальный балл ЕНТ — 140. Укажите корректное значение (0–140).',
        matches: [],
        usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
        fallback: false,
        confidence: 0.9,
        took_ms: Date.now() - startTime,
        intent: 'admission',
        admission: { type: 'invalid_ent', params },
      };
    }
  }

  if (params.ent === null && !params.specialty && !params.university_id) {
    return {
      answer: tr('specify_ent', lang) || 'Укажите балл ЕНТ и направление, чтобы я рассчитал шансы.\n\nНапример: *"Поступлю ли я в КБТУ на IT с ЕНТ 110?"*',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'missing_params', params },
    };
  }

  const db = getDb();
  let specialtyToUse = params.specialty;

  if (!specialtyToUse && params.university_id) {
    try {
      const uniSpecs = db.prepare(`
        SELECT DISTINCT s.category FROM specialties s
        JOIN university_specialties us ON s.id = us.specialty_id
        WHERE us.university_id = ?
        LIMIT 1
      `).get(params.university_id);
      if (uniSpecs) specialtyToUse = uniSpecs.category;
    } catch (e) {}
  }

  if (!specialtyToUse) {
    if (params.ent) {
      // Try to find any matching universities across all specialties
      try {
        // Find best specialty per university: closest match to user's ENT (smallest gap)
        const allCandidates = db.prepare(`
          SELECT ar.*, u.id AS uid, u.short_name, u.name, u.qs_world, s.name AS specialty_name, s.category
          FROM admission_requirements ar
          JOIN universities u ON ar.university_id = u.id
          JOIN specialties s ON ar.specialty_id = s.id
          WHERE ar.min_ent <= ?
          ORDER BY u.qs_world ASC NULLS LAST
        `).all(params.ent);

        if (allCandidates.length > 0) {
          // For each university, find the specialty with SMALLEST GAP to user's ENT
          // Gap = params.ent - avg_ent (negative = below average, positive = above)
          // We want the specialty where gap is closest to 0 (best match)
          const bestPerUni = new Map();
          for (const c of allCandidates) {
            if (!bestPerUni.has(c.uid)) {
              bestPerUni.set(c.uid, []);
            }
            bestPerUni.get(c.uid).push(c);
          }

          const results = [];
          for (const [uid, rows] of bestPerUni) {
            // Find specialty with smallest absolute gap
            let chosen = rows.reduce((best, r) => {
              const gapBest = Math.abs(params.ent - best.avg_ent);
              const gapCurr = Math.abs(params.ent - r.avg_ent);
              return gapCurr < gapBest ? r : best;
            });
            const diff = params.ent - chosen.avg_ent;
            results.push({ id: uid, short_name: chosen.short_name, name: chosen.name, qs_world: chosen.qs_world, specialty_name: chosen.specialty_name, category: chosen.category, avg_ent: chosen.avg_ent, min_ent: chosen.min_ent, grant: chosen.grant_min_ent, diff, qualifies: diff >= 0 });
          }

          const top = results
            .sort((a, b) => {
              if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
              if (a.diff !== b.diff) return b.diff - a.diff;
              return (a.qs_world || 999) - (b.qs_world || 999);
            })
            .slice(0, 12);

          const qualifyCount = results.filter(r => r.qualifies).length;
          const totalCount = results.length;

          let text = (tr('overview_title', lang) || '🎯 **С вашим баллом ${score}**\n\n').replace('${score}', params.ent);
          if (qualifyCount > 0) {
            text += (tr('overview_qualify', lang) || `Ваш балл подходит для **${qualifyCount}** вузов (из ${totalCount} с данными):\n\n`).replace('${count}', qualifyCount);
          } else {
            text += (tr('overview_near', lang) || 'Ваш балл чуть ниже среднего по всем вузам, но есть варианты:\n\n');
          }

          top.forEach((u, i) => {
            const emoji = u.qualifies ? '🟢' : '🟡';
            const qs = u.qs_world ? ` (QS #${u.qs_world})` : '';
            const specDisplay = u.specialty_name || u.category;
            text += `${emoji} **${u.short_name}**${qs} — ${specDisplay}, средний ЕНТ ${u.avg_ent}`;
            if (u.qualifies) {
              text += `, ${tr('overview_line', lang) || 'вы **на ${diff} выше**'}`.replace('${diff}', u.diff);
            } else {
              text += `, ${tr('overview_need', lang) || 'вам не хватает ${diff}'}`.replace('${diff}', Math.abs(u.diff));
            }
            if (u.grant && params.ent >= u.grant) text += ` ✅ грант`;
            text += '\n';
          });
          text += `\n${tr('overview_hint', lang) || '💡 Напишите вуз и направление для точного расчёта.\nНапример: *"Мои шансы в КБТУ на IT"*'}`;

    return {
            answer: text,
            matches: [],
            usedData: { universities_count: totalCount, grants_count: 0, extraction_params: params, admission_result: null },
            fallback: false,
            confidence: 0.9,
            took_ms: Date.now() - startTime,
            intent: 'admission',
            admission: { type: 'overview', params },
          };
        }
      } catch (e) {
        console.error('[ai-service] overview query error:', e.message);
      }

      // Fallback: suggest popular specialties
      const popularSpecs = ['Информационные технологии', 'Медицина', 'Бизнес', 'Инженерия', 'Образование'];
      let specHint = popularSpecs.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return {
        answer: (tr('overview_fallback', lang) || 'Я вижу ЕНТ: **${ent}** баллов. На какое направление хотите поступить?\n\n${specHint}\n\nНапишите, например: *"Шансы на IT с ${ent} баллами"* или *"Поступлю ли в КБТУ на программиста"*')
          .replace(/\$\{ent\}/g, params.ent)
          .replace('${specHint}', specHint),
        matches: [],
        usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
        fallback: false,
        confidence: 0.9,
        took_ms: Date.now() - startTime,
        intent: 'admission',
        admission: { type: 'missing_specialty', params },
      };
    }
    return {
      answer: tr('no_data', lang) || 'Укажите балл ЕНТ и направление.\n\nНапример: *"Поступлю ли я в КБТУ на IT с ЕНТ 110?"*',
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.9,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'missing_params', params },
    };
  }

  const prediction = getAdmissionPrediction({
    ent: params.ent ?? 100,
    specialty: specialtyToUse,
    specialtyName: params.specialtyName,
    budget: params.budget || undefined,
    language: params.language || undefined,
    needDorm: params.needDorm || false,
    cityId: params.cityId || undefined,
    attestat: params.attestat || undefined,
    wantsBudget: params.wantsBudget || false,
  });

  if (!prediction.success) {
    return {
      answer: prediction.error || (tr('calc_error', lang) || 'Ошибка при расчёте шансов. Попробуйте другие параметры.'),
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
      fallback: false,
      confidence: 0.7,
      took_ms: Date.now() - startTime,
      intent: 'admission',
      admission: { type: 'error', params },
    };
  }

  let filtered = prediction.matches;
  if (params.university_id) {
    filtered = prediction.matches.filter(m => m.university_id === params.university_id);
    if (filtered.length === 0) {
      const uni = db.prepare('SELECT short_name, name FROM universities WHERE id = ?').get(params.university_id);
      return {
        answer: (tr('no_data_for_uni', lang) || `По направлению "${specialtyToUse}" данных для ${uni?.short_name || 'этого вуза'} пока нет. Попробуйте другое направление или посмотрите другие вузы.`)
          .replace('${spec}', specialtyToUse)
          .replace('${uni}', uni?.short_name || ''),
        matches: [],
        usedData: { universities_count: 0, grants_count: 0, extraction_params: params, admission_result: null },
        fallback: false,
        confidence: 0.8,
        took_ms: Date.now() - startTime,
        intent: 'admission',
        admission: { type: 'no_match', params, prediction },
      };
    }
  }

  let answer = getAdmissionBriefPrompt(params, { ...prediction, matches: filtered });

  if (usedHistory) {
    const used = [];
    if (parsed.ent === null && historyParams.ent !== undefined) used.push(`ЕНТ ${historyParams.ent}`);
    if (parsed.budget === null && historyParams.budget !== undefined) used.push(`бюджет ${historyParams.budget.toLocaleString()}₸`);
    if (parsed.language === null && historyParams.language !== undefined) used.push(`язык ${historyParams.language}`);
    if (parsed.needDorm === null && historyParams.needDorm) used.push('общежитие');
    if (used.length > 0) {
      const prefix = (tr('remembered_prefix', lang) || '📌 Использую из предыдущего сообщения: ') + used.join(', ') + '\n\n';
      answer = prefix + answer;
    }
  }

  return {
    answer,
    matches: [],
    usedData: {
      universities_count: prediction.matches.length,
      grants_count: 0,
      extraction_params: params,
      admission_result: { matches: filtered.slice(0, 5), input: prediction.input },
    },
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'admission',
    admission: {
      type: 'result',
      params,
      matches: filtered.slice(0, 8),
      input: prediction.input,
      whatIf: prediction.whatIf || [],
      academicYear: prediction.academicYear || '2025-2026',
    },
  };
}

async function getAIAdvice(userMessage, history = [], lang = 'ru') {
  const startTime = Date.now();

  if (!userMessage || typeof userMessage !== 'string') {
    throw new Error('Invalid message');
  }

  const msg = userMessage.trim().slice(0, 1000);
  if (msg.length < 2) {
    throw new Error('Message too short');
  }

  // Авто-определение языка по тексту сообщения (если lang не передан явно)
  lang = detectLanguage(msg) || lang || 'ru';

function handleDeadlinesQuery(lang = 'ru') {
  const startTime = Date.now();

  const deadlines = {
    ru: {
      title: '📅 Календарь поступления 2025-2026',
      items: [
        { date: 'Февраль–Март', event: 'Подготовка к ЕНТ', desc: 'Регистрация на курсы, сбор документов' },
        { date: '1 Мая', event: 'Регистрация на ЕНТ', desc: 'Подача заявки через testcenter.kz' },
        { date: '1–20 Июня', event: 'Сдача ЕНТ', desc: 'Основная волна, июнь-июль' },
        { date: '1–25 Июля', event: 'Подача документов', desc: 'Электронная подача через Egov/KZ' },
        { date: '5–10 Августа', event: 'Зачисление', desc: 'Объявление результатов конкурса' },
        { date: '15–25 Августа', event: 'Оплата обучения', desc: 'Для зачисленных на платное' },
        { date: '1 Сентября', event: 'Начало занятий', desc: 'Торжественная линейка' },
      ],
    },
    kk: {
      title: '📅 Тіркеу күнтізбесі 2025-2026',
      items: [
        { date: 'Ақпан–Наурыз', event: 'ҰБТ-ға дайындық', desc: 'Курстарға тіркеу, құжаттар жинау' },
        { date: '1 Мамыр', event: 'ҰБТ-ға тіркеу', desc: 'testcenter.kz арқылы өтініш беру' },
        { date: '1–20 Маусым', event: 'ҰБТ тапсыру', desc: 'Негізгі толқын' },
        { date: '1–25 Шілде', event: 'Құжаттар тапсыру', desc: 'Egov/KZ арқылы электронды тапсыру' },
        { date: '5–10 Тамыз', event: 'Қабылдау', desc: 'Конкурс нәтижелерін жариялау' },
        { date: '15–25 Тамыз', event: 'Оқу ақысын төлеу', desc: 'Ақылы бөлімге қабылдағандар үшін' },
        { date: '1 Қыркүйек', event: 'Сабақтардың басталуы', desc: 'Салтанатты жиын' },
      ],
    },
    en: {
      title: '📅 Admission Calendar 2025-2026',
      items: [
        { date: 'Feb–Mar', event: 'ENT Preparation', desc: 'Course registration, document collection' },
        { date: 'May 1', event: 'ENT Registration', desc: 'Apply via testcenter.kz' },
        { date: 'Jun 1–20', event: 'ENT Exam', desc: 'Main wave' },
        { date: 'Jul 1–25', event: 'Document Submission', desc: 'Electronic submission via Egov/KZ' },
        { date: 'Aug 5–10', event: 'Enrollment', desc: 'Competition results announced' },
        { date: 'Aug 15–25', event: 'Tuition Payment', desc: 'For paid enrollment' },
        { date: 'Sep 1', event: 'Classes Begin', desc: 'Opening ceremony' },
      ],
    },
  };

  const cal = deadlines[lang] || deadlines.ru;
  let text = `## ${cal.title}\n\n`;
  cal.items.forEach(item => {
    text += `**${item.date}** — ${item.event}\n`;
    text += `   ${item.desc}\n\n`;
  });
  text += `---\n💡 *Даты могут отличаться в зависимости от вуза. Уточняйте на официальном сайте.*`;

  return {
    answer: text,
    matches: [],
    usedData: {},
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'deadlines',
  };
}

function handleOnboardingQuery(msg, history, lang = 'ru') {
  const startTime = Date.now();
  const parsed = parseAdmissionQuery(msg);
  const historyParams = extractParamsFromHistory(history);

  const params = {
    ent: parsed.ent ?? historyParams.ent ?? null,
    specialty: parsed.specialty ?? historyParams.specialty ?? null,
    cityId: parsed.cityId ?? historyParams.cityId ?? null,
    budget: parsed.budget ?? historyParams.budget ?? null,
  };

  const missing = [];
  if (!params.ent) missing.push('ент');
  if (!params.specialty) missing.push('направление');
  if (!params.cityId) missing.push('город');

  if (missing.length === 0) {
    return handleRecommendationQuery(msg, lang);
  }

  const texts = {
    ru: {
      intro: 'Не знаете что выбрать? Не страшно! Давайте определимся шаг за шагом.\n\nОтветьте на несколько вопросов, и я подберу лучшие вузы для вас:\n',
      outro: '\nМожете ответить сразу на все или по одному. Например: *"ЕНТ 105, IT, Алматы"*',
      ent: '🎯 Сколько баллов ЕНТ вы набрали (или планируете набрать)?',
      spec: '📚 Какая специальность интересует? (IT, медицина, бизнес, инженерия...)',
      city: '🏙 В каком городе хотите учиться? (Алматы, Астана, Шымкент...)',
      budget: '💰 какой максимальный бюджет на год обучения? (или "бюджет" если на грант)',
    },
    kk: {
      intro: 'Не таңдауға болмайтынын білмейсіз бе? Әлем емес! Қадам бойынша анықтайық.\n\nБірнеше сұраққа жауап беріңіз, мен сізге ең жақсы университеттерді таңдаймын:\n',
      outro: '\nБарлығына бірден немесе бір-бірден жауап бере аласыз. Мысалы: *"ЕНТ 105, IT, Алматы"*',
      ent: '🎯 ЕНТ-ден неше ұпай алдыңыз ( немесе жоспарлап тұрсыз)?',
      spec: '📚 Қандай мамандық қызықтырады? (IT, медицина, бизнес, инженерия...)',
      city: '🏙 Қай қалада оқығыңыз келеді? (Алматы, Астана, Шымкент...)',
      budget: '💰 Оқу ақысының максималдық бюджеті қанша? (немесе "грант" болса)',
    },
    en: {
      intro: "Not sure what to choose? No worries! Let's figure it out step by step.\n\nAnswer a few questions and I'll find the best universities for you:\n",
      outro: '\nYou can answer all at once or one by one. For example: *"ENT 105, IT, Almaty"*',
      ent: '🎯 How many ENT points did you score (or plan to)?',
      spec: '📚 What specialty interests you? (IT, medicine, business, engineering...)',
      city: '🏙 Which city do you want to study in? (Almaty, Astana, Shymkent...)',
      budget: "💰 What's your maximum annual budget? (or 'grant' if seeking a scholarship)",
    }
  };
  const t = texts[lang] || texts.ru;

  const questions = [];
  if (!params.ent) questions.push(t.ent);
  if (!params.specialty) questions.push(t.spec);
  if (!params.cityId) questions.push(t.city);
  if (!params.budget) questions.push(t.budget);

  let answer = t.intro;
  questions.forEach((q, i) => { answer += `${i + 1}. ${q}\n`; });
  answer += t.outro;

  return {
    answer,
    matches: [],
    usedData: { onboarding_step: questions.length, params },
    fallback: false,
    confidence: 0.9,
    took_ms: Date.now() - startTime,
    intent: 'onboarding',
  };
}

  // Отклоняем чистые числа (не как часть запроса)
  if (/^\d+$/.test(msg)) {
    return {
      answer: 'Я вижу число, но не понимаю контекст. Укажите балл ЕНТ и направление:\n\n• *"Мои шансы в КБТУ с ЕНТ 110"*\n• *"Поступлю ли я в КазНУ с ЕНТ 100?"*',
      matches: [],
      usedData: {},
      fallback: false,
      confidence: 0.3,
      took_ms: 0,
      intent: 'general',
    };
  }

  console.log(`\n[ai-service] User message: "${msg}"`);
  console.log(`[ai-service] History length: ${history.length}`);

  const intent = classifyIntent(msg);
  console.log(`[ai-service] Classified intent: "${intent}"`);

  if (intent === 'admission') {
    console.log('[ai-service] Routing to admission handler');
    return handleAdmissionChatQuery(msg, history, lang);
  }

  if (intent === 'profession') {
    console.log('[ai-service] Routing to profession handler');
    return handleProfessionQuery(msg, lang);
  }

  if (intent === 'uni_info') {
    console.log('[ai-service] Routing to uni_info handler');
    return handleUniInfoQuery(msg, lang);
  }

  if (intent === 'city') {
    console.log('[ai-service] Routing to city handler');
    return handleCityQuery(msg, lang);
  }

  if (intent === 'grant') {
    console.log('[ai-service] Routing to grant handler');
    return handleGrantQuery(msg, lang);
  }

  if (intent === 'comparison') {
    console.log('[ai-service] Routing to comparison handler');
    return handleComparisonQuery(msg, lang);
  }

  if (intent === 'recommendation') {
    console.log('[ai-service] Routing to recommendation handler');
    return handleRecommendationQuery(msg, lang);
  }

  if (intent === 'onboarding') {
    console.log('[ai-service] Routing to onboarding handler');
    return handleOnboardingQuery(msg, history, lang);
  }

  if (intent === 'deadlines') {
    console.log('[ai-service] Routing to deadlines handler');
    return handleDeadlinesQuery(lang);
  }

  // Приветствие — заготовленный ответ без LLM
  if (intent === 'greeting') {
    const greetings = {
      ru: `Привет! 👋 Я твой ИИ-советник по поступлению в вузы Казахстана.

Могу помочь с:
• 🎯 **Расчёт шансов** — "Мои шансы в КБТУ на программиста с ЕНТ 110"
• 🏙 **Города** — "Какие вузы в Алматы?"
• 📋 **Списки вузов** — "Дай список вузов на IT"
• ⚖️ **Сравнение** — "Сравни КБТУ и КазНУ"
• 💰 **Гранты** — "Какие гранты на медицину?"
• 💼 **Профессии** — "Кем работать с IT образованием?"

Задавай вопрос! 😊`,
      kk: `Сәлем! 👋 Мен Қазақстан университеттеріне түсу бойынша СИ-кеңесшімін.

Көмектесе аламын:
• 🎯 **Мүмкіндікті есептеу** — "Менің КБТУ-ге мүмкіндігім ЕНТ 110 болғанда"
• 🏙 **Қалалар** — "Алматыда қандай университеттер бар?"
• 📋 **Тізімдер** — "IT бойынша университеттер тізімін бер"
• ⚖️ **Салыстыру** — "КБТУ мен ҚазҰУ-ды салыстыр"
• 💰 **Гранттар** — "Медицина бойынша қандай гранттар бар?"
• 💼 **Мамандықтар** — "IT білімімен қандай жұмыс істеуге болады?"

Сұрағыңды қой! 😊`,
      en: `Hi! 👋 I'm your AI advisor for Kazakh university admissions.

I can help with:
• 🎯 **Chance calculator** — "My chances at KBTU for programmer with ENT 110"
• 🏙 **Cities** — "What universities are in Almaty?"
• 📋 **University lists** — "Give me a list of IT universities"
• ⚖️ **Comparison** — "Compare KBTU and KazNU"
• 💰 **Grants** — "What grants are available for medicine?"
• 💼 **Careers** — "What jobs can I get with IT education?"

Ask away! 😊`
    };
    return {
      answer: greetings[lang] || greetings.ru,
      matches: [],
      usedData: {},
      fallback: false,
      confidence: 1.0,
      took_ms: 0,
      intent: 'greeting',
    };
  }

  // Помощь — заготовленный ответ без LLM
  if (intent === 'help') {
    const helpTexts = {
      ru: `Вот что я умею:

**🎯 Расчёт шансов на поступление:**
• *"Мои шансы в КБТУ на программиста с ЕНТ 110"*
• *"Поступлю ли я в КазНУ с ЕНТ 100?"*

**🏙 Информация по городам:**
• *"Какие вузы в Шымкенте?"*

**📋 Списки вузов:**
• *"Дай список вузов на программиста"*

**⚖️ Сравнение вузов:**
• *"Сравни КБТУ и КазНУ"*

**💰 Гранты:**
• *"Какие гранты на IT?"*

**💼 Профессии:**
• *"Кем я могу работать с IT образованием?"*

**💡 Советы:**
Я понимаю русский, казахский и английский языки.`,
      kk: `Мен не істей аламын:

**🎯 Түсу мүмкіндігін есептеу:**
• *"Менің КБТУ-ге мүмкіндігім ЕНТ 110 болғанда"*

**🏙 Қалалар туралы ақпарат:**
• *"Шымкентте қандай университеттер бар?"*

**📋 Университеттер тізімі:**
• *"Программист бойынша университеттер тізімін бер"*

**⚖️ Университеттерді салыстыру:**
• *"КБТУ мен ҚазҰУ-ды салыстыр"*

**💰 Гранттар:**
• *"IT бойынша қандай гранттар бар?"*

**💼 Мамандықтар:**
• *"IT білімімен қандай жұмыс істеуге болады?"*

**💡 Кеңестер:**
Мен қазақ, орыс және ағылшын тілдерін түсінемін.`,
      en: `Here's what I can do:

**🎯 Admission chances:**
• *"My chances at KBTU for programmer with ENT 110"*

**🏙 City info:**
• *"What universities are in Shymkent?"*

**📋 University lists:**
• *"Give me a list of IT universities"*

**⚖️ Compare:**
• *"Compare KBTU and KazNU"*

**💰 Grants:**
• *"What grants are available for IT?"*

**💼 Careers:**
• *"What jobs can I get with IT education?"*

**💡 Tips:**
I understand Russian, Kazakh, and English.`
    };
    return {
      answer: helpTexts[lang] || helpTexts.ru,
      matches: [],
      usedData: {},
      fallback: false,
      confidence: 1.0,
      took_ms: 0,
      intent: 'help',
    };
  }

  const { universities, extractedParams } = retrieveRelevantUniversities(msg);
  console.log(`[ai-service] Retrieved ${universities.length} universities`);
  const grants = retrieveRelevantGrants(extractedParams.specialties, universities.map(u => u.id));

  const dataFound = universities.length > 0;
  const confidence = Math.min(0.9, Math.max(0.3, universities.length / 8));

  // Для general/university вопросов — всегда передаём контекст БД в LLM
  let unisForContext = universities;
  if (!dataFound && (intent === 'general' || intent === 'uni_info')) {
    // Берём топ-8 вузов из БД как контекст для LLM
    unisForContext = getDb().prepare('SELECT * FROM universities ORDER BY qs_world ASC NULLS LAST, price_from ASC LIMIT 8').all();
  }

  if (!dataFound && unisForContext.length === 0) {
    return {
      answer: tr('not_found_unis', lang) || `Я не нашёл университеты, соответствующие вашему запросу. Попробуйте:\n- Указать конкретный вуз или специальность\n- Уточнить бюджет\n\nВ моей базе есть информация о вузах Казахстана, 35+ специальностях и грантах.`,
      matches: [],
      usedData: { universities_count: 0, grants_count: 0, extraction_params: extractedParams },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime,
      intent,
    };
  }

  const universitiesContext = formatUniversitiesForContext(unisForContext.slice(0, 8));
  const grantsContext = formatGrantsForContext(grants);
  const systemPrompt = getSystemPrompt(intent, universitiesContext, grantsContext, lang);

  let aiResponse = null;
  try {
    aiResponse = await callOpenRouter(systemPrompt, msg, history);
  } catch (err) {
    console.error('[ai-service] LLM call failed:', err.message);
    return {
      answer: tr('llm_error', lang) || 'Извините, произошла ошибка. Попробуйте позже.',
      matches: [],
      usedData: {
        universities_count: universities.length,
        grants_count: grants.length,
        extraction_params: extractedParams,
      },
      fallback: true,
      confidence: 0.0,
      took_ms: Date.now() - startTime,
      intent,
      error: err.message,
    };
  }

  logQuery(msg, intent, lang, Date.now() - startTime);
  return {
    answer: aiResponse.text,
    matches: [],
    usedData: {
      universities_count: universities.length,
      grants_count: grants.length,
      extraction_params: extractedParams,
      model_used: aiResponse.model_used,
    },
    fallback: confidence < 0.4,
    confidence,
    took_ms: Date.now() - startTime,
    intent,
  };
}

// ─── QUERY LOGGING ──────────────────────────
function logQuery(query, intent, lang, responseTimeMs) {
  try {
    const db = require('./database.js').initDatabase();
    db.prepare('INSERT INTO query_log (query, intent, lang, response_time_ms) VALUES (?, ?, ?, ?)').run(
      query, intent || 'unknown', lang || 'ru', responseTimeMs || 0
    );
  } catch (e) { /* silent */ }
}

function logTokenUsage(model, usage) {
  if (!usage) return;
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS token_usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.prepare(
      'INSERT INTO token_usage_log (model, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?)'
    ).run(
      model || 'unknown',
      usage.prompt_tokens || 0,
      usage.completion_tokens || 0,
      usage.total_tokens || 0
    );
  } catch (e) {
    console.error('[ai-service] token usage log error:', e.message);
  }
}

function getTopQueries(days = 7, limit = 10) {
  try {
    const db = require('./database.js').initDatabase();
    return db.prepare(`
      SELECT query, intent, COUNT(*) as count, AVG(response_time_ms) as avg_ms
      FROM query_log
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY query
      ORDER BY count DESC
      LIMIT ?
    `).all(days, limit);
  } catch (e) { return []; }
}

function getQueryStats(days = 7) {
  try {
    const db = require('./database.js').initDatabase();
    const total = db.prepare("SELECT COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days')").get(days);
    const byIntent = db.prepare("SELECT intent, COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY intent ORDER BY c DESC").all(days);
    const byLang = db.prepare("SELECT lang, COUNT(*) as c FROM query_log WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY lang ORDER BY c DESC").all(days);
    return { total: total.c, byIntent, byLang };
  } catch (e) { return { total: 0, byIntent: [], byLang: [] }; }
}

module.exports = {
  getAIAdvice,
  classifyIntent,
  parseAdmissionQuery,
  retrieveRelevantUniversities,
  retrieveRelevantGrants,
  callOpenRouter,
  formatUniversitiesForContext,
  formatGrantsForContext,
  logTokenUsage,
};
