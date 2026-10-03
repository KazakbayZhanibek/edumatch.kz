# AUDIT_MATRIX — EduMatch KZ

27.09.2026. Это реестр функций и фактических проверок, а не обещание исчерпывающего перебора сочетаний. Общие строки и узкие доказанные сценарии считаются отдельно: их нельзя складывать с числомassertions или тестовых executions.

- НЕ ПРОВЕРЕНО: **39**
- ПРОЙДЕНО: **464**
- ДЕФЕКТ: **0**
- ЗАБЛОКИРОВАНО: **7**
- НЕПРИМЕНИМО: **1**

ВсеUI записи используют синтетическийAPI, кроме явно названной интеграции. Настоящий backend проверен отдельно на временнойБД. Первоначальные ошибки preserved вbefore JSON; итоговые статусы ниже учитывают исправления. Подробности: [результаты](AUDIT_RESULTS.md), [дефекты](AUDIT_FINDINGS.md), [API inventory171](artifacts/full-audit/api-inventory.md).

## Основные сценарии (общая строка остаётся НЕ ПРОВЕРЕНО, если часть действий не выполнена)

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| CORE-01 | Главная | гость | Первый вход; CDN доступен/недоступен | Открыть главную, CTA и быстрые ссылки | Каталог и переходы доступны | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | Home geometry/каталог/навигация пройдены; каждый hero CTA отдельно не asserted |
| CORE-02 | Каталог | гость | Есть 15+ вузов | Показать ещё до конца | Первые 6; следующие доступны без дублей | 402/1280, по указанным fixtures | ПРОЙДЕНО | core-after.json:6→12→15; без дублей |
| CORE-03 | Каталог | гость | Вузы RU/KK/Unicode | Поиск: пробелы, регистр, Unicode, пустой запрос | Актуальная фильтрация; явная пустая выдача | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:trim/Unicode/query/empty/reset; проверен контракт запроса |
| CORE-04 | Каталог | гость | Главная/окно фильтров | Каждый фильтр, сортировка и сброс | Параметры синхронны; сброс полон | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:все параметры/сортировка/сброс +mobile sheet sync |
| CORE-05 | Каталог | гость | Медленный API | Быстро изменить фильтры; ответы в обратном порядке | Последний запрос побеждает | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:reverse responses |
| CORE-06 | Каталог | гость | Ошибка/обрыв/таймаут API | Загрузка и повтор | Ошибка доступна; повтор восстанавливает | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | catalog-results.json:500/network abort/retry PASS; реальный wall-clock timeout отдельно не выжидался |
| CORE-07 | Вуз | гость | Полные/частичные данные | Открыть детали, описания, специальности, контакты | Данные и действия доступны; неизвестное не ноль | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:partial detail; content-after.json безопасный текст |
| CORE-08 | Вуз | гость | 404/500/медленный ответ | Открыть другой вуз до завершения запроса | Верная карточка; понятная ошибка | 402/1280, по указанным fixtures | ПРОЙДЕНО | core-after.json:404; catalog-results.json:detail reverse race; произвольные коды ошибок не исчерпаны |
| CORE-09 | Отзывы | гость/пользователь | Пустые/заполненные отзывы | Чтение, форма, валидация и отправка на fixture | Нет настоящих записей; ошибки и успех видимы | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:populated/empty/500/retry/double-submit/retained draft |
| CORE-10 | Избранное | гость/пользователь | Список пуст/заполнен | Добавить, убрать, повторить после ошибки | Состояние сохранено/откачено согласованно | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:guest localStorage,auth success/500/remove/retry |
| CORE-11 | Сравнение | гость | 0/1/2/3/4 выбора | Добавить и удалить варианты; очистить | Лимит 3; доступная таблица и пустое состояние | 402/1280, по указанным fixtures | ПРОЙДЕНО | catalog-results.json:0/1/2/3/4 и clear |
| CORE-12 | Сравнение | гость | Сравнение загружается | Очистить/изменить список до ответа | Устаревшая таблица не возвращается | 402/1280, по указанным fixtures | ПРОЙДЕНО | core-after.json:pending compare→clear |
| CORE-13 | Сравнение | гость | 400/404/500/обрыв | Повторить | Нет падения; восстановление доступно | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | closeout-checks.json:500→retry PASS; отдельные400/404/abort combinations не прогнаны |
| CORE-14 | Гранты | гость | Каталог/Вузы/Для меня/Мой план | Открыть все четыре вкладки; клавиатура | Правильный контент и selected/focus | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: Все4 вкладки; ArrowLeft/Right с циклом, Home/End; selected и activeElement. Evidence: core-grants.cjs + planning-gaps GR-KEYS. Ограничения/остаток: Нет дополнительных клавиш вне ARIA pattern |
| CORE-15 | Гранты | гость | Каталог > лимита | Поиск, каждый фильтр, сброс, ещё, детали | Верная выдача и доступные источники | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: Поиск debounce Unicode; все4 filter request params одним представительным значением; reset;15items pagination12→15 без дублей; details/source. Evidence: core-grants.cjs + planning-gaps GR-DETAIL + planning-save PAGINATION/FILTER-PARAMS. Ограничения/остаток: Семантика backend sorting/filtering не подтверждается mock; не все enum values |
| CORE-16 | Гранты | пользователь | Сохранённые/нет сохранённых | Сохранить/убрать; повтор; 401/500 | Нет дублей; ошибку можно исправить | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: 401login; успешное новое сохранение;500save rollback/retry;500removal сохранение карточки/retry; duplicate guards/focus/live/empty. Evidence: core-grants.cjs + planning-save SAVE-FAIL-RETRY/REMOVE-FAIL-RETRY. Ограничения/остаток: Изолированное сохранение; реальная account persistence не подтверждается |
| CORE-17 | Гранты | гость | Анкета: границы, одинаковые предметы | Подбор; изменить параметры после результата | Валидация и пометка устаревания | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: ENTempty/−1/141/12.5 blocked no request;0/140 valid; одинаковые предметы ошибка/focus/no request; исправление; stale input/response. Evidence: core-grants.cjs + planning-save ENT-BOUNDS/SAME-SUBJECTS. Ограничения/остаток: Category/dorm/language сочетания не покрывались |
| CORE-18 | Гранты | гость | Частичные сведения/разные годы | Прочитать результат и источники | Нет гарантии гранта/ложного нуля | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: Неизвестный год гранта; минимум другого года не подтверждён; справочная цена2026 при2027; funding details/source. Evidence: planning-gaps GR-UNKNOWN. Ограничения/остаток: Дата/частичные fixtures bounded; все сочетания непроверены |
| CORE-19 | Гранты | пользователь | Результаты есть | Добавить в план, двойное нажатие | Один план; явная ошибка/успех | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: Mock save успех; duplicate pending save=1; stale input cannot save. Evidence: core-grants.cjs. Ограничения/остаток: Error save401/500 и retry после ошибки |
| CORE-20 | Гранты | гость | Медленный ответ, сеть/таймаут | Смена вкладки/запроса, повтор | Устаревший ответ не заменяет текущий | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: Catalog503 retry; delayed opportunities ответы наоборот; переключение вкладок в обычном режиме. Evidence: core-grants.cjs. Ограничения/остаток: Истинный15s timeout; вкладка меняется во время каждого endpoint request |
| CORE-21 | План | гость | Пустая/неверная анкета | Обязательные поля, числа, предметы, бюджет | Связанные ошибки, фокус первого поля | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: 7required labels; subject duplicate linked error; корректная анкета. Evidence: core-planner-transitions.cjs. Ограничения/остаток: Каждое пустое поле/границы ENT/budget/decimal; первый invalid focus во всех ветках |
| CORE-22 | План | гость | Корректная анкета | Подбор, ещё, детали и источники | Все результаты и ограничения доступны | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: Preview; details; source link безопасный target/rel; online source-check mock warning. Evidence: core-planner-transitions.cjs + planning-gaps PL-DETAIL. Ограничения/остаток: Show-more с >5 результатами; excluded раскрытие; failed online source check |
| CORE-23 | План | гость | Ответ с неизвестными данными/другим годом | Сравнить условия | Неизвестность явно обозначена | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: Comparison2026 threshold vs2027, unknown language/deadline; paid reference price vs unknown requested price. Evidence: core-planner-transitions.cjs + PL-DETAIL. Ограничения/остаток: Bounded explicit fixtures; all years не проверены |
| CORE-24 | План | гость | Получены программы | Выбрать 1–3, сравнить, изменить выбор | Корректная таблица и удержание выбора | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: 1/2 selection compare/change; retains selection; missing programme notice; table region. Evidence: core-planner-transitions.cjs. Ограничения/остаток: 3 selected limit; запрет4-го; zero selection disabled путь |
| CORE-25 | План | пользователь | Сравнение актуально/устарело | Сохранить; двойное нажатие; 401/500 | Только актуальный результат; нет дублей | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: Saved success step4; pending save + changing selection ignored; stale disabled. Evidence: core-planner-transitions.cjs. Ограничения/остаток: Duplicate real click during pending; 401/500 save and retry |
| CORE-26 | План | пользователь | Сохранённые планы | Открыть, шаги, rollback, удалить, перепроверить | Изменяется нужный план; понятные ошибки | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: Open/reopen steps progress; failure rollback/retry; delete cancel/503 alert/retry success; restore triggers fresh preview. Evidence: core-planner-saved.cjs + planning-gaps PL-DELETE/PL-RECHECK. Ограничения/остаток: Saved UI fixtures; auth backend не проверен; GET plans failure combinations нет |
| CORE-27 | План | гость | AI-помощь анкеты | Раскрыть, отправить fixture, ошибка/повтор | Анкета заполнена без платного вызова | Размеры конкретного harness | ПРОЙДЕНО | Покрыто: AI details;503 message enabled retry; quota reason; draft fills ENT/year/subjects. Evidence: planning-gaps PL-AI. Ограничения/остаток: Mock only, no paid call; остальные provider reason codes не проверены |
| CORE-28 | План | гость/пользователь | Запрос идёт | Изменить ввод, уйти, выйти, ответы наоборот | Приватные/устаревшие данные не возвращаются | Размеры конкретного harness | НЕ ПРОВЕРЕНО | Покрыто: Changed selection during save; changed questionnaire stale; failed refresh retains; auth event clears result. Evidence: core-planner-transitions.cjs. Ограничения/остаток: Pending interpret/preview/source-check/savedGET followed logout/change route, reversed independent responses |
| CORE-29 | Советник | гость | Начальный экран | Категории, подсказки, ввод и Enter | Сообщение отправлено один раз | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | advisor-results.json:одна prompt chip,ShiftEnter/Enter PASS; каждая категория отдельно не нажималась |
| CORE-30 | Советник | гость | Запрос ещё идёт >1.5 сек | Второй Enter/двойная отправка | Нет параллельных ответов в неверном порядке | 402/1280, по указанным fixtures | ПРОЙДЕНО | core-after.json:duplicate Enter blocked,draft retained |
| CORE-31 | Советник | гость | Успех/длинный Markdown/частичные данные | Ответ, раскрытие, карточки, предложения | Безопасный контент и доступные действия | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | advisor-results.json:220-line expand/collapse,partial cards; content-after.json safe text/URLs/unknown price; реальный Markdown CDN bundle не проверялся |
| CORE-32 | Советник | гость | 400/401/429/500/обрыв/таймаут | Ошибка и повтор | Ввод/история не потеряны; кнопка восстановлена | 402/1280, обе темы | ПРОЙДЕНО | advisor-results.json:400/401/429/500/network/AbortError +retry; AbortError инъецирован,120s не выжидались |
| CORE-33 | Советник | пользователь | История и новый диалог | Восстановить; уйти и вернуться; ответ на цитату | История согласована; цитата очищается | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | advisor-results.json:quote/cancel,away/back,retry/logout PASS. Восстановление текущего диалога послеreload не заявлено; сохранённая история профиля — PRO08/09 |
| CORE-34 | Расчёт шансов | гость | Пусто/0/140/141/дробное | Отправить с клавиатуры/кнопки | Валидация и первый ошибочный элемент | 402/1280, по указанным fixtures | ПРОЙДЕНО | advisor-results.json:границы+keyboard |
| CORE-35 | Расчёт шансов | гость | Успех/пусто/неизвестные шансы | Результат, пояснения и контакты | Нет ложной вероятности/гарантии | 402/1280, по указанным fixtures | ПРОЙДЕНО | advisor-results.json:empty/unknown chance |
| CORE-36 | Расчёт шансов | пользователь | Результат получен | Сравнить, избранное, трекер, сохранение истории | Правильный объект; одна запись fixture | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | advisor-results.json:guest tracker exact apostrophe name4/4; PRO13/14 edit/delete. Auth add doubleclick/history-save/end-to-end не проверены |
| CORE-37 | Расчёт шансов | гость | Запрос идёт | Изменить параметры; ответы наоборот; ошибка | Устаревшие результаты не показываются как актуальные | 402/1280, по указанным fixtures | ПРОЙДЕНО | advisor-results.json:reverse replies,changed parameters,departure |
| CORE-38 | Оболочка | гость | RU/KK/EN; две темы | Смена языка/темы и обновление | Выбор сохраняется; нет ключей перевода | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | shell-results.json:RU/KK/EN+themes persistence PASS. Полная лингвистическая проверка всех динамических текстов не сделана |
| CORE-39 | Надёжность | гость | 20 переходов и повторных открытий | Повторять переходы и действия | Нет размножения handlers/запросов | 402/1280, по указанным fixtures | ПРОЙДЕНО | shell-results.json:40 route transitions,один keyboard toggle срабатывает один раз; не profiler всехhandlers |
| CORE-40 | Производительность | гость | Медленная сеть/нет CDN/длинный список | Загрузить и использовать ключевые экраны | Есть feedback; измерены запросы/сдвиги | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | shell-results.json:+500ms app.js,CDN failure,CLS/ready time measured; core-after.json toast fallback; full real network/load profiling не выполнен |
| CORE-41 | Контент | гость | Опасный пользовательский/AI текст и URL fixture | Отобразить в чате/карточках/ссылках | Нет выполнения HTML/опасных схем | 402/1280, по указанным fixtures | НЕ ПРОВЕРЕНО | content-after.json7/7,independent-content-after.json5/5,core-after.jsonMarkdown fallback. Все возможныеHTML/URL contexts сайта не доказаны безопасными |
| CORE-42 | Рамки | гость/пользователь | Исходная проблемная вкладка | Сравнить CSS/zoom/DPR/appearance с чистой | Подтверждена реальная причина | Исходное окружение402×874DPR3 | ЗАБЛОКИРОВАНО | CUA inventory:только CodexIAB,0tabs; исходные screenshot/browser недоступны. Нет доказанной причины исходных угловых линий |

