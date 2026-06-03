import json
from collections import defaultdict

# Загружаем данные
with open('backend/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

universities = data.get('universities', [])
cities = {c['id']: c['name'] for c in data.get('cities', [])}

# Группируем университеты по городам
universities_by_city = defaultdict(list)
for uni in universities:
    city_id = uni.get('city_id')
    city_name = cities.get(city_id, f'Город {city_id}')
    universities_by_city[city_name].append({
        'id': uni.get('id'),
        'name': uni.get('name'),
        'price_from': uni.get('price_from'),
        'price_to': uni.get('price_to'),
        'qs_world': uni.get('qs_world')
    })

# Сортируем по количеству университетов
sorted_cities = sorted(universities_by_city.items(), key=lambda x: len(x[1]), reverse=True)

print("=" * 100)
print("🏛️ РАСПРЕДЕЛЕНИЕ УНИВЕРСИТЕТОВ ПО ГОРОДАМ")
print("=" * 100)
print()

total_universities = 0
for city_name, unis in sorted_cities:
    print(f"\n📍 {city_name.upper()}")
    print(f"   Университетов: {len(unis)}")
    print(f"   {'─' * 95}")
    for uni in sorted(unis, key=lambda x: x['name']):
        qs_str = f"QS: {uni['qs_world']}" if uni['qs_world'] else "QS: -"
        price_str = f"{uni['price_from']:,} - {uni['price_to']:,} тг"
        print(f"   • {uni['name']:<60} {price_str:<30} {qs_str}")
    total_universities += len(unis)

print()
print("=" * 100)
print(f"✓ ИТОГО: {len(sorted_cities)} городов, {total_universities} университетов")
print("=" * 100)

# Создаем JSON для фильтра
filter_data = {
    'cities': [
        {
            'id': i + 1,
            'name': city_name,
            'count': len(unis)
        }
        for i, (city_name, unis) in enumerate(sorted_cities)
    ]
}

with open('cities_filter.json', 'w', encoding='utf-8') as f:
    json.dump(filter_data, f, ensure_ascii=False, indent=2)

print("\n✓ Создан файл: cities_filter.json")
print(f"✓ Городов всего: {len(filter_data['cities'])}")
