# AirMentor Deterministic Rules And Operating Assumptions

## What this area does

This appendix enumerates the hard-coded rules, thresholds, fixed identifiers, precedence orders, fallback behaviors, and operating assumptions that materially control AirMentor’s runtime behavior. It exists because several other audit documents described these behaviors directionally but not exhaustively enough.

## Confirmed observations

- AirMentor’s most trust-sensitive behavior is more deterministic than the product framing first suggests.
- Deterministic behavior is spread across frontend route/storage code, backend session/config logic, academic policy defaults, proof queue governance, proof sandbox seeding, proof control-plane heuristics, and model display gating.
- The most important governing files are:
  - `src/portal-routing.ts`
  - `src/proof-playback.ts`
  - `src/system-admin-live-app.tsx`
  - `src/system-admin-timetable-editor.tsx`
  - `src/system-admin-faculty-calendar-workspace.tsx`
  - `src/pages/risk-explorer.tsx`
  - `src/pages/student-shell.tsx`
  - `src/pages/hod-pages.tsx`
  - `air-mentor-api/src/config.ts`
  - `air-mentor-api/src/app.ts`
  - `air-mentor-api/src/modules/session.ts`
  - `air-mentor-api/src/modules/support.ts`
  - `air-mentor-api/src/modules/admin-requests.ts`
  - `air-mentor-api/src/modules/admin-control-plane.ts`
  - `air-mentor-api/src/modules/admin-structure.ts`
  - `air-mentor-api/src/lib/stage-policy.ts`
  - `air-mentor-api/src/lib/msruas-rules.ts`
  - `air-mentor-api/src/lib/inference-engine.ts`
  - `air-mentor-api/src/lib/monitoring-engine.ts`
  - `air-mentor-api/src/lib/proof-queue-governance.ts`
  - `air-mentor-api/src/lib/proof-run-queue.ts`
  - `air-mentor-api/src/lib/msruas-proof-sandbox.ts`
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
  - `air-mentor-api/src/lib/proof-risk-model.ts`
  - `air-mentor-api/scripts/run-vitest-suite.mjs`
  - `scripts/dev-live.sh`
  - `scripts/live-admin-common.sh`
  - `air-mentor-api/scripts/start-seeded-server.ts`

## Key workflows and contracts

## 1. Frontend route and storage rules

### Portal route precedence

Source: `src/portal-routing.ts`, `src/repositories.ts`

| Rule                    | Exact behavior                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hash parsing            | `#/app` resolves to academic, `#/admin` resolves to admin, anything else defaults to `home` unless storage hints override it.        |
| Admin precedence        | `resolvePortalRoute()` returns `admin` when `AIRMENTOR_STORAGE_KEYS.currentAdminFacultyId` exists.                                   |
| Academic precedence     | If there is no current admin hint,`resolvePortalRoute()` returns `app` when `currentFacultyId` or `legacyCurrentTeacherId` exists. |
| Neutral home limitation | `#/` is not a truly neutral landing state once workspace hints exist in local storage.                                                   |

### Browser storage keys that materially affect behavior

Source: `src/repositories.ts`, `src/proof-playback.ts`, `src/system-admin-live-app.tsx`

| Key                                          | Purpose                                  |
| -------------------------------------------- | ---------------------------------------- |
| `airmentor-theme`                          | Current theme mode                       |
| `airmentor-current-faculty-id`             | Current academic faculty hint            |
| `airmentor-current-admin-faculty-id`       | Current admin faculty hint               |
| `airmentor-current-teacher-id`             | Legacy academic faculty hint             |
| `airmentor-proof-playback-selection`       | Selected proof run/checkpoint            |
| `airmentor-admin-dismissed-queue-items`    | Dismissed queue-item keys in live admin  |
| `airmentor-admin-ui:${routeToHash(route)}` | Session-scoped admin route restore state |

### Proof playback persistence and recovery

Source: `src/proof-playback.ts`, `src/system-admin-live-app.tsx`, `src/App.tsx`

