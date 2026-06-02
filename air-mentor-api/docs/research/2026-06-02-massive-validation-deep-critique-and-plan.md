# Deep Critique & Exact Implementation Plan: Massive E2E Validation

## Current System State (as of 2026-06-02 20:10 IST)

- **Branch**: `sota-research-2026-05-26` (also aliased as `sota-temp`)
- **Backend**: Running seeded server on `http://127.0.0.1:46765`
- **Risk Model**: Logistic production family (CatBoost is shadow-only)
- **Existing validation**: `comprehensive-e2e-evaluator.ts` covers basic seeding, manual marks, SHAP, role parity, semester 3 rollback
- **Test corpus**: 120 students (`mnc_student_001` to `mnc_student_120`), 2 offerings (A: 1-60, B: 61-120)

---

## Deep Critique of Current Validation Gaps

### 1. The Existing Evaluator Is Too Shallow

The `comprehensive-e2e-evaluator.ts` validates:
- ✓ Proof run creation and materialization
- ✓ Manual mark entry for 10 students (5 low, 5 perfect)
- ✓ Manual mark preservation across stage advance
- ✓ SHAP driver population for 10 special students
- ✓ XGBoost provenance detection
- ✓ Role parity (admin vs HOD) for 5 sampled students
- ✓ Semester 3 rollback test

**What it does NOT validate** (the gaps we must fill):

| Gap | Severity | Why It Matters |
|-----|----------|--------------|
| No TT1 question/CO creation from UI | **P0** | The user explicitly wants to create questions and assign COs. This is the pedagogical backbone of the system. |
| No realistic mark distribution (80@14-20, 20@20-25, 20@0-13) | **P0** | Current evaluator only enters 5 low + 5 perfect. It doesn't test the model under realistic classroom variance. |
| No lock/unlock/modify cycle | **P0** | User explicitly wants HOD unlock, modify 3-4 students, verify risk recomputation. This tests the governance pipeline. |
| No TT2, quiz, assignment, attendance entry | **P0** | Only TT1 is tested. The model needs multi-stage evidence to be meaningful. |
| No SEE marks entry | **P0** | SEE is the terminal assessment. Without it, downstream carryover risk is meaningless. |
| No special case trajectories (cases 1-4) | **P0** | These are the core realism tests. Does the model correctly reason about student fragility? |
| No cross-semester carryover tracking | **P0** | The whole point of "downstream carryover risk" is temporal. Untested. |
| No queue/intervention validation | **P0** | Action queues and intervention effects are central to the product promise. |
| No scheme variation (2A2Q, 3A0Q, etc.) | **P1** | User wants to see how different scheme configurations affect mark collection and risk. |
| No mentor/HOD detailed view audit per student | **P1** | Role parity for 5 students is not enough. We need per-student data alignment across all roles. |
| No course leader queue pressure validation | **P1** | Queue pressure per course leader must be realistic. |
| No UI loading states verification | **P2** | User wants "3 loading dots with tagline reevaluating risk" when ML re-evaluates. |
| No per-student SHAP visibility audit | **P2** | SHAP must be visible in UI cards for at-risk students. |
| No teacher profile card with past offerings | **P2** | User explicitly asked for this. |

### 2. The ML Model Is Still Static — Validation Will Surface This

Our research shows the current logistic model is **static and brittle**:
- Trained once on 64 synthetic seeds
- No online adaptation, no Bayesian update, no test-time training
- The "balanced" seed 101 failure (100% Medium risk) will likely appear during validation if any section has a realistic low-failure-rate distribution

**Implication for validation**: We must be prepared to document that the model gives unrealistic predictions for well-performing sections, and flag this as a known research finding — not a bug to fix today.

### 3. The Synthetic Data Generator Has Known Biases

From `generate_v2_data.py` and `learning-dynamics-constants.ts`:
- `balanced` scenario applies zero shifts → students cluster at mean → very few failures
- The label engine has stage-aware realism and monotonicity enforcement (recent fixes), but it still generates deterministic labels based on latent traits
- The model training pipeline (`trainLogisticBaseCompact`) uses grouped L2 regularization which works well for extreme scenarios but fails for balanced ones

