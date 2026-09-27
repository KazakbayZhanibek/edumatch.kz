/**
 * Profession database — детальная информация о профессиях
 * Связывает профессии с специальностями, вузами, зарплатами, навыками
 */

const PROFESSIONS = [
  // ===== IT =====
  {
    id: 'programmer',
    title: { ru: 'Программист', kk: 'Бағдарламашы', en: 'Software Developer' },
    titleGen: { ru: 'Программиста', kk: 'Бағдарламашының', en: 'Software Developer' },
    description: {
      ru: 'Разрабатывает ПО: сайты, приложения, системы. Один из самых востребованных IT-специалистов в Казахстане.',
      kk: 'Бағдарламалық жасақтаманы әзірлейді: сайттар, қосымшалар, жүйелер. Қазақстандағы ең сұранысқа ие IT-мамандардың бірі.',
      en: 'Develops software: websites, apps, systems. One of the most in-demand IT specialists in Kazakhstan.',
    },
    specialties: [1, 2], // Компьютерные науки, Разработка ПО
    salary: { min: 350000, max: 1500000, avg: 700000 },
    demandLevel: { ru: 'Очень высокий', kk: 'Өте жоғары', en: 'Very High' },
    skills: {
      ru: ['Программирование (Python, JavaScript, Java)', 'Алгоритмы и структуры данных', 'Работа с базами данных', 'Git и командная работа'],
      kk: ['Бағдарламалау (Python, JavaScript, Java)', 'Алгоритмдер мен деректер құрылымдары', 'Деректер базаларымен жұмыс', 'Git пен топтық жұмыс'],
      en: ['Programming (Python, JavaScript, Java)', 'Algorithms and data structures', 'Database management', 'Git and teamwork'],
    },
    careerPath: {
      ru: 'Стажёр → Junior → Middle → Senior → Lead → Architect → CTO',
      kk: 'Стажер → Junior → Middle → Senior → Lead → Architect → CTO',
      en: 'Intern → Junior → Middle → Senior → Lead → Architect → CTO',
    },
    universities: [1, 2, 3, 25, 32], // НУ, КазНУ, ЕНУ, МУИТ, КБТУ
    relatedProfessions: ['data_analyst', 'cybersecurity', 'devops'],
  },
  {
    id: 'data_analyst',
    title: { ru: 'Аналитик данных', kk: 'Деректер талдаушысы', en: 'Data Analyst' },
    titleGen: { ru: 'Аналитика данных', kk: 'Деректер талдаушысының', en: 'Data Analyst' },
    description: {
      ru: 'Анализирует большие объёмы данных для принятия бизнес-решений. Работает с SQL, Python, визуализацией.',
      kk: 'Үлкен көлемдегі деректерді бизнес шешімдерін қабылдау үшін талдайды. SQL, Python, визуализациямен жұмыс істейді.',
      en: 'Analyzes large volumes of data for business decisions. Works with SQL, Python, visualization.',
    },
    specialties: [1, 10], // Компьютерные науки, Финансы
    salary: { min: 300000, max: 1200000, avg: 600000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['SQL и работа с базами данных', 'Python (pandas, numpy)', 'Визуализация данных (Tableau, Power BI)', 'Статистика и математика'],
      kk: ['SQL және деректер базалары', 'Python (pandas, numpy)', 'Деректер визуализациясы (Tableau, Power BI)', 'Статистика мен математика'],
      en: ['SQL and databases', 'Python (pandas, numpy)', 'Data visualization (Tableau, Power BI)', 'Statistics and math'],
    },
    careerPath: {
      ru: 'Стажёр → Аналитик → Senior Analyst → Data Lead → Head of Analytics',
      kk: 'Стажер → Талдаушы → Senior Analyst → Data Lead → Head of Analytics',
      en: 'Intern → Analyst → Senior Analyst → Data Lead → Head of Analytics',
    },
    universities: [1, 2, 3, 32],
    relatedProfessions: ['programmer', 'product_manager'],
  },
  {
    id: 'cybersecurity',
    title: { ru: 'Специалист по кибербезопасности', kk: 'Киберқауіпсіздік маманы', en: 'Cybersecurity Specialist' },
    titleGen: { ru: 'Специалиста по кибербезопасности', kk: 'Киберқауіпсіздік маманының', en: 'Cybersecurity Specialist' },
    description: {
      ru: 'Защищает информационные системы от взлома и утечек. Один из самых высокооплачиваемых IT-специалистов.',
      kk: 'Ақпараттық жүйелерді бұзу мен ағып кетуден қорғайды. Ең жоғары жалақылы IT-мамандардың бірі.',
      en: 'Protects information systems from hacking and leaks. One of the highest-paid IT specialists.',
    },
    specialties: [4], // Кибербезопасность
    salary: { min: 400000, max: 2000000, avg: 900000 },
    demandLevel: { ru: 'Очень высокий', kk: 'Өте жоғары', en: 'Very High' },
    skills: {
      ru: ['Сетевая безопасность', 'Пентестинг', 'Криптография', 'Анализ уязвимостей'],
      kk: ['Желілік қауіпсіздік', 'Пентестинг', 'Криптография', 'Әлсіздіктерді талдау'],
      en: ['Network security', 'Penetration testing', 'Cryptography', 'Vulnerability analysis'],
    },
    careerPath: {
      ru: 'Junior → Специалист → Senior → Архитектор безопасности → CISO',
      kk: 'Junior → Маман → Senior → Қауіпсіздік архитекторы → CISO',
      en: 'Junior → Specialist → Senior → Security Architect → CISO',
    },
    universities: [1, 2, 25, 32],
    relatedProfessions: ['programmer', 'network_engineer'],
  },

  // ===== МЕДИЦИНА =====
  {
    id: 'doctor',
    title: { ru: 'Врач', kk: 'Дәрігер', en: 'Doctor' },
    titleGen: { ru: 'Врача', kk: 'Дәрігердің', en: 'Doctor' },
    description: {
      ru: 'Лечит людей, ставит диагнозы, назначает лечение. В Казахстане дефицит врачей — высокий спрос.',
      kk: 'Адамдарды емдейді, диагноз қояды, емдеуді тағайындайды. Қазақстанда дәрігерлер тапшылығы бар — жоғары сұраныс.',
      en: 'Treats people, diagnoses, prescribes treatment. Kazakhstan has a doctor shortage — high demand.',
    },
    specialties: [13], // Медицина
    salary: { min: 300000, max: 1500000, avg: 600000 },
    demandLevel: { ru: 'Очень высокий', kk: 'Өте жоғары', en: 'Very High' },
    skills: {
      ru: ['Анатомия и физиология', 'Диагностика', 'Хирургия (для хирургов)', 'Коммуникация с пациентами'],
      kk: ['Анатомия мен физиология', 'Диагностика', 'Хирургия (хирургтар үшін)', 'Науқастармен байланыс'],
      en: ['Anatomy and physiology', 'Diagnostics', 'Surgery (for surgeons)', 'Patient communication'],
    },
    careerPath: {
      ru: 'Интерн → Врач → Специалист → Зав.отделением → Главврач',
      kk: 'Интерн → Дәрігер → Маман → Бөлім меңгерушісі → Бас дәрігер',
      en: 'Intern → Doctor → Specialist → Department Head → Chief Physician',
    },
    universities: [35, 36, 12], // КГМУ, КазНМУ, СГМУ
    relatedProfessions: ['pharmacist', 'nurse'],
  },
  {
    id: 'psychologist',
    title: { ru: 'Психолог', kk: 'Психолог', en: 'Psychologist' },
    titleGen: { ru: 'Психолога', kk: 'Психологтың', en: 'Psychologist' },
    description: {
      ru: 'Помогает людям с психическими проблемами, проводит терапию, консультации. Растущая профессия в Казахстане.',
      kk: 'Адамдарға психологиялық мәселелерде көмектеседі, терапия, кеңес береді. Қазақстанда дамып келе жатқан мамандық.',
      en: 'Helps people with mental health issues, conducts therapy and consultations. Growing profession in Kazakhstan.',
    },
    specialties: [16], // Психология
    salary: { min: 200000, max: 800000, avg: 400000 },
    demandLevel: { ru: 'Средний', kk: 'Орташа', en: 'Medium' },
    skills: {
      ru: ['Психологическая диагностика', 'Клиническая психология', 'Консультирование', 'Эмпатия и активное слушание'],
      kk: ['Психологиялық диагностика', 'Клиникалық психология', 'Кеңес беру', 'Эмпатия белсенді тыңдау'],
      en: ['Psychological diagnostics', 'Clinical psychology', 'Counseling', 'Empathy and active listening'],
    },
    careerPath: {
      ru: 'Стажёр → Психолог → Клинический психолог → Психотерапевт → Зав.отделением',
      kk: 'Стажер → Психолог → Клиникалық психолог → Психотерапевт → Бөлім меңгерушісі',
      en: 'Intern → Psychologist → Clinical Psychologist → Psychotherapist → Department Head',
    },
    universities: [2, 3, 22], // КазНУ, ЕНУ, Туран
    relatedProfessions: ['doctor', 'teacher', 'social_worker'],
  },

  // ===== БИЗНЕС =====
  {
    id: 'economist',
    title: { ru: 'Экономист', kk: 'Экономист', en: 'Economist' },
    titleGen: { ru: 'Экономиста', kk: 'Экономистің', en: 'Economist' },
    description: {
      ru: 'Анализирует экономические процессы, планирует бюджеты, прогнозирует. Работает в банках, компаниях, госорганах.',
      kk: 'Экономикалық процестерді талдайды, бюджетті жоспарлайды, болжам жасайды. Банктерде, компанияларда, мемлекеттік органдарда жұмыс істейді.',
      en: 'Analyzes economic processes, plans budgets, forecasts. Works in banks, companies, government.',
    },
    specialties: [9, 10], // Экономика, Финансы
    salary: { min: 250000, max: 1000000, avg: 500000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['Микро- и макроэкономика', 'Финансовый анализ', 'Excel и 1С', 'Статистика'],
      kk: ['Микро- және макроэкономика', 'Қаржылық талдау', 'Excel және 1С', 'Статистика'],
      en: ['Micro- and macroeconomics', 'Financial analysis', 'Excel and 1C', 'Statistics'],
    },
    careerPath: {
      ru: 'Стажёр → Экономист → Главный экономист → Финансовый директор',
      kk: 'Стажер → Экономист → Бас экономист → Қаржы директоры',
      en: 'Intern → Economist → Chief Economist → Financial Director',
    },
    universities: [2, 3, 44], // КазНУ, ЕНУ, KIMEP
    relatedProfessions: ['manager', 'accountant'],
  },
  {
    id: 'manager',
    title: { ru: 'Менеджер', kk: 'Менеджер', en: 'Manager' },
    titleGen: { ru: 'Менеджера', kk: 'Менеджердің', en: 'Manager' },
    description: {
      ru: 'Управляет проектами, командами, процессами. Работает в любой сфере — от IT до строительства.',
      kk: 'Жобаларды, топтарды, процестерді басқарады. Кез келген салада жұмыс істейді — IT-ден құрылысқа дейін.',
      en: 'Manages projects, teams, processes. Works in any field — from IT to construction.',
    },
    specialties: [8], // Бизнес и менеджмент
    salary: { min: 250000, max: 1200000, avg: 550000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['Управление проектами', 'Лидерство', 'Коммуникация', 'Планирование и аналитика'],
      kk: ['Жоба басқару', 'Көшбасшылық', 'Байланыс', 'Жоспарлау мен талдау'],
      en: ['Project management', 'Leadership', 'Communication', 'Planning and analytics'],
    },
    careerPath: {
      ru: 'Стажёр → Менеджер → Руководитель → Директор → CEO',
      kk: 'Стажер → Менеджер → Жетекші → Директор → CEO',
      en: 'Intern → Manager → Director → VP → CEO',
    },
    universities: [2, 3, 44, 22], // КазНУ, ЕНУ, KIMEP, Туран
    relatedProfessions: ['economist', 'marketer'],
  },
  {
    id: 'marketer',
    title: { ru: 'Маркетолог', kk: 'Маркетолог', en: 'Marketer' },
    titleGen: { ru: 'Маркетолога', kk: 'Маркетологтың', en: 'Marketer' },
    description: {
      ru: 'Продвигает продукты и бренды. Работает с рекламой, аналитикой, соцсетями. Креативная и аналитическая профессия.',
      kk: 'Өнімдер мен брендтерді насихаттайды. Жарнама, аналитика, әлеуметтік желілермен жұмыс істейді.',
      en: 'Promotes products and brands. Works with advertising, analytics, social media.',
    },
    specialties: [12], // Маркетинг
    salary: { min: 250000, max: 900000, avg: 450000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['Digital-маркетинг', 'Аналитика (Google Analytics)', 'SMM и контент', 'Копирайтинг'],
      kk: ['Digital-маркетинг', 'Аналитика (Google Analytics)', 'SMM және контент', 'Копирайтинг'],
      en: ['Digital marketing', 'Analytics (Google Analytics)', 'SMM and content', 'Copywriting'],
    },
    careerPath: {
      ru: 'Стажёр → Маркетолог → Руководитель маркетинга → CMO',
      kk: 'Стажер → Маркетолог → Маркетинг жетекшісі → CMO',
      en: 'Intern → Marketer → Marketing Director → CMO',
    },
    universities: [2, 44, 22, 3],
    relatedProfessions: ['manager', 'designer'],
  },

  // ===== ИНЖЕНЕРИЯ =====
  {
    id: 'engineer',
    title: { ru: 'Инженер', kk: 'Инженер', en: 'Engineer' },
    titleGen: { ru: 'Инженера', kk: 'Инженердің', en: 'Engineer' },
    description: {
      ru: 'Проектирует и строит сооружения, машины, системы. Без инженеров невозможно развитие инфраструктуры.',
      kk: 'Ғимараттарды, машиналарды, жүйелерді жобалайды және салады. Инженерсіз инфрақұрылымды дамыту мүмкін емес.',
      en: 'Designs and builds structures, machines, systems. Infrastructure development is impossible without engineers.',
    },
    specialties: [5, 6, 7], // Инженерия, Гражданское строительство, Механическая инженерия
    salary: { min: 300000, max: 1200000, avg: 600000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['CAD/CAE системы', 'Математическое моделирование', 'Техническое черчение', 'Знание нормативов'],
      kk: ['CAD/CAE жүйелері', 'Математикалық модельдеу', 'Техникалық сызу', 'Нормативтерді білу'],
      en: ['CAD/CAE systems', 'Mathematical modeling', 'Technical drawing', 'Knowledge of standards'],
    },
    careerPath: {
      ru: 'Стажёр → Инженер → Ведущий инженер → Главный инженер → Директор',
      kk: 'Стажер → Инженер → Жетекші инженер → Бас инженер → Директор',
      en: 'Intern → Engineer → Lead Engineer → Chief Engineer → Director',
    },
    universities: [5, 28, 29, 30], // КарГТУ, КГАСУ, КГИСУ, КГТУ
    relatedProfessions: ['architect', 'programmer'],
  },

  // ===== ПРАВО =====
  {
    id: 'lawyer',
    title: { ru: 'Юрист', kk: 'Заңгер', en: 'Lawyer' },
    titleGen: { ru: 'Юриста', kk: 'Заңгердің', en: 'Lawyer' },
    description: {
      ru: 'Защищает права и интересы клиентов в суде и за его пределами. Работает в адвокатурах, компаниях, госорганах.',
      kk: 'Тұтынушылардың құқықтары мен мүдделерін сотта және одан тыс қорғайды.',
      en: 'Protects clients\' rights and interests in and out of court.',
    },
    specialties: [17], // Право
    salary: { min: 250000, max: 1500000, avg: 550000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['Законодательство РК', 'Судебная практика', 'Документооборот', 'Ораторское искусство'],
      kk: ['ҚР Заңнамасы', 'Сот тәжірибесі', 'Құжат айналымы', 'Ораторлық өнер'],
      en: ['RK Legislation', 'Court practice', 'Document management', 'Public speaking'],
    },
    careerPath: {
      ru: 'Стажёр → Юрист → Старший юрист → Партнёр → Глава фирмы',
      kk: 'Стажер → Заңгер → Үлкен заңгер → Серіктес → Фирма басшысы',
      en: 'Intern → Lawyer → Senior Lawyer → Partner → Firm Head',
    },
    universities: [2, 3, 43], // КазНУ, ЕНУ, АГУ при Президенте
    relatedProfessions: ['economist'],
  },

  // ===== ОБРАЗОВАНИЕ =====
  {
    id: 'teacher',
    title: { ru: 'Учитель / Преподаватель', kk: 'Мұғалім / Оқытушы', en: 'Teacher / Lecturer' },
    titleGen: { ru: 'Учителя', kk: 'Мұғалімнің', en: 'Teacher' },
    description: {
      ru: 'Обучает детей и взрослых. Одна из самых стабильных профессий с государственными гарантиями.',
      kk: 'Балалар мен ересектерді оқытады. Мемлекеттік кепілдіктері бар ең тұрақты мамандықтардың бірі.',
      en: 'Teaches children and adults. One of the most stable professions with government guarantees.',
    },
    specialties: [31, 32], // Педагогика, Физическое воспитание
    salary: { min: 180000, max: 500000, avg: 300000 },
    demandLevel: { ru: 'Средний', kk: 'Орташа', en: 'Medium' },
    skills: {
      ru: ['Педагогика', 'Психология обучения', 'Методики преподавания', 'Коммуникация'],
      kk: ['Педагогика', 'Оқу психологиясы', 'Оқыту әдістемесі', 'Байланыс'],
      en: ['Pedagogy', 'Learning psychology', 'Teaching methods', 'Communication'],
    },
    careerPath: {
      ru: 'Стажёр → Учитель → Старший учитель → Завуч → Директор школы',
      kk: 'Стажер → Мұғалім → Үлкен мұғалім → Оқу ісі жөнінде → Мектеп директоры',
      en: 'Intern → Teacher → Senior Teacher → VP → School Principal',
    },
    universities: [9, 19, 40], // ПГПУ, КНПУим.Абая, КГПИ
    relatedProfessions: ['psychologist'],
  },

  // ===== ДИЗАЙН =====
  {
    id: 'designer',
    title: { ru: 'Дизайнер', kk: 'Дизайнер', en: 'Designer' },
    titleGen: { ru: 'Дизайнера', kk: 'Дизайнердің', en: 'Designer' },
    description: {
      ru: 'Создаёт визуальный контент: сайты, приложения, полиграфия, интерьеры. Креативная профессия с растущим спросом.',
      kk: 'Визуалдық контент жасайды: сайттар, қосымшалар, полиграфия, интерьерлер. Өсіп келе жатқан сұранысқа ие шығармашылық мамандық.',
      en: 'Creates visual content: websites, apps, print, interiors. Creative profession with growing demand.',
    },
    specialties: [29], // Дизайн
    salary: { min: 250000, max: 1000000, avg: 500000 },
    demandLevel: { ru: 'Высокий', kk: 'Жоғары', en: 'High' },
    skills: {
      ru: ['Figma, Photoshop, Illustrator', 'UI/UX дизайн', 'Типографика', 'Цветовая теория'],
      kk: ['Figma, Photoshop, Illustrator', 'UI/UX дизайн', 'Типографика', 'Түс теориясы'],
      en: ['Figma, Photoshop, Illustrator', 'UI/UX design', 'Typography', 'Color theory'],
    },
    careerPath: {
      ru: 'Стажёр → Дизайнер → Senior designer → Арт-директор → Креативный директор',
      kk: 'Стажер → Дизайнер → Senior designer → Арт-директор → Шығармашылық директор',
      en: 'Intern → Designer → Senior Designer → Art Director → Creative Director',
    },
    universities: [2, 22, 23], // КазНУ, Туран, АТУ
    relatedProfessions: ['marketer', 'programmer'],
  },

  // ===== ФАРМАЦЕВТИКА =====
  {
    id: 'pharmacist',
    title: { ru: 'Фармацевт', kk: 'Фармацевт', en: 'Pharmacist' },
    titleGen: { ru: 'Фармацевта', kk: 'Фармацевттің', en: 'Pharmacist' },
    description: {
      ru: 'Готовит и отпускает лекарства, консультирует пациентов. Работает в аптеках, фармкомпаниях, научных лабораториях.',
      kk: 'Дәрі-дәрмектерді дайында және таратады, науқастарға кеңес береді.',
      en: 'Prepares and dispenses medications, advises patients.',
    },
    specialties: [14], // Фармацевтика
    salary: { min: 200000, max: 700000, avg: 380000 },
    demandLevel: { ru: 'Средний', kk: 'Орташа', en: 'Medium' },
    skills: {
      ru: ['Фармакология', 'Химия', 'Работа с рецептурами', 'Контроль качества'],
      kk: ['Фармакология', 'Химия', 'Рецептуралармен жұмыс', 'Сапаны бақылау'],
      en: ['Pharmacology', 'Chemistry', 'Prescription management', 'Quality control'],
    },
    careerPath: {
      ru: 'Фармацевт → Старший фармацевт → Зав аптекой → Фармконсультант',
      kk: 'Фармацевт → Үлкен фармацевт → Аптека меңгерушісі → Фармконсультант',
      en: 'Pharmacist → Senior Pharmacist → Pharmacy Manager → Pharma Consultant',
    },
    universities: [35, 36], // КГМУ, КазНМУ
    relatedProfessions: ['doctor'],
  },
];

