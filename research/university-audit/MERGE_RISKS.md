# Риски возможного объединения

Дата snapshot: **2026-09-27**. Ни одно объединение не применено. Связи посчитаны readonly по рабочей базе; пользовательские таблицы и персональные поля не читались.

## Проверенные связи

Проверены таблицы программ/специальностей/финансирования: `university_specialties`, `admission_requirements`, `admission_programmes_catalogue`, `grants`, `grant_universities`, `admission_chance_stats`. `admission_programmes_catalogue` не содержит строк с этими ID; нулевой счётчик не означает безопасность будущего импорта.

| Тип | Пара | specialties | requirements | programmes | grants | grant_universities | chance_stats | Риск |
|---|---|---:|---:|---:|---:|---:|---:|---|
| marked_duplicate | 31 → 57 | 0 → 20 | 0 → 5 | 6 → 0 | 8 → 2 | 8 → 0 | 0 → 89 | source links exist; migrate/dedupe before merge |
| marked_duplicate | 35 → 36 | 0 → 17 | 0 → 8 | 0 → 0 | 0 → 3 | 0 → 0 | 0 → 76 | source empty; still verify aliases and future imports |
| marked_duplicate | 56 → 117 | 0 → 3 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 15 | source empty; still verify aliases and future imports |
| marked_duplicate | 58 → 37 | 0 → 21 | 0 → 5 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 87 | source empty; still verify aliases and future imports |
| marked_duplicate | 62 → 16 | 0 → 19 | 0 → 8 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 82 | source empty; still verify aliases and future imports |
| marked_duplicate | 65 → 11 | 0 → 8 | 0 → 6 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 37 | source empty; still verify aliases and future imports |
| marked_duplicate | 68 → 12 | 0 → 14 | 0 → 8 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 64 | source empty; still verify aliases and future imports |
| marked_duplicate | 71 → 132 | 0 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 12 | source empty; still verify aliases and future imports |
| marked_duplicate | 74 → 39 | 0 → 38 | 0 → 5 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 156 | source empty; still verify aliases and future imports |
| marked_duplicate | 79 → 5 | 0 → 30 | 0 → 8 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 122 | source empty; still verify aliases and future imports |
| marked_duplicate | 80 → 7 | 0 → 59 | 0 → 10 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 236 | source empty; still verify aliases and future imports |
| marked_duplicate | 90 → 14 | 0 → 34 | 0 → 7 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 139 | source empty; still verify aliases and future imports |
| marked_duplicate | 100 → 149 | 0 → 4 | 0 → 0 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 24 | source empty; still verify aliases and future imports |
| marked_duplicate | 105 → 13 | 0 → 36 | 0 → 6 | 0 → 0 | 0 → 1 | 0 → 0 | 0 → 150 | source empty; still verify aliases and future imports |
| marked_duplicate | 156 → 44 | 0 → 14 | 0 → 8 | 0 → 0 | 0 → 2 | 0 → 0 | 0 → 54 | source empty; still verify aliases and future imports |
| additional_candidate | 30 → 42 | 3 → 6 | 0 → 6 | 0 → 0 | 1 → 1 | 0 → 0 | 9 → 22 | source links exist; migrate/dedupe before merge |
| additional_candidate | 45 → 46 | 17 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 65 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 50 → 46 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 69 → 131 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 72 → 110 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 76 → 111 | 3 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 77 → 133 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 1 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 78 → 118 | 3 → 9 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 33 | source links exist; migrate/dedupe before merge |
| additional_candidate | 103 → 119 | 3 → 3 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 9 | source links exist; migrate/dedupe before merge |
| additional_candidate | 10 → 135 | 48 → 3 | 6 → 0 | 0 → 0 | 1 → 0 | 0 → 0 | 189 → 9 | source links exist; migrate/dedupe before merge |
| additional_candidate | 20 → 23 | 33 → 7 | 5 → 6 | 0 → 0 | 0 → 1 | 0 → 0 | 127 → 25 | source links exist; migrate/dedupe before merge |
| additional_candidate | 38 → 37 | 7 → 21 | 7 → 5 | 0 → 0 | 0 → 1 | 0 → 0 | 27 → 87 | source links exist; migrate/dedupe before merge |
| additional_candidate | 41 → 84 | 19 → 2 | 6 → 0 | 0 → 0 | 1 → 0 | 0 → 0 | 74 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 55 → 122 | 3 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 86 → 134 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 1 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 101 → 114 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 6 → 6 | source links exist; migrate/dedupe before merge |
| additional_candidate | 17 → 73 | 7 → 2 | 7 → 0 | 0 → 0 | 1 → 0 | 0 → 0 | 26 → 6 | source links exist; migrate/dedupe before merge |

## Безопасный порядок

1. Зафиксировать mapping `source_id → canonical_id` после исправления городов и статусов.
2. Экспортировать non-user rows по каждому source ID; dedupe по естественным ключам, например `university_id + specialty_id + academic_year`, а не по количеству строк.
3. Перенести ссылки транзакционно с проверкой уникальных ограничений; не удалять source до сверки counts и URL-источников.
4. Для grants проверить и `grants.university_id`, и M:N `grant_universities`; не потерять гранты, где вуз указан только в M:N.
5. Для chance stats сохранить строки и provenance; не смешивать historical stats разных legal entities без решения владельца данных.
6. После dry-run сравнить counts, foreign keys и API выдачу; только затем принимать решение о статусах duplicate-записей.

Пользовательские таблицы (saved/application/prediction/reviews) намеренно не читались и не включены в счётчики; перед реальным merge разработчик обязан сделать отдельный privacy-safe dependency review.
