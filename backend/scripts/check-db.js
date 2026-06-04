const Database = require('better-sqlite3');
const db = new Database('edumatch.db');

const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();

console.log('Tables in database:');
tables.forEach(t => console.log('  -', t.name));

// Check if users table exists and has columns
if (tables.some(t => t.name === 'users')) {
  const userColumns = db.pragma('table_info(users)');
  console.log('\nUsers table columns:');
  userColumns.forEach(col => console.log('  -', col.name, `(${col.type})`));
} else {
  console.log('\n❌ Users table NOT FOUND');
}

db.close();
