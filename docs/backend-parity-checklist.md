# Backend Parity Checklist (Mock UI -> Real Data)

## Scope
This checklist maps mock UI fields to concrete backend tables and API changes so teaching/mentor/HoD flows can run without mock data.

Legend:
- Status: `Done`, `In Progress`, `Pending`
- API: current and required payload surface

## 1. Auth & Teacher Login

| UI Expectation | Backend Table | API Change | Status |
|---|---|---|---|
| Teacher logs in with username + password | `user_accounts.username`, `user_password_credentials.password_hash` | `POST /api/session/login` now validates username only + password hash | Done |
| Login list shows teacher identity | `faculty_profiles`, `user_accounts` | `GET /api/academic/public/faculty` includes `username`, `displayName`, `designation`, `departmentCode` | Done |

## 2. Student Card / Roster Metrics

| Mock Field | Backend Table | API Projection Needed | Status |
|---|---|---|---|
| `present`, `totalClasses` | `student_attendance_snapshots` | Populate per `(studentId, offeringId)` in `studentsByOffering[*]` | Done |
| `tt1Score`, `tt1Max`, `tt2Score`, `tt2Max`, `quiz1`, `quiz2`, `asgn1`, `asgn2` | `student_assessment_scores` | Populate latest per component type in `studentsByOffering[*]` | Done |
| `prevCgpa` | `student_academic_profiles.prev_cgpa_scaled` | Already projected | Done |
| `riskProb`, `riskBand`, `reasons`, `coScores`, `whatIf` | (future AI/analytics tables) | Keep nullable placeholders until risk engine lands | In Progress |
| `interventions[]` | `student_interventions` | Map to student row interventions in `studentsByOffering[*]` | Done |

## 3. Mentor / Mentee View

| Mock Field | Backend Table | API Projection Needed | Status |
|---|---|---|---|
| `mentee.courseRisks[]` | Derived from `section_offerings` + enrollment + analytics (future risk score) | Return course scope now (`risk=-1`, `band=Low` placeholder until AI) | Done |
| `mentee.interventions[]` | `student_interventions` | Return latest interventions for assigned mentees | Done |
| `mentee.avs` | future risk aggregate table | Populate from analytics once scoring pipeline is ready | Pending |

## 4. Student History / Transcript

| Mock Field | Backend Table | API Projection Needed | Status |
|---|---|---|---|
| `terms[].sgpa`, credits, backlog | `transcript_term_results` | Map to `studentHistoryByUsn[usn].terms[]` | Done |
| `terms[].subjects[]` (code/title/credits/score/grade/result) | `transcript_subject_results` | Map nested transcript subjects per term result | Done |
| `trend`, `advisoryNotes` | policy/analytics advisory source | Keep basic fallback until analytics/advisory rules are added | In Progress |

## 5. Runtime Slices (Academic Workspace State)

| Runtime Slice | Validation Requirement | API Route | Status |
|---|---|---|---|
| `studentPatches` | top-level record validation | `PUT /api/academic/runtime/:stateKey` | Done |
| `schemeByOffering` | top-level record validation | same | Done |
| `ttBlueprintsByOffering` | nested record validation | same | Done |
| `drafts`, `cellValues`, `resolvedTasks` | numeric record validation | same | Done |
| `lockByOffering`, `lockAuditByTarget` | structured record/array validation | same | Done |
| `tasks` | array-of-object validation (`id`, `studentId`, `offeringId`, `title`) | same | Done |
| `timetableByFacultyId`, `adminCalendarByFacultyId` | structured object validation | same | Done |
| `taskPlacements`, `calendarAudit` | structured record/array validation | same | Done |

## 6. New Tables Introduced for Parity Wiring

1. `student_attendance_snapshots`
2. `student_assessment_scores`
3. `student_interventions`
4. `transcript_term_results`
5. `transcript_subject_results`

Migration file: `air-mentor-api/src/db/migrations/0004_academic_assessment_and_history.sql`

## 7. Remaining Build-Out (Non-AI + AI)

### Non-AI (next)
1. Add admin/teaching write APIs for attendance snapshots and assessment scores (currently read projection ready, write flows pending).
2. Add API endpoints for intervention create/update history timeline.
3. Backfill transcript rows from legacy sources/import pipeline.
4. Add uniqueness/versioning rules for assessment components per term and offering.

### AI (later)
1. Risk probability and band computation tables.
2. Explainability payload (`reasons`, `coScores`, `whatIf`) materialization.
3. AVS/mentor aggregate metrics computation and serving.

## 8. Suggested API Contracts to Add Next

1. `POST /api/admin/attendance-snapshots`
2. `POST /api/admin/assessment-scores`
3. `POST /api/admin/student-interventions`
4. `GET /api/academic/student/:studentId/transcript` (optional detail endpoint)
5. `POST /api/admin/transcript/import` (bulk write for term/subject results)

## 9. Acceptance Criteria

1. Teaching login works only with username/password.
2. `GET /api/academic/bootstrap` contains non-null attendance/assessment fields when data exists.
3. Student history page shows real term/subject rows when transcript tables are populated.
4. Mentor page shows real intervention entries from persisted table.
5. Runtime write endpoint rejects malformed payloads per slice schema.
