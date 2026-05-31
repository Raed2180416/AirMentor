# AirMentor Project Context

**Last Updated:** 2026-05-28  
**Repository:** `/home/raed/Projects/air-mentor-ui`  
**Branch-Agnostic:** This context applies across all branches

---

## Project Identity

**AirMentor** is a university-facing academic risk monitoring and intervention platform with two tightly connected modes:

1. **Production-like role workflows** for faculty (HOD, Mentor, Course Leader)
2. **Full demo/proof simulation capability** used to test every production feature and convince teachers/professors

### Product Positioning

**Primary Position (Decision L1):** Simulation platform for academic risk and intervention research (Positioning A from `docs/POSITIONING.md`)

- **What it is:** A configurable, literature-grounded simulator that produces synthetic student trajectories, surfaces risk drivers, and lets researchers/curriculum designers A/B test interventions before any real data is touched
- **Primary buyer:** Academics, EDM/AIED researchers, curriculum committees
- **Primary claim:** "configurable curriculum + parameter-grounded scenario engine + per-program recalibration on synthetic corpora"
- **What we do NOT promise:** Prediction on real students, institutional rollout, replacement of existing risk pipelines

### Faculty Roles

Three permission levels with distinct views:
- **HOD:** Sees department-wide metrics, all students, all faculty
- **MENTOR:** Sees overall multi-subject metrics per assigned mentee
- **COURSE LEADER:** Sees individual student performance in their specific subject

---

## Overarching Goals (Tier Hierarchy)

```
Tier 1 (must)  Research paper publishable @ EDM / IEEE TLT / AIED
Tier 2 (must)  Demo defensible — every UI label/feature self-explains
Tier 3 (must)  Render backend + GitHub Pages frontend prod-ready
Tier 4 (should) Multi-program template (proof of scalability)
Tier 5 (should) Production scaling architecture seeds
Tier 6 (nice)  First pilot deployment readiness
```

---

## Novelty Claims (Paper Core)

```
Claim N1: Realistic student-environment simulation engine
          → grounded in retention/learning literature
          → 8 scenario families mapped to documented failure modes
          → reproduces statistical signatures of those failure modes

Claim N2: Adaptable risk model architecture with per-program calibration
          → same model schema, recalibrated parameters per curriculum
          → demonstrated on ≥2 programs (M&C 2023 + ECE 2024)
          → quantitative confidence bounds on transfer

Claim N3: Configuration-driven simulation that surfaces curriculum-specific risk
          → course outcomes, prerequisites, edge weights numerically affect output
          → impact preview reveals config sensitivity before commit
```

**Explicit limitations (what we do NOT claim):**
- × Validated on real student data
- × Production-ready for institutional deployment
- × Generalizes across all academic structures
- × Replaces existing institutional risk processes

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    SIMULATOR LAYER                        │
│  msruas-proof-control-plane.ts (TypeScript)              │
│  generate_v2_data.py (Python reimplementation)           │
│                                                          │
│  Generates: latent traits → course simulation →          │
│             scores → features (48-dim) + labels (5 heads)│
└──────────────────────┬──────────────────────────────────┘
                       │ CSV export
┌──────────────────────▼──────────────────────────────────┐
│                    ML TRAINING LAYER                      │
│  train_sota_ensemble.py                                  │
│                                                          │
│  Trains: logistic regression (baseline)                  │
│          + XGBoost + LightGBM + CatBoost                 │
│          + calibration-weighted ensemble                 │
│  Selects: best model per head via 5-gate system          │
└──────────────────────┬──────────────────────────────────┘
                       │ model artifacts