| Rule                        | Exact behavior                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence write rule      | `persistProofPlaybackSelection()` only writes when both `simulationRunId` and `simulationStageCheckpointId` are present.                                                                                                                                                                                                        |
| Step `start`              | Jumps to `firstAccessibleCheckpointIndex`.                                                                                                                                                                                                                                                                                          |
| Step `end`                | Jumps to the last checkpoint before `firstBlockedCheckpointIndex`.                                                                                                                                                                                                                                                                  |
| Step `next`               | Cannot move beyond `firstBlockedCheckpointIndex`.                                                                                                                                                                                                                                                                                   |
| Invalid checkpoint fallback | If academic bootstrap using a stored checkpoint receives `403` or `404`, the app clears `airmentor-proof-playback-selection`, retries bootstrap without the checkpoint, and shows: “The selected proof playback checkpoint is no longer accessible in this academic scope. The portal reverted to the active proof-run view.” |
| Cross-tab synchronization   | Academic proof context listens to `storage` events and reloads proof selection changes across tabs.                                                                                                                                                                                                                                 |

### Admin route restoration contract

Source: `src/system-admin-live-app.tsx`

| Rule             | Exact behavior                                                               |
| ---------------- | ---------------------------------------------------------------------------- |
| Storage medium   | `sessionStorage`                                                           |
| Key shape        | `airmentor-admin-ui:${routeToHash(route)}`                                 |
| Restored fields  | `tab` and `sectionCode`                                                  |
| Scope of restore | Only applied when `route.section === 'faculties'`                          |
| Scroll behavior  | Restoration also uses `pendingScrollRestoreRef` to recover scroll position |

### Faculty calendar and timetable editing rules

Source: `src/system-admin-timetable-editor.tsx`, `src/system-admin-faculty-calendar-workspace.tsx`, `air-mentor-api/src/modules/admin-control-plane.ts`

| Rule                | Exact behavior                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct edit window  | First save starts a 14-day direct-edit window                                                                                                                                                         |
| Lock semantics      | When `classEditingLocked` is true, recurring class edits become read-only                                                                                                                           |
| Marker exception    | Markers remain editable even when class editing is locked                                                                                                                                             |
| Escalation path     | Permanent timetable changes are expected to move through approved HoD requests                                                                                                                        |
| Admin planner scope | Admin-expanded planner intentionally sets `mergedTasks={[]}`, `meetings={[]}`, `allowTaskCreation={false}`, `canOpenCourseWorkspaceOverride={false}`, and `calendarModeLayout="month-only"` |

### Proof UI defaults and visible fallback rules

Source: `src/pages/hod-pages.tsx`, `src/pages/risk-explorer.tsx`, `src/pages/student-shell.tsx`

| Rule                            | Exact behavior                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| HoD default filter              | `showActionNeededOnly` defaults to `true`                                                                                    |
| HoD queue filter                | Uses `resolveGovernedQueueState()` and defaults to rows whose reassessment state resolves to `open`                          |
| Risk head display               | `renderHeadValue()` only shows `%` when `displayProbabilityAllowed !== false`; otherwise it renders band-only              |
| Risk UI band fallback           | `deriveBandLabel()` maps `>= 70` to High, `>= 35` to Medium, else Low                                                      |
| Risk feature completeness label | Rendered as `Graph aware` vs `Policy only`                                                                                   |
| Student shell visible taxonomy  | Assistant bubbles are labeled `Guardrail`, `Session Intro`, or `Deterministic Reply`; user messages are labeled `Prompt` |
| Blocked-stage UI                | Proof surfaces explicitly surface blocked progression through banners or chips rather than silently omitting blocked state       |

## 2. Session, cookie, and origin rules

### Config defaults

Source: `air-mentor-api/src/config.ts`

| Setting                   | Exact default                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `databaseUrl`           | `env.DATABASE_URL ?? env.RAILWAY_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/airmentor'` |
| `port`                  | `4000`                                                                                                         |
| `host`                  | `127.0.0.1`                                                                                                    |
| `corsAllowedOrigins`    | `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, `http://localhost:4173`       |
| `sessionCookieName`     | `airmentor_session`                                                                                            |
| `sessionCookieSecure`   | `false`                                                                                                        |
| `sessionCookieSameSite` | `lax`                                                                                                          |
| `sessionTtlHours`       | `168`                                                                                                          |
| `defaultThemeMode`      | `frosted-focus-light`                                                                                          |

### Cookie and origin behavior

