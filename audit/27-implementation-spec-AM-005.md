# AirMentor Implementation Spec AM-005

## Problem statement
The proof product uses careful bounded language, but names and UI framing can still encourage users to overread what the system actually does.

## Exact code locations
- `src/pages/student-shell.tsx`
- `src/pages/risk-explorer.tsx`
- `src/pages/hod-pages.tsx`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- `air-mentor-api/src/lib/proof-risk-model.ts`

## Root cause
The UX currently relies on disclaimers and labels inside the proof surfaces, but not enough on surrounding explanation of suppressed probabilities, blocked stages, or deterministic limits.

## Full dependency graph
- proof payloads -> `msruas-proof-control-plane.ts`
- probability display gating -> `proof-risk-model.ts`
- visible labels and chips -> `student-shell.tsx`, `risk-explorer.tsx`, `hod-pages.tsx`

## Affected user journeys
- faculty proof interpretation
- HoD proof exploration
- student shell conversation flow
- risk-explorer probability reading

## Risk if left unfixed
- user trust gaps
- confusion about what is model-driven vs policy-driven
- support burden when probabilities disappear or stages are blocked

## Target future architecture or behavior
- explicit feature framing:
  - deterministic explainer
  - advisory risk explorer
  - policy-derived formal status
- visible reasons for suppressed probability and blocked-stage states

## Concrete refactor or fix plan
1. Add visible “why this is hidden” explanations for suppressed probabilities.
2. Explain blocked-stage meaning wherever stage-blocked UI appears.
3. Add short adjacent descriptions for `Guardrail`, `Session Intro`, and `Deterministic Reply`.
4. Tighten names/copy only where product truth is improved, not merely softened.

## Sequencing plan
- can run in parallel with AM-006 and AM-011
- do explanatory UI after telemetry from AM-008 is available where possible

## Migration strategy
- no contract migration needed
- keep payloads stable and improve presentation/copy around them

## Testing plan
- proof UI tests
- student shell tests
- risk explorer tests
- browser smoke assertions on blocked-stage and suppression copy

## Rollout plan
- ship copy/explanation changes behind ordinary UI releases
- pair with release notes for internal users

## Fallback / rollback plan
- revert only the framing layer if copy proves misleading or noisy

## Acceptance criteria
- suppressed probabilities always show a visible reason
- blocked-stage state always has plain-language explanation
- shell labels are described in-product
- no regression in proof UI disclaimer tests

## Open questions
- Should “student shell” be renamed or only better explained?
- Which explanations belong inline vs in help affordances?

## Complexity and change risk
- Complexity: M
- Risk of change: Low
- Prerequisite issues: none hard; AM-008 helpful
- Downstream issues unblocked: AM-011, AM-014

