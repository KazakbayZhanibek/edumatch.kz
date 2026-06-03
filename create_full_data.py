import json

# ТОП-20 вузов
top_20 = [
    {"name": "Назарбаев Университет", "city": "Нур-Султан (Астана)", "price_from": 2000000, "price_to": 4500000, "qs": 197, "is_top": True},
    {"name": "Казахский национальный университет им. аль-Фараби", "city": "Алматы", "price_from": 580000, "price_to": 1500000, "qs": 163, "is_top": True},
    {"name": "Казахстанско-Британский технический университет (КБТУ)", "city": "Алматы", "price_from": 2100000, "price_to": 3500000, "qs": 601, "is_top": True},
    {"name": "Казахский национальный технический университет им. Сатпаева", "city": "Алматы", "price_from": 720000, "price_to": 1680000, "qs": 383, "is_top": True},
    {"name": "КИМЭП Университет", "city": "Алматы", "price_from": 2600000, "price_to": 3800000, "qs": None, "is_top": True},
    {"name": "Казахский национальный медицинский университет", "city": "Алматы", "price_from": 1200000, "price_to": 2500000, "qs": None, "is_top": True},
    {"name": "Университет Нархоз", "city": "Алматы", "price_from": 1300000, "price_to": 1860000, "qs": None, "is_top": True},
    {"name": "Казахский национальный педагогический университет им. Абая", "city": "Алматы", "price_from": 700000, "price_to": 1100000, "qs": 1001, "is_top": True},
    {"name": "Евразийский национальный университет им. Гумилева", "city": "Нур-Султан (Астана)", "price_from": 650000, "price_to": 1400000, "qs": 401, "is_top": True},
    {"name": "Международный университет информационных технологий (МУИТ)", "city": "Алматы", "price_from": 1100000, "price_to": 1800000, "qs": None, "is_top": True},
]

# Остальные вузы по регионам
other_unis = [
    # Алматы (еще)
    {"name": "Алматы менеджмент университет", "city": "Алматы", "price_from": 1400000, "price_to": 2900000, "qs": None, "is_top": False},
    {"name": "Каспийский общественный университет", "city": "Алматы", "price_from": 1200000, "price_to": 2400000, "qs": None, "is_top": False},
    {"name": "Алматы технологиялық университеті", "city": "Алматы", "price_from": 800000, "price_to": 1500000, "qs": None, "is_top": False},
    {"name": "Казахский национальный аграрный университет", "city": "Алматы", "price_from": 600000, "price_to": 1200000, "qs": None, "is_top": False},
    {"name": "Казахский национальный консерватория им. Курмангазы", "city": "Алматы", "price_from": 700000, "price_to": 1300000, "qs": None, "is_top": False},
    {"name": "Казахский национальный университет театра и кино", "city": "Алматы", "price_from": 800000, "price_to": 1400000, "qs": None, "is_top": False},
    {"name": "Казахский национальный колледж медицины", "city": "Алматы", "price_from": 500000, "price_to": 1000000, "qs": None, "is_top": False},
    {"name": "Казахский национальный женский педагогический университет", "city": "Алматы", "price_from": 650000, "price_to": 1100000, "qs": None, "is_top": False},
    {"name": "Алматы архитектуры и строительства университеті", "city": "Алматы", "price_from": 900000, "price_to": 1600000, "qs": None, "is_top": False},
    {"name": "Хуаньизы дизайна, архитектуры и текстиля", "city": "Алматы", "price_from": 1000000, "price_to": 1700000, "qs": None, "is_top": False},
    
    # Нур-Султан (еще)
    {"name": "Туран-Астана университеті", "city": "Нур-Султан (Астана)", "price_from": 900000, "price_to": 1600000, "qs": None, "is_top": False},
    {"name": "Астана медициналық университеті", "city": "Нур-Султан (Астана)", "price_from": 1300000, "price_to": 2200000, "qs": None, "is_top": False},
    {"name": "Казахский агротехнический университет им. С.Сейфуллина", "city": "Нур-Султан (Астана)", "price_from": 700000, "price_to": 1200000, "qs": None, "is_top": False},
    {"name": "Казахский технология және бизнес университеті", "city": "Нур-Султан (Астана)", "price_from": 800000, "price_to": 1400000, "qs": None, "is_top": False},
    {"name": "Ақмола облысының мәмлекеттік биліктіліктендіру институты", "city": "Нур-Султан (Астана)", "price_from": 600000, "price_to": 1100000, "qs": None, "is_top": False},
    
    # Шымкент
    {"name": "Южно-Казахстанский государственный университет им. Ауэзова", "city": "Шымкент", "price_from": 500000, "price_to": 1200000, "qs": None, "is_top": False},
    {"name": "Шымкент педагогикалық университеті", "city": "Шымкент", "price_from": 600000, "price_to": 1100000, "qs": None, "is_top": False},
    {"name": "Орталық Азия инновациялық университеті", "city": "Шымкент", "price_from": 700000, "price_to": 1300000, "qs": None, "is_top": False},
    {"name": "Мирас университеті", "city": "Шымкент", "price_from": 800000, "price_to": 1400000, "qs": None, "is_top": False},
    
    # Караганда
    {"name": "Карагандинский государственный университет", "city": "Караганда", "price_from": 500000, "price_to": 1200000, "qs": None, "is_top": False},
    {"name": "Карагандинский медицинский университет", "city": "Караганда", "price_from": 900000, "price_to": 1600000, "qs": None, "is_top": False},
    {"name": "Карагандинский технический университет", "city": "Караганда", "price_from": 700000, "price_to": 1300000, "qs": None, "is_top": False},
    {"name": "Болашақ академиясы", "city": "Караганда", "price_from": 800000, "price_to": 1400000, "qs": None, "is_top": False},
    
    # Семей
    {"name": "Семей медициналық университеті", "city": "Семей", "price_from": 800000, "price_to": 1500000, "qs": None, "is_top": False},
    {"name": "Шәкәрім Түскібай атындағы Семей университеті", "city": "Семей", "price_from": 600000, "price_to": 1100000, "qs": None, "is_top": False},
    {"name": "Семей мемлекеттік педагогикалық институты", "city": "Семей", "price_from": 550000, "price_to": 1000000, "qs": None, "is_top": False},
    
    # Актобе
    {"name": "С.Баишев атындағы Актобе университеті", "city": "Актобе", "price_from": 600000, "price_to": 1100000, "qs": None, "is_top": False},
    {"name": "М.Өспанов атындағы Батыс-Қазақстан медициналық университеті", "city": "Актобе", "price_from": 850000, "price_to": 1500000, "qs": None, "is_top": False},
    
    # Атырау
    {"name": "Атырау мемлекеттік университеті", "city": "Атырау", "price_from": 500000, "price_to": 950000, "qs": None, "is_top": False},
    {"name": "Атырау облысының мемлекеттік университеті", "city": "Атырау", "price_from": 550000, "price_to": 1000000, "qs": None, "is_top": False},
    
    # Костанай
    {"name": "Костанай мемлекеттік университеті", "city": "Костанай", "price_from": 500000, "price_to": 950000, "qs": None, "is_top": False},
    
    # Павлодар
    {"name": "Павлодар мемлекеттік университеті", "city": "Павлодар", "price_from": 550000, "price_to": 1050000, "qs": None, "is_top": False},
    
    # Тараз
    {"name": "Жамбылский мемлекеттік университеті", "city": "Тараз", "price_from": 500000, "price_to": 900000, "qs": None, "is_top": False},
    
    # Уральск
    {"name": "Батыс-Қазақстан мемлекеттік университеті", "city": "Уральск", "price_from": 500000, "price_to": 950000, "qs": None, "is_top": False},
]