Source: `air-mentor-api/src/app.ts`

| Rule                   | Exact behavior                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CORS credentials       | `true`                                                                                                                         |
| CORS methods           | `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`                                                         |
| No-origin reads        | CORS callback allows requests with no `Origin`                                                                                 |
| No-origin writes       | `POST`, `PUT`, `PATCH`, `DELETE` are rejected with `403 FORBIDDEN_ORIGIN` when `Origin` is absent or not allowlisted |
| Cookie flags           | `httpOnly: true`, `path: '/'`, `sameSite` from config, `secure` from config, `expires` from session expiry             |
| Worker lifecycle       | Proof worker starts unconditionally when the app is built and stops on app close                                                 |
| Runtime health surface | `/`, `/health`, and `/openapi.json` are live runtime endpoints                                                             |

### Session resolution and default-role semantics

Source: `air-mentor-api/src/modules/session.ts`, `air-mentor-api/src/modules/support.ts`

| Rule                      | Exact behavior                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth population           | `registerSessionRoutes()` installs a `preHandler` that resolves `request.auth` from the session cookie on all requests, not only session routes |
| Login identifier behavior | Login field is named `identifier`, but the implementation looks up by username rather than email                                                    |
| Login requirements        | Active `user_accounts` row, configured password hash, active `faculty_profiles` row, and at least one active role grant                           |
| Default role selection    | First item from `sortActiveRoleGrantRows(...)`                                                                                                      |
| Role priority             | `SYSTEM_ADMIN: 0`, `COURSE_LEADER: 1`, `MENTOR: 2`, `HOD: 3`                                                                                  |
| Role tie-breakers         | Earlier `createdAt`, then lexicographic `grantId`                                                                                                 |
| Keepalive behavior        | `GET /api/session` updates `sessions.lastSeenAt` and `sessions.updatedAt` before returning the payload                                          |
| Role switching            | `POST /api/session/role-context` only allows switching to a grant already present in `auth.availableRoleGrants`                                   |
| Preference auto-create    | `ensurePreference()` creates a default UI preference with `themeMode = context.config.defaultThemeMode` and `version = 1`                       |
| Preference concurrency    | `expectVersion()` throws stale-version conflicts on mismatched preference writes                                                                    |

## 3. Request workflow state machine

Source: `air-mentor-api/src/modules/support.ts`, `air-mentor-api/src/modules/admin-requests.ts`

### Enumerated values

- Roles: `SYSTEM_ADMIN`, `HOD`, `COURSE_LEADER`, `MENTOR`
- Priority values: `P1`, `P2`, `P3`, `P4`
- Request statuses: `New`, `In Review`, `Needs Info`, `Approved`, `Rejected`, `Implemented`, `Closed`

### Transition graph

- `New -> In Review | Rejected`
- `In Review -> Needs Info | Approved | Rejected`
- `Needs Info -> In Review | Rejected`
- `Approved -> Implemented | Rejected`
- `Rejected -> Closed`
- `Implemented -> Closed`

### Permission rules

- HoDs can list and create requests.
- Assign, request-info, approve, reject, mark-implemented, and close are system-admin-only.
- `POST /api/admin/requests/:requestId/assign` both claims ownership and forces `In Review`.
- If `ownedByFacultyId` is omitted on assignment, it defaults to the acting admin.
- Typed note categories are first-class: `request-context`, `clarification`, `decision-rationale`, `implementation-note`, `system-note`.

## 4. Default academic policy and stage policy

### Academic policy defaults

Source: `air-mentor-api/src/modules/admin-structure.ts`, `air-mentor-api/src/lib/msruas-rules.ts`

