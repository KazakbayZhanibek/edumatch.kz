# AUDIT_RESULTS — EduMatch KZ

27.09.2026. Исправлены 28 групп подтверждённых дефектов. Исправленные сценарии повторно проходят, но **полная приёмка не объявляется**: исходные угловые линии не воспроизведены в проблемном окружении, часть сочетаний явно осталась непроверенной, а backend fixes ещё не активированы в работающем процессе.

## Объём и итоговые статусы

В [матрице](AUDIT_MATRIX.md) **511 строк: 464 ПРОЙДЕНО, 39 НЕ ПРОВЕРЕНО, 0 ДЕФЕКТ, 7 ЗАБЛОКИРОВАНО, 1 НЕПРИМЕНИМО**. Это строки реестра, включая общие сценарии и их узкие подпроверки. Они не равны числу независимых тестов. Семь заблокированных строк также не означают семь разных причин. Первоначальные дефекты и неуспешные тестовые запуски сохранены отдельно; ноль в итоговой колонке ДЕФЕКТ не означает отсутствие всех возможных дефектов.

Обнаружены 14 SPA-маршрутов и отдельная админка. Каталог расположен на главной. В реестр включены login/register/profile, университет, сравнение, advisor, admission, career, grants, planner, map, tips, 404; четыре вкладки грантов, анкета/результат/сохранения плана, формы документов, все десять административных разделов, меню/шторки/информационные и подтверждающие окна. [Техническая инвентаризация UI](artifacts/full-audit/ui-inventory.md) дополняет сценарии literal обработчиками; [API inventory](artifacts/full-audit/api-inventory.md) содержит 171 объявленный маршрут с учётом aliases. Это не 171 полностью испытанный endpoint.

Матрица была создана до исправлений. Субагенты отдельно вели responsive, functional и API зоны; после освобождения слота выполнена независимая проверка. Один файл одновременно не редактировался разными агентами. Старые отчёты не использовались как основание нового PASS.

## Что реально запускалось

| Набор / команда из корня проекта | Итог последнего применимого запуска | Тип доказательства |
|---|---|---|
| `node artifacts/full-audit/api-runner.cjs` | 114/114 tests; 58/58 HTTP probes, 0 failed/skipped | Настоящий Express и disposable SQLite; часть pure units/fake-model tests |
| `node artifacts/full-audit/functional-regression.cjs` | 115 ПРОЙДЕНО, 1 НЕПРИМЕНИМО; 0 pageerrors | Изолированный UI: auth, заполненный профиль, документы, карьера, nav, admin CRUD |
| `node artifacts/full-audit/catalog-regression.cjs` | 42/42; 0 pageerrors | UI mock: поиск/фильтры, reverse race, partial detail, reviews, favorites, compare |
| `node artifacts/full-audit/core-regression.cjs after` | 8/8; 0 pageerrors | Исходные races/CDN/Markdown/трекер/404 |
| `node artifacts/full-audit/advisor-regression.cjs` | 60/60 | 15 сценариев × mobile/desktop × две темы; HTTP errors/network/quote/admission |
| Усиленный logout check, `advisor-logout-final.json` | 4/4 после фактического позднего HTTP ответа и render frames | Защита от возвращения приватного диалога |
| `node artifacts/full-audit/core-grants.cjs` | 1 suite PASS: 360/390/1280 и набор переходов | UI module mock; фильтры, retry, input/response race, save guard, saved removal |
| `node artifacts/full-audit/core-planner-transitions.cjs` | 2/2 viewport suites PASS | Выбор/сравнение, stale save, success, logout |
| `node artifacts/full-audit/core-planner-saved.cjs` | 2/2 viewport suites PASS | Открытие плана, шаги, progress, rollback/retry |
| `node artifacts/full-audit/planning-gaps.cjs` | 14/14 | Keyboard tabs, источники, unknown/year, AI mock success/error, recheck/delete |
| `node artifacts/full-audit/planning-save.cjs` | 12/12 | Новый saved grant, 500 rollback/retry, pagination, все filter params, ENT boundaries/subjects |
| `node artifacts/full-audit/shell-regression.cjs` | 10/10 | Темы/языки/reload, dialogs/focus, повторные переходы, ограниченные performance metrics |
| `node artifacts/full-audit/content-regression.cjs after` | 7/7 | Безопасный DOM/URL/unknown price, source fixture |
| `node artifacts/full-audit/independent-content.cjs` | 5/5; 0 pageerrors | Независимо: attribute quotes, dataset, modal, category, отсутствие double escaping |
| `node artifacts/full-audit/closeout-checks.cjs` | 2/2 | RU/KK/EN unknown/threshold copy; compare500→retry |
| `node artifacts/full-audit/planning-map-real.cjs` | PASS: 5 содержательных assertions; 0 pageerrors | Настоящие Leaflet 1.9.4 и CARTO tiles, synthetic universities/API |
| `node backend/_tests/site-navigation-regression.cjs` | 8/8 | VM unit tests, без DB |
| `node --check` для 9 изменённых JS-файлов | 9/9 | Синтаксис; не функциональная проверка |

