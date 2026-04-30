# Product Positioning

> Decision L1 (per docs/MASTER_ROADMAP_2026-05-01.md §4 Group L)
> Version: 2026-05-01
> Status: **proposed default — A. Simulation Platform.** Override and edit if you choose B or C.

---

## The three options

### A. Simulation platform for academic risk and intervention research
- **What it is:** A configurable, literature-grounded simulator that produces synthetic
  student trajectories, surfaces risk drivers, and lets a researcher or curriculum
  designer A/B test interventions before any real data is touched.
- **Primary buyer:** academics, EDM/AIED researchers, curriculum committees.
- **Primary claim (paper):** "configurable curriculum + parameter-grounded
  scenario engine + per-program recalibration on synthetic corpora" — N1, N3, with
  N2 demonstrated on M&C 2023 + ECE 2024.
- **What we honestly do not promise:** prediction on real students, institutional rollout,
  replacement of an existing risk pipeline.
- **Why this fits the current code:** every signal is synthetic; every model is fit on
  generated worlds; the proof control plane is the simulator. Calling this a
  prediction product would be dishonest.

### B. Real-data student-risk prediction product
- **What it is:** Customer brings student records, model predicts who is at risk.
- **Why this is wrong for now:** we have no real student data, no validated label
  schema, no calibration on a real cohort, no GDPR / institutional data agreements.
  Every novelty claim in §2 of the roadmap dies on a single auditor question:
  "Show me a non-synthetic AUC."
- **Re-enter when:** P11 design docs are real, a pilot institution has agreed to
  share labelled data, F-group recalibration evidence is in (P7).

### C. Academic ops platform (Provisioning + faculty + HOD dashboards)
- **What it is:** Replace bits of an SIS — section offerings, faculty allocations,
  attendance pipelines, mentor assignments.
- **Why this is wrong for now:** the SIS market is brutal, integration-heavy,
  and the current code's ops surfaces are demo-grade (Group C and Group K issues
  in §4: hardcoded program, no demo isolation, no audit log). The novelty is in
  the simulation, not in the CRUD around it.
- **Re-enter when:** the simulation product is published and a pilot school
  asks "can you replace this part of our SIS too?"

---

## Recommended choice: **A**

Three reasons:

1. **Honesty match.** Every artifact in the repo today is synthetic-data grounded.
   A and only A can be claimed without footnotes.
2. **Paper alignment.** Tier 1 goal (§1) is publishability. Claims N1 / N2 / N3
   (§2) are pure simulation claims. P1 + P2 + P6 + P7 in the roadmap are all
   simulation-evidence work.
3. **Solo-dev feasibility.** B requires data partnerships; C requires an integration
   surface no one solo dev can carry. A only requires evidence and a paper.

---

## What this implies

| Implied next step | Where it lives |
|---|---|
| Don't market real-data prediction in copy, README, or paper. | docs/CAPABILITY_MATRIX.md, paper Limitations |
| Replace "Retrain" → "Recalibrate" everywhere. | P3 task 3.7 (decision L8 = full replace) |
| Add a "synthetic data only" banner to demo. | P5 task 5.6 (demo workspace badge) |
| Limit pilot conversations to "research deployment / curriculum sandbox". | P12 sketch + sales deck |
| Frame N2 as "transferable architecture", not "transferable predictions". | P10 paper Discussion |

---

## How to override

If you decide B or C instead, the impact downstream is large. Items that flip:

- §2 novelty claims (rewrite N1 / N2 / N3 to match B or C)
- P1 (literature scan emphasis shifts)
- P11 design docs (data ingestion, multi-tenancy become P0-blocking, not deferred)
- P12 sales deck framing

If you flip, edit this file, mark this section "Decided: B (or C) on YYYY-MM-DD",
and update the affected sections of the roadmap before continuing.
