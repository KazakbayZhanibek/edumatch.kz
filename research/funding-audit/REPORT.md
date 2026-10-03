# Аудит и точечное content-исправление funding-карточек EduMatch KZ

**Срез базы до content-записи:** 2026-09-27. **После записи:** 2026-09-27. **Scope:** только grants и funding metadata; университеты, admission programmes и programme tables не изменялись.

## Итог

После повторного чтения базы обнаружено **108 grants**, включая новые записи Satbayev, КБТУ и SDU (IDs 406–416). Старые количества 97/44/40/13 не использовались для записи.

Ранее транзакционно применены status/review corrections по **32 конкретным ID**. Затем по тем же 32 ID транзакционно исправлено содержание проблемных карточек. Удаление, объединение дублей, изменение university_id/city_id, grant_universities и принадлежности к программам **не выполнялись**.

## Counts after update

| verification_status | До | После |
|---|---:|---:|
| verified | 45 | 16 |
| needs_review | 51 | 68 |
| conflicting | 0 | 6 |
| source_unavailable | 0 | 4 |
| not_published | 12 | 14 |
| **Всего** | **108** | **108** |

Типы после повторного чтения: corporate — 12, discount — 8, foundation — 2, government — 18, installment — 8, regional — 1, university — 59. source_url заполнен у 105, отсутствует у 3. В grant_universities осталось 46 строк; эти связи не менялись.

## WAL-aware backup

Резервная копия создана штатным SQLite backup API через better-sqlite3 до транзакции:

- research/funding-audit/edumatch-before-funding-fix-20260927.sqlite — backup до status-транзакции
- research/funding-audit/edumatch-before-content-fix-20260927.sqlite — backup до content-транзакции
- сопутствующие WAL-файлы status-backup: -wal, -shm
- content-backup проверен через better-sqlite3 backup API
- исходный journal mode: wal
- backup journal mode: wal
- backup quick_check: ok
- backup foreign keys connection: 1

## Фактически применённые изменения

Для каждой строки UPDATE проверялись исходные id, verification_status, verified_at, last_checked_by, review_notes и reviewed_until. Несовпадение любого исходного значения прервало бы транзакцию. Фактическое изменение ограничено status, verified_at, last_checked_by, review_notes и reviewed_until.

| ID | До status | После status | До verified_at | После verified_at |
|---:|---|---|---|---|
| 3 | verified | needs_review | 2026-09-18 | NULL |
| 51 | verified | needs_review | 2026-09-18 | NULL |
| 74 | verified | needs_review | 2026-09-18 | NULL |
| 100 | verified | needs_review | 2026-09-18 | NULL |
| 139 | verified | needs_review | 2026-09-18 | NULL |
| 159 | verified | needs_review | 2026-09-18 | NULL |
| 181 | verified | needs_review | 2026-09-18 | NULL |
| 182 | verified | needs_review | 2026-09-18 | NULL |
| 199 | needs_review | source_unavailable | NULL | NULL |
| 204 | verified | source_unavailable | 2026-09-18 | NULL |
| 244 | verified | needs_review | 2026-09-18 | NULL |
| 253 | verified | needs_review | 2026-09-18 | NULL |
| 268 | verified | conflicting | 2026-09-18 | NULL |
| 291 | needs_review | source_unavailable | NULL | NULL |
| 332 | verified | needs_review | 2026-09-18 | NULL |
| 349 | verified | needs_review | 2026-09-18 | NULL |
| 351 | verified | conflicting | 2026-09-18 | NULL |
| 352 | verified | needs_review | 2026-09-18 | NULL |
| 354 | verified | needs_review | 2026-09-18 | NULL |
| 357 | verified | conflicting | 2026-09-18 | NULL |
| 359 | verified | needs_review | 2026-09-18 | NULL |
| 360 | verified | needs_review | 2026-09-18 | NULL |
| 361 | verified | needs_review | 2026-09-18 | NULL |
| 362 | verified | needs_review | 2026-09-18 | NULL |
| 363 | verified | conflicting | 2026-09-18 | NULL |
| 364 | verified | conflicting | 2026-09-18 | NULL |
| 365 | verified | conflicting | 2026-09-18 | NULL |
| 369 | verified | source_unavailable | 2026-09-18 | NULL |
| 370 | verified | needs_review | 2026-09-18 | NULL |
| 381 | needs_review | not_published | NULL | NULL |
| 391 | verified | needs_review | 2026-09-20 | NULL |
| 392 | verified | not_published | 2026-09-20 | NULL |

