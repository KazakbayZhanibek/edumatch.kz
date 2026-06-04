const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');

try {
  // Загрузить JSON
  const data = JSON.parse(fs.readFileSync('../../Parcerscript/universities.json', 'utf8'));
  
  // Собрать все уникальные специальности из всех вузов
  const specialtiesMap = new Map();
  
  for (const uni of data) {
    if (uni.specialties && Array.isArray(uni.specialties)) {
      for (const spec of uni.specialties) {
        if (spec.id && spec.name && spec.category) {
          specialtiesMap.set(spec.id, { id: spec.id, name: spec.name, category: spec.category });
        }
      }
    }
  }

  // Вставить специальности
  const insertSpecialty = db.prepare(`
    INSERT OR IGNORE INTO specialties (id, name, category)
    VALUES (?, ?, ?)
  `);

  let specCount = 0;
  for (const [id, spec] of specialtiesMap) {
    try {
      insertSpecialty.run(id, spec.name, spec.category);
      specCount++;
    } catch (err) {
      console.log('Error inserting specialty', spec.id, ':', err.message);
    }
  }

  console.log(`Loaded ${specCount} specialties`);

  // Вставить связи университет-специальность
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO university_specialties (university_id, specialty_id)
    VALUES (?, ?)
  `);

  let linkCount = 0;
  for (const uni of data) {
    if (uni.id && uni.specialties && Array.isArray(uni.specialties)) {
      for (const spec of uni.specialties) {
        try {
          insertLink.run(uni.id, spec.id);
          linkCount++;
        } catch (err) {
          console.log('Error inserting link', uni.id, '->', spec.id, ':', err.message);
        }
      }
    }
  }

  console.log(`Loaded ${linkCount} university-specialty links`);
} catch (err) {
  console.error('Error:', err.message);
}
