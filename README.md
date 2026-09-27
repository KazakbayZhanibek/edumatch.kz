# EduMatch KZ — помощник поступления в вузы Казахстана

> Единая платформа для абитуриента: каталог вузов, сравнение, калькулятор шансов по ЕНТ,
> каталог грантов, профориентация, карта вузов и ИИ-агент, который строит проверяемый
> персональный план поступления — от анкеты до чек-листа действий.

**Трек:** EdTech / цифровые сервисы для образования.

**Статус:** рабочий прототип (хакатон, сентябрь 2026). Основной пользовательский сценарий
выполняется end-to-end локально, в том числе без API-ключа внешней LLM.

---

## Оглавление

1. [Проблема и ценность](#1-проблема-и-ценность)
2. [Демо за 5 минут](#2-демо-за-5-минут)
3. [Функциональность прототипа](#3-функциональность-прототипа)
4. [Архитектура и техническая реализация](#4-архитектура-и-техническая-реализация)
5. [API — полный справочник](#5-api--полный-справочник)
6. [Установка и запуск](#6-установка-и-запуск)
7. [Данные: состав, источники, обновление, аудит](#7-данные-состав-источники-обновление-аудит)
8. [Тестирование](#8-тестирование)
9. [Безопасность](#9-безопасность)
10. [Практическая применимость](#10-практическая-применимость)
11. [Потенциал развития](#11-потенциал-развития)
12. [Честные ограничения прототипа](#12-честные-ограничения-прототипа)
13. [Структура репозитория и карта кода](#13-структура-репозитория-и-карта-кода)
14. [Деплой](#14-деплой)
15. [Команда и вклад](#15-команда-и-вклад)
16. [Лицензия](#16-лицензия)

---

## 1. Проблема и ценность

### 1.1. Какую конкретную проблему решает проект

Абитуриент в Казахстане должен одновременно учесть:

- баллы ЕНТ (0–140) и два профильных предмета;
- проходные баллы прошлых лет — отдельно на платное и на грант;
- стоимость обучения по годам (она растёт от курса к курсу);
- город, язык обучения, общежитие;
- гранты и стипендии: государственные, вузовские, корпоративные, региональные;
- сроки подачи документов (у каждого вуза свои, прошлогодние даты нельзя переносить на новый набор).

Эта информация разрознена по десяткам сайтов вузов, госпорталам и соцсетям.
Данные одного года легко принять за условия следующего набора, а «советы» из чатов
невозможно проверить. Родители чаще всего не могут помочь — правила меняются каждый год.

### 1.2. Для кого

| Аудитория | Что получает |
|---|---|
| **Абитуриенты 15–22 лет** | Короткий список подходящих программ + чек-лист «что проверить и куда пойти» |
| **Родители** | Понятные цифры: стоимость по годам, пороги ЕНТ, дедлайны — вместо слухов |
| **Школьные консультанты / образовательные центры** | Готовую структуру консультации: анкета → подбор → сравнение → план |

### 1.3. В чём ценность и отличие от «ещё одного чата»

Обычный чат-бот даёт текст, который нельзя проверить. EduMatch даёт **проверяемый результат**:

1. Параметры фиксируются в анкете, которую подтверждает сам пользователь.
2. Соответствие требованиям считает **детерминированный серверный код** по структурированным
   данным, а не языковая модель.
3. Рядом с каждым вариантом показаны **источники** (официальные страницы вузов)
   и честные статусы: `подтверждено` / `заблокировано` / `требует проверки`.
4. Результат превращается в **сохраняемый план** с шагами, отметками выполнения
   и повторной проверкой при следующем визите.
5. Модель не может назначить проходной балл, пообещать грант, изменить анкету,
   сохранить план или подать заявление — у агента нет таких инструментов.

### 1.4. Соответствие критериям технического отбора

| Критерий | Баллы | Где проверяется в репозитории |
|---|---|---|
| Проблема и ценность | 15 | Раздел 1 + §10: конкретная аудитория, конкретная боль, соответствие треку EdTech |
| Функциональность прототипа | 25 | Разделы 2–3: сквозной сценарий анкета → подбор → сравнение → план → перепроверка, три воспроизводимых сценария |
| Техническая реализация | 15 | Разделы 4–5: SPA + Express API + агент с 4 инструментами + серверные правила + SQLite связаны в один сценарий; карта кода в §13 |
| Практическая применимость | 15 | Раздел 10: кто и какую задачу закрывает уже сейчас; §12 — чего прототип не обещает |
| Потенциал развития | 20 | Раздел 11: roadmap ближайшее / среднее / долгое + бизнес-модель; отделено от готовых функций |
| README и воспроизводимость | 10 | Разделы 2, 6–8: запуск с нуля, тестовый стенд, тесты, аудиты, ожидаемые результаты сценариев |

---

## 2. Демо за 5 минут

### 2.1. Видео

- `artifacts/planner-full-demo.webm` — полный основной сценарий (подбор → сравнение → сохранение).
- `artifacts/planner-fallback-demo.webm` — тот же сценарий в режиме **без внешней модели**:
  работают только серверные правила, что явно указано. Все данные в видео вымышленные.

### 2.2. Живое демо локально

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# в .env достаточно сгенерировать JWT_SECRET, OPENROUTER_API_KEY можно оставить пустым
node server.js
# открыть http://localhost:3000
```

Пошагово (все шаги работают **без** `OPENROUTER_API_KEY`):

1. Зарегистрируйтесь или войдите.
2. Откройте раздел **«ИИ-советник»** → блок **«Помощник поступления: от подбора до плана»**.
3. Заполните анкету одним из сценариев ниже → **«Проверить и подобрать»**.
4. Выберите до 3 программ → **«Сравнить и составить план»** → явно подтвердите сохранение.
5. Откройте **«Профиль → Мои планы поступления»** → отметьте шаг → выполните повторную проверку.

### 2.3. Три воспроизводимых сценария (пилотный каталог: 6 программ AITU/МУИТ, группы B057/B058)

| Сценарий | Входные данные | Ожидаемый результат |
|---|---|---|
| **Обычный подбор** | ЕНТ 110; математика + информатика; B057; год 2027; бюджет 2 000 000 ₸; платное; любой язык и город | Варианты AITU и МУИТ «для дальнейшей проверки». Цена МУИТ 2026 года показывается только справочно и **не выдаётся** за цену набора 2027. Доступны сравнение и сохранение плана |
| **Ограниченный бюджет** | ЕНТ 110; математика + информатика; B057; год 2026; Алматы; бюджет 50 000 ₸; платное | Программы МУИТ исключаются (известная стоимость + истёкший срок 2026-08-25); AITU не соответствует городу. Система не называет неизвестную цену доступной |
| **Неподходящие предметы** | ЕНТ 110; биология + химия; B057; год 2027; бюджет 2 000 000 ₸; платное | Ноль совпадений + понятное объяснение несоответствия предметов. Никакой выдуманной рекомендации |

Граничные проверки валидации: ЕНТ 141, два одинаковых предмета, отрицательный бюджет,
год вне 2026–2030 — отклоняются с понятной ошибкой.

> Все сценарии используют вымышленные данные. Система не гарантирует зачисление или грант
> и не подаёт заявления.

### 2.4. Изолированный тестовый стенд (для проверяющих)

```bash
cd backend
node _tests/preview-fixture.js
# UI fixture: http://127.0.0.1:3037
```

- Создаёт **временную отдельную БД** в системной temp-папке, рабочая база не затрагивается.
- Предсозданные аккаунты стенда: `student@fixture.test` / `DemoPassword123!`
  (админ: `admin@fixture.test` / тот же пароль). **Не использовать эти реквизиты в проде.**
- После проверки остановить процесс — временная папка удаляется автоматически.

---

## 3. Функциональность прототипа

Фронтенд — одностраничное приложение (`frontend/index.html`, 12 страниц, vanilla JS без фреймворков):

`page-home` (главная) · `page-university` (карточка вуза) · `page-compare` (сравнение) ·
`page-advisor` (ИИ-советник + планировщик) · `page-admission` (калькулятор шансов) ·
`page-career` (профориентация) · `page-grants` (гранты) · `page-map` (карта) ·
`page-tips` (советы) · `page-login` / `page-register` · `page-profile` (кабинет, планы, трекер).

### 3.1. Каталог и сравнение университетов

- Карточки вузов: описание (RU/KK/EN), цены, рейтинги QS World / QS Asia, специальности,
  языки, город, контакты, сайт, отзывы с модерацией.
- Фильтры: `sort` (`qs_world`, `price_asc`, `price_desc`), `price_max`, `specialty`,
  `language`, `city_id`, `is_top`.
- Сравнение 2–3 вузов бок о бок с цветовой индикацией лучшего показателя
  (`GET /api/compare?ids=1,2,3`).
- Интерактивная карта на Leaflet 1.9.4 / OpenStreetMap: маркеры вузов, поиск, фильтр по городу.
- Код: `frontend/js/app.js`, `backend/db.js` (`getUniversities`, `getUniversity`).

### 3.2. ИИ-советник

- Мультиязычный чат (RU/KK/EN) с автоопределением языка.
- Двухуровневая классификация намерений (regex + LLM-fallback), 13 интентов
  (`backend/ai-service.js`, `VALID_INTENTS`):
  `greeting`, `help`, `comparison`, `admission`, `recommendation`, `grant`,
  `uni_info`, `city`, `onboarding`, `deadlines`, `profession`, `specialty_list`, `general`.
- 4 личности ответа (`backend/ai-prompts.js`, `PERSONALITIES`):
  professional, friendly, concise, detailed.
- Гибридный принцип: факты — из БД, числа — из калькулятора, модель только объясняет.
  Markdown-ответы рендерятся с санитизацией (DOMPurify).
- Без `OPENROUTER_API_KEY` работает ограниченный режим без внешней модели.
- Запросы логируются в `query_log` (аналитика: `GET /api/analytics/top-queries`, `/stats`).

### 3.3. Калькулятор шансов поступления

- Вход: баллы ЕНТ (целое 0–140), специальность, опционально город, бюджет, язык
  (казахский/русский/английский или kk/ru/en), общежитие.
- Движок `backend/admission-calculator.js`: поиск исторической статистики
  (`admission_chance_stats`) по специальности/году/диапазону баллов + правила
  (`calculateRulesScore`) с уровнями уверенности high/medium/low.
- Шкала в интерфейсе 4-уровневая: `chance-high` ≥ 85, `chance-mid` ≥ 65,
  `chance-low` ≥ 40, `chance-critical` < 40.
- `POST /api/admission/explain` — текстовое ИИ-объяснение результата;
  история расчётов — `GET /api/admission/history`.

### 3.4. Каталог грантов (v2)

- Поля записи: тип (government / university / corporate / regional / foundation /
  international / discount), покрытие (full / tuition_only / partial / unknown),
  сумма, дедлайн, способ подачи, документы, льготы, уровни обучения, коды программ,
  источник (`source_url`), статус верификации
  (`needs_review` / `verified` / `expired` / `rejected` / `source_unavailable`).
- Фильтры `GET /api/grants`: `q`, `type`, `city_id`, `university_id`, `coverage_type`,
  `academic_year`, `study_level`, `programme_code`, `status` / `verified_only`,
  `deadline_active`, `sort` (verified_first / deadline / newest / name), пагинация
  `limit` (≤100) / `offset`. Связи многие-ко-многим: `grant_universities`, `grant_cities`,
  `grant_specialties`.
- `POST /api/grants/match` (требует входа): персональный скоринг с тремя корзинами —
  `matched` / `needsClarification` / `notSuitable`, причины и предупреждения по каждой
  записи + дисклеймер о проверке условий у организатора.
- Сохранение грантов: `POST /api/grants/:id/save`, `GET /api/grants/saved/list`.
- Админ-верификация (`/api/admin/grants`): перевести в `verified` нельзя без
  `source_url`, `deadline`, `coverage_type` и `requirements`; все правки пишутся в `audit_log`.
- Примечательно: бэкенд-аудит (`backend/scripts/audit-grants.js`) переиспользует
  фронтенд-функции `deadlineStatus`/`today` из `frontend/js/grants.js` — одна логика дедлайнов везде.
- Код: `backend/grants-routes.js`, `frontend/js/grants.js`, `frontend/css/grants.css`.

### 3.5. Профориентационный тест

- 8 вопросов (`CAREER_QUESTIONS` в `frontend/js/app.js`), каждый ответ тегирован;
  взвешенный подсчёт по 5 направлениям: IT, медицина, бизнес, инженерия, образование.
- Результат: топ-3 специальности + справочник профессий (`backend/profession-data.js`):
  зарплата, востребованность, карьерный путь, навыки + привязка к вузам.
- Результаты сохраняются в `test_results` (`GET/POST /api/auth/test-results`).

### 3.6. Планировщик поступления с ИИ-агентом (ключевая хакатон-фича)

Путь: свободный текст → черновик анкеты (ИИ) → **подтверждение человеком** →
подбор → проверка ограничений → сравнение до 3 программ → сохранение чек-листа →
отметки шагов → повторная проверка снимка.

- **Пилотный каталог** (`backend/planner-catalogue.js`, сверка 2026-09-14): 6 программ —
  AITU: Software Engineering, Computer Science (B057), Cybersecurity (B058);
  МУИТ: 6B06101 «Компьютерные науки», 6B06110 «Программная инженерия» (B057),
  6B06301 «Компьютерная безопасность» (B058). 7 официальных источников с датой сверки
  и извлечёнными данными (пороги ЕНТ, цены МУИТ по курсам, сроки, AET-экзамен AITU,
  общежития, известный конфликт порогов AITU 70 vs 80).
- **4 инструмента агента** (`backend/planner-agent.js`), строгий порядок:
  `search_programmes` → `check_sources` → `check_requirements` → `finish_plan`.
  Сервер отвергает неизвестные инструменты, нарушение порядка и любые аргументы
  (инструменты вызываются без аргументов — изменить анкету через них нельзя).
- **Жёсткие лимиты:** ≤6 раундов модели, ≤10 вызовов инструментов, 25 сек общий бюджет,
  8 сек на запрос, `temperature: 0`, `max_tokens: 500`, `tool_choice: required`.
- **Fallback без выдумок:** без ключа, при ошибке провайдера, таймауте или
  невалидном ответе возвращается тот же детерминированный расчёт с пометкой
  `agent.mode = 'rules_fallback'` и причиной
  (`not_configured|provider_error|invalid_tool_response|unknown_tool|invalid_arguments|step_limit|timeout|tool_error`).
- **Серверные правила** (`backend/programme-planner.js`): предметы, город, бюджет
  (цена действует только при совпадении года + свежести сверки ≤30 дней, иначе `unverified`),
  ЕНТ (порог платное/грант по году; конфликт AITU всегда даёт предупреждение, а не цифру),
  дедлайн (истёкший = `blocked`), язык/общежитие/грант = `unverified` с задачей «уточнить».
  Итог программы: `blocked` (есть блокер) / `needs_review` (есть непроверенное) / `criteria_checked`.
- **Валидация анкеты:** ЕНТ целое 0–140; два разных предмета из 9
  (math, informatics, physics, chemistry, biology, geography, history, law, foreign_language);
  бюджет 0–100 000 000; год 2026–2030; группы B057/B058; funding paid/grant;
  language ru/kk/en/any; city Алматы/Астана/any. Анкета RU/KK.
- **Мониторинг источников** (`backend/planner-tools.js`, `planner-source-store.js`):
  проверка доступности страниц из разрешённого списка URL (таймаут 6 сек, без редиректов,
  лимит размера, кеш 5 мин), фиксация изменения хеша текста и пропажи ожидаемых фрагментов.
  Проверка **не подтверждает смысл** содержимого — только маркеры; предупреждение не снимается
  автоматически. История — последние 100 наблюдений на источник, только для админа.
- **Снимки планов:** сохранение только явным действием, ≤50 планов на пользователя,
  выбор 1–3 программ строго из подобранного списка; при чтении план **пересчитывается**
  по текущему каталогу и статусам источников (`planner-snapshot-review.js`),
  выполненные шаги и сам снимок не перезаписываются.
- Сетевой rate-limit планировщика: 10 запросов/мин на пользователя.

### 3.7. Личный кабинет

- Регистрация/вход/выход (JWT, сессии в `user_sessions`), профиль (ФИО, телефон, био,
  аватар с серверным сохранением и fallback на инициалы), смена пароля.
- Избранные вузы (синхронизация localStorage ↔ сервер).
- Трекер заявлений: collecting → submitted → waiting → accepted / enrolled / rejected.
- История чата, результаты тестов/расчётов, сохранённые гранты, планы поступления с задачами.
- Код: `frontend/js/auth.js`, `backend/auth-routes.js`, `backend/auth-service.js`.

### 3.8. Верификация документов

- Два типа: `ent` (ЕНТ-сертификат) и `military` (военный документ).
- Загрузка JPEG/PNG/WebP/PDF → автопроверка с fallback на ручную проверку админом;
  статусы, просмотр документа, отмена, ревью; срок хранения документов — 90 дней
  (`DOC_RETENTION_DAYS`, есть ручка `POST /api/verify/cleanup-documents` для админа).
- Уведомления: `GET /api/verify/notifications`.
- Код: `backend/verify-routes.js`, `frontend/js/verification.js`, `frontend/css/verification.css`.

### 3.9. Админ-панель (`frontend/admin.html`, `frontend/js/admin.js`)

Доступ только с ролью администратора (роль выдаётся **только** локальной CLI-командой,
см. §6.5). Возможности (`backend/admin-routes.js`):

- Обзорная статистика (`GET /api/admin/overview`).
- Пользователи: список, детали, правки, удаление, сброс пароля, роли.
- Вузы: CRUD (`GET/POST/PUT/DELETE /api/admin/universities...`), точечный `PATCH`.
- Гранты: список + `PATCH /api/admin/grants/:id/verify` (строгая верификация, см. §3.4).
- Отзывы: модерация/скрытие/удаление (`/api/admin/reviews`).
- Источники планировщика: статусы, история, ручная проверка
  (`/api/admin/sources...`, дублирует `GET /api/planner/sources/:id/history`).
- Аудит критических действий (`GET /api/admin/audit` ← таблица `audit_log`).
- Управление данными: источники, устаревшие записи, импорт CSV, дедлайны (`/api/data`).
- Академический год: `GET/PUT /api/admin/academic-year` (главная страница подтягивает его из API).

Отзывы публично: `GET/POST /api/universities/:id/reviews`.

---

## 4. Архитектура и техническая реализация

### 4.1. Общая схема

```text
┌──────────────────────────────────────────────────────────────┐
│  Frontend: Vanilla HTML/CSS/JS SPA (без фреймворков)         │
│  12 страниц · i18n RU/KK/EN · Leaflet · AOS · Swiper        │
│  Notyf · NProgress · DOMPurify                               │
└──────────────────────────────┬───────────────────────────────┘
                               │ REST JSON + JWT + CSRF
┌──────────────────────────────▼───────────────────────────────┐
│  Backend: Node.js + Express 5 (один процесс)                 │
│                                                              │
│  ┌───────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ Auth      │ │ AI Service │ │  Admission   │ │  Planner  │ │
│  │ JWT+CSRF  │ │ intents +  │ │  calculator  │ │  agent +  │ │
│  │ bcrypt    │ │ OpenRouter │ │  + history   │ │  rules    │ │
│  └───────────┘ └────────────┘ └──────────────┘ └───────────┘ │
│  ┌───────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Grants v2 │ │  Verify    │ │   Admin    │ │ Data/      │  │
│  │ catalog + │ │ ent/milit. │ │ CRUD+audit │ │ deadlines  │  │
│  │ matching  │ │ 90d retain │ │            │ │ sources    │  │
│  └───────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                              │
│  SQLite через better-sqlite3: schema.sql (23 таблицы)        │
│  + таблицы миграций (планы, сохран. гранты, источники, логи)  │
└──────────────────────────────────────────────────────────────┘
```

Один процесс Express отдаёт и API, и статику фронтенда; сборочного шага нет —
это осознанное решение для хакатон-прототипа (ноль времени сборки, деплой одной командой).

### 4.2. Ключевой принцип: гибридная архитектура

| Слой | Кто считает | Пример |
|---|---|---|
| Факты каталога | SQLite (`db.js`, `grants-routes.js`) | цены, пороги, дедлайны, ссылки |
| Числа и соответствие | Детерминированный код (`admission-calculator.js`, `programme-planner.js`) | шансы, `within/outside/unverified`, блокировки |
| Текст и разбор пожеланий | LLM через OpenRouter (`ai-service.js`, `planner-agent.js`) | объяснения, черновик анкеты |
| Контроль | Серверные валидаторы и лимиты | порядок инструментов, fallback, аудит |

Модель никогда не является источником истины для цифр и не имеет инструментов записи.

### 4.3. Схема агентного сценария

```text
Свободный текст
      │  POST /api/planner/interpret (auth + ключ) → черновик
      ▼
Человек проверяет и подтверждает анкету (RU/KK)
      │  POST /api/planner/agent (auth)
      ▼
search_programmes → check_sources → check_requirements → finish_plan
      │                   │                  │                  │
пилотный каталог   разрешённые URL    серверные правила   результат для UI
 (6 программ)      (7 источников)     (within/outside/
                                      unverified)
      ▼
Сравнение 1–3 → явное сохранение → задачи в профиле → перепроверка снимка
```

### 4.4. База данных

- `backend/schema.sql` — 23 базовые таблицы: `cities`, `specialties`, `universities`,
  `university_specialties`, `grants`, `grant_specialties`, `tips`, `users`,
  `password_resets`, `saved_universities`, `application_tracker`, `user_sessions`,
  `chat_history`, `test_results`, `admission_requirements`, `prediction_history`,
  `admission_chance_stats`, `reviews`, `query_log`, `audit_log`,
  `military_verifications`, `ent_uploads`, `notifications`.
- Миграции и фичи добавляют: `admission_plans`, `saved_grants`,
  `planner_source_state`, `planner_source_history`, `grant_universities`,
  `grant_cities`, `deadlines`, `data_sources`, `ai_usage`, `token_usage_log`,
  `rate_limits` и др.
- Снимок локальной рабочей БД на 18.09.2026 (файл БД в `.gitignore`, числа зависят
  от загруженных сидов — сверяются командами из §7.4):

| Таблица | Записей | Таблица | Записей |
|---|---|---|---|
| `universities` | 152 | `specialties` | 230 |
| `cities` | 24 | `university_specialties` | 1403 |
| `grants` | 62 | `grant_specialties` | 1841 |
| `admission_requirements` | 483 | `admission_chance_stats` | 5805 |
| `reviews` | 35 | `chat_history` | 75 |
| `query_log` | 133 | `prediction_history` | 15 |
| `test_results` | 6 | `users` | 9 |

Всего 35 таблиц (включая служебную `sqlite_sequence`).

### 4.5. Технологии

**Backend** (`backend/package.json`): Node.js (engines `>=18`, рекомендовано 22 LTS) ·
Express `5.2.1` · better-sqlite3 `12.10.0` · jsonwebtoken `9` · bcrypt `5.1.0` ·
helmet `8.2.0` · cors `2.8.6` · compression `1.8.1` · cookie-parser `1.4.7` ·
dotenv `17.4.2` · node-fetch `3.3.2`. ИИ — OpenRouter API, модель по умолчанию
`google/gemini-2.5-flash`.

**Frontend** (CDN + свой код): Leaflet `1.9.4`, AOS `2.3.4`, Swiper `11`, Notyf `3`,
NProgress `0.2.0`, DOMPurify; свой JS (~465 КБ): `app.js` 131 КБ — роутинг и все страницы,
`translations.js` 154 КБ — 3 языка, `auth.js` 64 КБ, `admin.js` 45 КБ, `planner.js` 27 КБ,
`grants.js` 21 КБ, `verification.js` 17 КБ, `security.js` 6 КБ, `admin-session.js` 1 КБ.
Стили: `main.css` (дизайн-система, тёмная тема, адаптив) + `grants.css`, `planner.css`,
`verification.css`.

**Тесты:** встроенный раннер `node --test` (6 файлов) + Playwright (Edge) для UI.

---

## 5. API — полный справочник

Базовый URL локально: `http://localhost:3000`. Все ответы — JSON. Ошибки валидации — `400`,
нет прав — `401/403`, несуществующее API — JSON `404`, SPA-fallback для остального.
`GET /health` возвращает JSON статуса (маршрут объявлен до SPA-fallback).

### 5.1. Каталог (публичные)

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/cities` | Города с числом вузов |
| GET | `/api/universities` | Список вузов; фильтры `sort`, `price_max`, `specialty`, `language`, `city_id`, `is_top` |
| GET | `/api/universities/:id` | Карточка вуза со специальностями |
| GET | `/api/compare?ids=1,2,3` | Сравнение 2–3 вузов |
| GET | `/api/specialties` | Категории специальностей |
| GET | `/api/test-specialties` | Специальности для теста |
| GET | `/api/grants` | Legacy-каталог грантов (краткий, с `specialty_ids`) |
| GET | `/api/opportunities` | Сводная read-модель: вузы + требования + гранты + `meta` (счётчики, годы, дисклеймер) |
| GET | `/api/tips` | Советы абитуриентам |
| GET | `/api/universities/:id/reviews` | Отзывы о вузе |
| POST | `/api/universities/:id/reviews` | Оставить отзыв (имя ≤80 символов, обязательный рейтинг) |
| GET | `/api/analytics/top-queries` | Топ запросов к ИИ |
| GET | `/api/analytics/stats` | Агрегированная статистика |

Пример:

```bash
curl "http://localhost:3000/api/universities?city_id=1&sort=price_asc&price_max=2000000"
curl "http://localhost:3000/api/compare?ids=1,2,3"
```

### 5.2. ИИ-советник

| Метод | URL | Auth | Описание |
|---|---|---|---|
| POST | `/api/ai/advice` | опционально | `{ message, lang?, personality? }` → классификация интента + ответ; пишет в `query_log` |

### 5.3. Поступление (`/api/admission`)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| POST | `/predict` | опционально | Детерминированный расчёт шансов |
| POST | `/calculate` | опционально | Алиас расчёта |
| POST | `/explain` | опционально | ИИ-объяснение результата (нужен ключ) |
| POST | `/save-history` | опционально | Сохранить расчёт в `prediction_history` |
| GET | `/history` | да | История расчётов пользователя |
| DELETE | `/history/:id`, `/history/all` | да | Удаление истории |
| GET | `/specialties` | нет | Специальности для формы |
| GET | `/options` | нет | Опции формы (города, языки и т.д.) |
| GET | `/deadlines` | опционально | Дедлайны |
| GET | `/document-plan` | да | План документов |

### 5.4. Планировщик (`/api/planner`, `Cache-Control: no-store`)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| POST | `/interpret` | да | Свободный текст → черновик анкеты (нужен `OPENROUTER_API_KEY`) |
| POST | `/agent` | да | Tool-calling цикл (возвращает `plan + agent.trace` или fallback) |
| POST | `/programme-preview` | нет | Детерминированный подбор без сохранения |
| POST | `/preview` | нет | Legacy-превью плана |
| POST | `/sources/check` | нет (лимит 10/мин) | Проверка источников; принимает `ids[≤6]` (+ опционально `input` для пересчёта) |
| GET | `/sources/:id/history` | админ | История наблюдений источника |
| POST | `/plans` | да | Сохранить снимок (1–3 `selectedIds` из `matches`, ≤50 планов) → `201 { id, plan }` |
| GET | `/plans` | да | Планы пользователя + `review` (пересчёт снимка) |
| PATCH | `/plans/:id/tasks` | да | `{ taskId, done }` — отметка шага |
| DELETE | `/plans/:id` | да | Удаление плана |

### 5.5. Гранты v2 (`/api/grants`, см. §3.4)

`GET /` (фильтры + пагинация) · `GET /:id` · `POST /match` (auth) ·
`POST /:id/save` (auth, toggle) · `GET /saved/list` (auth) ·
админ: `GET /api/admin/grants`, `PATCH /api/admin/grants/:id`.

### 5.6. Авторизация и кабинет (`/api/auth`, также `/api/users`, `/api`)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| POST | `/register`, `/login`, `/logout` | logout — да | Email-регистрация/вход; сессии в БД |
| GET | `/verify`… (через POST `/verify`) | да | Проверка сессии |
| GET/PUT | `/profile` | да | Профиль, включая аватар и баллы ЕНТ |
| POST | `/change-password` | да | Смена пароля |
| GET/POST/DELETE | `/saved-universities` | да | Избранное (есть удаление по id и по `universityId`) |
| GET/POST/PATCH/DELETE | `/applications` | да | Трекер заявлений |
| GET/POST/DELETE | `/chat-history` | да | История чата |
| GET/POST/DELETE | `/test-results` | да | Результаты тестов/расчётов |
| GET | `/capabilities` | нет | `{ passwordRecovery: false, twoFactor: false }` — честный флаг возможностей |
| * | `/forgot-password`, `/reset-password`, `/2fa` | — | Отключены → `503` (не выдаются за готовые) |
| GET/PATCH | `/roles`, `/users/:id/role` | админ | Роли |

### 5.7. Верификация (`/api/verify`, всё — auth)

Загрузка/статус/отмена/ревью по типам `ent` и `military`
(`POST /:type`, `GET /:type/status`, `POST /:type/:id/cancel`,
админ: `GET /:type/pending`, `GET /:type/:id/document`, `POST /:type/:id/review`),
`GET /notifications`, `POST /notifications/read`,
админ: `POST /cleanup-documents`.

### 5.8. Админ (`/api/admin`, всё — auth + admin + rate-limit)

`GET /overview` · `GET /applications` · `GET /users`, `GET/PATCH/DELETE /users/:id`,
`POST /users/:id/reset-password` · `GET /universities`, `GET/POST /universities`,
`GET/PUT/DELETE /universities/:id`, `PATCH /universities/:id` ·
`GET /grants`, `PATCH /grants/:id/verify` · `GET /reviews`, `PATCH /reviews/:id/moderate`,
`DELETE /reviews/:id` · `GET /audit` · `GET /sources`, `GET /sources/:id/history`,
`POST /sources/:id/check` · `GET/PUT /academic-year` (PUT — также отдельным маршрутом
в `server.js`).

### 5.9. Данные (`/api/data`)

Публичные: `GET /sources`, `GET /deadlines`. Админ: `POST/DELETE /sources`,
`GET /outdated`, `POST /import-csv`, `POST/DELETE /deadlines`.

---

## 6. Установка и запуск

### 6.1. Требования

- **Node.js** `>=18.0.0` (по `package.json`, engines; рекомендовано 22 LTS).
- **npm** 10.x.
- Порт по умолчанию `3000` (переменная `PORT`).
- Внешняя сеть нужна только для ИИ-функций (OpenRouter) и CDN фронтенда;
  каталог, фильтры, калькулятор и планировщик-правила работают офлайн.

```bash
node --version
npm --version
```

### 6.2. Быстрый старт

```bash
# 1. Клонировать и установить зависимости
git clone https://github.com/KazakbayZhanibek/edumatch.kz.git edumatch-kz
cd edumatch-kz/backend
npm install

# 2. Настроить окружение
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

### 6.3. Переменные окружения (все — из `backend/.env.example`)

```env
NODE_ENV=development
PORT=3000

# Сгенерировать: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=replace-with-a-random-64-character-secret

# Только для ИИ-функций. Реальный ключ в репозиторий не коммитить.
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Список через запятую. Обязателен в production.
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

| Возможность | Без `OPENROUTER_API_KEY` | С ключом |
|---|---|---|
| Каталог, фильтры, сравнение, карта | ✅ | ✅ |
| Ручная анкета + детерминированный подбор | ✅ | ✅ |
| Проверки ограничений, источники, чек-лист | ✅ | ✅ |
| Разбор свободного текста (`/interpret`) | ❌ (ручной ввод) | ✅ |
| Агентный цикл (модель координирует инструменты) | fallback-правила с пометкой | ✅ |
| Объяснения общего ИИ-советника | ограниченный режим | ✅ |

### 6.4. Инициализация базы данных (команды — из каталога `backend`)

При старте сервер сам вызывает `initDatabase()` (`backend/database.js`):
подключает/создаёт файл БД и применяет `schema.sql`. Далее загрузите данные:

```bash
node scripts/load-cities.js
node scripts/load-full-data.js
node scripts/load-grants-data.js
node scripts/load-all-contacts.js
node scripts/init-auth-tables.js
node scripts/init-admission-tables.js
node scripts/seed-admission-requirements.js
node scripts/seed-admission-stats.js
```

Дополнительные полезные сиды: `node scripts/load-specialties.js`,
`node scripts/load-universities.js`, `node scripts/load-university-links.js`.

### 6.5. Запуск и первые шаги

```bash
node server.js
# → открыть http://localhost:3000
# → GET /health должен вернуть JSON статуса
```

Назначить администратора (пользователь сначала регистрируется на сайте):

```bash
npm run admin:grant -- person@example.com
# Windows PowerShell из корня: npm --prefix backend run admin:grant -- person@example.com
```

### 6.6. Все npm-команды корня

| Команда | Действие |
|---|---|
| `npm start` / `npm run dev` | Запуск сервера (`backend/server.js`) |
| `npm test` | 6 файлов автотестов бэкенда |
| `npm run seed` | Сид статистики поступления |
| `npm run db:init` | Загрузка данных университетов |
| `npm run db:backup` / `db:rollback` | Бэкап / откат SQLite с проверкой целостности |
| `npm run db:audit` | Gate качества данных (год, demo-метки) |
| `npm run grants:audit` | Отчёт по грантам (годы, типы, дедлайны, статусы) |
| `npm run security:audit` | Поиск утёкших секретов (без вывода значений) |
| `npm run data:pending` | Выгрузка pending-вузов (сырые организации) |
| `npm run data:import` / `data:batch` / `data:rich-batch` | Импорт проверенных батчей |
| `npm run data:official-directory` | Импорт официального справочника |
| `npm run admin:grant` | Выдача роли администратора |

---

## 7. Данные: состав, источники, обновление, аудит

### 7.1. Что лежит в каталоге

- **Вузы:** название, описания RU/KK/EN, цены, QS World/Asia, специальности (M2M),
  языки, город, контакты, сайт, координаты для карты, статусы `active/pending`
  (pending-записи скрыты из пользовательского каталога).
- **Требования (`admission_requirements`, 483 записи):** `min_ent`, `avg_ent`,
  `grant_min_ent`, `competition_level`, учебный год — по парам вуз×специальность.
- **Статистика (`admission_chance_stats`, 5805 записей):** диапазоны баллов ЕНТ
  по годам/специальностям/вузам/городам с меткой источника `source_label`.
- **Гранты:** структура v2 с верификацией (см. §3.4).
- **Пилот планировщика:** 6 программ + 7 официальных источников со сверкой 2026-09-14
  (ссылки — в `planner-catalogue.js`: `iitu.edu.kz`, `admission.iitu.edu.kz`, `astanait.edu.kz`).

### 7.2. Сырые источники в репозитории

В корне: `universities_full(1).json`, `universities_grants_full.jsonl`,
`universities_links_all_now_visible.jsonl`, `university-data-example.json`
(эталон структуры записи), `universities_cards.md`. Парсинг — `Parcerscript/`
(Python). Промежуточные данные бэкенда — `backend/scripts/unis-*.json`
(`unis-full-data.json`, `unis-data-extra.json`, `unis-prices.json`, `unis-contacts.json`).

### 7.3. Конвейер обновления (61 файл в `backend/scripts/`)

Импорт: `import-verified-universities.js`, `import-verified-batch.js`,
`import-rich-university-batch.js`, `import-official-university-directory.js`,
`import-additional-universities.js`, `load-*.js`, `update-*.js` (цены, QS, сайты,
контакты, описания), `translate-batch.js`. Проверки: `check-db.js`, `check-quality.js`,
`check-prices*.js`, `check-descriptions.js`, `check-final.js`, `final-stats.js`,
`show-missing.js` / `list-missing*.js`, `validate-db-ai.js`. Сервис: `backup-db.js`,
`backup.js`, `rollback-db.js`, `scheduler.js`, `scrape-prices.js`, миграции
`migrate-docs.sql`, `migrate-grants-v2.sql`, `migrate-roles.sql`, `migrate-verify.js`.

### 7.4. Аудиты качества (gate перед релизом)

```bash
npm run db:audit        # integrity_check + годы admission_requirements/grants == ACADEMIC_YEAR (по умолч. 2026-2027); FAIL при source_label demo/manual/estimate
npm run grants:audit    # всего/по годам/типам, просроченные/будущие/неизвестные дедлайны, связи специальностей, source_url, статусы верификации
npm run security:audit  # поиск секретов в коде без печати значений
```

По журналу `MVP_STATUS.md` (17.09.2026): в каталоге 151 активный вуз; 52 организации
с адресами/телефонами; батчи 9 + 15 + 18 + 25 записей обработаны и ждут цен/программ/
координат (остаются `pending`); rich-batch дал 10 вузам вложенные данные (1 активирован).
Проверку текущих чисел после своих сидов делайте запросами к БД, например
`node scripts/final-stats.js` (покрытие описаний) и отчётами выше.

---

## 8. Тестирование

```bash
cd backend
npm test
# то же самое: node --test _tests/regression.test.js _tests/ai-completion.test.js
#   _tests/grants.test.js _tests/programme-planner.test.js
#   _tests/planner-source-store.test.js _tests/planner-agent.test.js
```

| Файл | `test()`-блоков | Что покрывает |
|---|---|---|
| `_tests/regression.test.js` | 34 | Сквозная регрессия API на чистой БД: каталоги, auth, ЕНТ, планы, права, миграции |
| `_tests/programme-planner.test.js` | 30 | Правила и анти-выдумка: границы, устаревшие цены, неверные предметы, гарантии, fallback |
| `_tests/ai-completion.test.js` | 7 | Вызовы OpenRouter (нужны сеть/ключ) |
| `_tests/grants.test.js` | 5 | Каталог и логика грантов |
| `_tests/planner-agent.test.js` | 4 | Порядок инструментов, отказ от неизвестных, лимиты |
| `_tests/planner-source-store.test.js` | 3 | Хранилище статусов источников |
| `_tests/grants-v2.test.js` | `describe/it` | Верификация грантов на изолированной `test-grants.db` + общие функции дедлайнов |

Дополнительно: `preview-fixture.js` (стенд §2.4), `planner-ui.cjs` (Playwright + Edge:
390/1280 px, уточнения, сравнение, повторный подбор, несовместимые предметы, бюджет,
смена сессии, казахский интерфейс; сеть/ИИ подменяются), `record-planner-demo.cjs`
(запись демо), `verify-demo.cjs`, `test-ai-quality.js`, `test-comprehensive.js`,
`test-context.js`, `test-debug.js`.

По `MVP_STATUS.md` полный набор 17.09.2026 проходил 82/82 вместе с
`db:audit`, `grants:audit`, `security:audit`. Учтите: AI-тесты зависят от сети и ключа;
отдельно для планировщика —

```bash
node --test --experimental-test-isolation=none _tests/programme-planner.test.js
node --test --experimental-test-isolation=none --test-name-pattern="planner" _tests/regression.test.js
```

---

## 9. Безопасность

- JWT-сессии (7 дней) хранятся в `user_sessions`; пароли — bcrypt; смена пароля отдельным эндпоинтом.
- CSRF: HMAC-токены, привязанные к сессии, TTL 1 час, чистка протухших (`backend/csrf.js`).
- Заголовки: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, сжатие ответов, `helmet`.
- CORS — allowlist (`ALLOWED_ORIGINS`); в dev разрешён `null`-origin для локальных файлов.
- Rate limits: глобальный 200 запросов/мин с IP (с чисткой записей);
  инструменты планировщика — 10/мин; админка — отдельный лимит.
- Валидация и санитизация: стриппинг HTML-тегов в JSON-теле, лимиты размера
  (4 МБ общий, 8 МБ для верификации), строгие проверки типов/диапазонов во всех роутах.
- Production-гарды при старте: `JWT_SECRET` обязателен, ≥32 случайных символов;
  в production обязательны `ALLOWED_ORIGINS` и настоящий `OPENROUTER_API_KEY`
  (иначе — падение с понятной ошибкой, а не молчаливый небезопасный запуск).
- Роль администратора — только через локальный CLI (`npm run admin:grant`),
  действие пишется в `audit_log`; `admin.html` отдаётся только после
  `verifyAuth + verifyAdmin`.
- Документы: хранение 90 дней, админ-очистка, загрузка только изображений/PDF.
- Аудиты: `npm run security:audit` (секреты), `npm run db:audit` (данные).

---

## 10. Практическая применимость

### 10.1. Где и кем используется уже сейчас

- **Абитуриент дома:** за один вечер проходит путь «анкета → 2–3 варианта →
  сравнение → чек-лист вопросов в приёмную комиссию» вместо недель ручного поиска.
- **Родитель:** видит стоимость всего срока обучения (пример: 6 279 000 ₸ за 4 года
  B057 в МУИТ по 2026–2027), пороги платное/грант и дедлайны.
- **Консультант образовательного центра:** использует сценарий планировщика как
  структуру консультации и сохраняет результат клиенту в профиль.

### 10.2. Какую задачу закрывает при развитии

Полный цикл «выбор → проверка → поступление»: подтверждение требований 2027 года
от приёмных комиссий, расширение каталога планировщика с 6 программ на все вузы,
подключённые уведомления об изменении источников, интеграция подачи через egov.kz
(только с явным подтверждением пользователя и официальным API).

### 10.3. Чего прототип осознанно НЕ делает (§12 — детали)

Не подаёт заявления, не гарантирует зачисление/грант/общежитие, не переносит цены
и сроки прошлого года на новый набор, не подтверждает смысл страниц вузов автоматически.

---

## 11. Потенциал развития

### Ближайшие шаги

- Подтвердить требования набора 2027 с приёмными комиссиями; расширить пилот с 6 программ.
- Пользовательское исследование 5–10 абитуриентов по протоколу `PILOT_FEEDBACK.md`
  (время до готового списка, доля завершивших без помощи, понимание ограничений,
  проверка одной рекомендации по официальному источнику, оценка удобства 1–5).
  Результатов пока нет — выдумывать их запрещено (§12).
- Почтовое восстановление пароля и 2FA (маршруты уже зарезервированы, сейчас возвращают 503).
- Репетиция 3-минутного питча (`HACKATHON_PITCH.md`) и E2E-прогон с реальным ключом.

### Среднесрочные

- PostgreSQL для масштабирования; вынос сессий/CSRF в Redis.
- Мобильное приложение (React Native / Flutter) на готовом REST API.
- Интеграция с госпорталами (egov.kz), API для образовательных центров.
- B2B-аналитика для вузов: спрос по специальностям, география, ценовая чувствительность.

### Долгосрочные

- Рекомендательная система по профилю абитуриента.
- Расширение на Центральную Азию.
- Партнёрства с корпоративными грантодателями.

### Бизнес-модель (план, не факт выручки)

| Канал | Описание |
|---|---|
| Freemium | База бесплатно; расширенная аналитика и мониторинг источников — подписка |
| B2B | Аналитика спроса для университетов |
| Партнёрства | Программы с корпоративными грантодателями |
| Контекст | Реклама образовательных услуг |

Подробно: `PROJECT_AND_BUSINESS_PLAN.md` (продукт, рынок, финмодель, roadmap 12 месяцев),
`DOCUMENTATION.md` (архитектура, i18n, схема БД, все эндпоинты), `MVP_GOALS.md` /
`MVP_RUNBOOK.md` (цели и релизные процедуры), `DEPLOYMENT_CHECKLIST.md`,
`HACKATHON_DEMO_PLAN.md` (сценарии и план проверки), `GRANTS_DATA_REVIEW.md`,
`IMPROVEMENTS.md`.

---

## 12. Честные ограничения прототипа

1. **Пилот планировщика — 6 программ двух вузов** (AITU, МУИТ; B057/B058; после школы).
   Это не полный каталог Казахстана и не система подачи заявлений.
2. **Неизвестное остаётся неизвестным:** гранты, места в общежитии, язык группы,
   баллы по разделам ЕНТ — `unverified` с задачей уточнить, а не додуманные значения.
3. **Проверка источников ≠ проверка смысла:** фиксируются доступность, хеш текста
   и наличие фрагментов; решение о соответствии принимает человек + серверные правила.
4. **Данные требуют перепроверки:** по `MVP_STATUS.md` (17.09.2026) 27 записей статистики —
   `demo/manual estimate`, 483 требования и грантовые записи ждут сверки с официальными
   страницами; условия 2026 года не переносятся в 2027; сверка пилота старше 30 дней
   помечается `stale`.
5. **Восстановление пароля и 2FA не готовы:** маршруты отвечают `503`
   (`GET /api/auth/capabilities` это подтверждает) — в демо не выдавать их за готовые.
6. **Пользовательского исследования пока нет:** протокол готов (`PILOT_FEEDBACK.md`),
   участников и результатов нет; в презентацию идут только факты после их проведения.
7. **Production блокеры** (из `MVP_STATUS.md`): ротация ранее использовавшегося
   OpenRouter-ключа и отдельный `JWT_SECRET` прода, домен + HTTPS + `NODE_ENV=production`,
   внешний автобэкап, полный E2E с реальным API на desktop/mobile.

---

## 13. Структура репозитория и карта кода

```text
edumatch-kz/
├── backend/
│   ├── server.js                  — Express: middleware, CORS, лимиты, 40+ маршрутов, статика
│   ├── database.js / db.js        — подключение/инициализация; слой запросов каталога
│   ├── schema.sql                 — 23 базовые таблицы
│   ├── ai-service.js / ai-controller.js / ai-routes.js   — интент + LLM + POST /api/ai/advice
│   ├── ai-prompts.js / ai-completion.js                  — 4 личности; OpenRouter helper
│   ├── admission-calculator.js / admission-service.js / admission-routes.js
│   │   └── + admission-explanation-service.js / admission-planner.js
│   ├── planner-agent.js / planner-tools.js / programme-planner.js
│   ├── planner-catalogue.js / planner-source-store.js / planner-snapshot-review.js
│   ├── planner-routes.js          — 10 эндпоинтов планировщика
│   ├── auth-service.js / auth-routes.js / auth-middleware.js / auth-extended.js / csrf.js
│   ├── admin-routes.js / data-routes.js / grants-routes.js / verify-routes.js
│   ├── i18n.js / validation-utils.js / cache-manager.js / profession-data.js / _query.js
│   ├── scripts/ (61 файл)         — сиды, импорты батчей, проверки, бэкапы, 3 SQL-миграции
│   ├── _tests/                    — 6 файлов автотестов + Playwright UI + фикстуры
│   ├── _archive/ / backups/ / uploads/ / data/
│   └── .env / .env.example
├── frontend/
│   ├── index.html                 — SPA, 12 страниц
│   ├── admin.html
│   ├── css/ main.css, grants.css, planner.css, verification.css
│   └── js/ app.js, translations.js (RU/KK/EN), auth.js, planner.js,
│       grants.js, verification.js, admin.js, admin-session.js, security.js
├── Parcerscript/                  — Python-парсинг исходных данных
├── artifacts/                     — planner-full-demo.webm, planner-fallback-demo.webm
├── *.md                           — документация (см. §11) + *.json/*.jsonl данные
├── package.json / backend/package.json
├── railway.json / Procfile
└── .gitignore                     — секреты, node_modules, *.db*, uploads, _archive
```

### Карта ключевого кода

| Часть сценария | Файл | Проверяемое поведение |
|---|---|---|
| Анкета, сравнение, планы (UI) | `frontend/js/planner.js` | Подтверждение параметров; выбор 1–3; сохранение только по действию |
| Оркестрация агента | `backend/planner-agent.js` | 4 read-only инструмента, порядок, лимиты 6/10/25с/8с, fallback |
| Серверные правила | `backend/programme-planner.js` | ЕНТ/предметы/бюджет/город/срок; `blocked`/`needs_review` |
| Пилот и источники | `backend/planner-catalogue.js` | 6 программ, 7 URL, сверка 2026-09-14, конфликт AITU |
| Проверка источников, разбор текста | `backend/planner-tools.js` | Allowlist URL, таймауты, хеш/фрагменты, безопасный парсинг ответа модели |
| API и сохранение | `backend/planner-routes.js` | Auth, пересчёт, изоляция планов, ≤50 на пользователя |
| История источников | `backend/planner-source-store.js` | Последний статус + ≤100 наблюдений (SQLite) |
| Пересчёт снимка | `backend/planner-snapshot-review.js` | Снимок и шаги не перезаписываются |
| Шансы поступления | `backend/admission-calculator.js` | Валидация 0–140, история + правила, high/medium/low |
| Гранты: скоринг/верификация | `backend/grants-routes.js` | 3 корзины match; `verified` только с полным комплектом полей |
| Auth/роли/CSRF | `backend/auth-*.js`, `csrf.js` | JWT-сессии, bcrypt, HMAC-токены 1ч, CLI-роли |
| Тесты правил | `backend/_tests/programme-planner.test.js` | 30 блоков: границы, stale-цены, предметы, гарантии |
| Регрессия API | `backend/_tests/regression.test.js` | 34 блока на чистой БД |

---

## 14. Деплой

Конфиги уже в репозитории:

- `railway.json`: сборка Nixpacks (`cd backend && npm ci`), старт
  (`cd backend && node server.js`), healthcheck `/`, до 5 рестартов.
- `Procfile`: `web: cd backend && node server.js`.

Чек-лист прода (подробно — `DEPLOYMENT_CHECKLIST.md`, `MVP_RUNBOOK.md`):

1. Домен + HTTPS за reverse-proxy; `NODE_ENV=production`.
2. Новые `JWT_SECRET` (≥32 случайных символов) и `OPENROUTER_API_KEY`; проверить `.env` вне Git.
3. `ALLOWED_ORIGINS` — только прод-домены.
4. `npm ci` → `npm run db:audit` → `npm test` → `npm run db:backup`.
5. Процесс-менеджер (systemd/Railway), проверка `GET /health`.
6. Внешний автобэкап БД; очистка `backend/uploads/` от тестовых документов;
   отдельная тестовая БД и вымышленные аккаунты для демо (§2.4).

---

## 15. Команда и вклад

**EduMatch Team.**

- Постановка проблемы, сценарий «от пожеланий до плана», продуктовые правила
  (что спрашивать, что считать неподтверждённым, когда блокировать рекомендацию) —
  решения команды, закреплённые в серверном коде, а не в промптах.
- AI-инструменты разработки (включая Codex) использовались для рефакторинга,
  тестов и документации; каждое изменение проверяется тестами, аудитами,
  запуском на чистой БД и браузерными сценариями.
- Точные изменения хакатона подтверждаются историей Git; README описывает
  текущее состояние репозитория, планы (§11) не смешиваются с фактами (§3, §12).

---

## 16. Лицензия

ISC License.

---

*EduMatch KZ — от разрозненной информации до понятного, проверяемого следующего шага.*
