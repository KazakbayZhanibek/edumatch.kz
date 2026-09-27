const Database = require('better-sqlite3');
const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function getQSRankings() {
  // Источник: topuniversities.com - страница Казахстана
  const url = 'https://www.topuniversities.com/universities/country/kazakhstan';
  console.log('Fetching QS rankings from: ' + url);
  
  const html = await fetchPage(url);
  
  // Парсим рейтинги из HTML
  // QS страница содержит JSON-LD или data-атрибуты
  const universities = [];
  
  // Паттерн: название вуза + рейтинг
  const patterns = [
    // Паттерн для QS страницы с рейтингами
    /class="[^"]*uni-name[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*rank[^"]*"[^>]*>(\d+)/gi,
    // Альтернативный паттерн
    /"name"\s*:\s*"([^"]+)"[\s\S]*?"rank"\s*:\s*"?(\d+)/gi,
  ];

  // Также пробуем другой URL
  const url2 = 'https://www.topuniversities.com/destination/kazakhstan';
  console.log('Trying alternative URL: ' + url2);
  
  try {
    const html2 = await fetchPage(url2);
    // Ищем все упоминания казахстанских вузов с рейтингами
    const match = html2.match(/universityData\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      const data = JSON.parse(match[1]);
      data.forEach(u => {
        if (u.rank && u.name) {
          universities.push({ name: u.name, rank: parseInt(u.rank) });
        }
      });
    }
  } catch (e) {
    console.log('Alternative URL failed: ' + e.message);
  }

  return universities;
}

async function main() {
  const db = new Database('edumatch.db');
  
  console.log('=== QS Rankings Updater ===\n');

  // Способ 1: Через веб-скрапинг
  let rankings = [];
  try {
    rankings = await getQSRankings();
  } catch (e) {
    console.log('Web scraping failed: ' + e.message);
  }

  if (rankings.length === 0) {
    console.log('\nWeb scraping did not return results.');
    console.log('Use manual update mode.\n');
    
    // Способ 2: Ручной ввод - показываем текущие рейтинги для проверки
    console.log('=== CURRENT QS RANKINGS IN DB ===');
    const current = db.prepare('SELECT id, short_name, qs_world FROM universities WHERE qs_world IS NOT NULL ORDER BY qs_world').all();
    current.forEach(r => console.log(r.id + ' | ' + r.short_name + ' | QS #' + r.qs_world));
    
    console.log('\nTo update manually, edit update-qs-manual.js with new values and run it.');
  } else {
    console.log('\nFound ' + rankings.length + ' rankings');
    
    // Matching with DB
    const updateStmt = db.prepare("UPDATE universities SET qs_world = ?, last_updated_at = datetime('now') WHERE id = ?");
    
    let updated = 0;
    for (const r of rankings) {
      // Try to match by name
      const dbUni = db.prepare("SELECT id FROM universities WHERE name LIKE ? OR short_name LIKE ?").get(
        '%' + r.name.substring(0, 10) + '%',
        '%' + r.name.substring(0, 10) + '%'
      );
      if (dbUni) {
        updateStmt.run(r.rank, dbUni.id);
        console.log('Updated: ' + r.name + ' → QS #' + r.rank);
        updated++;
      }
    }
    console.log('\nUpdated ' + updated + ' universities');
  }

  db.close();
}

main().catch(console.error);
