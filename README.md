# EduMatch KZ

Платформа для сравнения университетов Алматы с ИИ-советником на базе Gemini.

## Структура проекта

```
edumatch-kz/
├── backend/
│   ├── server.js              — Express API сервер
│   ├── db.js                  — SQLite connection API
│   ├── database.js            — Инициализация БД и подключение
│   ├── migration.js           — Миграция и SEED данных
│   ├── schema.sql             — SQL схема (7 таблиц)
│   ├── ai-controller.js       — Контроллер для ИИ запросов
│   ├── ai-routes.js           — Роуты для ИИ
│   ├── ai-service.js          — Сервис работы с Gemini
│   ├── ai-prompts.js          — Шаблоны промптов
│   ├── edumatch.db            — SQLite база данных
│   ├── package.json
│   └── .env                   — переменные окружения
├── frontend/
│   ├── index.html             — Single Page Application
│   ├── css/
│   │   └── main.css           — Все стили + темная тема
│   └── js/
│       └── app.js             — Вся логика SPA
├── Parcerscript/              — Скрипты для парсинга данных
│   ├── analyze_cities.py
│   ├── parse_excel.py
│   ├── parse_top_unis.py
│   └── ...
└── README.md
```

## База данных (SQLite)

**Таблицы (7 шт.):**
- `cities` — города (Алматы, в будущем другие города Казахстана)
- `universities` — вузы с рейтингами (QS World, QS Asia), ценами, описанием
- `specialties` — специальности с категориями
- `university_specialties` — связь вузов и специальностей (M2M)
- `grants` — гранты с условиями
- `grant_specialties` — связь грантов и специальностей (M2M)
- `tips` — советы для абитуриентов

**Миграция данных:**
- 15 вузов с полной информацией
- 35 специальностей в категориях
- 13 грантов
- 6 советов

База создаётся автоматически при первом запуске (`node server.js`).

## Требования

- **Node.js**: версия 22.20.0 (LTS) или выше
- **npm**: 10.x+

Проверьте версию:
```bash
node --version
npm --version
```

## Установка и запуск

### 1. Установите зависимости

```bash
cd backend
npm install
```

### 2. Создайте файл окружения (опционально)

```bash
cp .env.example .env
```

Заполните `.env`:
```
PORT=3000
GEMINI_API_KEY=ваш_ключ_здесь   # можно вводить прямо на сайте
```

### 3. Запустите сервер

```bash
node server.js
```

**Первый запуск:**
- Создаёт SQLite БД (`edumatch.db`)
- Применяет схему из `schema.sql`
- Выполняет миграцию данных из `migration.js` (идемпотентная)

**Ожидаемый вывод:**
```
✓ Database connected: edumatch.db
✓ Schema initialized
✓ Data migrated
✓ AI routes loaded
✓ Server running on http://localhost:3000
```

### 4. Откройте браузер

```
http://localhost:3000
```

## API Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/universities | Список вузов с фильтрами |
| GET | /api/universities/:id | Детали вуза со специальностями |
| GET | /api/compare?ids=1,2,3 | Сравнение 2-3 вузов |
| GET | /api/specialties | Категории специальностей |
| GET | /api/grants | Доступные гранты |
| GET | /api/tips | Советы абитуриентам |
| POST | /api/ai-advisor | Запрос к Gemini |

### Параметры фильтрации (GET /api/universities)

- `sort` — `qs_world`, `price_asc`, `price_desc`
- `price_max` — максимальная стоимость в год (тенге)
- `specialty` — название категории специальности
- `language` — язык обучения (казахский, русский, английский)

## Этапы разработки

**Stage 1 (Current):**
- ✅ Миграция данных с JSON на SQLite
- ✅ Нормализованная 7-таблица схема
- ✅ Поддержка грантов и советов
- ✅ ИИ-советник через Gemini API
- ✅ Полная фильтрация и сравнение

**Future Stages:**
- Admin panel для CRUD операций
- Web scraper для обновления данных
- Расширение на другие города Казахстана
- Продвинутое кэширование и индексирование

## Технологии

- **Frontend**: Vanilla HTML/CSS/JS, SPA без фреймворков
- **Backend**: Node.js + Express
- **База данных**: SQLite (через sql.js)
- **ИИ**: Пока в бете
- **Дизайн**: Светлая + тёмная тема, шрифты Instrument Serif + Geist
