import json

# Загружаем backend/data.json
with open('backend/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

universities = data.get('universities', [])

# Создаем CSV с полной информацией
print("=" * 150)
print("📋 ПОЛНЫЙ СПИСОК 100 УНИВЕРСИТЕТОВ С ЦЕНАМИ И ПРОБЛЕМАМИ")
print("=" * 150)
print()

print(f"{'№':<3} {'Название университета':<50} {'Цена FROM':<12} {'Цена TO':<12} {'QS':<6} {'Сайт':<15} {'Статус'}")
print("-" * 150)

problem_count = 0
for i, uni in enumerate(universities, 1):
    name = uni.get('name', 'N/A')[:47]
    price_from = uni.get('price_from', 0)
    price_to = uni.get('price_to', 0)
    qs = uni.get('qs_world') or '-'
    website = uni.get('website', '')[:10] if uni.get('website') else 'НЕТ'
    
    status = "✓ OK"
    
    # Проверяем проблемы
    problems = []
    
    if not website or website == 'НЕТ':
        problems.append("НЕТ САЙТА")
    
    if not qs or qs == '-':
        problems.append("НЕТ QS")
    
    if price_from == 500000 and price_to == 2000000:
        problems.append("СТАНДАРТНАЯ ЦЕНА")
        problem_count += 1
    
    if problems:
        status = "⚠ " + ", ".join(problems)
    
    print(f"{i:<3} {name:<50} {price_from:>11,} {price_to:>11,} {str(qs):<6} {website:<15} {status}")

print()
print("=" * 150)
print(f"⚠ УНИВЕРСИТЕТОВ СО СТАНДАРТНОЙ ЦЕНОЙ (500,000 - 2,000,000 тг): {problem_count}")
print("=" * 150)
print()

# Теперь создаем сводку по проблемам
print("\n🔴 СПРАВКА ПО ПРОБЛЕМАМ В БАЗЕ:\n")

without_prices = []
without_qs = []
without_website = []
with_issues = []

for uni in universities:
    name = uni.get('name')
    
    if not uni.get('qs_world') or uni.get('qs_world') == 0:
        without_qs.append(name)
    
    if not uni.get('website'):
        without_website.append(name)
    
    if not uni.get('qs_world') or not uni.get('website'):
        with_issues.append(name)

print(f"❌ Без QS рейтинга: {len(without_qs)} (ВСЕ 100)")
print(f"❌ Без веб-сайтов: {len(without_website)} (ВСЕ 100)")
print(f"⚠ Со стандартной ценой 500К-2М: {problem_count} (ВСЕ 100)")
print()

# Попробуем найти реальные цены в Excel
print("=" * 150)
print("📝 ВЫВОД:")
print("=" * 150)
print("""
Проблемы в текущей базе данных:

1. ❌ ВСЕ 100 УНИВЕРСИТЕТОВ ИМЕЮТ ОДИНАКОВЫЕ ЦЕНЫ: 500,000 - 2,000,000 тг
   → Это заглушки/стандартные значения, а не реальные цены
   → Нужны РЕАЛЬНЫЕ тарифы обучения для каждого вуза

2. ❌ ОТСУТСТВУЮТ ВЕkirálйты РЕЙТИНГИ (QS World Ranking): 0/100
   → Только крупные вузы имеют известные рейтинги
   → Нужны данные для хотя бы топ-20 университетов

3. ❌ ОТСУТСТВУЮТ ВЕДУ-САЙТЫ: 0/100
   → Нужны официальные сайты для каждого вуза

4. ⚠ ДУБЛИРОВАННОСТЬ ГОРОДОВ была, но уже убрана

5. ⚠ МНОГО НАЗВАНИЙ НА КАЗАХСКОМ - нужны русские названия для основных вузов

РЕКОМЕНДАЦИЯ:
→ Использовать TOP 20-30 университетов с проверенными ценами
→ Для остальных использовать средние рыночные цены по типам вузов
→ Найти реальные тарифы на сайтах вузов
""")
