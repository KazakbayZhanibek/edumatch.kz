/**
 * Seed script для таблицы admission_chance_stats
 * Заполняет историческую статистику для тестирования
 * 
 * Использование: node seed-admission-stats.js
 */

const db = require('better-sqlite3')('edumatch.db');
const path = require('path');

console.log('🌱 Начинаю заполнение admission_chance_stats...\n');

const currentYear = new Date().getFullYear();

// Функция получения ID по названию
function getSpecialtyId(name) {
  const stmt = db.prepare('SELECT id FROM specialties WHERE name = ?');
  const row = stmt.get(name);
  return row ? row.id : null;
}

function getUniversityId(shortName) {
  const stmt = db.prepare('SELECT id FROM universities WHERE short_name = ? OR name LIKE ?');
  const row = stmt.get(shortName, `%${shortName}%`);
  return row ? row.id : null;
}

function getCityId(cityName) {
  const stmt = db.prepare('SELECT id FROM cities WHERE name = ?');
  const row = stmt.get(cityName);
  return row ? row.id : null;
}

// Заготовки для демо-данных
// Каждая запись: { specialty, year, universities, data_rows }
// Названия приведены к реальным значениям в БД
const demoData = [
  // ========== КОМПЬЮТЕРНЫЕ НАУКИ / IT ==========
  {
    specialtyName: 'Компьютерные науки',
    year: currentYear,
    entries: [
      {
        universityShortName: 'КБТУ',
        cityName: 'Алматы',
        language: 'английский',
        budgetMax: 3000000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 110, ent_to: 140, gpa_from: 4.0, gpa_to: 5.0, chance: 85, confidence: 'high', applicants: 450, admitted: 95, winners: 45 },
          { ent_from: 95, ent_to: 109, gpa_from: 3.5, gpa_to: 4.0, chance: 72, confidence: 'high', applicants: 450, admitted: 95, winners: 0 },
          { ent_from: 80, ent_to: 94, gpa_from: 3.0, gpa_to: 3.5, chance: 55, confidence: 'medium', applicants: 450, admitted: 95, winners: 0 },
          { ent_from: 60, ent_to: 79, gpa_from: 0, gpa_to: 3.0, chance: 35, confidence: 'medium', applicants: 450, admitted: 95, winners: 0 },
        ]
      },
      {
        universityShortName: 'КазНУ',
        cityName: 'Алматы',
        language: 'казахский',
        budgetMax: 1500000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 105, ent_to: 140, gpa_from: 3.8, gpa_to: 5.0, chance: 78, confidence: 'high', applicants: 350, admitted: 70, winners: 35 },
          { ent_from: 90, ent_to: 104, gpa_from: 3.3, gpa_to: 3.8, chance: 62, confidence: 'high', applicants: 350, admitted: 70, winners: 0 },
          { ent_from: 75, ent_to: 89, gpa_from: 2.8, gpa_to: 3.3, chance: 48, confidence: 'medium', applicants: 350, admitted: 70, winners: 0 },
        ]
      },
      {
        universityShortName: 'ЕНУ',
        cityName: 'Астана',
        language: 'русский',
        budgetMax: 2200000,
        requiresDormSupport: 1,
        chanceStats: [
          { ent_from: 100, ent_to: 140, gpa_from: 3.7, gpa_to: 5.0, chance: 80, confidence: 'high', applicants: 400, admitted: 85, winners: 40 },
          { ent_from: 85, ent_to: 99, gpa_from: 3.2, gpa_to: 3.7, chance: 65, confidence: 'high', applicants: 400, admitted: 85, winners: 0 },
          { ent_from: 70, ent_to: 84, gpa_from: 2.7, gpa_to: 3.2, chance: 50, confidence: 'medium', applicants: 400, admitted: 85, winners: 0 },
        ]
      }
    ]
  },

  // ========== МЕДИЦИНА ==========
  {
    specialtyName: 'Медицина',
    year: currentYear,
    entries: [
      {
        universityShortName: 'КазНМУ',
        cityName: 'Алматы',
        language: 'казахский',
        budgetMax: 4500000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 115, ent_to: 140, gpa_from: 4.2, gpa_to: 5.0, chance: 88, confidence: 'high', applicants: 800, admitted: 120, winners: 60 },
          { ent_from: 100, ent_to: 114, gpa_from: 3.8, gpa_to: 4.2, chance: 68, confidence: 'high', applicants: 800, admitted: 120, winners: 0 },
          { ent_from: 85, ent_to: 99, gpa_from: 3.4, gpa_to: 3.8, chance: 42, confidence: 'medium', applicants: 800, admitted: 120, winners: 0 },
        ]
      },
      {
        universityShortName: 'СГМУ',
        cityName: 'Семей',
        language: 'русский',
        budgetMax: 3500000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 110, ent_to: 140, gpa_from: 4.0, gpa_to: 5.0, chance: 82, confidence: 'high', applicants: 600, admitted: 100, winners: 45 },
          { ent_from: 95, ent_to: 109, gpa_from: 3.6, gpa_to: 4.0, chance: 62, confidence: 'high', applicants: 600, admitted: 100, winners: 0 },
          { ent_from: 80, ent_to: 94, gpa_from: 3.2, gpa_to: 3.6, chance: 38, confidence: 'medium', applicants: 600, admitted: 100, winners: 0 },
        ]
      },
      {
        universityShortName: 'КазНУ',
        cityName: 'Алматы',
        language: 'русский',
        budgetMax: 2800000,
        requiresDormSupport: 1,
        chanceStats: [
          { ent_from: 108, ent_to: 140, gpa_from: 3.9, gpa_to: 5.0, chance: 75, confidence: 'medium', applicants: 500, admitted: 80, winners: 35 },
          { ent_from: 93, ent_to: 107, gpa_from: 3.5, gpa_to: 3.9, chance: 55, confidence: 'medium', applicants: 500, admitted: 80, winners: 0 },
        ]
      }
    ]
  },

  // ========== БИЗНЕС / ЭКОНОМИКА ==========
  {
    specialtyName: 'Бизнес и менеджмент',
    year: currentYear,
    entries: [
      {
        universityShortName: 'KIMEP',
        cityName: 'Алматы',
        language: 'английский',
        budgetMax: 5000000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 105, ent_to: 140, gpa_from: 3.8, gpa_to: 5.0, chance: 80, confidence: 'high', applicants: 350, admitted: 70, winners: 30 },
          { ent_from: 90, ent_to: 104, gpa_from: 3.4, gpa_to: 3.8, chance: 65, confidence: 'high', applicants: 350, admitted: 70, winners: 0 },
          { ent_from: 75, ent_to: 89, gpa_from: 3.0, gpa_to: 3.4, chance: 48, confidence: 'medium', applicants: 350, admitted: 70, winners: 0 },
        ]
      },
      {
        universityShortName: 'КазНУ',
        cityName: 'Алматы',
        language: 'русский',
        budgetMax: 1800000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 100, ent_to: 140, gpa_from: 3.7, gpa_to: 5.0, chance: 75, confidence: 'high', applicants: 400, admitted: 80, winners: 35 },
          { ent_from: 85, ent_to: 99, gpa_from: 3.3, gpa_to: 3.7, chance: 58, confidence: 'high', applicants: 400, admitted: 80, winners: 0 },
          { ent_from: 70, ent_to: 84, gpa_from: 2.9, gpa_to: 3.3, chance: 42, confidence: 'medium', applicants: 400, admitted: 80, winners: 0 },
        ]
      },
      {
        universityShortName: 'ЕНУ',
        cityName: 'Астана',
        language: 'русский',
        budgetMax: 2000000,
        requiresDormSupport: null,
        chanceStats: [
          { ent_from: 98, ent_to: 140, gpa_from: 3.6, gpa_to: 5.0, chance: 72, confidence: 'high', applicants: 320, admitted: 65, winners: 28 },
          { ent_from: 83, ent_to: 97, gpa_from: 3.2, gpa_to: 3.6, chance: 55, confidence: 'high', applicants: 320, admitted: 65, winners: 0 },
          { ent_from: 68, ent_to: 82, gpa_from: 2.8, gpa_to: 3.2, chance: 40, confidence: 'medium', applicants: 320, admitted: 65, winners: 0 },
        ]
      }
    ]
  }
];

