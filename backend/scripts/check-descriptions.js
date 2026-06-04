const Database = require('better-sqlite3');
const db = new Database('edumatch.db');

// Проверим несколько описаний
const unis = db.prepare('SELECT name, description FROM universities WHERE id IN (1, 2, 3)').all();

console.log('✅ Проверка обновленных описаний:\n');
unis.forEach(u => {
  console.log('📚', u.name);
  console.log('   Описание:', u.description.substring(0, 100) + '...\n');
});

// Подсчитаем непустые описания
const descCount = db.prepare("SELECT COUNT(*) as cnt FROM universities WHERE description AND description <> ''").get();
console.log('📊 Университетов с описаниями:', descCount.cnt);

// Проверим Назарбаев Университет подробнее
const nu = db.prepare('SELECT name, description FROM universities WHERE name LIKE ?').get('%Назарбаев%');
if (nu) {
  console.log('\n🎓 Назарбаев Университет (полное описание):');
  console.log(nu.description);
}

db.close();
