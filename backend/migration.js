/**
 * migration.js
 * Миграция seed-данных из текущего data.json / SEED в SQLite
 * Идемпотентна - безопасна для повторных запусков
 */

const { getDb } = require('./database');

// SEED - текущие данные (скопированы из db.js)
const SEED = {
  cities: [{ id: 1, name: 'Алматы' }],
  specialties: [
    { id: 1,  name: 'Информационные технологии',  category: 'IT' },
    { id: 2,  name: 'Программная инженерия',       category: 'IT' },
    { id: 3,  name: 'Кибербезопасность',           category: 'IT' },
    { id: 4,  name: 'Искусственный интеллект',     category: 'IT' },
    { id: 5,  name: 'Экономика',                   category: 'Экономика' },
    { id: 6,  name: 'Финансы',                     category: 'Экономика' },
    { id: 7,  name: 'Менеджмент',                  category: 'Экономика' },
    { id: 8,  name: 'Бухгалтерский учет',          category: 'Экономика' },
    { id: 9,  name: 'Юриспруденция',               category: 'Право' },
    { id: 10, name: 'Международное право',          category: 'Право' },
    { id: 11, name: 'Медицина',                    category: 'Медицина' },
    { id: 12, name: 'Фармация',                    category: 'Медицина' },
    { id: 13, name: 'Стоматология',                category: 'Медицина' },
    { id: 14, name: 'Педагогика',                  category: 'Образование' },
    { id: 15, name: 'Психология',                  category: 'Гуманитарные' },
    { id: 16, name: 'Журналистика',                category: 'Гуманитарные' },
    { id: 17, name: 'Международные отношения',     category: 'Гуманитарные' },
    { id: 18, name: 'Переводческое дело',           category: 'Гуманитарные' },
    { id: 19, name: 'Химическая инженерия',        category: 'Инженерия' },
    { id: 20, name: 'Нефтегазовое дело',           category: 'Инженерия' },
    { id: 21, name: 'Горное дело',                 category: 'Инженерия' },
    { id: 22, name: 'Строительство',               category: 'Инженерия' },
    { id: 23, name: 'Архитектура',                 category: 'Инженерия' },
    { id: 24, name: 'Биология',                    category: 'Естественные науки' },
    { id: 25, name: 'Физика',                      category: 'Естественные науки' },
    { id: 26, name: 'Математика',                  category: 'Естественные науки' },
    { id: 27, name: 'Маркетинг',                   category: 'Экономика' },
    { id: 28, name: 'Туризм',                      category: 'Сервис' },
    { id: 29, name: 'Дизайн',                      category: 'Искусство' },
    { id: 30, name: 'Музыка',                      category: 'Искусство' },
    { id: 31, name: 'Логистика',                   category: 'Экономика' },
    { id: 32, name: 'Банковское дело',             category: 'Экономика' },
    { id: 33, name: 'Геология',                    category: 'Естественные науки' },
    { id: 34, name: 'Экология',                    category: 'Естественные науки' },
    { id: 35, name: 'Социология',                  category: 'Гуманитарные' },
  ],
  universities: [
    { id:1,  name:'Казахский национальный университет имени аль-Фараби', short_name:'КазНУ',     city_id:1, qs_world:163,  qs_asia:39,  price_from:580000,  price_to:1500000, website:'https://www.kaznu.kz',    description:'Флагманский университет Казахстана, крупнейший в стране. Более 100 специальностей на 16 факультетах. Обучение на казахском, русском и английском языках.', founded:1934, students_count:25000, languages:['Казахский','Русский','Английский'], accreditations:['Национальная','QS Stars'], has_dorm:true,  dorm_price:80000,  avg_salary:450000, lat:43.2364, lng:76.9457, specialty_ids:[1,2,3,4,5,6,7,8,9,10,15,16,17,18,19,20,24,25,26,33,34,35] },
    { id:2,  name:'Казахстанско-Британский технический университет',      short_name:'КБТУ',      city_id:1, qs_world:601,  qs_asia:151, price_from:2100000, price_to:3500000, website:'https://www.kbtu.kz',     description:'Единственный вуз Центральной Азии, аккредитованный ABET (США). Сильные программы в нефтегазовой, IT и инженерной сферах.', founded:1999, students_count:4500,  languages:['Английский','Русский'],            accreditations:['ABET (США)','Национальная'],  has_dorm:true,  dorm_price:120000, avg_salary:650000, lat:43.2389, lng:76.9219, specialty_ids:[1,2,3,4,5,6,19,20,21,25,26] },
    { id:3,  name:'Казахский национальный медицинский университет имени С.Д. Асфендиярова', short_name:'КазНМУ', city_id:1, qs_world:null, qs_asia:251, price_from:1200000, price_to:2500000, website:'https://kaznmu.kz', description:'Ведущий медицинский университет Казахстана. Победитель независимого рейтинга востребованности вузов РК. Готовит врачей по 20+ специальностям.', founded:1930, students_count:9000, languages:['Казахский','Русский','Английский'], accreditations:['Национальная','WFME'], has_dorm:true, dorm_price:70000, avg_salary:550000, lat:43.2551, lng:76.9286, specialty_ids:[11,12,13,24] },
    { id:4,  name:'КИМЭП Университет',                                    short_name:'КИМЭП',     city_id:1, qs_world:null, qs_asia:null, price_from:2600000, price_to:3800000, website:'https://www.kimep.kz',    description:'Международный университет с программами на английском языке. Аккредитован AACSB и FIBAA. Сильная бизнес-школа, право и международные отношения.', founded:1992, students_count:2800, languages:['Английский'], accreditations:['AACSB','FIBAA'], has_dorm:true, dorm_price:150000, avg_salary:700000, lat:43.2198, lng:76.8945, specialty_ids:[5,6,7,8,9,10,15,16,17,18,27,31] },
    { id:5,  name:'Университет Нархоз',                                   short_name:'Нархоз',    city_id:1, qs_world:null, qs_asia:null, price_from:1300000, price_to:1860000, website:'https://narxoz.kz',        description:'Ведущий экономический университет Казахстана. Специализируется на бизнесе, экономике, финансах и праве. Тесные связи с бизнес-сообществом.', founded:1963, students_count:7000, languages:['Казахский','Русский','Английский'], accreditations:['AMBA','Национальная'], has_dorm:true, dorm_price:90000, avg_salary:480000, lat:43.2421, lng:76.9087, specialty_ids:[5,6,7,8,9,17,27,31,32] },
    { id:6,  name:'Алматы Менеджмент Университет',                        short_name:'AlmaU',     city_id:1, qs_world:null, qs_asia:null, price_from:1400000, price_to:2900000, website:'https://almau.edu.kz',    description:'Бизнес-ориентированный университет, лидер образовательных инноваций Центральной Азии. Программы MBA международного уровня, акцент на предпринимательство.', founded:1988, students_count:5000, languages:['Казахский','Русский','Английский'], accreditations:['AACSB (кандидат)','Национальная'], has_dorm:false, dorm_price:null, avg_salary:520000, lat:43.2312, lng:76.9156, specialty_ids:[1,5,6,7,8,15,27,29,31] },
    { id:7,  name:'Казахский агротехнический исследовательский университет имени С. Сейфуллина', short_name:'КазАТИУ', city_id:1, qs_world:1201, qs_asia:351, price_from:770000, price_to:1900000, website:'https://kazatu.kz', description:'Технический университет с широким спектром инженерных и IT-специальностей. 25 образовательных программ. Высокие позиции в QS Asia.', founded:1957, students_count:12000, languages:['Казахский','Русский'], accreditations:['Национальная'], has_dorm:true, dorm_price:60000, avg_salary:400000, lat:43.2489, lng:76.9312, specialty_ids:[1,2,19,21,22,23,24,26,33,34] },
    { id:8,  name:'Казахский университет международных отношений и мировых языков имени Абылай хана', short_name:'КазУМОиМЯ', city_id:1, qs_world:null, qs_asia:null, price_from:850000, price_to:1200000, website:'https://ablaikhan.kz', description:'Ведущий лингвистический и международный университет Казахстана. Подготовка переводчиков, дипломатов и специалистов по международным отношениям.', founded:1941, students_count:8500, languages:['Казахский','Русский','Английский','Другие'], accreditations:['Национальная'], has_dorm:true, dorm_price:65000, avg_salary:380000, lat:43.2534, lng:76.9423, specialty_ids:[16,17,18,9,15,35] },
    { id:9,  name:'Казахский национальный педагогический университет имени Абая', short_name:'КазНПУ', city_id:1, qs_world:1001, qs_asia:301, price_from:700000, price_to:1100000, website:'https://kaznpu.kz', description:'Главный педагогический университет страны. Готовит учителей и педагогов по всем школьным дисциплинам. Широкая сеть партнерств с зарубежными вузами.', founded:1928, students_count:15000, languages:['Казахский','Русский'], accreditations:['Национальная'], has_dorm:true, dorm_price:55000, avg_salary:320000, lat:43.2601, lng:76.9178, specialty_ids:[14,15,16,24,25,26,29,30,35] },
    { id:10, name:'Алматинский технологический университет',               short_name:'АТУ',       city_id:1, qs_world:1201, qs_asia:401, price_from:800000,  price_to:1300000, website:'https://atu.edu.kz',      description:'Технологический университет с фокусом на пищевую, текстильную промышленность, IT и сервис. Программы двойного диплома с зарубежными вузами.', founded:1957, students_count:6000, languages:['Казахский','Русский'], accreditations:['Национальная'], has_dorm:true, dorm_price:58000, avg_salary:360000, lat:43.2445, lng:76.9534, specialty_ids:[1,2,7,19,22,27,28,29] },
    { id:11, name:'Каспийский университет',                                short_name:'Caspian',   city_id:1, qs_world:null, qs_asia:null, price_from:1200000, price_to:2400000, website:'https://cu.edu.kz',        description:'Частный университет с программами в области права, IT, бизнеса и медицины. Современный кампус в Алматы, активное международное сотрудничество, обучение на трёх языках.', founded:2001, students_count:6000, languages:['Казахский','Русский','Английский'], accreditations:['Национальная'], has_dorm:false, dorm_price:null, avg_salary:420000, lat:43.2278, lng:76.9067, specialty_ids:[1,2,5,6,7,8,9,10,11,15,17,27] },
    { id:12, name:'Международный университет информационных технологий',   short_name:'МУИТ',      city_id:1, qs_world:null, qs_asia:null, price_from:1100000, price_to:1800000, website:'https://iitu.edu.kz',      description:'Специализированный IT-университет Казахстана. Фокус на программировании, кибербезопасности, AI и цифровых технологиях. Партнёр ведущих tech-компаний.', founded:2009, students_count:5500, languages:['Казахский','Русский','Английский'], accreditations:['Национальная'], has_dorm:true, dorm_price:85000, avg_salary:580000, lat:43.2356, lng:76.9401, specialty_ids:[1,2,3,4,27,29] },
    { id:13, name:'SDU University',                                        short_name:'SDU',       city_id:1, qs_world:null, qs_asia:null, price_from:1500000, price_to:2800000, website:'https://sdu.edu.kz',       description:'Современный университет с кампусом в Алматы и Кентау. Обучение по международным стандартам, сильные IT и бизнес программы, активная студенческая жизнь.', founded:1996, students_count:8000, languages:['Казахский','Русский','Английский'], accreditations:['Национальная'], has_dorm:true, dorm_price:95000, avg_salary:430000, lat:43.2167, lng:76.8934, specialty_ids:[1,2,3,5,6,7,8,9,15,17,27,29] },
    { id:14, name:'Медицинский университет Алматы (МУА)',                  short_name:'МУА',       city_id:1, qs_world:null, qs_asia:null, price_from:1300000, price_to:2200000, website:'https://mua.edu.kz',       description:'Медицинский университет Алматы с современной клинической базой. Подготовка врачей общей практики, стоматологов и фармацевтов. Клинические базы в ведущих больницах города.', founded:1997, students_count:4000, languages:['Казахский','Русский','Английский'], accreditations:['Национальная'], has_dorm:true, dorm_price:75000, avg_salary:500000, lat:43.2623, lng:76.9089, specialty_ids:[11,12,13,15,24] },
    { id:15, name:'Казахский университет технологии и бизнеса',            short_name:'КУТБ',      city_id:1, qs_world:null, qs_asia:null, price_from:680000,  price_to:1200000, website:'https://kutb.edu.kz',      description:'Университет с доступной стоимостью обучения и широким спектром специальностей в сфере бизнеса, технологий и сервиса. Активное сотрудничество с работодателями.', founded:2001, students_count:7500, languages:['Казахский','Русский'], accreditations:['Национальная'], has_dorm:true, dorm_price:50000, avg_salary:340000, lat:43.2512, lng:76.9267, specialty_ids:[1,5,6,7,8,19,22,27,28,29,31] },
  ],
  grants: [
    { id:1, name:'Государственный образовательный грант МОН РК', type:'government', amount:'Полное покрытие', description:'Государственный грант на обучение в казахстанских вузах. Выдаётся по результатам ЕНТ. Покрывает полную стоимость обучения на весь срок.', requirements:['Высокий балл ЕНТ','Гражданство РК','Поступление на грантовую специальность'], deadline:'После ЕНТ (июль)', link:'https://www.edu.gov.kz' },
    { id:2, name:'Стипендия Болашак', type:'government', amount:'Полное покрытие + стипендия', description:'Президентская программа международной стипендии для обучения за рубежом. Покрывает обучение, проживание, перелёт и выплачивает стипендию.', requirements:['Гражданство РК','Опыт работы от 3 лет','Владение иностранным языком','Конкурсный отбор'], deadline:'Февраль–март', link:'https://bolashak.gov.kz' },
    { id:3, name:'Грант акимата г. Алматы', type:'regional', amount:'до 500 000 тг/год', description:'Грант для талантливых выпускников школ Алматы. Выдаётся студентам с высокими академическими показателями, поступающим в вузы города.', requirements:['Окончание школы в Алматы','ЕНТ от 110 баллов','Поступление в вуз Алматы'], deadline:'Август', link:'https://www.almaty.kz' },
    { id:4, name:'Корпоративная стипендия Казахтелеком', type:'corporate', amount:'200 000 тг/месяц', description:'Стипендия от АО "Казахтелеком" для студентов IT и телекоммуникационных специальностей. Обязательная отработка 3 года после окончания.', requirements:['IT или телеком специальность','GPA от 3.5','Конкурсный отбор','Договор об отработке'], deadline:'Октябрь–ноябрь', link:'https://telecom.kz', specialty_ids:[1,2,3,4] },
    { id:5, name:'Стипендия Самрук-Казына', type:'corporate', amount:'250 000 тг/месяц', description:'Стипендиальная программа Фонда национального благосостояния. Для студентов технических и экономических специальностей ведущих вузов.', requirements:['Технические или экономические специальности','GPA от 3.7','Конкурсный отбор','Договор об отработке 5 лет'], deadline:'Сентябрь', link:'https://samruk-kazyna.kz', specialty_ids:[1,2,5,6,19,20] },
    { id:6, name:'Грант КБТУ для абитуриентов', type:'university', amount:'до 50% скидки', description:'Внутренний грант КБТУ для отличников. Студенты с высоким баллом ЕНТ получают скидку на обучение от 25% до 50%.', requirements:['Поступление в КБТУ','ЕНТ от 120 баллов','Поддержание GPA 3.5+'], deadline:'Июль–август', link:'https://kbtu.kz', specialty_ids:[1,2,3,4,19,20] },
    { id:7,  name:'Стипендия KazMunaiGas', type:'corporate', amount:'300 000 тг/месяц', description:'Стипендия от национальной нефтегазовой компании для студентов нефтегазовых и технических специальностей. Одна из самых высоких корпоративных стипендий.', requirements:['Нефтегазовые или технические специальности','GPA от 3.8','Прохождение собеседования'], deadline:'Октябрь', link:'https://kmg.kz', specialty_ids:[19,20,21,33] },
    { id:8,  name:'Грант КазНУ для отличников', type:'university', amount:'до 30% скидки', description:'Внутренний грант КазНУ им. аль-Фараби для абитуриентов с высоким баллом ЕНТ. Скидка на обучение 15–30% при поступлении на платное отделение с ЕНТ от 110 баллов.', requirements:['Поступление в КазНУ','ЕНТ от 110 баллов','Поддержание GPA 3.5+'], deadline:'Август', link:'https://www.kaznu.kz', specialty_ids:[1,2,5,6,9,17,24,25,26] },
    { id:9,  name:'Стипендия КИМЭП (Merit Award)', type:'university', amount:'25–100% скидки', description:'Программа Merit Award в КИМЭП для академически сильных студентов. Полное или частичное покрытие стоимости обучения по результатам вступительных тестов КИМЭП.', requirements:['Поступление в КИМЭП','Высокий балл вступительного теста','Поддержание GPA 3.0+'], deadline:'Май–июль', link:'https://www.kimep.kz', specialty_ids:[5,6,7,9,17] },
    { id:10, name:'Грант Нархоз для абитуриентов', type:'university', amount:'до 50% скидки', description:'Программа скидок Университета Нархоз для поступающих с высоким баллом ЕНТ. Скидки от 25% до 50% на весь период обучения при условии поддержания GPA.', requirements:['Поступление в Нархоз','ЕНТ от 100 баллов','GPA не ниже 3.3 каждый семестр'], deadline:'Июль–август', link:'https://narxoz.kz', specialty_ids:[5,6,7,8,27] },
    { id:11, name:'Стипендия Chevron (для КБТУ)', type:'corporate', amount:'180 000 тг/месяц', description:'Корпоративная стипендия нефтяной компании Chevron для студентов КБТУ на нефтегазовых и инженерных специальностях. Включает возможность прохождения практики.', requirements:['Обучение в КБТУ','Нефтегаз или инженерия','GPA от 3.5','Гражданство РК'], deadline:'Ноябрь', link:'https://kbtu.kz', specialty_ids:[19,20,21] },
    { id:12, name:'Грант AlmaU для предпринимателей', type:'university', amount:'до 40% скидки', description:'Специальная программа AlmaU для студентов с предпринимательским потенциалом и действующими стартапами. Скидка на MBA и бакалавриат при наличии бизнес-проекта.', requirements:['Поступление в AlmaU','Наличие бизнес-идеи или стартапа','Прохождение собеседования'], deadline:'Сентябрь', link:'https://almau.edu.kz', specialty_ids:[5,6,7,27,29] },
    { id:13, name:'Грант МУИТ для IT-специалистов', type:'university', amount:'до 50% скидки', description:'Внутренняя программа поддержки МУИТ для одарённых IT-студентов. Скидки до 50% для абитуриентов с высоким баллом ЕНТ по математике и информатике.', requirements:['Поступление в МУИТ','ЕНТ по математике от 25 баллов','Поддержание GPA 3.5+'], deadline:'Июль', link:'https://iitu.edu.kz', specialty_ids:[1,2,3,4] },
  ],
  tips: [
    { id:1, title:'Как читать рейтинг QS', category:'Рейтинги', content:'QS World University Rankings — один из самых авторитетных мировых рейтингов университетов. Оценивает вузы по 6 показателям: академическая репутация (40%), репутация у работодателей (10%), соотношение студентов и преподавателей (20%), цитируемость (20%), доля иностранных преподавателей и студентов (10%). Позиция в топ-500 считается хорошим показателем на международном уровне.', tip:'КазНУ (#163) — единственный вуз Казахстана в топ-200 мира. Это значит высокое признание среди работодателей по всему миру.' },
    { id:2, title:'Что такое аккредитация', category:'Качество образования', content:'Аккредитация — независимая оценка качества образования. Бывает национальная (обязательная для всех вузов РК) и международная (AACSB, ABET, FIBAA и др.). Международная аккредитация означает, что ваш диплом признаётся за рубежом и работодатели доверяют качеству образования.', tip:'ABET — аккредитация для технических вузов (только у КБТУ в ЦА). AACSB — для бизнес-школ, одна из самых престижных в мире.' },
    { id:3, title:'Планируй бюджет на 4 года', category:'Финансы', content:'Стоимость обучения — лишь часть расходов. Учтите: общежитие или аренда жилья (50–200 тыс тг/мес), питание (60–120 тыс тг/мес), транспорт (15–30 тыс тг/мес), учебные материалы (30–50 тыс тг/год). Полный бюджет на 4 года может быть на 30–50% выше стоимости обучения.', tip:'Самый экономный вариант: КазНПУ (700K/год) + общежитие (55K/мес) = около 3.3 млн тг за 4 года всё вместе.' },
    { id:4, title:'Гранты и стипендии', category:'Финансы', content:'Государственный грант полностью покрывает обучение — подайте заявку сразу после ЕНТ. Если не получили грант, ищите корпоративные стипендии: Самрук-Казына, KazMunaiGas, Казахтелеком платят 200–300K тг/мес студентам с высоким GPA. Многие вузы дают собственные скидки отличникам.', tip:'Даже 25% скидка от вуза экономит 500K–950K тг за 4 года — это стоит постараться ради хороших оценок.' },
    { id:5, title:'Язык обучения — важный фактор', category:'Выбор вуза', content:'Выбор языка обучения влияет на карьеру. Английский язык (КИМЭП, КБТУ) открывает международные возможности и повышает зарплату на 20–40%. Казахский язык обязателен для госслужбы. Русский — широко востребован в частном секторе СНГ.', tip:'КИМЭП — обучение только на английском. Это сложнее, но выпускники в среднем зарабатывают больше.' },
    { id:6, title:'ROI образования — считай заранее', category:'Финансы', content:'ROI (Return on Investment) образования — сколько лет нужно работать, чтобы окупить вложения в учёбу. Считается просто: стоимость обучения ÷ ежемесячная зарплата = количество месяцев окупаемости. IT-специальности обычно окупаются за 2–4 года, медицина — за 5–8 лет.', tip:'Используйте калькулятор ROI на нашей платформе. Он покажет окупаемость для каждого вуза и вашей ожидаемой зарплаты.' },
  ]
};

