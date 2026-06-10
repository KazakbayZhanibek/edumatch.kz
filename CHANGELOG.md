# Changelog — EduMatch KZ

## Июнь 2026 — Major Update

### 1. Объяснение скоринга (Scoring Breakdown)

**Файл:** `backend/admission-service.js`

Каждый ответ теперь показывает **вклад каждого фактора** в итоговый шанс:

| Фактор | Макс. баллов | Описание |
|--------|-------------|----------|
| ЕНТ | 40 | Сравнение с min/avg/grant порогами |
| Бюджет | 15 | Цена vs бюджет пользователя |
| Язык обучения | 10 | Совпадение языка |
| Общежитие | 10 | Наличие общежития |
| Специальность | 28 | Наличие программы + конкурс |
| Аттестат | 5 | GPA 4.8+ → 5, 4.3+ → 3, 3.5+ → 1 |
| Штрафы | −∞ | Грант-разрыв, минимум, конкурс |

**Функция:** `buildScoreBreakdown()` — возвращает массив объектов `{key, label, score, maxScore, detail, impact}`

**Фронтенд:** Цветные горизонтальные бары в `renderAdmissionChatCards()`

---

### 2. What-if сценарии

**Файл:** `backend/admission-service.js`

Автоматический пересчёт шансов для **+5, +10, +15 ЕНТ** по топ-3 вузам:

```json
{
  "whatIf": [
    { "ent": 115, "universities": [{ "university": "МУИТ", "from": 45, "to": 55 }] },
    { "ent": 120, "universities": [{ "university": "МУИТ", "from": 45, "to": 65 }] }
  ]
}
```

**Фронтенд:** Блок "📈 Что если ЕНТ вырастет?" под карточками

---

### 3. Портфель вузов (Safe/Target/Ambitious)

**Файл:** `backend/admission-service.js`

Классификация по шансам:
- 🟢 **Безопасный** (safe): ≥75%
- 🟡 **Целевой** (target): 45–74%
- 🔴 **Амбициозный** (ambitious): <45%

**Функции:** `portfolioType(chance)`, `portfolioLabel(type, lang)`

**Фронтенд:** Цветные badge в каждой карточке

---

### 4. Сессионная память параметров

**Файл:** `backend/ai-service.js`

Извлечение параметров из предыдущих сообщений:
- ЕНТ балл
- Бюджет
- Язык обучения
- Общежитие

**Функция:** `extractParamsFromHistory(history)` — парсит историю сообщений

**Логика:** `parseAdmissionQuery(msg)` → если параметр не найден → `extractParamsFromHistory(history)` → merge

**Подтверждение:** "📌 Использую из предыдущего сообщения: ЕНТ 110"

---

### 5. Связка специальность → профессия → зарплата

**Файл:** `backend/profession-data.js`, `backend/ai-prompts.js`

Добавлена функция `getProfessionsByCategory(category)` — маппинг категорий специальностей на профессии.

В ответе по поступлению автоматически добавляется блок:
```
---
💼 **Программист** — Разрабатывает ПО...
💰 Зарплата: 350 000 — 1 500 000₸ (ср. 700 000₸)
📊 Спрос: Очень высокий
```

---

### 6. Онбординг для неопределившихся

**Файл:** `backend/ai-service.js`

**Intent:** `onboarding`

**Триггеры:** "не знаю что выбрать", "помоги определиться", "не могу выбрать"

**Флоу:**
1. Задаёт 3–4 уточняющих вопроса (ЕНТ, специальность, город, бюджет)
2. После ответа → автоматически переходит к рекомендации

---

### 7. Дедлайны и календарь поступления

**Файл:** `backend/ai-service.js`

**Intent:** `deadlines`

**Триггеры:** "дедлайны", "сроки", "когда подавать", "чеклист"

**Календарь на 3 языках (RU/KK/EN):**
- Февраль–Март: Подготовка к ЕНТ
- 1 Мая: Регистрация на ЕНТ
- 1–20 Июня: Сдача ЕНТ
- 1–25 Июля: Подача документов
- 5–10 Августа: Зачисление
- 15–25 Августа: Оплата обучения
- 1 Сентября: Начало занятий

---

### 8. Исправленные баги

| Баг | Причина | Исправление |
|-----|---------|-------------|
| Двойной вывод | `matches: unis.slice(0,5)` | `matches: []` |
| "Кем работать с IT" → city | fuzzy "it"→"city" | Profession проверка ДО for loop |
| "Привет!" → general | regex `^...$` не допускал `!` | `(?:[!?.]+)?$` |
| "Посоветуй вуз на IT" → city | fuzzy "it"→"city" в keywords | Убрано "city" из keywords |
| "Погода завтра" → recommendation | fuzzy "какая"→"какой" | Off-topic маркеры |
| Profession/general возвращали matches | `universities.slice(0,5)` | `matches: []` |

---

### 9. Intent система (11 интентов)

| Intent | Триггеры | Handler |
|--------|----------|---------|
| `greeting` | Привет, Здарова, Hello | Заготовленный ответ |
| `help` | Что умеешь, Помощь | Список функций |
| `admission` | Мои шансы, Поступлю ли | `handleAdmissionChatQuery` |
| `recommendation` | Дай список, Посоветуй | `handleRecommendationQuery` |
| `city` | Какие вузы в [город] | `handleCityQuery` |
| `comparison` | Сравни, Отличие | `handleComparisonQuery` |
| `grant` | Гранты, Стипендия | `handleGrantQuery` |
| `profession` | Кем работать, Зарплата | `handleProfessionQuery` |
| `onboarding` | Не знаю что выбрать | `handleOnboardingQuery` |
| `deadlines` | Дедлайны, Сроки | `handleDeadlinesQuery` |
| `general` | Остальное | OpenRouter LLM |

---

### 10. Файловая структура

```
backend/
├── ai-service.js          — Основная логика (2400+ строк)
├── ai-prompts.js          — Промпты для LLM
├── admission-service.js   — Расчёт шансов + scoreBreakdown + whatIf
├── admission-calculator.js — Гибридный калькулятор (API)
├── admission-explanation-service.js — AI-объяснения
├── profession-data.js     — 12 профессий с ЗП
├── db.js                  — Запросы к БД
├── database.js            — SQLite подключение
├── i18n.js                — Переводы (RU/KK/EN)
├── auth-service.js        — Авторизация
├── server.js              — Express сервер
└── edumatch.db            — SQLite БД

frontend/
├── css/main.css           — Стили (3700+ строк)
├── js/app.js              — Основная логика (2500+ строк)
├── js/translations.js     — Переводы UI (2300+ строк)
└── index.html             — Главная страница
```

---

### 11. Правила разработки (awesome-rules-main)

Используются правила из `awesome-rules-main/rules/`:

- **Express.js API Development** — структура middleware, error handling
- **Robust Error Handling** — custom error classes, retry logic
- **Secure Coding Practices** — input validation, SQL injection prevention
- **General Coding Standards** — naming, DRY, SOLID

---

### 12. Telegram уведомления

Скрипт: `C:\Users\Janchik\Desktop\telegram-notify\notify.js`

Формат:
```bash
node notify.js "✅ Задача выполнена — результат"
```

---

### Запуск сервера

```bash
cd backend && node server.js
```

Порт: 3000

---

### База данных

- 46 университетов
- 35 специальностей (11 категорий)
- 468 university_specialty связей
- 463 admission_requirements
- 351 грантов (304 с university_id)
- 16 городов
- 12 профессий
