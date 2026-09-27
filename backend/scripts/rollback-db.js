const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2] && path.resolve(process.argv[2]);
const dbPath = path.join(__dirname, '..', 'edumatch.db');
const backupDir = path.join(__dirname, '..', 'backups');

if (!sourcePath) {
  throw new Error('Usage: node scripts/rollback-db.js <backup-file>');
}
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Backup not found: ${sourcePath}`);
}

const source = new Database(sourcePath, { readonly: true });
try {
  const integrity = source.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    throw new Error(`Backup integrity check failed: ${integrity}`);
  }
} finally {
  source.close();
}

fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const safetyCopy = path.join(backupDir, `before-rollback-${timestamp}.db`);
fs.copyFileSync(dbPath, safetyCopy);
fs.copyFileSync(sourcePath, dbPath);

const restored = new Database(dbPath, { readonly: true });
try {
  const integrity = restored.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    fs.copyFileSync(safetyCopy, dbPath);
    throw new Error(`Restored database integrity check failed: ${integrity}`);
  }
} finally {
  restored.close();
}

console.log(`Database restored from: ${sourcePath}`);
console.log(`Safety copy kept at: ${safetyCopy}`);