**Implication**: The validation must include both extreme and balanced distributions. We need to explicitly test whether the model adapts to different base rates — and document when it doesn't.

### 4. UI/UX Risk: Loading States, Navigation, Data Freshness

From prior memory:
- `proof-simulation-controls.tsx` has pending action labels like "Reevaluating risk... advancing to the next stage"
- But there are no explicit "3 loading dots" in the risk cards during ML re-evaluation
- The academic workspace (`src/App.tsx`) manages `schemeByOffering`, `studentPatches`, `draftBySection`, `cellValues`, `lockByOffering` with optimistic persistence — complex state machine prone to race conditions

**Implication**: During validation, we must explicitly verify that after mark entry + lock, the risk cards show updated values, and that loading states are visible.

---

## Exact Implementation Plan

### Phase 0: Environment & Foundation (0:00-0:30)
1. Start frontend dev server
2. Verify backend health and active proof run state
3. Create fresh proof run for validation (seed 20260602)
4. Ensure 120 students materialized with correct offerings

### Phase 1: Semester 1, Stage pre-TT1 → post-TT1 (0:30-2:00)
1. **Course Leader login** (rohit.menon)
2. **Scheme setup**: Configure CE/SEE split, TT1=25 marks, TT2=25 marks, choose assignment/quiz count (start with 2A2Q)
3. **TT1 Question creation**: Create questions from UI, assign COs (some questions with multiple COs)
4. **TT1 Mark entry**: Enter marks for all 120 students with realistic distribution:
   - 80 students: 14-20/25 (64-80%)
   - 20 students: 20-25/25 (80-100%)
   - 20 students: 0-13/25 (0-52%)
   - **Special cases 1-4** embedded within these 120 (10 students randomly selected)
5. **Lock TT1**
6. **Advance to post-TT1** via Proof Control
7. **Verify risk analysis**:
   - Read all 120 student projections
   - Check risk bands are realistic (not all Medium/High)
   - Verify special case students have correct directional risk
   - Check SHAP drivers are populated in risk explorer
8. **HOD unlock**: Switch to HOD, unlock TT1, modify 3-4 students
9. **Verify risk recomputation**: Check changed students show updated risk

### Phase 2: Semester 1, post-TT1 → post-TT2 (2:00-3:30)
1. Create TT2 questions with COs
2. Enter TT2 marks with realistic distribution
3. Lock, advance, verify risk

### Phase 3: Semester 1, post-TT2 → post-Quiz/Assignment (3:30-4:30)
1. Enter quiz marks (2 quizzes)
2. Enter assignment marks (2 assignments)
3. Enter attendance marks (realistic: ~25% below 75%)
4. Lock all, advance, verify risk

### Phase 4: Semester 1, post-SEE (4:30-5:30)
1. Enter SEE marks with realistic distribution
2. Lock, advance, verify final semester 1 risk
3. Verify downstream carryover risk is meaningful

### Phase 5: Intervention & Queue Validation (5:30-6:00)
1. Verify high-risk students populate action queue
2. Apply interventions to some queue items
3. Dismiss some items
4. Verify intervention effects reflect in updated risk analysis
5. Verify queue pressure per course leader is realistic

### Phase 6: Role View Audit (6:00-6:30)
1. **Course Leader view**: Verify all students, marks, risk visible
2. **Mentor view**: Verify mentee cards, risk, SHAP visible
3. **HOD view**: Verify unlock/review, queue, global risk distribution
4. **Data alignment**: Cross-check same student across all roles

### Phase 7: Semester 2-3 Continuation (6:30-8:00)
1. Advance to Semester 2
2. Repeat full cycle with scheme variation (e.g., 3A0Q)
3. Keep original 10 special-case students with consistent trajectories
4. Verify cross-semester carryover risk
5. At Semester 3, release original 10 to normal distribution
6. Select new 10 random students, apply special cases

### Phase 8: Teacher Profile & Past Offerings (8:00-8:30)
1. In HOD view, click teacher profiles
2. Verify past course offerings visible
3. Verify each semester teacher teaches new courses

### Phase 9: Scheme Variation Deep Dive (8:30-9:00)
1. In one semester, use 2A2Q
2. In another, use 3A0Q
3. In another, use 0A2Q
4. Verify mark collection UI adapts correctly
5. Verify risk analysis considers scheme differences