## Auth, заполненный профиль, документы, карьера, карта, admin и навигация

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| ADM13 | Админ фильтр грантов | админ | needs_review fixture | Выбрать verified/needs_review | Таблица фильтруется по статусу | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH01 | Вход | гость | Пустая форма | Отправить | Нативная валидация; API не вызван | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH02 | Вход | гость | Некорректный email | Отправить | typeMismatch; API не вызван | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH03 | Вход | гость | Сервер 401 | Ввести данные и отправить | Ошибка alert; кнопка доступна | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH04 | Вход | гость | Mock успех | Ввести данные | Сессия и переход на home | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH05 | Регистрация | гость | Нет согласия | Отправить | Блокировка без API | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH06 | Регистрация | гость | Слабый пароль | Отправить | Нативная валидация и hints | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH07 | Регистрация | гость | Unicode имя; корректные данные | Отправить | Mock регистрация и профиль | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH08 | Сессия | пользователь | Сохранён mock user; verify401 | Перезагрузить | Локальная сессия очищена | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| AUTH09 | Выход | пользователь | Mock сессия | Выйти | Сессия очищена; home | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO01 | Профиль | гость | Без сессии | Открыть profile | Предложение войти | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO02 | Профиль | пользователь | Все истории заполнены | Открыть | Все блоки и данные видны | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO03 | Профиль | пользователь | Unicode имя и длинная bio | Сохранить | PUT корректен; отображение безопасно | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO04 | Аватар | пользователь | Неверный MIME | Выбрать txt | Отклонение без PUT | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO05 | Аватар | пользователь | Изображение >2МБ | Выбрать | Отклонение без PUT | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO06 | Аватар | пользователь | Синтетический PNG | Выбрать | Mock PUT; новый аватар | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO07 | Сохранённые | пользователь | Есть вуз | Удалить | Mock DELETE и карточка исчезает | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO08 | История чата | пользователь | 7 записей | Показать ещё/свернуть | 7 затем 5 | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO09 | История чата | пользователь | Есть запись | Удалить | Mock DELETE; счётчик уменьшается | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO10 | Результаты | пользователь | Есть тест | Удалить | Mock DELETE; карточка исчезает | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO11 | Расчёты | пользователь | Есть история | Очистить и отменить | Диалог закрыт; DELETE отсутствует | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO12 | Расчёты | пользователь | Есть история | Подтвердить очистку | Mock DELETE; empty | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO13 | Трекер | пользователь | Есть заявка | Изменить статус/год/дедлайн/заметку | Mock PUT/PATCH с правильными полями | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO14 | Трекер | пользователь | Есть заявка | Удалить | Mock DELETE; empty | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO15 | Пароль | пользователь | Поля заполнены | Tab Enter Space переключатели | Корректная видимость и фокус | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO16 | Пароль | пользователь | Пустое/несовпадение | Отправить | Ошибка; POST отсутствует | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| PRO17 | Пароль | пользователь | Mock успех и отказ | Отправить валидное | Успех reset; отказ alert | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER01 | Документы | пользователь | Empty history[] | Открыть оба блока | Upload/refresh доступны | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER02 | Документы | пользователь | Неверный MIME; >5МБ; пустой файл | Выбрать | Ошибка без POST | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER03 | ЕНТ документ | пользователь | PNG; score141/дробь | Отправить | Нативная валидация без POST | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER04 | ЕНТ документ | пользователь | Синтетический PNG;score110 | Отправить | Mock POST; pending | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER05 | Военный документ | пользователь | Синтетический PDF;contract | Отправить | Mock POST; pending | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER06 | Документы | пользователь | Pending | Отменить | Mock POST cancel; cancelled | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER07 | Документы | пользователь | Approved/rejected и история | Refresh/details | Статусы, причины и история | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER08 | Документы | пользователь | API500 | Refresh/retry | Ошибка alert; retry работает | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| VER09 | Документы | админ | Заявки с файлами | Preview/download approve/reject | Mock операции и причины | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| CAR01 | Профориентация | гость | Начало | Ответить; Назад | Вопрос и scores восстановлены | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| CAR02 | Профориентация | гость | 8 вопросов | Завершить | Результат/рекомендации; без save API | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| CAR03 | Профориентация | пользователь | 8 вопросов | Завершить | Mock save test result | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| CAR04 | Профориентация | гость | Результат | Заново | Вопрос1; состояние reset | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| CAR05 | Профориентация | гость | Результат | Подробнее/финансовые советы | Правильный маршрут | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| TIP01 | Советы | гость | 10 карточек | Открыть/закрыть клавиатурой | aria-expanded и тело | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО 10 cards keyboard toggle; 1280: ПРОЙДЕНО 10 cards keyboard toggle |
| MAP01 | Карта | гость | CDN заблокирован | Открыть | Понятное сообщение fallback | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| MAP02 | Карта | гость | Real Leaflet1.9.4 + CARTO tiles; synthetic uni API | Markers/search/empty/clear/suggestion/chip/popup/details | Реальная библиотека и тайлы работают; детали вуза1 | 402×874 DPR3 Edge/Chromium | ПРОЙДЕНО | planning-map-real.cjs + planning-map-real-results.json + planning-map-real-402.png |
| NAV01 | Навигация | гость | Hash маршруты | Direct/reload | Правильная активная страница | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| NAV02 | Навигация | гость | home→career→tips | Browser Back/Forward | Маршрут соответствует истории | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| NAV03 | Навигация | гость | Mobile menu | Открыть/Escape/Tab | Фокус и закрытие | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: НЕПРИМЕНИМО НЕПРИМЕНИМО desktop menu |
| NAV04 | Навигация | гость | Неизвестный hash | Открыть | 404 и возврат | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM01 | Админ | админ | Mock read API | Все 10 вкладок; поиск; период | Правильные разделы/фильтр | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM02 | Админ | гость | API403 | Открыть admin.html | Ошибка; данных нет | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM03 | Админ пользователь | админ | Fixture пользователь | Просмотр/редактировать/сохранить | Modal и mock PATCH | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM04 | Админ пользователь | админ | Modal | Escape/Tab/возврат фокуса | Доступный диалог | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM05 | Админ пользователь | админ | Fixture | Ban/unban/role/delete/reset: отмена | Без write при отмене | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM06 | Админ пользователь | админ | Fixture | Ban/unban/role/delete/reset: подтвердить | Mock writes | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM07 | Админ вуз | админ | Fixture | View/edit/create/delete/status | Mock CRUD | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM08 | Админ отзывы | админ | Fixture | Approve/hide/delete/filter | Mock CRUD | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM09 | Админ гранты | админ | Fixture | Edit/verify | Mock PATCH | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM10 | Админ источники | админ | Fixture | Check one/all/history | Mock операции | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM11 | Админ session | админ | Clock15мин | Idle expiry | Logout и redirect | 402×874 DPR3;1280×874 | ПРОЙДЕНО | 402: ПРОЙДЕНО assertions; 1280: ПРОЙДЕНО assertions |
| ADM12 | Авторизация backend | роли | Реальные auth cookies | Проверка HTTP доступа | Backend enforcement вне static mock | 402×874 DPR3;1280×874 | ЗАБЛОКИРОВАНО | Статические mocks не доказывают backend auth; передано API агенту |

