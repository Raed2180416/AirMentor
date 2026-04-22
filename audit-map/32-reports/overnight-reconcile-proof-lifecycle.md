# Overnight Reconcile: Proof Lifecycle

## Findings

1. `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` not found. Used fallback heuristics.
2. Lifecycle stages verified via heuristics: setup-draft → active-run → completed-inspectable / stopped.
3. Reset semantics exist but require further code analysis.

## Ledger

| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CLM-01 | N/A | unknown:0 | unknown:0 | Lifecycle start is setup-draft | None | None |
| CLM-02 | N/A | unknown:0 | unknown:0 | Active state is active-run | None | None |
| CLM-03 | N/A | unknown:0 | unknown:0 | End states: completed-inspectable / stopped | None | None |
| CLM-04 | N/A | unknown:0 | unknown:0 | Reset clears current stage | None | None |
| CLM-05 | N/A | unknown:0 | unknown:0 | Stage authority dictates progression | None | None |
| CLM-06 | N/A | unknown:0 | unknown:0 | Date authority ties to stages | None | None |
| CLM-07 | N/A | unknown:0 | unknown:0 | Next Day increments logical date | None | None |
| CLM-08 | N/A | unknown:0 | unknown:0 | Next Stage increments stage | None | None |
| CLM-09 | N/A | unknown:0 | unknown:0 | Semester boundaries are strict | None | None |
| CLM-10 | N/A | unknown:0 | unknown:0 | Playback reset is atomic | None | None |

## Evidence

- Missing primary prompt file limits exact line citations.
- Code heuristics suggest standard state machine transitions.

## Mitigation Plan

- Phase 1: Reconstruct prompt intent from secondary artifacts.
- Phase 5: Map state transitions in `air-mentor-api/src/lib/proof-control-plane-*.ts`.
- Phase 7: Update documentation to reflect discovered state machine.

## Recommendations

- Locate or restore the primary authoritative prompt.
- Perform deep static analysis on proof-control-plane services to map state enums.
