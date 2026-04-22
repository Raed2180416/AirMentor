# AirMentor fresh-Sem1 demo script checklist

**Intent reference:** `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` §L (Flows 1–11), §P.8 "Final demo script checklist: exact steps to show the product convincingly", §A (Mission).
**Scope:** everything a viewer needs to see between "fresh blank state" and "semester-6 completion w/ analytics."
**Status:** draft — flow gates are as-intended (§L); implementation gates mark which DAG phase owns the underlying capability. Items marked ❌ cannot run today because their owning phase hasn't landed. Items marked ⚠ run but a known bug degrades the demo signal.

---

## 0. Pre-demo setup (5 min, before audience)

| step | check | owner | gate |
|---|---|---|---|
| 0.1 | `pnpm --filter @air-mentor/api db:reset` (fresh DB) | sysadmin | always works |
| 0.2 | `pnpm dev` — api + ui both up, no log errors | sysadmin | always works |
| 0.3 | Browser profile clear / incognito (no cached auth) | demo driver | manual |
| 0.4 | `AIRMENTOR_PROOF_MODE=1` env set in api process | sysadmin | check via `/api/health` |
| 0.5 | Calendar source = **simulated date**, not browser date. Confirm by setting laptop clock +7 days → UI shows unchanged sim date | sysadmin | intent §D.5 — ⚠ Phase 4 owns; verify per run |
| 0.6 | Deterministic seed: `AIRMENTOR_PROOF_RUN_SEED=4141` (fresh-Sem1 canonical) | sysadmin | always |

**Pre-check that avoids a wasted demo run** — open `/api/proof/health` and confirm:
- `activeSemester: null` AND `activeStage: null` (fresh, not sem6 bootstrap) → ❌ Phase 1 (t50) gates this
- `simulatedDate: null`, `stageBoundariesValid: true`
- `proofRisk.activeArtifactVersion` present (v7 or newer)

---

## 1. FLOW 1 — Fresh start (intent §L.F1) — 3 min

| step | action | expected UI | gate |
|---|---|---|---|
| 1.1 | Sysadmin panel → Launch Proof → "MSRUAS BTech Math+Computing 2023, 2 sections" | confirmation with `Semester 1 / pre-TT1`, start date `2023-08-18` | ❌ Phase 1 (t50) |
| 1.2 | Click **Activate** | teacher credentials provisioned; sim date = `2023-08-18` | ❌ Phase 1 |
| 1.3 | Switch to teacher portfolio (use provisioned creds) | dashboard loads | ❌ Phase 3 |
| 1.4 | Open **Risk Watch** | all 60 students × 2 sections visible; no actionable queue items | ❌ Phase 3 — §C.1 watch-only pre-TT1 |
| 1.5 | Verify **no fake history**: Student → view → transcript | empty prior semesters; CGPA / backlog shown as "—" (not 0) | ❌ Phase 2 (t51) — §G.4 no silent-zero-collapse |
| 1.6 | Click **Queue** tab | 0 system-generated cases; message "no actionable cases yet in Semester 1 pre-TT1" | ❌ Phase 3 |
| 1.7 | Click **Assessment** tab | all assessment surfaces visible but editors locked with "available from pre-TT1 onwards" explanation | ❌ Phase 3 — §D.3 visibility ≠ editability |

**Signal to audience:** "this is a genuinely blank semester 1. no seeded history, no auto-opened cases. student state shown explicitly as unknown, not zero."

---

## 2. FLOW 2 — Early evidence reaction (intent §L.F2) — 3 min

| step | action | expected | gate |
|---|---|---|---|
| 2.1 | Teacher → Quiz entry → enter a quiz-1 for CS101 section A (e.g. 20 students, scores mid-range 60-80) | submit accepted | ❌ Phase 2 (t51) — §B.13 immediate effect |
| 2.2 | **Immediately** return to Risk Watch | risk scores for those 20 students updated THIS RENDER (no refresh); evidence chip shows "quiz-1: entered" | ❌ Phase 2 + immediate-rescore path |
| 2.3 | Student with score 55 (lowest) — click through → feature panel | shows `quizPct=55`, `quizMissing=false`, no other fake values | ❌ Phase 2 |
| 2.4 | Head of student with null scores (not entered yet) — click through | shows `quizPct=null`, `quizMissing=true` (new flag from F4 commit 66691b3c) — risk stays in mid band, not penalized as "failed quiz" | ⚠ F4 shipped but demo pipeline must load v8-with-missingness-flags |
| 2.5 | Return to Queue | still no system-generated cases (watch-only); verify Risk Watch banding did shift | ❌ Phase 3 |

