# Stage 11 — Demo-Ready Consolidation

Session window: 2026-04-23 afternoon.
Branch: `promote-proof-dashboard-origin`.
Commit range: `cc31db82` → `b9e739ea` (7 commits + seed).

This consolidates everything that was shipped in the demo-readiness push
on top of Stage-09's fresh-sem1 realization overhaul. The objective was
explicit: tomorrow's pilot demo must reach the local-machine backend
through GitHub Pages without destabilising the Railway production wiring,
and every role the user walks through must work.

---

## Shipped this session

### 1. Demo-day wiring — `cc31db82`

- `scripts/demo-local-tunnel.sh` — boots the seeded backend on
  `127.0.0.1:4000` with the Pages cross-origin cookie posture
  (SameSite=None; Secure; CSRF_SECRET; flag-on; section-overrides
  flag-on) and starts an ngrok HTTPS tunnel. Polls ngrok's local API to
  resolve the public URL and prints the exact
  `VITE_AIRMENTOR_API_BASE_URL` value that the GitHub Actions Pages
  workflow variable must carry.
- Preserves the production Railway wiring untouched. Rolling back to
  production is a single variable flip + redeploy (runbook item).

### 2. Counterfactual API + HoD panel — `cc31db82` → `876a4e48`

End-to-end Phase-11 counterfactual reader wired through every layer:

| Layer | Artifact |
|---|---|
| Pure diff (last session) | `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-counterfactual-reader.ts` |
| DB fetch adapter | `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-counterfactual-fetcher.ts` |
| HTTP route | `GET /api/academic/hod/proof-counterfactual?runIdBaseline=&runIdRealized=` inside `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic-proof-routes.ts:190-217` |
| DTO types | `ApiAcademicHodProofCounterfactualScalar`, `…StudentStageDiff`, `…Aggregate`, `…Report` in `@/home/raed/projects/air-mentor-ui/src/api/types.ts:1855-1891` |
| API client method | `AirMentorApiClient.getAcademicHodProofCounterfactual()` in `@/home/raed/projects/air-mentor-ui/src/api/client.ts:526-533` |
| React panel | `@/home/raed/projects/air-mentor-ui/src/hod-counterfactual-panel.tsx` (accepts a `loadReport` callback — client-agnostic) |
| Tab mount | HoD `counterfactual` tab in `@/home/raed/projects/air-mentor-ui/src/pages/hod-pages.tsx` |
| Workspace wire | `@/home/raed/projects/air-mentor-ui/src/academic-workspace-route-surface.tsx:256-270` reads `?counterfactualBaseline=<runId>` from the URL and builds the panel element only when baseline + realized + loader are all present |
| App.tsx loader chain | `loadAcademicHodProofCounterfactual` callback, `OperationalWorkspaceProps.loadHodProofCounterfactual`, workspace object exposure |

Verified end-to-end via curl against the live seeded backend:

- Same-run IDs → HTTP 400 with `runIdBaseline and runIdRealized must be
  two distinct simulation runs`.
- Sysadmin happy path with two non-existent run IDs → HTTP 200, empty
  report with the full 6-scalar zeroed aggregate — no crash, no leak.

### 3. Humanised action codes everywhere the UI renders them — `cc31db82`

Frontend mirror of the backend helper at
`@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-recommendation-text-generator.ts:93`
lives at `@/home/raed/projects/air-mentor-ui/src/action-code-humaniser.ts`.
Applied at the 4 leaking surfaces called out in the ML-audit:

1. `@/home/raed/projects/air-mentor-ui/src/pages/risk-explorer.tsx` — model-output card, advanced tab label, simulated-intervention row, policy-comparison chips (closes F4)
2. `@/home/raed/projects/air-mentor-ui/src/academic-faculty-profile-page.tsx` — monitoring queue row
3. `@/home/raed/projects/air-mentor-ui/src/academic-route-pages.tsx` — course-leader proof offerings meta + reasonLabel fallback (closes F3 partially)
4. `@/home/raed/projects/air-mentor-ui/src/system-admin-proof-dashboard-workspace.tsx` — checkpoint queue preview row (closes F8)

### 4. HoD checkpoint drivers preservation — `88f1da3e`

Two tiny edits restored the driver chain in checkpoint mode:

- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:673-674` — carry top-5 `observableDrivers` through `projectionJson.currentStatus`.
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:642-646` — read `payload.currentStatus.observableDrivers` instead of always returning `[]`.

Closes ML-audit F1 for the HoD drilldown.

### 5. Stage-10 runbook + role smoke — `b9e739ea`

