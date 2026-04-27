# Sysadmin Flow Validation — College Demo (2026-04-27)

Verified against branch `college-demo-2026-04-27` HEAD `681ffd99`,
backend `http://127.0.0.1:4000`, frontend `http://127.0.0.1:5173`.

## Credentials

- Identifier: `sysadmin`
- Password: `admin1234`
- Active role grant after login: `SYSTEM_ADMIN`.

## End-to-end checks (each ran via the live API)

| Step | Endpoint / API call | Status | Notes |
|---|---|---|---|
| 1 | `POST /api/session/login` | 200 | sets `airmentor_session` + `airmentor_csrf` cookies. CSRF token returned in body. |
| 2 | `GET /api/admin/batches/batch_branch_mnc_btech_2023/proof-dashboard` | 200 | active run `sim_mnc_2023_first6_v1`, 30 checkpoints. |
| 3 | `POST /api/admin/batches/<batchId>/proof-imports` (auto-bootstrap) | 200 | one curriculum import row exists post-seed. |
| 4 | `POST /api/admin/proof-imports/<importId>/approve` | 200 | crosswalk queue empty at default seed. |
| 5 | `POST /api/admin/proof-runs/<runId>/recompute-risk` | 200 | populates checkpoints from baseline seeded run. |
| 6 | `POST /api/admin/proof-runs/<runId>/activate-semester` for sem 1..6 | 200 | each call returns `{ ok, activeOperationalSemester, previousOperationalSemester }`. |
| 7 | `GET /api/admin/proof-runs/<runId>/checkpoints/<cpId>` | 200 | exposes `checkpoint`, `offeringRollups`, `queuePreview`. Shape verified for all 30 checkpoints. |
| 8 | `POST /api/admin/proof-runs/<runId>/archive` | NOT EXERCISED on demo branch (would tear down the active run). |
| 9 | `POST /api/admin/proof-runs/<runId>/retry` | NOT NEEDED (run already active). |

## Seeded data inventory (post-bootstrap)

| Entity | Count | Source |
|---|---:|---|
| Students | 120 | `seedMsruasProofSandbox` deterministic trajectories |
| Faculty | 10 (`mnc_t1` .. `mnc_t10`) | `PROOF_FACULTY` constant |
| Sections | 2 (A + B) | per semester |
| Section offerings | 2 per course × 6 sem × 6 courses = ~72 | proof sandbox seeding |
| Curriculum nodes | full sem 1..6 BTech MnC syllabus | `msruas-curriculum-compiler` |
| Course outcomes / question CO mapping | yes; deterministic | `simulationQuestionTemplates` |
| Stage checkpoints | 30 | `simulationStageCheckpoints` |
| Calendar workspaces | one per faculty | `facultyCalendarWorkspaces` |
| Reset snapshots | 1 baseline | `simulationResetSnapshot` |

## Generated teacher credentials

Verified by re-logging in. **All 10 PROOF_FACULTY accounts use the
same password `faculty1234`** (deterministic, hashed via Argon2 at
seed time). Listing verified by login probe:

| Identifier | Display name | Permissions |
|---|---|---|
| `devika.shetty` | Dr. Devika Shetty | HOD, COURSE_LEADER, MENTOR |
| `rohit.menon` | Dr. Rohit Menon | COURSE_LEADER, MENTOR |
| `priya.raman` | Dr. Priya Raman | COURSE_LEADER, MENTOR |
| `karan.naidu` | Dr. Karan Naidu | COURSE_LEADER, MENTOR |
| `sowmya.krishnan` | Dr. Sowmya Krishnan | COURSE_LEADER, MENTOR |
| `abhinav.rao` | Dr. Abhinav Rao | COURSE_LEADER, MENTOR |
| `neha.iyengar` | Dr. Neha Iyengar | COURSE_LEADER, MENTOR |
| `harish.bhat` | Dr. Harish Bhat | MENTOR |
| `namrata.shah` | Dr. Namrata Shah | MENTOR |
| `vivek.kumar` | Dr. Vivek Kumar | MENTOR |

The UI's sysadmin proof workspace surfaces `mnc_t1..mnc_t10` rows for
the demo presenter to read aloud. The demo script will say "every
account in this list uses `faculty1234` for tonight's run."

## Proof dashboard surfaces (browser-side)

Routes verified to exist by reading
`src/system-admin-proof-dashboard-workspace.tsx`:

- proof dashboard landing (active run summary, lifecycle audit)
- create simulation / activate semester / advance stage controls
- imports + crosswalk queue
- per-checkpoint detail (used as the playback target on stage)
- generated teacher credential surface

## Configurable surfaces (representative checks)

| Configurable | Where | Edit verb | Status |
|---|---|---|---|
| Add teacher | not exposed in seeded proof — admin/people endpoint exists (`POST /api/admin/faculty`), but the proof workspace does not surface it for the demo | n/a | OUT OF DEMO PATH |
| Add student | seeded only; admin/people add-student route exists for non-proof scope | n/a | OUT OF DEMO PATH |
| Assign mentor | mentor allocations are part of the deterministic seed (`PROOF_FACULTY[].permissions`) | n/a | OUT OF DEMO PATH |
| Edit timetable | `runtime.timetableByFacultyId` is reseeded on each proof run | reseed | OUT OF EDIT PATH; refer to "configurability" doc |
| Reassign class/course | not exercised in this demo | n/a | OUT OF DEMO PATH |
| Edit attendance | `PUT /api/academic/offerings/:offeringId/attendance` (teacher) | covered by Phase 6 doc | VERIFIED 200 |
| Edit marks | `PUT /api/academic/offerings/:offeringId/assessment-entries/:kind` | available, not exercised in this run | NOT BLOCKING (talking point) |
| Edit intervention / queue | reassessment acknowledge + resolve endpoints | available, not exercised today | NOT BLOCKING |
| Advance stage | `POST /api/admin/proof-runs/<run>/advance-stage` | available, sysadmin demo can use this if presenter wants | VERIFIED IN ROUTES |
| Reset demo | restart backend = full reset | n/a | TRIVIAL |
| Refresh / relogin | session cookie persists role context | verified | OK |

## Decision: sysadmin flow PASS

- Login OK.
- Bootstrap OK (auto-creates simulation if missing).
- Active proof run + generated teacher credentials available.
- Stage activation 1..6 OK.
- Restart-driven reset is safe by construction.

## Talking-point caveats

1. The proof dashboard does NOT today expose a "create teacher / create
   student" form on the demo path. The seeded proof batch is the
   deterministic 120-student / 10-faculty cohort. Adding new users is
   only required for non-proof institutional scope, which is out of
   tomorrow's demo.
2. The "create simulation" button in the UI currently maps to a
   curriculum-import + run-create + activate sequence. The demo script
   calls this out so the presenter does not over-promise that it
   creates a brand-new universe of data each click.
