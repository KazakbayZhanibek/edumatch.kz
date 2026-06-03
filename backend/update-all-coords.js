const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'eduMatch.db'));

const universities = [
  { "id": 1, "name": "Назарбаев Университет", "short_name": "НУ", "city": "Астана", "address": "Nazarbayev University, Astana", "lat": 51.02649, "lng": 71.46352 },
  { "id": 2, "name": "Казахский национальный университет имени аль-Фараби", "short_name": "КазНУ", "city": "Алматы", "address": "Al-Farabi Avenue 71, Almaty", "lat": 43.23932, "lng": 76.93849 },
  { "id": 3, "name": "Евразийский национальный университет имени Л.Н. Гумилева", "short_name": "ЕНУ", "city": "Астана", "address": "Mirzoyan Street 2, Astana", "lat": 51.12157, "lng": 71.49244 },
  { "id": 4, "name": "Казахский агротехнический университет имени С. Сейфуллина", "short_name": "КазАТУ", "city": "Акмола", "address": "Zhenis Avenue 62, Akmola", "lat": 51.18658, "lng": 71.41169 },
  { "id": 5, "name": "Карагандинский государственный технический университет", "short_name": "КарГТУ", "city": "Темиртау", "address": "Temirtau, Republic Avenue 30", "lat": 49.75247, "lng": 76.62183 },
  { "id": 6, "name": "Академия наук Карагандинской области имени М.О. Аузова", "short_name": "АНК", "city": "Караганда", "address": "Karaganda, Gogol Street 38", "lat": 49.79881, "lng": 73.13211 },
  { "id": 7, "name": "Карагандинский государственный университет имени Е. Букетова", "short_name": "КарГУ", "city": "Караганда", "address": "Karaganda, Universitetskaya Street 28", "lat": 49.77224, "lng": 73.12679 },
  { "id": 8, "name": "Казахский национальный аграрный университет", "short_name": "КНАУ", "city": "Акмола", "address": "Akmola, Zhenis Avenue 62", "lat": 51.175, "lng": 71.425 },
  { "id": 9, "name": "Павлодарский государственный педагогический университет", "short_name": "ПГПУ", "city": "Павлодар", "address": "Pavlodar, Lomov Street 60", "lat": 52.28941, "lng": 76.97278 },
  { "id": 10, "name": "Павлодарский государственный университет имени С. Торайгырова", "short_name": "ПГУ", "city": "Павлодар", "address": "Pavlodar, Republic Avenue 64", "lat": 52.27211, "lng": 76.96139 },
  { "id": 11, "name": "Восточно-Казахстанский государственный технический университет имени Д.Д. Серикова", "short_name": "ВКГТУ", "city": "Усть-Каменогорск", "address": "Ust-Kamenogorsk, Serikov Street 69", "lat": 49.95694, "lng": 82.59093 },
  { "id": 12, "name": "Семей государственный медицинский университет", "short_name": "СГМУ", "city": "Семей", "address": "Semei, Abay Street 103", "lat": 50.43333, "lng": 80.26667 },
  { "id": 13, "name": "Южно-Казахстанский государственный университет имени М. Аурэзова", "short_name": "ЮКГУ", "city": "Шымкент", "address": "Shymkent, Tauke Khan Avenue 5", "lat": 42.32109, "lng": 69.59023 },
  { "id": 14, "name": "Кызылординский университет имени Коркыта Ата", "short_name": "КУ", "city": "Кызылорда", "address": "Kyzylorda, Aiteke Bi Street 29A", "lat": 44.83829, "lng": 65.475 },
  { "id": 15, "name": "Мангистауский государственный университет имени Б. Момышулы", "short_name": "МГУ", "city": "Актау", "address": "Aktau, Zhanaozen Avenue 29", "lat": 43.66944, "lng": 51.19028 },
  { "id": 16, "name": "Атырауский государственный университет имени Х. Досмухамедова", "short_name": "АГУ", "city": "Атырау", "address": "Atyrau, Satybaev Street 70", "lat": 43.70833, "lng": 51.36389 },
  { "id": 17, "name": "Западно-Казахстанский аграрно-технический университет имени Жангира Хана", "short_name": "ЗКАТУ", "city": "Уральск", "address": "Uralsk, Zhangir Khan Avenue 51", "lat": 51.17733, "lng": 51.30819 },
  { "id": 18, "name": "Северо-Казахстанский государственный университет", "short_name": "СКГУ", "city": "Петропавловск", "address": "Petropavlovsk, Ikramova Street 34", "lat": 54.87654, "lng": 69.13424 },
  { "id": 19, "name": "Казахский национальный педагогический университет имени Абая", "short_name": "КНПУим.Абая", "city": "Алматы", "address": "Almaty, Dostyk Avenue 13", "lat": 43.23881, "lng": 76.89056 },
  { "id": 20, "name": "Казахский технологический университет", "short_name": "КТУ", "city": "Алматы", "address": "Almaty, Satbayev Street 100", "lat": 43.23311, "lng": 76.91575 },
  { "id": 21, "name": "Казахский государственный женский педагогический университет", "short_name": "КГЖПУ", "city": "Алматы", "address": "Almaty, Auezov Street 99", "lat": 43.245, "lng": 76.895 },
  { "id": 22, "name": "Туран Университет", "short_name": "Туран", "city": "Алматы", "address": "Almaty, Satbayev Street 16", "lat": 43.2355, "lng": 76.931 },
  { "id": 23, "name": "Алматинский технологический университет", "short_name": "АТУ", "city": "Алматы", "address": "Almaty, Tole Bi Street 100", "lat": 43.2467, "lng": 76.8584 },
  { "id": 24, "name": "Казахский государственный лесотехнический институт", "short_name": "КГЛТИ", "city": "Алматы", "address": "Almaty, Poyarkovskaya Street 45", "lat": 43.22111, "lng": 76.94889 },
  { "id": 25, "name": "Международный университет информационных технологий", "short_name": "МУИТ", "city": "Алматы", "address": "Almaty, Mangilik Eli Avenue 34A", "lat": 43.205, "lng": 77.01 },
  { "id": 26, "name": "Казахстанский филиал Московского государственного университета имени М.В. Ломоносова", "short_name": "КзФ МГУ", "city": "Алматы", "address": "Almaty, Turgen Street 120A", "lat": 43.23311, "lng": 76.93311 },
  { "id": 27, "name": "Университет туризма и международных отношений", "short_name": "УТМО", "city": "Алматы", "address": "Almaty, Taimanov Street 2", "lat": 43.25333, "lng": 76.93 },
  { "id": 28, "name": "Казахский государственный архитектурно-строительный университет", "short_name": "КГАСУ", "city": "Алматы", "address": "Almaty, Suleimenov Street 1", "lat": 43.24056, "lng": 76.92556 },
  { "id": 29, "name": "Казахский государственный индустриально-строительный университет", "short_name": "КГИСУ", "city": "Алматы", "address": "Almaty, Suleimenov Street 1", "lat": 43.241, "lng": 76.928 },
  { "id": 30, "name": "Каспийский государственный технический университет", "short_name": "КГТУ", "city": "Актау", "address": "Aktau, Youth Street 27", "lat": 43.65, "lng": 51.16667 },
  { "id": 31, "name": "Университет Сулеймана Демиреля", "short_name": "УСД", "city": "Каскелен", "address": "Kaskelen, Abay Avenue 1", "lat": 43.16667, "lng": 77.1 },
  { "id": 32, "name": "Казахский британский технический университет", "short_name": "КБТУ", "city": "Алматы", "address": "Almaty, Turgen Street 120A", "lat": 43.25573, "lng": 76.94313 },
  { "id": 33, "name": "Евразийский университет", "short_name": "ЕУ", "city": "Астана", "address": "Astana, Kabanbay Batyr Avenue 6", "lat": 51.17, "lng": 71.47 },
  { "id": 34, "name": "Университет имени Туран Хамзаева", "short_name": "УТХ", "city": "Астана", "address": "Astana, Abai Avenue 1", "lat": 51.167, "lng": 71.469 },
  { "id": 35, "name": "Казахский государственный медицинский университет им. С.Д. Асфендиярова", "short_name": "КГМУ", "city": "Алматы", "address": "Almaty, Pushkin Street 94", "lat": 43.2381, "lng": 76.8975 },
  { "id": 36, "name": "Казахский национальный медицинский университет им. С.Д. Асфендиярова", "short_name": "КНИМУ", "city": "Алматы", "address": "Almaty, Pushkin Street 94", "lat": 43.2383, "lng": 76.8994 },
  { "id": 37, "name": "Актюбинский региональный государственный университет имени К. Жубанова", "short_name": "АРГУ", "city": "Актюбе", "address": "Aktobe, A. Moldagulov Avenue 34", "lat": 50.29167, "lng": 57.19278 },
  { "id": 38, "name": "Актюбинский государственный педагогический институт", "short_name": "АГПИ", "city": "Актюбе", "address": "Aktobe, Tolybaev Street 80", "lat": 50.29167, "lng": 57.17 },
  { "id": 39, "name": "Батысский государственный университет имени Махамбета Утемисова", "short_name": "БГУ", "city": "Уральск", "address": "Uralsk, Zhetisu Street 51", "lat": 51.21944, "lng": 51.40056 },
  { "id": 40, "name": "Кокшетауский государственный педагогический институт", "short_name": "КГПИ", "city": "Кокшетау", "address": "Kokchetau, Internacionalnaya Street 36", "lat": 53.28833, "lng": 69.39694 },
  { "id": 41, "name": "Жезказганский государственный университет имени О. Айманова", "short_name": "ЖГУ", "city": "Жезказган", "address": "Zhezkazgan, Auezov Street 85", "lat": 47.79972, "lng": 67.71972 },
  { "id": 42, "name": "Каспийский государственный университет технологии и инжиниринга имени Ш. Есенова", "short_name": "КГУТИ", "city": "Актау", "address": "Aktau, Microdistrict 3", "lat": 43.66281, "lng": 51.1606 },
  { "id": 43, "name": "Академия экономики и государственного управления при Президенте РК", "short_name": "АЭГУ", "city": "Астана", "address": "Astana, Republic Avenue 52", "lat": 51.18111, "lng": 71.47022 },
  { "id": 44, "name": "Международная бизнес-школа KIMEP University", "short_name": "KIMEP", "city": "Алматы", "address": "Almaty, Abai Avenue 4", "lat": 43.24079, "lng": 76.95593 }
];

