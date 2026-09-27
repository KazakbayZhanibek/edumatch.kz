const Database = require('better-sqlite3');
const path = require('path');
const { rejectionReason } = require('../admission-stat-quality');

const expectedYear = process.env.ACADEMIC_YEAR || '2026-2027';
const db = new Database(path.join(__dirname, '..', 'edumatch.db'), { readonly: true });
let failed = false;

function report(label, value) {
  console.log(`${label}: ${value}`);
}

try {
  const integrity = db.pragma('integrity_check', { simple: true });
  report('Integrity', integrity);
  if (integrity !== 'ok') failed = true;

  const requirements = db.prepare('SELECT academic_year, COUNT(*) AS count FROM admission_requirements GROUP BY academic_year').all();
  const grants = db.prepare('SELECT academic_year, COUNT(*) AS count FROM grants GROUP BY academic_year').all();
  const stats = db.prepare('SELECT year, source_label, COUNT(*) AS count FROM admission_chance_stats GROUP BY year, source_label').all();
  report('Admission requirement years', JSON.stringify(requirements));
  report('Grant years', JSON.stringify(grants));
  report('Admission stats sources', JSON.stringify(stats));

  if (requirements.some(row => row.academic_year !== expectedYear)) {
    console.error(`FAIL: admission_requirements must be verified for ${expectedYear}`);
    failed = true;
  }
  if (grants.some(row => row.academic_year !== expectedYear)) {
    console.error(`FAIL: grants must be verified for ${expectedYear}`);
    failed = true;
  }
  const rejected = {};
  for (const row of db.prepare('SELECT source_label, source_url FROM admission_chance_stats').all()) {
    const reason = rejectionReason(row);
    if (reason) rejected[reason] = (rejected[reason] || 0) + 1;
  }
  report('Rejected admission statistics', JSON.stringify(rejected));
  if (Object.keys(rejected).length) {
    console.error('FAIL: admission statistics contain synthetic, unverified or unsourced records');
    failed = true;
  }
} finally {
  db.close();
}

if (failed) {
  console.error('MVP data audit failed. Update data from official sources before deployment.');
  process.exit(1);
}

console.log('MVP data audit passed.');