┌──────────────────────▼──────────────────────────────────┐
│                 EVALUATION LAYER                          │
│  analyze_interventions.py                                │
│  validate_e2e_pipeline.py                                │
│  generate_adversarial_csvs.py                            │
│                                                          │
│  Measures: AUC, Brier, calibration, monotonicity,        │
│            fairness, adversarial OOD robustness,         │
│            intervention counterfactual effects           │
└─────────────────────────────────────────────────────────┘
```

### The 5 Risk Heads

| Head | What It Predicts | Difficulty |
|------|-----------------|------------|
| `attendanceRisk` | Student will drop below 65% attendance | Trivial (AUC=0.996) |
| `ceRisk` | Student will fail continuous evaluation (TT1/TT2/quizzes/assignments) | Hard (AUC=0.76) |
| `seeRisk` | Student will fail semester-end exam | Moderate (AUC=0.87) |
| `overallCourseRisk` | Student will fail the course overall | Moderate (AUC=0.92) |
| `downstreamCarryoverRisk` | Current performance threatens future semesters | Moderate-hard (AUC=0.86) |

### Feature Schema (v6)

**48 features (`feat_0` through `feat_47`)** encode:
- Attendance trajectory
- Assessment scores (TT1, TT2, quiz, assignments, SEE)
- CGPA and backlog metrics
- Semester progress indicators
- Course difficulty proxies
- Historical trends
- Stage indicators
- Missingness flags
- **v6 additions:** Active backlog credits, historical backlog burden, lower-year blocker pressure, backlog sensitivity score

---

## Codebase Statistics

- **Total files:** 11,904
- **Functions:** 13,137
- **Classes:** 217
- **Modules:** 560

### Most Complex Files

1. `msruas-proof-control-plane.ts` - 116 functions (TypeScript simulator core)
2. `proof-risk-model.ts` - 100 functions (Risk model definitions, training manifest)
3. `evaluate-proof-risk-model.ts` - 66 functions (Evaluation harness)
4. `msruas-proof-sandbox.ts` - 25 functions (Proof sandbox)

---

## Key Technical Decisions

### Risk Model Philosophy

**Pre-risk interpretation:** Rolling teacher-like stage risk, not a single final-outcome classifier
- Sem 1 pre-TT1: Minimal prior data, should be cautious
- After TT1: Risk updates using TT1 to anticipate TT2/trajectory
- After TT2: Risk uses TT1+TT2 to update CE/SEE
- Assignments/quizzes: Weak/noisy/cheatable but nonzero CE evidence
- After SEE: System learns from prior-semester progression, carryover/backlog risk
- **Mental model:** Teacher reading an average classroom plus edge cases, dynamically updating risk semester-by-semester

### MSRUAS Policy Rules (Encoded)

**SGPA/CGPA Formula:**
- SGPA = sum(credit × grade point) / total semester credits
- CGPA = sum(credit × grade point across semesters) / total attempted credits

**Grade Mapping:**
- O=10 (90-100), A+=9 (80-89), A=8 (70-79), B+=7 (60-69), B=6 (55-59), C=5 (50-54), P=4 (40-49), F=0 (<40)

**Subject Pass Requirements:**
- Attendance eligibility
- CE/internal eligibility
- Required SEE marks
- Minimum 40% overall

**Backlog/Promotion Rules:**
- Credit-based, not subject-count-based
- Failed course contributes its credits to active backlog until cleared
- Maximum allowed backlog for promotion: 15 credits
- Four 4-credit failures = 16 backlog credits = detention/year-back risk
- Lower-year uncleared subjects block later promotion

---

## Current State (2026-05-28)

### Branch Strategy

**Main branch:** Production-like serving, demo workflows  
**Research branches:** `sota-research-2026-05-26`, etc. for ML experimentation

### Backend
- **Location:** `air-mentor-api/`
- **Language:** TypeScript + Python scripts
- **Database:** Postgres (Drizzle ORM)
- **ML:** Logistic regression + tree challengers (proof-risk-model.ts)
- **Training data:** 64 synthetic worlds (PROOF_CORPUS_MANIFEST)
- **Demo program:** BTech CSE Mathematics & Computing 2023 (hardcoded)

### Frontend
- **Location:** `src/`
- **Framework:** React
- **Deployment:** GitHub Pages
- **Backend port:** 4000

### ML Readiness Status

**Current evidence supports:** Synthetic/demo/shadow use only  
**NOT:** Production teacher-intervention ML promotion

**Key constraints:**
- No real student data exists for validation
- All validation is synthetic
- TSTR (Train on Synthetic, Test on Real) cannot be run
- Product readiness gates require real historical validation, calibration, subgroup/fairness review

---

## Critical Files

### Core Simulation
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts` - TypeScript simulator core (~2000 lines)
- `air-mentor-api/src/lib/proof-risk-model.ts` - Risk model definitions (~2400 lines)
- `air-mentor-api/scripts/generate_v2_data.py` - Python simulator (~590 lines)

### ML Training
- `air-mentor-api/scripts/train_sota_ensemble.py` - Main training pipeline (~1000 lines)
- `air-mentor-api/scripts/train_catboost_challenger.py` - Governed CatBoost trainer
- `air-mentor-api/scripts/analyze_interventions.py` - Counterfactual intervention simulation

