const db = require('better-sqlite3')('edumatch.db');
const fs = require('fs');

// Синонимы названий специальностей для лучшего поиска
const synonyms = {
  'Computer Science': ['Компьютерные науки', 'Информатика', 'CS', 'Computer Science'],
  'Программная инженерия': ['Software Engineering', 'Разработка программного обеспечения', 'Программная инженерия'],
  'Информационные системы': ['Information Systems', 'ИС', 'Информационные системы'],
  'Вычислительная техника и программное обеспечение': ['Computer Engineering', 'Вычислительная техника', 'ВТиПО'],
  'Data Science': ['Data Science', 'Наука о данных', 'Аналитика данных'],
  'Cybersecurity': ['Кибербезопасность', 'Информационная безопасность', 'Cybersecurity'],
};

try {
  const lines = fs.readFileSync('../../universities_grants_full.jsonl', 'utf8').trim().split('\n');
  const universities = lines.map((line, i) => {
    try { return JSON.parse(line); }
    catch (e) { throw new Error(`JSON parse error on line ${i + 1}: ${e.message}`); }
  });

  console.log(`Loaded ${universities.length} universities from JSONL`);

  // Clear old grants
  db.prepare('DELETE FROM grant_specialties').run();
  db.prepare('DELETE FROM grants').run();
  console.log('Cleared old grants data');

  const insertGrant = db.prepare(`
    INSERT INTO grants (id, name, type, amount, description, requirements, deadline, link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGrantSpecialty = db.prepare(`
    INSERT OR IGNORE INTO grant_specialties (grant_id, specialty_id)
    VALUES (?, ?)
  `);
  const findSpecialty = db.prepare('SELECT id, name FROM specialties WHERE name = ?');
  const findSpecialtyLike = db.prepare("SELECT id, name FROM specialties WHERE name LIKE ?");

  let grantId = 1;
  let totalGrants = 0;
  let totalLinks = 0;

  for (const uni of universities) {
    // 1. Main government grant for the university
    if (uni.has_grants && uni.ent_threshold > 0) {
      const reqs = [`Порог ЕНТ: ${uni.ent_threshold}+`];
      if (uni.total_budget_seats > 0) {
        reqs.push(`Всего бюджетных мест в вузе: ${uni.total_budget_seats}`);
      }
      insertGrant.run(
        grantId++,
        `Государственный образовательный грант — ${uni.short_name}`,
        'government',
        'Полное покрытие',
        `Государственный грант для обучения в ${uni.name}. Проходной балл зависит от выбранной программы. Порог ЕНТ: ${uni.ent_threshold}.`,
        JSON.stringify(reqs),
        '',
        ''
      );
      totalGrants++;
    }

    // 2. Named scholarships (skip generic state grants already covered above)
    for (const scholarship of (uni.scholarships || [])) {
      const lower = scholarship.toLowerCase();
      if (lower.includes('государственный') && (lower.includes('грант') || lower.includes('образовательный'))) continue;

      let type = 'university';
      if (lower.includes('болашак')) type = 'government';
      if (lower.includes('корпоратив') || lower.includes('shell') || lower.includes('chevron') || lower.includes('kazakhmys')) type = 'corporate';
      if (lower.includes('it-грант') || lower.includes('kaspi') || lower.includes('kolesa')) type = 'corporate';

      insertGrant.run(
        grantId++,
        scholarship,
        type,
        'variable',
        `Стипендия/грант для студентов ${uni.name}`,
        JSON.stringify([`Доступно в ${uni.name}`, `ЕНТ от ${uni.ent_threshold}`]),
        '',
        ''
      );
      totalGrants++;
    }

    // 3. Per-program grants from faculties
    for (const faculty of (uni.faculties || [])) {
      for (const program of (faculty.programs || [])) {
        const reqs = [`ЕНТ: ${uni.ent_threshold}+`, `Бюджетных мест: ${program.budget_seats}`];
        if (program.passing_score_2023) {
          reqs.push(`Проходной балл 2023: ${program.passing_score_2023}`);
        }

        // Добавляем синонимы для лучшего поиска
        const synonymsList = synonyms[program.program] || [];
        for (const syn of synonymsList) {
          if (syn !== program.program) {
            reqs.push(syn);
          }
        }

        // Добавляем категорию специальности из faculty
        if (faculty.specialties && Array.isArray(faculty.specialties)) {
          for (const spec of faculty.specialties) {
            if (spec === 'IT' || spec === 'Здоровье' || spec === 'Инженерия') {
              // Не добавляем слишком общие категории, они не помогут поиску
            } else {
              reqs.push(spec);
            }
          }
        }

        const desc = `Государственный грант на программу «${program.program}» (${faculty.faculty}) в ${uni.name}. Бюджетных мест: ${program.budget_seats}.${program.passing_score_2023 ? ` Проходной балл 2023: ${program.passing_score_2023}.` : ''} Уровень: ${program.level}.`;

        insertGrant.run(
          grantId++,
          `Грант на «${program.program}» — ${uni.short_name}`,
          'government',
          'Полное покрытие',
          desc,
          JSON.stringify(reqs),
          '',
          ''
        );
        totalGrants++;

        // Link to specialty: try exact match first, then LIKE
        let spec = findSpecialty.get(program.program);
        if (spec) {
          insertGrantSpecialty.run(grantId - 1, spec.id);
          totalLinks++;
        } else {
          // Try synonyms
          for (const syn of synonymsList) {
            spec = findSpecialty.get(syn);
            if (spec) {
              insertGrantSpecialty.run(grantId - 1, spec.id);
              totalLinks++;
              break;
            }
          }
          if (!spec) {
            // Try partial match
            spec = findSpecialtyLike.get(`%${program.program}%`);
            if (spec) {
              insertGrantSpecialty.run(grantId - 1, spec.id);
              totalLinks++;
            }
          }
        }
      }
    }

    // 4. Corporate grants extracted from scholarship names
    const corpMatch = (uni.scholarships || []).join(' ').match(/(?:гранты\s+компаний|корпоративные\s+стипендии|IT-гранты)\s*([^.]+)/i);
    if (corpMatch) {
      const companies = corpMatch[1].trim();
      if (companies) {
        insertGrant.run(
          grantId++,
          `Корпоративные гранты — ${uni.short_name}`,
          'corporate',
          'variable',
          `Гранты от компаний ${companies} для студентов ${uni.name}.`,
          JSON.stringify([`ЕНТ: ${uni.ent_threshold}+`, `Компании: ${companies}`]),
          '',
          ''
        );
        totalGrants++;
      }
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Grants inserted: ${totalGrants}`);
  console.log(`  Grant-specialty links: ${totalLinks}`);

  const grantCheck = db.prepare('SELECT COUNT(*) as cnt FROM grants').get();
  console.log(`  Total grants in DB: ${grantCheck.cnt}`);

} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
