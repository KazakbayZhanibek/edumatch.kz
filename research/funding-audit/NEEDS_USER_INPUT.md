# NEEDS_USER_INPUT

Файл обновлён после применения 32 status corrections и 32 точечных content corrections. Текущая база содержит 108 grants. Удаление, объединение дублей и изменение спорной принадлежности не выполнялись.

## 1. Остаточные внешние решения

1. Нужно ли показывать закрытые кампании 2026–2027 как historical/closed или только active opportunities? Дедлайны не менялись.
2. Нужна ли canonical карточка национального механизма с applicability links или отдельные контекстные карточки по вузам? Дубли не объединялись.
3. Должны ли grants, discounts, scholarships, dormitory aid и loans быть отдельными product types? Рекомендация: да.
4. Разбивать ли aggregate ID 357 на component records? Пока оставлен как conflicting.

## 2. Legacy source queue

Официальные документы 2026–2027 нужны для записей: **4, 14, 30, 42, 64, 91, 109, 133, 145, 191, 199, 211, 212, 219, 225, 237, 245, 273, 281, 283, 291, 304, 318, 324, 338, 339**.

Для подтверждаемой записи нужны deep URL/PDF, provider, programme scope, amount/coverage, eligibility, documents, application method, exact deadline и checked date. Для 199 и 291 source_url отсутствует; это не доказательство отсутствия программы. Для 245 требуется authoritative city mapping.

## 3. New Satbayev/KBTU/SDU records

- Satbayev IDs 406–407: официальный URL не отдался из-за TLS verification; нужны устойчивые официальные документы.
- KBTU ID 408: нужен доступный официальный документ 2026–2027 для определения scope числа 110 и B057 quota.
- SDU ID 409: национальное число B057 не является квотой SDU; нужна SDU-specific allocation/результат.
- SDU ID 410: SPT подтверждён как механизм четырёхлетнего grant/discount, но нужны B057 allocation, точные условия и retention.
- SDU ID 411: нужен документ с процентами скидок и категориями.
- SDU ID 412: Grant Office подтверждён как маршрут, но нет B057-specific amount/deadline.
- SDU ID 413: нужен официальный документ именно по стипендии Ахмета Байтурсынова.
- SDU ID 414: доступный vacant-grant notice относится к 2024; нужен current 2026–2027 notice.
- SDU ID 415: verified сохранён только для рассрочки проживания через Kaspi Red; это не tuition financing.
- SDU ID 416: semester payment подтверждён, но installment/loan terms не опубликованы.

## 4. Отдельный механизм для ID 159

ID 159 теперь не содержит в фактических полях «ЕНТ 100+» и «ЕНТ от 100 баллов»: отдельный университетский грант с этим порогом не подтвержден. Грант акимата Астаны на 108 мест для 2026–2027 (ЕНТ≥75, августовская подача, обязательство отработать 3 года) оставлен только как предложение с источником `https://abai.university/ru/news/1560-akimat-astany-vydelil-108-obrazovatelnyx-grantov-dlia-universiteta-abaia`; отдельная запись не создана.

## 5. Точечные follow-ups

- IDs 3, 51, 74, 100, 139, 159, 181, 182, 244, 253, 332, 349, 352, 354, 359–362, 370: подтвердить недостающие coverage, amount, quotas, dates и programme scope.
- IDs 268, 351, 357, 363–365: разделить конфликтующие программы/числа до повторного verified.
- IDs 204, 369: получить доступный первичный источник; текущий статус source_unavailable.
- IDs 381, 392: предоставить положительную публикацию возможности или оставить not_published.
- ID 391: предоставить KAZENERGY eligible-speciality list, подтверждающий B057.

До решения этих вопросов findings.json является manual review queue, а не инструкцией на массовую перезапись каталога.
