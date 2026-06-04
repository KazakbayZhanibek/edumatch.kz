const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');

try {
  // Загрузить JSON с полными данными
  const data = JSON.parse(fs.readFileSync('../../universities_full(1).json', 'utf8'));
  
  // 1. Вставить специальности из faculties
  const insertSpecialty = db.prepare(`
    INSERT OR IGNORE INTO specialties (id, name, category)
    VALUES (?, ?, ?)
  `);

  let specCount = 0;
  let nextSpecId = 100;
  const specialtyMap = new Map(); // name -> id

  for (const uni of data) {
    if (uni.faculties && Array.isArray(uni.faculties)) {
      for (const faculty of uni.faculties) {
        if (faculty.specialties && Array.isArray(faculty.specialties)) {
          for (const spec of faculty.specialties) {
            if (!specialtyMap.has(spec.name)) {
              const specId = nextSpecId++;
              specialtyMap.set(spec.name, specId);
              try {
                insertSpecialty.run(specId, spec.name, faculty.name);
                specCount++;
              } catch (err) {
                console.log('Error inserting specialty', spec.name, ':', err.message);
              }
            }
          }
        }
      }
    }
  }

  console.log(`Loaded ${specCount} specialties`);

  // 2. Вставить университеты
  const insertUniversity = db.prepare(`
    INSERT INTO universities (id, name, short_name, city_id, qs_world, qs_asia, price_from, price_to, website, description, founded, students_count, languages, accreditations, has_dorm, dorm_price, avg_salary, lat, lng, is_top)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Находим city_id по названию города
  const getCityId = (cityName) => {
    const city = db.prepare('SELECT id FROM cities WHERE name LIKE ?').get('%' + cityName + '%');
    return city ? city.id : 1;
  };

  let uniCount = 0;
  for (const uni of data) {
    try {
      const cityId = getCityId(uni.city);
      insertUniversity.run(
        uni.id,
        uni.name,
        uni.short_name,
        cityId,
        uni.qs_world || null,
        uni.qs_asia || null,
        uni.price_from || 500000,
        uni.price_to || 2000000,
        uni.address || '',
        uni.description || '',
        uni.founded || 2000,
        uni.students_count || 0,
        JSON.stringify(uni.languages || ['Казахский', 'Русский']),
        JSON.stringify(uni.accreditations || ['Национальная']),
        uni.dormitory ? 1 : 0,
        uni.dormitory_price_per_year || 0,
        uni.avg_graduate_salary || 0,
        uni.lat || 0,
        uni.lng || 0,
        uni.qs_world && uni.qs_world <= 750 ? 1 : 0  // is_top если qs_world <= 750
      );
      uniCount++;
    } catch (err) {
      console.log('Error inserting uni', uni.id, uni.name, ':', err.message);
    }
  }

  console.log(`Loaded ${uniCount} universities`);

  // 3. Вставить связи университет-специальность
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO university_specialties (university_id, specialty_id)
    VALUES (?, ?)
  `);

  let linkCount = 0;
  for (const uni of data) {
    if (uni.faculties && Array.isArray(uni.faculties)) {
      for (const faculty of uni.faculties) {
        if (faculty.specialties && Array.isArray(faculty.specialties)) {
          for (const spec of faculty.specialties) {
            const specId = specialtyMap.get(spec.name);
            if (specId) {
              try {
                insertLink.run(uni.id, specId);
                linkCount++;
              } catch (err) {
                console.log('Error inserting link', uni.id, '->', specId, ':', err.message);
              }
            }
          }
        }
      }
    }
  }

  console.log(`Loaded ${linkCount} university-specialty links`);

  // Проверим что загрузилось
  const uniCheck = db.prepare('SELECT COUNT(*) as cnt FROM universities').get();
  const specCheck = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get();
  const linkCheck = db.prepare('SELECT COUNT(*) as cnt FROM university_specialties').get();
  const grantCheck = db.prepare('SELECT COUNT(*) as cnt FROM grants').get();
  
  console.log('\n✓ Summary:');
  console.log(`  Universities: ${uniCheck.cnt}`);
  console.log(`  Specialties: ${specCheck.cnt}`);
  console.log(`  Links: ${linkCheck.cnt}`);
  console.log(`  Grants: ${grantCheck.cnt} (загружаются отдельно через load-grants-data.js)`);
  
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
