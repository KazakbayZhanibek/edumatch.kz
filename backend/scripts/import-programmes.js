const fs = require('fs');
const path = require('path');
const { getDb, closeDb } = require('../database');
const { importProgrammes } = require('../programme-store');

const input = process.argv[2] ? path.resolve(process.argv[2]) : null;
const apply = process.argv.includes('--apply');
if (!input || !fs.existsSync(input)) {
  console.error('Usage: node scripts/import-programmes.js <programmes.json> [--apply]');
  process.exit(1);
}

try {
  const records = JSON.parse(fs.readFileSync(input, 'utf8'));
  const result = importProgrammes(getDb(), records, { sourceFile: path.basename(input), apply });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
  else if (!apply) console.log('Dry run only. Add --apply after reviewing the report.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closeDb();
}
