# Branch Strategy

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` §6.2.
> Version: 2026-05-01.

---

## Goals

1. Keep `main` always-deployable.
2. Phase work is reviewable in isolation (one branch per phase or per
   phase-stage), so paper claims trace cleanly to a small set of commits.
3. Demo branch (`college-demo-2026-04-27`) keeps moving for short-fuse
   demos without polluting `main`.

---

## Branches

| Branch | Purpose | Lifetime |
|---|---|---|
| `main` | Always-deployable. Protected (no force-push). Tagged at each phase exit. | permanent |
| `college-demo-2026-04-27` | Active demo development branch. **Current `HEAD`.** Will eventually merge to `main` once the realism-readiness-security closeout audits land. | until end of demo cycle |
| `research/p1-literature` | P1 work (learning dynamics constants, references.bib, scenario grounding). | merges into `main` at P1 exit |
| `research/p2-validation` | P2 work (generative-process split, baselines, sensitivity, calibration). | merges into `main` at P2 exit |
| `research/p3-config-wireup` | P3 work (Bloom→mastery, edge weights, impact preview, Recalibrate rename, audit log). | merges into `main` at P3 exit |
| `research/p4-ux` | P4 UX label sweep. Can run parallel with P3. | merges into `main` at P4 exit |
| `research/p5-demo-isolation` | P5 demo workspace, reset, dry-run. | merges into `main` at P5 exit |
| `research/p6-multi-program` | P6 program template + ECE 2024 evidence. | merges into `main` at P6 exit |
| `research/p7-recalibration` | P7 risk model versions, recalibration service. | merges into `main` at P7 exit |
| `infra/p8-render` | P8 Render migration (separate prefix, infra not research). | merges into `main` at P8 exit |
| `test/p9-regression` | P9 test hardening + E2E. | merges into `main` at P9 exit |
| `paper/p10-draft` | LaTeX + figures only. Lives long, parallel from P3 onward. | merges into `main` at submission |
| `arch/p11-seeds` | P11 production scaling design docs only. | merges into `main` at P11 exit |

---

## Conventions

- **Commit messages:** `phase(Pn): subject` or `phase(Pn-prep): subject`.
  See `docs/MASTER_ROADMAP_2026-05-01.md` §6.2. Body explains *why*, not
  *what*; trailers include `Refs: ...` to roadmap issue IDs.
- **PRs:** even self-merged. PR body links to phase + exit criteria checklist
  from roadmap §11. PR title: `phase(Pn): summary`.
- **Tagging:** at each phase exit, tag `main` as `pN-exit` (e.g. `p1-exit`).
  This gives the paper a citable code state per evidence file.
- **Rebase before merge** to keep history readable (no merge commits unless
  multiple parallel branches land on the same date).
- **Never force-push** to `main` or to long-lived `paper/` branches. Force-push
  is allowed on personal `research/*` and `infra/*` branches before they
  reach review.

---

## Branch protection (set on remote when convenient)

- `main`: require PR, require linear history, require CI green, no force-push.
- `paper/p10-draft`: require PR, no force-push (so figure regeneration is auditable).

If branch protection is not yet configured on GitHub, add it before P0 exits.
This is **decision L0.x — not blocking** but recommended.

---

## When the demo branch merges back

`college-demo-2026-04-27` is currently ahead of `main` with prior P3 / P5 / P6
bleed work. Plan:

1. After P0 closeout, decide which open changes on the demo branch are P-phase
   work that should move to a `research/...` branch, and which are pure demo
   scaffolding that lands as a single commit on `main` ahead of P1.
2. Snapshot the demo as `tag/demo-2026-04-27-final` for paper reproducibility.
3. Then start P1 from `main`.

This decision is captured in `docs/CHANGELOG.md` once executed.
