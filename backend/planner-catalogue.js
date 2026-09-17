// ═══════════════════════════════════════════════════════════════════════════════
// PLANNER CATALOGUE — Verified admission data for 6 pilot programmes
// ═══════════════════════════════════════════════════════════════════════════════
//
// Data verification policy:
// - Each value has a source reference and review date
// - null means "not published / not confirmed" — NEVER guess
// - conflict=true flags contradictory official information
// - grantMinEnt stored separately; minimumEnt is always the PAID threshold
// - Per-programme source chains: every value traceable to official page
//
// Verification log:
//   2026-09-14: initial review of all 6 programmes from live official sites
//   МУИТ sources: iitu.edu.kz, admission.iitu.edu.kz
//   AITU sources: astanait.edu.kz
//
// ═══════════════════════════════════════════════════════════════════════════════

const reviewedAt = '2026-09-14';

// ─── SOURCE CATALOGUE ───────────────────────────────────────────────────────
// Each source is an official page with URL, review date, and extracted data points.
const sources = {
  // ── AITU (Astana IT University) ──
  aitu: {
    id: 'aitu',
    url: 'https://astanait.edu.kz/ru/how-to-apply',
    title: 'AITU — поступление после школы',
    reviewedAt,
    dataType: 'admission',
    notes: 'Общая страница: порог платного 70 (B057/B058/B059/B063/B042/B044/B062). Порог гранта varies: B057=100, B058=93, B059=85, B063/B042/B044/B062=75. AET обязателен для платников.',
    extractedData: {
      entThresholds: 'Платное: 70 по всем группам. Грант: B057=100, B058=93, B059=85, B063/B042/B044/B062=75.',
      entSubjects: 'B057/B058: мат+инф. B059/B063/B044/B062: мат+физ. B042: творческие. B049: всемирная история+основы права.',
      programs: 'B057: Software Engineering, Computer Science, Big Data Analysis, Media Technologies, Mathematical and Computational Science. B058: Cybersecurity, Smart Security Technologies.',
      extraExam: 'AET обязателен. Модуль 1: английский (30/50). Модуль 2: основы CS и логики (25/50). Регистрация: 21 июля — 20 авг.',
      timeline: 'ЕНТ: май-июль. AET: 21 июля — 20 авг. Документы: через My DU, до 24 авг. Зачисление: до 25 авг.',
      dorm: '3 жилых комплекса, 2/3/4-местные комнаты. Подача через My DU 20-24 авг. есть места (64 в Доме №4).',
    },
  },
  aituFunding: {
    id: 'aituFunding',
    url: 'https://astanait.edu.kz/educational-grants',
    title: 'AITU — KAZENERGY грант 2026–2027',
    reviewedAt,
    dataType: 'funding',
    notes: 'Конкурс от NCOC/KPO через KAZENERGY. Заявки: 25 июля — 31 авг 2026 на grant.kazenergy.com. Отдельный конкурс, не зависит от ЕНТ-порога AITU.',
    extractedData: {
      portal: 'grant.kazenergy.com',
      period: '25 июля — 31 авг 2026',
      eligibility: 'Граждане РК, выпускники школ/колледжей/вузов. ЕНТ сертификат обязателен (можно использовать лучший результат 2026 года).',
      contact: 'Tel: +7 (7172) 79-49-75, email: candidate@kazenergy.com',
    },
  },
  aituDorm: {
    id: 'aituDorm',
    url: 'https://astanait.edu.kz/ru/students-dormitory',
    title: 'AITU — общежитие',
    reviewedAt,
    dataType: 'dorm',
    notes: '3 жилых комплекса, отдельно для девочек и юношей. 3 типа комнат: 2-местные, 3-местные, 4-местные. Оснащение: учебные комнаты, комнаты отдыха, кухни, столовая, прачечная, wifi. Сироты и инвалиды — бесплатно.',
    extractedData: {
      roomTypes: 'Двухместная, трёхместная, четырёхместная',
      facilities: 'Учебные комнаты, комнаты отдыха, кухни, столовая, прачечная, wifi',
      freePlaces: 'Дом №4 (Кабанбай батыра, 60а/8): 64 свободных мест (данные на август 2025)',
      applicationProcess: 'Подача через My DU, 20-24 августа 2026. Потом комиссия, медпункт, экономический отдел, ОМП, ректорат.',
      cost: null, // NOT published on site
    },
  },

  // ── МУИТ (International IT University) ──
  iitu: {
    id: 'iitu',
    url: 'https://iitu.edu.kz/ru/applicants/bachelor/',
    title: 'МУИТ — бакалавриат, стоимость 2026–2027',
    reviewedAt,
    dataType: 'tuition',
    notes: 'Стоимость 2026-2027. 4-летняя форма (240 кредитов). B057/B058/B157: 1 курс 1 479 000, 2 курс 1 530 000, 3 курс 1 590 000, 4 курс 1 680 000. Итого: 6 279 000 ₸. B059: 1 128 000 → 4 848 000. B042: 1 299 000 → 5 409 000. B044/B046: 1 479 000 → 6 279 000.',
    extractedData: {
      tuitionB057: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
      tuitionB058: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
      tuitionB157: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
      tuitionB059: { y1: 1128000, y2: 1170000, y3: 1230000, y4: 1320000, total: 4848000 },
      form: 'Очное, 4 года (240 кредитов)',
      academicYear: '2026-2027',
    },
  },
  iituSubjects: {
    id: 'iituSubjects',
    url: 'https://admission.iitu.edu.kz/ictmath_ru',
    title: 'МУИТ — программы, математика + информатика',
    reviewedAt,
    dataType: 'subjects',
    notes: 'Фильтр по предметам. Все B057/B058/B157 программы требуют мат+инф.',
    extractedData: {
      subjects: 'Математика + Информатика для B057, B058, B157',
      availableFilters: 'Математика-Информатика, Математика-География, Математика-Физика, Творческие экзамены',
    },
  },
  iituEntry: {
    id: 'iituEntry',
    url: 'https://admission.iitu.edu.kz/',
    title: 'МУИТ — приём 2026, ЕНТ и сроки',
    reviewedAt,
    dataType: 'ent_thresholds',
    notes: 'ЕНТ таблица (модальное окно на сайте): B057/B058 — мин. грант 75, мин. платное 50, мин. грант ТиПО 25, мин. платное ТиПО внутр. экзамен.',
    extractedData: {
      entTable: {
        B042: { grant: 70, paid: 50, grantTip: null, paidTip: null },
        B044: { grant: 60, paid: 50, grantTip: null, paidTip: 'внутр. экз' },
        B046: { grant: 60, paid: 50, grantTip: null, paidTip: 'внутр. экз' },
        B057: { grant: 75, paid: 50, grantTip: 25, paidTip: 'внутр. экз' },
        B058: { grant: 75, paid: 50, grantTip: 25, paidTip: 'внутр. экз' },
        B157: { grant: 75, paid: 50, grantTip: null, paidTip: null },
        B059: { grant: 50, paid: 50, grantTip: 25, paidTip: 'внутр. экз' },
      },
      timeline: {
        ent: 'Регистрация на ЕНТ: 10 мая — 10 июля (app.testcenter.kz)',
        documents: 'Подача документов: 20 июня — 25 августа',
        englishExam: 'Экзамен по английскому: 1 июля — 25 августа (опционально, можно IELTS/TOEFL)',
        enrollment: 'Зачисление: 25 августа',
      },
      documents: [
        'Удостоверение личности',
        'Заявление о приёме',
        'Медицинская справка №075 (с печатями нарко/психо, терапевта)',
        'IELTS/TOEFL (при наличии) или результат теста по английскому',
        'Фото 3×4 (6 штук)',
        'Аттестат с приложением / диплом с транскриптом',
        'Сертификат ЕНТ (электронная версия)',
        'Сертификат о гранте (при наличии)',
        'Копия приписного свидетельства (для юношей)',
        'Карта прививок (форма 063/У — в Паспорте здоровья)',
      ],
      note: 'Все документы кроме формы 063/У — в PDF. Подача через platonus.iitu.edu.kz.',
    },
  },
  iituDorm: {
    id: 'iituDorm',
    url: 'https://iitu.edu.kz/ru/students/student-life/',
    title: 'МУИТ — общежитие (раздел студентам)',
    reviewedAt,
    dataType: 'dorm',
    notes: 'На сайте есть ссылка «Хостел для студентов», но прямая страница возвращает 404. Общежитие существует, но стоимость и условия не опубликованы на основном сайте.',
    extractedData: {
      exists: true,
      guaranteed: false,
      cost: null,
      conditions: null,
      note: 'Ссылка есть на странице бакалавриата. Подробности требуют уточнения в приёмной комиссии.',
    },
  },
};

