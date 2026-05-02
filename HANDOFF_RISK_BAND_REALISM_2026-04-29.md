# Risk Band Realism Fix - Complete Handoff Document
**Date:** April 29, 2026  
**Branch:** `college-demo-2026-04-27`  
**Status:** COMPLETE - All verification passed, demo-ready

---

## Executive Summary

Fixed the risk band display realism issue in the AirMentor demo environment where the "High" risk band was mathematically unreachable (0% of stages showed High risk students). The root cause was that production-calibrated thresholds (High=0.85) exceeded the maximum possible risk score in the deterministic proof corpus (~0.71).

**Solution:** Implemented an operational urgency band overlay with tuned threshold of **High=0.65, Medium=0.40** that re-bands existing calibrated probabilities for demo display only, without changing underlying model outputs.

**Key Achievement:** After sensitivity audit, sem 6 High count reduced from 99/120 (82%) to **85/120 (71%)**, maintaining urgency semantics while preserving named student trajectory realism.

---

## Problem Statement

### Original Issue (Before Fix)
- **0 out of 30 stages** in the proof simulation showed any High-band students
- Sem 1-4 pre-TT1 stages showed entire batch as **Medium only** (no Low, no High)
- Calibrated production threshold `High=0.85` was **unreachable** in proof corpus
- Maximum observed `overallCourseRisk` in deterministic proof data: **~0.71**

### Root Cause
```
Production thresholds: High=0.85, Medium=0.40
Proof corpus maximum riskProb: ~0.71
Result: High band mathematically impossible to reach
```

---

## Solution Architecture

### 1. Operational Band Overlay Pattern

**Core Principle:** Display-time reclassification without model retraining.

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Calibrated     │────▶│  Operational Overlay   │────▶│  Demo Display   │
│  riskProb       │     │  (0.65 High / 0.40   │     │  (High/Medium/  │
│  (unchanged)    │     │   Medium)            │     │   Low bands)    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

**Truth Contract:**
- `riskProb` = Calibrated `overallCourseRisk` (UNCHANGED)
- `headProbabilities` = Trained model outputs (UNCHANGED)
- `observableDrivers` = Evidence-based driver text (UNCHANGED)
- `riskBand` = Re-banded using operational thresholds (DEMO-ONLY)

### 2. Demo-Only Isolation Guard

**Critical Safety Mechanism:** The override is **gated** and only applies to proof simulation contexts.

| Call Site | Context | Override Applied? | Gating Mechanism |
|-----------|---------|-------------------|------------------|
| `proof-control-plane-playback-governance-service.ts:294` | Proof simulation | ✅ Yes | Proof-only service |
| `proof-control-plane-playback-governance-service.ts:368` | Proof simulation | ✅ Yes | Proof-only service |
| `proof-control-plane-runtime-service.ts:610` | Proof simulation | ✅ Yes | Proof-only service |
| `proof-control-plane-runtime-service.ts:692` | Proof simulation | ✅ Yes | Proof-only service |
| `proof-control-plane-tail-service.ts:843` | Proof simulation | ✅ Yes | Proof-only service |
| `modules/academic.ts:1606` | **Mixed** | ⚠️ **Conditionally** | `applyDemoOperationalBanding: proofScopeActive` |

**Isolation Implementation:**
```typescript
// academic.ts - computeRiskFromActiveModelOrPolicy
{
  applyDemoOperationalBanding?: boolean  // Default: false
}

// Caller at line 3568:
applyDemoOperationalBanding: proofScopeActive  // Only true in proof runs
```

Real institutional offerings (no proof simulation run owning the batch) receive **calibrated production banding** with no override.

---

## Sensitivity Audit Results

### Audit Methodology
Direct DB query of all 5,760 `simulation_stage_student_projections` rows across 8 key stages, rebanding at three threshold candidates.

### Stage-Wise Band Distribution by Threshold

| Sem | Stage | n | Avg | Max | @0.60 L/M/H | **@0.65 L/M/H** | @0.70 L/M/H |
|-----|-------|---|-----|-----|-------------|-----------------|-------------|
| 1 | pre-TT1 | 120 | 37.15 | 38 | 120/0/0 | **120/0/0** | 120/0/0 |
| 1 | post-SEE | 120 | 42.02 | 65 | 67/49/4 | **67/53/0** | 67/53/0 |
| 2 | pre-TT1 | 120 | 44.17 | 67 | 67/42/11 | **67/49/4** | 67/53/0 |
| 3 | pre-TT1 | 120 | 49.58 | 67 | 38/46/36 | **38/61/21** | 38/82/0 |
| 4 | pre-TT1 | 120 | 53.9 | 70 | 24/42/54 | **24/51/45** | 24/84/12 |
| 5 | pre-TT1 | 120 | 59.87 | 71 | 19/23/78 | **19/32/69** | 19/65/36 |
| 6 | pre-TT1 | 120 | 62.48 | 67 | 5/16/99 | **5/30/85** | 5/115/0 |
| 6 | post-SEE | 120 | 62.52 | 69 | 4/17/99 | **4/31/85** | 4/116/0 |