## Каталог: выполненные узкие сценарии

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| CAT-CORE03-search-402 | catalog/detail/reviews/favorites/compare | fixture | CORE03-search | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-all-filters-402 | catalog/detail/reviews/favorites/compare | fixture | CORE04-all-filters | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-sort-options-402 | catalog/detail/reviews/favorites/compare | fixture | CORE04-sort-options | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-reverse-race-402 | catalog/detail/reviews/favorites/compare | fixture | CORE05-reverse-race | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-500-retry-402 | catalog/detail/reviews/favorites/compare | fixture | CORE05-500-retry | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-abort-retry-402 | catalog/detail/reviews/favorites/compare | fixture | CORE05-abort-retry | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE06-partial-detail-402 | catalog/detail/reviews/favorites/compare | fixture | CORE06-partial-detail | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-reviews-500-402 | catalog/detail/reviews/favorites/compare | fixture | CORE07-reviews-500 | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-review-submit-failure-402 | catalog/detail/reviews/favorites/compare | fixture | CORE07-review-submit-failure | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-review-double-submit-402 | catalog/detail/reviews/favorites/compare | fixture | CORE07-review-double-submit | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-guest-402 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-guest | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-auth-error-402 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-auth-error | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-0-402 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-0 | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-1-402 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-1 | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-2-402 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-2 | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-3-402 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-3 | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE11-compare-limit-402 | catalog/detail/reviews/favorites/compare | fixture | CORE11-compare-limit | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-mobile-sheet-402 | catalog/detail/reviews/favorites/compare | fixture | CORE04-mobile-sheet | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE06-detail-reverse-race-402 | catalog/detail/reviews/favorites/compare | fixture | CORE06-detail-reverse-race | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-reviews-populated-402 | catalog/detail/reviews/favorites/compare | fixture | CORE07-reviews-populated | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-auth-success-delete-error-402 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-auth-success-delete-error | isolated interaction | asserted contract | 402 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE03-search-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE03-search | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-all-filters-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE04-all-filters | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-sort-options-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE04-sort-options | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-reverse-race-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE05-reverse-race | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-500-retry-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE05-500-retry | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE05-abort-retry-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE05-abort-retry | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE06-partial-detail-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE06-partial-detail | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-reviews-500-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE07-reviews-500 | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-review-submit-failure-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE07-review-submit-failure | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-review-double-submit-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE07-review-double-submit | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-guest-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-guest | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-auth-error-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-auth-error | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-0-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-0 | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-1-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-1 | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-2-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-2 | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE10-compare-3-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE10-compare-3 | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE11-compare-limit-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE11-compare-limit | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE04-mobile-sheet-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE04-mobile-sheet | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE06-detail-reverse-race-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE06-detail-reverse-race | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE07-reviews-populated-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE07-reviews-populated | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |
| CAT-CORE09-favorite-auth-success-delete-error-1280 | catalog/detail/reviews/favorites/compare | fixture | CORE09-favorite-auth-success-delete-error | isolated interaction | asserted contract | 1280 | ПРОЙДЕНО | catalog-results.json |