### Evaluation & Readiness
- `air-mentor-api/scripts/product_readiness_report.py` - Product/research gate aggregation
- `air-mentor-api/scripts/run_ablation_suite.py` - Feature-family ablation orchestrator
- `air-mentor-api/scripts/fairness_deep_dive.py` - Slice analysis for heads
- `air-mentor-api/scripts/queue_workload_report.py` - Workload identity/capacity evidence

### Documentation
- `docs/MASTER_ROADMAP_2026-05-01.md` - Single source of truth for outstanding work
- `docs/POSITIONING.md` - Product positioning (3 options, recommended A)
- `docs/SOTA_HANDOFF.md` - Complete SOTA branch handoff
- `docs/CAPABILITY_MATRIX.md` - Feature statuses, evidences, gaps

---

## Known Issues & Gotchas

### ML Validation
- **Label leakage bug was fixed:** Original `compute_labels()` used same scores as `compute_features()`, creating deterministic mapping. Fixed with independent heuristic engine.
- **Simulator v2 ≠ v1:** Cross-simulator validation proves v1 and v2 produce functionally identical ML problems. Non-linear additions add code complexity without measurable difference.
- **Tree models offer marginal gains:** Only 1/5 heads (overallCourseRisk) benefits from tree models. Logistic regression is right baseline for 80% of heads.
- **attendanceRisk is trivial:** AUC=0.996 means this head is not worth research attention. ceRisk (AUC=0.76) is most interesting.

### Architecture
- **Demo data not isolated:** No `demoWorkspaceId` concept (pending P5)
- **Config → simulation wire-up incomplete:** Some UI configuration changes don't affect numerical output (pending P3)
- **Multi-program scalability:** Hardcoded constants for single program (pending P6)

### Production Readiness
- **No real data:** Every conclusion is conditional on simulator assumptions being correct
- **72.4% flag rate:** 0.5 probability threshold is too aggressive; needs per-head calibration
- **Workload capacity limits:** Hardcoded (Mentor=15, Course Leader=20) with no institutional basis

---

## Next Priority Actions

### P0 — Validate Against Real Data
- Obtain even a small real dataset (n=500 students, 2 semesters)
- Run TSTR: train on synthetic, test on real
- Measure AUC drop from synthetic→real

### P1 — Domain Expert Review
- Show 20 simulated student trajectories to 3+ instructors
- Ask: "Does this look like a real student? What's wrong?"
- Collect structured feedback on face validity

### P2 — Literature-Anchored Distribution Matching
- Extract feature distribution statistics from published EDM papers
- Compare simulator output distributions to published ranges

### P3 — Simplify the Simulator
- Strip back to v1 (linear only)
- Remove unvalidated v2 additions
- Keep only components with literature support

### P4 — Recalibration Experiment (P7 from Roadmap)
- Generate data for Program A, train model
- Generate data for Program B (different curriculum)
- Measure whether recalibration transfers

---

## Development Guidelines

### When Working on This Project

1. **Never claim real-data prediction** in copy, README, or paper
2. **Replace "Retrain" → "Recalibrate"** everywhere until real data exists
3. **Add "synthetic data only" banner** to demo
4. **Limit pilot conversations** to "research deployment / curriculum sandbox"
5. **Frame N2 as "transferable architecture"**, not "transferable predictions"

### Code Quality Standards

- **Literature anchoring:** Every magic number in inference + scenario engine must have literature anchor or honest disclosure
- **Stage-honest evidence:** TypeScript checkpoint playback masks TT/quiz/assignment/SEE evidence by stage
- **Independent label computation:** Labels computed from different logic than features (by design)
- **Credit-based backlog:** Use credit-based backlog counting, not subject-count

### Testing Priorities

- **Regression tests:** Assert global academic rows unchanged after demo provisioning
- **Config wire-through tests:** Change outcome → mastery target → simulation output changes
- **Edge weight wire-through tests:** Change edge weight → prerequisite average differs
- **Multi-program proof run integration test:** Validate across different programs

---

## MCP Server Usage

### codegraph
- Use for: Code analysis, dependency tracking, complexity measurement
- Key queries: `find_callers`, `find_callees`, `find_most_complex_functions`, `execute_cypher_query`

### ctxo
- Use for: Logic slicing, blast radius analysis, architecture understanding
- Key queries: `get_logic_slice`, `get_blast_radius`, `get_architectural_overlay`

