import openpyxl
import json

# ТОП университеты с ценами (на основе открытой информации)
top_unis = {
    "Назарбаев Университет": {"price_from": 0, "price_to": 4500000, "qs_world": 197, "city": "Астана"},
    "Казахский национальный университет им. аль-Фараби": {"price_from": 580000, "price_to": 1500000, "qs_world": 163, "city": "Алматы"},
    "Казахстанско-Британский технический университет": {"price_from": 2100000, "price_to": 3500000, "qs_world": 601, "city": "Алматы"},
    "Казахский национальный технический университет": {"price_from": 720000, "price_to": 1680000, "qs_world": 383, "city": "Алматы"},
    "КИМЭП": {"price_from": 2600000, "price_to": 3800000, "qs_world": None, "city": "Алматы"},
    "Казахский национальный медицинский университет": {"price_from": 1200000, "price_to": 2500000, "qs_world": None, "city": "Алматы"},
    "Нархоз": {"price_from": 1300000, "price_to": 1860000, "qs_world": None, "city": "Алматы"},
    "Казахский национальный педагогический университет": {"price_from": 700000, "price_to": 1100000, "qs_world": 1001, "city": "Алматы"},
    "Евразийский национальный университет": {"price_from": 650000, "price_to": 1400000, "qs_world": 401, "city": "Астана"},
    "Алматы Менеджмент Университет": {"price_from": 1400000, "price_to": 2900000, "qs_world": None, "city": "Алматы"},
}

# Загружаем Excel
wb = openpyxl.load_workbook('onirler_oblystar_kalalar_boi7-v2.xlsx')
ws = wb.active

# Парсим данные - ищем только ТОП вузы
universities = []
cities_dict = {}
city_id = 1
found_count = 0

for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    if not row[0] or found_count >= 20:
        continue
    
    name_kk = row[0]
    name_ru = row[3]
    address_ru = row[1]
    phone = row[4]
    uni_id = row[5]
    city_region = row[6]
    
    full_name = name_ru if name_ru else name_kk
    
    # Проверяем есть ли в ТОП вузах
    is_top = False
    top_info = None
    for top_name, info in top_unis.items():
        if top_name.lower() in full_name.lower() or full_name.lower() in top_name.lower():
            is_top = True
            top_info = info
            break
    
    if not is_top:
        continue
    
    found_count += 1
    
    # Извлекаем город
    city_name = city_region.strip() if city_region else address_ru.split(',')[0] if address_ru else "Неизвестно"
    
    if city_name not in cities_dict:
        cities_dict[city_name] = city_id
        city_id += 1
    
    uni = {
        "id": found_count,
        "name": full_name,
        "short_name": (name_kk[:20] if name_kk else name_ru[:20]).strip(),
        "city_id": cities_dict[city_name],
        "qs_world": top_info.get("qs_world"),
        "qs_asia": None,
        "price_from": top_info.get("price_from", 500000),
        "price_to": top_info.get("price_to", 2000000),
        "website": "",
        "description": f"Ведущий университет Казахстана",
        "founded": 1990,
        "students_count": 5000,
        "languages": ["Казахский", "Русский", "Английский"],
        "accreditations": ["Национальная"],
        "has_dorm": True,
        "dorm_price": 60000,
        "avg_salary": 450000,
        "lat": 50.0,
        "lng": 70.0,
        "specialty_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "address": address_ru if address_ru else "",
        "phone": str(phone) if phone else ""
    }
    universities.append(uni)
    print(f"{found_count}. {full_name} - {top_info.get('price_from'):,} - {top_info.get('price_to'):,} тг")

# Создаем список городов
cities = [{"id": v, "name": k} for k, v in sorted(cities_dict.items(), key=lambda x: x[1])]

print(f"\n✓ Выбрано {len(universities)} ТОП университетов")
print(f"✓ Городов: {len(cities)}")

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
    ],
    "grants": [
        {"id": 1, "name": "Государственный грант", "type": "government", "amount": "Полное покрытие", "description": "Грант на обучение", "requirements": ["Высокий ЕНТ"], "deadline": "После ЕНТ", "link": "https://www.edu.gov.kz"}
    ],
    "tips": [
        {"id": 1, "title": "Выбор университета", "category": "Советы", "content": "Изучите рейтинги", "tip": "Выбирайте по интересам"}
    ]
}

with open('backend/data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n✅ Сохранено {len(universities)} университетов в backend/data.json")