## Советник/расчёт: выполненные узкие сценарии

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| ADV-CORE-36 | Расчёт | synthetic guest/user | Mock APIs; fresh browser context | Tracker quoted name: isolated real click | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. Проверка имени с apostrophe через реальный guest tracker click; не весь authenticated tracker/favorites/save-history flow. |
| ADV-CORE-29 | Советник | synthetic guest/user | Mock APIs; fresh browser context | Welcome category prompt, ShiftEnter, Enter once | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. Проверена одна начальная prompt-chip, Shift+Enter и Enter. Другие категории используют тот же handler, отдельно не кликались. |
| ADV-CORE-31 | Советник | synthetic guest/user | Mock APIs; fresh browser context | Long response expand and safe partial cards | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. Длинный220-line текст, expand/collapse, safe plain-text fallback. CDN заблокирован; настоящий marked+DOMPurify bundle и все university-card actions здесь не проверялись. |
| ADV-CORE-32 | Советник | synthetic guest/user | Mock APIs; fresh browser context | Chat error 400 and retry; Chat error 401 and retry; Chat error 429 and retry; Chat error 500 and retry; Chat error network and retry; Chat error abort and retry | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 24/24 checks; advisor-results.json. HTTP400/401/429/500, route.abort network и injected DOMException AbortError; UI retry. Реальный120-second wall timeout не выжидался. |
| ADV-CORE-33 | Советник | synthetic guest/user | Mock APIs; fresh browser context | Quote reply, cancel, navigation keeps current conversation | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. Текущий authenticated synthetic диалог, quote/cancel, переход away/back. Не подтверждается restore после reload: implementation намеренно очищает session chat при bootstrap. |
| ADV-CORE-33-RETRY | Советник | synthetic guest/user | Mock APIs; fresh browser context | Retry preserves quote context | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. |
| ADV-CORE-33-LOGOUT | Советник | synthetic guest/user | Mock APIs; fresh browser context | Pending authenticated response after logout | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. |
| ADV-CORE-34 | Расчёт | synthetic guest/user | Mock APIs; fresh browser context | Admission score boundaries and keyboard submit | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. |
| ADV-CORE-35 | Расчёт | synthetic guest/user | Mock APIs; fresh browser context | Empty and unknown chance result semantics | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. |
| ADV-CORE-37 | Расчёт | synthetic guest/user | Mock APIs; fresh browser context | Admission reverse replies and route departure | Assertions in advisor-regression.cjs | 402/1280 light/dark | ПРОЙДЕНО | 4/4 checks; advisor-results.json. |

## Гранты/план: доказанная часть общих сценариев

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| CORE-14-covered | Гранты | гость | Synthetic fixtures | Все4 вкладки; ArrowLeft/Right с циклом, Home/End; selected и activeElement | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs + planning-gaps GR-KEYS |
| CORE-15-covered | Гранты | гость | Synthetic fixtures | Поиск debounce Unicode; все4 filter request params одним представительным значением; reset;15items pagination12→15 без дублей; details/source | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs + planning-gaps GR-DETAIL + planning-save PAGINATION/FILTER-PARAMS |
| CORE-16-covered | Гранты | пользователь | Synthetic fixtures | 401login; успешное новое сохранение;500save rollback/retry;500removal сохранение карточки/retry; duplicate guards/focus/live/empty | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs + planning-save SAVE-FAIL-RETRY/REMOVE-FAIL-RETRY |
| CORE-17-covered | Гранты | гость | Synthetic fixtures | ENTempty/−1/141/12.5 blocked no request;0/140 valid; одинаковые предметы ошибка/focus/no request; исправление; stale input/response | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs + planning-save ENT-BOUNDS/SAME-SUBJECTS |
| CORE-18-covered | Гранты | гость | Synthetic fixtures | Неизвестный год гранта; минимум другого года не подтверждён; справочная цена2026 при2027; funding details/source | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | planning-gaps GR-UNKNOWN |
| CORE-19-covered | Гранты | пользователь | Synthetic fixtures | Mock save успех; duplicate pending save=1; stale input cannot save | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs |
| CORE-20-covered | Гранты | гость | Synthetic fixtures | Catalog503 retry; delayed opportunities ответы наоборот; переключение вкладок в обычном режиме | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-grants.cjs |
| CORE-21-covered | План | гость | Synthetic fixtures | 7required labels; subject duplicate linked error; корректная анкета | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs |
| CORE-22-covered | План | гость | Synthetic fixtures | Preview; details; source link безопасный target/rel; online source-check mock warning | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs + planning-gaps PL-DETAIL |
| CORE-23-covered | План | гость | Synthetic fixtures | Comparison2026 threshold vs2027, unknown language/deadline; paid reference price vs unknown requested price | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs + PL-DETAIL |
| CORE-24-covered | План | гость | Synthetic fixtures | 1/2 selection compare/change; retains selection; missing programme notice; table region | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs |
| CORE-25-covered | План | пользователь | Synthetic fixtures | Saved success step4; pending save + changing selection ignored; stale disabled | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs |
| CORE-26-covered | План | пользователь | Synthetic fixtures | Open/reopen steps progress; failure rollback/retry; delete cancel/503 alert/retry success; restore triggers fresh preview | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-saved.cjs + planning-gaps PL-DELETE/PL-RECHECK |
| CORE-27-covered | План | гость | Synthetic fixtures | AI details;503 message enabled retry; quota reason; draft fills ENT/year/subjects | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | planning-gaps PL-AI |
| CORE-28-covered | План | гость/пользователь | Synthetic fixtures | Changed selection during save; changed questionnaire stale; failed refresh retains; auth event clears result | Assertions текущего bounded сценария | По evidence | ПРОЙДЕНО | core-planner-transitions.cjs |

## Остальные обнаруженные ветки грантов/плана

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| PLAN-X1 | Вузы во вкладке: поиск/детали/compare CTA | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | Вкладка открывалась; каждый CTA не активировался |
| PLAN-X2 | Гранты: saved plans + grants частичный отказ одногоAPI | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | tested общий401, не оба independent outcomes |
| PLAN-X3 | Гранты: неизвестный/прошедший/сегодняшний deadline | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | bounded unknown year, не календарная матрица |
| PLAN-X4 | План: funding grant vs paid budget toggle | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | Оба режима использованы; все переходы/сбросы неasserted |
| PLAN-X5 | План: Открыть мой чек-лист после save | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | Сохранённые планы открыты отдельно |
| PLAN-X6 | План: snapshot-review раскрыть/source links | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | collapsed состояние asserted существующим harness; каждая запись не раскрывалась |
| PLAN-X7 | План: server needs_input questions/focus | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | Толькоready preview |
| PLAN-X8 | План: AI черновик malformed/unsafeURL/все reason codes | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | Толькоdraft/quota/503 |
| PLAN-X9 | Гранты и план: KK/EN локализация | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | НЕ ПРОВЕРЕНО | BoundedRU |
| PLAN-X10 | Настоящие API/account persistence и платныйAI | fixture | Ветка исходников | См. ограничение | Функция работает | Не прогонялась целиком | ЗАБЛОКИРОВАНО | Изоляция исключает внешние записи/оплату |

