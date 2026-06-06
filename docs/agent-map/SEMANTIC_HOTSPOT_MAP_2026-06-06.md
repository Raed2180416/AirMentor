# Semantic Hotspot Map (Tree-Sitter / Codegraph Quality Index)

**Date:** 2026-06-06  
**Method:** Codegraph AST extraction (clean re-index, 952 files, 0 .worktrees duplicates)  
**Scope:** Every function in the 10 most complex files with line numbers and complexity scores

---

## How to Read This Map

- **Cyclomatic Complexity** = number of independent paths through a function
- **>50** = High risk; understand before modifying
- **>100** = Critical; never modify without impact analysis and tests
- **>300** = Extreme; should be refactored; treat as read-only for small changes

---

## Hotspot 1: `src/system-admin-live-app.tsx` — TOTAL COMPLEXITY: 1575

**File role:** System Admin live workspace — university configuration hub  
**Agent warning:** This is a MASSIVE monolithic component. Do NOT add features here. Extract instead.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `SystemAdminLiveApp` | 2011 | **1575** | Main component — contains ALL admin workspace tabs, forms, tables, modals |
| `getAuditEventRoute` | 1478 | 43 | Audit event routing logic |
| `buildValidatedPolicyPayload` | 1282 | 36 | Policy form validation |
| `AdminDetailTabs` | 1899 | 30 | Tab navigation inside detail views |
| `handleKeyDown` | 1912 | 23 | Keyboard handling for admin UI |
| `parseAdminRoute` | 569 | 19 | Route parsing for admin sub-pages |
| `routeToHash` | 591 | 17 | Route-to-hash conversion |
| `toErrorMessage` | 1226 | 16 | Error message formatting |
| `buildCurriculumFeaturePayload` | 694 | 15 | Curriculum feature payload builder |
| `formatDiagnosticSummary` | 1453 | 15 | Diagnostic summary formatter |
| `formatHeadSupportSummary` | 1435 | 13 | Head support summary |
| `validateCurriculumFeaturePrerequisites` | 742 | 14 | Prerequisite validation |
| `mergePolicyPayload` | 915 | 13 | Policy merge logic |
| `matchesBatchScope` | 1517 | 19 | Batch scope matching |
| `OperationsRail` | 1619 | 6 | Operations sidebar rail |
| `TeachingShellAdminTopBar` | 1532 | 2 | Top bar component |
| `SectionLaunchCard` | 1762 | 1 | Section launch card |
| `OverviewSupportCard` | 1808 | 1 | Support overview card |
| `ActionQueueCard` | 1844 | 1 | Action queue card |
| `AdminDetailTabPanel` | 1973 | 1 | Tab panel wrapper |
| `AdminMiniStat` | 1994 | 1 | Mini stat display |
| `safeInstitution` | 2288 | 6 | Safe institution accessor |
| `safeReminders` | 2294 | 6 | Safe reminders accessor |
| `isRouteVisible` | 3171 | 11 | Route visibility check |
| `matchesActiveSection` | 3166 | 9 | Section matching |

**Key finding:** The 1575 complexity is distributed across ~100 nested functions. The component handles: institution editing, department/branch/batch CRUD, faculty management, student enrollment, curriculum features, policy overrides, stage policies, proof run management, reminders, requests, calendar templates, and more. **This should be split into 10+ separate workspace components.**

---

## Hotspot 2: `src/App.tsx` — TOTAL COMPLEXITY: 680 (OperationalWorkspace)

