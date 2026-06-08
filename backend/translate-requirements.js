/**
 * Translate grant requirements arrays to KK and EN
 * Batches 15 grants per API call
 */
require('dotenv').config();
const fetch = (require('node-fetch').default || require('node-fetch'));
const { initDatabase, getDb } = require('./database');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'gpt-3.5-turbo';
const BATCH_SIZE = 15;
const DELAY_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translateBatch(items, targetLang) {
  const langName = targetLang === 'kk' ? 'Kazakh' : 'English';
  const listStr = items.map((g, i) => `[${i}] ${g.requirements}`).join('\n');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'EduMatch KZ Requirements Translator',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Translate each JSON array of requirements to ${langName}. Return ONLY a valid JSON array of arrays, same order. Example input: [["ЕНТ: 100+"],["Бюджетных мест: 0"]] → output: [["ENT: 100+"],["Budget seats: 0"]]`
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
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response');
  return JSON.parse(match[0]);
}

async function main() {
  initDatabase();
  const db = getDb();

  const allGrants = db.prepare("SELECT id, requirements, requirements_kk, requirements_en FROM grants WHERE requirements IS NOT NULL AND requirements != '[]'").all();
  console.log(`Grants with requirements: ${allGrants.length}\n`);

  for (const lang of ['kk', 'en']) {
    const langName = lang.toUpperCase();
    const needsTranslation = allGrants.filter(g => {
      if (lang === 'kk') return !g.requirements_kk;
      return !g.requirements_en;
    });

    console.log(`\n=== ${langName}: ${needsTranslation.length} grants to translate ===`);

    for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(needsTranslation.length / BATCH_SIZE);

      try {
        const translated = await translateBatch(batch, lang);

        for (let j = 0; j < batch.length; j++) {
          const grant = batch[j];
          const t = translated[j];
          if (t && Array.isArray(t)) {
            const col = lang === 'kk' ? 'requirements_kk' : 'requirements_en';
            db.prepare(`UPDATE grants SET ${col} = ? WHERE id = ?`)
              .run(JSON.stringify(t), grant.id);
          }
        }
        console.log(`  [${langName}] Batch ${batchNum}/${totalBatches} ✓`);
      } catch (e) {
        console.error(`  [${langName}] Batch ${batchNum}/${totalBatches} ✗ ${e.message}`);
      }
      await sleep(DELAY_MS);
    }
  }

  const kk = db.prepare("SELECT COUNT(*) as c FROM grants WHERE requirements_kk IS NOT NULL AND requirements_kk != ''").get().c;
  const en = db.prepare("SELECT COUNT(*) as c FROM grants WHERE requirements_en IS NOT NULL AND requirements_en != ''").get().c;
  console.log(`\nDone! KK: ${kk}/${allGrants.length} | EN: ${en}/${allGrants.length}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