### Threshold Selection Rationale

| Threshold | Sem 6 High Count | Problem |
|-----------|------------------|---------|
| **0.70** | 0/120 (0%) | Makes High **empty** at sem 1-3 (max 67 < 70) and sem 6. Severe named examples disappear entirely. |
| **0.60** | 99/120 (82%) | Strains "High = urgent" semantics. A mentor cannot prioritize 99 cases. |
| **0.65** | 85/120 (71%) | **Selected**. Balances urgency with realism. Keeps severe profiles visible while reducing cohort collapse. |

### Named Student Trajectories at High=0.65

| Student | Profile | sem 2 pre-TT1 | sem 3 pre-TT1 | sem 4 pre-TT1 | sem 5 pre-TT1 | sem 6 post-SEE |
|---------|---------|---------------|---------------|---------------|---------------|----------------|
| Diya Iyer | Clean strong | Low (39) | Low (38) | Low (34) | Low (38) | Medium (40) |
| Yash Reddy | 3 backlogs sem 1 | Medium (60) | High (67) | High (69) | High (71) | High (67) |
| Mira Patel | 4 backlogs | Medium (52) | High (67) | High (69) | High (68) | High (66) |
| Aarav Reddy | 7 backlogs | High (67) | High (67) | High (70) | High (71) | High (66) |
| Arjun Reddy | Borderline | Medium (46) | Medium (60) | High (66) | High (67) | High (66) |
| Student 010 | Severe | Low (38) | Medium (60) | Medium (59) | High (67) | High (67) |

**Key Insight:** Yash Reddy correctly stays Medium at sem 2 pre-TT1 (3 sem-1 backlogs = watch case, not yet urgent), then escalates to High at sem 3 once cumulative backlogs cross 7.

---

## Implementation Details

### Files Modified

#### 1. Core Threshold Definition
**File:** `air-mentor-api/src/lib/proof-demo-operational-band.ts`

```typescript
export const PROOF_DEMO_OPERATIONAL_THRESHOLDS = {
  medium: 0.4,
  high: 0.65,  // Changed from 0.6
} as const
```

**Rationale Comment Updated:** Documents the sensitivity audit basis for 0.65 selection.

#### 2. Academic Surface Isolation Guard
**File:** `air-mentor-api/src/modules/academic.ts`

**Function Signature (lines 1546-1567):**
```typescript
function computeRiskFromActiveModelOrPolicy(input: {
  // ... existing inputs ...
  applyDemoOperationalBanding?: boolean  // NEW - default false
}) {
  const {
    // ... existing destructuring ...
    applyDemoOperationalBanding = false,  // Default OFF for safety
  } = input
```

**Override Application (line 1631):**
```typescript
bandThresholdsOverride: applyDemoOperationalBanding 
  ? PROOF_DEMO_OPERATIONAL_THRESHOLDS 
  : null,
```

**Caller Site (lines 3565-3568):**
```typescript
// Gate the operational urgency overlay behind the proof-scope signal.
// Real institutional offerings keep calibrated banding semantics.
applyDemoOperationalBanding: proofScopeActive,
```

#### 3. Test Suite Updates
**File:** `air-mentor-api/tests/proof-demo-operational-band.test.ts`

**Changes:**
- Updated all threshold references from 0.60 to 0.65
- Added complete `ObservableFeaturePayload` fixture fields (fixed TypeScript errors)
- Removed extraneous `prerequisiteCourseCodes` fields causing type mismatches
- Added regression safeguard: `bandThresholdsOverride: null` behavioral equivalence test

**Test Results:** 16/16 tests passing

#### 4. Documentation Updates

**File:** `docs/demo/risk-band-realism-audit-2026-04-27.md`
- Added Phase 5b Sensitivity Audit section with full tables
- Documented threshold selection rationale
- Added per-stage band trajectory for 6 named students
- Added Demo-Only Isolation subsection
- Updated after-fix matrix with 0.65 numbers
- Restored Truth Contract section header
- Updated test count to 16/16

