/**
 * Translate university descriptions to KK and EN via OpenRouter
 * Run: node translate-descriptions.js
 * Resumable — skips already translated entries
 */
require('dotenv').config();
const { initDatabase, getDb } = require('./database');

const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;

if (!fetch) {
  console.error('fetch is not available');
  process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'gpt-3.5-turbo';
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translate(text, targetLang) {
  const langName = targetLang === 'kk' ? 'Kazakh' : 'English';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'EduMatch KZ Translator',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following university description to ${langName}. Keep the same tone and meaning. Do NOT add any extra text, just the translation.`
        },
        { role: 'user', content: text }
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function main() {
  initDatabase();
  const db = getDb();

  const universities = db.prepare(`
    SELECT id, short_name, description, description_kk, description_en
    FROM universities
    WHERE description IS NOT NULL AND description != ''
  `).all();

  console.log(`Found ${universities.length} universities with descriptions\n`);

  let translatedKK = 0;
  let translatedEN = 0;
  let skippedKK = 0;
  let skippedEN = 0;

  for (const uni of universities) {
    // Translate to KK
    if (!uni.description_kk) {
      try {
        const kk = await translate(uni.description, 'kk');
        db.prepare('UPDATE universities SET description_kk = ? WHERE id = ?').run(kk, uni.id);
        translatedKK++;
        console.log(`  [KK] ${uni.short_name} ✓`);
      } catch (e) {
        console.error(`  [KK] ${uni.short_name} ✗ ${e.message}`);
      }
      await sleep(DELAY_MS);
    } else {
      skippedKK++;
    }

    // Translate to EN
    if (!uni.description_en) {
      try {
        const en = await translate(uni.description, 'en');
        db.prepare('UPDATE universities SET description_en = ? WHERE id = ?').run(en, uni.id);
        translatedEN++;
        console.log(`  [EN] ${uni.short_name} ✓`);
      } catch (e) {
        console.error(`  [EN] ${uni.short_name} ✗ ${e.message}`);
      }
      await sleep(DELAY_MS);
    } else {
      skippedEN++;
    }
  }

  console.log(`\nDone! KK: ${translatedKK} translated, ${skippedKK} skipped | EN: ${translatedEN} translated, ${skippedEN} skipped`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
