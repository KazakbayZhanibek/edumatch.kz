const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'edumatch.db');
const backupDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(dbPath)) {
  throw new Error(`Database not found: ${dbPath}`);
}

fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `edumatch-${timestamp}.db`);
async function main() {
  const db = new Database(dbPath, { readonly: true });

  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`Integrity check failed: ${integrity}`);
    }
    await db.backup(backupPath);
  } finally {
    db.close();
  }

  const size = fs.statSync(backupPath).size;
  console.log(`Backup created: ${backupPath}`);
  console.log(`Size: ${size} bytes`);
}

main().catch(error => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
