require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'edumatch.db'));

// Inline callOpenRouter to avoid loading full ai-service
async function callLLM(systemPrompt, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const KK_SYSTEM = `Ты профессиональный переводчик для казахстанской образовательной платформы.
Переведи описание университета с русского на казахский язык.
Сохрани ключевые факты (год основания, количество студентов, факультеты, достижения).
Стиль: профессиональный, информативный. 2-4 предложения.
Ответ ТОЛЬКО переводом, без кавычек и пояснений.`;

const EN_SYSTEM = `You are a professional translator for a Kazakh educational platform.
Translate the university description from Russian to English.
Preserve key facts (founding year, student count, faculties, achievements).
Style: professional, informative. 2-4 sentences.
Answer with ONLY the translation, no quotes or explanations.`;

async function main() {
  const rows = db.prepare(`
    SELECT id, name, description, founded, students_count, city_id
    FROM universities 
    WHERE description IS NOT NULL AND description != ''
    AND (description_kk IS NULL OR description_en IS NULL)
    ORDER BY id
  `).all();

  console.log(`Found ${rows.length} universities to translate\n`);

  const update = db.prepare('UPDATE universities SET description_kk = ?, description_en = ? WHERE id = ?');
  let done = 0, errors = 0;

  for (const row of rows) {
    try {
      const desc = row.description;
      const meta = `(${row.name?.trim()}, основана: ${row.founded || '?'}, студентов: ${row.students_count || '?'})`;
      const prompt = `${desc}\n\n${meta}`;

      const [kk, en] = await Promise.all([
        callLLM(KK_SYSTEM, prompt),
        callLLM(EN_SYSTEM, prompt),
      ]);

      if (kk && en) {
        update.run(kk, en, row.id);
        done++;
        console.log(`  ✓ ${row.id}: ${row.name?.trim()?.slice(0, 50)}`);
      } else {
        errors++;
        console.log(`  ✗ ${row.id}: empty response`);
      }

      // Rate limit: 200ms between batches
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      errors++;
      console.log(`  ✗ ${row.id}: ${e.message?.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone: ${done} translated, ${errors} errors`);
  db.close();
}

main().catch(console.error);