**File role:** Root React app — owns ALL global state, routing, API clients, auth  
**Agent warning:** This is the second most complex file. It is the central nervous system.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `OperationalWorkspace` | 1237 | **680** | Root workspace — routing, state, modals, drawers, toasts |
| `OperationalApp` | 3774 | **142** | App wrapper — auth, storage sync, API setup |
| `TaskComposerModal` | 379 | **103** | Task creation modal |
| `StudentDrawer` | 652 | **90** | Student detail drawer |
| `ActionQueue` | 956 | **80** | Action queue display |
| `suggestTaskForStudent` | 288 | **16** | Task suggestion logic |
| `getEvidenceStageKey` | 312 | **12** | Stage key derivation |
| `load` | 4015 | **12** | Local storage hydration |
| `getRouteSnapshotKey` | 214 | **11** | Route snapshot key |
| `getScheduleMeta` | 425 | **10** | Schedule metadata |
| `PortalRouterApp` | 4422 | **14** | Router wrapper |
| `mapApiRoleToRole` | 3731 | **7** | API role mapping |
| `restrictVisibleFacultyOptions` | 3738 | **8** | Faculty option filtering |
| `handleOpenStudentShellFromHistory` | 3510 | **2** | Student shell opener |
| `handleOpenRiskExplorerFromHistory` | 3511 | **2** | Risk explorer opener |
| `syncSnapshot` | 3854 | **3** | State snapshot sync |
| `handleStorage` | 3969 | **3** | Storage event handler |

**Key finding:** `OperationalWorkspace` at 680 complexity contains: role-based routing, tab management, student drawer, action queue, task composer, notification system, API error handling, optimistic updates, local storage persistence, and more. **The state management (schemeByOffering, ttBlueprints, studentPatches, drafts, cellValues, locks) should be extracted to a proper state management layer (Zustand/Redux).**

---

## Hotspot 3: `air-mentor-api/src/modules/academic.ts` — TOTAL COMPLEXITY: 481 (buildAcademicBootstrap)

**File role:** Core academic module — student shell, proof tasks, analytics, bootstrap  
**Agent warning:** Contains both LIVE and DEMO paths intertwined.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `buildAcademicBootstrap` | 3117 | **481** | Batch provisioning — creates students, enrollments, offerings, curriculum, faculty assignments |
| `assertStudentShellScope` | 1163 | **37** | Student shell access control |
| `inferStudentFallback` | 2789 | **37** | Student fallback inference |
| `computeTranscriptAnalytics` | 1421 | **45** | Transcript analytics computation |
| `buildOfferingStageEligibility` | 2011 | **46** | Stage eligibility rules |
| `buildStudentReasons` | 1682 | **32** | Student risk reasons |
| `validateSchemeAgainstPolicy` | 1925 | **31** | Scheme validation |
| `computeStudentOutcomeAttainment` | 1602 | **28** | Outcome attainment |
| `classBlocksCanOverlap` | 2643 | **21** | Calendar overlap check |
| `validateFacultyCalendarTemplate` | 2666 | **26** | Calendar template validation |
| `resolveProofReassessmentAccess` | 2429 | **25** | Reassessment access |
| `assertViewerCanSuperviseStudent` | 2315 | **17** | Supervision access |
| `buildProofWorkflowTaskFromQueueProjection` | 1031 | **20** | Proof task builder |
| `taskDueLabelFromDate` | 1008 | **17** | Due date formatting |
| `buildAdvisoryNotes` | 1515 | **17** | Advisory notes |
| `weightedAverageNullable` | 1554 | **14** | Weighted average |
| `computeComponentAttainment` | 1622 | **13** | Component attainment |
| `sanitizeAssessmentComponentsForScheme` | 871 | **10** | Assessment sanitization |
| `sanitizeTermTestWeights` | 891 | **9** | TT weight sanitization |
| `canonicalizeSchemeState` | 908 | **11** | Scheme canonicalization |
| `mapAcademicTaskRow` | 2493 | **14** | Task row mapper |
| `resolveAcademicStageCheckpoint` | 1136 | **12** | Checkpoint resolution |
| `resolveStudentShellRun` | 1095 | **10** | Shell run resolution |
| `mapOfferingRow` | 3037 | **10** | Offering row mapper |
| `buildStudentHistoryRecord` | 2869 | **11** | History record builder |
| `buildDefaultSchemeFromPolicy` | 1328 | **11** | Default scheme builder |