all_unis = top_20 + other_unis

# Создаем города
cities_dict = {}
city_id = 1
for uni in all_unis:
    if uni['city'] not in cities_dict:
        cities_dict[uni['city']] = city_id
        city_id += 1

cities = [{"id": v, "name": k} for k, v in sorted(cities_dict.items(), key=lambda x: x[1])]

# Форматируем университеты
universities = []
for i, uni in enumerate(all_unis, 1):
    universities.append({
        "id": i,
        "name": uni["name"],
        "short_name": uni["name"][:35],
        "city_id": cities_dict[uni["city"]],
        "qs_world": uni["qs"],
        "qs_asia": None,
        "price_from": uni["price_from"],
        "price_to": uni["price_to"],
        "website": "",
        "description": f"Университет в городе {uni['city']}",
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
        "address": f"Город {uni['city']}",
        "is_top": uni["is_top"]
    })

# Сохраняем в файл
data = {
    "cities": cities,
    "universities": universities,
    "specialties": [
        {"id": 1, "name": "Информационные технологии", "category": "IT"},
        {"id": 2, "name": "Программная инженерия", "category": "IT"},
        {"id": 3, "name": "Кибербезопасность", "category": "IT"},
        {"id": 4, "name": "Искусственный интеллект", "category": "IT"},
        {"id": 5, "name": "Экономика", "category": "Экономика"},
        {"id": 6, "name": "Финансы", "category": "Экономика"},
        {"id": 7, "name": "Бизнес", "category": "Экономика"},
        {"id": 8, "name": "Медицина", "category": "Здоровье"},
        {"id": 9, "name": "Сестринское дело", "category": "Здоровье"},
        {"id": 10, "name": "Педагогика", "category": "Образование"},
        {"id": 11, "name": "Начальное образование", "category": "Образование"}
    ],
    "grants": [
        {"id": 1, "name": "Государственный грант", "type": "government", "amount": "Полное покрытие", "description": "Основной государственный грант", "requirements": ["Высокий ЕНТ (850+)"], "deadline": "После ЕНТ", "link": "https://www.edu.gov.kz"},
        {"id": 2, "name": "Грант Болашак", "type": "government", "amount": "до 2000 USD/год", "description": "Программа поддержки одаренной молодежи", "requirements": ["Отличные оценки"], "deadline": "Февраль-март", "link": "https://bolashak.gov.kz"}
    ],
    "tips": [
        {"id": 1, "title": "Как выбрать университет", "category": "Советы", "content": "Выбирайте вуз, ориентируясь на рейтинги, специальности и цены.", "tip": "Не выбирайте только по цене"},
        {"id": 2, "title": "Подготовка к ЕНТ", "category": "Советы", "content": "Начните подготовку за 6 месяцев. Решайте тесты каждый день.", "tip": "ЕНТ - это не только знания"}
    ]
}

with open('backend/data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✓ Создан data.json с {len(universities)} университетами")
print(f"✓ ТОП-20: {sum(1 for u in universities if u['is_top'])}")
print(f"✓ Остальные: {sum(1 for u in universities if not u['is_top'])}")
print(f"✓ Городов: {len(cities)}")
