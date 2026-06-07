const fs = require('fs');
const path = require('path');
const db = require('better-sqlite3')('edumatch.db');

try {
  const filePath = path.join(__dirname, '../../universities_cards.md');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Парсим описания по паттерну: # **Name (Abbr)** ... **О университете:**...
  // Берем ТОЛЬКО текст "О университете", до следующего **Факультеты**
  const uniPattern = /# \*\*([^(]+)\(([^)]+)\)\*\*[\s\S]*?\*\*О университете:\*\*\s*([\s\S]*?)(?:\*\*Факультеты|# \*\*|$)/g;
  
  let match;
  let updateCount = 0;
  
  const updateUni = db.prepare(`
    UPDATE universities 
    SET description = ?
    WHERE LOWER(name) LIKE LOWER(?)
  `);
  
  while ((match = uniPattern.exec(content)) !== null) {
    const uniName = match[1].trim();
    let description = match[3].trim();
    
    // Удаляем лишние переносы и форматирование
    description = description
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('**'))
      .join(' ')
      .replace(/\*\*/g, '') // Удаляем ** (жирный)
      .replace(/\*/g, '') // Удаляем * (курсив и одиночные звездочки)
      .replace(/\s+/g, ' ') // Нормализуем пробелы
      .trim()
      .slice(0, 1000); // Ограничиваем до 1000 символов
    
    // Ищем вуз по названию
    const result = updateUni.run(description, '%' + uniName + '%');
    
    if (result.changes > 0) {
      console.log(`✓ Updated description for: ${uniName}`);
      updateCount++;
    } else {
      console.log(`⚠ Not found: ${uniName}`);
    }
  }
  
  console.log(`\n✓ Updated ${updateCount} university descriptions`);
  
} catch (err) {
  console.error('Error:', err.message);
}