Полный список ID: 3, 51, 74, 100, 139, 159, 181, 182, 199, 204, 244, 253, 268, 291, 332, 349, 351, 352, 354, 357, 359, 360, 361, 362, 363, 364, 365, 369, 370, 381, 391, 392.

## Фактически применённые content-изменения

Перед каждой записью сверены исходные поля текущей строки с snapshot; при несовпадении транзакция остановилась бы. Выполнены 32 UPDATE и 32 записи в audit_log. Статусы и verified_at второй транзакцией не менялись.

| ID | Поля | Причина |
|---:|---|---|
| 3 | amount, description, requirements, deadline, coverage_type | Убраны неподтвержденные выплаты, безусловное full coverage, медстраховка/проезд и единый deadline; карточка агрегировала разные механизмы. |
| 51 | name, amount, description, requirements, deadline, coverage_type | Разведены planned и awarded counts; убраны неподтвержденные full tuition и общий deadline. |
| 74 | name, amount, description, requirements, deadline, coverage_type | Скидка для многодетных/сирот и её размер не подтверждены; deadline МИО не является deadline социальной льготы. |
| 100 | name, amount, description, requirements, deadline, coverage_type | Убран единый full tuition и общий deadline из агрегата нескольких конкурсов. |
| 139 | description, requirements, deadline | Сохранен подтвержденный факт и диапазон; убраны неподтвержденный список категорий и deadline. |
| 159 | name, amount, description, requirements, deadline, coverage_type | Официальный источник не подтвердил отдельный университетский грант с ЕНТ≥100; порог удален и не заменен порогом 75. Грант акимата на 108 мест — отдельный механизм и отдельная будущая карточка. |
| 181 | name, amount, description, requirements, deadline, coverage_type | Убраны неподтвержденная шкала, смешение grant/discount и общий deadline. |
| 182 | amount, description, requirements, coverage_type | Убраны неподтвержденные 1–4 года, этапы и полное покрытие из объединенной карточки. |
| 199 | requirements, coverage_type | Источник отсутствует; ЕНТ≥50 и тип покрытия нельзя оставлять фактическими условиями. |
| 204 | amount, description, requirements, deadline, coverage_type | Удалены неподтвержденные скидка на весь срок, B057/B058 квоты и deadline из недоступного источника. |
| 244 | type, amount, description, coverage_type | Исправлен тип организатора; удалены устаревшие суммы и обобщение сроков из карточки. |
| 253 | link, source_url, source_title, amount, description, requirements, application_method, coverage_type | Исправлены официальный URL/email; удалено смешение KAZENERGY и неподтвержденное full tuition. |
| 268 | amount, description, requirements, deadline, coverage_type | Убраны неподтвержденные объединенные проценты, full coverage, GPA/social claims и deadline зачисления. |
| 291 | requirements, coverage_type | Источник отсутствует; ЕНТ≥52 и вид покрытия нельзя оставлять фактическими условиями. |
| 332 | amount, description, requirements, deadline, coverage_type | Убраны full tuition, общий deadline и объединение разных программ. |
| 349 | amount, description, requirements | Убраны неподтвержденные 89 457/127 041 и процентные разбиения; сохранены подтвержденные даты конкурса. |
| 351 | amount, description, requirements, coverage_type | Убрано конфликтующее число 165 и неподтвержденные единые требования; сохранена дата официального приема. |
| 352 | amount, description, requirements, deadline, coverage_type | Убраны неподтвержденные 2 180, региональный список и единый deadline. |
| 354 | amount, description, requirements, coverage_type | Убраны неподтвержденные единые 350/220, сумма покрытия, возраст/регион как универсальные условия и несуществующий общий deadline. |
| 357 | amount, description, requirements, deadline, coverage_type, source_url, source_title | Убран единый amount/deadline и универсальные требования; добавлен первичный источник агрегата. |
| 359 | amount, description, requirements, coverage_type | Разделены 125 грантов и 2 социальных гранта; убраны неподтвержденные единые full tuition и требования. |
| 360 | description, requirements, coverage_type | Убраны неподтвержденные full tuition, ЕНТ и единый способ подачи. |
| 361 | description, requirements, coverage_type | Убраны неподтвержденные full tuition, ЕНТ и общий способ подачи. |
| 362 | description, requirements, coverage_type | Убраны неподтвержденные full tuition, ЕНТ и общий способ подачи. |
| 363 | amount, description, requirements, deadline, coverage_type | Убрано объединенное покрытие и единые требования; два механизма оставлены для последующего разделения. |
| 364 | name, amount, description, requirements, deadline, coverage_type | Исправлено название механизма и удалены неподтвержденные IATS/ЕНТ120/800 claims. |
| 365 | amount, description, requirements, coverage_type | Убраны 332 резидентурных гранта из стипендии и оставлены подтвержденные условия. |
| 369 | amount, description, requirements, deadline, coverage_type | Удалены неподтвержденные суммы, проценты, eligibility и deadline при недоступном источнике. |
| 370 | amount, description, requirements, coverage_type | Убраны неподтвержденные детали и требования; наличие раздела не превращается в конкретную возможность. |
| 381 | description, requirements, coverage_type | Карточка уже не утверждает сумму; явно убраны не подтвержденные требования и тип coverage. |
| 391 | amount, description, requirements, coverage_type | Убрано утверждение, что B057 уже eligible; сохранены только общие условия конкурса. |
| 392 | name, amount, description, requirements, deadline, coverage_type | Отрицательное утверждение заменено нейтральной пометкой not_published; B057 и неподтвержденное покрытие удалены. |

