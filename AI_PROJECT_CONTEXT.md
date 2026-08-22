# EduMatch KZ — контекст проекта для другой ИИ

## 1. Назначение проекта

EduMatch KZ — трёхъязычная образовательная платформа для абитуриентов Казахстана. Она помогает:

- искать университеты;
- фильтровать вузы по городу, стоимости, специальности и языку обучения;
- сравнивать от 2 до 3 университетов;
- получать консультации ИИ;
- рассчитывать шансы поступления;
- находить государственные, региональные, корпоративные и университетские гранты;
- проходить профориентационный тест;
- смотреть вузы на интерактивной карте;
- читать советы абитуриентам;
- регистрироваться, сохранять избранное и просматривать историю активности.

Основная бизнес-идея: объединить фактические данные о вузах и грантах с детерминированным расчётом поступления и ИИ-консультацией.

Главные документы:

- `README.md` — краткое описание, частично устаревшее;
- `DOCUMENTATION.md` — более подробное описание;
- `backend/schema.sql` — актуальный источник структуры БД;
- `backend/server.js` — актуальная точка входа backend.

## 2. Технологический стек

### Backend

- Node.js;
- Express 5;
- SQLite через `better-sqlite3`;
- JWT для авторизации;
- bcrypt для хеширования паролей;
- OpenRouter API для LLM;
- `node-fetch` для HTTP-вызовов к ИИ;
- Helmet для security headers;
- CORS;
- compression;
- cookie-parser.

### Frontend

- Vanilla HTML/CSS/JavaScript;
- SPA без React, Vue и других frontend-фреймворков;
- Leaflet 1.9.4 и OpenStreetMap для карты;
- AOS для scroll-анимаций;
- Swiper;
- Notyf для уведомлений;
- NProgress для индикации загрузки;
- Marked для Markdown-ответов ИИ;
- DOMPurify для очистки HTML;
- Google Fonts: Instrument Serif и Inter.

## 3. Структура проекта

```text
edumatch-kz/
├── frontend/
│   ├── index.html                  # Вся HTML-структура SPA
│   ├── css/main.css                # Стили, темы, адаптивность
│   └── js/
│       ├── app.js                  # Основная логика SPA
│       ├── auth.js                 # Авторизация и профиль
│       └── translations.js         # RU/KK/EN переводы
├── backend/
│   ├── server.js                   # Express, middleware, API, статика
│   ├── database.js                 # SQLite и миграции
│   ├── db.js                       # Data access layer
│   ├── schema.sql                  # Схема SQLite
│   ├── ai-service.js               # AI pipeline и intent classification
│   ├── ai-controller.js            # Контроллер ИИ-запросов
│   ├── ai-routes.js                # AI routes
│   ├── ai-prompts.js               # Системные промпты
│   ├── i18n.js                     # Backend-переводы
│   ├── auth-service.js             # Регистрация, JWT, сессии
│   ├── auth-middleware.js          # Auth middleware
│   ├── auth-routes.js              # Auth/profile routes
│   ├── admission-service.js        # Старый rule-based admission flow
│   ├── admission-calculator.js     # Новый deterministic calculator
│   ├── admission-explanation-service.js # AI explanation
│   ├── admission-routes.js         # Admission API
│   ├── edumatch.db                # SQLite database, если создана
│   ├── scripts/                    # Загрузка и seed данных
│   └── _tests/                     # Дополнительные тесты
├── Parcerscript/                   # Скрипты подготовки данных
├── universities_cards.md           # Материалы по карточкам вузов
├── package.json                    # Корневые команды
└── AI_PROJECT_CONTEXT.md           # Этот handoff-файл
```

## 4. Запуск

Из корня:

```powershell
npm install
npm start
```

Или напрямую:

```powershell
cd backend
npm install
node server.js
```

Адрес приложения:

```text
http://localhost:3000
```

Корневые npm-команды:

```text
npm start       -> cd backend && node server.js
npm run dev     -> cd backend && node server.js
npm run seed    -> cd backend && node scripts/seed-admission-stats.js
npm run db:init -> cd backend && node scripts/load-full-data.js
npm test        -> cd backend && node test-automated.js
```

