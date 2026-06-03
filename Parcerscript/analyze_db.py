import json

# Загружаем базу
with open('universities.json', 'r', encoding='utf-8') as f:
    universities = json.load(f)

# Анализируем цены
without_prices = []
low_prices = []
high_prices = []
complete_data = []

for uni in universities:
    name = uni.get('name', 'N/A')
    price_from = uni.get('price_from', 0)
    price_to = uni.get('price_to', 0)
    qs = uni.get('qs_world')
    founded = uni.get('founded', 0)
    students = uni.get('students_count', 0)
    
    # Проверяем наличие цен
    if price_from == 0 and price_to == 0:
        without_prices.append(name)
    elif price_from == 0 or price_to == 0:
        low_prices.append({'name': name, 'from': price_from, 'to': price_to})
    elif price_from > price_to:
        high_prices.append({'name': name, 'from': price_from, 'to': price_to})
    else:
        complete_data.append({
            'name': name, 
            'from': price_from, 
            'to': price_to, 
            'qs': qs,
            'founded': founded,
            'students': students
        })

print("=" * 80)
print("📊 АНАЛИЗ БАЗЫ УНИВЕРСИТЕТОВ")
print("=" * 80)
print(f"\n✓ Всего университетов: {len(universities)}")
print(f"✓ С полными ценами: {len(complete_data)}")
print(f"⚠ Без цен: {len(without_prices)}")
print(f"⚠ С неполными ценами: {len(low_prices)}")
print(f"❌ С ошибочными ценами (from > to): {len(high_prices)}")

if without_prices:
    print("\n" + "=" * 80)
    print("❌ УНИВЕРСИТЕТЫ БЕЗ ЦЕН (price_from = 0 и price_to = 0):")
    print("=" * 80)
    for i, name in enumerate(without_prices, 1):
        print(f"{i}. {name}")

if low_prices:
    print("\n" + "=" * 80)
    print("⚠ УНИВЕРСИТЕТЫ С НЕПОЛНЫМИ ЦЕНАМИ:")
    print("=" * 80)
    for item in low_prices:
        print(f"• {item['name']}")
        print(f"  Диапазон: {item['from']:,} - {item['to']:,} тг")

if high_prices:
    print("\n" + "=" * 80)
    print("❌ УНИВЕРСИТЕТЫ С ОШИБОЧНЫМИ ЦЕНАМИ (price_from > price_to):")
    print("=" * 80)
    for item in high_prices:
        print(f"• {item['name']}")
        print(f"  Диапазон: {item['from']:,} - {item['to']:,} тг ❌")

# Статистика по ценам
print("\n" + "=" * 80)
print("📈 СТАТИСТИКА ПО ЦЕНАМ:")
print("=" * 80)
prices = [uni.get('price_from', 0) for uni in universities if uni.get('price_from', 0) > 0]
if prices:
    min_price = min(prices)
    max_price = max(prices)
    avg_price = sum(prices) // len(prices)
    print(f"Минимальная цена: {min_price:,} тг")
    print(f"Максимальная цена: {max_price:,} тг")
    print(f"Средняя цена: {avg_price:,} тг")

# Информация о других полях
print("\n" + "=" * 80)
print("📋 ИНФОРМАЦИЯ О ДРУГИХ ПОЛЯХ:")
print("=" * 80)
without_qs = sum(1 for u in universities if u.get('qs_world') is None or u.get('qs_world') == 0)
without_description = sum(1 for u in universities if not u.get('description'))
without_website = sum(1 for u in universities if not u.get('website'))
print(f"Без QS рейтинга: {without_qs}")
print(f"Без описания: {without_description}")
print(f"Без веб-сайта: {without_website}")
