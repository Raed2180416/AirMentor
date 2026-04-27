# Marks Realism Inference Audit — 2026-04-27

## Verdict

**MARKS REALISM DEMO VERDICT: AMBER.**

The demo is usable if we present **selected safe students** and use the explicit synthetic-proof caveat. The observed course marks, attendance, weak-CO counts, backlog/CGPA history, and early-stage risk patterns are plausible enough for a synthetic classroom proof. However, the current proof projection is **not fully green for real-world mark realism** because B1 mark realism is not enabled and the saved post-TT2/post-SEE risk projections treat missing TT2/SEE evidence as `0%` in risk-driver text.

Do **not** claim real-world mark realism. Say: "This is deterministic synthetic proof data. We are validating evidence visibility and plausible intervention workflow, not claiming production academic calibration tonight."

## Data extraction method

Generated compact artifacts:

- `/tmp/airmentor-demo-logs/marks-realism/trajectory-sample.json`
- `/tmp/airmentor-demo-logs/marks-realism/trajectory-sample.csv`
- `/tmp/airmentor-demo-logs/marks-realism/class-distribution.json`
- `/tmp/airmentor-demo-logs/marks-realism/routes-used.json`

Routes used:

- `POST /api/session/login`
- `GET /api/admin/batches/:batchId/proof-dashboard`
- `GET /api/admin/proof-runs/:simulationRunId/checkpoints`
- `GET /api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId`
- `GET /api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId/students/:studentId`
- `GET /api/admin/proof-runs/:simulationRunId/students/:studentId/evidence-timeline`
- `GET /api/admin/offerings`

Checkpoint routes used:

