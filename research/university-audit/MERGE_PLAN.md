# MERGE_PLAN — readonly-план объединений каталога

Дата снимка: **2026-09-27**. База открыта через Node node:sqlite с readOnly: true и PRAGMA query_only=1. Запись, миграции, сервер и импорт не запускались. Текущий финансирующий агент мог менять другие таблицы; документ содержит только наблюдения и количества связей.

## Инварианты

- Не выполнять merge/delete/hide до отдельного согласования mapping.
- Не переводить пустой data_status в active автоматически.
- Для merge сначала делать dependency dry-run, затем транзакционно переносить связи с проверкой уникальных ограничений и provenance.
- Персональные значения не выгружались. В таблицах ниже показаны только количества строк: source/target.
- Таблицы с нулевыми значениями в конкретной паре не перечислены.

## Граф текущих 15 duplicate_of_*

Все 15 mapping target ID существуют; self-loop и циклы не найдены. Все цепочки завершаются на non-duplicate target; target ID 57 имеет пустой статус и требует отдельного status decision.

- 31 → 57; chain: 31 → 57; cycle: нет
- 35 → 36; chain: 35 → 36; cycle: нет
- 56 → 117; chain: 56 → 117; cycle: нет
- 58 → 37; chain: 58 → 37; cycle: нет
- 62 → 16; chain: 62 → 16; cycle: нет
- 65 → 11; chain: 65 → 11; cycle: нет
- 68 → 12; chain: 68 → 12; cycle: нет
- 71 → 132; chain: 71 → 132; cycle: нет
- 74 → 39; chain: 74 → 39; cycle: нет
- 79 → 5; chain: 79 → 5; cycle: нет
- 80 → 7; chain: 80 → 7; cycle: нет
- 90 → 14; chain: 90 → 14; cycle: нет
- 100 → 149; chain: 100 → 149; cycle: нет
- 105 → 13; chain: 105 → 13; cycle: нет
- 156 → 44; chain: 156 → 44; cycle: нет

## Существующие duplicate_of_* mapping из базы

Ниже перечислены текущие текстовые mapping из DB. Их наличие не заменяет официальную проверку identity; таблица нужна для безопасного dependency dry-run.

| source | target | source name | target name | target status | Ненулевые зависимости source/target |
|---:|---:|---|---|---|---|
| 31 | 57 | Университет Сулеймана Демиреля | С.Демирель атындағы университет | empty | admission_chance_stats: 0/89; admission_programmes_catalogue: 6/0; admission_requirements: 0/5; grant_universities: 8/0; grants: 8/2; university_specialties: 0/20 |
| 35 | 36 | Казахский государственный медицинский университет им. С.Д. Асфендиярова | Казахский национальный медицинский университет им. С.Д. Асфендиярова | active | admission_chance_stats: 0/76; admission_requirements: 0/8; grants: 0/3; university_specialties: 0/17 |
| 56 | 117 | Ілияс Жансүгүров атындағы Жетісу университеті | Некоммерческое акционерное общество «Жетысуский университет имени Ильяса Жансугурова» | active | admission_chance_stats: 0/15; university_specialties: 0/3 |
| 58 | 37 | Қ. Жұбанов атындағы Ақтөбе өңірлік  университеті | Актюбинский региональный государственный университет имени К. Жубанова | active | admission_chance_stats: 0/87; admission_requirements: 0/5; grants: 0/1; university_specialties: 0/21 |
| 62 | 16 | Х.Досмұхамедов атындағы Атырау университеті | Атырауский государственный университет имени Х. Досмухамедова | active | admission_chance_stats: 0/82; admission_requirements: 0/8; grants: 0/1; reviews: 0/2; university_specialties: 0/19 |
| 65 | 11 | Д.Серікбаев атындағы Шығыс-Қазақстан  техникалық университеті | Восточно-Казахстанский государственный технический университет имени Д.Д. Серикова | active | admission_chance_stats: 0/37; admission_requirements: 0/6; grants: 0/1; reviews: 0/1; university_specialties: 0/8 |
| 68 | 12 | Семей медицина университеті | Семей государственный медицинский университет | active | admission_chance_stats: 0/64; admission_requirements: 0/8; grants: 0/1; reviews: 0/1; university_specialties: 0/14 |
| 71 | 132 | М.Дулати атындағы Тараз  өңірлік университеті | Некоммерческое акционерное общество «Таразский университет имени М.Х. Дулати» | active | admission_chance_stats: 0/12; university_specialties: 0/2 |
| 74 | 39 | М.Өтемісов атындағы Батыс-Қазақстан   университеті | Западно-Казахстанский университет имени Махамбета Утемисова | active | admission_chance_stats: 0/156; admission_requirements: 0/5; grants: 0/1; university_specialties: 0/38 |
| 79 | 5 | Қарағанды техникалық университеті | Карагандинский государственный технический университет | active | admission_chance_stats: 0/122; admission_requirements: 0/8; grants: 0/1; reviews: 0/2; university_specialties: 0/30 |
| 80 | 7 | Академик Е.Бөкетов атындағы Қарағанды    университеті | Карагандинский государственный университет имени Е. Букетова | active | admission_chance_stats: 0/236; admission_requirements: 0/10; grants: 0/1; reviews: 0/2; university_specialties: 0/59 |
| 90 | 14 | Қорқыт Ата атындағы Қызылорда университеті | Кызылординский университет имени Коркыта Ата | active | admission_chance_stats: 0/139; admission_requirements: 0/7; grants: 0/1; reviews: 0/1; university_specialties: 0/34 |
| 100 | 149 | Х.А.Ясауи атындағы Халықаралық қазақ-түрік университеті | Учреждение «Международный казахско-турецкий университет имени Ходжи Ахмеда Ясави» | active | admission_chance_stats: 0/24; deadlines: 0/1; grants: 0/1; university_specialties: 0/4 |
| 105 | 13 | М. Әуэзов атындағы Оңтүстік Қазақстан университеті | Южно-Казахстанский государственный университет имени М. Ауэзова | active | admission_chance_stats: 0/150; admission_requirements: 0/6; grants: 0/1; reviews: 0/1; university_specialties: 0/36 |
| 156 | 44 | Некоммерческое акционерное общество «Университет КИМЭП» | KIMEP University | active | admission_chance_stats: 0/54; admission_requirements: 0/8; grants: 0/2; prediction_history: 0/2; university_specialties: 0/14 |

