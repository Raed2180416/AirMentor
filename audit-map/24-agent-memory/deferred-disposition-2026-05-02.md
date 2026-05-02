# Deferred Disposition — 2026-05-02

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` and
> `audit-map/24-agent-memory/p2-entry-context-2026-05-01.md`.
> Records the disposition of every deferred item from P0 / P1 / P2 at
> the close of the deep-dig pass on 2026-05-02.
> **Do not delete before P10 paper drafting** — paper Limitations and
> Methods rely on the explicit handoffs below.

---

## TL;DR

Of 20 deferred items tracked at the start of the deep-dig pass:

- **Closed deterministically**: D1, D3, D4, D8, D12, D13, D14, D15, D16, D17, D18 (eleven items).
- **Closed partially with rest captured**: D19 (paper-evidence numbers
  emitted for the simpler baselines; full evaluator rerun under
  generative-split-* still needs an embedded-postgres-capable host).
- **Captured with handoff**: D2, D5, D6, D7, D9, D10, D11, D20 (eight
  items, all blocked on external action or downstream phase work).

Twelve commits land the closures (`5f2cd413` … `24d6ec26`). 145+ tests
pass across the 10 P2-affected files. tsc clean. `git ls-files` count
fell from ≈27,400 to 6,361 after D1.

---

## Closed deterministically (11)

| # | Item | Closed by | Verification |
|---|---|---|---|
| **D1** | Untrack the wider `node_modules/` tree (21,086 files; same root cause as K1/K8) | `24d6ec26` | `git ls-files node_modules/` → 0; tree unaffected. |
| **D3** | 10 untracked `audit-map/32-reports/*.md` and `docs/*.md` reports | `77f0c468` | All 17 durable artefacts staged + committed; `.ctxo/` and `.superpowers/` gitignored. |
| **D4** | `tests/msruas-proof-engines.test.ts > "converts CE thresholds"` pre-existing failure | `dc57600f` | Stage gate intent decided per `audit-map/32-reports/proof-readiness-closeout-2026-04-30.md` lines 76–78 (post-tt2 must mask quiz/assignment); 102/102 affected-file tests now pass. |
| **D8** | Duplicate `ScenarioFamily` type | `5a25de3d` | `learning-dynamics-constants.ts` re-exports the union from `proof-risk-model.ts`. tsc clean. |
| **D12** | E9: majority-class + 2-feature logistic baselines | `fef27927` | New `proof-risk-baselines.ts`; 11 unit tests; deterministic IRLS Newton-Raphson with ridge=1e-3, 50-iter cap, 1e-8 tolerance. |
| **D13** | E10: sensitivity sweep | `fef27927` | New `proof-risk-sensitivity.ts`; 8 unit tests; OAT protocol with markdown rendering. |
| **D14** | E11: adversarial corpus (power-law forgetting) | `41fc2982` | New `proof-risk-adversarial-corpus.ts`; 12 unit tests; matched-α power-law vs exponential cohorts via the same code path. |
| **D15** | E12 partial → done: reliability-diagram data | `fef27927` | `reliabilityDiagramData()` in `proof-risk-evaluation-stats.ts`; 5 unit tests assert ECE / MCE / count invariants. The figure script in P10 consumes this data. |
| **D16** | E13: bootstrap CIs on AUC | `fef27927` | `bootstrapAucCi`, `bootstrapBrierCi`, `bootstrapMetricCi` in `proof-risk-evaluation-stats.ts`; 7 unit tests; deterministic with seeded mulberry32. |
| **D17** | E14: permutation feature importance | `fef27927` | `permutationFeatureImportance()` in `proof-risk-evaluation-stats.ts`; 6 unit tests; Breiman 2001 / sklearn pattern; direction-aware. |
| **D18** | Evaluator wire-in: `generative-split-{train,val,test}` profiles | `41fc2982` | `EVAL_SEED_PROFILES` extended; `assertSeedPartitionCoverage` dispatches on `splitField`; 4 new tests in `proof-generative-split.test.ts`. |

---

## Closed partially (1)

### D19 — paper numbers

- **Closed:** `air-mentor-api/scripts/generate-baseline-paper-evidence.ts`
  emits `docs/paper-evidence/03-baseline-results.md` with deterministic
  AUC + Brier + bootstrap CI + reliability-diagram data + permutation
  importance for both baselines on both corpora. First run produced:
  - adversarial AUC = 0.9918, 95% CI [0.9795, 0.9996]
  - control AUC = 0.9974, 95% CI [0.9911, 1.0000]
  - permutation importance: attendancePct ΔAUC = 0.4633 (load-bearing)
    vs currentCgpa ΔAUC = 0.0016 (negligible) — confirms Credé 2010
    attendance-meta-analysis claim with deterministic numbers paper
    Methods can cite.
- **Open:** Full evaluator rerun under `generative-split-train`,
  `generative-split-val`, `generative-split-test` profiles. The
  evaluator path (`scripts/evaluate-proof-risk-model.ts`) requires
  embedded-postgres which `audit-map/24-agent-memory/known-ambiguities.md`
  (and `known-facts.md`) document as sandbox-blocked
  (`listen EPERM: operation not permitted 127.0.0.1`).
- **Handoff:** Run from a host where `node` can `listen()` on
  `127.0.0.1`:
  ```bash
  cd air-mentor-api
  AIRMENTOR_EVAL_SEED_PROFILE=generative-split-train npm run evaluate:proof-risk-model
  AIRMENTOR_EVAL_SEED_PROFILE=generative-split-val   npm run evaluate:proof-risk-model
  AIRMENTOR_EVAL_SEED_PROFILE=generative-split-test  npm run evaluate:proof-risk-model
  ```
  Each invocation will emit a fresh `evaluation-report.{json,md}` in
  `air-mentor-api/output/proof-risk-model/`. Archive each into
  `audit-map/17-artifacts/json/` per the conventions in
  `audit-map/32-reports/proof-risk-model-investigation-2026-04-20.md`.

---

## Captured with handoff (8)

The following items are not closeable in this session because they
depend on external action (humans, GitHub UI, downstream P-phase
infrastructure, real cohort data) or because they belong to in-flight
WIP that is not safe for me to commit in isolation.

### D2 — ~50 in-progress src/* changes (realism-readiness branch WIP)

**Status:** untouched. `git diff HEAD --shortstat src/ air-mentor-api/src/`
reports 27 files / 940 insertions / 281 deletions / +659 net lines.

**Categorisation (read by file size + first-line scan, not full
review):**

| File | Lines diff | Likely owner | What to do |
|---|---:|---|---|
| `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | +127 | proof-control-plane | review with realism-readiness |
| `air-mentor-api/src/lib/msruas-proof-sandbox.ts` | +149 | proof-sandbox | review with realism-readiness |
| `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts` | +72 | checkpoint | review with realism-readiness |
| `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts` | +73 | rebuild-context | review with realism-readiness |
| `air-mentor-api/src/modules/academic.ts` | +73 | academic-routes | review with realism-readiness |
| `air-mentor-api/src/db/seed.ts` | +66 | seed | review with realism-readiness |
| `src/system-admin-live-app.tsx` | +237 | sysadmin-live | review with realism-readiness |
| `src/system-admin-proof-dashboard-workspace.tsx` | +171 | sysadmin proof | review with realism-readiness |
| (others ≤50 lines) | various | various | review with realism-readiness |

**Why not committed here:** these changes are interdependent (e.g. the
sysadmin-live + proof-dashboard pair, or the proof-control-plane web
of services) and committing only some of them risks leaving the
others in an inconsistent state. The single change in
`proof-control-plane-playback-service.ts` (D4 fix) was an exception
because (a) it was a 1-line correctness fix and (b) its intent was
explicitly documented in `proof-readiness-closeout-2026-04-30.md`.

**Handoff:** owner of the `college-demo-2026-04-27` realism-readiness
audit thread should review `git diff HEAD -- src/ air-mentor-api/src/`
and either commit, stash, or discard. If owner is the same person who
ran the P0/P1/P2 dig, recommended order:
1. Run `npx vitest run` from each workspace; identify which tests
   fail without the WIP changes vs which pass.
2. Group failing-without-WIP changes into one phase commit with
   intent-anchored message.
3. Discard WIP changes whose tests pass without them (likely
   half-finished refactors).

### D5 — L1–L9 decisions

Defaults proposed in conversation 2026-05-01 (`docs/POSITIONING.md`,
`docs/CHANGELOG.md` top, `docs/BRANCH_STRATEGY.md`). User has not
explicitly confirmed or overridden any. Status:

| ID | Default proposed | Override impact |
|---|---|---|
| L1 | A — simulation platform | Drives paper claims N1/N2/N3, P11 design docs, P12 sales framing. Override → re-frame paper, re-prioritise P11. |
| L2 | EDM 2027 (~Feb 2027), fallback AIED 2027 / IEEE TLT | Drives timeline math in roadmap §9.1. Override → recompute T-N week schedule. |
| L3 | ECE 2024 required for paper claim N2 | Override (deferred) → N2 weakens to "transferable architecture, not yet demonstrated cross-program". P6 entry blocked. |
| L4 | Render plan budget — undecided | Default-deferred until P8 entry. Recommended: Starter ($7/mo per service) for cold-start mitigation. |
| L5 | Demo data clean-slate before P5 — yes | Override → P5 inherits accumulated test runs. Snapshot+wipe is safer. |
| L6 | Recalibration AUC bar — TBD per P7 evidence | Cannot decide before P7 ECE 2024 cross-program experiment runs. |
| L7 | Frontend domain — keep `raed2180416.github.io` | Override → custom domain config in `.github/workflows/deploy-pages.yml`. |
| L8 | Recalibrate vs Retrain — full replace (implied by L1=A) | Override (coexist) → P3 task 3.7 keeps both terms in UI; "Retrain" stays under "Recalibrate" with a tooltip. |
| L9 | Provisioning tab fate — fold into proof-run flow | Override → keep as separate tab (B7 demo badge mandatory) or delete (UX simplification). |

**Handoff:** user reviews, edits each block in the source-of-truth
doc (`POSITIONING.md` / `CHANGELOG.md` / `BRANCH_STRATEGY.md`), and
marks "Decided: <choice> on YYYY-MM-DD" inline. Anything still on
default at P5/P6/P7/P8 entry blocks the phase.

### D6 — Branch protection on `main`

**Status:** missing. `docs/BRANCH_STRATEGY.md` declares the policy
("require PR, require linear history, require CI green, no
force-push") but no GitHub branch-protection rule is configured.

**Handoff:** GitHub UI manual step. Path:
`https://github.com/<owner>/air-mentor-ui/settings/branches → Add rule`.
Rules to add:
- Branch name pattern: `main`
- Require a pull request before merging: yes (1 approval, even
  for solo dev — your own approval after CI)
- Require status checks to pass before merging: yes
  (CI workflow `ci-verification`)
- Require linear history: yes
- Do not allow force pushes: yes
- Restrict deletions: yes

Same for `paper/p10-draft` once that branch is created (per roadmap
§6.2). Tag `p1-exit`, `p2-exit`, etc. as allowed-to-create only by
maintainer.

### D7 — Demo branch ↔ `main` reconciliation

**Status:** the working session lives on `college-demo-2026-04-27`.
`main` is far behind. Strategy doc in `docs/BRANCH_STRATEGY.md` §
"When the demo branch merges back" outlines the plan; not yet
executed.

**Handoff:**
1. After D2 in-flight WIP is resolved (committed or discarded), tag
   the demo branch `tag/demo-2026-04-27-final`.
2. Decide which of the demo's commits should land on `main`. Per
   `BRANCH_STRATEGY.md`: P-phase commits move to `research/...`
   branches; pure demo scaffolding lands as a single squashed commit
   on `main`.
3. Open a PR `college-demo-2026-04-27 → main`. Resolve conflicts.
4. Once merged, future P-phase work can branch off `main` per the
   roadmap convention.

### D9 — Engineering-tier 9 constants in paper Limitations

**Status:** code-side complete (each constant in
`learning-dynamics-constants.ts` carries `@source engineering`).
Paper-side: P10 work.

**Handoff:** when P10 outline is drafted (week T-15 per roadmap
§9.1 timeline), copy the engineering-tier rows from
`docs/paper-evidence/01-literature-table.md` Section A summary into a
single Limitations subsection. Do not paraphrase — verbatim
disclosure is the point. Suggested heading: "Engineering-Calibrated
Constants Disclosed Without Literature Anchor".

### D10 — 50/45 weakCO threshold → Bloom-derived rule

**Status:** documented in `docs/paper-evidence/01-literature-table.md`
Section C as institutional. Replacement is **P3 task 3.3** —
`mastery < target * MASTERY_WEAKNESS_RATIO` where `MASTERY_WEAKNESS_RATIO = 0.85`
already defined in `learning-dynamics-constants.ts`.

**Handoff:** in P3, replace the literal at
`air-mentor-api/src/lib/msruas-proof-control-plane.ts:1286`:
```ts
weakCoCount: outcomes.filter(outcome =>
  outcome.summary.observedScores.tt2Pct < 50
  || outcome.summary.observedScores.seePct < 45
).length
```
with a Bloom-driven mastery threshold check. The constants are
already exported; only the call site needs updating. Add a regression
test `tests/curriculum-feature-wire-through.test.ts` per roadmap §5
P3 task 3.6.

### D11 — GAP-6 band thresholds operator-tunable

**Status:** documented as engineering in
`docs/paper-evidence/01-literature-table.md` Section A
(RISK_BAND_HIGH_THRESHOLD = 0.7, RISK_BAND_MEDIUM_THRESHOLD = 0.35
are deferred per
`audit-map/08-ml-audit/01-observable-risk-heuristic-fallback.md` GAP-6).

**Handoff:** operator-configurability lands in **P3 task 3.5 / P5**
once the demo workspace + per-batch policy plumbing are wired. Until
then the band cuts are code-owned defaults. The band cut is a known
engineering-tier exposure surface in the paper Limitations
(D9 covers the disclosure).

### D19-rest — full evaluator rerun under generative-split profiles

See "Closed partially" above for the handoff command.

### D20 — CatBoost Python-interop end-to-end

**Status:** `proof-risk-model.ts:97-100` documents the intent ("phase
10 intent — CatBoost JSON artefact produced by
`scripts/train_catboost_challenger.py`"). The TypeScript scaffold
(`ChallengerModelFamily = 'depth-2-tree' | 'catboost'`) is in place
but the Python training pipeline is not wired.

**Handoff:** P7 / paper Discussion. CatBoost ranks first in the
"final research read" of
`audit-map/32-reports/proof-risk-model-investigation-2026-04-20.md`
(lines 286–292). Full integration requires:
1. Python training script (`scripts/train_catboost_challenger.py`)
   producing a JSON artefact with feature names + thresholds + leaf
   values per tree.
2. TS loader that reads the JSON and routes scoring through it via
   the existing `ChallengerModelFamily = 'catboost'` lane.
3. Governed splits identical to the production logistic so the
   comparison is apples-to-apples.
4. Evidence file `docs/paper-evidence/07-catboost-challenger.md`
   (new — not yet listed in
   `docs/paper-evidence/README.md`).

CatBoost is not blocking for the paper if N1 + N2 + N3 hold without
it; per audit-map's "final research read" CatBoost is "next serious
challenger after evaluator guardrails are in place" — i.e. P7
priority not P2.

---

## Re-running the deep-dig pass (reproduction)

The closures above are deterministic and reproducible. To re-verify:

```bash
# Backend test sweep
cd air-mentor-api
npx tsc -p tsconfig.json --noEmit
npx vitest run tests/proof-generative-split.test.ts \
              tests/proof-risk-baselines.test.ts \
              tests/proof-risk-evaluation-stats.test.ts \
              tests/proof-risk-sensitivity.test.ts \
              tests/proof-risk-adversarial-corpus.test.ts \
              tests/learning-dynamics-constants.test.ts \
              tests/proof-risk-model.test.ts \
              tests/proof-risk-scoring-parity.test.ts \
              tests/msruas-proof-engines.test.ts \
              tests/evaluate-proof-risk-model.test.ts
# Expected: 145 pass, 0 fail

# Paper-evidence regenerate
npx tsx scripts/generate-baseline-paper-evidence.ts
# Expected: writes docs/paper-evidence/03-baseline-results.md;
#   adversarial AUC=0.9918 [0.9795, 0.9996], control AUC=0.9974 [0.9911, 1.0000]

# Verify hygiene closures
git ls-files air-mentor-api/dist/   | wc -l   # expect 0  (K1)
git ls-files .claude/settings.local.json     # expect empty  (K2)
git ls-files node_modules/.vite/    | wc -l   # expect 0  (K8)
git ls-files air-mentor-api/node_modules/.vite/ | wc -l  # expect 0
git ls-files node_modules/          | wc -l   # expect 0  (D1)
```

Anything that differs from the expected output above means a closure
has regressed.

---

## Roadmap §4 status flips landing in the next CHANGELOG update

| ID | Old | New | Closer commit |
|---|---|---|---|
| K8 | pending | done | `9b6421d1` |
| D1 (broader K8) | not in §4 | done | `24d6ec26` |
| D3 (untracked artefacts) | not in §4 | done | `77f0c468` |
| D4 (failing test) | not in §4 | done | `dc57600f` |
| D8 (ScenarioFamily duplicate) | not in §4 | done | `5a25de3d` |
| E9 | partial (after `2ce91a80`) | done | `fef27927` |
| E10 | pending | done | `fef27927` |
| E11 | pending | done | `41fc2982` |
| E12 | partial (after `2ce91a80`) | done (data); figure → P10 | `fef27927` |
| E13 | pending | done | `fef27927` |
| E14 | pending | done | `fef27927` |

(Carry-over: D5 / D6 / D7 / D9 / D10 / D11 / D19-rest / D20 stay
captured-with-handoff; not appropriate for a "done" flip until the
external dependency clears.)
