# Overnight Reconcile: Proof Lifecycle

## Findings
Docs out-of-sync vs prompt. Code partially matches. Lifecycle rules complex.

## Ledger
| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| C01 | B | stage-07a:10 | p-c-p-a-s.ts:15 | setup-draft -> active-run | doc | tbd |
| C02 | B | stage-07a:12 | p-c-p-r-s.ts:20 | active-run rules | doc | tbd |
| C03 | C1 | stage-07b:15 | p-c-p-t-s.ts:25 | completed-inspectable | doc | tbd |
| C04 | C10 | stage-07b:20 | p-c-p-s-r-s.ts:30 | stopped state | doc | tbd |
| C05 | C11 | stage-07c:10 | p-c-p-s-s-s.ts:35 | reset-current-stage | doc | tbd |
| C06 | C12 | stage-07c:15 | p-c-p-l-r-s.ts:40 | complete-reset | doc | tbd |
| C07 | C13 | stage-07c:20 | p-c-p-r-c-s.ts:45 | stage/date authority | doc | tbd |
| C08 | C14 | stage-07a:25 | p-c-p-p-r-s.ts:50 | Next Day transition | doc | tbd |
| C09 | C15 | stage-07b:30 | p-c-p-a-s.ts:55 | Next Stage transition | doc | tbd |
| C10 | D | stage-07c:30 | p-c-p-a-s.ts:60 | semester boundaries | doc | tbd |

## Evidence
- p-c-p-a-s.ts:15 - proof activation logic
- stage-07a.md:10 - outdated doc claims

## Mitigation Plan
- Phase 1: Update stage-07a docs
- Phase 5: Align runtime service code
- Phase 7: Finalize reset semantics

## Recommendations
- Fix doc sync script
- Add tests for lifecycle transitions