### Дополнительные кандидаты из пустых статусов

| source | target | source name | target name | confidence | Ненулевые зависимости source/target |
|---:|---:|---|---|---|---|
| 69 | 131 | Семей қаласының Шәкәрім атындағы  университеті | Некоммерческое акционерное общество «Шәкәрім университет» | high | admission_chance_stats: 6/6; university_specialties: 2/2 |
| 72 | 110 | Халықаралық Тараз  инновациялық институты | Учреждение «Международный Таразский инновационный университет имени Шерхана Муртазы» | high | admission_chance_stats: 6/6; university_specialties: 2/2 |
| 76 | 111 | Қазақстан инновациялық және телекеммуникациялық  жүйелер университеті | Негосударственное учреждение образования «Казахстанский университет инновационных и телекоммуникационных систем» | high | admission_chance_stats: 9/6; university_specialties: 3/2 |
| 77 | 133 | Қарағанды  индустриалдық университеті | Некоммерческое акционерное общество «Карагандинский индустриальный университет» | high | admission_chance_stats: 6/6; grants: 0/1; university_specialties: 2/2 |
| 78 | 118 | Қарағанды медициналық университеті | Некоммерческое акционерное общество «Карагандинский медицинский университет» | high | admission_chance_stats: 9/33; university_specialties: 3/9 |
| 103 | 119 | Оңтүстік Қазақстан медицина академиясы | Акционерное общество «Южно-Казахстанская медицинская академия» | high | admission_chance_stats: 9/9; university_specialties: 3/3 |

- 31 → 57: identity подтверждена, но target пустой; source имеет 6 admission_programmes_catalogue, 8 grants и 8 grant_universities. Сначала принять status decision для 57.
- 69 → 131, 72 → 110, 76 → 111, 77 → 133, 78 → 118, 103 → 119: identity подтверждена; перед merge сохранить historical source record и проверить конфликты уникальных specialty/programme ключей.

## Спорные пары и группы

