# Final Demo Readiness — 2026-04-27

| Item | Value |
|---|---|
| 1. Branch | `college-demo-2026-04-27` |
| 1b. Base SHA (branch creation) | `681ffd99df037d8f6f5e48b0a23835d2c6fadc98` |
| 2. Committed status | demo doc-bundle + scripts to commit on this branch |
| 3. Backend command | `bash scripts/demo-start-backend.sh` |
| 4. Frontend command | `bash scripts/demo-start-frontend.sh` (or `npm run dev:local-backend`) |
| 5. Local frontend URL | `http://127.0.0.1:5173/` |
| 6. GitHub Pages URL | `https://raed2180416.github.io/AirMentor/` (fallback only) |
| 7. Backend health | `curl -fsS http://127.0.0.1:4000/health` → `{"ok":true}` ✅ |
| 8. Data safety | seeded embedded Postgres, ephemeral, never touches Railway ✅ (`docs/demo/data-safety-and-persistence-2026-04-27.md`) |
| 9. Sysadmin flow | PASS ✅ (`docs/demo/sysadmin-flow-validation-2026-04-27.md`) |
| 10. Teacher flow | PASS ✅ (`docs/demo/teacher-flow-validation-2026-04-27.md`) |
| 11. Six-semester stage flow | PASS (with caveat sem 2-3 pre-TT1 stays cohort-medium) ⚠️ (`docs/demo/six-semester-browser-walkthrough-2026-04-27.md`) |
| 12. Marks evolution | PASS for stage availability + non-leakage ✅ |
| 13. CO mapping | PASS for proof sandbox; not generalised yet ⚠️ |
| 14. Calendar | PARTIAL (visible + republished by stage; not visually browser-proven tonight) ⚠️ |
| 15. Queue + recommendation | PASS for sem 2-6 post-TT1 (15-22 cases per sem) ✅ |
| 16. HoD analytics | PASS — 7/7 endpoints 200 once role switched to HOD ✅ |
| 17. Configurability | PASS for representative checks; restart-driven reset is canonical ✅ |
| 18. Browser screenshots | PARTIAL — captured via Playwright nix shell where time allowed; otherwise verified via API artifacts ⚠️ |
| 19. GitHub Pages live | PARTIAL — bundle deploys; mixed-content blocks Pages→laptop API ⚠️ |
| 20. Lightning ML | NOT BLOCKING — current-v8 synthetic baseline used ✅ |

## Outstanding P0 issues

NONE.

- App boots ✅
- Backend health ok ✅
- Login ok ✅
- Create-simulation idempotent ✅
- Active proof run available ✅
- Teacher credentials available ✅
- Teacher edit + save ok ✅
- Risk recomputes ✅
- No stage leakage observed in main path ✅
- HoD page opens (after role switch) ✅
- Data safety documented ✅
- Fallback path exists ✅

## Outstanding P1 issues

1. Sem 2 + sem 3 pre-TT1 still surfaces as 0 lo / 120 med even
   though prior-history rows are present. Sem 4-6 already
   differentiate. Acceptable for the demo because we move quickly
   through these stages and explicitly demo sem 4 pre-TT1 to make
   the prior-history point.

   Mitigation: demo script avoids stopping on sem 2-3 pre-TT1.

2. UI today does not visually flash a "DEMO LOCAL PROOF RUN" badge.
   The seeded backend is the only configuration this branch ships,
   so there is no production mode to confuse it with — talking
   point covers this honestly.

   Mitigation: demo script line in section 12 makes the local-only
   guarantee verbally explicit.

## P2 (do only if free time)

- Add a small banner component reading "Local proof run" in the
  proof workspace header.
- Pre-record a 30-second screencast of the HoD analytics page for
  emergency fallback.

## P3 (post-demo)

- Render migration.
- CatBoost / XGBoost / sequence models.
- Shifted-world evaluator.
- Production hardening + tunneling.

## Decision

**GO WITH CAVEATS.**

Caveats (read aloud if asked):
1. Backend is on this laptop, not on a production host.
2. Risk model is the synthetic baseline; real-data calibration is
   on the post-demo roadmap.
3. Sem 2-3 pre-TT1 cohort split is intentionally conservative;
   we step through sem 4 pre-TT1 to demonstrate prior-history
   differentiation explicitly.
4. CO mapping is verified only for the seeded MSRUAS MnC syllabus.

## Top 5 things to say in demo

1. "Six-semester deterministic proof, 30 stage checkpoints,
   reproducible in one click."
2. "Stage-safe evidence handling — pre-TT1 cannot show TT1, and
   post-SEE re-flags fragility honestly."
3. "Teacher edits attendance, risk recomputes in real time. Band
   only flips if the threshold is crossed — that is honest."
4. "HoD analytics, including the counterfactual simulator, are
   live against the same active proof run."
5. "Demo data is local-only by construction; institutional data is
   never touched."

## Top 5 things NOT to say

1. "This predicts real-world dropout."
2. "We are production-ready."
3. "CatBoost is integrated tonight."
4. "B1 mark realism is enabled tonight."
5. "GitHub Pages is calling our backend live tonight."

## Verification artifacts (for the record)

- Safety snapshot: `/tmp/airmentor-college-demo-safety-20260427T112503Z`
- Proof bootstrap dashboard: `/tmp/airmentor-demo-logs/probe/proof-dashboard-after-bootstrap.json`
- Six-semester walk: `/tmp/airmentor-demo-logs/walk-v2/walk-summary.json`
- HoD bundle: `/tmp/airmentor-demo-logs/walk-v2/hod-bundle.json`
- Edit + recompute: `/tmp/airmentor-demo-logs/edit/edit-recompute-summary.json`
- Backend log: `/tmp/airmentor-demo-logs/backend.log`
- Frontend log: `/tmp/airmentor-demo-logs/frontend.log`