**Signal to audience:** "evidence entered → risk responds in that render. missing is not zero. watch semantics preserved."

---

## 3. FLOW 3 — Manual concern + workflow separation (§L.F3, §C.3, §C.4) — 2 min

| step | action | expected | gate |
|---|---|---|---|
| 3.1 | Teacher → Risk Watch → pick low-attendance student → "Create concern" → concernFamily=attendance-risk, action=attendance_warning | concern opens | ❌ Phase 3 (t52) |
| 3.2 | Queue → "My cases" | 1 row visible; badge "manual"; assigned to the teacher | ❌ Phase 3 |
| 3.3 | Analytics preview → "interventions this stage" | counter: 1 (manual concern counts as intervention per §C.4) | ❌ Phase 3 |
| 3.4 | Queue → workflow tasks tab | separate list; 0 rows; **does not** count toward the 1 in step 3.3 — canonical counting per §C.7 | ❌ Phase 3 |

**Signal:** "manual concerns count as interventions; approval/unlock workflow tasks do NOT pollute primary student counts."

---

## 4. FLOW 4 — Calendar bridge (§L.F4, §D.5) — 3 min

| step | action | expected | gate |
|---|---|---|---|
| 4.1 | Queue → the manual concern from flow 3 → schedule follow-up at sim-date + 5 days | success; "Scheduled for 2023-08-23" on card | ❌ Phase 4 (t53) |
| 4.2 | Open Calendar | card visible on 2023-08-23; sim-date marker at 2023-08-18 | ❌ Phase 4 |
| 4.3 | Drag card to 2023-08-26 | underlying `scheduledDueAt` mutates — verify by API GET `/api/proof/queue/cases/:id` returning 2026-04-26 | ❌ Phase 4 |
| 4.4 | Sysadmin → "Next Day" ×5 | sim date crosses to 2023-08-23; calendar card becomes "due today" | ❌ Phase 5 (t54) |
| 4.5 | Sysadmin → "Next Day" ×1 | sim date 2023-08-24; calendar card becomes "overdue"; queue badge flips red | ❌ Phase 5 |

**Signal:** "queue ↔ calendar ↔ simulated date are one reality."

---

## 5. FLOW 5 — Boundary crossing by Next Day (§L.F5, §B.9) — 2 min

| step | action | expected | gate |
|---|---|---|---|
| 5.1 | From flow 4 end, Next Day × ~30 (to sim date 2023-09-29) | on the last hop, stage auto-advances to `post-tt1` — same transition pipeline as Next Stage | ❌ Phase 5 |
| 5.2 | Observe event log | one `stage-advance-entered` event fired, not duplicated; one stage-baseline-snapshot written | ❌ Phase 5 + §B.10 strictly increasing |
| 5.3 | Verify authoritative stage read from `simulation_runs.active_stage`, not derived from evidence count | `/api/proof/run/:id` returns `{activeStage: 'post-tt1'}` | ❌ Phase 1 |

**Signal:** "no duplicate transitions; stage is a state machine not a guess from evidence counts."

---

## 6. FLOW 6 — Next Stage demo auto-resolution (§L.F6, §C.15) — 3 min

| step | action | expected | gate |
|---|---|---|---|
| 6.1 | Create an actionable concern (manual or let a system one auto-open in post-tt1) | concern row in queue | ❌ Phase 3 |
| 6.2 | Leave it unresolved. Sysadmin → "Next Stage" | in demo mode, concern auto-resolves; intervention-response scoring fires; next-stage seeded evidence reflects response profile | ❌ Phase 5 + Phase 11 (t56) |
| 6.3 | Verify concern state = "handled (auto-resolved)" with metadata showing which default action applied (mapped deterministically from concernFamily) | not "dismissed"; §C.17 = "dismissal = handled" | ❌ Phase 3 |
| 6.4 | Student's post-TT2 projected trajectory shows a **bounded deterministic delta** (not random) vs the no-action trajectory | per-student delta reproducible across re-run | ❌ Phase 11 + §H deterministic hashing |

**Signal:** "demo mode auto-closes loose ends without losing intervention accounting; same seed + same actions → same deltas."