Не суммируем assertions, viewport suites, HTTP probes, строки матрицы и скриншоты в одно маркетинговое число. Основные JSON: [functional](artifacts/full-audit/functional-results.json), [catalog](artifacts/full-audit/catalog-results.json), [advisor](artifacts/full-audit/advisor-results.json), [content](artifacts/full-audit/content-after.json), [API](artifacts/full-audit/api-probe-results.json).

## Изоляция и localhost

- До изменений сохранены `git-status-before.txt` и `baseline-source/frontend`; рабочая папка уже содержала чужие изменения, включая DB journal files. Reset, commit, push и публикация не выполнялись.
- На localhost:3000 найден node PID 21220, начатый до исправлений. `server.js` раздаёт `../frontend`. Восемь HTTP-ресурсов побайтно совпадают с текущими файлами: [server-proof.json](artifacts/full-audit/server-proof.json). Это подтверждает frontend source, но не заменяет перезапуск backend кода.
- API runner копирует только source-файлы в отдельный OS temp directory. `.env`, рабочая БД, uploads и git не копируются. Новый DB_PATH, disposable uploads, пустой AI key, отдельный тестовый секрет; сеть backend ограничена loopback. [Подробности изоляции](artifacts/full-audit/api-isolation.json).
- Нельзя безопасно запускать обычный backend `npm test` на рабочем каталоге как замену этому runner: существующий verify handler использует uploads относительно исходников. Здесь suite запускался внутри временной копии.
- UI сценарии с входом, сменой пароля, удалениями, admin reset и загрузкой PNG/PDF перехватываются mock API. Реальные аккаунты/пароли, история и заявления не менялись. Проверенные серверные операции отдельно выполнялись на фикстурах.
- Для карты разрешены только конкретные Leaflet JS/CSS и CARTO tile URL. Проверены загруженная библиотека, декодированный тайл, 2 маркера, поиск/empty/reset, suggestions/chips, popup и переход в вуз. Записей на внешние сервисы нет. [Сетевые доказательства](artifacts/full-audit/planning-map-real-results.json).

## Браузер и responsive

Фактически запускался **Microsoft Edge 154.0.4258.37 (Chromium)** в чистых автоматизированных контекстах. Mobile 402×874 DPR 3, touch и iPhone UA в функциональном наборе — эмуляция, не Safari и не физический iPhone. Остальные software-test harness могут использовать обычный Edge UA. Codex IAB inventory проверен отдельно: исходных пользовательских вкладок нет.

Новый baseline: 140 route geometries — все 14 маршрутов при 402 и 1280 в обеих темах; шесть рискованных маршрутов дополнительно при 320, 360, 390, 430, 768, 1024 и 1440. Ещё 24 состояния landscape/short-height, 24 корректных состояния text200 и 40 dialog captures. Масштаб текста 200% реализован удвоением вычисленных размеров шрифта, не OS/browser zoom. Short-height 402×400 имитирует уменьшение доступного пространства, а не настоящую клавиатуру iOS.

После исправлений: 4 profile и 8 toast geometry checks; заключительные 28 representative screenshots плюс частичный вуз. Визуальный агент лично просмотрел 8 разных представителей, главный агент дополнительно просмотрел чат и общий профиль. Генерация остальных снимков не выдаётся за ручной просмотр. [Подробный visual report](artifacts/full-audit/final-visual.md).

Измерены фактические размеры и границы контролов, а не только document overflow. На подтверждённых password состояниях toggle 88×44, резерв 98 px. В просмотренных контрольных кадрах блокирующего обрезания не обнаружено. Таблица сравнения имеет намеренную внутреннюю горизонтальную прокрутку. Глобальный overflow:hidden для маскировки дефектов не добавлялся.

