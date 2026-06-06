# Current Product Cleanup Decision Matrix

**Decision date:** 2026-06-06
**Status:** Actionable cleanup queue derived from the agent repo map and product direction.

## Product North Star

AirMentor should optimize for one thing: a program team can rehearse an
academic decision using deterministic synthetic evidence, inspect the same
checkpoint across roles, record a human decision, and export a defensible
review pack.

Everything else is either support infrastructure, historical evidence, or drag.

## Deletion Rules

Delete only when at least one rule is true:

- the file is a generated runtime artifact, log, PID, screenshot, trace, or local
  cache and is not part of a verified external vault;
- the code has no importers, no package-script entry, no e2e or unit-test owner,
  and no product role in the rehearsal loop;
- the feature duplicates a newer role surface that already proves the same
  checkpoint truth;
- the artifact is historical agent/pipeline coordination state and the final
  source/docs/tests it produced are already committed;
- the model output is an intermediate run and the governed contract plus external
  model vault preserve the reproducible result.

Do not delete when any rule is true:

- it is a compact serving contract under
  `air-mentor-api/model-contract/proof-risk-model`;
- it is a migration, seed contract, or schema artifact needed for fresh-clone
  deterministic replay;
- it is the only current test for a visible product claim;
- it is a model or corpus artifact not yet confirmed in the external archive;
- it participates in the shared checkpoint playback, program-template,
  intervention-review, or pilot-export path.

## Keep And Strengthen

| Area | Evidence | Verdict |
|---|---|---|
| Shared proof playback | `tests-e2e/specs/shared-proof-playback-sync.spec.ts`, `src/proof-playback.ts`, `src/proof-surface-shell.tsx` | Product-defining. Do not prune. |
| Runtime proof services | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`, `air-mentor-api/src/lib/proof-risk-model.ts` | Core loop. Refactor only with contract tests. |
| Program configuration and curriculum graph | `src/system-admin-curriculum-graph.tsx`, `air-mentor-api/src/modules/curriculum-graph-routes.ts`, `air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json` | Keep, but drive toward one template contract. |
| API client and domain types | `src/api/client.ts`, `src/api/types.ts`, `src/domain.ts` | High blast-radius. Keep and simplify carefully. |
| Governed model contract | `air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json`, `promotion-decision.json` | Preserve. This avoids retraining dependence for fresh clones. |
| Browser proof harness | `tests-e2e/playwright.config.ts`, realism/parity specs | Keep only specs that prove active product claims. |

## Freeze Unless A Pilot Pulls It Forward

| Area | Current map signal | Direction |
|---|---:|---|
| Broad academic operations UI | large surfaces such as `src/pages/calendar-pages.tsx`, `src/system-admin-faculties-workspace.tsx`, `src/system-admin-timetable-editor.tsx` | Maintain only when the feature configures or explains a rehearsal. Do not pursue SIS completeness. |
| Student agent shell | `air-mentor-api/tests/student-agent-shell.test.ts`, `src/pages/student-shell.tsx` | Keep bounded to deterministic evidence navigation. No open-ended LLM behavior yet. |
| HoD counterfactual panels | `src/hod-counterfactual-panel.tsx`, `src/hod-counterfactual-simulator-panel.tsx` | Keep if they show reviewable scenario consequences. Remove duplicate panels after a single review workflow exists. |
| Model research scripts | 97 backend scripts, including SOTA, TabPFN, CatBoost, ablation, fairness, and benchmark scripts | Freeze as offline research. Do not expand unless a pilot exposes a model failure the governed path cannot represent. |
| Old branch-agnostic agent docs | `.windsurf/AGENTS.md`, `.windsurf/workflows/*`, `.kiro/specs/*` | Keep the current preamble, but treat older live-student/demo urgency wording as historical. |

## Archive-First Cleanup Queue

These are not product features. They should move toward external archive or
deletion after one scripted reference check.

| Queue | Evidence | Recommended action |
|---|---|---|
| Historical pipeline DAGs and manifests | 171 tracked files under `pipeline/`, including 100 manifest files under `pipeline/agents/manifests/` | Archive the whole pipeline bundle unless it is still used by a current command. Keep only a short README pointer if deleted. |
| Forge audit package | 22 tracked files under `forge-audit/` plus generated `egg-info` metadata | If not actively used, archive/remove. If kept, delete generated `egg-info` and add a maintained test or README. |
| Closeout/finalize scripts | `scripts/closeout-stage-*`, `scripts/finalize-stage-*`, `scripts/snapshot-final-closeout-artifacts.mjs` | Archive after their resulting docs/tests are confirmed. These encode past sessions, not product behavior. |
| Massive/demo dump scripts | `scripts/extract_massive_demo_dump.ts`, `air-mentor-api/scripts/produce_massive_dump.py`, `dump_trajectories.py`, `massive-e2e-validation*` | Keep at most one reproducible export path. Delete repeated dump/validation variants after archive verification. |
| Model-zoo and tournament scripts | `train_sota_ensemble.py`, `run_sota_policy_benchmark.py`, `train_sota_tabm_tft.py`, `tabpfn_*`, `benchmark_models.py`, `run_ablation_suite.py` | Preserve final model/corpus artifacts externally; then prune experiments not tied to the governed contract. |
| One-off fix/diagnostic scripts | `fix-trajectories.ts`, `fix-challenger-batch.ts`, `verify-calibration-fixes.ts`, `discover-offerings-diag-*`, `check-drizzle*`, `check_states.ts` | Delete when no package script, test, or current doc references them. |

## Deleted In This Pass

The following tracked files were removed after checking import/reference evidence:

| File | Reason |
|---|---|
| `.superpowers/brainstorm/440080-1777556317/state/server.log` | Generated local brainstorm server log. |
| `.superpowers/brainstorm/440080-1777556317/state/server.pid` | Generated local PID. |
| `.superpowers/brainstorm/440080-1777556317/state/server-stopped` | Generated local runtime state marker. |
| `src/assets/react.svg` | Empty default scaffold asset with no references. |
| `src/data.old.ts` | Stale 1,275-line backup beside active `src/data.ts`; no importers found in the generated import map or repository search. |

## Next Deletion Batch

Run the next batch in this order:

1. Generate a reference report for the archive-first queue:

```bash
npm run agent:map
jq -r 'select(.path | test("closeout|finalize|massive|dump|sota|tabpfn|benchmark|ablation|fix|diag"; "i")) | .path' docs/agent-map/files.jsonl
```

2. For each candidate, require all checks to pass before deletion:

```bash
rg -n "candidate-file-name-without-extension|candidate/path" . --glob '!docs/agent-map/*'
jq -r 'select(.from=="candidate/path" or .to=="candidate/path")' docs/agent-map/imports.jsonl
git log --oneline -- candidate/path | head
```

3. Delete in family-sized commits, not one giant purge:

- pipeline/archive sediment;
- old closeout scripts;
- model-zoo scripts;
- diagnostic/fix scripts;
- duplicate UI panels.

4. After every batch, regenerate the map and run hygiene:

```bash
npm run agent:map
node scripts/check-repo-hygiene.mjs
```

## Strategic Bottom Line

The repo is now small enough. The bigger danger is product sprawl. The next
cleanup should remove past-agent orchestration, repeated model experiments, and
duplicate demo scaffolding while protecting the deterministic rehearsal loop.