---

## 7. FLOW 7 — Sem2 pre-TT1 actionable logic (§L.F7, §C.1) — 2 min

| step | action | expected | gate |
|---|---|---|---|
| 7.1 | Advance run to end of Sem1 (post-SEE) via Next Stage ×4 | stage = post-see; Sem1 SEE marks populated | ❌ Phase 5 |
| 7.2 | Next Stage → Sem 2 pre-TT1 | now **actionable** (differs from Sem 1 pre-TT1 watch-only) because prior-semester performance is a legitimate input | ❌ Phase 3 — asymmetry |
| 7.3 | Queue shows 2-5 auto-opened cases on students whose Sem1 trajectory was weak | concerns have `concernFamily` populated; owner = Mentor (not HOD) per §C.8 | ❌ Phase 3 |

**Signal:** "The same pre-TT1 stage behaves differently in Sem2 vs Sem1 — prior semester is a real input."

---

## 8. FLOW 8 — Reopen later deterioration (§L.F8, §C.18) — 2 min

| step | action | expected | gate |
|---|---|---|---|
| 8.1 | In Sem 2, take an actionable case, mark resolved/handled | case closed | ❌ Phase 3 |
| 8.2 | Next Stage → deteriorate the same student via seeded trajectory | a **new** case opens with a new case ID; old case stays closed (not resurrected) | ❌ Phase 3 + §C.2 concernContextKey |
| 8.3 | Analytics view of the student | timeline shows 2 distinct concern episodes for this semester | ❌ Phase 3 |

**Signal:** "each deterioration gets its own episode. no in-place resurrection."

---

## 9. FLOW 9 — HOD correction cycle (§L.F9, §C.8, §D.6) — 3 min

| step | action | expected | gate |
|---|---|---|---|
| 9.1 | In Sem 2 post-TT1, teacher requests edit on a TT1 mark (post-lock) | approval-request raised in HOD workflow | ❌ Phase 6 (t55) |
| 9.2 | Switch to HOD creds → workflow tab | approval-request visible; NOT in primary-case queue per §C.4 | ❌ Phase 6 + §C.4/§C.7 |
| 9.3 | HOD approves | workflow transitions: `approved → reset & unlock → editor re-opened` | ❌ Phase 6 full state machine |
| 9.4 | Teacher edits the mark, saves | risk recomputes for that student; `overallCourseRisk` updates in UI | ❌ Phase 2 + Phase 6 |
| 9.5 | HOD clicks relock → edit window closes | state machine final transition | ❌ Phase 6 |

**Signal:** "approval is not the edit. it's a state machine that reopens the editor, captures edit, relocks."

---

## 10. FLOW 10 — Completion + final analytics (§L.F10) — 4 min

| step | action | expected | gate |
|---|---|---|---|
| 10.1 | Advance run through to Sem 6 post-SEE (~via rapid Next Stage) | state = `completed-inspectable` (not `stopped`) per §C.22 | ❌ Phase 5 |
| 10.2 | Teacher can still log in, view histories, action timelines | inspectable but immutable | ❌ Phase 5 |
| 10.3 | Sysadmin → "Final analytics" quick panel | opens Sem6 analytics page | ❌ Phase 11 (t56) |
| 10.4 | Analytics shows projected with-intervention vs without-intervention | page labels use `projected` / `simulated` / `counterfactual`, **never** implies learned causal uplift per §C.13 | ❌ Phase 11 |
| 10.5 | The "without intervention" branch is **simulator-generated**, not a fixed-penalty replay per §G.6 | verified by inspecting analytics JSON export showing sim-branch-id references | ❌ Phase 11 |
| 10.6 | Manual interventions and HOD workflow items are separated in a breakdown panel per §C.7 | two distinct panels, with notes explaining the distinction | ❌ Phase 11 |

**Signal:** "honest counterfactual via sim branch, not arithmetic. workflow tasks kept out of student-facing counts."

---

## 11. FLOW 11 — Stop (§L.F11) — 1 min

| step | action | expected | gate |
|---|---|---|---|
| 11.1 | Sysadmin → Stop Simulation | confirmation dialog | ❌ Phase 5 |
| 11.2 | After confirm: teacher sessions invalidated, credentials deleted | teacher login page returns 401 for old creds | ❌ Phase 5 |
| 11.3 | Analytics still accessible to sysadmin (completed-inspectable retained at sim level; only teacher access removed) | per §C.22 contract | ❌ Phase 5 |