## Responsive geometry: снимки и измерения, не полный функциональный PASS

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| M01 | all14routes | guest/fixture user | baseline | navigate and capture | no page overflow/readable controls | 402x874,1280x900 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M02 | home/login/register/planner/grants/admission | guest | narrow/medium/wide | capture and measure | page fits; fields >=16px mobile | 320,360,390,430,768,1024,1440 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M03 | navigation/forms/dialogs | guest | landscape | open route/sheet | controls remain reachable | 874x402 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M04 | forms/dialogs | guest | short height | open route/sheet | scroll to actions | 402x400 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M05 | home/login/planner/grants | guest | 200% text | font sizes double | no hidden actions/text | 402x874,1280x900 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M06 | filter/modal/menu | guest | dialog open | open and measure | 44px targets and no overflow | 402/1280 | НЕ ПРОВЕРЕНО | Геометрия подтверждена строками MG/MD ниже; полная кликабельность/всеcontrol bounds не утверждаются |
| M07 | mobile form fields | guest | unfocused/focused | inspect borders/focus | visible settled focus | 402 DPR3 both themes | НЕ ПРОВЕРЕНО | pending |
| M08 | original rectangular lines | original browser | original tab unavailable | reproduce exact report | identify observed cause | original browser | ЗАБЛОКИРОВАНО | Original runtime unavailable; no inferred cause |
| M09 | map/fonts | guest | CDN resources blocked by isolated fixture | compare network resources | real map/font rendering | all | ЗАБЛОКИРОВАНО | Fixture intentionally blocks external network |
| MG1 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-home.png; mobile-results.json |
| MG2 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-login.png; mobile-results.json |
| MG3 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-register.png; mobile-results.json |
| MG4 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-planner.png; mobile-results.json |
| MG5 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-grants.png; mobile-results.json |
| MG6 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-light-admission.png; mobile-results.json |
| MG7 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-home.png; mobile-results.json |
| MG8 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-login.png; mobile-results.json |
| MG9 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-register.png; mobile-results.json |
| MG10 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-planner.png; mobile-results.json |
| MG11 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-grants.png; mobile-results.json |
| MG12 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 320x874 | ПРОЙДЕНО | mobile-320-874-base-dark-admission.png; mobile-results.json |
| MG13 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-home.png; mobile-results.json |
| MG14 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-login.png; mobile-results.json |
| MG15 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-register.png; mobile-results.json |
| MG16 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-planner.png; mobile-results.json |
| MG17 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-grants.png; mobile-results.json |
| MG18 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-light-admission.png; mobile-results.json |
| MG19 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-home.png; mobile-results.json |
| MG20 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-login.png; mobile-results.json |
| MG21 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-register.png; mobile-results.json |
| MG22 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-planner.png; mobile-results.json |
| MG23 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-grants.png; mobile-results.json |
| MG24 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 360x874 | ПРОЙДЕНО | mobile-360-874-base-dark-admission.png; mobile-results.json |
| MG25 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-home.png; mobile-results.json |
| MG26 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-login.png; mobile-results.json |
| MG27 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-register.png; mobile-results.json |
| MG28 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-planner.png; mobile-results.json |
| MG29 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-grants.png; mobile-results.json |
| MG30 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-light-admission.png; mobile-results.json |
| MG31 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-home.png; mobile-results.json |
| MG32 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-login.png; mobile-results.json |
| MG33 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-register.png; mobile-results.json |
| MG34 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-planner.png; mobile-results.json |
| MG35 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-grants.png; mobile-results.json |
| MG36 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 390x874 | ПРОЙДЕНО | mobile-390-874-base-dark-admission.png; mobile-results.json |
| MG37 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-home.png; mobile-results.json |
| MG38 | university | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-university.png; mobile-results.json |
| MG39 | compare | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-compare.png; mobile-results.json |
| MG40 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-planner.png; mobile-results.json |
| MG41 | advisor | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-advisor.png; mobile-results.json |
| MG42 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-admission.png; mobile-results.json |
| MG43 | career | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-career.png; mobile-results.json |
| MG44 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-grants.png; mobile-results.json |
| MG45 | map | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-map.png; mobile-results.json |
| MG46 | tips | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-tips.png; mobile-results.json |
| MG47 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-login.png; mobile-results.json |
| MG48 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-register.png; mobile-results.json |
| MG49 | profile | fixture user | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-profile.png; mobile-results.json; исправление подтверждено MF01/MF02 и mobile-profile-after.json |
| MG50 | 404 | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-light-404.png; mobile-results.json |
| MG51 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-home.png; mobile-results.json |
| MG52 | university | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-university.png; mobile-results.json |
| MG53 | compare | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-compare.png; mobile-results.json |
| MG54 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-planner.png; mobile-results.json |
| MG55 | advisor | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-advisor.png; mobile-results.json |
| MG56 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-admission.png; mobile-results.json |
| MG57 | career | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-career.png; mobile-results.json |
| MG58 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-grants.png; mobile-results.json |
| MG59 | map | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-map.png; mobile-results.json |
| MG60 | tips | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-tips.png; mobile-results.json |
| MG61 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-login.png; mobile-results.json |
| MG62 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-register.png; mobile-results.json |
| MG63 | profile | fixture user | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-profile.png; mobile-results.json; исправление подтверждено MF01/MF02 и mobile-profile-after.json |
| MG64 | 404 | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-base-dark-404.png; mobile-results.json |
| MG65 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-home.png; mobile-results.json |
| MG66 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-login.png; mobile-results.json |
| MG67 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-register.png; mobile-results.json |
| MG68 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-planner.png; mobile-results.json |
| MG69 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-grants.png; mobile-results.json |
| MG70 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-light-admission.png; mobile-results.json |
| MG71 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-home.png; mobile-results.json |
| MG72 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-login.png; mobile-results.json |
| MG73 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-register.png; mobile-results.json |
| MG74 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-planner.png; mobile-results.json |
| MG75 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-grants.png; mobile-results.json |
| MG76 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 430x874 | ПРОЙДЕНО | mobile-430-874-base-dark-admission.png; mobile-results.json |
| MG77 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-home.png; mobile-results.json |
| MG78 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-login.png; mobile-results.json |
| MG79 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-register.png; mobile-results.json |
| MG80 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-planner.png; mobile-results.json |
| MG81 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-grants.png; mobile-results.json |
| MG82 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-light-admission.png; mobile-results.json |
| MG83 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-home.png; mobile-results.json |
| MG84 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-login.png; mobile-results.json |
| MG85 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-register.png; mobile-results.json |
| MG86 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-planner.png; mobile-results.json |
| MG87 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-grants.png; mobile-results.json |
| MG88 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 768x874 | ПРОЙДЕНО | mobile-768-874-base-dark-admission.png; mobile-results.json |
| MG89 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-home.png; mobile-results.json |
| MG90 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-login.png; mobile-results.json |
| MG91 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-register.png; mobile-results.json |
| MG92 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-planner.png; mobile-results.json |
| MG93 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-grants.png; mobile-results.json |
| MG94 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-light-admission.png; mobile-results.json |
| MG95 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-home.png; mobile-results.json |
| MG96 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-login.png; mobile-results.json |
| MG97 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-register.png; mobile-results.json |
| MG98 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-planner.png; mobile-results.json |
| MG99 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-grants.png; mobile-results.json |
| MG100 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1024x900 | ПРОЙДЕНО | mobile-1024-900-base-dark-admission.png; mobile-results.json |
| MG101 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-home.png; mobile-results.json |
| MG102 | university | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-university.png; mobile-results.json |
| MG103 | compare | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-compare.png; mobile-results.json |
| MG104 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-planner.png; mobile-results.json |
| MG105 | advisor | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-advisor.png; mobile-results.json |
| MG106 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-admission.png; mobile-results.json |
| MG107 | career | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-career.png; mobile-results.json |
| MG108 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-grants.png; mobile-results.json |
| MG109 | map | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-map.png; mobile-results.json |
| MG110 | tips | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-tips.png; mobile-results.json |
| MG111 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-login.png; mobile-results.json |
| MG112 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-register.png; mobile-results.json |
| MG113 | profile | fixture user | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-profile.png; mobile-results.json; исправление подтверждено MF01/MF02 и mobile-profile-after.json |
| MG114 | 404 | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-light-404.png; mobile-results.json |
| MG115 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-home.png; mobile-results.json |
| MG116 | university | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-university.png; mobile-results.json |
| MG117 | compare | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-compare.png; mobile-results.json |
| MG118 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-planner.png; mobile-results.json |
| MG119 | advisor | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-advisor.png; mobile-results.json |
| MG120 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-admission.png; mobile-results.json |
| MG121 | career | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-career.png; mobile-results.json |
| MG122 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-grants.png; mobile-results.json |
| MG123 | map | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-map.png; mobile-results.json |
| MG124 | tips | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-tips.png; mobile-results.json |
| MG125 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-login.png; mobile-results.json |
| MG126 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-register.png; mobile-results.json |
| MG127 | profile | fixture user | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-profile.png; mobile-results.json; исправление подтверждено MF01/MF02 и mobile-profile-after.json |
| MG128 | 404 | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-base-dark-404.png; mobile-results.json |
| MG129 | home | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-home.png; mobile-results.json |
| MG130 | login | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-login.png; mobile-results.json |
| MG131 | register | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-register.png; mobile-results.json |
| MG132 | planner | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-planner.png; mobile-results.json |
| MG133 | grants | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-grants.png; mobile-results.json |
| MG134 | admission | guest/fixture | light, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-light-admission.png; mobile-results.json |
| MG135 | home | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-home.png; mobile-results.json |
| MG136 | login | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-login.png; mobile-results.json |
| MG137 | register | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-register.png; mobile-results.json |
| MG138 | planner | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-planner.png; mobile-results.json |
| MG139 | grants | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-grants.png; mobile-results.json |
| MG140 | admission | guest/fixture | dark, baseline | navigate + measure | page fits; buttons 44px | 1440x900 | ПРОЙДЕНО | mobile-1440-900-base-dark-admission.png; mobile-results.json |
| MG141 | home | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-home.png; mobile-results.json |
| MG142 | login | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-login.png; mobile-results.json |
| MG143 | register | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-register.png; mobile-results.json |
| MG144 | planner | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-planner.png; mobile-results.json |
| MG145 | grants | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-grants.png; mobile-results.json |
| MG146 | admission | guest/fixture | light, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-light-admission.png; mobile-results.json |
| MG147 | home | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-home.png; mobile-results.json |
| MG148 | login | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-login.png; mobile-results.json |
| MG149 | register | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-register.png; mobile-results.json |
| MG150 | planner | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-planner.png; mobile-results.json |
| MG151 | grants | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-grants.png; mobile-results.json |
| MG152 | admission | guest/fixture | dark, landscape | navigate + measure | page fits; buttons 44px | 874x402 | ПРОЙДЕНО | mobile-874-402-landscape-dark-admission.png; mobile-results.json |
| MG153 | home | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-home.png; mobile-results.json |
| MG154 | login | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-login.png; mobile-results.json |
| MG155 | register | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-register.png; mobile-results.json |
| MG156 | planner | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-planner.png; mobile-results.json |
| MG157 | grants | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-grants.png; mobile-results.json |
| MG158 | admission | guest/fixture | light, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-light-admission.png; mobile-results.json |
| MG159 | home | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-home.png; mobile-results.json |
| MG160 | login | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-login.png; mobile-results.json |
| MG161 | register | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-register.png; mobile-results.json |
| MG162 | planner | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-planner.png; mobile-results.json |
| MG163 | grants | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-grants.png; mobile-results.json |
| MG164 | admission | guest/fixture | dark, short | navigate + measure | page fits; buttons 44px | 402x400 | ПРОЙДЕНО | mobile-402-400-short-dark-admission.png; mobile-results.json |
| MG165 | home | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-home.png; mobile-text-results.json |
| MG166 | login | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-login.png; mobile-text-results.json |
| MG167 | register | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-register.png; mobile-text-results.json |
| MG168 | planner | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-planner.png; mobile-text-results.json |
| MG169 | grants | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-grants.png; mobile-text-results.json |
| MG170 | admission | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-light-admission.png; mobile-text-results.json |
| MG171 | home | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-home.png; mobile-text-results.json |
| MG172 | login | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-login.png; mobile-text-results.json |
| MG173 | register | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-register.png; mobile-text-results.json |
| MG174 | planner | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-planner.png; mobile-text-results.json |
| MG175 | grants | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-grants.png; mobile-text-results.json |
| MG176 | admission | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 402x874 | ПРОЙДЕНО | mobile-402-874-text200-dark-admission.png; mobile-text-results.json |
| MG177 | home | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-home.png; mobile-text-results.json |
| MG178 | login | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-login.png; mobile-text-results.json |
| MG179 | register | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-register.png; mobile-text-results.json |
| MG180 | planner | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-planner.png; mobile-text-results.json |
| MG181 | grants | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-grants.png; mobile-text-results.json |
| MG182 | admission | guest/fixture | light, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-light-admission.png; mobile-text-results.json |
| MG183 | home | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-home.png; mobile-text-results.json |
| MG184 | login | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-login.png; mobile-text-results.json |
| MG185 | register | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-register.png; mobile-text-results.json |
| MG186 | planner | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-planner.png; mobile-text-results.json |
| MG187 | grants | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-grants.png; mobile-text-results.json |
| MG188 | admission | guest/fixture | dark, text200 | navigate + measure | page fits; buttons 44px | 1280x900 | ПРОЙДЕНО | mobile-1280-900-text200-dark-admission.png; mobile-text-results.json |
| MD1 | filter-sheet | guest | 402-874-light-filter-sheet | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-light-filter-sheet.png; mobile-dialog-results.json |
| MD2 | modal-about | guest | 402-874-light-modal-about | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-light-modal-about.png; mobile-dialog-results.json |
| MD3 | modal-privacy | guest | 402-874-light-modal-privacy | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-light-modal-privacy.png; mobile-dialog-results.json |
| MD4 | modal-terms | guest | 402-874-light-modal-terms | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-light-modal-terms.png; mobile-dialog-results.json |
| MD5 | modal-contacts | guest | 402-874-light-modal-contacts | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-light-modal-contacts.png; mobile-dialog-results.json |
| MD6 | filter-sheet | guest | 402-874-dark-filter-sheet | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-dark-filter-sheet.png; mobile-dialog-results.json |
| MD7 | modal-about | guest | 402-874-dark-modal-about | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-dark-modal-about.png; mobile-dialog-results.json |
| MD8 | modal-privacy | guest | 402-874-dark-modal-privacy | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-dark-modal-privacy.png; mobile-dialog-results.json |
| MD9 | modal-terms | guest | 402-874-dark-modal-terms | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-dark-modal-terms.png; mobile-dialog-results.json |
| MD10 | modal-contacts | guest | 402-874-dark-modal-contacts | open, screenshot, Escape | dialog inside viewport | 402x874 | ПРОЙДЕНО | mobile-dialog-402-874-dark-modal-contacts.png; mobile-dialog-results.json |
| MD11 | filter-sheet | guest | 1280-900-light-filter-sheet | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-light-filter-sheet.png; mobile-dialog-results.json |
| MD12 | modal-about | guest | 1280-900-light-modal-about | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-light-modal-about.png; mobile-dialog-results.json |
| MD13 | modal-privacy | guest | 1280-900-light-modal-privacy | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-light-modal-privacy.png; mobile-dialog-results.json |
| MD14 | modal-terms | guest | 1280-900-light-modal-terms | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-light-modal-terms.png; mobile-dialog-results.json |
| MD15 | modal-contacts | guest | 1280-900-light-modal-contacts | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-light-modal-contacts.png; mobile-dialog-results.json |
| MD16 | filter-sheet | guest | 1280-900-dark-filter-sheet | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-dark-filter-sheet.png; mobile-dialog-results.json |
| MD17 | modal-about | guest | 1280-900-dark-modal-about | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-dark-modal-about.png; mobile-dialog-results.json |
| MD18 | modal-privacy | guest | 1280-900-dark-modal-privacy | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-dark-modal-privacy.png; mobile-dialog-results.json |
| MD19 | modal-terms | guest | 1280-900-dark-modal-terms | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-dark-modal-terms.png; mobile-dialog-results.json |
| MD20 | modal-contacts | guest | 1280-900-dark-modal-contacts | open, screenshot, Escape | dialog inside viewport | 1280x900 | ПРОЙДЕНО | mobile-dialog-1280-900-dark-modal-contacts.png; mobile-dialog-results.json |
| MD21 | filter-sheet | guest | 874-402-light-filter-sheet | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-light-filter-sheet.png; mobile-dialog-results.json |
| MD22 | modal-about | guest | 874-402-light-modal-about | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-light-modal-about.png; mobile-dialog-results.json |
| MD23 | modal-privacy | guest | 874-402-light-modal-privacy | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-light-modal-privacy.png; mobile-dialog-results.json |
| MD24 | modal-terms | guest | 874-402-light-modal-terms | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-light-modal-terms.png; mobile-dialog-results.json |
| MD25 | modal-contacts | guest | 874-402-light-modal-contacts | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-light-modal-contacts.png; mobile-dialog-results.json |
| MD26 | filter-sheet | guest | 874-402-dark-filter-sheet | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-dark-filter-sheet.png; mobile-dialog-results.json |
| MD27 | modal-about | guest | 874-402-dark-modal-about | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-dark-modal-about.png; mobile-dialog-results.json |
| MD28 | modal-privacy | guest | 874-402-dark-modal-privacy | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-dark-modal-privacy.png; mobile-dialog-results.json |
| MD29 | modal-terms | guest | 874-402-dark-modal-terms | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-dark-modal-terms.png; mobile-dialog-results.json |
| MD30 | modal-contacts | guest | 874-402-dark-modal-contacts | open, screenshot, Escape | dialog inside viewport | 874x402 | ПРОЙДЕНО | mobile-dialog-874-402-dark-modal-contacts.png; mobile-dialog-results.json |
| MD31 | filter-sheet | guest | 402-400-light-filter-sheet | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-light-filter-sheet.png; mobile-dialog-results.json |
| MD32 | modal-about | guest | 402-400-light-modal-about | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-light-modal-about.png; mobile-dialog-results.json |
| MD33 | modal-privacy | guest | 402-400-light-modal-privacy | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-light-modal-privacy.png; mobile-dialog-results.json |
| MD34 | modal-terms | guest | 402-400-light-modal-terms | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-light-modal-terms.png; mobile-dialog-results.json |
| MD35 | modal-contacts | guest | 402-400-light-modal-contacts | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-light-modal-contacts.png; mobile-dialog-results.json |
| MD36 | filter-sheet | guest | 402-400-dark-filter-sheet | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-dark-filter-sheet.png; mobile-dialog-results.json |
| MD37 | modal-about | guest | 402-400-dark-modal-about | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-dark-modal-about.png; mobile-dialog-results.json |
| MD38 | modal-privacy | guest | 402-400-dark-modal-privacy | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-dark-modal-privacy.png; mobile-dialog-results.json |
| MD39 | modal-terms | guest | 402-400-dark-modal-terms | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-dark-modal-terms.png; mobile-dialog-results.json |
| MD40 | modal-contacts | guest | 402-400-dark-modal-contacts | open, screenshot, Escape | dialog inside viewport | 402x400 | ПРОЙДЕНО | mobile-dialog-402-400-dark-modal-contacts.png; mobile-dialog-results.json |
| MF01 | profile logout | fixture user | light/dark | navigate + measure | button >=44px | 402/1280 | ПРОЙДЕНО | mobile-profile-after.json; before had42.14/40px |
| MF02 | profile passwords | fixture user | light/dark | measure reserve and toggle | reserve covers88px action; height44 | 402/1280 | ПРОЙДЕНО | mobile-profile-before/after.json; padding40→98px desktop |
| MF03 | fallback toast CSS | fixture DOM | light/dark, long unbroken string | insert toast DOM | box inside viewport, wrap | 402x874,1280x900,874x402,402x400 | ПРОЙДЕНО | mobile-toast-results.json, mobile-toast-*.png; JS behavior delegated |