Для каждого ID в audit_log сохранены значения до/после, причина и источники из findings.json. Для ID 159 отдельная карточка гранта акимата не создавалась.

### Причины

- **needs_review:** официальные источники подтверждают существование механизма, но не весь пользовательский claim — coverage, exact amount, B057 quota, единый deadline или scope.
- **conflicting:** официальные источники дают разные числа/пороги либо карточка объединяет разные программы: IDs 268, 351, 357, 363, 364, 365.
- **source_unavailable:** source отсутствует или текущий официальный URL недоступен: IDs 199, 204, 291, 369.
- **not_published:** запись не является подтверждённой опубликованной возможностью: IDs 381, 392.

Verified ID 415 сохранён: официальная страница SDU подтверждает для общежития 2026–2027 semester/year fees и прямо указывает “Installment payment via Kaspi Red is available”. Карточка ограничена проживанием, не tuition.

## Источники

Evidence зафиксирован в findings.json по каждой записи. Важные подтверждения:

- NU: https://apply.nu.edu.kz/en/admissions и https://nu.edu.kz/admissions/fees-and-funding/
- Saginov/MНВО: https://www.gov.kz/memleket/entities/sci/press/news/details/1270978?lang=ru и официальные kstu.kz notices.
- Türkiye Scholarships: https://www.turkiyeburslari.gov.tr/scholarshipsprograms
- Bolashak: https://bolashak.gov.kz
- SDU SPT: https://sdu.edu.kz/ru/spt/
- SDU Grant Office: https://sdu.edu.kz/en/grant-office/
- SDU accommodation: https://sdu.edu.kz/en/accomodation/
- SDU tuition: https://sdu.edu.kz/en/tuition-fees/
- SDU admissions: https://sdu.edu.kz/ru/admission/

Satbayev и КБТУ официальные URL в текущем чтении не отдались из-за TLS verification; записи не повышались до verified. Это зафиксировано в findings.

## Что намеренно не менялось

- 76 grants не входили в content change set;
- status/verified_at во второй content-транзакции;
- grant_universities, grant_specialties, university_id, city_id;
- удаление, объединение или разделение строк;
- universities, specialties, admission_programmes_catalogue, programme_admission_details и programme_tuition;
- содержимое карточек 406–416, кроме уже существующих status/review результатов предыдущего аудита.

## Проверки после записи

Фактический результат:

