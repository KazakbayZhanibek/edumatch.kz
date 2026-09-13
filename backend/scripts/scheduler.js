/**
 * scheduler.js — Auto backups + error monitoring
 * Run: node scripts/scheduler.js
 * Or as a service: pm2 start scripts/scheduler.js --name edumatch-scheduler
 */

const fs = require('fs');
const path = require('path');
const { createBackup } = require('./backup');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'errors.log');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ─── ERROR MONITORING ──────────────────────────────

function logError(source, error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    source,
    message: error.message || String(error),
    stack: error.stack || null,
    context,
  };

  fs.appendFileSync(ERROR_LOG, JSON.stringify(entry) + '\n');

  // Console output for development
  console.error(`[ERROR] ${source}: ${entry.message}`);

  // Check for critical errors
  const criticalPatterns = ['ECONNREFUSED', 'SQLITE_CORRUPT', 'ENOSPC', 'ENOMEM'];
  if (criticalPatterns.some(p => entry.message.includes(p))) {
    console.error(`[CRITICAL] ${source}: ${entry.message}`);
    // In production: send alert (email, Telegram, etc.)
  }
}

function logAccess(req, res, responseTime) {
  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: res.statusCode,
    responseTime: responseTime + 'ms',
    ip: req.ip,
    userId: req.userId || null,
  };

  fs.appendFileSync(ACCESS_LOG, JSON.stringify(entry) + '\n');
}

// ─── SCHEDULED TASKS ──────────────────────────────

const TASKS = {
  // Daily backup at 2:00 AM
  backup: {
    schedule: '0 2 * * *',
    lastRun: null,
    run: () => {
      console.log('[SCHEDULER] Running daily backup...');
      const result = createBackup();
      if (result.success) {
        console.log(`[SCHEDULER] Backup complete: ${result.path}`);
      } else {
        console.error(`[SCHEDULER] Backup failed: ${result.error}`);
      }
    }
  },

  // Cleanup old logs weekly
  cleanup_logs: {
    schedule: '0 3 * * 0',
    lastRun: null,
    run: () => {
      console.log('[SCHEDULER] Cleaning up old logs...');
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      for (const logFile of [ERROR_LOG, ACCESS_LOG]) {
        if (!fs.existsSync(logFile)) continue;
        const stats = fs.statSync(logFile);
        if (Date.now() - stats.mtimeMs > maxAge) {
          fs.unlinkSync(logFile);
          console.log(`  Removed old log: ${logFile}`);
        }
      }
    }
  },

  // Cleanup expired rate limits hourly
  cleanup_rateLimits: {
    schedule: '0 * * * *',
    lastRun: null,
    run: () => {
      try {
        const { getDb } = require('../database');
        const db = getDb();
        const result = db.prepare("DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour')").run();
        if (result.changes > 0) console.log(`[SCHEDULER] Cleaned ${result.changes} expired rate limits`);
      } catch (e) {
        // Table might not exist yet
      }
    }
  },
};

function shouldRun(task, now) {
  if (!task.schedule) return false;
  const [min, hour, dom, mon, dow] = task.schedule.split(' ');
  const currentMin = now.getMinutes();
  const currentHour = now.getHours();
  const currentDom = now.getDate();
  const currentMon = now.getMonth() + 1;
  const currentDow = now.getDay();

  if (min !== '*' && parseInt(min) !== currentMin) return false;
  if (hour !== '*' && parseInt(hour) !== currentHour) return false;
  if (dom !== '*' && parseInt(dom) !== currentDom) return false;
  if (mon !== '*' && parseInt(mon) !== currentMon) return false;
  if (dow !== '*' && parseInt(dow) !== currentDow) return false;

  return true;
}

function runScheduler() {
  const now = new Date();
  for (const [name, task] of Object.entries(TASKS)) {
    if (shouldRun(task, now)) {
      const lastRunKey = `${name}_${now.toDateString()}`;
      if (task.lastRun === lastRunKey) continue;
      task.lastRun = lastRunKey;
      try {
        task.run();
      } catch (error) {
        logError('scheduler', error, { task: name });
      }
    }
  }
}

// Check every minute
if (require.main === module) {
  console.log('[SCHEDULER] Starting scheduler...');
  setInterval(runScheduler, 60000);
  runScheduler(); // Run immediately

  // Graceful shutdown
  process.on('SIGTERM', () => { console.log('[SCHEDULER] Shutting down...'); process.exit(0); });
  process.on('SIGINT', () => { console.log('[SCHEDULER] Shutting down...'); process.exit(0); });
}

module.exports = { logError, logAccess, runScheduler };