| Area                       | Exact rule                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grade bands                | `O 90-100 gp10`, `A+ 80-89 gp9`, `A 70-79 gp8`, `B+ 60-69 gp7`, `B 55-59 gp6`, `C 50-54 gp5`, `P 40-49 gp4`, `F 0-39 gp0`                |
| CE/SEE split               | `60/40`                                                                                                                                                |
| CE caps                    | term tests `30`, quizzes `10`, assignments `20`, max term tests `2`, max quizzes `2`, max assignments `2`                                    |
| Calendar                   | Mon-Fri,`08:30-16:30`, coursework `16` weeks, exam prep `1`, SEE `3`, total `20`                                                               |
| Attendance minimum         | `75`                                                                                                                                                   |
| Condonation floor          | `65`                                                                                                                                                   |
| Condonation shortage cap   | `10`                                                                                                                                                   |
| SEE eligibility CE minimum | `24`                                                                                                                                                   |
| Pass minima                | CE `24`, SEE `16`, overall `40`                                                                                                                    |
| Pass maxima                | CE `60`, SEE `40`, overall `100`                                                                                                                   |
| Status rounding            | nearest integer before status determination                                                                                                              |
| SGPA/CGPA decimals         | `2`                                                                                                                                                    |
| SGPA model                 | `credit-weighted`                                                                                                                                      |
| CGPA model                 | `credit-weighted-cumulative`                                                                                                                           |
| Failed credits in GPA      | excluded                                                                                                                                                 |
| Repeated course policy     | `latest-attempt`                                                                                                                                       |
| Promotion pass mark        | `40`                                                                                                                                                   |
| Promotion minimum CGPA     | `5`                                                                                                                                                    |
| Promotion rule             | requires no active backlogs                                                                                                                              |
| Risk thresholds            | high attendance below `65`, medium attendance below `75`, high CGPA below `6`, medium CGPA below `7`, high backlogs `2`, medium backlogs `1` |

### Academic rule execution

Source: `air-mentor-api/src/lib/msruas-rules.ts`

| Rule                   | Exact behavior                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Status rounding        | `roundStatusMark` always rounds to nearest integer                                                             |
| Attendance eligibility | `eligible` if attendance >= minimum; `condonable` if >= condonation floor; else `ineligible`               |
| SEE eligibility        | `attendanceEligible && ceRounded >= minimumCeForSee`                                                           |
| Pass rule              | `attendanceEligible && ceRounded >= ceMinimum && seeRounded >= seeMinimum && overallRounded >= overallMinimum` |
| Failed grade handling  | Failed courses are forced to grade `F` and grade point `0`                                                   |
| SGPA failed credits    | Excluded when `includeFailedCredits` is false                                                                  |

### Stage policy defaults

Source: `air-mentor-api/src/lib/stage-policy.ts`

| Stage                | Order | Day offset | Required evidence | Color       | Advancement                           |
| -------------------- | ----- | ---------- | ----------------- | ----------- | ------------------------------------- |
| `pre-tt1`          | `1` | `0`      | `attendance`    | `#2D8AF0` | `admin-confirmed`                   |
| `post-tt1`         | `2` | `35`     | `tt1`           | `#F59E0B` | inherited canonical stage progression |
| `post-tt2`         | `3` | `77`     | `tt2`           | `#8B5CF6` | inherited canonical stage progression |
| `post-assignments` | `4` | `98`     | `assignment`    | `#F97316` | inherited canonical stage progression |
| `post-see`         | `5` | `119`    | `finals`        | `#EF4444` | inherited canonical stage progression |

Additional rule:

- `canonicalizeStagePolicy()` falls back to `DEFAULT_STAGE_POLICY` when parsing fails or no override exists.

## 5. Observable inference and monitoring rules

### Observable inference

Source: `air-mentor-api/src/lib/inference-engine.ts`

| Rule                  | Exact behavior                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Baseline risk         | starts at `0.08`                                                                           |
| Final clamp           | bounded to `[0.05, 0.95]`                                                                  |
| Risk bands            | High `>= 0.7`, Medium `>= 0.35`, else Low                                                |
| Attendance driver     | `+0.28` if below high-risk threshold, `+0.14` if below medium-risk threshold             |
| CGPA driver           | `+0.2` if below high-risk threshold, `+0.1` if below medium-risk threshold               |
| Backlog driver        | `+0.18` if >= high-risk backlog threshold, `+0.09` if >= medium-risk threshold           |
| TT1/TT2/SEE driver    | `+0.16` if pct < `40`, `+0.08` if pct < `55`                                         |
| Attendance history    | `+0.08` if attendance-history risk count >= `2`                                          |
| Question weakness     | `+0.09` if count >= `4`, `+0.05` if count >= `2`                                     |
| Quiz / assignment     | `+0.06` each if pct < `45`                                                               |
| Weak course outcomes  | `+0.1` if weak CO count >= `2`, `+0.05` if exactly `1`                               |
| Intervention response | `+0.08` if < `-0.05`, `-0.05` if > `0.08`                                            |
| Action text           | High = immediate mentor follow-up; Medium = monitored reassessment; Low = routine monitoring |

