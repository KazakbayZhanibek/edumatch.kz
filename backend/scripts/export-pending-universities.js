const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'), { readonly: true });
const outputPath = path.join(__dirname, '..', 'pending-universities.json');

try {
  const rows = db.prepare(`
    SELECT id, name, short_name, city_id, city_name, price_from, price_to,
           website, description, founded, students_count, languages,
           admission_phone, address, source_record_id,
           has_dorm, dorm_price, avg_salary, lat, lng, data_status
    FROM (
      SELECT u.*, c.name AS city_name
      FROM universities u
      LEFT JOIN cities c ON c.id = u.city_id
    )
    WHERE data_status = 'pending'
    ORDER BY city_name, name
  `).all();

  const template = rows.map(row => ({
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    city: row.city_name,
    official_website: row.website || '',
    address: row.address || '',
    coordinates: { lat: row.lat, lng: row.lng },
    price_from: row.price_from,
    price_to: row.price_to,
    programs: [],
    languages: JSON.parse(row.languages || '[]'),
    has_dorm: Boolean(row.has_dorm),
    dorm_price: row.dorm_price,
    admission_phone: row.admission_phone || '',
    source_record_id: row.source_record_id || null,
    source_url: '',
    verified_at: '',
    status: 'pending'
  }));

  fs.writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  console.log(`Exported ${template.length} pending universities to ${outputPath}`);
} finally {
  db.close();
}