В `backend/package.json` тестовый script является заглушкой, но корневой `npm test` запускает `backend/test-automated.js`.

При старте `backend/server.js`:

1. загружает `.env` через `dotenv`;
2. проверяет обязательный `JWT_SECRET`;
3. вызывает `initDatabase()`;
4. подключает SQLite;
5. выполняет `schema.sql` для новой БД;
6. применяет ограниченные миграции для старой БД;
7. настраивает Helmet, CORS, compression, JSON parser и cookies;
8. раздаёт `frontend/` как статические файлы;
9. подключает API-роутеры;
10. запускает Express на `PORT`.

Секреты из `.env` нельзя помещать в документацию, коммиты, ответы другой ИИ или логи. При подозрении на утечку OpenRouter API key или JWT secret их нужно заменить.

## 5. Backend-архитектура

### Точка входа

`backend/server.js` отвечает за:

- запуск приложения;
- middleware;
- security headers;
- CORS;
- раздачу frontend;
- простые data endpoints;
- подключение `ai-routes`, `admission-routes` и `auth-routes`;
- reviews и analytics endpoints;
- graceful shutdown.

### Слой базы данных

`backend/database.js`:

- открывает `backend/edumatch.db`;
- создаёт базу, если файла нет;
- выполняет `schema.sql`;
- добавляет отдельные недостающие колонки и таблицы для старых БД;
- предоставляет `getDb()` и `closeDb()`.

`backend/db.js`:

- скрывает SQL-детали от routes;
- возвращает университеты, города, гранты, советы и специальности;
- поддерживает фильтрацию и сортировку;
- парсит JSON-поля;
- выбирает описание на нужном языке;
- старается избегать N+1-запросов при загрузке специальностей университетов.

SQLite используется синхронно через `better-sqlite3`, поэтому тяжёлые операции могут блокировать event loop.

## 6. Frontend-архитектура

`frontend/index.html` содержит все страницы SPA внутри одного документа. Навигация выполняется JavaScript-функцией `navigate(page, param)`.

Основные страницы:

- `home` — каталог университетов;
- `university` — детали одного вуза;
- `compare` — сравнение;
- `advisor` — ИИ-советник;
- `admission` — расчёт шансов;
- `career` — профориентация;
- `grants` — гранты;
- `map` — карта;
- `tips` — советы;
- `login` — вход;
- `register` — регистрация;
- `profile` — личный кабинет.

Глобальное состояние находится в `frontend/js/app.js`:

```javascript
state = {
  universities: [],
  compareList: [],
  favoriteList: [],
  trackerList: [],
  chatHistory: [],
  chatHistoryLoaded: false,
  admissionLastResult: null,
  currentPage: 'home'
}
```

API base URL:

- локально: `http://localhost:3000/api`;
- в production: `/api`.

Frontend хранит локальные данные в `localStorage`:

- язык;
- тема;
- избранное гостя;
- tracker поступления;
- пользовательские данные.

## 7. API: данные

### Города

```text
GET /api/cities
```

Возвращает города и количество университетов в каждом городе.

### Университеты

```text
GET /api/universities
GET /api/universities/:id
```

Параметры списка:

- `sort=qs_world`;
- `sort=price_asc`;
- `sort=price_desc`;
- `price_max`;
- `specialty`;
- `language`;
- `city_id`;
- `is_top=top`;
- `lang=ru|kk|en`.

`is_top=top` выбирает 20 лучших вузов по QS World, QS Asia и дополнительным параметрам.

### Сравнение

```text
GET /api/compare?ids=1,2,3&lang=ru
```

Разрешены 2 или 3 ID. При одном ID сервер возвращает 400, больше трёх — тоже 400.

### Специальности

```text
GET /api/specialties
GET /api/admission/specialties
GET /api/admission/options
```

`/api/admission/options` — legacy endpoint на основе фиксированной карты специальностей.

### Гранты

```text
GET /api/grants?lang=ru
```

### Советы

```text
GET /api/tips
```

### Диагностический endpoint

```text
GET /api/test-specialties
```