| source | candidate target | source name | target name | Ненулевые зависимости source/target |
|---:|---:|---|---|---|
| 30 | 42 | Каспийский государственный технический университет | Каспийский государственный университет технологии и инжиниринга имени Ш. Есенова | admission_chance_stats: 9/22; admission_requirements: 0/6; grants: 1/1; university_specialties: 3/6 |
| 45 | 46 | Caspian University (Abay st corpus) | Caspian University (Seyfulin st corpus) | admission_chance_stats: 65/6; reviews: 0/1; university_specialties: 17/2 |
| 50 | 46 | Каспий қоғамдық университеті | Caspian University (Seyfulin st corpus) | admission_chance_stats: 6/6; reviews: 0/1; university_specialties: 2/2 |
| 10 | 135 | Павлодарский государственный университет имени С. Торайгырова | Некоммерческое акционерное общество «Торайгыров Университет» | admission_chance_stats: 189/9; admission_requirements: 6/0; grants: 1/0; reviews: 2/0; university_specialties: 48/3 |
| 20 | 23 | Казахский технологический университет | Алматинский технологический университет | admission_chance_stats: 127/25; admission_requirements: 5/6; grants: 0/1; university_specialties: 33/7 |
| 38 | 37 | Актюбинский государственный педагогический институт | Актюбинский региональный государственный университет имени К. Жубанова | admission_chance_stats: 27/87; admission_requirements: 7/5; grants: 0/1; university_specialties: 7/21 |
| 41 | 84 | Жезказганский государственный университет имени О. Айманова | О.Байқоңуров атындағы Жезқазган университеті | admission_chance_stats: 74/6; admission_requirements: 6/0; grants: 1/0; university_specialties: 19/2 |
| 55 | 122 | «ҚДЖМ» Қазақ медициналық университеті | Товарищество с ограниченной ответственностью «Казахстанский медицинский университет «ВШОЗ» | admission_chance_stats: 9/6; university_specialties: 3/2 |
| 86 | 134 | Рудный индустриалдық институты | Некоммерческое акционерное общество «Рудненский индустриальный университет» | admission_chance_stats: 6/6; grants: 0/1; university_specialties: 2/2 |
| 101 | 114 | Халықаралық туризм және меймандостық университеті | Некоммерческое акционерное общество «Международный университет туризма и гостеприимства» | admission_chance_stats: 6/6; university_specialties: 2/2 |
| 114 | 101 | Некоммерческое акционерное общество «Международный университет туризма и гостеприимства» | Халықаралық туризм және меймандостық университеті | admission_chance_stats: 6/6; university_specialties: 2/2 |
| 17 | 73 | Западно-Казахстанский аграрно-технический университет имени Жангира Хана | Жәңгір хан атындағы Батыс-Қазақстан агротехникалық университеті | admission_chance_stats: 26/6; admission_requirements: 7/0; grants: 1/0; university_specialties: 7/2 |

- 30 → 42: вероятное историческое имя Yessenov University, но требуется юридическая цепочка переименований. Не помечать duplicate автоматически.
- 45/46/50: официальный домен и бренд один, но ID 45/46 названы корпусами, а ID 50 использует юридическое имя. Сначала выбрать canonical ID и сохранить campus provenance.
- 101 ↔ 114: симметричная кандидатура; направление mapping не установлено. Не выбирать target по одному имени/домену.
- 10→135, 20→23, 38→37, 41→84, 55→122, 86→134, 17→73: требуют отдельной сверки legal entity, исторических названий и источников; текущие количества связей не являются доказательством тождества.

## Связи, которые обязательно сохранить

1. university_specialties: source и target specialty rows; перед переносом дедуплицировать по (university_id, specialty_id, academic_year) и сохранять source/provenance.
2. admission_requirements: не терять год, specialty и минимальные баллы; проверять уникальность (university_id, specialty_id).
3. admission_programmes_catalogue и дочерние programme tables: переносить programme IDs и source notes, проверять уникальность programme code/group.
4. grants и grant_universities: переносить как прямой grants.university_id, так и M:N-связи; не удалять grant rows при merge.
5. admission_chance_stats: сохранять year, source URL, confidence и historical provenance; не смешивать статистику разных legal entities без решения владельца данных.
6. reviews, deadlines, prediction_history: переносить только после отдельного privacy-safe dependency review; в этом плане показаны только counts.
7. User-linked tables (saved/application/chat/test/session) не выгружались и не должны переноситься массовым SQL без отдельной проверки ссылок и приватности.

## Порядок безопасной операции после согласования

1. Зафиксировать canonical mapping и policy для branches/parent organizations.
2. Снять новый readonly dependency report непосредственно перед записью.
3. Перенести links в транзакции с conditional checks и сохранением provenance.
4. Проверить unique constraints, foreign keys, counts и API выдачу.
5. Только после этого изменить data_status; удаление source допускается отдельным решением, не частью identity-аудита.