**Key finding:** `buildAcademicBootstrap` at 481 complexity creates an entire university batch in one function. It should be an async job queue with stages: (1) create students, (2) create enrollments, (3) create offerings, (4) link curriculum, (5) assign faculty, (6) assign mentors.

---

## Hotspot 4: `air-mentor-api/src/lib/proof-risk-model.ts` — Core Risk Engine

**File role:** Feature schema, model serving, calibration, metrics  
**Agent warning:** This is the ML contract. Every change affects all risk heads.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `writeFeatureVectorToBuffer` | ~1900 | **98** | Feature vector serialization (v6 schema) |
| `chooseCalibration` | ~1162 | **66** | Calibration method selection |
| `buildObservableFeaturePayload` | ~1700 | **49** | Feature payload builder from runtime evidence |
| `featureVectorFromPayload` | 778 | **44** | Payload → vector conversion |
| `trainLogisticBaseCompact` | ~2100 | **39** | Logistic regression training |
| `appendRow` | ~2300 | **41** | Dataset row appender |
| `formatRiskDriverLabel` | ~2600 | **31** | Risk driver label formatter |
| `applyCalibration` | 879 | **31** | Calibration application |
| `fitVennAbersCalibration` | 1112 | **30** | Venn-Abers calibration |
| `fitIsotonicCalibration` | 1046 | **27** | Isotonic calibration |
| `fitBetaCalibration` | 1004 | **25** | Beta regression calibration |
| `scoreWithEbm` | 921 | **25** | EBM model scoring |
| `buildCandidate` | 1171 | **21** | Model candidate builder |
| `rocAuc` | 626 | **17** | AUC computation |
| `expectedCalibrationError` | 673 | **17** | ECE computation |
| `fitSigmoidCalibration` | 977 | **17** | Platt scaling |
| `supportWarningForHead` | 952 | **14** | Head-specific warnings |
| `buildReliabilityBins` | 706 | **13** | Reliability diagram bins |
| `assessmentExpectedAtStage` | 752 | **13** | Stage-based assessment expectations |
| `averagePrecision` | 653 | **12** | Average precision |
| `rankingSuppressionReasonForFallbackSourceRefs` | 540 | **12** | Source ref suppression |
| `logLoss` | 645 | **9** | Log loss |
| `safeRatio` | 596 | **10** | Safe ratio computation |
| `scoreWithTreeBridge` | ~850 | **~25** | Python tree bridge invocation |
| `displayProbabilityAllowedForHead` | 967 | **12** | Display gating |

**Key finding:** This file contains the COMPLETE ML pipeline in TypeScript: feature engineering, model training, calibration, scoring, and evaluation. The 98-complexity `writeFeatureVectorToBuffer` encodes the entire v6 feature schema (48 features). **Any feature schema change requires synchronized updates here, in Python training scripts, and in tests.**

---

## Hotspot 5: `air-mentor-api/src/modules/academic-runtime-routes.ts` — COMPLEXITY: 338

**File role:** Live assessment/attendance entry, scheme persistence, task management  
**Agent warning:** All runtime routes in one file.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `registerAcademicRuntimeRoutes` | 64 | **338** | Route registration (all runtime endpoints) |
| `persistAcademicTaskPlacement` | ~300 | **50** | Task placement persistence |
| `persistAcademicTask` | ~250 | **31** | Task persistence |

---

## Hotspot 6: `air-mentor-api/src/modules/admin-structure.ts` — COMPLEXITY: 327