## Настоящий изолированный API и unit tests

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| PUBLIC-0 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/cities | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-1 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/universities | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-2 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/specialties | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-3 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/grants/catalog | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-4 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/opportunities | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-5 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/tips | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-6 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/admission/options | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-7 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/data/sources | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| PUBLIC-8 | Public catalog | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/data/deadlines | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| AUTH-9 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/profile | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-10 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/saved-universities | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-11 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/chat-history | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-12 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/test-results | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-13 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/applications | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-14 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/admission/history | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-15 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/planner/plans | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-16 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/grants/saved/list | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| AUTH-17 | Session required | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/verify/ent/status | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| ADMIN-guest | Admin role | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/admin/overview | HTTP 401 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; Токен не найден; api-probe-results.json |
| ADMIN-user | Admin role | user | Свежая temp DB; синтетические роли; CSRF | GET /api/admin/overview | HTTP 403 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=403; Требуются права администратора; api-probe-results.json |
| ADMIN-moderator_reviews | Admin role | moderator_reviews | Свежая temp DB; синтетические роли; CSRF | GET /api/admin/overview | HTTP 403 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=403; Требуются права администратора; api-probe-results.json |
| ADMIN-admin | Admin role | admin | Свежая temp DB; синтетические роли; CSRF | GET /api/admin/overview | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; response checked; api-probe-results.json |
| 404-API | Routing | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/missing-audit | HTTP 404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=404; API endpoint not found; api-probe-results.json |
| 404-UNI | Routing | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/universities/99999 | HTTP 404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=404; Not found; api-probe-results.json |
| 400-LOGIN | Auth types | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/auth/login | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Укажите email и пароль; api-probe-results.json |
| 400-REG | Auth types | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/auth/register | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Неверный формат email; api-probe-results.json |
| 400-PLANNER | Input range | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/programme-preview | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Проверьте значения: ЕНТ 0–140, два разных предмета, год 2026–2030 и неотрицательный бюджет.; api-probe-results.json |
| 400-SOURCE | URL allowlist | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/sources/check | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Некорректные источники / Қате дереккөздер; api-probe-results.json |
| CSRF | CSRF binding | user | Свежая temp DB; синтетические роли; CSRF | POST /api/chat-history | HTTP 201 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=201; response checked; api-probe-results.json |
| CSRF-MISSING | CSRF | user | Свежая temp DB; синтетические роли; CSRF | PUT /api/profile | HTTP 403 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=403; missing header rejected; api-probe-results.json |
| IDOR-CHAT | Cross-user object | other | Свежая temp DB; синтетические роли; CSRF | DELETE /api/chat-history/1 | HTTP 400/403/404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; true; api-probe-results.json |
| DUP-SAVED-1 | Duplicate favorite | user | Свежая temp DB; синтетические роли; CSRF | POST /api/saved-universities | HTTP 201 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=201; response checked; api-probe-results.json |
| DUP-SAVED-2 | Duplicate favorite | user | Свежая temp DB; синтетические роли; CSRF | POST /api/saved-universities | HTTP 400/409 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Вуз уже добавлен в избранное; api-probe-results.json |
| IDOR-SAVED | Cross-user list | other | Свежая temp DB; синтетические роли; CSRF | GET /api/saved-universities | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Other user list excludes owner favorite; api-probe-results.json |
| 400-UPLOAD | File signature | user | Свежая temp DB; синтетические роли; CSRF | POST /api/verify/ent | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Загрузите JPG, PNG, WEBP или PDF до 5 МБ. Для подтверждения нужен документ.; api-probe-results.json |
| UPLOAD-VALID | File fixture | user | Свежая temp DB; синтетические роли; CSRF | POST /api/verify/ent | HTTP 200/201 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=201; pending; api-probe-results.json |
| 409-UPLOAD | Duplicate pending upload | user | Свежая temp DB; синтетические роли; CSRF | POST /api/verify/ent | HTTP 409 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=409; Заявка уже на проверке. Дождитесь решения или отмените её.; api-probe-results.json |
| IDOR-DOC | File owner | other | Свежая temp DB; синтетические роли; CSRF | GET /api/verify/ent/1/document | HTTP 403/404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=404; Документ не найден; api-probe-results.json |
| GRANT-SAVE-INVALID | Missing grant | user | Свежая temp DB; синтетические роли; CSRF | POST /api/grants/99999/save | HTTP 400/404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=404; Грант не найден; api-probe-results.json |
| REVIEW-INVALID-TYPE | Review validation | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/universities/1/reviews | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Provide a name and an integer rating from 1 to 5; api-probe-results.json |
| REVIEW-MISSING-UNI | Review relation | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/universities/99999/reviews | HTTP 400/404 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=404; University not found; api-probe-results.json |
| REVIEW-OBJECT | Review type validation | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/universities/1/reviews | HTTP 400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=400; Provide a name and an integer rating from 1 to 5; api-probe-results.json |
| 429-REVIEW | Review throttle | guest | Свежая temp DB; синтетические роли; CSRF | POST /api/universities/1/reviews | HTTP 429 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=429; Too many reviews. Please wait 5 minutes.; api-probe-results.json |
| ANALYTICS-PRIVATE | Query privacy | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/analytics/top-queries | HTTP 401/403 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=401; {"containsOtherUserQuery":false}; api-probe-results.json |
| XSS-CHAT | Stored text safety | user | Свежая temp DB; синтетические роли; CSRF | POST /api/chat-history | HTTP 201 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=201; response checked; api-probe-results.json |
| XSS-READ | Stored text safety | user | Свежая temp DB; синтетические роли; CSRF | GET /api/chat-history | HTTP 200 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; true; api-probe-results.json |
| 429-TOOLS-0 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-1 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-2 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-3 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-4 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-5 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-6 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-7 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-8 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-9 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 200/400 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=200; Сообщение: 1–2000 символов / Хабарлама: 1–2000 таңба; api-probe-results.json |
| 429-TOOLS-10 | Tool throttle | user | Свежая temp DB; синтетические роли; CSRF | POST /api/planner/interpret | HTTP 429 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=429; Слишком много запросов / Сұраулар тым көп; api-probe-results.json |
| CORS-UNTRUSTED | CORS | guest | Свежая temp DB; синтетические роли; CSRF | GET /api/cities | HTTP 403 | HTTP/Node, device-independent | ПРОЙДЕНО | actual=403; Untrusted origin rejected, response should be controlled 403; api-probe-results.json |
| TEST-114 | Полный npm test | fixture roles | Temp source mirror, no env/work DB/uploads | node --test 11 explicit test files | 114 success | Node/API + pure units | ПРОЙДЕНО | api-existing-tests.log:114 pass0fail; specific coverage names in log |
| SEMANTIC-UNKNOWN | Admission/programme/funding semantics | guest | Pure fixtures | Unknown thresholds/prices, expired years, sources, cross-university stats | Unknown not0; evidence/year preserved | Node units | ПРОЙДЕНО | programme-planner, admission-stat-quality, funding-import tests |
| AI-TOOLS | AI calls/output | user | Injected fake model/fetch | Bounds unknown tools, source allowlist, fallback, truncated outputs | No arbitrary actions/calls | Node units | ПРОЙДЕНО | planner-agent.test.js; ai-completion.test.js; no paid model |
| FAILURE-500 | Controlled server failure / rollback | admin | Disposable DB only | Injected audit failure during university/delete/verification writes | 500 and transaction rollback; preserve rows | Node/API | ПРОЙДЕНО | regression.test.js rollback cases; no working DB touched |
| AI-REAL | Paid model/provider | user | Live API key not loaded | Real provider completion/latency | Not called | external | НЕ ПРОВЕРЕНО | No secrets or paid AI used |
| ENV-PROD | Production headers/cookies/proxy | all | Only NODE_ENV=test actual | TLS deployment, proxy trust, real browser cookie CSRF | Needs deployment test | real prod | НЕ ПРОВЕРЕНО | No production server/account touched |
| RECOVERY | Recovery/2FA | guest | Existing test fixture | Disabled routes do not issue secrets | Disabled capability | Node/API | ПРОЙДЕНО | regression test unfinished recovery and 2FA |
| ALIASES | Every endpoint role & verb permutation | all | Static inventory available | All declared endpoint×role×invalid-body combinations | Exhaustive combination run | HTTP | НЕ ПРОВЕРЕНО | api-inventory.md enumerates; 58 probes + existing regression cover subset, aliases not all executed |
| WORK-DATA | Working admission/grant evidence | all | No work DB read | Actual dataset content/freshness | Separate data audit needed | DB | НЕ ПРОВЕРЕНО | Synthetic data only; no claims live source verification |
| LIMIT-GLOBAL | Global 200/min abuse | guest | Loopback server only | 200/min exact threshold/distributed behavior | 429 and recovery | HTTP | НЕ ПРОВЕРЕНО | Only tool10/min and review3/window exercised; no broad load test |
| XSS-HELPER | security.js helper reachability | guest | Static callsite scan | sanitizeHtml fallback and active markup | Should sanitize without throw | browser | ПРОЙДЕНО | No live callsite; parent reproduced invalid selector and fixed helper to DOMPurify or escaped text. content-before.json / content-after.json |