/**
 * Поиск профессии по ключевым словам
 */
function findProfession(query) {
  const q = (query || '').toLowerCase().trim();

  // Exact match by id
  const byId = PROFESSIONS.find(p => p.id === q);
  if (byId) return byId;

  // Match by title (any language)
  const byTitle = PROFESSIONS.find(p => {
    const titles = [p.title.ru, p.title.kk, p.title.en, p.titleGen.ru, p.titleGen.kk, p.titleGen.en].map(t => t.toLowerCase());
    return titles.some(t => q.includes(t) || t.includes(q));
  });
  if (byTitle) return byTitle;

  // Match by keywords in query
  const keywordMap = {
    'программист': 'programmer',
    'разработчик': 'programmer',
    'код': 'programmer',
    'coding': 'programmer',
    'developer': 'programmer',
    'бағдарламашы': 'programmer',
    'дәрігер': 'doctor',
    'врач': 'doctor',
    'доктор': 'doctor',
    'doctor': 'doctor',
    'медицин': 'doctor',
    'психолог': 'psychologist',
    'психологи': 'psychologist',
    'психология': 'psychologist',
    'psycholog': 'psychologist',
    'экономист': 'economist',
    'экономик': 'economist',
    'economist': 'economist',
    'менеджер': 'manager',
    'менеджмент': 'manager',
    'manager': 'manager',
    'маркетолог': 'marketer',
    'маркетинг': 'marketer',
    'marketing': 'marketer',
    'инженер': 'engineer',
    'инженерия': 'engineer',
    'строитель': 'engineer',
    'engineer': 'engineer',
    'юрист': 'lawyer',
    'право': 'lawyer',
    'юриспруденция': 'lawyer',
    'lawyer': 'lawyer',
    'law': 'lawyer',
    'учитель': 'teacher',
    'преподаватель': 'teacher',
    'педагог': 'teacher',
    'teacher': 'teacher',
    'дизайнер': 'designer',
    'дизайн': 'designer',
    'designer': 'designer',
    'design': 'designer',
    'фармацевт': 'pharmacist',
    'фармацевтик': 'pharmacist',
    'pharmacist': 'pharmacist',
    // IT/Programming additional keywords
    'it': 'programmer',
    'айти': 'programmer',
    'программ': 'programmer',
    'компьютер': 'programmer',
    'computer': 'programmer',
    'coding': 'programmer',
    'code': 'programmer',
    'software': 'programmer',
    'разработк': 'programmer',
    'кибер': 'programmer',
    'цифров': 'programmer',
    'digital': 'programmer',
    'technology': 'programmer',
    'технолог': 'programmer',
    'сетев': 'programmer',
    'сети': 'programmer',
  };

  for (const [keyword, profId] of Object.entries(keywordMap)) {
    if (q.includes(keyword)) {
      return PROFESSIONS.find(p => p.id === profId);
    }
  }

  return null;
}