- `@/home/raed/projects/air-mentor-ui/docs/closeout/stage-10-demo-day-runbook.md` — 8-stop operator guide for tomorrow's demo with env-var table, seeded credentials, feature tour, rollback instructions, and known open items.
- `@/home/raed/projects/air-mentor-ui/scripts/demo-role-smoke.sh` — round-trips login → restore → logout for all 4 seeded roles. Honors `AIRMENTOR_DEMO_API_URL` + `AIRMENTOR_DEMO_ORIGIN` env overrides. Uses `DELETE /api/session` for logout (the backend's actual logout route).

Verified against a fresh seeded backend on port 4100:

```
PASS  health  http://127.0.0.1:4100/health
PASS  system-admin   login + restore + logout  (role=SYSTEM_ADMIN)
PASS  hod            login + restore + logout  (role=COURSE_LEADER)
PASS  course-leader  login + restore + logout  (role=COURSE_LEADER)
PASS  mentor         login + restore + logout  (role=MENTOR)
PASSED: all 4 seeded roles round-tripped.
```

HoD fixture logs in as `COURSE_LEADER` because seeded `devika.shetty`
carries both grants; the UI swaps to HOD via `/api/session/role-context`.
That behavior is already matched in
`@/home/raed/projects/air-mentor-ui/tests-e2e/helpers/login-as.ts:50-85`.

---

## Verification status

| Layer | Status |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 |
| `npx tsc -p air-mentor-api/tsconfig.json --noEmit` | exit 0 |
| `npm run build` (vite production build) | exit 0 (chunk sizes unchanged) |
| Engine unit tests (prior session) | 194 + 37 = 231 / 231 green |
| Live health probe on demo env | 200 OK |
| 4-role round-trip smoke | all PASS |
| Counterfactual 400 on same-run IDs | PASS |
| Counterfactual 200 on distinct fake IDs (sysadmin) | PASS (empty report, no crash) |

---

## Non-deliverables explicitly deferred past demo

Tracked under `@/home/raed/projects/air-mentor-ui/audit-map/32-reports/ml-risk-ui-audit.md`:

1. **HoD `modelVersion` / `calibrationVersion` banner** (audit F2). The
   values already exist on Risk Explorer; HoD hero does not surface them
   yet. Low priority — works around by pointing presenter to Risk
   Explorer if asked about provenance.
2. **Checkpoint queue driver preservation** (audit F3). Live HoD path
   already works; checkpoint queue projection still emits
   `drivers: []` for faculty dashboard cards. Mitigated by the
   humaniser — cards now show band + probability + humanised action
   label.
3. **Student-shell checkpoint assessment driver chips** (audit F5).
   Analogous to F3 but on the Student Shell assessment panel.
4. **Counterfactual integration test** over the full route. The pure
   reader module has 10/10 tests, the HTTP route is curl-verified, but
   there's no vitest test asserting the full DB → fetcher → reader →
   HTTP → JSON chain. Low risk for demo — if anything breaks on the
   day, it surfaces loudly (empty report vs 500).
5. **ML audit findings F6** (course-page action/counterfactual layer)
   and **F7** (cross-surface band parity, already-live guardrail).

---

## Commit log for this session (HEAD-first)

```
b9e739ea feat(demo): Stage-10 runbook + demo-role-smoke.sh
876a4e48 feat(proof): wire HoD counterfactual panel through App loader chain
74470210 feat(proof): HoD counterfactual panel component + API client method
88f1da3e fix(proof): preserve observableDrivers on HoD checkpoint course snapshots
cc31db82 feat(demo): humanise action-codes across UI + counterfactual API + demo tunnel
```

Plus the Stage-09 base (unchanged from prior session): `af1eed23` … `e2443983`.

---

## Recommended demo-morning checklist (5 minutes)

1. `bash scripts/demo-local-tunnel.sh` — wait for "AIRMENTOR DEMO TUNNEL READY".
2. Open another shell:
   `AIRMENTOR_DEMO_API_URL=http://127.0.0.1:4000 bash scripts/demo-role-smoke.sh` — confirm all 4 PASS.
3. Paste the tunnel URL into the GitHub Actions repo variable
   `VITE_AIRMENTOR_API_BASE_URL`.
4. Trigger the `Deploy to GitHub Pages` workflow and wait for green.
5. Open `https://raed2180416.github.io/AirMentor/` — verify login with
   `sysadmin / admin1234` succeeds.
6. Activate a proof run for `Proof MNC 2023` from the sysadmin proof
   dashboard. Capture its `simulationRunId` for use as the realized run
   in the counterfactual demo.
7. Optionally create a flag-off run before this by flipping
   `AIRMENTOR_STAGE_REALIZATION_V1=0` in a separate shell — capture its
   run ID as baseline.
8. Tail `output/demo-backend.log` and `output/demo-tunnel.log` in
   separate terminals during the demo to catch any 5xx early.

Full tour: `@/home/raed/projects/air-mentor-ui/docs/closeout/stage-10-demo-day-runbook.md`.

---

## Rollback to Railway after the demo

1. Ctrl+C the tunnel script.
2. Reset the GH Actions variable
   `VITE_AIRMENTOR_API_BASE_URL=https://api-production-ab72.up.railway.app`.
3. Redeploy Pages.
4. Run `bash scripts/check-railway-deploy-readiness.mjs` to confirm the
   production cookie + CSRF posture.

Live-verify contract stays authoritative at
`@/home/raed/projects/air-mentor-ui/docs/closeout/deploy-env-contract.md`
and `@/home/raed/projects/air-mentor-ui/docs/closeout/final-authoritative-plan-security-observability-annex.md`.