### Monitoring engine

Source: `air-mentor-api/src/lib/monitoring-engine.ts`

| Condition       | Decision     | Queue owner       | Due               | Cooldown          |
| --------------- | ------------ | ----------------- | ----------------- | ----------------- |
| Cooldown active | `suppress` | `Course Leader` | existing          | existing          |
| High risk       | `alert`    | `Mentor`        | `now + 3 days`  | `now + 7 days`  |
| Medium risk     | `watch`    | `Course Leader` | `now + 7 days`  | `now + 10 days` |
| Low risk        | `suppress` | `Course Leader` | `now + 14 days` | `now + 14 days` |

Additional notes:

- High-risk note text changes depending on persistence across windows.
- Medium-risk note text changes depending on prior high risk or weak recovery residual `< -0.03`.

## 6. Proof queue and worker rules

### Queue governance constants

Source: `air-mentor-api/src/lib/proof-queue-governance.ts`

| Constant                     | Exact value |
| ---------------------------- | ----------- |
| Default actionable rate      | `0.3`     |
| Late-stage actionable rate   | `0.35`    |
| Section excess tolerance     | `0.1`     |
| Watch rate limit             | `0.45`    |
| Actionable PPV proxy minimum | `0.55`    |
| Medium-risk actionable lift  | `5`       |
| High-risk actionable lift    | `2`       |

### Queue governance rules

- `post-see` uses actionable rate `0.35`; all earlier stages use `0.3`.
- Risk band weights: High `2`, Medium `1`, Low `0`.
- `pre-tt1` is observation-only and never opens the actionable queue.
- `post-tt1` Medium + `diffuse-amber` is watch-only.
- High risk becomes actionable when lift >= `2`.
- Medium risk becomes actionable when not `diffuse-amber` and lift >= `5`.
- Section capacity is `floor(sectionStudentCount * actionableRateLimitForStage(stageKey))`.

### Queue worker constants

Source: `air-mentor-api/src/lib/proof-run-queue.ts`

| Constant           | Exact value   |
| ------------------ | ------------- |
| Poll interval      | `5_000 ms`  |
| Lease duration     | `60_000 ms` |
| Heartbeat interval | `15_000 ms` |

### Queue metadata assumptions

- MSRUAS proof batch assumptions:
  - `sectionCount: 2`
  - `studentCount: 120`
  - `facultyCount: PROOF_FACULTY.length`
  - `semesterStart: 1`
  - `semesterEnd: 6`
  - `sourceType: 'simulation'`
  - `metrics.proofGoal = 'adaptation-readiness'`
  - section distribution `A: 60`, `B: 60`
- Non-proof batches fall back to live runtime mode and can enter `queueState = 'waiting-for-term'`.
- New queued runs default `runSeed` to `Math.floor(Date.now() % 100000)`.
- New queued runs default `activateRequested` to `true`.
- Default run labels:
  - `MSRUAS proof rerun <seed>`
  - `Live batch proof run <seed>`

## 7. Seeded proof sandbox assumptions

Source: `air-mentor-api/src/lib/msruas-proof-sandbox.ts`

### Fixed identifiers

- `MSRUAS_PROOF_DEPARTMENT_ID = 'dept_cse'`
- `MSRUAS_PROOF_BRANCH_ID = 'branch_mnc_btech'`
- `MSRUAS_PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'`
- `MSRUAS_PROOF_SIMULATION_RUN_ID = 'sim_mnc_2023_first6_v1'`
- `MSRUAS_PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'`

### Fixed world assumptions

- Proof world covers semesters `1-6`.
- Batch has `120` students across sections `A` and `B`, `60` each.
- `PROOF_FACULTY` is a fixed list of `10` faculty identities with hard-coded usernames, IDs, and permissions.
- Lab-like course detection uses title/profile matches on `lab`, `project`, or `workshop`.

## 8. Proof control-plane visibility, phenotype, and action rules