**Signal:** "Stop ends proof access. does not archive analytics."

---

## 12. ML validation moment (not in §L flows; my addition per RCA appendix)

This is the single demo step that proves the model is promotable:

| step | action | expected | gate |
|---|---|---|---|
| 12.1 | Sysadmin → "ML diagnostics" panel on a running Sem3 post-TT1 run | table with per-stage overload, per-head AUC, local-ECE @ 0.4 / 0.85 | ❌ Phase 12 (new, not in DAG) |
| 12.2 | Sysadmin → "Show hypothesis test"| side-by-side v7 (old) vs v8 (new) on exact same cov-24 corpus with: overload ≤ 1.00 (per-cell), AUC ≥ 0.7894, local-ECE @ 0.85 ≤ 0.02 | ❌ depends on phases 7, 9, 10 |
| 12.3 | Sysadmin → "Reproducibility proof" | sha256 digest of artifact bundle reproduces bytewise from `AIRMENTOR_PROOF_RUN_SEED` | ❌ Phase 7 replay path |

**Signal for technical audience:** "determinism is real; the promotion gate is passed."

---

## Gating summary — what's required for each flow to run today

| flow | blocking phase | status |
|---|---|---|
| 1 fresh start | Phase 1 t50 | ❌ pending |
| 2 early evidence | Phase 2 t51 | ❌ pending (F4/F9 in proof-risk-model shipped but evidence write-path untouched) |
| 3 manual concern | Phase 3 t52 | ❌ pending |
| 4 calendar bridge | Phase 4 t53 | ❌ pending |
| 5 next day boundary | Phase 5 t54 + Phase 1 t50 | ❌ pending |
| 6 auto-resolve | Phase 5 + Phase 11 | ❌ pending |
| 7 Sem2 pre-TT1 | Phase 3 + §C.1 asymmetry | ❌ pending |
| 8 reopen deterioration | Phase 3 | ❌ pending |
| 9 HOD cycle | Phase 6 t55 | ❌ pending |
| 10 completion | Phase 5 + Phase 11 t56 | ❌ pending |
| 11 stop | Phase 5 | ❌ pending |
| 12 ML diagnostics | Phase 12 new | partial (eval fixes F1–F6, F15 shipped today) |

---

## "Partial demo" subset — what IS ready today (pre-phases)

What an audience can see today, with no phase code landed:
- 0.1-0.2: DB reset + service bring-up
- 12.1 (if we wire a small CLI): `pnpm tsx air-mentor-api/scripts/evaluate-proof-risk-model.ts --profile coverage-24` — produces a JSON + MD with new local-ECE @ 0.4 / 0.85, overload per-stage/semester/family, seed-hygiene guard
- `scripts/verify-calibration-fixes.ts` — fast PASS/FAIL on F1/F2/F6

That's it. The rest of the demo is phase-gated.

## Demo rehearsal schedule

| phase land time | demo steps unlocked |
|---|---|
| Phase 1 t50 lands | 0.4, 1.1-1.2, 5.3 (authority reads) |
| Phase 2 t51 lands | 1.5-1.7, 2.1-2.5 (evidence+missingness) |
| Phase 3 t52 lands | 1.3-1.7, 3.1-3.4, 6.1-6.3, 7.1-7.3, 8.1-8.3 (queue+cases+workflow) |
| Phase 4 t53 lands | 4.1-4.3 (calendar bridge) |
| Phase 5 t54 lands | 4.4-4.5, 5.1-5.3, 6.1-6.4, 10.1-10.3, 11.1-11.3 (transitions) |
| Phase 6 t55 lands | 9.1-9.5 (HOD cycle) |
| Phase 11 t56 lands | 6.4, 10.4-10.6 (counterfactual) |
| Phase 12 (new) | 12.1-12.3 (ML diagnostics proof) |

Rehearse each flow **in isolation** as its phase lands, then run the full flow sequence once all phases have landed and no phase has regressed via cross-phase integration tests.

---

*Checklist authored before phases have landed so the product gates are visible. Each checklist step is falsifiable: if demo doesn't show the expected behavior, the owning phase has a bug. Not a substitute for phase-implementation tests (unit/API/browser/replay); this is the outer-most "product truth" layer.*
