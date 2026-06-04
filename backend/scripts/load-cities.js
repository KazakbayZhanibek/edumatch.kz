const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('edumatch.db');

// Отключаем foreign key checks
db.pragma('foreign_keys = OFF');

// Все города из universities_full(1).json
const cities = [
  'Актау',
  'Актобе',
  'Алматы',
  'Астана',
  'Атырау',
  'Жезказган',
  'Караганда',
  'Каскелен',
  'Кокшетау',
  'Кызылорда',
  'Павлодар',
  'Петропавловск',
  'Семей',
  'Уральск',
  'Усть-Каменогорск',
  'Шымкент'
];

// Очищаем старые города
db.prepare('DELETE FROM cities').run();

// Добавляем все города
const insertCity = db.prepare('INSERT INTO cities (name) VALUES (?)');

cities.forEach(city => {
  insertCity.run(city);
  console.log(`✓ Added city: ${city}`);
});

// Загружаем данные из universities_full(1).json
const jsonPath = path.join(path.dirname(__dirname), 'universities_full(1).json');
const universities = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Создаем карту city_name -> city_id
const cityMap = {};
const citiesData = db.prepare('SELECT id, name FROM cities').all();
citiesData.forEach(row => {
  cityMap[row.name] = row.id;
});

// Обновляем city_id для каждого университета
const updateUniversity = db.prepare('UPDATE universities SET city_id = ? WHERE name = ?');

universities.forEach(uni => {
  if (uni.city && cityMap[uni.city]) {
    updateUniversity.run(cityMap[uni.city], uni.name);
  }
});

console.log(`\n✓ Updated city_id for all universities`);
console.log(`✓ Total cities: ${cities.length}`);

db.close();