Source: `air-mentor-api/src/lib/msruas-proof-control-plane.ts`

### Global versions and constants

- `INFERENCE_MODEL_VERSION = 'observable-inference-v2'`
- `MONITORING_POLICY_VERSION = 'monitoring-policy-v2'`
- `WORLD_ENGINE_VERSION = 'world-engine-v2'`
- `RISK_ARTIFACT_REBUILD_PAGE_SIZE = 10_000`
- `STUDENT_AGENT_CARD_VERSION = 1`
- `POLICY_EFFICACY_SUPPORT_THRESHOLD = 250`

### Visibility rules

- Course leaders see proof queue items only for owned offerings.
- Mentors see proof queue items only for assigned students.
- Other faculty views use offering ownership or assigned-student scope.
- HoD faculty-profile access in `admin-control-plane.ts` is based on overlapping department/branch appointments, not a blanket HoD permission.

### Reassessment outcome credits

| Outcome                         | Credit    |
| ------------------------------- | --------- |
| `completed_awaiting_evidence` | `0.02`  |
| `completed_improving`         | `0.05`  |
| `not_completed`               | `-0.05` |
| `no_show`                     | `-0.08` |
| `switch_intervention`         | `-0.01` |
| `administratively_closed`     | `0`     |

Additional rules:

- `completed_improving` is the only outcome that maps to `confirmed_improvement`; all others remain `under_watch`.
- Intervention completion is explicit when provided, else inferred from `interventionCompletionProb >= 0.5`.

### Checkpoint evidence shaping

- Attendance checkpoint counts:
  - `pre-tt1: 1`
  - `post-tt1: 2`
  - `post-tt2: 3`
  - `post-assignments: 4`
  - `post-see: 4`
- Question components:
  - `pre-tt1: []`
  - `post-tt1: [tt1]`
  - `post-tt2` and `post-assignments: [tt1, tt2]`
  - `post-see: [tt1, tt2, see]`

### Phenotypes and action space

- Phenotypes:
  - `attendance-dominant`
  - `prerequisite-dominant`
  - `academic-weakness`
  - `persistent-nonresponse`
  - `late-semester-acute`
  - `diffuse-amber`
- Precedence order:
  - `late-semester-acute`
  - `persistent-nonresponse`
  - `prerequisite-dominant`
  - `academic-weakness`
  - `attendance-dominant`
  - `diffuse-amber`
- Available actions:
  - `no-action`
  - `alert-only`
  - `faculty-outreach`
  - `mentor-outreach`
  - `attendance-recovery-follow-up`
  - `prerequisite-bridge`
  - `targeted-tutoring`
  - `structured-study-plan`
  - `outreach-plus-tutoring`
  - plus `pre-see-rescue` for `post-tt2`, `post-assignments`, `post-see`

### Action-cost and comparator rules

| Action                                                   | Capacity cost |
| -------------------------------------------------------- | ------------- |
| `outreach-plus-tutoring`                               | `0.95`      |
| `pre-see-rescue`                                       | `0.82`      |
| `targeted-tutoring` / `prerequisite-bridge`          | `0.68`      |
| `mentor-outreach` / `mentor-check-in`                | `0.54`      |
| `attendance-recovery-follow-up` / `faculty-outreach` | `0.36`      |
| `structured-study-plan`                                | `0.22`      |
| `alert-only`                                           | `0.12`      |
| `no-action` / default                                  | `0`         |

Utility formula:

- `0.35 * (nextCheckpointBenefitScaled / 10)`
- `+ 0.35 * stableRecoveryScore`
- `+ 0.2 * (semesterCloseBenefitScaled / 10)`
- `- 0.05 * relapsePenalty`
- `- 0.05 * capacityCost`

Recommendation-clearing rules:

- No recommendation for Low risk.
- No recommendation when best action is `no-action`.
- No recommendation when `no-action` utility >= best non-no-action utility.

### Student shell guardrails

- Intro text explicitly frames the shell as deterministic and bounded.
- Prompt classifier blocks:
  - empty prompt
  - override attempts
  - future certainty
  - cross-student disclosure
  - hidden internals
- Special deterministic routes:
  - current performance
  - topic and course outcome weakness
  - reassessment status
  - intervention history
  - elective fit
  - no-action comparator
  - compare semesters

