# NEXT_STEPS — решения владельца каталога

## Текущий снимок

- База: backend/edumatch.db; snapshot data_version=2.
- 153 university rows: 29 с data_status IS NULL, 109 active, 15 duplicate_of_*.
- Все 29 пустых значений — именно NULL, не пустая строка.
- Этот аудит readonly: active/merge/delete/hide не применялись.
- Детальная evidence-карта: STATUS_DECISIONS.json. Dependency-план: MERGE_PLAN.md.

## Решения, необходимые от lead

1. **Scope:** считать ли специализированные ведомственные вузы (MIA, МО, МЧС, КНБ, прокуратура, Академия правосудия) частью основного каталога. Без этого нельзя безопасно рекомендовать active для 124, 136–148.
2. **Подтвердить standalone:** ID 57 SDU и ID 112 Astana IT University — кандидаты на active после принятия общего scope decision.
3. **Branches / foreign-affiliated:** ID 125 Woosong University Kazakhstan и ID 130 NYFA Kazakhstan оставить вне active до проверки казахстанской лицензии, юридического лица и branch policy.
4. **Status unknown:** ID 126 University Ulytau, 129 InnoTech, 139 KNB academy, 145 KNB institute, 147 National Guard institute/academy, 155 IEC — получить legal form, license appendix и official registry confirmation.
5. **Historical / duplicate:** отдельно принять ID 30→42; canonical ID для группы 45/46/50; затем утвердить 69→131, 72→110, 76→111, 77→133, 78→118, 103→119.
6. **Existing duplicate_of_*:** подтвердить 15 mappings из MERGE_PLAN.md; для 31→57 сначала закрыть пустой status target. Затем подготовить dry-run переноса зависимостей.
7. **ID 61 / ID 160:** исправить/подтвердить official URL и legal identity. ID 61 сейчас содержит muctr.kz, не подтверждающий Kazakh-Russian International University; ID 160 содержит uib.edu.kz, тогда как registry points to D.A. Kunaev Eurasian Law Academy / vuzkunaeva.kz. Не менять status и не merge до проверки.
8. **License check:** через eLicense/реестр проверить ID 125, 126, 129, 130, 139, 145, 147 и branch/parent relationship. Website or press release alone is insufficient proof of independent VUZ status.

## Обнаруженные расхождения кода

- backend/db.js: getUniversities, getUniversity, top-20, getCities и admission opportunity paths используют COALESCE(u.data_status, active). При текущих NULL эти 29 записей фактически ведут себя как active; duplicate_of_* отфильтровываются, но canonical target автоматически не подставляется.
- backend/programme-catalogue-service.js, admission-calculator.js, admission-planner.js, admission-service.js, grants-routes.js повторяют active-only predicate; NULL-записи могут попадать в выдачу.
- backend/ai-service.js: profession-by-ID, profession-by-specialty и retrieveRelevantUniversities не применяют data_status filter; AI retrieval может вернуть NULL, duplicate_of_* или inactive rows.
- backend/admin-routes.js признаёт только active/pending/inactive. Он не предоставляет отдельного duplicate_of_* статуса и не умеет управлять canonical mapping через обычный status PATCH.
- backend/schema.sql документирует status только как active/inactive/pending и не задаёт FK/constraint для duplicate_of_*; существующие mappings — свободный текстовый convention.

## Ограничения выполнения

- Не запускать массовую установку active.
- Не заменять NULL на pending без решения владельца: это изменит выдачу и может повлиять на admission/grants/AI.
- Не выполнять merge/delete/hide в рамках этого аудита.
- Перед любой записью повторить readonly counts, dependency counts, foreign_key_check и API smoke-check после отдельного согласованного изменения.
