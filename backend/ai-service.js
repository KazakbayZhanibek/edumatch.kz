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
      // KK — "мамандықтары туралы", "мамандық туралы", "мамандық айтыңыз"
      /мамандықтары?\s+(?:туралы|айтыңызшы|беріңізші|көрсетіңізші)/i,
      /(?:айтыңызшы|беріңізші|көрсетіңізші)\s+.*мамандық/i,
      // KK other
      /(?:ұсын|кеңес бер|таңда|қай университет|қандай университет|жәй университет|ұсыныңыз)/i,
      /(?:қызықтырады|қаламын|іздеймін).*(?:университет|мамандық|бағыт)/i,
      // EN
      /(?:recommend|suggest|advise|which uni|which university|best uni|best university)/i,
      /(?:interested in|want|looking for).*(?:university|specialty|major)/i,
    ],
    keywords: ['рекомендуй','посоветуй','подбери','лучший','интересует',
               'ұсын','кеңес бер','таңда','қай','жәй','қызықтырады','мамандық','мамандықтары',
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

const VALID_INTENTS = ['greeting', 'help', 'comparison', 'admission', 'recommendation', 'grant', 'uni_info', 'city', 'onboarding', 'deadlines', 'profession', 'general'];

function classifyIntent(message, history = []) {
  const q = (message || '').toLowerCase().trim();
  if (!q) return 'general';

  // Определяем последний intent из истории для контекста
  let lastIntent = null;
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].intent) { lastIntent = history[i].intent; break; }
    }
  }

  // Приветствия и короткие фразы → general с заготовленным ответом
  if (/^(?:привет|здравствуй(?:те)?|سلام|hello|hi|hey|приветик|добрый|добрый день|добрый вечер|доброе утро|здорово|йо|йоу|хай|здаров|хай|здрасьте|здарова|хелло|хэлло|сәлеметсіз бе|сәлем|сәлеметсің бе|сәлеметсізбе|assalamu alaikum|саған сәлем|жәрекем)(?:[!?.，。]+)?$/i.test(q)) {
    return 'greeting';
  }
  if (/^(?:что (?:ты )?умеешь|чем (?:ты )?поможешь|что (?:ты )?можешь|помощь|help|what (?:can|do) (?:you|u) (?:do|help)|what are you doing|что делать|как пользоваться|көмек|не істей аламын|қалай пайдалану|қандай мүмкіндіктер)(?:[!?.，。]+)?$/i.test(q)) {
    return 'help';
  }

  // Контекстные follow-up: короткие вопросы после конкретного intent
  if (lastIntent) {
    if (lastIntent === 'admission' && /(?:требован|ент|балл|конкурс|проходн|минимальн|средн|каки.*балл|какой.*балл|какие.*требован)/i.test(q)) {
      return 'admission';
    }
    if (lastIntent === 'city' && /(?:покажи|показат|конкретн|именно|только|ещ[ёе]|больше|подробн)/i.test(q)) {
      return 'city';
    }
    if (lastIntent === 'uni_info' && /(?:а|и|но|ещ[ёе]|кстати|расскажи|подробн|цена|стоим|рейтинг|общежит)/i.test(q)) {
      return 'uni_info';
    }
    if (lastIntent === 'grant' && /(?:а|и|но|ещ[ёе]|кстати|други|еще|каки)/i.test(q)) {
      return 'grant';
    }
    if (lastIntent === 'recommendation' && /(?:а|и|но|ещ[ёе]|кстати|покажи|конкретн|именно)/i.test(q)) {
      return 'recommendation';
    }
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

async function classifyIntentLLM(message, history = []) {
  const historyText = (history || []).slice(-6).map(h => {
    const intent = h.intent ? ` [intent=${h.intent}]` : '';
    return `${h.role}: ${h.content}${intent}`;
  }).join('\n') || '(нет истории)';
  const systemPrompt = `Ты классифицируешь вопросы абитуриентов о вузах Казахстана.
Верни ТОЛЬКО валидный JSON, без markdown и пояснений, ровно такой формы:
{"intent": "один_из_списка", "entities": {"ent": null, "budget": null, "specialty": null, "university": null, "city": null}}

Допустимые значения intent: ${VALID_INTENTS.join(', ')}.

Правила:
- "admission" — расчёт шансов поступления, вопросы про ЕНТ (проходные баллы, требования, конкурс), "мои шансы", "поступлю ли я", "какие требования к ЕНТ". Если в предыдущих сообщениях был запрос на расчёт шансов — follow-up вопросы про ЕНТ тоже admission.
- "grant" — вопросы о грантах и стипендиях.
- "comparison" — сравнение двух и более конкретных названных вузов.
- "uni_info" — вопрос про один конкретный названный вуз (цена, рейтинг, общежитие, документы).
- "recommendation" — просьба посоветовать/подобрать вуз, "какие вузы", "какие специальности".
- "profession" — вопрос про профессию, "хочу стать", "кем работать", "какая профессия".
- "city" — вопрос про вузы в конкретном городе.
- "deadlines" — вопрос про сроки, дедлайны, регистрацию.
- "onboarding" — пользователь явно не определился с выбором.
- "greeting"/"help" — приветствие или вопрос о возможностях бота.
- "language" — просьба переключить язык ("на казахском", "по-казахски", "in English", "на русском").
- "general" — всё остальное: вопросы о процедуре поступления, документах, любые общие вопросы.

ВАЖНО: Учитывай КОНТЕКСТ предыдущих сообщений! Если пользователь ранее спрашивал про поступление/ЕНТ — follow-up вопросы про баллы/требования/конкурс = admission. Если спрашивал про вуз — follow-up = uni_info. Если спрашивал про город — follow-up = city.

Последние сообщения диалога для контекста:
${historyText}`;

  try {
    const result = await callOpenRouter(systemPrompt, message, history, { temperature: 0, maxTokens: 150 });
    const raw = result.text.trim().replace(/^```json\s*|```\s*$/g, '');
    const parsed = JSON.parse(raw);
    if (!parsed || !VALID_INTENTS.includes(parsed.intent)) {
      throw new Error('LLM вернул неизвестный intent: ' + String(parsed?.intent));
    }
    return {
      intent: parsed.intent,
      entities: parsed.entities || {},
    };
  } catch (err) {
    console.error('[ai-service] LLM-классификация не удалась, откат на regex:', err.message || err);
    return {
      intent: classifyIntent(message, history),
      entities: {},
    };
  }
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

async function handleProfessionQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const profession = findProfession(msg);

  if (!profession) {
    // Попробуем найти по специальности — ищем по category ключевым словам
    const db = getDb();
    const qLower = msg.toLowerCase();
    
    // Семантические ключевые слова → профессия
    const semanticMap = {
      'работать с людьми': 'psychologist',
      'помогать людям': 'psychologist',
      'помощь людям': 'psychologist',
      'помогать больным': 'doctor',
      'лечить': 'doctor',
      'лечение': 'doctor',
      'рисовать': 'designer',
      'создавать красивое': 'designer',
      'считать': 'economist',
      'анализировать': 'economist',
      'цифры': 'economist',
      'суд': 'lawyer',
      'закон': 'lawyer',
      'справедливость': 'lawyer',
      'учить детей': 'teacher',
      'обучать': 'teacher',
      'строить': 'engineer',
      'мосты': 'engineer',
      'здания': 'engineer',
      'продавать': 'marketer',
      'реклама': 'marketer',
      'лекарства': 'pharmacist',
      'аптека': 'pharmacist',
      'код': 'programmer',
      'программы': 'programmer',
      'сайты': 'programmer',
      'приложения': 'programmer',
      'компьютеры': 'programmer',
    };

    let semanticProfId = null;
    for (const [phrase, profId] of Object.entries(semanticMap)) {
      if (qLower.includes(phrase)) {
        semanticProfId = profId;
        break;
      }
    }

    if (semanticProfId) {
      const { PROFESSIONS: allProfs } = require('./profession-data');
      const matched = allProfs.find(p => p.id === semanticProfId);
      if (matched) {
        const title = matched.title[lang] || matched.title.ru;
        const desc = matched.description[lang] || matched.description.ru;
        const skills = matched.skills?.[lang] || matched.skills?.ru || [];
        const salary = matched.salary;
        let text = `💡 ${lang === 'kk' ? 'Сізге мына мамандық сәйкес келеді:' : lang === 'en' ? 'This profession suits you:' : 'Вам подходит профессия:'}\n\n`;
        text += `**${title}** — ${desc}\n\n`;
        if (skills.length) {
          text += `📋 ${lang === 'kk' ? 'Негізгі дағдылар' : lang === 'en' ? 'Key skills' : 'Основные навыки'}: ${skills.slice(0, 5).join(', ')}\n\n`;
        }
        text += `💰 ${lang === 'kk' ? 'Орташа жалақы' : lang === 'en' ? 'Average salary' : 'Средняя зарплата'}: ${salary?.avg?.toLocaleString() || '—'}₸\n\n`;
        text += `📝 ${lang === 'kk' ? 'Толығырақ жазыңыз:' : lang === 'en' ? 'Write for details:' : 'Напишите подробнее:'} *"${title}"*`;
        return {
          answer: text,
          matches: [],
          usedData: { profession: matched.id, semantic_match: true },
          fallback: false,
          confidence: 0.85,
          took_ms: Date.now() - startTime,
          intent: 'profession',
        };
      }
    }

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

    // Если ничего не нашли — отправляем в LLM как general
    const { getSystemPrompt: getGenPrompt } = require('./ai-prompts');
    const systemPrompt = `Ты — EduMatch KZ, консультант по профориентации в Казахстане.
Пользователь описывает свои интересы/навыки. Рекомендуй подходящие профессии из списка: Психолог, Программист, Врач, Экономист, Юрист, Дизайнер, Учитель, Инженер, Маркетолог, Фармацевт, Менеджер.
Для каждой рекомендации укажи: название, краткое описание (1-2 предложения), среднюю зарплату в Казахстане.
Отвечай на языке пользователя (${lang}). Кратко, 3-5 рекомендаций.`;
    try {
      const llmResult = await callOpenRouter(systemPrompt, msg, [], { temperature: 0.7, maxTokens: 500 });
      return {
        answer: llmResult.text,
        matches: [],
        usedData: { profession: null, llm_generated: true },
        fallback: false,
        confidence: 0.7,
        took_ms: Date.now() - startTime,
        intent: 'profession',
      };
    } catch (e) {
      return {
        answer: tr('prof_not_found', lang) || 'Я не нашёл такую профессию. Попробуйте:\n• Психолог\n• Программист\n• Врач\n• Экономист\n• Юрист\n• Дизайнер\n• Учитель\n• Инженер\n• Маркетолог\n• Фармацевт',
        matches: [],
        usedData: { profession: null },
        fallback: true,
        confidence: 0.3,
        took_ms: Date.now() - startTime,
        intent: 'profession',
      };
    }
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

  const professionData = {
    title,
    description: desc,
    salary_min: salary.min,
    salary_max: salary.max,
    salary_avg: salary.avg,
    demand,
    skills,
    career_path: careerPath,
    universities: universities.map(u => ({
      name: u.short_name || u.name,
      qs_world: u.qs_world,
      city: u.city_name,
      price_from: u.price_from,
    })),
  };

  const systemPrompt = `Ты — EduMatch KZ, консультант по профессиям и вузам Казахстана.
Ниже РЕАЛЬНЫЕ данные о профессии "${title}" (JSON) — зарплаты, вузы, навыки уже посчитаны, не выдумывай ничего сверх этого.
Отвечай на конкретный вопрос пользователя, а не пересказывай все данные подряд, если он спросил про что-то одно (например, только про зарплату).

DATA: ${JSON.stringify(professionData)}`;

  let text;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, [], { temperature: 0.7, maxTokens: 700 });
    text = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for profession, откат на шаблон:', e.message);
    text = `## 🎓 ${title}\n\n${desc}\n\n💰 **${tr('prof_salary', lang) || 'Зарплата'}:** ${salary.min.toLocaleString()} — ${salary.max.toLocaleString()}₸\n`;
    text += `   ${tr('prof_avg', lang) || 'Средняя'}: ${salary.avg.toLocaleString()}₸\n`;
    text += `📊 **${tr('prof_demand', lang) || 'Спрос'}:** ${demand}\n\n`;
    text += `🛠 **${tr('prof_skills', lang) || 'Навыки'}:**\n`;
    skills.forEach(s => { text += `• ${s}\n`; });
    text += `\n📈 **${tr('prof_career', lang) || 'Карьерный путь'}:** ${careerPath}\n`;
    if (universities.length > 0) {
      const titleWord = (lang === 'kk') ? 'Университеттер' : (lang === 'en') ? 'Universities' : 'Университеты';
      text += `\n🏛 **${tr('prof_unis', lang) || titleWord}:**\n`;
      universities.forEach(u => {
        const qs = u.qs_world ? ` (QS #${u.qs_world})` : '';
        const city = u.city_name ? `, ${u.city_name}` : '';
        const price = u.price_from ? ` — ${u.price_from.toLocaleString()}₸/год` : '';
        text += `• **${u.short_name || u.name}**${qs}${city}${price}\n`;
      });
      text += `\n💡 ${tr('prof_advice', lang) || 'Чтобы узнать шансы поступления, напишите: «Мои шансы в [вуз] на [направление] с ЕНТ [балл]»'}`;
    }
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

async function handleUniInfoQuery(msg, lang = 'ru') {
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

  const languages = foundUni.languages ? (typeof foundUni.languages === 'string' ? JSON.parse(foundUni.languages) : foundUni.languages) : [];
  const reqs = db.prepare('SELECT s.name, ar.min_ent, ar.avg_ent, ar.grant_min_ent FROM admission_requirements ar JOIN specialties s ON ar.specialty_id = s.id WHERE ar.university_id = ? ORDER BY ar.grant_min_ent DESC LIMIT 10').all(foundUni.id);
  const specs = db.prepare('SELECT s.name FROM university_specialties us JOIN specialties s ON us.specialty_id = s.id WHERE us.university_id = ? LIMIT 15').all(foundUni.id);

  const uniData = {
    name: foundUni.short_name || foundUni.name,
    city: foundUni.city_name,
    founded: foundUni.founded,
    students_count: foundUni.students_count,
    price_from: foundUni.price_from,
    price_to: foundUni.price_to,
    has_dorm: !!foundUni.has_dorm,
    dorm_price: foundUni.dorm_price,
    languages,
    qs_world: foundUni.qs_world,
    qs_asia: foundUni.qs_asia,
    website: foundUni.website,
    specialties: specs.map(s => s.name),
    ent_thresholds: reqs.map(r => ({ specialty: r.name, min_ent: r.min_ent, avg_ent: r.avg_ent, grant_min_ent: r.grant_min_ent })),
  };

  const systemPrompt = `Ты — EduMatch KZ, консультант по вузам Казахстана.
Ниже РЕАЛЬНЫЕ данные о вузе "${uniData.name}" (JSON). Отвечай ИМЕННО на то, что спросил пользователь — если спросил только про цену, не пересказывай всё остальное.
Если спрашивают про документы для поступления (это общий процесс, не в DATA) — назови: аттестат, результаты ЕНТ, паспорт, фото 3×4 (6 шт.), медсправка, льготные документы (если есть); приём — июль-август, подача через egov.kz; посоветуй уточнить точный список на сайте вуза.
НЕ выдумывай данные, которых нет в DATA.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}. Не используй русский, если пользователь пишет на казахском или английском.

DATA: ${JSON.stringify(uniData)}`;

  let text;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, [], { temperature: 0.6, maxTokens: 700 });
    text = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for uni_info, откат на шаблон:', e.message);
    text = `## ${uniData.name}\n\n📍 Город: ${uniData.city || '—'}\n💰 Стоимость: ${uniData.price_from?.toLocaleString() || '—'} – ${uniData.price_to?.toLocaleString() || '—'} тг/год\n`;
    if (uniData.languages.length) text += `🌐 Языки: ${uniData.languages.join(', ')}\n`;
    if (uniData.qs_world) text += `🏆 QS World: #${uniData.qs_world}\n`;
    if (uniData.specialties.length) text += `📚 Направления: ${uniData.specialties.join(', ')}\n`;
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

async function handleCityQuery(msg, lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();

  // Анализируем запрос на предмет баллов и специальности
  const params = parseAdmissionQuery(msg);
  const hasEnt = params.ent !== null;
  const qLower = msg.toLowerCase();

  // Извлекаем контекст из истории (budget, specialty, city, ent)
  const histParams = extractParamsFromHistory(history);
  if (!params.specialty && histParams.specialty) params.specialty = histParams.specialty;
  if (!params.cityId && histParams.cityId) params.cityId = histParams.cityId;
  if (!params.ent && histParams.ent) params.ent = histParams.ent;
  if (!params.budget && histParams.budget) params.budget = histParams.budget;

  // Проверяем, спрашивает ли пользователь о конкретном городе
  const isSpecificCityQuery = /каки[еяй]\s+(?:универ|вуз)|в\s+(?:каком|этом)\s+город|покажи\s+(?:вузы|университеты)\s+в|вуз(?:ы|ов)?\s+(?:в|городе)|вуз.*(?:в|городе)/i.test(qLower);

  // Английские/транслитерированные алиасы городов
  const cityAliases = {
    'almaty': 'Алматы', 'almata': 'Алматы', 'almat': 'Алматы',
    'astana': 'Астана', 'nur-sultan': 'Астана', 'nursultan': 'Астана',
    'shymkent': 'Шымкент', 'chemkent': 'Шымкент',
    'karaganda': 'Караганда', 'karagandy': 'Караганда',
    'aktobe': 'Актобе', 'aktyubinsk': 'Актобе',
    'pavlodar': 'Павлодар',
    'ural': 'Уральск', 'oral': 'Уральск', 'uralsk': 'Уральск',
    'atyrau': 'Атырау', 'atyrau': 'Атырау',
    'aktau': 'Актау', 'shevchenko': 'Актау',
    'semey': 'Семей', 'semipalatinsk': 'Семей',
    'kzylorda': 'Кызылорда', 'kyzylorda': 'Кызылорда',
    'petropavlovsk': 'Петропавловск',
    'ust-kamenogorsk': 'Усть-Каменогорск', 'uskemen': 'Усть-Каменогорск',
    'kokshetau': 'Кокшетау',
    'zhezkazgan': 'Жезказган',
    'kaskelen': 'Каскелен',
  };

  // Определяем ВСЕ города из запроса (для multi-city)
  let specificCities = [];
  try {
    const cities = db.prepare('SELECT id, name FROM cities').all();
    // Проверяем английские алиасы
    for (const [alias, rusName] of Object.entries(cityAliases)) {
      if (qLower.includes(alias)) {
        const matched = cities.find(c => c.name === rusName);
        if (matched && !specificCities.find(c => c.id === matched.id)) {
          specificCities.push(matched);
        }
      }
    }
    // Проверяем русские названия
    for (const c of cities) {
      const cityNameLower = c.name.toLowerCase();
      const stem = cityNameLower.slice(0, -1);
      if (qLower.includes(cityNameLower) || qLower.includes(stem)) {
        if (!specificCities.find(sc => sc.id === c.id)) {
          specificCities.push(c);
        }
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

    const cityData = {
      city: specificCity.name,
      inquiry: {
        specialty: params.specialty || null,
        ent: params.ent || null,
      },
      universities_count: unis.length,
      universities: unis.map(u => ({
        name: u.short_name || u.name,
        qs_world: u.qs_world || null,
        price_from: u.price_from || null,
        price_to: u.price_to || null,
        languages: u.languages ? JSON.parse(u.languages) : [],
        has_dorm: !!u.has_dorm,
        avg_ent: u.avg_ent || null,
        min_ent: u.min_ent || null,
        max_grant_ent: u.max_grant_ent || null,
        spec_count: u.spec_count || 0,
      })),
    };

    const systemPrompt = `Ты — EduMatch KZ, консультант по городам и университетам Казахстана.
Ниже РЕАЛЬНЫЕ данные о городе "${specificCity.name}" (JSON) — список вузов уже посчитан, не выдумывай ничего сверх этого.
Отвечай ИМЕННО на то, что спросил пользователь, а не пересказывай весь список вузов подряд, если он спросил про что-то одно.
Отвечай подробно: покажи все вузы с ценами, рейтингами, языками, общежитиями и средними баллами ЕНТ.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}. Не используй русский, если пользователь пишет на казахском или английском.

DATA: ${JSON.stringify(cityData)}`;

    let text;
    try {
      const llmResult = await callOpenRouter(systemPrompt, msg, [], { temperature: 0.6, maxTokens: 800 });
      text = llmResult.text;
    } catch (e) {
      console.error('[ai-service] LLM composition failed for city, откат на шаблон:', e.message);
      text = `🏙 **${specificCity.name}** — ${unis.length} ${unis.length === 1 ? 'вуз' : unis.length < 5 ? 'вуза' : 'вузов'}`;
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

  const hintLabel = lang === 'kk' ? 'Есептеу үшін жазыңыз:' : lang === 'en' ? 'Write to calculate:' : 'Напишите:';
  const hintExample = lang === 'kk' ? 'Менің мүмкіндіктерім [универ] [мамандық] ҰБТ [балл]'
    : lang === 'en' ? 'My chances at [uni] [specialty] ENT [score]'
    : 'Мои шансы в [вуз] на [направление] с ЕНТ [балл]';
  text += '\n\n💡 ' + hintLabel + ' *"' + hintExample + '"*';
    }

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

function buildGrantListFallback(grants, matchedSpec, specDisplayNames, cityName, lang) {
  const db = getDb();
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
  return text;
}

async function handleGrantQuery(msg, history = [], lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  // Извлекаем контекст из истории
  const histParams = extractParamsFromHistory(history);

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

  const grantsData = {
    filters: { specialty: matchedSpec ? specDisplayNames[matchedSpec] : null, city: cityName },
    grants: grants.slice(0, 15).map(g => {
      let uniName = null, uniCity = null;
      if (g.university_id) {
        const uni = db.prepare('SELECT short_name, city_id FROM universities WHERE id = ?').get(g.university_id);
        if (uni) {
          uniName = uni.short_name;
          uniCity = db.prepare('SELECT name FROM cities WHERE id = ?').get(uni.city_id)?.name;
        }
      }
      return {
        name: g.name,
        type: g.type,
        amount: g.amount,
        description: (lang === 'kk' && g.description_kk) ? g.description_kk : (lang === 'en' && g.description_en) ? g.description_en : g.description,
        deadline: g.deadline,
        link: g.link,
        university: uniName,
        university_city: uniCity,
      };
    }),
  };

  const systemPrompt = `Ты — EduMatch KZ, консультант по грантам и стипендиям в Казахстане.
Ниже РЕАЛЬНЫЕ данные о грантах (JSON) — не выдумывай гранты, суммы или дедлайны, которых нет в DATA.
Отвечай на конкретный вопрос пользователя. Если грантов по его запросу не нашлось, но есть общий список (см. filters) — честно скажи, что точных совпадений нет, покажи ближайшие альтернативы.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}. Не используй русский, если пользователь пишет на казахском или английском.

DATA: ${JSON.stringify(grantsData)}`;

  let text;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, history, { temperature: 0.6, maxTokens: 700 });
    text = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for grant, откат на шаблон:', e.message);
    text = buildGrantListFallback(grants, matchedSpec, specDisplayNames, cityName, lang);
  }

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

function buildComparisonTableFallback(unis, descriptions, lang) {
  let text = `## 📊 Сравнение: ${unis.map(u => u.short_name).join(' vs ')}\n\n`;

  const headers = [`| | ${unis.map(u => `**${u.short_name}**`).join(' | ')} |`];
  const sep = `|---|${unis.map(() => '---').join('|')}|`;
  const rows = [
    `| 🏙 Город | ${unis.map(u => u.city_name || '—').join(' | ')} |`,
    `| 📅 Основан | ${unis.map(u => u.founded || '—').join(' | ')} |`,
    `| 🌍 QS World | ${unis.map(u => u.qs_world ? `#${u.qs_world}` : '—').join(' | ')} |`,
    `| 🌏 QS Asia | ${unis.map(u => u.qs_asia ? `#${u.qs_asia}` : '—').join(' | ')} |`,
    `| 💰 Стоимость | ${unis.map(u => u.price_from ? `${u.price_from.toLocaleString()}–${(u.price_to || u.price_from).toLocaleString()}₸` : '—').join(' | ')} |`,
    `| 👥 Студентов | ${unis.map(u => u.students_count ? u.students_count.toLocaleString() : '—').join(' | ')} |`,
    `| 📚 Специальностей | ${unis.map(u => u.spec_count || 0).join(' | ')} |`,
    `| 🏠 Общежитие | ${unis.map(u => u.has_dorm ? '✅ Да' : '❌ Нет').join(' | ')} |`,
    `| 🌐 Языки | ${unis.map(u => u.languages ? JSON.parse(u.languages).join(', ') : '—').join(' | ')} |`,
  ];

  text += `${headers.join('\n')}\n${sep}\n${rows.join('\n')}\n\n`;

  if (descriptions.some(Boolean)) {
    text += `### Описание\n\n`;
    descriptions.forEach((desc, idx) => {
      if (desc) text += `**${unis[idx].short_name}:** ${desc.slice(0, 300)}\n\n`;
    });
  }

  text += `### 💡 Рекомендация\n\n`;
  const qws = unis.map(u => u.qs_world).filter(Boolean);
  if (qws.length > 1) {
    const best = [...unis].sort((a, b) => (a.qs_world || Infinity) - (b.qs_world || Infinity))[0];
    text += `**${best.short_name}** имеет лучший QS World по сравнению с остальными. `;
  }
  const cheapest = [...unis].sort((a, b) => (a.price_from || Infinity) - (b.price_from || Infinity))[0];
  text += `**${cheapest.short_name}** дешевле остальных по исходной цене.`;

  text += `\n\nНапишите *"Мои шансы в ${unis[0].short_name}"* для расчёта вероятности поступления.`;
  return text;
}

async function handleComparisonQuery(msg, history = [], lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  const unis = db.prepare('SELECT id, short_name, name FROM universities').all();
  // Английские алиасы университетов
  const uniAliases = {
    'kbtu': 'КБТУ', 'kaznu': 'КазНУ', 'kaznu im. al-farabi': 'КазНУ',
    'nu': 'НУ', 'nazarbayev': 'НУ', 'nazarbayev university': 'НУ',
    'enu': 'ЕНУ', 'l.n. gumilyov': 'ЕНУ',
    'muIt': 'МУИТ', 'iitu': 'МУИТ',
    'kimep': 'KIMEP',
    'astana medical': 'АТУ', 'atu': 'АТУ',
    'kazakh': 'КазНУ',
  };
  const mentioned = [];
  for (const u of unis) {
    const shortLower = u.short_name.toLowerCase();
    const nameLower = u.name.toLowerCase();
    if (qLower.includes(shortLower) || qLower.includes(nameLower)) {
      mentioned.push(u);
      continue;
    }
    // Проверяем английские алиасы
    for (const [alias, rusName] of Object.entries(uniAliases)) {
      if (qLower.includes(alias) && u.short_name === rusName) {
        if (!mentioned.find(m => m.id === u.id)) mentioned.push(u);
        break;
      }
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

  const selected = scored.slice(0, 3);
  const fulls = [];
  for (const uni of selected) {
    const full = db.prepare(`
      SELECT u.*, c.name as city_name,
        (SELECT COUNT(DISTINCT us2.specialty_id) FROM university_specialties us2 WHERE us2.university_id = u.id) as spec_count,
        (SELECT COUNT(DISTINCT ar2.specialty_id) FROM admission_requirements ar2 WHERE ar2.university_id = u.id) as req_count
      FROM universities u
      LEFT JOIN cities c ON u.city_id = c.id
      WHERE u.id = ?
    `).get(uni.id);
    if (full) fulls.push(full);
  }

  if (fulls.length < 2) {
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

  const descriptions = fulls.map(u => pickDescription(u, lang));
  const compareData = fulls.map((u, idx) => ({
    name: u.short_name,
    city: u.city_name,
    founded: u.founded,
    qs_world: u.qs_world,
    qs_asia: u.qs_asia,
    price_from: u.price_from,
    price_to: u.price_to,
    students_count: u.students_count,
    specialties_count: u.spec_count,
    has_dorm: !!u.has_dorm,
    languages: u.languages ? JSON.parse(u.languages) : [],
    description: descriptions[idx],
  }));

  const systemPrompt = `Ты — EduMatch KZ, консультант по вузам Казахстана.
Ниже РЕАЛЬНЫЕ данные о вузах (JSON) для сравнения. Не выдумывай цифры, которых нет в DATA.
Оформи ответ как КОРОТКУЮ markdown-таблицу (5-7 строк: название, город, рейтинг, цена, ЕНТ) + 2-3 предложения вывод.
НЕ пиши длинные описания — будь максимально лаконичен. Максимум 500 слов.
Если пользователь спросил про что-то конкретное — отвечай прямо на это, без полной таблицы.
Отвечай на языке: ${lang === 'kk' ? 'казахском' : lang === 'en' ? 'английском' : 'русском'}. Не используй русский, если пользователь пишет на казахском или английском.

DATA: ${JSON.stringify(compareData)}`;

  let text;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, history, { temperature: 0.6, maxTokens: 700 });
    text = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for comparison, откат на шаблон:', e.message);
    text = buildComparisonTableFallback(fulls, descriptions, lang);
  }

  return {
    answer: text,
    matches: [],
    usedData: { universities_count: fulls.length, universities: fulls.map(u => u.short_name) },
    fallback: false,
    confidence: 0.95,
    took_ms: Date.now() - startTime,
    intent: 'comparison',
  };
}

// ==================== RECOMMENDATION HANDLER ====================

async function handleRecommendationQuery(msg, history = [], lang = 'ru') {
  const startTime = Date.now();
  const db = getDb();
  const qLower = msg.toLowerCase();

  // Определяем специальность из запроса
  const params = parseAdmissionQuery(msg);
  let specialtyCategory = params.specialty;

  // Извлекаем контекст из истории
  const histParams = extractParamsFromHistory(history);
  if (!specialtyCategory && histParams.specialty) specialtyCategory = histParams.specialty;
  const budget = params.budget || histParams.budget;
  const cityId = params.cityId || histParams.cityId;
  const ent = params.ent || histParams.ent;

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

  const specText = specialtyCategory ? `📚 **${lang === 'kk' ? 'Мамандық' : lang === 'en' ? 'Specialty' : 'Специальность'}:** ${specialtyCategory}\n` : '';
  const cityText = params.cityName ? `🏙 **${lang === 'kk' ? 'Қала' : lang === 'en' ? 'City' : 'Город'}:** ${params.cityName}\n` : '';
  const budgetText = budget ? `💰 **${lang === 'kk' ? 'Бюджет' : lang === 'en' ? 'Budget' : 'Бюджет'}:** ${lang === 'kk' ? 'дейін' : lang === 'en' ? 'up to' : 'до'} ${budget.toLocaleString()}₸\n` : '';
  const entText = params.ent ? `🎯 **${lang === 'kk' ? 'Сіздің ҰБТ' : lang === 'en' ? 'Your ENT' : 'Ваш ЕНТ'}:** ${params.ent}\n` : '';

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

  text += `## 📋 ${lang === 'kk' ? 'Үздік университеттер' : lang === 'en' ? 'Best universities' : 'Лучшие вузы'} (${grouped.length}):\n\n`;

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
      text += `   📊 ${lang === 'kk' ? 'орташа ҰБТ' : lang === 'en' ? 'avg ENT' : 'средний ЕНТ'} ${avgEnt}, ${lang === 'kk' ? 'мин' : lang === 'en' ? 'min' : 'мин'} ${minEnt}, ${lang === 'kk' ? 'грантқа дейін' : lang === 'en' ? 'grant up to' : 'грант до'} ${grantEnt}\n\n`;
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

async function callOpenRouter(systemPrompt, userMessage, history, options = {}) {
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
    temperature: options.temperature ?? 0.75,
    max_tokens: options.maxTokens ?? 640,
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

  const admissionData = {
    ent: params.ent,
    specialty: specialtyToUse,
    budget: params.budget,
    matches: filtered.slice(0, 12).map(m => ({
      university: m.university,
      chance_percent: m.chance,
      recommendation: m.recommendation,
      min_ent: m.requirement?.min_ent,
      avg_ent: m.requirement?.avg_ent,
      grant_min_ent: m.requirement?.grant_min_ent,
      price_from: m.price_from,
    })),
    academicYear: prediction.academicYear || '2025-2026',
    whatIf: prediction.whatIf || [],
  };

  const systemPrompt = `Ты — EduMatch KZ, консультант по поступлению в вузы Казахстана.
Ниже РЕАЛЬНО посчитанные данные о шансах поступления (JSON) — проценты и пороги ЕНТ уже рассчитаны кодом, ты их НЕ пересчитываешь и не меняешь, только объясняешь.
Отвечай на конкретный вопрос пользователя. Если он спросил только про один вуз — не вываливай весь список остальных.
Если задаёт уточняющий вопрос ("а если баллы выше?", "а на другую специальность?") — отвечай по существу.
НЕ выдумывай проценты, вузы или пороги, которых нет в DATA.

DATA: ${JSON.stringify(admissionData)}`;

  let answer;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, history, { temperature: 0.6, maxTokens: 700 });
    answer = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for admission, откат на шаблон:', e.message);
    answer = getAdmissionBriefPrompt(params, { ...prediction, matches: filtered });
  }

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

function buildOnboardingFallback(params, lang) {
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
  return answer;
}

async function handleOnboardingQuery(msg, history = [], lang = 'ru') {
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
    return await handleRecommendationQuery(msg, history, lang);
  }

  const onboardingData = {
    known: { ent: params.ent, specialty: params.specialty, has_city: !!params.cityId, budget: params.budget },
    missing_fields: missing,
  };

  const systemPrompt = `Ты — EduMatch KZ, консультант по вузам Казахстана.
Пользователю не хватает данных для точного подбора вуза. Ниже — что уже известно и чего не хватает (JSON).
Задай недостающие вопросы живым языком, коротко, без нумерованного шаблона — учитывай именно то, что написал пользователь.
Если он прямо попросил "задай вопросы" — задавай по одному-два за раз, а не все сразу.

DATA: ${JSON.stringify(onboardingData)}`;

  let answer;
  try {
    const llmResult = await callOpenRouter(systemPrompt, msg, history, { temperature: 0.7, maxTokens: 400 });
    answer = llmResult.text;
  } catch (e) {
    console.error('[ai-service] LLM composition failed for onboarding, откат на шаблон:', e.message);
    answer = buildOnboardingFallback(params, lang);
  }

  return {
    answer,
    matches: [],
    usedData: { onboarding_step: missing.length, params },
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

  const classification = await classifyIntentLLM(msg, history);
  const intent = classification.intent || classifyIntent(msg, history);
  console.log(`[ai-service] Classified intent: "${intent}"`);

  // Обработка смены языка
  if (intent === 'language' || /(?:на казахском|по-казахски|қазақша|in english|на английском|на русском|по-русски)/i.test(msg)) {
    let newLang = lang;
    if (/(?:на казахском|по-казахски|қазақша)/i.test(msg)) newLang = 'kk';
    else if (/(?:in english|на английском)/i.test(msg)) newLang = 'en';
    else if (/(?:на русском|по-русски)/i.test(msg)) newLang = 'ru';
    const langNames = { ru: 'русском', kk: 'казахском', en: 'английском' };
    return {
      answer: `✅ ${lang === 'kk' ? 'Тіл ауыстырылды' : lang === 'en' ? 'Language switched' : 'Язык переключён'}: ${langNames[newLang] || newLang}.\n\n${lang === 'kk' ? 'Енді сізге қазақша жауап беремін.' : lang === 'en' ? 'I will now respond in English.' : 'Теперь я буду отвечать на ' + (langNames[newLang] || newLang) + '.'}`,
      matches: [],
      usedData: { language_switch: newLang },
      fallback: false,
      confidence: 1.0,
      took_ms: Date.now() - startTime,
      intent: 'language',
      detectedLang: newLang,
    };
  }

  if (intent === 'admission') {
    console.log('[ai-service] Routing to admission handler');
    return await handleAdmissionChatQuery(msg, history, lang);
  }

  if (intent === 'profession') {
    console.log('[ai-service] Routing to profession handler');
    return await handleProfessionQuery(msg, lang);
  }

  if (intent === 'uni_info') {
    console.log('[ai-service] Routing to uni_info handler');
    return await handleUniInfoQuery(msg, lang);
  }

  if (intent === 'city') {
    console.log('[ai-service] Routing to city handler');
    return await handleCityQuery(msg, history, lang);
  }

  if (intent === 'grant') {
    console.log('[ai-service] Routing to grant handler');
    return await handleGrantQuery(msg, history, lang);
  }

  if (intent === 'comparison') {
    console.log('[ai-service] Routing to comparison handler');
    return await handleComparisonQuery(msg, history, lang);
  }

  if (intent === 'recommendation') {
    console.log('[ai-service] Routing to recommendation handler');
    return await handleRecommendationQuery(msg, history, lang);
  }

  if (intent === 'onboarding') {
    console.log('[ai-service] Routing to onboarding handler');
    return await handleOnboardingQuery(msg, history, lang);
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
