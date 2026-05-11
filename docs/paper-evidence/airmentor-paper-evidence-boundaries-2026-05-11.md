# AirMentor Paper Evidence Boundaries — 2026-05-11

## Intent

Convert AirMentor code proof into paper-safe wording boundaries.

## Feature Intent

A paper writer can distinguish local synthetic proof, product architecture evidence, missing validation, and forbidden wording before drafting claims.

## Evidence Matrix

| Claim | Current evidence | Evidence missing | Allowed wording | Forbidden wording | Figure/table needed | Test/artifact path |
|---|---|---|---|---|---|---|
| N1: synthetic scenario engine | Seeded M&C proof rows, 30-stage evidence matrix, proof realism sanity audit, browser population proof. | External real-cohort fidelity; broader held-out institutional validation. | AirMentor includes a deterministic synthetic scenario engine for local M&C proof runs and reports its limits. | Do not say synthetic scenarios are validated real MSRUAS cohort behavior. | Stage matrix table; realism anomaly summary. | `air-mentor-api/tests/stage-evidence-matrix.test.ts`; `air-mentor-api/tests/proof-realism-audit.test.ts`; `audit-map/32-reports/proof-realism-audit-2026-05-10.md` |
| N2: adaptable per-program calibration | Current model governance and synthetic metrics exist; P7 design identifies versioned recalibration spine. | Active per-program model version table, candidate activation, second program metrics, real-history recalibration. | AirMentor design supports a path toward per-program calibration; Phase 1 keeps it as planned architecture. | Do not say per-program recalibration is complete or based on real student history. | Model-version trace table after P7. | `docs/superpowers/specs/2026-05-11-airmentor-deterministic-realism-product-campaign-design.md` |
| N3: config-driven curriculum risk | Curriculum feature config, Bloom targets, edge weights, and existing admin curriculum tests exist. | Full evaluator-visible CO trace and mutation matrix proving marks/CO edits alter risk explanations. | AirMentor contains config-driven curriculum-risk mechanisms and needs Lane 3/2 proof for stronger evaluator claims. | Do not say official CO mappings are proven without official source data. | CO trace graph and mutation matrix. | `air-mentor-api/tests/admin-curriculum-feature-config.test.ts`; `docs/CAPABILITY_MATRIX.md` |

## Paper Wording Rules

- Synthetic proof may be described as local, deterministic, and evaluator-visible.
- Real institutional validation remains blocked until governed import, calibration, privacy/security review, and external validation exist.
- Simulated counterfactuals remain model-estimated responses inside the synthetic world.
- Hosted deployment claims remain blocked until the deployment boundary lane runs.

## Claim Ledger Link

The governing claim ledger is `audit-map/32-reports/airmentor-claim-ledger-2026-05-11.md`.