### memory
- Use for: Persistent learning, context retention across sessions
- Store: Project goals, architectural decisions, user preferences

### github
- Use for: Code search, PR management, issue tracking

### filesystem
- Use for: Project file access and manipulation

### git
- Use for: Version control operations

### brave-search
- Use for: Web search and research

### logicstamp
- Use for: Deterministic architectural context and contract analysis

---

## Branch Independence

This context is **branch-agnostic**. All branches share:
- Same product positioning (simulation platform for research)
- Same core architecture (simulator → ML → evaluation)
- Same policy rules (MSRUAS SGPA/CGPA, backlog credit-based)
- Same documentation structure (MASTER_ROADMAP, POSITIONING)
- Same development guidelines

### Branch-Specific Context

**main** (Production-like serving)
- Purpose: Production-like role workflows for faculty, demo workflows
- Stability: Highest; merged after thorough testing
- ML status: Logistic regression baseline only (tree models gated)
- Demo program: BTech CSE Mathematics & Computing 2023 (hardcoded)
- Deployment: Railway backend, GitHub Pages frontend

**sota-research-2026-05-26** (Current branch)
- Purpose: SOTA (State of the Art) ML hardening and experimentation
- ML status: XGBoost/LightGBM/CatBoost challengers, tree bridge scoring, calibration gates
- Key additions: `generate_v2_data.py` (Python simulator), `validate_synthetic_quality.py` (quality harness)
- Tree bridge: Double-gated via `AIRMENTOR_ENABLE_TREE_BRIDGE_SERVING=1` and `AIRMENTOR_ALLOW_TREE_PROXY_EXPLANATIONS=1`
- Deployment: NOT wired into serving until governed gates pass
- Untracked files: Several Python scripts and hardening docs (intentionally untracked during research)

**catboost-honest-gates-2026-05-24**
- Purpose: CatBoost model integration with honest calibration gates
- Key achievement: Ranking exception gate (AUC gain > 0.05 allows calibration tolerance 0.03)
- ML status: XGBoost overallCourseRisk selected (AUC 0.9212 vs baseline 0.8493)
- Safety: Python tree scoring bridge with silent fallback to logistic model
- Status: Historical branch; work merged into main and sota-research

**p6a-program-template-contract-2026-05-12**
- Purpose: Program template contract validation
- Focus: Multi-program scalability proof (Tier 4 goal)
- Status: Historical branch; work informs P4 recalibration experiment

**subagent-* branches** (Temporary)
- Purpose: Subagent task isolation for parallel agent workflows
- Lifecycle: Short-lived, deleted after task completion
- Examples: Data-Seeding-Validator, Intervention-Queue-Auditor, ML-Risk-Analyst, Role-View-Auditor, UI-UX-Inspector
- Note: These are ephemeral and should not be used for long-term work

When switching branches, assume this context remains valid unless explicitly overridden by branch-specific documentation.

---

## Documentation Disclaimer

**Warning:** Documentation in `docs/` may be outdated. Always verify current implementation against:
- Actual code in `air-mentor-api/src/lib/` and `src/`
- Current branch state
- Recent git commits
- Live system behavior

**Key Documentation Files:**
- `docs/MASTER_ROADMAP_2026-05-01.md` - Single source of truth for outstanding work (may be outdated)
- `docs/POSITIONING.md` - Product positioning (3 options, recommended A)
- `docs/SOTA_HANDOFF.md` - Complete SOTA branch handoff (branch-specific)
- `docs/CAPABILITY_MATRIX.md` - Feature statuses, evidences, gaps (may be outdated)

**Before relying on any documentation:**
1. Check last modified date
2. Verify against current codebase
3. Test assumptions in a safe environment
4. Flag discrepancies for update

---

## Verification Checklist

Before claiming any feature works, verify:
- [ ] TypeScript compilation passes (`npx tsc -p tsconfig.app.json --noEmit`)
- [ ] Backend compilation passes (`npx tsc -p air-mentor-api/tsconfig.json --noEmit`)
- [ ] Unit tests pass (`npm test -- --run <relevant test>`)
- [ ] Integration tests pass (if applicable)
- [ ] Manual smoke test in UI
- [ ] Documentation matches implementation
- [ ] No console errors in browser
- [ ] No backend errors in logs
- [ ] Proof Control Button works
- [ ] Queue population works
- [ ] Intervention application works
- [ ] Risk score changes are realistic
