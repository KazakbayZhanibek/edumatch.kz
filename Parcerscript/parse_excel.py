import openpyxl
import json

# Загружаем Excel
wb = openpyxl.load_workbook('onirler_oblystar_kalalar_boi7-v2.xlsx')
ws = wb.active

# Парсим данные
universities = []
cities_dict = {}
city_id = 1

for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    if not row[0]:  # Пропускаем пустые строки
        continue
    
    name_kk = row[0]  # Казахский
    address_ru = row[1]  # Адрес русский
    address_kk = row[2]  # Адрес казахский
    name_ru = row[3]   # Русский
    phone = row[4]
    uni_id = row[5]
    city = row[6]
    
    # Извлекаем город
    if city:
        city_name = city.strip()
    elif address_ru:
        city_name = address_ru.split(',')[0].replace('г.', '').replace('қ.', '').strip()
    else:
        city_name = "Неизвестно"
    
    # Добавляем город в словарь если новый
    if city_name not in cities_dict:
        cities_dict[city_name] = city_id
        city_id += 1
    
    uni = {
        "id": int(uni_id) if uni_id else len(universities) + 1,
        "name": name_ru if name_ru else name_kk,
        "short_name": (name_kk[:15] if name_kk else name_ru[:15]).replace('атындағы', '').replace('имени', '').strip(),
        "city_id": cities_dict[city_name],
        "qs_world": None,
        "qs_asia": None,
        "price_from": 500000,
        "price_to": 2000000,
        "website": "",
        "description": f"Университет в городе {city_name}",
        "founded": 1990,
        "students_count": 5000,
        "languages": ["Казахский", "Русский"],
        "accreditations": ["Национальная"],
        "has_dorm": True,
        "dorm_price": 60000,
        "avg_salary": 400000,
        "lat": 50.0,
        "lng": 70.0,
        "specialty_ids": [1, 2, 5, 6],
        "address": address_ru if address_ru else address_kk
    }
    universities.append(uni)

# Создаем список городов
cities = [{"id": v, "name": k} for k, v in sorted(cities_dict.items(), key=lambda x: x[1])]

print(f"Найдено {len(universities)} университетов")
print(f"Найдено {len(cities)} городов:")
for c in cities:
    print(f"  ID {c['id']}: {c['name']}")

# Сохраняем результат
result = {
    "cities": cities,
    "universities": universities,
    "specialties": [
        {"id": 1, "name": "Информационные технологии", "category": "IT"},
        {"id": 2, "name": "Программная инженерия", "category": "IT"},
        {"id": 3, "name": "Кибербезопасность", "category": "IT"},
        {"id": 4, "name": "Искусственный интеллект", "category": "IT"},
        {"id": 5, "name": "Экономика", "category": "Экономика"},
        {"id": 6, "name": "Финансы", "category": "Экономика"},
        {"id": 7, "name": "Менеджмент", "category": "Экономика"},
        {"id": 8, "name": "Бухгалтерский учет", "category": "Экономика"},
        {"id": 9, "name": "Юриспруденция", "category": "Право"},
        {"id": 10, "name": "Международное право", "category": "Право"},
        {"id": 11, "name": "Медицина", "category": "Медицина"},
        {"id": 12, "name": "Фармация", "category": "Медицина"},
        {"id": 13, "name": "Стоматология", "category": "Медицина"},
        {"id": 14, "name": "Педагогика", "category": "Образование"},
        {"id": 15, "name": "Психология", "category": "Гуманитарные"},
        {"id": 16, "name": "Журналистика", "category": "Гуманитарные"},
        {"id": 17, "name": "Международные отношения", "category": "Гуманитарные"},
        {"id": 18, "name": "Переводческое дело", "category": "Гуманитарные"},
        {"id": 19, "name": "Химическая инженерия", "category": "Инженерия"},
        {"id": 20, "name": "Нефтегазовое дело", "category": "Инженерия"},
        {"id": 21, "name": "Горное дело", "category": "Инженерия"},
        {"id": 22, "name": "Строительство", "category": "Инженерия"},
        {"id": 23, "name": "Архитектура", "category": "Инженерия"},
        {"id": 24, "name": "Биология", "category": "Естественные науки"},
        {"id": 25, "name": "Физика", "category": "Естественные науки"},
        {"id": 26, "name": "Математика", "category": "Естественные науки"},
        {"id": 27, "name": "Маркетинг", "category": "Экономика"},
        {"id": 28, "name": "Туризм", "category": "Сервис"},
        {"id": 29, "name": "Дизайн", "category": "Искусство"},
        {"id": 30, "name": "Музыка", "category": "Искусство"},
        {"id": 31, "name": "Логистика", "category": "Экономика"},
        {"id": 32, "name": "Банковское дело", "category": "Экономика"},
        {"id": 33, "name": "Геология", "category": "Естественные науки"},
        {"id": 34, "name": "Экология", "category": "Естественные науки"},
        {"id": 35, "name": "Социология", "category": "Гуманитарные"},
    ],
    "grants": [
        {"id": 1, "name": "Государственный образовательный грант", "type": "government", "amount": "Полное покрытие", "description": "Грант на обучение", "requirements": [], "deadline": "", "link": ""}
    ],
    "tips": [
        {"id": 1, "title": "Выбор университета", "category": "Советы", "content": "Изучите рейтинги", "tip": "Выбирайте по своим интересам"}
    ]
}

with open('backend/data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n✓ Сохранено {len(universities)} университетов в backend/data.json")
print(f"✓ Всего городов: {len(cities)}")