/**
 * Получить все профессии для специальности
 */
function getProfessionsBySpecialty(specialtyId) {
  return PROFESSIONS.filter(p => p.specialties.includes(specialtyId));
}

const CATEGORY_TO_PROFESSIONS = {
  'Информационные технологии': ['programmer', 'data_analyst', 'cybersecurity', 'devops', 'ai_engineer'],
  'Медицина': ['doctor', 'pharmacist'],
  'Бизнес': ['data_analyst', 'manager'],
  'Инженерия': ['engineer', 'architect'],
  'Гуманитарные науки': ['teacher', 'psychologist'],
  'Естественные науки': ['teacher', 'data_analyst'],
  'Здоровье': ['doctor', 'psychologist', 'pharmacist'],
  'Образование': ['teacher'],
  'Общественные науки': ['lawyer', 'manager'],
  'Искусство': ['designer'],
  'Сельское хозяйство': ['engineer'],
  'Туризм': ['manager'],
};

function getProfessionsByCategory(category) {
  const profIds = CATEGORY_TO_PROFESSIONS[category] || [];
  return PROFESSIONS.filter(p => profIds.includes(p.id));
}

/**
 * Форматирует информацию о профессии для контекста LLM
 */
function formatProfessionForContext(profession, lang = 'ru') {
  if (!profession) return '';
  const title = profession.title[lang] || profession.title.ru;
  const desc = profession.description[lang] || profession.description.ru;
  const salary = profession.salary;
  const demand = profession.demandLevel[lang] || profession.demandLevel.ru;
  const skills = (profession.skills[lang] || profession.skills.ru).join(', ');
  const careerPath = profession.careerPath[lang] || profession.careerPath.ru;

  return `## ${title}
${desc}
💰 Зарплата: ${salary.min.toLocaleString()} — ${salary.max.toLocaleString()}₸ (средняя: ${salary.avg.toLocaleString()}₸)
📊 Спрос: ${demand}
🛠 Навыки: ${skills}
📈 Карьерный путь: ${careerPath}`;
}

module.exports = {
  PROFESSIONS,
  findProfession,
  getProfessionsBySpecialty,
  getProfessionsByCategory,
  formatProfessionForContext,
};