Это тестовый endpoint, который напрямую читает специальности из БД. При production-очистке его нужно отдельно оценить.

## 8. AI Advisor

Основной endpoint:

```text
POST /api/ai/advice
```

Body:

```json
{
  "message": "Сравни КБТУ и МУИТ",
  "history": [],
  "lang": "ru"
}
```

Ограничения:

- сообщение должно быть длиной от 2 до 2000 символов;
- история ограничивается последними 20 элементами;
- применяется rate limit около 30 запросов в минуту;
- авторизованные сообщения могут сохраняться в `chat_history`.

Pipeline:

1. определить язык сообщения;
2. определить intent;
3. извлечь параметры из текста;
4. получить фактический контекст из SQLite;
5. сформировать system prompt;
6. вызвать OpenRouter;
7. нормализовать ответ;
8. вернуть ответ frontend;
9. отобразить Markdown после очистки DOMPurify.

Intent:

- `greeting`;
- `help`;
- `comparison`;
- `admission`;
- `recommendation`;
- `grant`;
- `uni_info`;
- `city`;
- `onboarding`;
- `deadlines`;
- `profession`;
- `general`.

Классификация основана на regex, ключевых словах, fuzzy matching и предыдущем intent в истории.

AI personalities:

- `professional` — экспертный структурированный ответ;
- `friendly` — дружелюбный ответ;
- `concise` — краткий ответ;
- `detailed` — подробный ответ с примерами.

Основной AI-вызов использует настройки OpenRouter из `.env`, например модель Gemini 2.5 Flash. Есть timeout, повторные попытки и fallback, если провайдер недоступен.

ИИ не должен придумывать цены, рейтинги, гранты, проходные баллы или контакты. Фактические данные нужно брать из БД.

## 9. Admission Predictor

В проекте есть два разных admission-потока.

### Старый rule-based поток

```text
POST /api/admission/predict
```

Вход:

- `ent`;
- `attestat`;
- `cityId`;
- `specialty`;
- `budget`;
- `language`;
- `needDorm`.

Логика находится в `backend/admission-service.js` и учитывает:

- ЕНТ;
- аттестат;
- бюджет;
- язык обучения;
- наличие общежития;
- конкуренцию.

### Новый статистический поток

```text
POST /api/admission/calculate
```

Пример:

```json
{
  "entScore": 110,
  "gpa": 4.5,
  "specialtyId": 1,
  "cityId": 1,
  "budgetMax": 2500000,
  "language": "ru",
  "needsDorm": true,
  "useAiExplanation": true
}
```

Алгоритм в `backend/admission-calculator.js`:

1. валидирует `entScore` от 0 до 140;
2. валидирует GPA от 0 до 5;
3. ищет `specialtyId`;
4. ищет подходящие записи `admission_chance_stats`;
5. проверяет год, диапазон ЕНТ, город, язык, бюджет, GPA и общежитие;
6. сортирует по confidence и числу заявителей;
7. возвращает matches с процентом вероятности;
8. при необходимости вызывает AI explanation service.

ИИ в этом процессе должен только объяснять уже рассчитанные числа. Он не должен менять процент шанса.

### ИИ-объяснение

```text
POST /api/admission/explain
```

Также может быть вызвано через `useAiExplanation` в `/calculate`.

Fallback используется, если OpenRouter недоступен.

### Сохранение истории

```text
POST /api/admission/save-history
```

Для гостей результат может остаться только локально. Для авторизованных сохраняется в `prediction_history` и иногда в `test_results`.

## 10. Гранты

Гранты разделены на типы:

- `government`;
- `regional`;
- `corporate`;
- `university`.

Карточка гранта содержит:

- название;
- тип;
- сумму;
- описание;
- требования;
- deadline;
- ссылку;
- связанные специальности.

Требования хранятся в SQLite как JSON-массивы. Переводы могут храниться в отдельных колонках для казахского и английского языков.

## 11. Профориентация

Тест состоит примерно из 8 вопросов. Ответы имеют веса по категориям:

- IT;
- медицина;
- бизнес;
- инженерия;
- образование.

После теста frontend показывает:

