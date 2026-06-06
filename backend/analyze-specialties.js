const fs = require('fs');
const path = require('path');

// Находим и парсим JSON
const jsonPath = path.join(__dirname, '../universities_full(1).json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Собираем все специальности
const specs = new Set();
const specCounts = {};

for (const uni of data) {
  if (uni.faculties) {
    for (const fac of uni.faculties) {
      if (fac.specialties && Array.isArray(fac.specialties)) {
        for (const sp of fac.specialties) {
          specs.add(sp);
          specCounts[sp] = (specCounts[sp] || 0) + 1;
        }
      }
    }
  }
}

// Формируем отчет
let report = '';
report += 'Уникальные специальности в JSON файле:\n';
report += '='.repeat(50) + '\n';

Array.from(specs).sort().forEach((s, i) => {
  report += `${i+1}. ${s}\n`;
});

report += '='.repeat(50) + '\n';
report += `\nВсего специальностей: ${specs.size}\n\n`;

report += 'Распределение вузов по специальностям:\n';
report += '='.repeat(50) + '\n';

Object.entries(specCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([spec, count]) => {
    report += `${spec}: ${count} вузов\n`;
  });

// Выводим в консоль и файл
console.log(report);
fs.writeFileSync(path.join(__dirname, 'specialties-report.txt'), report);
console.log('\nОтчет сохранен в specialties-report.txt');