## Оболочка, клавиатура и ограниченные performance измерения

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| SHELL-01-402 | Оболочка | guest | Static fixture,CDN blocked | SHELL-01 | Assertions в shell-regression.cjs | 402 | ПРОЙДЕНО | "Обе темы и RU/KK/EN сохраняются после reload; качество всех переводов не оценивалось" |
| SHELL-02-402 | Оболочка | guest | Static fixture,CDN blocked | SHELL-02 | Assertions в shell-regression.cjs | 402 | ПРОЙДЕНО | "4 dialogs: focus trap, Escape, background inert restored" |
| SHELL-03-402 | Оболочка | guest | Static fixture,CDN blocked | SHELL-03 | Assertions в shell-regression.cjs | 402 | ПРОЙДЕНО | "40 route transitions; one keyboard action toggles once, no pageerror" |
| SHELL-04-402 | Оболочка | guest | Static fixture,CDN blocked | SHELL-04 | Assertions в shell-regression.cjs | 402 | ПРОЙДЕНО | {"focus":{"tag":"BUTTON","outline":"solid","outlineWidth":"3px","shadow":"none"},"reducedMotion":"matched; transitions suppressed by existing CSS; not screen-reader certification"} |
| SHELL-05-402 | Оболочка | guest | Static fixture,CDN blocked | SHELL-05 | Assertions в shell-regression.cjs | 402 | ПРОЙДЕНО | {"cls":0.009513929861086307,"resourceCount":34,"domContentLoadedMs":571.2000000476837,"observedReadyMs":627,"delay":"app.js +500ms, external CDN aborted, 15 synthetic universities; not real-network performance score"} |
| SHELL-01-1280 | Оболочка | guest | Static fixture,CDN blocked | SHELL-01 | Assertions в shell-regression.cjs | 1280 | ПРОЙДЕНО | "Обе темы и RU/KK/EN сохраняются после reload; качество всех переводов не оценивалось" |
| SHELL-02-1280 | Оболочка | guest | Static fixture,CDN blocked | SHELL-02 | Assertions в shell-regression.cjs | 1280 | ПРОЙДЕНО | "4 dialogs: focus trap, Escape, background inert restored" |
| SHELL-03-1280 | Оболочка | guest | Static fixture,CDN blocked | SHELL-03 | Assertions в shell-regression.cjs | 1280 | ПРОЙДЕНО | "40 route transitions; one keyboard action toggles once, no pageerror" |
| SHELL-04-1280 | Оболочка | guest | Static fixture,CDN blocked | SHELL-04 | Assertions в shell-regression.cjs | 1280 | ПРОЙДЕНО | {"focus":{"tag":"SELECT","outline":"solid","outlineWidth":"2px","shadow":"none"},"reducedMotion":"matched; transitions suppressed by existing CSS; not screen-reader certification"} |
| SHELL-05-1280 | Оболочка | guest | Static fixture,CDN blocked | SHELL-05 | Assertions в shell-regression.cjs | 1280 | ПРОЙДЕНО | {"cls":0,"resourceCount":34,"domContentLoadedMs":686.7999999523163,"observedReadyMs":795,"delay":"app.js +500ms, external CDN aborted, 15 synthetic universities; not real-network performance score"} |