- количество строк grants осталось 108;
- все 32 target rows имеют ожидаемый after status и verified_at = NULL при downgrade;
- backup содержит исходные preconditions всех 32 target rows без расхождений;
- текущий quick_check: ok;
- текущий foreign_key_check: пустой результат;
- orphan-связи grant_universities и grant_specialties: 0;
- grant_universities и grant_specialties не изменились относительно backup;
- admission_programmes_catalogue, programme_admission_details и programme_tuition не изменились относительно backup;
- targeted tests после content-транзакции: 9 passed, 0 failed (grants.test.js и funding-import.test.js);
- content-транзакция: 32/32 preconditions совпали, 32 audit_log entries записаны, количество grants осталось 108;
- API smoke-test /api/grants: HTTP 200; 30 активных target-карточек сериализованы с обновленными name/amount/description/requirements/deadline, IDs 349 и 352 корректно не возвращаются, потому что is_active=0;
- ID 159 через API больше не содержит ЕНТ 100/100+ в name или requirements; API и БД совпадают по текстовым полям. coverage_type API route не сериализует, это отдельное существующее ограничение маршрута.
- сравнение universities с backup не идентично по содержимому, хотя количество строк совпадает (153/153). Эти изменения не выполнялись моей funding-транзакцией и намеренно не откатывались в рамках scope.

## Нерешённые вопросы

1. Разделить национальные агрегаты, university grants, discounts, scholarships, dormitory financing и loans без удаления/объединения текущих строк.
2. Получить устойчивые официальные документы для Satbayev/КБТУ и актуальный 2026–2027 notice SDU vacant grants.
3. Определить canonical model для повторяющихся national grant names.
4. Добавить отдельные поля для announced_places/awarded_places, minimum-score type, deadline type и applicant stage.

До решения этих вопросов findings.json является очередью ручного review, а не инструкцией на массовое обновление каталога.

## Повторная содержательная проверка после замечания по ID 159

Повторно перечитаны текущие `grants` и `findings.json`. Замечание о том, что ID 159 якобы всё ещё содержит «ЕНТ 100+», не соответствует текущей базе:

- `name`: `Университетский грант КНПУ им. Абая`;
- `amount`: `Университетский грант; количество и покрытие не подтверждены`;
- `requirements`: `[]`;
- `description` не содержит порога ЕНТ;
- API `/api/grants` возвращает те же поля и не содержит `ЕНТ 100`/`ЕНТ 100+`.

Все 32 ранее пересмотренные карточки повторно сопоставлены с текущими `name`, `amount`, `description`, `requirements` и `deadline`, а также с evidence в `findings.json`. Неподтвержденные числа и условия не сохранены как требования: подтвержденные числа оставлены только там, где они относятся к опубликованному факту (например, planned/awarded counts, число получателей, дата конкурса или опубликованный процент); неподтвержденные значения заменены нейтральным `уточняется`/описанием неопределенности либо удалены из `requirements`.

В текущей базе уже присутствует предыдущая content-транзакция: 32 записи `audit_log` с исходными и новыми значениями. Во время этой повторной проверки новая DB-транзакция не выполнялась, поскольку повторное UPDATE поверх уже исправленных строк создало бы риск перезаписать параллельные изменения без содержательной необходимости.

Для проверки создан актуальный backup:

`research/funding-audit/edumatch-before-content-recheck-20260927.sqlite`

Backup и текущая база содержат 108 grants; `quick_check = ok`, journal mode `wal`, `foreign_keys = 1`, все 32 target rows совпадают с backup snapshot.

API smoke-check: HTTP 200; возвращены 102 активные карточки, из них 30 из 32 target IDs. IDs 349 и 352 не возвращаются, потому что `is_active = 0`; это не потеря содержимого.

### Что безопасно не исправлено

- ID 357 не разделён на новые записи: это агрегат разных вузов и механизмов; разделение отложено согласно запрету создавать компоненты без согласования.
- Для IDs 199, 204, 291 и 369 первичный источник недоступен; фактические пороги, суммы и coverage удалены или оставлены неопределёнными, но отсутствие программы не утверждается.
- Для ID 159 не создана и не объединена отдельная карточка гранта акимата на 108 мест; его минимум 75 не перенесён в эту университетскую карточку.
- Для ID 139 сохранены опубликованные во вторичном сообщении 14 категорий и диапазон 20–100%; конкретные категории и порядок применения по-прежнему требуют первичного документа вуза.