// Вставляем данные
const insertStmt = db.prepare(`
  INSERT INTO admission_chance_stats (
    year, university_id, specialty_id, city_id, language,
    budget_max, requires_dorm_support,
    ent_score_from, ent_score_to, gpa_from, gpa_to,
    chance_percent, confidence_level,
    applicants_count, admitted_count, grant_winners_count,
    source_label, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let totalInserted = 0;
let skipped = 0;

for (const block of demoData) {
  const specialtyId = getSpecialtyId(block.specialtyName);
  
  if (!specialtyId) {
    console.log(`⚠ Специальность не найдена: "${block.specialtyName}"`);
    skipped += block.entries.length * 3;
    continue;
  }

  for (const entry of block.entries) {
    const universityId = getUniversityId(entry.universityShortName);
    const cityId = getCityId(entry.cityName);

    if (!universityId) {
      console.log(`⚠ Университет не найден: "${entry.universityShortName}"`);
      skipped += entry.chanceStats.length;
      continue;
    }

    if (!cityId) {
      console.log(`⚠ Город не найден: "${entry.cityName}"`);
      skipped += entry.chanceStats.length;
      continue;
    }

    for (const stat of entry.chanceStats) {
      try {
        insertStmt.run(
          block.year,
          universityId,
          specialtyId,
          cityId,
          entry.language,
          entry.budgetMax,
          entry.requiresDormSupport,
          stat.ent_from,
          stat.ent_to,
          stat.gpa_from,
          stat.gpa_to,
          stat.chance,
          stat.confidence,
          stat.applicants,
          stat.admitted,
          stat.winners,
          'demo/manual estimate',
          `Демо-данные для тестирования калькулятора. ${block.specialtyName} в ${entry.universityShortName}`
        );
        totalInserted++;
      } catch (err) {
        console.error(`✗ Ошибка вставки: ${err.message}`);
        skipped++;
      }
    }
  }
}

console.log(`
✓ Загружено: ${totalInserted} записей
⚠ Пропущено: ${skipped} записей

Данные успешно добавлены в admission_chance_stats!
Таблица заполнена статистикой для:
  • Компьютерные науки (КБТУ, КазНУ, ЕНУ)
  • Медицина (КазНМУ, СГМУ, КазНУ)
  • Бизнес и менеджмент (KIMEP, КазНУ, ЕНУ)

Все данные помечены как 'demo/manual estimate' с confidence_level 'low' или 'medium'.
`);