### Scenario-head rules

- `overallRisk = clamp(currentRisk / 100, 0.05, 0.95)`
- `backlogPressure = backlogCount / 4`
- `lowCgpaPressure = (7.5 - currentCgpa) / 4`
- `coPressure = weakCoCount / 4`
- `transferGapPressure = transferGapCount / 5`
- Derived scenario outputs:
  - semester SGPA drop = `overall*0.55 + backlog*0.2 + trend*0.25`
  - cumulative CGPA drop = `overall*0.45 + backlog*0.25 + lowCgpa*0.3`
  - elective mismatch uses overall/co/transfer/backlog weighted blend when elective-fit context exists

## 9. Proof risk-model versions and probability-display gates

Source: `air-mentor-api/src/lib/proof-risk-model.ts`

### Versions

- `RISK_FEATURE_SCHEMA_VERSION = 'observable-risk-features-v3'`
- `RISK_PRODUCTION_MODEL_VERSION = 'observable-risk-logit-v5'`
- `RISK_CHALLENGER_MODEL_VERSION = 'observable-risk-stump-v4'`
- `RISK_CORRELATION_ARTIFACT_VERSION = 'observable-risk-correlations-v4'`
- `RISK_CALIBRATION_VERSION = 'post-hoc-calibration-v1'`
- `PROOF_CORPUS_MANIFEST_VERSION = 'proof-corpus-v1'`

### Production thresholds

- Medium risk threshold: `0.4`
- High risk threshold: `0.85`

### Corpus manifest assumptions

- `64` seeds
- seed formula `101 + index * 101`
- split:
  - first `40` train
  - next `12` validation
  - last `12` test
- scenario families cycle through:
  - `balanced`
  - `weak-foundation`
  - `low-attendance`
  - `high-forgetting`
  - `coursework-inflation`
  - `exam-fragility`
  - `carryover-heavy`
  - `intervention-resistant`

### Probability display gates

| Head                      | ECE limit | Positive minimum |
| ------------------------- | --------- | ---------------- |
| attendance risk           | `0.08`  | `100`          |
| SEE risk                  | `0.08`  | `100`          |
| overall course risk       | `0.08`  | `100`          |
| downstream carryover risk | `0.1`   | `100`          |

Rules:

- `ceRisk` never displays a probability.
- Other heads display probabilities only when:
  - held-out support >= `1000`
  - held-out positives >= minimum
  - ECE <= head-specific limit
- Otherwise the UI shows bands and support warnings.

### Fallback scoring

- If no active artifact exists or feature schema mismatches:
  - `modelVersion = 'observable-inference-v2'`
  - `calibrationVersion = null`
  - all head probabilities fall back to the heuristic `riskProb`
  - queue priority equals fallback `riskProb`
  - `displayProbabilityAllowed = false`
  - support warning says no active trained artifact is available

## 10. Test, CI, and local-live operating assumptions

### Backend suite partitioning

Source: `air-mentor-api/scripts/run-vitest-suite.mjs`

- Fast suite excludes:
  - `air-mentor-api/tests/hod-proof-analytics.test.ts`
  - `air-mentor-api/tests/risk-explorer.test.ts`
  - `air-mentor-api/tests/student-agent-shell.test.ts`
- Proof-heavy inclusion is controlled by `AIRMENTOR_BACKEND_SUITE=proof-rc`.
- Child Vitest runs receive `AIRMENTOR_PROOF_RC=1` or `0`.

### Integrated verification entrypoints

Source: `package.json`

- `verify:proof-closure` runs:
  - backend build
  - frontend build
  - backend tests
  - frontend tests
  - live proof-risk Playwright smoke
- `verify:proof-closure:proof-rc` adds backend proof-rc coverage.
- `verify:proof-closure:live` runs live proof-risk smoke directly.

### Seeded live-stack assumptions

Source: `scripts/dev-live.sh`, `scripts/live-admin-common.sh`, `air-mentor-api/scripts/start-seeded-server.ts`

