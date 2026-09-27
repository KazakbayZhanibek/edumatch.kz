/**
 * SQLite Backup Script
 * Run: node scripts/backup.js
 * Or schedule via cron: 0 2 * * * cd /path/to/backend && node scripts/backup.js
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DB_PATH = path.join(__dirname, '..', 'edumatch.db');
const MAX_BACKUPS = 7; // Keep last 7 backups

function createBackup() {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `edumatch-${timestamp}.db`);

  try {
    const db = getDb();

    // Use SQLite backup API via VACUUM INTO
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const stats = fs.statSync(backupPath);
    console.log(`✓ Backup created: ${backupPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Cleanup old backups
    cleanupOldBackups();

    return { success: true, path: backupPath, size: stats.size };
  } catch (error) {
    console.error('✗ Backup failed:', error.message);
    return { success: false, error: error.message };
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('edumatch-') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      for (const file of files.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
        console.log(`  Removed old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('edumatch-') && f.endsWith('.db'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stats.size, date: stats.mtime };
    })
    .sort((a, b) => b.date - a.date);
}

// Run if called directly
if (require.main === module) {
  const action = process.argv[2];
  if (action === 'list') {
    const backups = listBackups();
    console.log(`Found ${backups.length} backups:`);
    backups.forEach(b => console.log(`  ${b.name} (${(b.size / 1024).toFixed(1)} KB) - ${b.date.toLocaleString()}`));
  } else {
    createBackup();
  }
}

module.exports = { createBackup, listBackups };