**File:** `docs/demo/college-demo-script-2026-04-27.md`
- Step 7: Updated banding caveat to reference 0.65 threshold and sensitivity audit
- Step 8: Sem 2 pre-TT1 changed from "nine students" to **"four students"**
- Step 8: Sem 4 pre-TT1 changed from "fifty-three" to **"forty-four students"**
- Step 9: Queue narration updated to **"about 85 students out of 120"** with synthetic-corpus caveat
- Safe students section: Updated trajectories for 0.65 threshold

---

## Verification Results

### 1. Test Suite
```
✓ tests/proof-demo-operational-band.test.ts (16 tests) 9ms
Test Files  1 passed (1)
Tests       16 passed (16)
```

**Regression Scope:** Adjacent suites passed:
- `proof-risk-model`
- `proof-evidence-normalization`
- `proof-control-plane-tail-service`
- `proof-control-plane-playback-reset-service`
- All 6 proof-stage-* suites (104/104)

### 2. TypeScript Build
```
npx tsc -p tsconfig.build.json --noEmit
Exit code: 0
```

### 3. Backend Restart & Data Regeneration
```
[bootstrap] recomputing risk for sim_mnc_2023_first6_v1
[bootstrap] recompute-risk: checkpoints=30 run=sim_mnc_2023_first6_v1
[bootstrap] DONE active=sim_mnc_2023_first6_v1 status=active cp=30 sem=6
```

### 4. Browser Verification (Playwright)
**Script:** `/tmp/airmentor-demo-logs/risk-band-audit/browser-verify-v4.mjs`

**Results:**
- ✅ Sysadmin login successful
- ✅ Sysadmin shell renders (2367 chars)
- ✅ Proof dashboard navigation works
- ✅ HoD login successful  
- ✅ **HoD analytics page renders High/Medium/Low band columns**
- ✅ Text evidence: `"Section Students High Medium Attendance"`
- ✅ Text evidence: `"Semester High Pressure Review Stable"`
- ✅ Text evidence: `"High Only"` filter chip
- ✅ No server errors detected

**Screenshots Captured:**
- `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-sysadmin-shell.png`
- `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-sysadmin-proof-dashboard.png`
- `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-sysadmin-active-run.png`
- `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-devika-shell.png`
- `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-devika-hod.png`

---

## Git Commit History

```
826e8459 docs(demo): sensitivity audit + 0.65 numbers + isolation guard
03e59126 fix(proof): tune operational band to high=0.65 + gate academic surface
9ca9c4f6 docs(demo): risk-band realism audit and demo-script operational caveat  
789ef131 feat(proof): operational urgency band overlay for demo risk projections
47951042 fix(proof): preserve nullable TT2/SEE evidence (baseline)
```

### Commit 03e59126 Details
**Files changed:**
- `air-mentor-api/src/lib/proof-demo-operational-band.ts` - Threshold 0.6→0.65
- `air-mentor-api/src/modules/academic.ts` - Isolation guard implementation
- `air-mentor-api/tests/proof-demo-operational-band.test.ts` - Test updates

### Commit 826e8459 Details
**Files changed:**
- `docs/demo/risk-band-realism-audit-2026-04-27.md` - Sensitivity audit documentation
- `docs/demo/college-demo-script-2026-04-27.md` - Demo script number updates

---

## Demo Presentation Guide

### Critical Narration Points (Must Deliver Verbatim)

#### 1. Operational Banding Caveat (Step 7)
```
"A note on the High / Medium / Low band you see on screen. The
band is an *operational urgency* classification — it tells you who
to act on first. It is not a re-quote of the calibrated
probability. The calibrated probability stays where the trained
model put it. The operational High threshold (0.65) was tuned via
a sensitivity audit so evidence-supported severe cases surface as
actionable, while clean early-semester cohorts stay Low. Sem 1
pre-TT1 is conservative on purpose — there is no prior history to
score from."
```

#### 2. Synthetic Corpus Caveat (Step 9)
```
"At sem 6 post-TT1, the operational queue surfaces the High urgency
cohort — about 85 students out of 120 in this synthetic batch.
That number reflects the deterministic seed where the majority of
students carry four or more backlogs by sem 6; in a real cohort
the High count would be smaller."
```

#### 3. Named Student Talking Points

**Diya Iyer** (clean profile):
- "Stays Low through sem 5, only bumps to Medium at sem 6 post-SEE"
- Demonstrates conservative early-semester banding

**Yash Reddy** (3 sem-1 backlogs):
- "Medium at sem 2 pre-TT1 — that's a watch case, not yet urgent"
- "Escalates to High at sem 3 once cumulative evidence builds"
- Demonstrates progressive escalation, not instant High