## Доступность и performance

Проверены Tab/ShiftTab/Enter/Space/Escape в обозначенных сценариях, focus trap/return, inert background, selected/expanded/busy состояния, aria labels форм, сообщения ошибок и профиля. Выборочные main/muted/input/button контрасты home/login/profile выше 4,5:1. Реальный текст абзаца чата после исправления — 6,39:1 light и 10,84:1 dark. Это не полный WCAG/screen-reader audit; placeholder/alpha/gradient contrast не покрыт.

С reduced-motion интерфейс остаётся видимым; существующее общее правило практически отключает анимации. Полный анализ всех motion effects не сделан. Сорок повторных route transitions не размножили проверенный keyboard handler.

При заблокированном CDN и искусственной задержке app.js +500 ms: observed ready ≈627 ms mobile /795 ms desktop, CLS ≈0,0095/0, resource count34. Это локальная fixture-метрика, не производительность публичного сайта и не нагрузочный тест. Источник: [shell-results.json](artifacts/full-audit/shell-results.json).

## Неуспешные/отброшенные запуски

Таймауты и проблемы harness не засчитывались как PASS. Edge subprocess первоначально блокировался sandbox EPERM; изолированные тесты запускались с разрешённым subprocess, оставшийся fixture process остановлен. Первоначальный broad mobile script завершился ошибкой screenshot после сохранения 140 baseline и 24 short/landscape состояний: успешными считаются индивидуальные измерения, не exit всего запуска. Ошибочный text200 batch исключён и заменён отдельным завершённым запуском 24 состояний.

Исправлялись только тестовые предусловия, без ослабления ожиданий: verification fixture history shape, API boolean shape, установка clock до таймера, ожидание asynchronous career save; двойной reload при setLanguage; blur/change перед вручную вставленной admission карточкой; путь Playwright; VM globals нового sendMessage. В security helper assertion проверяет активные DOM элементы, а не безвредное слово `onerror` внутри экранированного текста. Начальные failures сохранены там, где они являются доказательством дефекта продукта; промежуточные ошибочные фикстуры явно отделены.

## Контрольные кадры

| Сценарий | До | После |
|---|---|---|
| Desktop password reserve | [до](artifacts/full-audit/mobile-before-1280-900-base-light-profile.png) | [после](artifacts/full-audit/mobile-after-1280-900-base-light-profile.png) |
| Mobile профиль | [до](artifacts/full-audit/mobile-before-402-874-base-light-profile.png) | [после](artifacts/full-audit/mobile-after-402-874-base-light-profile.png) |
| Светлый чат, контраст | [до](artifacts/full-audit/final-before-contrast-402-light-advisor.png) | [после](artifacts/full-audit/final-402-light-advisor.png) |
| Очистка сравнения во время запроса | [до](artifacts/full-audit/core-baseline-compare-clear.png) | [после](artifacts/full-audit/core-after-compare-clear.png) |
| Устаревший расчёт | [до](artifacts/full-audit/core-baseline-admission-stale.png) | [после](artifacts/full-audit/core-after-admission-stale.png) |

Дополнительно: [настоящая карта](artifacts/full-audit/planning-map-real-402.png), [desktop admin](artifacts/full-audit/final-1280-dark-admin.png), [mobile admission](artifacts/full-audit/final-402-light-admission.png).

## Что мешает полной сдаче

1. Нужна исходная проблемная вкладка либо исходный скриншот с возможностью повторить тот же браузерный сценарий. Без этого нельзя доказать исправление угловых линий или назвать их причину.
2. Backend изменения проверены в изоляции, но рабочий процесс не перезапускался: эти исправления ещё не действуют на его API. Активация требует отдельного управляемого запуска с сохранностью рабочей БД.
3. 39 строк содержат явный остаток покрытия: например, часть planner async/session комбинаций, полный перевод всех динамических экранов, каждый API alias и production deployment. Это неизвестность, а не найденный дефект. Реальные AI-вызовы и пользовательские данные намеренно не использовались.

Дальнейшая косметическая полировка не выполнялась. Исправления и проверяемые результаты готовы к review; статус «весь продукт полностью исправен» не выставлен.
