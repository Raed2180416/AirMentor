# Product Positioning

**Decision date:** 2026-06-06

AirMentor is a deterministic academic decision-rehearsal platform for higher
education programs.

It lets an academic team configure curriculum and policy, generate reproducible
synthetic student trajectories, inspect stage-aware risk, and rehearse bounded
interventions through the views used by system administrators, course leaders,
mentors, and heads of department.

## Primary User

The initial user is an academic program team evaluating curriculum risk,
assessment policy, intervention workflows, and operational readiness before
using real student data.

## Honest Claim

AirMentor demonstrates a configurable synthetic simulation architecture and a
traceable decision workflow. It does not currently demonstrate predictive
validity on real students or causal intervention effectiveness.

## Product Boundary

AirMentor is not:

- a replacement student information system;
- a production real-student prediction service;
- a model leaderboard or automated retraining product;
- proof that simulated interventions work in real institutions.

Role-specific operational screens exist to make the simulated decision workflow
credible and testable. They are not a commitment to build every academic
administration feature.

## Current Wedge

The product should make one program scenario excellent:

1. Configure curriculum, policy, assessment, and cohort assumptions.
2. Run a deterministic multi-semester simulation.
3. Inspect why risk changes as evidence becomes observable.
4. Rehearse interventions and preserve an auditable decision trail.
5. Export a bounded evidence pack for review.

The authoritative prioritization and deletion rules are in
`docs/PRODUCT_DIRECTION_AND_PRUNING_2026-06-06.md`.