/**
 * Проверяет, есть ли данные в БД
 */
function isDatabaseEmpty(db) {
  try {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
    return count.cnt === 0;
  } catch (e) {
    return true;
  }
}

/**
 * Миграция: заполняет БД seed-данными (безопасно для повторных запусков)
 */
function seedDatabaseIfEmpty() {
  const db = getDb();
  
  if (!isDatabaseEmpty(db)) {
    console.log('✓ БД уже содержит данные, пропускаю миграцию');
    return;
  }

  console.log('↳ Миграция seed-данных в SQLite...');

  try {
    // Начинаем транзакцию для атомарности
    const insertCities = db.prepare('INSERT OR IGNORE INTO cities (id, name) VALUES (?, ?)');
    const insertSpecialties = db.prepare('INSERT OR IGNORE INTO specialties (id, name, category) VALUES (?, ?, ?)');
    const insertUniversities = db.prepare(
      `INSERT OR IGNORE INTO universities 
       (id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to, website, description, founded, students_count, languages, accreditations, has_dorm, dorm_price, avg_salary, lat, lng) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertUniversitySpecialty = db.prepare('INSERT OR IGNORE INTO university_specialties (university_id, specialty_id) VALUES (?, ?)');
    const insertGrant = db.prepare(
      `INSERT OR IGNORE INTO grants 
       (id, name, type, amount, description, requirements, deadline, link) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertGrantSpecialty = db.prepare('INSERT OR IGNORE INTO grant_specialties (grant_id, specialty_id) VALUES (?, ?)');
    const insertTip = db.prepare('INSERT OR IGNORE INTO tips (id, title, category, content, tip) VALUES (?, ?, ?, ?, ?)');

    const transaction = db.transaction(() => {
      // Города
      SEED.cities.forEach(city => {
        insertCities.run(city.id, city.name);
      });

      // Специальности
      SEED.specialties.forEach(spec => {
        insertSpecialties.run(spec.id, spec.name, spec.category);
      });

      // Университеты
      SEED.universities.forEach(uni => {
        const { specialty_ids, ...uniData } = uni;
        insertUniversities.run(
          uniData.id, uniData.name, uniData.short_name, uniData.city_id,
          uniData.qs_world, uniData.qs_asia, uniData.price_from, uniData.price_to,
          uniData.website, uniData.description, uniData.founded, uniData.students_count,
          JSON.stringify(uniData.languages),
          JSON.stringify(uniData.accreditations),
          uniData.has_dorm ? 1 : 0,
          uniData.dorm_price, uniData.avg_salary,
          uniData.lat, uniData.lng
        );

        // Связи: университет -> специальности
        if (specialty_ids && Array.isArray(specialty_ids)) {
          specialty_ids.forEach(specId => {
            insertUniversitySpecialty.run(uni.id, specId);
          });
        }
      });

      // Гранты
      SEED.grants.forEach(grant => {
        const { specialty_ids, ...grantData } = grant;
        insertGrant.run(
          grantData.id, grantData.name, grantData.type, grantData.amount,
          grantData.description,
          JSON.stringify(grantData.requirements),
          grantData.deadline, grantData.link
        );

        // Связи: грант -> специальности
        if (specialty_ids && Array.isArray(specialty_ids)) {
          specialty_ids.forEach(specId => {
            insertGrantSpecialty.run(grant.id, specId);
          });
        }
      });

      // Советы
      SEED.tips.forEach(tip => {
        insertTip.run(tip.id, tip.title, tip.category, tip.content, tip.tip);
      });
    });

    transaction();
    console.log('✓ Миграция завершена успешно');
  } catch (err) {
    console.error('✗ Ошибка при миграции:', err.message);
    throw err;
  }
}

module.exports = {
  seedDatabaseIfEmpty,
  isDatabaseEmpty
};
