import json

# Загружаем backend/data.json
with open('backend/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

universities = data.get('universities', [])
cities = data.get('cities', [])

print("=" * 100)
print("📊 ПОДРОБНЫЙ ОТЧЕТ О БАЗЕ ДАННЫХ EduMatch KZ")
print("=" * 100)

print("\n1️⃣ СТРУКТУРА БАЗЫ:")
print(f"   • Всего университетов: {len(universities)}")
print(f"   • Всего городов: {len(cities)}")
print(f"   • Специальностей: {len(data.get('specialties', []))}")

print("\n2️⃣ СОСТОЯНИЕ ЦЕН:")
prices_distribution = {}
for uni in universities:
    price_from = uni.get('price_from', 0)
    if price_from not in prices_distribution:
        prices_distribution[price_from] = 0
    prices_distribution[price_from] += 1

print(f"   • Уникальных цен: {len(prices_distribution)}")
for price, count in sorted(prices_distribution.items(), key=lambda x: x[1], reverse=True):
    print(f"     - {price:,} тг: {count} университетов {'⚠ ПРОБЛЕМА! Все одинаковые' if count == len(universities) else ''}")

print("\n3️⃣ ПРОБЛЕМА С ДУБЛИРОВАНИЕМ ГОРОДОВ:")
city_names = [c['name'] for c in cities]
unique_cities = set(city_names)
print(f"   • Всего записей городов в БД: {len(city_names)}")
print(f"   • Уникальных городов: {len(unique_cities)}")
print(f"   • Дубликатов: {len(city_names) - len(unique_cities)}")

# Найдем дубли
from collections import Counter
city_counter = Counter(city_names)
duplicates = {city: count for city, count in city_counter.items() if count > 1}
if duplicates:
    print(f"\n   Города с дубликатами:")
    for city, count in sorted(duplicates.items(), key=lambda x: x[1], reverse=True):
        print(f"   • '{city}' - {count} раза")

print("\n4️⃣ КАЧЕСТВО ДАННЫХ - ЗАПОЛНЕННОСТЬ ПОЛЕЙ:")
fields_filled = {
    'qs_world': 0,
    'website': 0,
    'description': 0,
    'phone': 0,
    'address': 0,
    'dorm_price': 0,
    'avg_salary': 0,
}

for uni in universities:
    if uni.get('qs_world'):
        fields_filled['qs_world'] += 1
    if uni.get('website') and uni.get('website').strip():
        fields_filled['website'] += 1
    if uni.get('description') and uni.get('description').strip():
        fields_filled['description'] += 1
    if uni.get('phone') and uni.get('phone').strip():
        fields_filled['phone'] += 1
    if uni.get('address') and uni.get('address').strip():
        fields_filled['address'] += 1
    if uni.get('dorm_price'):
        fields_filled['dorm_price'] += 1
    if uni.get('avg_salary'):
        fields_filled['avg_salary'] += 1

print("\n   Заполненность полей:")
for field, count in fields_filled.items():
    percent = (count / len(universities)) * 100
    status = "✓" if percent >= 80 else "⚠" if percent >= 50 else "❌"
    print(f"   {status} {field:15} - {count:3}/{len(universities)} ({percent:5.1f}%)")

print("\n5️⃣ ПРИМЕРЫ УНИВЕРСИТЕТОВ:")
print("\n   ПЕРВЫЕ 5:")
for i, uni in enumerate(universities[:5], 1):
    print(f"\n   {i}. {uni.get('name', 'N/A')}")
    print(f"      Цена: {uni.get('price_from', 0):,} - {uni.get('price_to', 0):,} тг")
    print(f"      QS: {uni.get('qs_world', 'Нет')}")
    print(f"      Адрес: {uni.get('address', 'Не указан')[:60]}...")

print("\n" + "=" * 100)
print("🔴 ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ:")
print("=" * 100)

problems = []

# Проблема 1: Одинаковые цены
if len(prices_distribution) <= 3:
    problems.append("❌ ВСЕ университеты имеют ОДИНАКОВУЮ цену (500,000 тг)")
    problems.append("   Это явно ошибка - цены не скопировались из Excel корректно")

# Проблема 2: Дубли городов
if len(duplicates) > 0:
    problems.append(f"⚠ БД содержит ДУБЛИКАТЫ ГОРОДОВ ({len(duplicates)} городов)")
    problems.append("   Одни и те же города записаны по-разному:")
    for city, count in list(sorted(duplicates.items(), key=lambda x: x[1], reverse=True))[:5]:
        problems.append(f"   • '{city}' повторяется {count} раза")

# Проблема 3: Пустые веб-сайты
if fields_filled['website'] < len(universities) * 0.5:
    problems.append(f"❌ ОТСУТСТВУЮТ веб-сайты ({fields_filled['website']}/{len(universities)})")

# Проблема 4: Пустые QS
if fields_filled['qs_world'] < len(universities) * 0.3:
    problems.append(f"⚠ Мало QS рейтингов ({fields_filled['qs_world']}/{len(universities)})")

# Проблема 5: Пустые адреса
if fields_filled['address'] < len(universities) * 0.5:
    problems.append(f"⚠ ОТСУТСТВУЮТ полные адреса ({fields_filled['address']}/{len(universities)})")

for i, problem in enumerate(problems, 1):
    print(f"{i}. {problem}")

print("\n" + "=" * 100)
print("💡 РЕКОМЕНДАЦИИ:")
print("=" * 100)
print("""
1. ✓ СРОЧНО исправить цены - большинство университетов имеют разные тарифы
2. ✓ Нормализовать города (убрать дубликаты, привести к единому формату)
3. ✓ Добавить веб-сайты для всех университетов
4. ✓ Заполнить QS рейтинги для основных вузов
5. ✓ Добавить полные адреса с координатами (lat/lng)
6. ✓ Проверить средние зарплаты выпускников
""")

print("=" * 100)
