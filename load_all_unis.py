import openpyxl
import json
from collections import defaultdict

# Загружаем Excel
try:
    wb = openpyxl.load_workbook('onirler_oblystar_kalalar_boi7-v2.xlsx')
    ws = wb.active
    
    universities = []
    cities_dict = defaultdict(list)
    seen_names = set()
    city_id = 1
    city_map = {}
    
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0]:
            continue
        
        name_kk = row[0] if row[0] else ""
        name_ru = row[3] if len(row) > 3 else ""
        address = row[1] if len(row) > 1 else ""
        phone = row[4] if len(row) > 4 else ""
        city_region = row[6] if len(row) > 6 else ""
        
        # Выбираем имя - приоритет русскому
        full_name = name_ru.strip() if name_ru else name_kk.strip()
        
        if not full_name or full_name in seen_names:
            continue
        
        seen_names.add(full_name)
        
        # Нормализуем город
        city_name = city_region.strip() if city_region else "Неизвестно"
        
        # Упрощаем названия городов
        if "Нур-Сұлтан" in city_name or "Астана" in city_name:
            city_name = "Нур-Султан (Астана)"
        elif "Алматы" in city_name:
            city_name = "Алматы"
        elif "Шымкент" in city_name:
            city_name = "Шымкент"
        elif "Карағанды" in city_name or "Караганда" in city_name:
            city_name = "Караганда"
        
        if city_name not in city_map:
            city_map[city_name] = city_id
            city_id += 1
        
        uni = {
            "id": len(universities) + 1,
            "name": full_name,
            "short_name": full_name[:40],
            "city_id": city_map[city_name],
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
            "dorm_price": 50000,
            "avg_salary": 450000,
            "lat": 50.0,
            "lng": 70.0,
            "specialty_ids": [1, 2, 3, 4, 5],
            "address": address[:100] if address else "",
            "phone": str(phone) if phone else ""
        }
        universities.append(uni)
    
    # Создаем финальный список городов
    cities = [{"id": v, "name": k} for k, v in sorted(city_map.items(), key=lambda x: x[1])]
    
    print(f"✓ Загружено {len(universities)} университетов")
    print(f"✓ Городов: {len(cities)}")
    print(f"\nПримеры названий вузов:")
    for uni in universities[:10]:
        print(f"  • {uni['name']} ({cities[uni['city_id']-1]['name']})")
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
    universities = []
    cities = []

# Сохраняем
with open('all_universities.json', 'w', encoding='utf-8') as f:
    json.dump({
        'universities': universities,
        'cities': cities
    }, f, ensure_ascii=False, indent=2)

print(f"\n✓ Сохранено в all_universities.json")
