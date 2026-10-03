# Funding expansion audit — 2026-09-27

## Problem and scope

Readonly audit of the current catalogue and funding data in `backend/edumatch.db`. The 14 work packages cover 153 catalogue rows; 138 rows are non-duplicate by the current `duplicate_of_*` status, with seven additional duplicate-candidate composite groups retained for provenance. This is an expansion audit, not a rerun of the 32-card funding cleanup documented in `research/funding-audit/REPORT.md`.

No live database, existing JSON, or existing report was changed. New output is limited to this directory.

## Readonly snapshot

| Metric | Value |
|---|---:|
| Universities | 153 |
| Active universities | 109 |
| Explicit duplicate rows | 15 |
| Unclassified/null status rows | 29 |
| Grants | 108 |
| Active grants | 102 |
| grant_universities links | 46 |
| Universities with any direct/M:N funding relation | 47 |
| Readonly PRAGMA query_only | 1 |
| SQLite data_version at check | 2 |

Grant statuses: conflicting=6, needs_review=68, not_published=14, source_unavailable=4, verified=16.

## Coverage result

- 153 rows are represented in `UNIVERSITY_COVERAGE.json`.
- 131 are treated as independent or unresolved for funding search; 7 are duplicate-candidate composite rows; 15 explicit duplicates are excluded from a second official search.
- 47 university rows already have at least one direct or M:N funding relation. Existing coverage was retained; it was not re-created.
- 12 rows receive at least one proposal. 95 rows had no safely attributable new record in the checked sources; this is **not** a claim that funding does not exist.
- 43 official homepages were inaccessible during the fetch pass; their IDs are listed in the coverage file and require manual follow-up: 4, 16, 18, 20, 21, 23, 24, 25, 27, 29, 30, 32, 38, 39, 52, 55, 64, 70, 73, 78, 86, 102, 104, 108, 118, 124, 125, 126, 127, 130, 134, 136, 138, 139, 140, 141, 143, 144, 145, 146, 147, 148, 162.
- AUES (ID 152) publishes a 2026 bachelor/master grant competition, but detailed conditions are only in an inaccessible/unextracted Google Drive folder; no speculative record was created.
- Civil Aviation vacant state grants and IUTH named state grants were treated as national mechanisms, not duplicated as university grants.

## Proposed new records

`NEW_RECORDS.json` is a plain importer-shaped array. It contains 16 proposals by type: regional=1, university=8, discount=5, corporate=1, installment=1. Statuses: needs_review=15, verified=1.

All proposals include provider, target university names/IDs, level, programme scope where directly known, coverage, requirements, documents, deadline when published, application route, academic year, official source URL, and check date. Mechanisms remain separate: regional EGI grant, EGI rector grant, EGI discounts; Caspian Dream Team, ENT-tier discount, social discount; SDU Grant Office and talented-student support; Shakarim grant and discount; Coventry scholarship and KAZENERGY grant; InnoTech discount and installments; HTU 100 grants.

### Important importer limitation

The existing `funding-store.js` resolves universities by name/short name and can resolve the three Caspian names (IDs 45/46/50) ambiguously to ID 45. The proposals therefore carry explicit `target_university_ids` and `target_university_names`; the developer MUST preserve all target links manually or fix the resolver before applying. The same composite intent is retained for Shakarim and HTU. No live apply was attempted.

The existing importer also persists `study_levels` as `[\"bachelor\"]` regardless of the input field; all proposed records are therefore limited to bachelor scope for import safety. The AUES master notice remains coverage-only until the importer/schema path is clarified.

### High-confidence / needs-review distinction

- `verified`: only KAZENERGY Coventry, where the official source states current cycle, deadline, eligibility, offer-letter requirement, campuses, programmes, and tuition coverage.
- `needs_review`: all other proposals where count, exact amount, cycle-specific documents, or current deadline is missing/partially published. `needs_review` is intentional, not a claim of verified awarding.
- HTU HTML confirms “100 grants”, but its PDF conditions were not extracted; no amount, deadline, or document list was inferred.

## Corrections proposed by ID

`CORRECTIONS.json` contains two proposal-only corrections; neither was applied.

1. **ID 244 — Türkiye Scholarships.** Current university attachment is SDU (ID 57), while the official programme is for study in Turkey. Recommend moving it to a global/international catalogue or removing the SDU attachment. Keep it separate from SDU Grant Office.
2. **ID 387 — Financial Center educational-credit guarantee.** EGI’s official credit page describes a national mechanism for Kazakhstan higher/postgraduate education. Recommend one national mechanism with applicability mapping, not one copy per university. This audit intentionally did not add EGI/Esil duplicates.

## Package registry and evidence handling

All 14 packages are marked `checked` in `UNIVERSITY_COVERAGE.json` with IDs, fetch summaries, and check date. Each row records homepage access, targeted official section URLs, existing grant IDs, proposed IDs, evidence state, and unresolved questions. Official source failures and external/inaccessible attachments are explicit. Historical pages, including old 2025–2026 quota pages, were not carried into 2026–2027 records.

## Temporary validation plan

The input is structurally compatible with `validateFundingRecord`; no import was run against the live DB. Validation must run against a temporary DB copy because the current `importFunding(..., {apply:false})` still creates schema/import-batch rows. A temporary-copy check is recorded after this report is generated.

## Deliverables

- `UNIVERSITY_COVERAGE.json` — per-row coverage and unknowns.
- `NEW_RECORDS.json` — 16 importer-shaped new proposals.
- `CORRECTIONS.json` — two non-applied correction proposals.
- This report — decisions, exclusions, limitations, and evidence discipline.

## Temporary validation result

`NEW_RECORDS.json` was passed to `importFunding` on a temporary copy of the database with `apply:false`: 16/16 valid, 0 errors, 0 inserts, 0 updates, and `applied=false`. The temporary copy received only the expected validation/import-batch metadata. The live readonly snapshot remained unchanged after validation: `data_version=2`, universities=153, grants=108, grant_universities=46. The temporary copy was deleted after the check.