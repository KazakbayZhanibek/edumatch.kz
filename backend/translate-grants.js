/**
 * Batch translate grant names + descriptions via OpenRouter
 * Run: node translate-grants.js
 * Resumable — skips already translated entries
 * Batches 10 grants per API call to reduce requests (351 → ~70 calls)
 */
require('dotenv').config();
const fetch = (require('node-fetch').default || require('node-fetch'));
const { initDatabase, getDb } = require('./database');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'gpt-3.5-turbo';
const BATCH_SIZE = 10;
const DELAY_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translateBatch(items, targetLang) {
  const langName = targetLang === 'kk' ? 'Kazakh' : 'English';

  const listStr = items.map((g, i) => `[${i}] name: "${g.name}"\ndescription: "${g.description || ''}"`).join('\n\n');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'EduMatch KZ Grants Translator',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate each grant entry to ${langName}. For each entry, translate both the name and description. Return ONLY valid JSON array with objects containing "name" and "description" fields, maintaining the same order. Do NOT add any extra text.`
        },
        { role: 'user', content: listStr }
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';

  // Try to extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response');

  return JSON.parse(match[0]);
}

async function main() {
  initDatabase();
  const db = getDb();

  // Get all grants that need translation
  const allGrants = db.prepare('SELECT id, name, description, name_kk, name_en, description_kk, description_en FROM grants').all();

  console.log(`Total grants: ${allGrants.length}\n`);

  for (const lang of ['kk', 'en']) {
    const langName = lang.toUpperCase();
    console.log(`\n=== Translating to ${langName} ===\n`);

    // Filter grants that need translation for this language
    const needsTranslation = allGrants.filter(g => {
      if (lang === 'kk') return !g.name_kk || !g.description_kk;
      return !g.name_en || !g.description_en;
    });

    console.log(`Grants needing ${langName}: ${needsTranslation.length}`);

    if (!needsTranslation.length) {
      console.log(`All grants already translated to ${langName}`);
      continue;
    }

    // Process in batches
    for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(needsTranslation.length / BATCH_SIZE);

      try {
        const translated = await translateBatch(batch, lang);

        // Update DB
        for (let j = 0; j < batch.length; j++) {
          const grant = batch[j];
          const t = translated[j];
          if (t) {
            if (lang === 'kk') {
              db.prepare('UPDATE grants SET name_kk = ?, description_kk = ? WHERE id = ?')
                .run(t.name || grant.name, t.description || grant.description, grant.id);
            } else {
              db.prepare('UPDATE grants SET name_en = ?, description_en = ? WHERE id = ?')
                .run(t.name || grant.name, t.description || grant.description, grant.id);
            }
          }
        }

        const names = batch.map(g => g.short_name || g.name?.substring(0, 20)).join(', ');
        console.log(`  [${langName}] Batch ${batchNum}/${totalBatches} ✓ (${batch.length} grants)`);
      } catch (e) {
        console.error(`  [${langName}] Batch ${batchNum}/${totalBatches} ✗ ${e.message}`);
      }

      await sleep(DELAY_MS);
    }
  }

  // Final count
  const kk = db.prepare("SELECT COUNT(*) as c FROM grants WHERE name_kk IS NOT NULL AND name_kk != ''").get().c;
  const en = db.prepare("SELECT COUNT(*) as c FROM grants WHERE name_en IS NOT NULL AND name_en != ''").get().c;
  console.log(`\nDone! KK: ${kk}/${allGrants.length} | EN: ${en}/${allGrants.length}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
