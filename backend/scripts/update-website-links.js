/**
 * Update universities.website from universities_links.jsonl
 * Only updates the website column — schema and other fields are untouched.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const JSONL_PATH = path.join(__dirname, 'data', 'universities_links.jsonl');
const db = new Database(path.join(__dirname, 'edumatch.db'));

function pickWebsite(entry) {
  if (entry.official_website) return entry.official_website;

  const links = entry.links || [];
  if (!links.length) return null;

  const official = links.find((link) => {
    const title = (link.title || '').toLowerCase();
    return title.includes('official') || title.includes('официальн');
  });
  if (official?.url) return official.url;

  return links[0]?.url || null;
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, '')}`;
}

function loadLinks() {
  const raw = fs.readFileSync(JSONL_PATH, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const entries = loadLinks();
const updateStmt = db.prepare('UPDATE universities SET website = ? WHERE id = ?');
const getStmt = db.prepare('SELECT id, short_name, name, website FROM universities WHERE id = ?');

console.log('Updating website links from JSONL...\n');

let updated = 0;
let skipped = 0;
let missingInDb = 0;

const tx = db.transaction(() => {
  for (const entry of entries) {
    const url = normalizeUrl(pickWebsite(entry));
    const existing = getStmt.get(entry.id);

    if (!existing) {
      console.log(`⚠ Not in DB: id=${entry.id} ${entry.short_name}`);
      missingInDb++;
      continue;
    }

    if (!url) {
      if (existing.website) {
        updateStmt.run(null, entry.id);
        console.log(`- Cleared (no URL in file): id=${entry.id} ${entry.short_name}`);
      } else {
        console.log(`- Skipped (no URL): id=${entry.id} ${entry.short_name}`);
      }
      skipped++;
      continue;
    }

    updateStmt.run(url, entry.id);
    const changed = existing.website !== url ? 'updated' : 'unchanged';
    console.log(`✓ ${entry.id} ${entry.short_name}: ${url} (${changed})`);
    updated++;
  }
});

tx();

const stats = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN website LIKE 'http%' THEN 1 ELSE 0 END) AS with_url
  FROM universities
`).get();

console.log('\nSummary');
console.log(`  Processed: ${entries.length}`);
console.log(`  Updated rows: ${updated}`);
console.log(`  Skipped (no URL in file): ${skipped}`);
console.log(`  Missing in DB: ${missingInDb}`);
console.log(`  DB with http(s) URLs: ${stats.with_url}/${stats.total}`);

db.close();
