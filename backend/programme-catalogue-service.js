const { programmes: reviewedProgrammes } = require('./planner-catalogue');
const { listProgrammes } = require('./programme-store');

const GROUPS = {
  B057: { codePrefix: '6B061%', subjects: ['math', 'informatics'], label: 'Информационные технологии' },
  B058: { codePrefix: '6B063%', subjects: ['math', 'informatics'], label: 'Информационная безопасность' },
  B059: { codePrefix: '6B062%', subjects: ['math', 'physics'], label: 'Коммуникации и телекоммуникации' },
};

function normalized(value) { return String(value || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim(); }
function matchUniversity(universities, programme) {
  const wanted = normalized(programme.university);
  return universities.find(row => {
    const names = [row.name, row.short_name].map(normalized);
    return names.some(name => name === wanted || name.startsWith(`${wanted} `) || wanted.startsWith(`${name} `));
  });
}

function getProgrammeCatalogue(db, groupCode) {
  const group = GROUPS[groupCode];
  if (!group) return [];
  const universities = db.prepare(`SELECT u.id,u.name,u.short_name,u.website,u.price_from,u.price_to,u.has_dorm,c.name city
    FROM universities u LEFT JOIN cities c ON c.id=u.city_id
    WHERE COALESCE(u.data_status,'active')='active'`).all();
  const imported = listProgrammes(db, groupCode).map(programme => {
    const university = matchUniversity(universities, programme);
    return { ...programme, universityId: university?.id || null, catalogueKind: 'verified_programme' };
  });
  const reviewed = reviewedProgrammes.filter(programme => programme.group === groupCode).map(programme => {
    const university = matchUniversity(universities, programme);
    return { ...programme, universityId: university?.id || null, catalogueKind: 'reviewed_programme' };
  });
  const detailed = [...imported];
  for (const programme of reviewed) {
    if (!detailed.some(item => item.universityId === programme.universityId && normalized(item.name) === normalized(programme.name))) detailed.push(programme);
  }
  const detailedUniversities = new Set(detailed.map(item => item.universityId).filter(Boolean));
  const linked = db.prepare(`SELECT u.id,u.name,u.short_name,u.website,u.price_from,u.price_to,u.has_dorm,c.name city,
      GROUP_CONCAT(DISTINCT s.name) specialty_names
    FROM universities u
    JOIN university_specialties us ON us.university_id=u.id
    JOIN specialties s ON s.id=us.specialty_id
    LEFT JOIN cities c ON c.id=u.city_id
    WHERE COALESCE(u.data_status,'active')='active' AND s.code LIKE ?
    GROUP BY u.id ORDER BY u.is_top DESC,CASE WHEN u.qs_world IS NULL THEN 1 ELSE 0 END,u.qs_world,u.name`).all(group.codePrefix);
  const fallbacks = linked.filter(row => !detailedUniversities.has(row.id)).map(row => ({
    id: `catalogue-${row.id}-${groupCode.toLowerCase()}`,
    name: `${group.label}: программы требуют уточнения`,
    group: groupCode,
    university: row.short_name || row.name,
    universityId: row.id,
    city: row.city,
    subjects: group.subjects,
    language: [],
    tuition: null,
    tuitionYear: null,
    tuitionNote: row.price_from ? `В общем каталоге вуза указана цена от ${row.price_from} ₸, но стоимость этой программы не подтверждена.` : 'Стоимость программы не опубликована.',
    minimumEnt: null,
    grantMinEnt: null,
    requirementsYear: null,
    entSectionsNote: 'Требования программы ещё не подтверждены официальным источником.',
    extraExam: null,
    extraExamDetails: [],
    deadline: null,
    documents: [],
    dorm: row.has_dorm === 1,
    dormDetails: { available: row.has_dorm === 1, guaranteed: false },
    conflict: false,
    conflictNote: '',
    verificationStatus: 'needs_review',
    reviewedAt: null,
    catalogueKind: 'university_specialty_link',
    specialtyNames: String(row.specialty_names || '').split(',').filter(Boolean),
    sources: row.website ? [{ url: row.website, title: `Официальный сайт: ${row.short_name || row.name}`, reviewedAt: null, status: 'needs_review' }] : [],
  }));
  return [...detailed, ...fallbacks];
}

module.exports = { GROUPS, getProgrammeCatalogue };
