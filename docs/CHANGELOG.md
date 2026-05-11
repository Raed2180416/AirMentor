# Changelog

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md`. Every phase task that
> lands updates §4 of the roadmap and adds an entry here.
> Format: `YYYY-MM-DD · phase(Pn) · short summary · refs`.

---

## Paper venue & deadline (Decision L2)

> Default — override by editing this section.

- **Primary venue:** EDM 2027 (Educational Data Mining).
- **Target submission window:** abstract ~early February 2027, full paper ~one week later
  (extrapolating from EDM 2026 dates: abstract 2026-02-02, full 2026-02-09).
- **Fallback venue 1:** AIED 2027 (similar early-year deadline; rolling Springer LNCS process).
- **Fallback venue 2:** IEEE Transactions on Learning Technologies (rolling, journal).
- **Working back from ~2027-02-01 (T):**

```
2026-05-01  P0 (this week)
2026-05-08  P1 start (3 weeks)
2026-05-29  P2 start (2 weeks)
2026-06-12  P3 + P4 parallel (3 weeks)
2026-07-03  P5 start (2 weeks)
2026-07-17  P6 start (3 weeks)
2026-08-07  P7 start (3 weeks)
2026-08-28  P10 outline (paper drafting begins, parallel from here)
2026-12-01  P10 figures + drafts complete
2027-01-15  P10 internal review
2027-02-01  Submission
```
- **Risk note:** if EDM 2027 dates slip later than EDM 2026, all the above
  shifts; the buffer between P7 close and submission is what absorbs the
  slip. If EDM 2027 dates compress earlier (unlikely), the fallback to
  IEEE TLT (no fixed date) protects the work.

If you choose differently (different venue, different date), edit this
block, then re-run the timeline math at roadmap §9.1.

---

## Phase log

### 2026-05-01 · phase(P0) · roadmap inception, hygiene, scaffolding

- **5f2cd413** untrack `air-mentor-api/dist/` (189 build artifacts), split
  `.claude/settings.local.json` into committed `.claude/settings.json`
  (project-shared subset) and gitignored `.claude/settings.local.json`
  (per-user override). Hardened `.gitignore` with explicit entries.
  Refs K1, K2, K6.
- **21e3269d** wired `RENDER_PUBLIC_API_URL` as primary in
  `.github/workflows/deploy-pages.yml`, `.github/workflows/verify-live-closeout.yml`,
  `scripts/check-railway-deploy-readiness.mjs`. Railway URL kept as
  fallback so Render rollover (P8) is incremental, not flag-day. Refs G10–G12.
- Scaffolded `docs/CAPABILITY_MATRIX.md`, `docs/POSITIONING.md` (L1 default = A),
  `docs/CHANGELOG.md` (this file with L2 default), `docs/BRANCH_STRATEGY.md`,
  `docs/paper-evidence/README.md`. Refs K4, K5, K7, E15, L1, L2.

#### Honest disclosures from the P0 sweep

- **Working tree NOT fully cleaned to zero (roadmap §3 expectation).** At P0 close
  there are ~50 modified `air-mentor-api/src/*` and `src/*` files plus several
  untracked `audit-map/32-reports/*.md` and `docs/*.md` reports. These are
  in-progress work from prior chats (P3 / P5 / P6 bleed) and from
  realism-readiness-security audits. They are **not P0 scope** and were
  intentionally left untouched. Resolve them in the phase commits that own
  them, not as a hygiene sweep.
- **`node_modules/` is partially tracked.** `node_modules/.vite/deps/*` and
  `air-mentor-api/node_modules/.vite/vitest/*` are in the index despite
  `node_modules` being in `.gitignore`. This is the same root cause as the
  dist issue (added before the ignore rule). Treat as **K8** (new issue, P0
  follow-up): `git rm --cached -r node_modules/.vite/ air-mentor-api/node_modules/.vite/`.
  Deferred this commit to keep the P0 blast radius small (could touch
  thousands of files; needs a separate review window).
- **Decision L8 ("Recalibrate vs Retrain coexist?")** is *implied* by the L1
  default to A; flagged here so P3 task 3.7 enters with "full replace" and
  not "coexist".

### 2026-05-01 · phase(P1) · literature foundation

- New `air-mentor-api/src/lib/learning-dynamics-constants.ts` — single
  source of truth for inference impacts, band thresholds, scenario-family
  fingerprints, Bloom→mastery targets, edge-weight defaults. Each
  constant carries `@bib` (matching `docs/references.bib`) or
  `@source institutional / engineering`. Source-class split: 12 / 11 / 9
  of 32 total.
- Refactored `air-mentor-api/src/lib/inference-engine.ts` — removed
  every magic number from the heuristic, imported named constants only.
  Behaviour-preserving (verified by 74 unit tests + 78 engine tests
  green; one pre-existing `msruas-proof-engines.test.ts > "converts CE
  thresholds"` failure on the demo branch is **unrelated** to P1 — it
  reproduces on `git stash` of the P1 changes).
- New `air-mentor-api/tests/learning-dynamics-constants.test.ts` — 47
  invariant tests; covers magnitude bounds, monotonicity, dominance of
  attendance per Credé 2010, scenario load-bearing axes, summary
  arithmetic.
- New `docs/references.bib` — 22 entries (≥15 P1 bar passed).
- New `docs/paper-evidence/01-literature-table.md` — per-constant
  audit trail + source-class summary.
- New `docs/paper-evidence/scenario-grounding.md` — 8 families mapped
  to literature anchors with fingerprint table and P2 split preview.

Roadmap §4 issue closures (logged here, mirrored in §4 of the
roadmap by the next P1-followup commit):

| ID | New status |
|---|---|
| C14 | partial → done (lit-anchored). Threshold-tunability deferred to P3 (still GAP-6). |
| C15 | partial → done. |
| E1, E2, E3, E4, E5 | done. |
| E6 | done. |
| E7 | done. |
| E15 | done. |

P1.6 disclosure (risk thresholds 50% / 45%): **institutional**
anchor disclosed in `docs/paper-evidence/01-literature-table.md`
Section A and Section C; the 50/45 weakCO threshold is replaced by
a Bloom-derived `mastery < target * 0.85` rule in P3.

### 2026-05-01 · phase(P0) · K8 untrack node_modules/.vite caches

- 24 vite/vitest cache files removed from index. `.gitignore` extended
  with explicit `node_modules/.vite/` + `air-mentor-api/node_modules/.vite/`.
- Out of scope: ~21,109 broader `node_modules/*` entries still tracked
  — captured in `audit-map/24-agent-memory/p2-entry-context-2026-05-01.md`
  for a dedicated future sweep with code-owner sign-off.

### 2026-05-01 · phase(P2) · task 2.1 family-disjoint generative-process split

- New field `ProofCorpusManifestEntry.generativeSplit` (`SplitName`) on
  every entry. Train families ⊥ val families ⊥ test families:
  - train  ← weak-foundation, low-attendance, high-forgetting, coursework-inflation
  - val    ← exam-fragility, carryover-heavy
  - test   ← intervention-resistant, balanced
- Helper `selectGenerativeSplitEntries(split)` returns the partition.
- Helper `generativeSplitForFamily(family)` is total over `PROOF_SCENARIO_FAMILIES`.
- Index-based `split` field preserved untouched — the deployed
  production-v8 / production-v7 / baseline-v5-like training pipelines
  stay valid. The two protocols answer different questions; both are
  retained.
- New tests `tests/proof-generative-split.test.ts` — 15 invariants:
  exhaustive + disjoint family assignment, field consistency, sizing
  (32 / 16 / 16), the two protocols genuinely disagree, balanced lands
  only in test under protocol B.
- Zero regressions: `proof-risk-model.test.ts`,
  `proof-risk-scoring-parity.test.ts` (test fixtures patched to set
  `generativeSplit`), `evaluate-proof-risk-model.test.ts`,
  `learning-dynamics-constants.test.ts` all green.
- New `docs/paper-evidence/02-validation-protocol.md` — methodological
  contract for the paper Experiments section; documents the two
  protocols, what each answers, expected risk on protocol B (AUC drop),
  and the reviewer-question pre-empt table.

Roadmap §4 status flips:
- E8 → done.
- E9 → partial (already had baseline-v5-like + depth-2-tree challenger;
  majority-class + 2-feature logistic still missing — next P2 commit).
- E12 → partial (Brier/ECE/slope/intercept already in `RiskMetricSummary`;
  reliability-diagram artifact still missing).
- E10, E11, E13, E14 → still pending; queued for next P2 commits.

P2 entry context (deferred items kept in mind):
- `audit-map/24-agent-memory/p2-entry-context-2026-05-01.md` documents
  the roadmap-vs-reality reconciliation, the prior `coverage-24` /
  hybrid-router investigation (do not lose), the pre-existing
  `msruas-proof-engines.test.ts > "converts CE thresholds"` failure
  root-cause analysis, and the L1–L9 default disposition.

### 2026-05-02 · phase(P2) · deep-dig closure of P0/P1/P2 deferred ledger

- **D4 closure** (`dc57600f`) — `msruas-proof-engines.test.ts > "converts
  CE thresholds"` pre-existing failure resolved by accepting the
  in-flight `proof-control-plane-playback-service.ts:88` `post-tt2`
  suppression as correct (intent confirmed by
  `audit-map/32-reports/proof-readiness-closeout-2026-04-30.md`
  lines 76–78) and updating the test. 102/102 affected-file tests pass.
- **D8 closure + E9 + E10 + E12 + E13 + E14** (`fef27927`) —
  three new self-contained validation modules:
  - `proof-risk-evaluation-stats.ts` — `rocAucFromArrays` (mid-rank
    tie handling), `bootstrapMetricCi` / `bootstrapAucCi` /
    `bootstrapBrierCi`, `permutationFeatureImportance`,
    `reliabilityDiagramData`. 28 unit tests.
  - `proof-risk-baselines.ts` — `trainMajorityClassBaseline`,
    `trainTwoFeatureLogisticBaseline` (Newton-Raphson IRLS, ridge
    1e-3, 50-iter cap, 1e-8 tolerance, 3×3 Cramer's-rule solve).
    11 unit tests.
  - `proof-risk-sensitivity.ts` — `runOneAtATimeSensitivity` +
    `renderSensitivityMarkdown`. 8 unit tests.
  - `learning-dynamics-constants.ts` re-exports `ScenarioFamily` from
    `proof-risk-model.ts` (D8 reconcile).
- **D14 + D18 + D19-partial** (`41fc2982`) —
  - `proof-risk-adversarial-corpus.ts`: power-law forgetting +
    matched exponential control through one code path; 12 unit tests.
  - Evaluator profiles: `generative-split-{train,val,test}` added to
    `EVAL_SEED_PROFILES`; `assertSeedPartitionCoverage` now
    splitField-aware. 4 new tests.
  - `scripts/generate-baseline-paper-evidence.ts` runs deterministic
    end-to-end and emits `docs/paper-evidence/03-baseline-results.md`:
    - adversarial AUC = 0.9918, 95% CI [0.9795, 0.9996]
    - control      AUC = 0.9974, 95% CI [0.9911, 1.0000]
    - permutation: attendancePct ΔAUC = 0.4633 (load-bearing) vs
      currentCgpa ΔAUC = 0.0016 (negligible) — confirms Credé 2010.
- **D3 closure** (`77f0c468`) — 17 untracked durable artefacts
  committed (audit-map reports, design docs, readiness governance,
  superpowers plans/specs); `.ctxo/` and `.superpowers/` tool caches
  gitignored.
- **D1 closure** (`24d6ec26`) — broader K8 follow-up: 21,086 tracked
  `node_modules/*` entries removed from index. Working tree
  unaffected (gitignore already covered the path; `npm install`
  regenerates on demand). Repo tracked-file count fell from ≈27,400
  to 6,361.

Roadmap §4 status flips at this commit:
- E9 partial→done; E10 pending→done; E11 pending→done; E12
  partial→done; E13 pending→done; E14 pending→done.
- K8 narrow→done; new rows K9 (D2 in-flight WIP, captured),
  K10 (D4 pre-existing failure, done), K11 (D3 untracked artefacts,
  done), K12 (D6 branch protection, captured), K13 (D7 demo branch
  reconciliation, captured).

**Captured-with-handoff** (no closure possible without external
action or downstream phase work): D2 (~50 in-flight src/* WIP),
D5 (L1–L9 user decisions), D6 (GitHub branch-protection UI),
D7 (demo↔main reconciliation), D9 (engineering-tier disclosure
for paper Limitations — P10), D10 (50/45 weakCO threshold replacement
— P3 task 3.3), D11 (GAP-6 operator-tunable band thresholds —
P3/P5), D19-rest (full evaluator rerun under generative-split
profiles — needs embedded-postgres-capable host),
D20 (CatBoost end-to-end — P7).

Comprehensive disposition table:
`audit-map/24-agent-memory/deferred-disposition-2026-05-02.md`.

### Pending — to be filled as phases land

### 2026-05-11 · phase(P5/P9-local) · Course Leader guided demo reality loop

- Added local-only Course Leader **Demo Reality Loop** panel for one proof-queue student: before snapshot, deterministic attendance edit, academic observed-only recompute, risk/card refresh, reassessment resolution, and next-stage advance.
- Added academic workspace recompute-risk route `POST /api/academic/proof-runs/:simulationRunId/recompute-risk`, scoped to active academic proof runs, plus API client wrapper.
- Performance follow-up: the Course Leader recompute route now reuses active proof-risk artifacts (`rebuildModelArtifacts: false`) instead of retraining/rebuilding model artifacts on every guided panel recompute; focused Firefox evidence moved from a second `[rebuild]` block during recompute and `1/1 passed in 2.8m` to no second `[rebuild]` block and `1/1 passed in 2.2m`.
- Updated `docs/CAPABILITY_MATRIX.md` with conservative `partial / demo-only` status.
- Added final evidence dossier at `audit-map/32-reports/guided-demo-reality-loop-closeout-2026-05-11.md`.
- Verification:
  - `npx --no-install vitest run tests/demo-reality-loop.test.tsx tests/academic-route-pages.test.tsx tests/api-client.test.ts --reporter=dot` → 27/27 passed.
  - `npx --no-install vitest run air-mentor-api/tests/academic-proof-routes.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot` → 5/5 passed.
  - `npx --no-install tsc -p tsconfig.app.json --noEmit`, `npx --no-install tsc -p tsconfig.tests.json --noEmit`, `npx --no-install tsc -p air-mentor-api/tsconfig.json --noEmit` → passed.
  - `PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 nix develop -c playwright test tests-e2e/specs/guided-demo-reality-loop.spec.ts --config tests-e2e/playwright.config.ts --reporter=list` → 1/1 passed in 2.2m after the fast recompute patch.
  - `npm run lint -- --max-warnings=0` and `git diff --check` → passed.
- Non-claims: no full six-semester ladder proof for this panel, no real-data production ML validity, no multi-program generality.

```
2026-05-?? · phase(P3) · Bloom-mastery wire-through, edge-weight, impact preview, Recalibrate rename
2026-05-?? · phase(P4) · UX label sweep
2026-05-?? · phase(P2-tail) · full evaluator rerun under generative-split profiles (D19-rest)
…
```
