const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const parser = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'Parcerscript', 'universities.json'), 'utf8'));

const dbIds = new Set(db.prepare('SELECT id FROM universities').all().map(r => r.id));
const missing = parser.filter(u => !dbIds.has(u.id));

// Map Parcerscript city_ids to correct DB city_ids
const cityMap = {
  17: 17, // Тараз -> Тараз
  18: 18, // Туркестан -> Туркестан
  19: 17, // Талдыкорган -> Тараз (61: Қаз-Орыс Тараз)
  20: 5,  // Темиртау -> Атырау (62: Досмұхамедов Атырау)
  21: 5,  // Рудный -> Атырау (63: Өтебаев Атырау мұнай, 64: Атырау инж-гум)
  22: 15, // Костанай -> Усть-Каменогорск (65: Серікбаев Шығыс-Қаз)
  23: 15, // Косшы -> Усть-Каменогорск (66: Аманжолов Шығыс-Қаз, 67: Каз-Амер Алматы)
  24: 13, // Семей -> Семей
  25: 17, // Тараз -> Тараз
  26: 17, // Тараз -> Тараз
  27: 14, // Уральск -> Уральск
  28: 14, // Уральск -> Уральск
  29: 7,  // Караганда -> Караганда
  30: 7,  // Караганда -> Караганда
  31: 7,  // Караганда -> Караганда
  32: 6,  // Жезказган -> Жезказган
  33: 9,  // Аркалык -> Кокшетау
  34: 21, // Рудный -> Рудный
  35: 22, // Костанай -> Костанай
  36: 10, // Кызылорда -> Кызылорда
};

// Per-uni city overrides (for unis in wrong city_id group)
const uniCityOverrides = {
  59: 14, // Оспанов Батыс-Қазақстан мед -> Уральск
  60: 2,  // Баишев Ақтөбе -> Актобе
};

console.log(`Found ${missing.length} universities to add`);

const insert = db.prepare(`
  INSERT INTO universities (
    id, name, short_name, city_id, qs_world, qs_asia,
    price_from, price_to, website, description, founded,
    students_count, languages, accreditations, has_dorm,
    dorm_price, avg_salary, lat, lng, is_top, last_updated_at,
    data_status, admission_phone, admission_email, admission_whatsapp,
    description_kk, description_en, address, source_record_id
  ) VALUES (
    @id, @name, @short_name, @city_id, @qs_world, @qs_asia,
    @price_from, @price_to, @website, @description, @founded,
    @students_count, @languages, @accreditations, @has_dorm,
    @dorm_price, @avg_salary, @lat, @lng, 0, datetime('now'),
    'active', NULL, NULL, NULL,
    NULL, NULL, @address, NULL
  )
`);

const insertMany = db.transaction((unis) => {
  for (const u of unis) {
    const mappedCity = uniCityOverrides[u.id] || cityMap[u.city_id] || u.city_id;
    insert.run({
      id: u.id,
      name: u.name?.trim(),
      short_name: u.short_name?.trim() || null,
      city_id: mappedCity,
      qs_world: u.qs_world || null,
      qs_asia: u.qs_asia || null,
      price_from: u.price_from || null,
      price_to: u.price_to || null,
      website: u.website || null,
      description: u.description || null,
      founded: u.founded || null,
      students_count: u.students_count || null,
      languages: JSON.stringify(u.languages || []),
      accreditations: JSON.stringify(u.accreditations || []),
      has_dorm: u.has_dorm ? 1 : 0,
      dorm_price: u.dorm_price || null,
      avg_salary: u.avg_salary || null,
      lat: u.lat || null,
      lng: u.lng || null,
      address: u.address || null,
    });
    console.log(`  + ${u.id}: ${u.name?.trim()?.slice(0, 60)}`);
  }
});

insertMany(missing);

const total = db.prepare('SELECT COUNT(*) as c FROM universities').get();
console.log(`\nDone. Total universities in DB: ${total.c}`);
db.close();