## Недоверенный контент: безопасные синтетические примеры

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| CONTENT-01 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-02 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-03 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-04 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-05 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-06 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |
| CONTENT-07 | Контент | fixture | Текст/кавычки/URL/unknown price | Вызвать renderer и проверить DOM | Нет активной вставки/ложного0 | 402 | ПРОЙДЕНО | content-before.json/content-price-before.json → content-after.json |

## Среда и границы приёмки

| ID | Раздел | Роль | Исходные условия | Действие | Ожидаемый результат | Устройства | Статус | Доказательство |
|---|---|---|---|---|---|---|---|---|
| ENV-01 | localhost | readonly | RunningPID21220 | Сравнить8 HTTPasset SHA256 сworkspace | Равные файлы | HTTP | ПРОЙДЕНО | server-proof.json;frontend раздаётся из ../frontend |
| ENV-02 | Backend activation | admin | Workingserver запущен до fixes | Применить backend fixes к рабочему процессу | Новый код обслуживаетlocalhost | Рабочая среда | ЗАБЛОКИРОВАНО | Процесс не перезапущен,чтобы не запускать migrations на рабочейБД в ходе теста |
| ENV-03 | Safari/device | user | Edge emulation | ФизическийiPhone/WebKit/Safari | Проверка реального движка | iPhone | ЗАБЛОКИРОВАНО | Доступен Edge154 Chromium и CodexIAB; Safari/физическийтелефон не подключены |
| ENV-04 | Visual review | fixture | Послеfixes | 28 representative captures+university;8 просмотрены | Нет видимыхblocking defects в просмотренныхкадрах | 402/1280 обе темы | ПРОЙДЕНО | final-visual.md;final-chat-confirm.json:actual paragraph6.39/10.84 |
| ENV-05 | A11y scope | user | Sampled keyboard/contrast | Полныйscreen-reader/WCAG аудит | Все accessible flows | Все | НЕ ПРОВЕРЕНО | Естьfocus trap/keyboard/contrast samples;screen reader иexhaustive contrast не выполнены |
| ENV-06 | Recovery/2FA UI | guest | Feature disabled | Восстановить пароль/2FA | ДоступнойUI функциинет | Все | НЕПРИМЕНИМО | API RECOVERY подтверждает disabled behavior;не заявляем функцию реализованной |
