const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'edumatch.db'));
const sourcePath = path.join(__dirname, '..', '..', 'universities_grants_full.jsonl');
const linksPath = path.join(__dirname, '..', '..', 'universities_links_all_now_visible.jsonl');
const academicYear = process.env.GRANTS_ACADEMIC_YEAR || '2026-2027';

const synonyms = {
  'Computer Science': ['Компьютерные науки', 'Информатика', 'CS'],
  'Программная инженерия': ['Software Engineering', 'Разработка программного обеспечения'],
  'Информационные системы': ['Information Systems', 'ИС'],
  'Вычислительная техника и программное обеспечение': ['Computer Engineering', 'Вычислительная техника', 'ВТиПО'],
  'Data Science': ['Наука о данных', 'Аналитика данных'],
  'Cybersecurity': ['Кибербезопасность', 'Информационная безопасность'],
};

function readJsonLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line, index) => {
    const jsonStart = line.indexOf('{');
    if (jsonStart < 0 || !line.trim()) return null;
    try { return JSON.parse(line.slice(jsonStart)); }
    catch (error) { throw new Error(`JSON parse error in ${path.basename(filePath)} line ${index + 1}: ${error.message}`); }
  }).filter(Boolean);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function classifyScholarship(name) {
  const lower = String(name).toLocaleLowerCase();
  if (lower.includes('государственный') && lower.includes('грант')) return 'government';
  if (lower.includes('болашак')) return 'government';
  if (/(корпоратив|shell|chevron|kazakhmys|kaspi|kolesa|нефтян)/i.test(lower)) return 'corporate';
  if (/(региональ|акимат)/i.test(lower)) return 'regional';
  return 'university';
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }
try {
  const universities = readJsonLines(sourcePath);
  const links = new Map(readJsonLines(linksPath).map(item => [item.id, safeUrl(item.official_website)]));
  if (!universities.length) throw new Error('Grant source contains no valid university records');

  const cityByName = new Map(db.prepare('SELECT id, name FROM cities').all().map(row => [row.name, row.id]));
  const specialties = db.prepare('SELECT id, name, category FROM specialties').all();
  const specialtyIds = new Map();
  for (const specialty of specialties) {
    for (const key of [specialty.name, specialty.category]) {
      if (!key) continue;
      const normalized = String(key).trim().toLocaleLowerCase();
      if (!specialtyIds.has(normalized)) specialtyIds.set(normalized, []);
      specialtyIds.get(normalized).push(specialty.id);
    }
  }

  const insert = db.prepare(`INSERT INTO grants
  (id, name, type, amount, description, requirements, deadline, link, source_url, source_title,
   verification_status, verified_at, university_id, city_id, academic_year, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  const insertLink = db.prepare('INSERT OR IGNORE INTO grant_specialties (grant_id, specialty_id) VALUES (?, ?)');
  const findExistingUniversity = db.prepare('SELECT id FROM universities WHERE id = ? AND COALESCE(data_status, \'active\') = \'active\'');

  function linkSpecialties(grantId, names) {
    for (const name of unique(names)) {
      const candidates = unique([name, ...(synonyms[name] || [])]).flatMap(value => specialtyIds.get(String(value).trim().toLocaleLowerCase()) || []);
      for (const specialtyId of candidates) insertLink.run(grantId, specialtyId);
    }
  }

  let grantId = 1;
  let inserted = 0;
  let linked = 0;
  const importAll = db.transaction(() => {
  db.prepare('DELETE FROM grant_specialties').run();
  db.prepare('DELETE FROM grants').run();

  for (const university of universities) {
  const universityId = findExistingUniversity.get(university.id)?.id || null;
  const cityId = cityByName.get(university.city) || null;
  const sourceUrl = links.get(university.id);
  const commonRequirements = [`ЕНТ от ${university.ent_threshold || 'не указан'}`];
  const sourceTitle = sourceUrl ? `Официальный сайт ${university.short_name || university.name}` : null;

  const addGrant = ({ name, type, amount = 'Уточняется', description, requirements = commonRequirements, specialties: grantSpecialties = [] }) => {
        const id = grantId++;
        insert.run(id, name, type, amount, description, JSON.stringify(unique(requirements)), null, sourceUrl || '', sourceUrl, sourceTitle,
          'needs_review', null, universityId, cityId, academicYear);
  linkSpecialties(id, grantSpecialties);
  inserted++;
  return id;
  };

  if (university.has_grants && university.ent_threshold > 0) {
        addGrant({
          name: `Государственный образовательный грант — ${university.short_name}`,
          type: 'government', amount: 'Полное покрытие',
          description: `Запись из исходного каталога для ${university.name}. Условия конкурса и распределение мест требуют проверки по официальному источнику.`,
          requirements: [...commonRequirements, university.total_budget_seats ? `Бюджетных мест в вузе: ${university.total_budget_seats}` : null],
          specialties: (university.faculties || []).flatMap(faculty => faculty.specialties || []),
        });
      }

      for (const scholarship of university.scholarships || []) {
        if (/государственный.*грант|образовательный.*грант/i.test(scholarship)) continue;
        addGrant({
          name: scholarship,
          type: classifyScholarship(scholarship),
          description: `Финансирование, указанное для ${university.name}. Размер, конкурсные условия и срок требуют проверки у организатора.`,
          requirements: [...commonRequirements, `Доступно в ${university.name}`],
          specialties: (university.faculties || []).flatMap(faculty => faculty.specialties || []),
        });
      }

      for (const faculty of university.faculties || []) {
        for (const program of faculty.programs || []) {
          addGrant({
            name: `Грант на «${program.program}» — ${university.short_name}`,
            type: 'government', amount: 'Полное покрытие',
            description: `Каталожная запись для программы «${program.program}» (${faculty.faculty}) в ${university.name}. Исторический проходной балл не является текущим конкурсным баллом.`,
            requirements: [...commonRequirements, `Бюджетных мест: ${program.budget_seats ?? 'не указано'}`, program.passing_score_2023 ? `Проходной балл 2023: ${program.passing_score_2023}` : null, ...(synonyms[program.program] || [])],
            specialties: [...(faculty.specialties || []), program.program],
          });
        }
      }
    }
  });

  importAll();
  linked = db.prepare('SELECT COUNT(*) AS count FROM grant_specialties').get().count;
  console.log(JSON.stringify({ sourceUniversities: universities.length, grantsInserted: inserted, specialtyLinks: linked, academicYear, verificationStatus: 'needs_review' }, null, 2));
} finally {
  db.close();
}