### Phase 10: Final Analysis & Documentation (9:00-10:00)
1. Per-student trajectory audit for all 120 students
2. Per-course stage analysis
3. Global classroom trajectory analysis
4. SHAP verification across all at-risk students
5. Queue workload analysis per course leader
6. Document all P0/P1/P2/P3 issues
7. Create final findings document

---

## Special Case Trajectory Definitions

### Case 1: The Steady Decliner
- TT1: mediocre (10-15/25)
- TT2: mediocre (10-15/25)
- Quizzes: mediocre (50-65%)
- Assignments: mediocre (50-65%)
- Attendance: mediocre (70-80%)
- SEE: mediocre (40-55%)
- **Expected risk**: Medium → High by post-SEE
- **SHAP drivers**: attendance, weak COs, coursework mismatch

### Case 2: The Recoverer
- TT1: good (20-25/25)
- TT2: mediocre (12-16/25)
- Quizzes: good (75-90%)
- Assignments: good (75-90%)
- Attendance: good (>85%)
- SEE: good (65-80%)
- **Expected risk**: Low → Medium (TT2 dip) → Low (recovery)
- **SHAP drivers**: TT2 dip as transient risk, then recovery

### Case 3: The Faller
- TT1: good (20-25/25)
- TT2: bad (5-10/25)
- Quizzes: mediocre (50-65%)
- Assignments: mediocre (50-65%)
- Attendance: mediocre (70-80%)
- SEE: mediocre (40-55%)
- **Expected risk**: Low → High (after TT2)
- **SHAP drivers**: TT2 collapse, attendance trend

### Case 4: The Attendance Risk
- TT1: bad (5-10/25)
- TT2: good (20-25/25)
- Quizzes: mediocre (50-65%)
- Assignments: mediocre (50-65%)
- Attendance: bad (<65%)
- SEE: good (65-80%)
- **Expected risk**: High (attendance floor) → Medium (TT2 recovery) → depends on SEE
- **SHAP drivers**: attendance as dominant factor

---

## Expected Model Behavior & Known Limitations

### What Should Work Today
- ✓ Basic risk banding (Low/Medium/High) based on point-in-time evidence
- ✓ SHAP driver population for students with clear risk signals
- ✓ Manual mark preservation across stage advance
- ✓ Queue population for high-risk students
- ✓ Intervention application and effect tracking
- ✓ Role-based view access control

### What Will Likely Fail (Document, Don't Fix)
- ⚠ Realistic risk distribution for balanced/well-performing sections (static model limitation)
- ⚠ Precise directional SHAP for edge cases (model is linear logistic, not EBM)
- ⚠ Adaptive thresholds per section (fixed 0.40/0.65)
- ⚠ Cross-semester carryover may be heuristic-heavy rather than model-predicted

### What We Must Verify Works
- ✓ Mark entry → lock → advance → risk update pipeline
- ✓ Unlock → modify → relock → risk update pipeline
- ✓ Question/CO creation and persistence
- ✓ Scheme variation (different quiz/assignment counts)
- ✓ Attendance entry and policy floor application
- ✓ Queue pressure calculation per course leader
- ✓ Mentor/HOD/CL data alignment for every student

---

## Parallelization Strategy

Given the size of this task, we should parallelize:

1. **Agent 1**: UI automation via Playwright (mark entry, navigation, visual verification)
2. **Agent 2**: API-level data extraction and analysis (read all 120 students, compute statistics, verify data alignment)
3. **Agent 3**: ML model analysis (risk distribution, SHAP quality, threshold realism)
4. **Agent 4**: Issue tracking and documentation (log every anomaly, classify severity)

All agents report into a shared findings document.

---

## Success Criteria

1. **Zero P0 issues**: No data loss, no mark corruption, no stage advancement failures
2. **All 120 students** have complete trajectory data across all validated stages
3. **Special case students** show directionally correct risk movement
4. **All role views** show consistent data for sampled students
5. **Queue** populates with high-risk students and interventions have observable effects
6. **SHAP** visible in UI for all at-risk students
7. **Loading states** visible during ML re-evaluation
8. **Final document** captures all findings with severity classification