console.log('🔄 Обновление координат университетов...\n');

const updateStmt = db.prepare('UPDATE universities SET lat = ?, lng = ? WHERE id = ?');

let updated = 0;
let errors = [];
let changes = [];

universities.forEach(uni => {
  try {
    const result = updateStmt.run(uni.lat, uni.lng, uni.id);
    if (result.changes > 0) {
      updated++;
      changes.push(`${uni.id}. ${uni.short_name.padEnd(15)} (${uni.lat}, ${uni.lng})`);
    } else {
      errors.push(`ID ${uni.id}: Университет не найден`);
    }
  } catch (e) {
    errors.push(`ID ${uni.id}: ${e.message}`);
  }
});

console.log('✅ Обновленные университеты:\n');
changes.forEach(c => console.log(`  ${c}`));

if (errors.length > 0) {
  console.error('\n⚠️ Ошибки:');
  errors.forEach(err => console.error(`  ${err}`));
}

console.log(`\n✅ Всего обновлено: ${updated} из ${universities.length} университетов`);

// Проверим результаты
console.log('\n📍 Проверка первых 5 университетов:');
const check = db.prepare('SELECT id, short_name, lat, lng FROM universities LIMIT 5').all();
check.forEach(u => {
  console.log(`  ${u.id}. ${u.short_name.padEnd(15)} (${u.lat}, ${u.lng})`);
});

db.close();