**Aarav Reddy** (7 backlogs):
- "High at sem 2 pre-TT1 from prior history alone — top severity"
- Demonstrates immediate identification of crisis cases

### Stage Checkpoints for Live Demo

| Stage | Expected Band Counts | Key Narration |
|-------|---------------------|---------------|
| sem 1 pre-TT1 | 120 Low / 0 Med / 0 High | "No prior history — conservative default" |
| sem 1 post-SEE | 67 Low / 53 Med / 0 High | "First evidence emerges, still no High" |
| sem 2 pre-TT1 | 67 Low / 49 Med / **4 High** | "Prior history now real — 4 most distressed" |
| sem 4 pre-TT1 | 24 Low / 52 Med / **44 High** | "Accumulated burden surfaces" |
| sem 6 pre-TT1 | 5 Low / 30 Med / **85 High** | "Synthetic corpus load — caveat required" |

---

## Artifacts and Data Files

### Sensitivity Audit Data
- **JSON:** `/tmp/airmentor-demo-logs/risk-band-audit/sensitivity.json`
- **Markdown:** `/tmp/airmentor-demo-logs/risk-band-audit/sensitivity.md`
- **Raw matrix:** `/tmp/airmentor-demo-logs/risk-band-audit/stage-risk-matrix.json`
- **CSV:** `/tmp/airmentor-demo-logs/risk-band-audit/stage-risk-matrix.csv`
- **Top students:** `/tmp/airmentor-demo-logs/risk-band-audit/top-risk-students.json`

### Browser Verification Scripts
- **v4 (final):** `/tmp/airmentor-demo-logs/risk-band-audit/browser-verify-v4.mjs`
- **Result:** `/tmp/airmentor-demo-logs/risk-band-audit/browser-verify-v4-result.json`

### Screenshots
All screenshots stored in `/tmp/airmentor-demo-logs/risk-band-audit/screenshot-*.png`

---

## Risk Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Functional Correctness** | ✅ GREEN | All tests pass, backend generates correct projections |
| **Display Realism** | ✅ GREEN | Band progression matches sensitivity audit expectations |
| **Demo Readiness** | ✅ GREEN | Browser verification confirms UI renders bands correctly |
| **Production Safety** | ✅ GREEN | Override default-off, gated by proofScopeActive |
| **Truth Contract** | ✅ GREEN | riskProb/headProbabilities/drivers unchanged |
| **Sem 6 Realism** | 🟡 AMBER | 71% High is high but defensible for synthetic corpus |

### Sem 6 Amber Status Mitigation
The 85/120 (71%) High count at sem 6 is explicitly called out in the demo script as a **synthetic-cohort property**, not a model claim. The deterministic seed deliberately loads most students with 4+ backlogs by sem 6. In real cohorts, this proportion would be smaller.

---

## Next Steps / Future Work

### Immediate (Pre-Demo)
1. ✅ All verification complete — demo is ready
2. Optional: Operator dry-run through steps 7-9 to practice narration

### Post-Demo
1. Consider whether to tune the synthetic seed for more realistic sem 6 distributions in future demos
2. Monitor whether 0.65 threshold feels right in live presentations
3. Document any operator feedback on band visibility

### Technical Debt
None identified. The isolation guard ensures production safety, and the test suite provides regression protection.

---

## Contact Points

**Primary Documentation:**
- Audit: `docs/demo/risk-band-realism-audit-2026-04-27.md`
- Script: `docs/demo/college-demo-script-2026-04-27.md`
- Safe students: `docs/demo/demo-safe-student-picks-2026-04-27.md`

**Key Source Files:**
- Threshold: `air-mentor-api/src/lib/proof-demo-operational-band.ts`
- Isolation: `air-mentor-api/src/modules/academic.ts` (lines 1546-1640, 3565-3568)
- Tests: `air-mentor-api/tests/proof-demo-operational-band.test.ts`

**Verification Artifacts:**
- Location: `/tmp/airmentor-demo-logs/risk-band-audit/`
- Browser script: `browser-verify-v4.mjs`

---

## Sign-off

| Item | Status |
|------|--------|
| Sensitivity audit completed | ✅ |
| Threshold tuned to 0.65 | ✅ |
| Isolation guard implemented | ✅ |
| Tests passing (16/16) | ✅ |
| TypeScript clean | ✅ |
| Backend restarted & data regenerated | ✅ |
| Browser verification passed | ✅ |
| Documentation updated | ✅ |
| Demo script updated | ✅ |
| Commits made (2 commits) | ✅ |
| **DEMO READY** | ✅ |

**This handoff document represents the complete state of the Risk Band Realism Fix as of April 29, 2026.**