- Semester 1, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_e22816d896f73351902c3e1e`
- Semester 1, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_182e4d047d959f28a86c6b39`
- Semester 1, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_ac9de94785d2101c671e6add`
- Semester 1, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_d587764dad75695887094057`
- Semester 1, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_78ee47d5a45be74db6419d24`
- Semester 2, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_f21fd86d7c3fe2750f0b78f1`
- Semester 2, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_45dd134a0ac969ea05a049e7`
- Semester 2, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_7ac08db07d8702409002266e`
- Semester 2, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_d9d2a0c1ea709c1ad371fcf7`
- Semester 2, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_d6aa3455a8cf8433f94ab773`
- Semester 3, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_b47d44443e38ee77f48ba231`
- Semester 3, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_5cb58722ec96706d583b3d50`
- Semester 3, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_99d2b518f2152f133e6e5f34`
- Semester 3, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_d2a63a3bfb896a648dc40004`
- Semester 3, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_6452ecb8ca56b5b88168e2da`
- Semester 4, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_686ef511cc7b02005cb60101`
- Semester 4, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_7a89536edab4dff9697d46a3`
- Semester 4, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_37e51f0c8a43fb4d598829bf`
- Semester 4, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_77e060abdc1ccfe0d2c73958`
- Semester 4, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_fd713de15d3771038ced9bfd`
- Semester 5, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_f17e672ff500ce9a09543b06`
- Semester 5, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_08456ada2201f20cec4df2ac`
- Semester 5, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_435c767c27dd7405b2ee191c`
- Semester 5, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_3b723b3e3d9e8a3a5ce98b9c`
- Semester 5, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_19ede662df23cf9be4d8c7e8`
- Semester 6, Pre TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_7b2006310ea4591badd87549`
- Semester 6, Post TT1: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_4be7d2c6597f4d0f78be92d2`
- Semester 6, Post TT2: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_3fe03edd5c065a9cf6f64992`
- Semester 6, Post Assignments: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_beeea412e892c7c549a09e10`
- Semester 6, Post SEE: `/api/admin/proof-runs/sim_mnc_2023_first6_v1/checkpoints/stage_checkpoint_654335929a345857eab259b0`

The observed course marks came from `/api/admin/proof-runs/:simulationRunId/students/:studentId/evidence-timeline`. Stage risk, drivers, queue state, recommendations, no-action comparison, and counterfactual lift came from `/api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId/students/:studentId`.

## Representative students selected

| archetype | id | name | avgCE | avgRisk | backlogMax | weakCO |
| --- | --- | --- | --- | --- | --- | --- |
| attendance-risk student | mnc_student_079 | Yash Reddy | 55.8 | 79.2 | 16 | 4 |
| academic weakness / tutoring student | mnc_student_096 | Mira Patel | 47.9 | 77.6 | 12 | 8 |
| prerequisite/carryover student | mnc_student_061 | Aarav Reddy | 46.6 | 77.2 | 23 | 8 |
| coursework-inflated / SEE-fragile candidate | mnc_student_030 | Diya Iyer | 80.8 | 59.4 | 0 | 0 |
| intervention-responsive candidate | mnc_student_004 | Ananya Sharma | 59.9 | 79 | 4 | 4 |
| persistent-risk student | mnc_student_009 | Arjun Sharma | 73.1 | 81.6 | 5 | 0 |
| borderline pass/fail student | mnc_student_069 | Arjun Reddy | 48 | 78 | 12 | 8 |
| volatile student | mnc_student_023 | Vihaan Iyer | 69 | 58.8 | 0 | 1 |

## Representative student audit

### Yash Reddy — `mnc_student_079` — attendance + carryover risk

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 71 | 47.79 | 38.32 | 55.51 | 47.2 | 1 | High |
| AMC-S6-32 | Data Science and Analytics | 67 | 64.15 | 60.87 | 63.84 | 63 | 0 | Medium |
| AMC-S6-33 | Dept Elective - II | 75 | 71.15 | 63.63 | 80.49 | 71.8 | 0 | Medium |
| AMC-S6-34 | Mini Project | 69 | 53.3 | 54.1 | 45.78 | 51.1 | 1 | Medium |
| MCC301A | Optimization Techniques | 70 | 44.65 | 38.08 | 50.83 | 44.5 | 2 | High |
| MCC310A | Parallel & Distributed Computing | 71 | 60.5 | 52.18 | 59.01 | 57.2 | 0 | Medium |

**Semester path:** Sem 6 current rows show attendance mostly 67–75%, mixed coursework, high backlog history (max 16). This is believable as an attendance/carryover-risk story rather than pure intellectual weakness.

**Risk pattern:** Average projected risk is 79.2 with medium band in selected sem-6 stage projections.

- **pre-tt1**: Medium/70; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.87); Active backlog count is high (16); Attendance is below the operating threshold (71%)
- **post-tt1**: Medium/73; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.87); Active backlog count is high (16)
- **post-tt2**: Medium/84; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.87); Active backlog count is high (16); TT2 performance is very low (0%)
- **post-assignments-and-quizzes**: Medium/85; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.87); Active backlog count is high (16); TT2 performance is very low (0%)
- **post-see**: Medium/84; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.87); Active backlog count is high (16); TT2 performance is very low (0%)

**Realism verdict:** Plausible for "attendance and accumulated backlog dominate even when some coursework is passable." Use carefully: the student is not a clean attendance-only example because backlog is also a major driver.

**Demo suitability:** Good as a backup for attendance/carryover discussion. Do not use for a clean low-risk story.

### Mira Patel — `mnc_student_096` — academic weakness / tutoring

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AMC-S6-32 | Data Science and Analytics | 87 | 38.03 | 37.58 | 30.11 | 35.2 | 2 | High |
| AMC-S6-33 | Dept Elective - II | 77 | 61.25 | 61.68 | 61.01 | 61.3 | 0 | Medium |
| AMC-S6-34 | Mini Project | 80 | 53.11 | 51.59 | 62.14 | 55.6 | 1 | Medium |
| MCC301A | Optimization Techniques | 82 | 43.01 | 44.52 | 46.87 | 44.8 | 2 | Medium |
| MCC310A | Parallel & Distributed Computing | 80 | 54.78 | 56.3 | 53.21 | 54.8 | 1 | Medium |
| AID201A | Artificial Intelligence | 77 | 39.41 | 33.47 | 33.64 | 35.5 | 2 | High |

**Semester path:** High attendance with weak TT1/quiz/assignment in several courses. That is the cleanest academic-weakness pattern in the selected set.

**Risk pattern:** Average CE is 47.9, weak CO total 8, backlog max 12, average projected risk 77.6.

- **pre-tt1**: Medium/70; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.35); Active backlog count is high (12)
- **post-tt1**: Medium/72; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.35); Active backlog count is high (12)
- **post-tt2**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.35); Active backlog count is high (12); TT2 performance is very low (0%)
- **post-assignments-and-quizzes**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.35); Active backlog count is high (12); TT2 performance is very low (0%)
- **post-see**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.35); Active backlog count is high (12); TT2 performance is very low (0%)

**Realism verdict:** Strong demo candidate. The evidence supports tutoring/structured study more than attendance recovery.

**Issue/fix:** The saved post-TT2/post-SEE projection text mentions TT2/SEE at 0%. Avoid using those stages as realism proof; show the observed course rows and early/intermediate workflow.

### Aarav Reddy — `mnc_student_061` — prerequisite/carryover risk

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 71 | 36.52 | 29.03 | 31.47 | 32.3 | 2 | High |
| AMC-S6-32 | Data Science and Analytics | 83 | 45.43 | 45 | 53.98 | 48.1 | 1 | Medium |
| AMC-S6-33 | Dept Elective - II | 69 | 57.18 | 56.46 | 64.59 | 59.4 | 1 | Medium |
| AMC-S6-34 | Mini Project | 75 | 33.02 | 39.9 | 40.87 | 37.9 | 2 | High |
| MCC301A | Optimization Techniques | 72 | 46.28 | 46.1 | 47.61 | 46.7 | 1 | High |
| MCC310A | Parallel & Distributed Computing | 82 | 58.67 | 49.4 | 56.84 | 55 | 1 | Medium |

**Semester path:** Very high backlog history (max 23), weak CE around 46.6, weak CO signals. This is plausible as a carryover/prerequisite-risk story.

**Risk pattern:** Average risk 77.2. Pre-TT1 risk can be justified by accumulated history rather than future marks.

- **pre-tt1**: Medium/70; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.32); Active backlog count is high (23); Attendance is below the operating threshold (71%)
- **post-tt1**: Medium/71; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.32); Active backlog count is high (23); Attendance is below the operating threshold (69%)
- **post-tt2**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.32); Active backlog count is high (23); TT2 performance is very low (0%)
- **post-assignments-and-quizzes**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.32); Active backlog count is high (23); TT2 performance is very low (0%)
- **post-see**: Medium/81; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.32); Active backlog count is high (23); TT2 performance is very low (0%)

**Realism verdict:** Good for demonstrating sem-4/sem-6 prior-history differentiation. It is not a clean classroom-performance-only story; it is a backlog/carryover case.

### Diya Iyer — `mnc_student_030` — clean high-performing coursework candidate

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 87 | 78.75 | 83.3 | 88.35 | 83.5 | 0 | Low |
| AMC-S6-32 | Data Science and Analytics | 78 | 66.59 | 64.97 | 74.66 | 68.7 | 0 | Low |
| AMC-S6-33 | Dept Elective - II | 74 | 78.02 | 78.83 | 84.64 | 80.5 | 0 | Low |
| AMC-S6-34 | Mini Project | 75 | 82.75 | 81.84 | 79.4 | 81.3 | 0 | Low |
| MCC301A | Optimization Techniques | 85 | 86.47 | 83.05 | 89.53 | 86.3 | 0 | Low |
| MCC310A | Parallel & Distributed Computing | 77 | 87.26 | 77.72 | 88.22 | 84.4 | 0 | Low |

**Semester path:** Strong coursework across six sem-6 courses: average CE 80.8, attendance mostly healthy, weak CO total 0.

**Risk pattern:** Despite low observed course risk, stage projection remains medium (~59.4 average) because global projection/history layer is conservative and post-TT2/post-SEE drivers include missing TT2/SEE as 0.

- **pre-tt1**: Medium/43; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the watch threshold (6.31)
- **post-tt1**: Medium/49; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the watch threshold (6.31)
- **post-tt2**: Medium/68; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.31)
- **post-assignments-and-quizzes**: Medium/69; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.31)
- **post-see**: Medium/68; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); SEE performance is very low (0%); Current CGPA is below the watch threshold (6.31)

**Realism verdict:** Use Diya to show strong observed marks only, **not** to claim the risk engine is fully low-risk calibrated. If asked why risk remains medium, say the proof run is a conservative synthetic stress test and B1 realism is not enabled.

### Ananya Sharma — `mnc_student_004` — intervention/counterfactual candidate

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 82 | 58.41 | 52.26 | 53.54 | 54.7 | 1 | Medium |
| AMC-S6-32 | Data Science and Analytics | 79 | 70.25 | 68.44 | 68.95 | 69.2 | 0 | Medium |
| AMC-S6-33 | Dept Elective - II | 79 | 54.47 | 56.58 | 63.38 | 58.1 | 1 | Medium |
| AMC-S6-34 | Mini Project | 74 | 70.13 | 69.4 | 63.01 | 67.5 | 0 | Medium |
| MCC301A | Optimization Techniques | 83 | 44.84 | 45.88 | 42.57 | 44.4 | 2 | Medium |
| MCC310A | Parallel & Distributed Computing | 74 | 66.61 | 70.26 | 59.92 | 65.6 | 0 | Medium |

**Semester path:** Mixed coursework around CE 59.9, backlog max 4, weak CO signals. Good for explaining why monitored reassessment rather than no-action is recommended.

**Risk pattern:** Medium risk around 79 with backlog/CGPA and weak later-stage drivers.

- **pre-tt1**: Medium/70; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (5.42); Active backlog count is high (4)
- **post-tt1**: Medium/73; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (5.42); Active backlog count is high (4)
- **post-tt2**: Medium/84; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (5.42); Active backlog count is high (4); TT2 performance is very low (0%)
- **post-assignments-and-quizzes**: Medium/84; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (5.42); Active backlog count is high (4); TT2 performance is very low (0%)
- **post-see**: Medium/84; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (5.42); Active backlog count is high (4); TT2 performance is very low (0%)

**Realism verdict:** Demo-usable for intervention workflow, but not a proof of measured intervention response. The extracted counterfactual/intervention fields are present; use "projected" language only.

### Arjun Sharma — `mnc_student_009` — persistent risk

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 76 | 63.41 | 61.01 | 57.64 | 60.7 | 0 | Low |
| AMC-S6-32 | Data Science and Analytics | 78 | 64.44 | 55.59 | 69.5 | 63.2 | 0 | Low |
| AMC-S6-33 | Dept Elective - II | 76 | 88.03 | 94.48 | 85.45 | 89.3 | 0 | Low |
| AMC-S6-34 | Mini Project | 86 | 63.53 | 63.8 | 67.61 | 65 | 0 | Low |
| MCC301A | Optimization Techniques | 80 | 74.79 | 82.27 | 75.42 | 77.5 | 0 | Low |
| MCC310A | Parallel & Distributed Computing | 68 | 82.95 | 83.59 | 82.96 | 83.2 | 0 | Low |

**Semester path:** Some course marks are decent, but history has backlog max 5 and stage projection reaches high risk. This is plausible as persistent governance risk, but the observed marks alone do not fully explain high risk.

- **pre-tt1**: Medium/71; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Active backlog count is high (5); Attendance is below the operating threshold (68%); Current CGPA is below the watch threshold (6.26)
- **post-tt1**: Medium/75; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Active backlog count is high (5); Current CGPA is below the watch threshold (6.26)
- **post-tt2**: High/87; queue=idle; recommendation=Immediate mentor follow-up and reassessment before the next evaluation checkpoint.; drivers=Active backlog count is high (5); TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.26)
- **post-assignments-and-quizzes**: High/88; queue=idle; recommendation=Immediate mentor follow-up and reassessment before the next evaluation checkpoint.; drivers=Active backlog count is high (5); TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.26)
- **post-see**: High/87; queue=idle; recommendation=Immediate mentor follow-up and reassessment before the next evaluation checkpoint.; drivers=Active backlog count is high (5); TT2 performance is very low (0%); SEE performance is very low (0%)

**Realism verdict:** Useful only if you want to show that history/backlogs can dominate over one good course window. Avoid presenting it as a pure marks-driven example.

### Arjun Reddy — `mnc_student_069` — borderline pass/fail

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 75 | 48.17 | 48.93 | 52.31 | 49.8 | 1 | Medium |
| AMC-S6-32 | Data Science and Analytics | 74 | 39.95 | 42 | 35.14 | 39 | 2 | High |
| AMC-S6-33 | Dept Elective - II | 78 | 62.66 | 67.17 | 60.46 | 63.4 | 0 | Medium |
| AMC-S6-34 | Mini Project | 84 | 43.13 | 38.4 | 48.7 | 43.4 | 2 | High |
| MCC301A | Optimization Techniques | 72 | 38.74 | 40.09 | 46.93 | 41.9 | 2 | High |
| MCC310A | Parallel & Distributed Computing | 69 | 46.43 | 50.58 | 54.97 | 50.7 | 1 | High |

**Semester path:** CE around 48 with backlog max 12. This is a believable borderline/carryover case.

- **pre-tt1**: Medium/70; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.69); Active backlog count is high (12)
- **post-tt1**: Medium/72; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.69); Active backlog count is high (12)
- **post-tt2**: Medium/83; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.69); Active backlog count is high (12); TT2 performance is very low (0%)
- **post-assignments-and-quizzes**: Medium/83; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.69); Active backlog count is high (12); TT2 performance is very low (0%)
- **post-see**: Medium/82; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the high-risk threshold (4.69); Active backlog count is high (12); TT2 performance is very low (0%)

**Realism verdict:** Good backup for borderline concern. Use only if time allows.

### Vihaan Iyer — `mnc_student_023` — volatile / average steady

**Course evidence:**

| course | title | att | TT1 | quiz | assignment | CE | weakCO | observedRisk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 88 | 66.16 | 64.26 | 68.51 | 66.3 | 0 | Low |
| AMC-S6-32 | Data Science and Analytics | 78 | 63.98 | 60.68 | 57.82 | 60.8 | 0 | Low |
| AMC-S6-33 | Dept Elective - II | 83 | 79.93 | 76.49 | 82.49 | 79.6 | 0 | Low |
| AMC-S6-34 | Mini Project | 85 | 59.93 | 51.01 | 63.93 | 58.3 | 1 | Low |
| MCC301A | Optimization Techniques | 82 | 65.8 | 64.61 | 60.76 | 63.7 | 0 | Low |
| MCC310A | Parallel & Distributed Computing | 87 | 80.88 | 86.65 | 87.39 | 85 | 0 | Low |

**Semester path:** Average CE 69 with healthy attendance and no backlogs in observed history. Risk rises in stage projections mainly when missing TT2/SEE are treated as zero.

- **pre-tt1**: Medium/43; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the watch threshold (6.28)
- **post-tt1**: Medium/48; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=Current CGPA is below the watch threshold (6.28)
- **post-tt2**: Medium/68; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.28)
- **post-assignments-and-quizzes**: Medium/68; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); Current CGPA is below the watch threshold (6.28)
- **post-see**: Medium/67; queue=idle; recommendation=Schedule a monitored reassessment and review the current intervention plan.; drivers=TT2 performance is very low (0%); SEE performance is very low (0%); Current CGPA is below the watch threshold (6.28)

**Realism verdict:** Good for observed marks sanity, not for risk-driver realism. Do not use as a primary risk story.

## Inference answers

1. **TT1 predicts later concern:** Yes for weak students such as Mira Patel and Aarav Reddy; weak TT1 aligns with weak quiz/assignment and weak COs.
2. **TT2 recovery/decline:** Partial. The current sem-6 observed evidence does not contain real TT2 values; projection payloads treat TT2 as 0 after post-TT2, so do not claim TT2 realism.
3. **Quiz/assignment alignment:** Yes. Quiz/assignment generally track TT1 and the student profile; Mira/Aarav low, Diya high.
4. **CE coherence:** Yes for observed sem-6 rows. CE approximation from TT1/quiz/assignment is internally plausible.
5. **SEE behavior:** Not green. Current observed sem-6 rows do not expose real SEE. Post-SEE projections show SEE 0 for everyone, so avoid SEE realism claims.
6. **Overall grade/result alignment:** Sem1–5 transcript-style subject scores/results are plausible; sem6 final overall is not ready for SEE/final-result realism.
7. **Attendance risk:** Plausible but often mixed with backlog/CGPA. Yash is attendance-sensitive but not attendance-only.
8. **Prior CGPA/backlogs/prerequisites:** Yes. Sem2+ and sem6 pre-TT1 risk uses CGPA/backlog history. No evidence found that sem1 pre-TT1 uses prior history.
9. **Weak COs:** Partial. Observed sem6 weakCoCount aligns broadly with weak course marks, but question-level evidence is fallback-simulated and weak question counts are often zero.
10. **Recommendation alignment:** Mostly yes for weak/backlog cases; confusing for clean high-coursework students where conservative projection remains medium.
11. **Queue state alignment:** Partial. Queue/watch states exist, but many selected projections are `idle` even when risk is medium. Use queue as governance capacity/watchlist, not as a direct risk=queue mapping.
12. **Intervention movement:** Partial. Counterfactual/intervention fields are present, but do not claim measured causal improvement.
13. **Risk non-movement explanation:** Backlog/CGPA dominance explains many cases. Missing TT2/SEE zero-driver is confusing and documented as P1.
14. **Impossible progressions:** No future-evidence leakage found in pre-TT1. The main nonsensical progression is missing TT2/SEE represented as 0% in later-stage drivers.

## CO mapping verdict

**PARTIAL.** Sem6 observed rows contain `weakCoCount`, and weak counts tend to be higher for weaker marks. However, question-level evidence is mostly fallback-simulated; `weakQuestionCount` is often 0 and `coEvidenceMode` is fallback-simulated. Do not claim full CO-question realism. Say CO evidence is a deterministic proof scaffold.

## Risk/recommendation alignment

**Good examples:**

- Mira Patel: high attendance + weak CE + weak COs → academic weakness/tutoring story.
- Aarav Reddy: weak CE + very high backlog → prerequisite/carryover story.
- Yash Reddy: low attendance + high backlog + mixed CE → monitored reassessment/watch story.

**Confusing examples:**

- Diya Iyer: high observed coursework but medium projection because conservative/global/missing TT2/SEE drivers dominate.
- Vihaan Iyer: reasonable marks, but projection rises when missing TT2/SEE is represented as 0.

## Issues found

### P0

None found in the selected safe path. No observed pre-TT1 future leakage was found. Login, proof dashboard, recomputation, and local demo path remain live.

### P1

- Post-TT2/post-SEE proof projections display TT2/SEE as 0% drivers even though sem6 observed evidence does not contain real TT2/SEE values.
- Clean low-risk student is hard to present as fully low-risk in the stage projection because global projection remains medium.
- Queue state is not a simple one-to-one reflection of risk band; presenter must call it governance/capacity state, not just risk severity.

### P2

- CO/question evidence labels should be caveated as fallback-simulated.
- Several course codes are synthetic placeholders (for example `AMC-S6-32`) except mapped offerings such as `AID201A`, `MCC301A`, and `MCC310A`.

### P3

- B1/full mark generator realism.
- Shifted-world evaluator.
- CatBoost/ML architecture.
- Threshold retuning.

## Fixes applied

No code, ML, threshold, generator, or hosting changes. Safe fixes are documentation/demo-script only:

- Choose safe demo students.
- Avoid claiming post-SEE realism.
- Add explicit marks progression caveat to the demo script.
- Direct presenter to show observed course marks for selected students rather than randomly clicking.