// ─── PROGRAMME CATALOGUE ────────────────────────────────────────────────────
// 6 pilot programmes: 3 AITU + 3 МУИТ
// Each programme stores: verified values + source chains + verification status

const programmes = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AITU (Astana IT University, Астана)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Software Engineering (B057) ──
  {
    id: 'aitu-software',
    name: 'Software Engineering',
    group: 'B057',
    university: 'Astana IT University',
    city: 'Астана',
    subjects: ['math', 'informatics'],

    // ── Tuition ──
    tuition: null,          // NOT published on official site
    tuitionYear: null,
    tuitionNote: 'Стоимость не опубликована на сайте AITU. Уточните в приёмной комиссии.',

    // ── ENT thresholds ──
    minimumEnt: 70,         // paid: from how-to-apply table
    grantMinEnt: 100,       // grant: from how-to-apply table (B057)
    requirementsYear: 2026,
    entSectionsNote: 'Минимумы по разделам ЕНТ не опубликованы. Уточните на сайте.',

    // ── Conflict flag ──
    conflict: true,
    conflictNote: 'Общая страница (how-to-apply): платное 70. Страница KAZENERGY финансирования: платное 80. Год общих требований не обозначен.',

    // ── Extra exam ──
    extraExam: 'AET',
    extraExamDetails: {
      name: 'AITU Excellence Test',
      modules: [
        { name: 'English language proficiency', minScore: 30, maxScore: 50 },
        { name: 'Fundamentals of Computer Science and Logic', minScore: 25, maxScore: 50 },
      ],
      registrationPeriod: '21 июля — 20 августа 2026',
      mandatory: true,
      note: 'Обязателен для всех платников. При наличии IELTS/TOEFL — освобождение от модуля английского (уточнить).',
    },

    // ── Timeline ──
    deadline: '2026-08-24', // document acceptance (footer of how-to-apply)
    timeline: {
      entRegistration: 'май — июль (app.testcenter.kz)',
      documentSubmission: '20 июня — 24 августа (через приложение My DU)',
      aetRegistration: '21 июля — 20 августа',
      aetExam: 'после регистрации (точные даты на сайте)',
      originalDocuments: 'до 24 августа лично',
      enrollment: 'по результатам AET и ЕНТ, до 25 августа',
      grantApplication: '25 июля — 31 августа (grant.kazenergy.com, отдельный конкурс)',
    },

    // ── Documents ──
    documents: [
      'Удостоверение личности',
      'Заявление (через My DU)',
      'Аттестат / диплом',
      'Сертификат ЕНТ',
      'Фото 3×4',
      'Оригиналы документов лично',
    ],
    documentsNote: 'Полный список уточните в приёмной. Загрузка через My DU, потом оригинал.',

    // ── Language ──
    language: ['ru', 'en'],

    // ── Dorm ──
    dorm: true,             // confirmed: 3 complexes, 2/3/4-person rooms
    dormDetails: {
      roomTypes: ['2-местная', '3-местная', '4-местная'],
      separateGender: true,
      facilities: ['учебные комнаты', 'комнаты отдыха', 'кухни', 'столовая', 'прачечная', 'wifi'],
      applicationPeriod: '20 — 24 августа 2026 (через My DU)',
      freePlacesNote: 'Дом №4: 64 места (данные на авг 2025). Актуальные — через My DU.',
      cost: null, // NOT published
      socialBenefits: 'Сироты и студенты с инвалидностью — бесплатно',
    },

    // ── Source chain ──
    sources: ['aitu', 'aituFunding', 'aituDorm'],
  },

  // ── Computer Science (B057) ──
  {
    id: 'aitu-cs',
    name: 'Computer Science',
    group: 'B057',
    university: 'Astana IT University',
    city: 'Астана',
    subjects: ['math', 'informatics'],
    tuition: null,
    tuitionYear: null,
    tuitionNote: 'Стоимость не опубликована на сайте AITU. Уточните в приёмной комиссии.',
    minimumEnt: 70,
    grantMinEnt: 100,
    requirementsYear: 2026,
    entSectionsNote: 'Минимумы по разделам ЕНТ не опубликованы. Уточните на сайте.',
    conflict: true,
    conflictNote: 'Общая страница: платное 70. Финансирование: платное 80.',
    extraExam: 'AET',
    extraExamDetails: {
      name: 'AITU Excellence Test',
      modules: [
        { name: 'English language proficiency', minScore: 30, maxScore: 50 },
        { name: 'Fundamentals of Computer Science and Logic', minScore: 25, maxScore: 50 },
      ],
      registrationPeriod: '21 июля — 20 августа 2026',
      mandatory: true,
    },
    deadline: '2026-08-24',
    timeline: {
      entRegistration: 'май — июль',
      documentSubmission: '20 июня — 24 августа (My DU)',
      aetRegistration: '21 июля — 20 августа',
      originalDocuments: 'до 24 августа лично',
      enrollment: 'до 25 августа',
      grantApplication: '25 июля — 31 августа (grant.kazenergy.com)',
    },
    documents: ['Удостоверение личности', 'Заявление (My DU)', 'Аттестат/диплом', 'Сертификат ЕНТ', 'Фото 3×4', 'Оригиналы лично'],
    documentsNote: 'Полный список уточните в приёмной.',
    language: ['ru', 'en'],
    dorm: true,
    dormDetails: {
      roomTypes: ['2-местная', '3-местная', '4-местная'],
      separateGender: true,
      facilities: ['учебные комнаты', 'комнаты отдыха', 'кухни', 'столовая', 'прачечная', 'wifi'],
      applicationPeriod: '20 — 24 августа 2026 (My DU)',
      cost: null,
      socialBenefits: 'Сироты и инвалиды — бесплатно',
    },
    sources: ['aitu', 'aituFunding', 'aituDorm'],
  },

  // ── Cybersecurity (B058) ──
  {
    id: 'aitu-cyber',
    name: 'Cybersecurity',
    group: 'B058',
    university: 'Astana IT University',
    city: 'Астана',
    subjects: ['math', 'informatics'],
    tuition: null,
    tuitionYear: null,
    tuitionNote: 'Стоимость не опубликована на сайте AITU. Уточните в приёмной комиссии.',
    minimumEnt: 70,
    grantMinEnt: 93,        // B058 has different grant threshold
    requirementsYear: 2026,
    entSectionsNote: 'Минимумы по разделам ЕНТ не опубликованы.',
    conflict: true,
    conflictNote: 'Общая страница: платное 70. Финансирование: платное 80.',
    extraExam: 'AET',
    extraExamDetails: {
      name: 'AITU Excellence Test',
      modules: [
        { name: 'English language proficiency', minScore: 30, maxScore: 50 },
        { name: 'Fundamentals of Computer Science and Logic', minScore: 25, maxScore: 50 },
      ],
      registrationPeriod: '21 июля — 20 августа 2026',
      mandatory: true,
    },
    deadline: '2026-08-24',
    timeline: {
      entRegistration: 'май — июль',
      documentSubmission: '20 июня — 24 августа (My DU)',
      aetRegistration: '21 июля — 20 августа',
      originalDocuments: 'до 24 августа лично',
      enrollment: 'до 25 августа',
      grantApplication: '25 июля — 31 августа (grant.kazenergy.com)',
    },
    documents: ['Удостоверение личности', 'Заявление (My DU)', 'Аттестат/диплом', 'Сертификат ЕНТ', 'Фото 3×4', 'Оригиналы лично'],
    documentsNote: 'Полный список уточните в приёмной.',
    language: ['ru', 'en'],
    dorm: true,
    dormDetails: {
      roomTypes: ['2-местная', '3-местная', '4-местная'],
      separateGender: true,
      facilities: ['учебные комнаты', 'комнаты отдыха', 'кухни', 'столовая', 'прачечная', 'wifi'],
      applicationPeriod: '20 — 24 августа 2026 (My DU)',
      cost: null,
      socialBenefits: 'Сироты и инвалиды — бесплатно',
    },
    sources: ['aitu', 'aituFunding', 'aituDorm'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // МУИТ (International IT University, Алматы)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 6B06101 — Компьютерные науки (B057) ──
  {
    id: 'iitu-cs',
    name: '6B06101 — Компьютерные науки',
    group: 'B057',
    university: 'МУИТ / IITU',
    city: 'Алматы',
    subjects: ['math', 'informatics'],

    // ── Tuition (verified per-year from iitu.edu.kz) ──
    tuition: 1479000,       // 1st year, 2026-2027
    tuitionYear: 2026,
    tuitionBreakdown: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
    tuitionNote: '4-летняя форма, 240 кредитов. Стоимость растёт ежегодно.',

    // ── ENT thresholds ──
    minimumEnt: 50,         // paid: from ENT threshold table
    grantMinEnt: 75,        // grant: from ENT threshold table (B057)
    grantMinEntTip: 25,     // grant for college graduates (ТиПО)
    paidMinEntTip: null,    // paid for college graduates — internal exam, not ENT
    requirementsYear: 2026,
    entSectionsNote: 'Минимальные баллы по разделам ЕНТ (мат/инф отдельно) не опубликованы. Уточните на admission.iitu.edu.kz.',

    // ── Conflict ──
    conflict: false,

    // ── Extra exam ──
    extraExam: 'language',
    extraExamDetails: {
      name: 'Экзамен по английскому языку',
      period: '1 июля — 25 августа',
      mandatory: false,     // optional with IELTS/TOEFL
      note: 'Для программ с англ. языком обучения. При наличии IELTS/TOEFL — освобождение.',
    },

    // ── Timeline ──
    deadline: '2026-08-25', // enrollment / last document day
    timeline: {
      entRegistration: '10 мая — 10 июля (app.testcenter.kz)',
      documentSubmission: '20 июня — 25 августа',
      englishExam: '1 июля — 25 августа (опционально, можно IELTS/TOEFL)',
      enrollment: '25 августа',
    },

    // ── Documents (from modal on iitu.edu.kz) ──
    documents: [
      'Удостоверение личности (для идентификации)',
      'Заявление о приёме',
      'Медицинская справка №075 с флюорографией (с печатями нарко/психо, терапевта)',
      'IELTS/TOEFL (при наличии) или результат теста по английскому',
      'Фото 3×4 (6 штук)',
      'Аттестат с приложением / диплом с транскриптом',
      'Сертификат ЕНТ (электронная версия)',
      'Сертификат о гранте (при наличии)',
      'Копия приписного свидетельства (для юношей)',
      'Карта прививок (форма 063/У — в Паспорте здоровья)',
    ],
    documentsNote: 'Все документы кроме 063/У — в PDF. Подача через platonus.iitu.edu.kz.',

    // ── Language ──
    language: ['ru', 'kk', 'en'],

    // ── Dorm ──
    dorm: true,             // exists on site, but no guarantee
    dormDetails: {
      exists: true,
      guaranteed: false,
      cost: null,
      conditions: null,
      note: 'Ссылка «Хостел для студентов» есть на странице бакалавриата. Стоимость и условия — уточнить в приёмной.',
    },

    // ── Source chain ──
    sources: ['iitu', 'iituSubjects', 'iituEntry', 'iituDorm'],
  },

  // ── 6B06110 — Программная инженерия (B057) ──
  {
    id: 'iitu-software',
    name: '6B06110 — Программная инженерия',
    group: 'B057',
    university: 'МУИТ / IITU',
    city: 'Алматы',
    subjects: ['math', 'informatics'],
    tuition: 1479000,
    tuitionYear: 2026,
    tuitionBreakdown: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
    tuitionNote: '4-летняя форма, 240 кредитов.',
    minimumEnt: 50,
    grantMinEnt: 75,
    grantMinEntTip: 25,
    paidMinEntTip: null,
    requirementsYear: 2026,
    entSectionsNote: 'Минимумы по разделам ЕНТ не опубликованы.',
    conflict: false,
    extraExam: 'language',
    extraExamDetails: {
      name: 'Экзамен по английскому',
      period: '1 июля — 25 августа',
      mandatory: false,
      note: 'При наличии IELTS/TOEFL — освобождение.',
    },
    deadline: '2026-08-25',
    timeline: {
      entRegistration: '10 мая — 10 июля',
      documentSubmission: '20 июня — 25 августа',
      englishExam: '1 июля — 25 августа',
      enrollment: '25 августа',
    },
    documents: [
      'Удостоверение личности',
      'Заявление о приёме',
      'Медицинская справка №075',
      'IELTS/TOEFL (при наличии)',
      'Фото 3×4 (6 штук)',
      'Аттестат / диплом с транскриптом',
      'Сертификат ЕНТ',
      'Сертификат о гранте (при наличии)',
      'Приписное свидетельство (юноши)',
      'Форма 063/У',
    ],
    documentsNote: 'PDF. Подача через platonus.iitu.edu.kz.',
    language: ['ru', 'kk', 'en'],
    dorm: true,
    dormDetails: {
      exists: true,
      guaranteed: false,
      cost: null,
      note: 'Уточнить в приёмной комиссии.',
    },
    sources: ['iitu', 'iituSubjects', 'iituEntry', 'iituDorm'],
  },

  // ── 6B06301 — Компьютерная безопасность (B058) ──
  {
    id: 'iitu-security',
    name: '6B06301 — Компьютерная безопасность',
    group: 'B058',
    university: 'МУИТ / IITU',
    city: 'Алматы',
    subjects: ['math', 'informatics'],
    tuition: 1479000,
    tuitionYear: 2026,
    tuitionBreakdown: { y1: 1479000, y2: 1530000, y3: 1590000, y4: 1680000, total: 6279000 },
    tuitionNote: '4-летняя форма, 240 кредитов.',
    minimumEnt: 50,
    grantMinEnt: 75,        // B058 same as B057 in MUIIT table
    grantMinEntTip: 25,
    paidMinEntTip: null,
    requirementsYear: 2026,
    entSectionsNote: 'Минимумы по разделам ЕНТ не опубликованы.',
    conflict: false,
    extraExam: 'language',
    extraExamDetails: {
      name: 'Экзамен по английскому',
      period: '1 июля — 25 августа',
      mandatory: false,
      note: 'При наличии IELTS/TOEFL — освобождение.',
    },
    deadline: '2026-08-25',
    timeline: {
      entRegistration: '10 мая — 10 июля',
      documentSubmission: '20 июня — 25 августа',
      englishExam: '1 июля — 25 августа',
      enrollment: '25 августа',
    },
    documents: [
      'Удостоверение личности',
      'Заявление о приёме',
      'Медицинская справка №075',
      'IELTS/TOEFL (при наличии)',
      'Фото 3×4 (6 штук)',
      'Аттестат / диплом с транскриптом',
      'Сертификат ЕНТ',
      'Сертификат о гранте (при наличии)',
      'Приписное свидетельство (юноши)',
      'Форма 063/У',
    ],
    documentsNote: 'PDF. Подача через platonus.iitu.edu.kz.',
    language: ['ru', 'kk', 'en'],
    dorm: true,
    dormDetails: {
      exists: true,
      guaranteed: false,
      cost: null,
      note: 'Уточнить в приёмной комиссии.',
    },
    sources: ['iitu', 'iituSubjects', 'iituEntry', 'iituDorm'],
  },
];

module.exports = { sources, programmes, reviewedAt };
