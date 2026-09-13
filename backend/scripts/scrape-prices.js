const Database = require('better-sqlite3');
const https = require('https');
const http = require('http');

// Список вузов с URL страницы прайса и CSS-селектором (или регуляркой)
// Каждый entry: { id, name, priceUrl, pattern } 
// pattern — регулярка для поиска цены на странице
const universityPrices = [
  {
    id: 2, name: 'КазНУ им. аль-Фараби',
    priceUrl: 'https://welcome.kaznu.kz/ru/26818/page',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi, /стоимость[^:]*:\s*(\d[\d\s]*)/gi],
    extract: 'regex'
  },
  {
    id: 3, name: 'ЕНУ им. Гумилева',
    priceUrl: 'https://enu.kz/ru/9572/page',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 11, name: 'Satbayev University',
    priceUrl: 'https://satbayev.university/ru/admission/bachelor',
    patterns: [/от\s*(\d[\d\s]*)\s*(₸|тенге)/gi, /(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 32, name: 'КБТУ',
    priceUrl: 'https://kbtu.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT|美元|\$)/gi],
    extract: 'regex'
  },
  {
    id: 4, name: 'КазАТУ',
    priceUrl: 'https://www.kazatu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 19, name: 'КНПУ им. Абая',
    priceUrl: 'https://kaznpu.kz/ru/5650/page',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 36, name: 'КазНМУ',
    priceUrl: 'https://kaznmu.edu.kz/ru/page/stoimost-obucheniya',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 23, name: 'АТУ',
    priceUrl: 'https://atu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 25, name: 'МУИТ',
    priceUrl: 'https://iitu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 158, name: 'Нархоз',
    priceUrl: 'https://narxoz.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 44, name: 'KIMEP',
    priceUrl: 'https://kimep.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT|\$)/gi],
    extract: 'regex'
  },
  {
    id: 13, name: 'ЮКГУ им. Ауэзова',
    priceUrl: 'https://auezov.edu.kz/rus/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 7, name: 'КарГУ им. Букетова',
    priceUrl: 'https://buketov.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 149, name: 'МКТУ им. Ясави',
    priceUrl: 'https://ayu.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 116, name: 'Болашак-Костанай',
    priceUrl: 'https://bolashak-edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 8, name: 'КНАУ',
    priceUrl: 'https://www.kaznaru.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 12, name: 'СГМУ',
    priceUrl: 'https://smu.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 14, name: 'КУ им. Коркыта Ата',
    priceUrl: 'https://korkyt.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 31, name: 'Университет Демиреля',
    priceUrl: 'https://sdu.edu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
  {
    id: 151, name: 'КАЗГЮУ / MNU',
    priceUrl: 'https://kazguu.kz/ru/page/prices',
    patterns: [/(\d[\d\s]*\d)\s*(₸|тенге|KZT)/gi],
    extract: 'regex'
  },
];

function fetchPage(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { 
      timeout,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractPrices(html, patterns) {
  const prices = new Set();
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const numStr = match[1].replace(/\s/g, '');
      const num = parseInt(numStr, 10);
      if (num >= 100000 && num <= 10000000) { // разумный диапазон цен в тенге
        prices.add(num);
      }
    }
  }
  return [...prices].sort((a, b) => a - b);
}

async function main() {
  const db = new Database('edumatch.db');
  
  console.log('=== Price Scraper for EduMatch KZ ===');
  console.log('Checking ' + universityPrices.length + ' universities...\n');

  const results = [];
  let success = 0;
  let failed = 0;

  for (const uni of universityPrices) {
    process.stdout.write(uni.name + '... ');
    try {
      const html = await fetchPage(uni.priceUrl);
      const prices = extractPrices(html, uni.patterns);
      
      const current = db.prepare('SELECT price_from, price_to FROM universities WHERE id = ?').get(uni.id);
      
      if (prices.length > 0) {
        const newFrom = prices[0];
        const newTo = prices[prices.length - 1];
        const changed = current && (current.price_from !== newFrom || current.price_to !== newTo);
        
        results.push({
          id: uni.id,
          name: uni.name,
          current: current ? `${current.price_from}-${current.price_to}` : 'N/A',
          found: `${newFrom}-${newTo}`,
          allPrices: prices,
          changed
        });
        
        if (changed) {
          console.log('CHANGED: ' + current.price_from + '-' + current.price_to + ' → ' + newFrom + '-' + newTo);
        } else {
          console.log('OK (' + newFrom + '-' + newTo + ')');
        }
        success++;
      } else {
        console.log('NO PRICES FOUND');
        results.push({
          id: uni.id,
          name: uni.name,
          current: current ? `${current.price_from}-${current.price_to}` : 'N/A',
          found: null,
          allPrices: [],
          changed: false
        });
        failed++;
      }
    } catch (e) {
      console.log('ERROR: ' + e.message);
      results.push({
        id: uni.id,
        name: uni.name,
        error: e.message
      });
      failed++;
    }
    
    // Пауза между запросами чтобы не забанили
    await new Promise(r => setTimeout(r, 1500));
  }

  // Report
  console.log('\n=== SUMMARY ===');
  console.log('Success: ' + success + ', Failed: ' + failed);
  
  const changed = results.filter(r => r.changed);
  if (changed.length > 0) {
    console.log('\n=== CHANGED PRICES (apply?) ===');
    changed.forEach(r => {
      console.log(r.id + ' | ' + r.name + ': ' + r.current + ' → ' + r.found);
    });
    
    console.log('\nTo apply changes, run:');
    console.log('node scrape-prices.js --apply');
  } else {
    console.log('\nNo price changes detected.');
  }

  // Apply if --apply flag
  if (process.argv.includes('--apply')) {
    const stmt = db.prepare("UPDATE universities SET price_from = ?, price_to = ?, last_updated_at = datetime('now') WHERE id = ?");
    const tx = db.transaction(() => {
      for (const r of changed) {
        stmt.run(r.allPrices[0], r.allPrices[r.allPrices.length - 1], r.id);
        console.log('Applied: ' + r.name + ' → ' + r.found);
      }
    });
    tx();
    console.log('\nApplied ' + changed.length + ' price updates.');
  }

  db.close();
}

main().catch(console.error);
