const fs = require('fs');
const data = JSON.parse(fs.readFileSync('../universities_full(1).json', 'utf-8'));

const specs = new Set();
for (const uni of data) {
  if (uni.faculties) {
    for (const fac of uni.faculties) {
      if (fac.specialties) {
        for (const sp of fac.specialties) {
          specs.add(sp);
        }
      }
    }
  }
}

console.log('Уникальные специальности в JSON файле:');
console.log('='.repeat(40));
Array.from(specs).sort().forEach((s, i) => console.log(`${i+1}. ${s}`));
console.log('='.repeat(40));
console.log(`\nВсего специальностей: ${specs.size}\n`);

// Подсчитаем сколько вузов по каждой специальности
const specCounts = {};
for (const uni of data) {
  if (uni.faculties) {
    for (const fac of uni.faculties) {
      if (fac.specialties) {
        for (const sp of fac.specialties) {
          if (!specCounts[sp]) specCounts[sp] = 0;
          specCounts[sp]++;
        }
      }
    }
  }
}

console.log('Распределение вузов по специальностям:');
console.log('='.repeat(40));
Object.entries(specCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([spec, count]) => {
    console.log(`${spec}: ${count} вузов`);
  });
