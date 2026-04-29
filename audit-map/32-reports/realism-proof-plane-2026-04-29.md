# Proof-Plane Realism Audit — 2026-04-29

## Intent And Feature Intent

吾驗六學期 proof-plane：average evaluator must see a coherent student journey, not disconnected static samples.

Feature intent:

- Six semesters must exist with five realistic stage checkpoints each.
- Sem 1 pre-TT1 must not invent prior CGPA, backlog, or future marks.
- Later semesters may use prior history only where the proof run has actually accumulated it.
- Stage risk must progress plausibly from Low to Medium/High as evidence accumulates.
- Queue and playback behavior must be explainable and not silently stale.

## Method

Evidence sources:

- Full-walk script `/tmp/airmentor-demo-logs/full-walk.mjs` drove admin login, semester activation, checkpoint detail reads, HoD endpoints, teacher logins, and recompute.
- Full-walk output `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/walk-summary.json`.
- Final dashboard `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/proof-dashboard-final.json`.
- Precision probe `/tmp/airmentor-demo-logs/realism-2026-04-29/precision/precision-summary.json`.
- Corrected stage-key check from final dashboard: stages are `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.

## Six-Semester Stage Matrix

All expected 30 checkpoints exist after recompute.

| Sem | Stage | Low | Medium | High | Open queue | Watch queue | Realism read |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | Correct: no prior evidence pressure. |
| 1 | post-tt1 | 120 | 0 | 0 | 0 | 0 | Conservative after first internal evidence. |
| 1 | post-tt2 | 120 | 0 | 0 | 0 | 0 | Still conservative; no fake high risk. |
| 1 | post-assignments | 120 | 0 | 0 | 0 | 0 | Assignments do not create invented risk. |
| 1 | post-see | 67 | 53 | 0 | 0 | 53 | Medium emerges only after end-sem evidence. |
| 2 | pre-tt1 | 67 | 49 | 4 | 0 | 0 | Prior Sem 1 history begins influencing stage. |
| 2 | post-tt1 | 67 | 49 | 4 | 10 | 43 | Early queue appears, plausible. |
| 2 | post-tt2 | 67 | 49 | 4 | 0 | 53 | Watch list broadens. |
| 2 | post-assignments | 67 | 49 | 4 | 0 | 53 | Stable risk after coursework. |
| 2 | post-see | 38 | 76 | 6 | 0 | 82 | End-sem evidence increases pressure. |
| 3 | pre-tt1 | 38 | 61 | 21 | 0 | 0 | Prior backlog/CGPA pressure now visible. |
| 3 | post-tt1 | 38 | 61 | 21 | 25 | 57 | Operational triage appears. |
| 3 | post-tt2 | 38 | 61 | 21 | 0 | 82 | Watch list retains accumulated risk. |
| 3 | post-assignments | 38 | 61 | 21 | 0 | 82 | No artificial stage jump. |
| 3 | post-see | 24 | 84 | 12 | 0 | 96 | Some high resolves downward; realistic mixed signal. |
| 4 | pre-tt1 | 24 | 52 | 44 | 0 | 0 | Cumulative pressure significant. |
| 4 | post-tt1 | 24 | 52 | 44 | 18 | 78 | Triage count bounded. |
| 4 | post-tt2 | 24 | 53 | 43 | 0 | 96 | Stable but not monotonic in every stage. |
| 4 | post-assignments | 24 | 53 | 43 | 0 | 96 | Coursework stage preserved. |
| 4 | post-see | 25 | 46 | 49 | 0 | 95 | End-sem risk remains high for heavy-risk cohort. |
| 5 | pre-tt1 | 19 | 32 | 69 | 0 | 0 | Late-stage accumulated academic pressure. |
| 5 | post-tt1 | 19 | 32 | 69 | 27 | 74 | Queue load still controlled. |
| 5 | post-tt2 | 19 | 32 | 69 | 0 | 101 | Watch list high but visible. |
| 5 | post-assignments | 19 | 32 | 69 | 0 | 101 | Stable evidence accumulation. |
| 5 | post-see | 5 | 43 | 72 | 0 | 115 | Severe cohort pressure by Sem 5. |
| 6 | pre-tt1 | 5 | 30 | 85 | 0 | 0 | Heavy backlog seed dominates. |
| 6 | post-tt1 | 0 | 35 | 85 | 23 | 97 | Actionable queue appears after TT1. |
| 6 | post-tt2 | 1 | 34 | 85 | 0 | 119 | Watch list nearly whole cohort. |
| 6 | post-assignments | 1 | 34 | 85 | 0 | 119 | Stable late-stage profile. |
| 6 | post-see | 4 | 31 | 85 | 0 | 116 | Final High count remains 85/120. |

## Whole-Student Realism Findings

The aggregate trajectory is coherent for a deliberately heavy-risk proof corpus.

- Sem 1 starts entirely Low and does not invent prior evidence.
- Medium appears after Sem 1 SEE, not before.
- High first appears in Sem 2 pre-TT1 with 4 students, consistent with prior semester outcomes being available.
- High pressure grows across Sem 3-Sem 6 as cumulative history accumulates.
- Sem 6 High count is high but consistent with the synthetic corpus described by the ML sanity report.
- The queue system limits actionable items despite large watch counts.

## Evidence Timing Findings

Pass:

- No final-dashboard evidence shows High in Sem 1 pre-TT1.
- Stage keys are chronologically ordered and linked by previous/next checkpoint ids.
- Sem 1 post-SEE is the first place where broad Medium risk appears.
- Later pre-TT1 stages reflect prior-semester history, not future same-semester marks.

Caveat:

- The full-walk first dashboard had `checkpointCount=0`. After recompute, final dashboard had 30. Demo operators must run or verify recompute/readiness before showing the dashboard.

## Queue Calendar Findings

Queue state is realistic but demo-sensitive.

- Early semesters keep open queue low or zero.
- Sem 2 post-TT1 open queue is 10.
- Sem 3 post-TT1 open queue is 25.
- Sem 4 post-TT1 open queue is 18.
- Sem 5 post-TT1 open queue is 27.
- Sem 6 post-TT1 open queue is 23.
- Watch queue grows as cumulative risk grows.

Important blocker:

Sem 6 post-SEE reports `playbackAccessible=false` with reason: playback is blocked until queue items for `stage_checkpoint_45dd134a0ac969ea05a049e7` are resolved. This is defensible governance, but it can break a demo that expects free playback at the final stage.

## Blockers

- **Demo-prep blocker:** Run recompute/readiness before browser demo; otherwise checkpoints may appear absent.
- **Playback blocker:** Resolve or explain the Sem 2 post-TT1 queue blocker before Sem 6 playback.
- **Browser caveat:** Browser smoke now renders current active checkpoint proof overlays, but it did not resolve or click through the blocked Sem 6 playback path.

## Reverification Needed

- Rerun precision probe after queue resolution.
- Confirm Sem 6 post-SEE `playbackAccessible=true` if demo requires clicking playback.
- Capture checkpoint detail rows for at least five named students and compare evidence timing.
- Re-run browser smoke after queue preparation if final demo includes Sem 6 playback.

## Verdict

**Proof-plane verdict: PASS for API realism, CONDITIONAL for final playback demo.**

The 6×5 proof-plane exists and the risk trajectory is coherent. Browser rendering is now proven for active proof overlays, but the main demo risk remains operational: readiness/recompute and queue-resolution must be done before any final-stage playback walkthrough.
