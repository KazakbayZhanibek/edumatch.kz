const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));
const batch = JSON.parse(fs.readFileSync('C:/Users/Janchik/Downloads/batch4_universities(1).json', 'utf8'));

const cities = db.prepare('SELECT id, name FROM cities').all();
const cityMap = {};
cities.forEach(c => { cityMap[c.name] = c.id; });

const fixCity = {
  'Туркестан': cityMap['Туркестан'] || 18,
  'Шымкент': cityMap['Шымкент'] || 16,
};

const update = db.prepare(`
  UPDATE universities SET
    name = @name,
    short_name = @short_name,
    description = @description,
    founded = @founded,
    students_count = @students_count,
    price_from = @price_from,
    price_to = @price_to,
    website = @website,
    address = @address,
    lat = @lat,
    lng = @lng,
    languages = @languages,
    accreditations = @accreditations,
    has_dorm = @has_dorm,
    dorm_price = @dorm_price,
    admission_phone = @admission_phone,
    admission_email = @admission_email,
    admission_whatsapp = @admission_whatsapp,
    qs_world = @qs_world,
    qs_asia = @qs_asia,
    last_updated_at = datetime('now'),
    data_status = 'active'
  WHERE id = @id
`);

let updated = 0;
for (const u of batch.universities) {
  const pid = u.pending_id;
  const exists = db.prepare('SELECT id FROM universities WHERE id = ?').get(pid);
  if (!exists) {
    console.log(`SKIP ${pid}: not in DB`);
    continue;
  }

  let cityId = null;
  if (u.city && cityMap[u.city]) cityId = cityMap[u.city];
  else if (u.city && fixCity[u.city]) cityId = fixCity[u.city];

  const existing = db.prepare('SELECT city_id, has_dorm FROM universities WHERE id = ?').get(pid);

  const desc = u.description || null;
  const founded = u.founded || null;
  const students = u.students_count || null;
  const priceFrom = u.tuition?.price_from_per_year || 0;
  const priceTo = u.tuition?.price_to_per_year || 0;
  const website = u.official_website || null;
  const address = u.address || null;
  const lat = u.coordinates?.lat || null;
  const lng = u.coordinates?.lng || null;
  const langs = JSON.stringify(u.languages || []);
  const accs = JSON.stringify(u.accreditations || []);
  const hasDorm = u.dormitory?.available != null ? (u.dormitory.available ? 1 : 0) : (existing?.has_dorm || 0);
  const dormPrice = u.dormitory?.price_per_year || null;
  const phone = u.contacts?.admission_phone || null;
  const email = u.contacts?.admission_email || null;
  const whatsapp = u.contacts?.whatsapp || null;
  const qsW = u.ratings?.qs_world ? parseInt(String(u.ratings.qs_world).replace(/[^0-9]/g, '')) || null : null;
  const qsA = u.ratings?.qs_asia ? parseInt(String(u.ratings.qs_asia).replace(/[^0-9]/g, '')) || null : null;

  update.run({
    id: pid,
    name: u.name?.trim(),
    short_name: u.short_name?.trim() || null,
    description: desc,
    founded: founded,
    students_count: students,
    price_from: priceFrom,
    price_to: priceTo,
    website: website,
    address: address,
    lat: lat,
    lng: lng,
    languages: langs,
    accreditations: accs,
    has_dorm: hasDorm,
    dorm_price: dormPrice,
    admission_phone: phone,
    admission_email: email,
    admission_whatsapp: whatsapp,
    qs_world: qsW,
    qs_asia: qsA,
  });

  const nameShort = u.name?.trim()?.slice(0, 50);
  const fixes = [];
  if (priceFrom) fixes.push(`price: ${priceFrom}-${priceTo}`);
  if (phone) fixes.push(`phone: ${phone}`);
  if (hasDorm) fixes.push('dorm: yes');
  if (desc) fixes.push('desc: yes');
  console.log(`  ✓ ${pid}: ${nameShort} [${fixes.join(', ')}]`);
  updated++;
}

console.log(`\nUpdated ${updated} universities`);
db.close();