- Embedded Postgres is used for seeded live verification.
- API port is dynamically allocated by default.
- Seed time defaults to `2026-03-16T00:00:00.000Z`.
- Session expiry intentionally uses wall-clock time even while seeded academic data remains deterministic.
- Local live mode assumes same-origin proxying:
  - `AIRMENTOR_UI_PROXY_API_TARGET="$api_base_url"`
  - `VITE_AIRMENTOR_API_BASE_URL="/"`.

## 11. Faculty Timetable Provisioning Rules (Critical Component Analysis)

Source: `air-mentor-api/src/lib/academic-provisioning.ts`

**What it does (Technical):**
This 118-line file artificially generates faculty timetables from scratch. It takes a list of faculty teaching loads and iteratively assigns them to fixed weekly grid slots. It relies on a custom deterministic pseudo-random hashing function (`stableUnit`) seeded by the `facultyId`. It uses primitive string matching to find words like 'lab' or 'workshop' (`isLabLikeCourse`), boosting the required contact hours for those courses. It then walks through a fixed 6-slot day (08:30 to 15:30), penalizes slots that clump classes together on the same day, and forcibly injects the courses.

**What it means (Non-Technical):**
When administrators look at the "Faculty Calendar" in the UI, they are seeing a generated illusion. Rather than loading real historical timetables, this script uses a math formula to aggressively play Tetris with the faculty's classes until their required hours are met. It ensures that every time you reset the sandbox, the calendar looks exactly the same, but it doesn't represent actual rooms or student conflicts.

**Identified Issues & Gaps:**
1. **Naïve Hardcoded Slots:** The script assumes the university runs exactly 6 strictly defined time slots from 08:30 to 15:30. It cannot handle evening classes, irregular block seminars, or dynamic scheduling. 
2. **Silent Capacity Crashes:** If a faculty member's teaching load exceeds available slots in the grid, the script throws a fatal error (`Timetable builder exhausted weekly slot capacity`) and crashes the entire bootstrapping process, rather than gracefully degrading or flagging a conflict.
3. **Fragile String Matching:** The determination of whether a class is a "Lab" (which doubles its hour footprint) is based on looking for the string "lab", "project", or "workshop" in the title. A course titled "Laboratory Diagnostics" would silently miss the trigger if spelled out, breaking load assumptions.

## Findings

### Summary judgment

AirMentor’s runtime behavior is governed by a larger deterministic policy surface than the original audit made explicit. The system is not just “AI with some rules around it.” It is a layered rule engine, seeded simulation harness, access-control lattice, and display-gating system whose trust characteristics depend on those exact constants and fallbacks staying visible and reviewable.

## Implications

- **User impact:** many visible behaviors that could look arbitrary are actually deterministic, but only if the team documents them clearly enough for operators and reviewers to understand them.
- **Product impact:** the product promise is only trustworthy when the deterministic limits are explicit, because the UX uses labels like “student shell” and “risk explorer” that can otherwise be overread.
- **Engineering impact:** changing thresholds, defaults, or precedence orders without a maintained appendix creates silent product drift.

## Recommendations

1. Keep this appendix versioned with every rule or threshold change in the governing files above.
2. Treat deterministic-policy review as part of product review, not only backend implementation review.
3. Add automated checks or golden tests for the highest-trust constants:
   - session defaults
   - request transitions
   - stage policy defaults
   - proof queue thresholds
   - probability-display suppression gates
4. Surface the most user-visible deterministic rules directly in the UI:
   - restored-state banners
   - stage-blocked explanations
   - band-only probability suppression reasons
   - timetable lock-window messaging

## Confirmed facts vs inference

### Confirmed facts

- Every rule above is grounded in source code or test/runtime scripts named in this document.
- Frontend-visible behaviors and backend constants both materially shape what users see.

### Reasonable inference

- A large share of AirMentor’s trustworthiness comes from deterministic restraint, but that advantage is lost if the governing rules remain implicit.

## Cross-links

- [00 Executive Summary](./00-executive-summary.md)
- [07 Auth Security And Privacy Audit](./07-auth-security-and-privacy-audit.md)
- [08 State Management And Client Logic Audit](./08-state-management-and-client-logic-audit.md)
- [09 Testing Quality And Observability Audit](./09-testing-quality-and-observability-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [18 Proof Sandbox And Curriculum Linkage Audit](./18-proof-sandbox-and-curriculum-linkage-audit.md)