**File role:** Admin CRUD for all university entities  
**Agent warning:** Monolithic admin route file.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `registerAdminStructureRoutes` | 2819 | **327** | All admin CRUD routes |
| `computeConfigImpactPreview` | ~3600 | **78** | Config change impact preview |
| `approveCurriculumLinkageCandidate` | ~3400 | **58** | Curriculum linkage approval |
| `resolveBatchCurriculumFeatures` | ~3200 | **42** | Curriculum feature resolution |
| `loadMaterializedCurriculumFeatureBundle` | ~3100 | **36** | Feature bundle loading |
| `materializeResolvedCurriculumFeatureItems` | ~3050 | **32** | Feature item materialization |

---

## Hotspot 7: `air-mentor-api/src/modules/admin-control-plane.ts` — COMPLEXITY: 251

**File role:** Proof run lifecycle management  
**Agent warning:** DEMO SCAFFOLDING.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `registerAdminControlPlaneRoutes` | 420 | **251** | Proof run CRUD routes |

---

## Hotspot 8: `src/pages/calendar-pages.tsx` — COMPLEXITY: 327

**File role:** Calendar and timetable UI  
**Agent warning:** Complex rendering logic.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `CalendarTimetablePage` | 259 | **327** | Calendar/timetable page |

---

## Hotspot 9: `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` — COMPLEXITY: 581

**File role:** HOD analytics for proof runs  
**Agent warning:** DEMO SCAFFOLDING.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `buildHodProofAnalytics` | 130 | **581** | HOD proof analytics builder |

---

## Hotspot 10: `src/obsidian-graph.tsx` — COMPLEXITY: 547

**File role:** Curriculum graph visualization  
**Agent warning:** D3 + XYFlow rendering.

| Function | Line | Complexity | Description |
|----------|------|------------|-------------|
| `ObsidianGraph` | 157 | **547** | Curriculum graph renderer |

---

## Call Graph Summary

### Critical Call Chains (any change here breaks multiple roles)

```
App.OperationalWorkspace
  → TaskComposerModal (103)
  → StudentDrawer (90)
  → ActionQueue (80)
  → OperationalApp (142)
    → load (12) — localStorage hydration
    → handleStorage (3) — cross-tab sync

SystemAdminLiveApp (1575)
  → AdminDetailTabs (30)
  → OperationsRail (6)
  → handleKeyDown (23)
  → getAuditEventRoute (43)
  → buildValidatedPolicyPayload (36)
  → handleLogin (8)
  → handleLogout (2)

academic.buildAcademicBootstrap (481)
  → mockStudentIdentity (6)
  → assertSingleActiveOfferingOwner (6)
  → assertStudentEnrolledInOffering (2)
  → assertCourseLeaderCanManageOffering (2)
  → assertViewerCanReadOffering (10)
  → assertViewerCanSuperviseStudent (17)

proof-risk-model.ts
  → featureVectorFromPayload (44)
    → writeFeatureVectorToBuffer (98)
  → scoreWithLogistic (1)
    → scoreWithLogisticRaw (3)
    → applyCalibration (31)
      → chooseCalibration (66)
  → scoreWithTreeBridge (~25)
    → spawnSync python3 tree-scoring-bridge.py
```

---

## Agent Navigation Tips

1. **Never modify `proof-risk-model.ts` without running:**
   ```bash
   npm --workspace air-mentor-api test -- --run tests/proof-risk-model.test.ts
   ```

2. **Never modify `App.tsx` without running:**
   ```bash
   npm test -- --run tests/academic-route-pages.test.tsx
   npx tsc -p tsconfig.app.json --noEmit
   ```

3. **Before touching `system-admin-live-app.tsx`, read `docs/agent-map/SECURITY_PERFORMANCE_AUDIT_2026-06-06.md` Section 2.1**

4. **Before touching `buildAcademicBootstrap`, read `docs/agent-map/PROOF_DEMO_REMOVAL_PATH.md` Section 1.1**

5. **For ANY route change, grep for the route string in BOTH frontend and backend:**
   ```bash
   rg "/api/academic/offerings" air-mentor-api/src/modules/
   rg "/api/academic/offerings" src/
   ```