- рейтинг категорий;
- топ специальностей;
- подходящие университеты;
- профиль профессии;
- примерную зарплату;
- востребованность;
- карьерный рост.

Результаты могут сохраняться в `test_results`.

## 12. Карта

Используется Leaflet и OpenStreetMap.

Координаты находятся в `universities.lat` и `universities.lng`.

Функции карты:

- маркеры университетов;
- popup с названием и стоимостью;
- переход к деталям вуза;
- кластеризация;
- фильтрация по городам и текущим результатам;
- автоматический `fitBounds`;
- обновление масштаба при фильтрации.

В `frontend/js/app.js` предусмотрена задержка и проверка размеров контейнера перед инициализацией карты, чтобы она корректно загружалась при переходе на SPA-страницу.

## 13. Авторизация

Основные endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/verify
GET  /api/users/profile
PUT  /api/users/profile
POST /api/auth/change-password
```

Избранное:

```text
GET    /api/saved-universities
POST   /api/saved-universities
DELETE /api/saved-universities/university/:id
```

История чата:

```text
GET    /api/chat-history
DELETE /api/chat-history/:id
```

Результаты тестов:

```text
GET    /api/test-results
POST   /api/test-results
DELETE /api/test-results/:id
```

Требования к паролю:

- минимум 12 символов;
- минимум одна заглавная буква;
- минимум одна цифра;
- минимум один специальный символ.

Пароли хешируются bcrypt с 10 раундами.

JWT действует 7 дней и записывается в `user_sessions`.

Frontend использует `credentials: include` и httpOnly cookies. Сам JWT не должен храниться в `localStorage`. В `localStorage` хранится только безопасная информация о текущем пользователе и локальные пользовательские данные.

Избранное:

- гость — `localStorage`;
- авторизованный пользователь — `saved_universities`;
- при входе локальное избранное объединяется с серверным;
- при восстановлении сессии избранное синхронизируется.

## 14. Reviews и Analytics

Отзывы:

```text
GET  /api/universities/:id/reviews
POST /api/universities/:id/reviews
```

Отзыв содержит имя, рейтинг 1–5, плюсы, минусы, комментарий, факультет и год обучения.

Есть in-memory rate limit: максимум 3 отзыва за 5 минут на IP.

Аналитика:

```text
GET /api/analytics/top-queries
GET /api/analytics/stats
```

Используется таблица `query_log`. Собираются intent, язык, количество запросов и среднее время ответа.

Администратор:

```text
GET /api/admin/academic-year
PUT /api/admin/academic-year
```

Изменение учебного года требует JWT и admin-права. Формат: `YYYY-YYYY`.

## 15. База данных

Актуальный `schema.sql` определяет 18 таблиц:

1. `cities` — города;
2. `specialties` — специальности и категории;
3. `universities` — университеты;
4. `university_specialties` — связь университетов со специальностями;
5. `grants` — гранты;
6. `grant_specialties` — связь грантов со специальностями;
7. `tips` — советы;
8. `users` — пользователи;
9. `saved_universities` — избранное;
10. `user_sessions` — JWT-сессии;
11. `chat_history` — история ИИ-чата;
12. `test_results` — результаты тестов;
13. `admission_requirements` — минимальные требования поступления;
14. `prediction_history` — история прогнозов;
15. `admission_chance_stats` — историческая статистика шансов;
16. `reviews` — отзывы;
17. `query_log` — аналитика AI-запросов;
18. `audit_log` — аудит изменений.

Связи:

```text
cities -> universities
universities <-> specialties
grants <-> specialties
users -> saved_universities
users -> user_sessions
users -> chat_history
users -> test_results
universities + specialties -> admission_requirements
admission_chance_stats -> universities
admission_chance_stats -> specialties
admission_chance_stats -> cities
admission_chance_stats -> grants
```

JSON-поля:

- `universities.languages`;
- `universities.accreditations`;
- `grants.requirements`;
- `users.preferences`;
- `test_results.result_data`;
- `chat_history.context`.

## 16. Переводы

Поддерживаются языки:

- `ru` — русский;
- `kk` — казахский;
- `en` — английский.

Frontend-механизм:

```html
data-i18n="key"
data-i18n-placeholder="key"
data-i18n-title="key"
```

JavaScript-механизм:

```javascript
t('translation.key')
```

Текущий язык сохраняется в `localStorage`.

Backend использует `tr(key, lang)` из `backend/i18n.js`.

Переводные поля БД включают описания университетов и названия, описания и требования грантов.

## 17. Известные расхождения и риски

Документация проекта частично устарела. Всегда приоритет у текущего кода и реальной БД.

### Устаревший README

Старый README упоминает:

- `sql.js`, хотя код использует `better-sqlite3`;
- прямой Gemini API, хотя код использует OpenRouter;
- 7 таблиц, хотя актуальная схема содержит 18;
- `migration.js`, которого нет среди основных текущих файлов;
- автоматический seed всех данных, хотя часть данных загружается отдельными скриптами.

### Schema drift для грантов

`backend/db.js` читает поля:

- `name_kk`;
- `name_en`;
- `requirements_kk`;
- `requirements_en`.

В базовой версии `schema.sql` не все эти колонки объявлены. Миграции в `database.js` также добавляют не все из них.

Перед изменением `/api/grants` нужно проверить реальную БД:

```sql
PRAGMA table_info(grants);
```

Если колонок нет, нужно синхронно обновить `schema.sql` и миграцию.

### Auth cookie/Bearer

Frontend отправляет httpOnly cookie через `credentials: include`. Некоторые optional-auth-пути исторически ориентированы на Bearer header. При изменении авторизации нужно проверить `auth-middleware.js`, `auth.js`, AI и admission routes вместе.

### CORS

Код `server.js` использует `ALLOWED_ORIGINS`, а в `.env` может быть указана похожая переменная `CORS_ORIGIN`. Нужно использовать одно согласованное имя и проверить production-конфигурацию.

### Academic year

Admission calculator может брать календарный текущий год через `new Date().getFullYear()`, а фактические записи БД могут быть подготовлены для учебного года вроде `2025-2026`. Перед расчётом нужно убедиться, что год статистики соответствует UI и данным.

### Health endpoint

В `server.js` health-check находится рядом с fallback для frontend. После изменения порядка middleware проверить, что `GET /health` действительно возвращает JSON, а не `index.html`.

### Безопасность

Нельзя:

- выводить `.env`;
- добавлять API keys в код;
- хранить JWT в `localStorage`;
- использовать невалидированные SQL-строки;
- доверять AI как источнику фактических данных;
- отключать CSP, Helmet или CORS-проверки без причины.

## 18. Правила для другой ИИ

Перед изменением:

1. Проверить актуальный исходник и соседние вызовы.
2. Не полагаться только на `README.md`.
3. Найти frontend-вызов каждого изменяемого API.
4. Сохранить публичный контракт, если задача явно не требует его изменения.
5. Для SQL использовать параметры, а не конкатенацию пользовательского ввода.
6. При изменении БД обновлять и `schema.sql`, и миграции.
7. Сохранять RU/KK/EN.
8. Не смешивать старый и новый admission flow без явной причины.
9. Не давать ИИ изменять детерминированные числовые результаты.
10. Не удалять пользовательские изменения в рабочем дереве.
11. После backend-изменений запускать узкий тест или API-проверку.
12. После frontend-изменений проверять соответствующий сценарий в браузере.
13. Не делать большой рефакторинг `app.js` ради небольшой задачи.
14. Проверять реальные колонки SQLite перед работой с переводами грантов.
15. Не публиковать секреты и не включать их в handoff-документацию.

## 19. Краткая инструкция для начала работы

Перед любой задачей другой ИИ должна:

1. открыть `AI_PROJECT_CONTEXT.md`;
2. проверить текущий `git diff`;
3. найти конкретный файл и функцию, которые управляют поведением;
4. изучить ближайший frontend-вызов или backend route;
5. сформулировать локальную гипотезу о причине проблемы;
6. сделать минимальное изменение;
7. сразу запустить узкую проверку;
8. только затем расширять исправление при необходимости.
