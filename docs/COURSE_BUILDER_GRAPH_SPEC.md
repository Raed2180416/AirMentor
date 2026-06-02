# COURSE GRAPH BUILDER: COMPLETE CONFIGURATION SPEC
## AirMentor — Create a Course From Scratch

**Date:** 2026-05-31

---

## 1. PHILOSOPHY

A "course" in AirMentor is a **risk-generating configuration** that determines:
1. Which features are observed at each of the 5 stages
2. How those features combine into CE/SEE/attendance scores
3. How risk labels are computed for every student archetype
4. What HOD, Mentor, and Course Leader see at each stage
5. How downstream carryover propagates across semesters

**The ML model must learn from courses.** If a new course has 3 term tests instead of 2, the feature vector changes. The model must still predict risk. This means the feature schema must be **course-configurable but model-invariant**.

---

## 2. COURSE IDENTITY (Static Metadata)

### Core Identification

| Field | Type | Product Intent | ML Impact |
|-------|------|---------------|-----------|
| `courseId` | UUID | Unique identifier | Feature: course embedding index |
| `courseCode` | String (e.g., "CSE101") | Human-readable, department-structured | Feature: dept prefix embedding |
| `title` | String (e.g., "Programming in C") | Display name in all UIs | None (metadata only) |
| `departmentId` | UUID | Scoped to HOD view | Feature: one-hot dept |
| `credits` | Integer (1-6) | SGPA/CGPA weight, degree progress | Feature: credit-weighted risk |
| `theoryCredits` | Float | Lecture hours | Feature: theory-to-lab ratio |
| `labCredits` | Float | Practical hours | Feature: lab-heavy indicator |
| `semesterSlot` | Integer (1-8) | Which semester this belongs to | Feature: semester depth |
| `courseType` | Enum | `core`, `elective`, `bridge`, `project` | Feature: type embedding |
| `gradingScheme` | Enum | `absolute`, `relative`, `mixed` | Label engine: pass threshold logic |

### Governance & Lifecycle

| Field | Type | Product Intent |
|-------|------|---------------|
| `status` | `draft`, `active`, `archived` | Course Leaders cannot enter scores on draft |
| `version` | Integer | Schema evolution tracking |
| `createdByFacultyId` | UUID | Audit trail |
| `reviewedByHodId` | UUID | HOD approval gate before activation |
| `validForBatches` | BatchId[] | Which batches this applies to |

---

## 3. ASSESSMENT STRUCTURE (The Heart of Risk)

### 3.1 Governed Constraints

AirMentor enforces these rules at configuration time:

```
CE_MAX = 60 marks
SEE_MAX = 60 marks
PASS_THRESHOLD = 40% of total = 48/120
CE_PASS_THRESHOLD = 40% of CE = 24/60 (to be eligible for SEE)
ATTENDANCE_MIN = 75% (to be eligible for SEE)
TT_COUNT in {1, 2, 3}
```

Product intent: Course Leaders cannot create arbitrary structures that break university policy.

### 3.2 Term Tests (TT)

| Config Field | Type | Product Intent | Feature | Stage Missing |
|-------------|------|---------------|---------|--------------|
| `ttCount` | Integer (1-3) | How many term tests | N/A | N/A |
| `tt[i].name` | String | Display name | `component_name` | N/A |
| `tt[i].maxMarks` | Integer (5-30) | Full marks | `tt{i}_max` | pre-tt1 |
| `tt[i].weightInCe` | Float | CE contribution | `tt{i}_weight` | pre-tt1 |
| `tt[i].conductedInWeek` | Integer | Relative week | `tt{i}_timing` | pre-tt1 |

Features generated:
- `tt_score_raw`, `tt_score_pct`, `tt_score_normalized`
- `tt_missing_flag`, `tt_late_flag`

### 3.3 Quizzes

| Config Field | Type | Product Intent | Feature | Stage Missing |
|-------------|------|---------------|---------|--------------|
| `quizCount` | Integer (0-5) | Number of quizzes | N/A | N/A |
| `quiz[i].name` | String | Display name | `component_name` | N/A |
| `quiz[i].maxMarks` | Integer (5-20) | Full marks | `quiz{i}_max` | pre-tt1 |
| `quiz[i].weightInCe` | Float | CE contribution | `quiz{i}_weight` | pre-tt1 |
| `quiz[i].surprise` | Boolean | Pop quiz vs scheduled | `quiz{i}_surprise` | pre-tt1 |
| `quiz[i].bestOfN` | Integer | Only best N count | `quiz{i}_aggregation` | pre-tt1 |

Features generated:
- `quiz_score_raw`, `quiz_score_pct`, `quiz_score_normalized`
- `quiz_avg_pct`, `quiz_count_taken`, `quiz_missing_count`

Product intent: Surprise pop quizzes stress `high-forgetting` archetypes more than `balanced`.

### 3.4 Assignments

| Config Field | Type | Product Intent | Feature | Stage Missing |
|-------------|------|---------------|---------|--------------|
| `assignmentCount` | Integer (0-5) | Number of assignments | N/A | N/A |
| `assignment[i].name` | String | Display name | `component_name` | N/A |
| `assignment[i].maxMarks` | Integer (5-30) | Full marks | `assign{i}_max` | pre-tt1 |
| `assignment[i].weightInCe` | Float | CE contribution | `assign{i}_weight` | pre-tt1 |
| `assignment[i].type` | Enum | `individual`, `group`, `project` | `assign{i}_type` | pre-tt1 |
| `assignment[i].submissionType` | Enum | `online`, `offline`, `demo` | `assign{i}_mode` | pre-tt1 |
| `assignment[i].deadlineWeek` | Integer | Relative week | `assign{i}_timing` | pre-tt1 |
| `assignment[i].latePenaltyPct` | Float | % deducted per day late | `assign{i}_penalty` | pre-tt1 |

Features generated:
- `assign_score_raw`, `assign_score_pct`, `assign_score_normalized`
- `assign_avg_pct`, `assign_late_submission_count`, `assign_missing_count`

Product intent: Group assignments help `weak-foundation` students (peer learning). Individual assignments stress `exam-fragility` students.

### 3.5 Labs / Practicals

| Config Field | Type | Product Intent | Feature | Stage Missing |
|-------------|------|---------------|---------|--------------|
| `labCount` | Integer (0-12) | Number of lab sessions | N/A | N/A |
| `lab[i].maxMarks` | Integer (per session) | Marks per session | `lab{i}_max` | pre-tt1 |
| `lab[i].weightInCe` | Float | CE contribution | `lab{i}_weight` | pre-tt1 |
| `lab[i].mandatoryAttendance` | Boolean | Must attend to get marks | `lab{i}_mandatory` | pre-tt1 |
| `lab[i].vivaComponent` | Boolean | Viva attached to lab | `lab{i}_viva` | pre-tt1 |

Features generated:
- `lab_score_raw`, `lab_score_pct`
- `lab_attendance_pct`, `lab_viva_score`

Product intent: Lab-heavy courses favor `balanced` students with consistent effort. They disadvantage `high-forgetting` students who cram.

### 3.6 CE Aggregation Formula

```
ce_total = sum(tt_i_score_raw * tt_i_weightInCe / tt_i_maxMarks) +
           sum(quiz_i_score_raw * quiz_i_weightInCe / quiz_i_maxMarks) +
           sum(assign_i_score_raw * assign_i_weightInCe / assign_i_maxMarks) +
           sum(lab_i_score_raw * lab_i_weightInCe / lab_i_maxMarks)

ce_pct = (ce_total / 60) * 100
ce_eligible = ce_pct >= 40
ce_risk = 1 if ce_pct < 40 else 0
```

Product surface:
- Real-time CE calculator as scores are entered
- "Ineligible for SEE" warning when `ce_pct` drops below 40

---

## 4. SEE CONFIGURATION

### 4.1 SEE Structure

| Config Field | Type | Product Intent | Feature | Stage Missing |
|-------------|------|---------------|---------|--------------|
| `seeMaxMarks` | Integer (60) | Full SEE marks | `see_max` | pre-tt1 |
| `seeMinPassMarks` | Integer (24) | 40% of max | `see_threshold` | pre-tt1 |
| `seeDurationHours` | Integer (2-4) | Exam length | `see_duration` | pre-tt1 |
| `seeType` | Enum | `written`, `practical`, `viva`, `mixed` | `see_type` | pre-tt1 |
| `seePattern` | Enum | `objective`, `subjective`, `mixed` | `see_pattern` | pre-tt1 |
| `seeBacklogAllowed` | Boolean | Can backlog students appear? | `see_backlog_flag` | pre-tt1 |
| `seeGraceMarks` | Integer (0-5) | Grace passing margin | `see_grace` | pre-tt1 |

### 4.2 SEE Score Features

- `see_score_raw`, `see_score_pct`, `see_score_normalized`
- `see_missing_flag`, `see_absent_flag`, `see_backlog_flag`

### 4.3 SEE Risk Label

```python
see_risk = 1 if (
    see_score_pct < 40 or
    see_absent_flag == 1 or
    (ce_eligible == False and see_backlog_allowed == False)
) else 0
```

Product intent: A student who is CE-ineligible cannot sit for SEE unless backlog students are allowed.

---

## 5. ATTENDANCE CONFIGURATION

### 5.1 Attendance Rules

| Config Field | Type | Product Intent | Feature |
|-------------|------|---------------|---------|
| `minAttendancePct` | Float (75) | Eligibility threshold | `attendance_threshold` |
| `attendanceGracePct` | Float (5) | Leniency buffer | `attendance_grace` |
| `medicalExemptionAllowed` | Boolean | Medical leave counts as present | `medical_exempt_flag` |
| `maxMedicalDays` | Integer | Cap on medical exemptions | `medical_cap` |
| `attendanceWeightInCe` | Float (0) | Does attendance contribute to CE? | `attendance_in_ce` |
| `attendancePenaltyPolicy` | Enum | `none`, `grade_reduction`, `see_ineligible`, `both` | `attendance_penalty_type` |

### 5.2 Attendance Features

- `attendance_pct`, `attendance_present_days`, `attendance_total_days`
- `attendance_missing_days`, `attendance_medical_days`, `attendance_late_days`
- `attendance_consecutive_absent`

**CRITICAL:** Attendance is a semester-level property. It must be **identical across all 5 stages** within the same semester.

---

## 6. COURSE GRAPH LINKS

### Link Types

| Link Type | Meaning | Feature Impact |
|-----------|---------|--------------|
| `prerequisite` | Must pass before taking this | `prereq_failed_flag`, `prereq_passed_count` |
| `corequisite` | Must take simultaneously | `coreq_active_flag`, `coreq_risk_correlation` |
| `soft_prerequisite` | Recommended but not enforced | `prereq_weak_flag` |
| `advanced_followup` | This course builds on another | `advanced_depth_score` |

### Prerequisite Configuration

| Config Field | Type | Product Intent |
|-------------|------|---------------|
| `prerequisiteCourseIds` | CourseId[] | Hard block on enrollment |
| `prerequisiteMinGrade` | Enum (`A`, `B`, `C`, `pass`) | Grade threshold |
| `prerequisiteWaivableByHod` | Boolean | HOD can override |
| `prerequisiteRiskBoost` | Float | How much prior failure boosts current risk |

---

## 7. FEATURE SCHEMA: WHAT THE ML MODEL SEES

### 7.1 Feature Categories

| Category | Example Features | Stage Availability |
|----------|---------------|-------------------|
| **Student static** | archetype, section, admission_year | All stages |
| **Course static** | credits, theoryCredits, labCredits, courseType, semesterSlot | All stages |
| **Assessment config** | ttCount, quizCount, assignmentCount | All stages |
| **Historical** | prev_sem_cgpa, prev_sem_backlog_count | pre-tt1 only |
| **Attendance** | attendance_pct, attendance_consecutive_absent | All stages |
| **TT scores** | tt1_score_normalized, tt2_score_normalized | post-tt1 onwards |
| **Quiz scores** | quiz_avg_normalized, quiz_count_taken | post-tt1 onwards |
| **Assignment scores** | assign_avg_normalized, assign_missing_count | post-tt1 onwards |
| **Lab scores** | lab_avg_normalized, lab_attendance_pct | post-tt1 onwards |
| **CE aggregate** | ce_pct, ce_eligible_flag | post-assignments |
| **SEE** | see_score_normalized, see_absent_flag | post-see only |
| **Downstream** | downstream_carryover_flag, backlog_credits | pre-tt1 |
| **Graph** | prereq_passed_count, prereq_failed_count | pre-tt1 |

### 7.2 Stage-Aware Missingness

| Stage | Observed | Missing (set to NaN) |
|-------|----------|----------------------|
| pre-tt1 | attendance, historical, course config, graph | ALL assessment scores, CE, SEE |
| post-tt1 | + TT1 score, some early quizzes/assignments | TT2, TT3, later components, CE, SEE |
| post-tt2 | + TT2 score, more components | TT3 (if exists), CE, SEE |
| post-assignments | + ALL internals, CE total | SEE only |
| post-see | + SEE score | Nothing (complete information) |

ML implication: The model must be trained with stage flags and learn that missing features at early stages mean "not yet observed."

---

## 8. RISK HEADS: HOW LABELS ARE COMPUTED

### 8.1 Label Engine Logic

```python
# Attendance risk (semester-level, constant across stages)
attendance_risk = 1 if attendance_pct < minAttendancePct else 0

# CE risk (deterministic at post-assignments)
ce_risk = 1 if ce_pct < 40 else 0

# SEE risk (deterministic at post-see)
see_risk = 1 if see_score_pct < 40 or see_absent else 0

# Overall risk (aggregate)
if stage == 'post-see':
    overall_risk = see_risk
else:
    overall_risk = max(attendance_risk, ce_risk, see_risk, downstream_risk)

# Downstream risk
# Semester 1: MUST be 0
downstream_risk = has_backlog_from_previous_semesters
```

### 8.2 Archetype-Course Interaction

| Archetype | Attendance | CE | SEE | Config Sensitivity |
|-----------|-----------|----|-----|-------------------|
| chronic-absentee | Very high | Moderate | High | Lab-heavy hurts more |
| low-attendance | High | Low | Moderate | Theory-heavy hurts more |
| exam-fragility | Low | Low | **Very high** | SEE-pattern hurts more |
| high-forgetting | Low | Moderate | Moderate | Pop-quiz hurts more |
| weak-foundation | Low | **High** | Low | Prereq-heavy hurts more |
| balanced | Low | Low | Low | Minimal sensitivity |
| intervention-resistant | Moderate | Moderate | Moderate | Nothing helps |
| mental-health-disruption | **Very high** | Moderate | High | All courses affected |
| attendance-shock | Spiky | Low | Low | Attendance-penalty hurts |
| coursework-inflation | Low | **Very high** | Low | Assignment-heavy hurts |
| carryover-heavy | Low | Low | Low | Backlog policy affects |

---

## 9. ROLE-BASED VIEWS

### 9.1 HOD View (All Courses, All Students)

For a newly configured course, HOD sees:

```
Course Card (CSE101):
├── Enrollment: 120 students (60 A, 60 B)
├── At-risk by stage: pre-tt1=45, post-tt1=52, post-tt2=50, PA=58, PS=40
├── Risk head breakdown: Attendance=35, CE=2, SEE=38, Downstream=5
├── Course comparison: Hardest=CSE102(42%), Easiest=MAT101(28%), This=3/6
├── Instructor load: Course Leader=Prof.Sharma, Mentors=4, Queue=12
└── Trend: ↑ 3% vs last semester
```

Product intent: HOD makes resource decisions. They need to know which courses are hardest.

### 9.2 Mentor View (Student-Centric, All Courses)

```
Student Card (student_42, exam-fragility):
├── Overall risk: 65% (↓ from 72% last week)
├── Flagged courses: 2
│   ├── CSE101: 1 (SEE risk=0.85 — exam fragility showing)
│   │   └── Evidence: TT1=45%, TT2=38%, attendance=88%
│   └── EEE101: 1 (attendance risk=0.78 — only 68% present)
├── Intervention history: Week 6=Remedial, Week 10=No response
└── Recommended action: Schedule viva for CSE101 before SEE
```

Product intent: Mentor sees student holistically. Needs WHICH courses are flagged and WHY.

### 9.3 Course Leader View (Course-Centric, All Students)

```
Course Dashboard (CSE101):
├── Assessment structure: TT1=25(week4), TT2=25(week8), Quiz=10(best3), Assign=30
├── Score entry: TT1=118/120, TT2=0/120, Quiz1=120/120, Assign1=45/120
├── Risk queue (sorted by overall risk):
│   ├── student_07: 1.00 — TT1=12%, attendance=45%
│   ├── student_12: 0.95 — TT1=18%, attendance=52%
│   └── ... (45 total flagged)
├── CE ineligible alert: 3 students (CE=32%, 35%, 38%)
└── Stage: post-tt1 (next: post-tt2 in 4 weeks)
```

Product intent: Course Leader manages assessment entry and course-specific risk. Needs clear config + actionable queue.

---

## 10. GOVERNED CONSTRAINTS

### Hard Constraints (System-Enforced)

| Rule | Rationale |
|------|-----------|
| CE components sum to <= 60 marks | University regulation |
| At least 1 internal component beyond TTs | Ensures continuous evaluation |
| TT max marks <= 30 per test | Prevents single-test dominance |
| Attendance min >= 75% for SEE eligibility | University regulation |
| SEE passing threshold >= 40% | University regulation |

### Soft Constraints (Warnings)

| Rule | Rationale |
|------|-----------|
| Quiz surprise rate > 50% -> "Stress indicator" warning | Affects mental health |
| Assignment individual weight > 20 marks -> "High stakes" warning | Boom/bust outcomes |
| No lab component in labCredits > 0 course -> "Config mismatch" | Lab credits require lab assessments |
| Prerequisite not offered this semester -> "Orphan course" warning | Students cannot enroll |
| Course risk > 50% for >30% students -> "Course difficulty" alert | May need syllabus review |

---

## 11. CROSS-SEMESTER IMPLICATIONS

### How New Course Affects Downstream Risk

If a student fails the new course:
1. `downstream_risk` becomes 1 for next semester
2. Backlog credit count increases
3. CGPA drops
4. Next semester's prerequisite courses show elevated risk

### Year-Back / Promotion Rules

| Rule | Configurable? | Product Impact |
|------|--------------|----------------|
| Max backlog credits before year-back | Yes (SysAdmin) | Triggers detention flag |
| Max duration of degree | Yes (SysAdmin) | Triggers timeout flag |
| Promotion requires all core courses passed | Yes (SysAdmin) | Affects downstream risk |
| Re-sit vs re-register policy | Yes (SysAdmin) | Affects backlog queue |

---

## 12. ML MODEL ADAPTATION

### What the Model Must Learn

When a new course is configured with:
- 3 TTs instead of 2 -> Feature vector has `tt3_score_normalized`
- No quizzes -> `quiz_avg_normalized` is always NaN
- 50% surprise quizzes -> `quiz_surprise_flag` affects `high-forgetting` archetype

The model must generalize across these variations. This requires:
1. **Feature normalization** (scores as percentages, not raw marks)
2. **Count embeddings** (ttCount, quizCount as categorical features)
3. **Missingness handling** (NaN for unconfigured components)
4. **Config-aware aggregation** (weighted averages based on `weightInCe`)

### Retraining Trigger

| Event | Retraining Required? | Reason |
|-------|---------------------|--------|
| New course added | No (if schema-compatible) | Feature schema unchanged |
| Course assessment structure changed | Yes | Feature distribution changes |
| Archetype weights changed | Yes | Label distribution changes |
| New semester slot added | No | Semester embedding handles this |
| Prerequisite link changed | Yes | Graph feature changes |

---

## 13. CONFIGURATION DIALOGUE (Course Builder UX)

### Step 1: Course Identity
```
[Course Code *] CSE___
[Title *] ________________
[Department *] [Dropdown: CSE / ECE / MECH / CIVIL]
[Semester Slot *] [1] [2] [3] [4] [5] [6] [7] [8]
[Course Type *] (•) Core  ( ) Elective  ( ) Bridge  ( ) Project
[Theory Credits *] [  ] (0-6)    [Lab Credits *] [  ] (0-4)
[Grading Scheme *] (•) Absolute  ( ) Relative
```

### Step 2: Prerequisites & Links
```
[Add Prerequisite] -> [Course Dropdown] -> [Min Grade: A/B/C/Pass] -> [Waivable: Yes/No]
[Add Corequisite] -> [Course Dropdown] -> [Strict: Yes/No]
[Prerequisite Risk Boost] [0.0 - 1.0]
```

### Step 3: Internal (CE) Structure
```
Term Tests:
  [+] Add TT    TT1: Name [__] Max [__] Weight [__] Week [__]
  [+] Add Quiz  Quiz1: Name [__] Max [__] Weight [__] Surprise [Y/N] BestOf [__]
  [+] Add Assign Assign1: Name [__] Max [__] Weight [__] Type [I/G] Deadline [__]
  [+] Add Lab   Lab1: Sessions [__] Max [__] Weight [__] Mandatory [Y/N] Viva [Y/N]
[⚠️ Validation: CE weights sum to __/60]
```

### Step 4: SEE Configuration
```
SEE Max Marks: [60]    SEE Min Pass: [24] (auto: 40%)
SEE Duration: [  ]h   SEE Type: (•) Written  ( ) Practical  ( ) Mixed
SEE Pattern: (•) Subjective  ( ) Objective  ( ) Mixed
SEE Grace Marks: [  ] (0-5)    Allow Backlog Students: [Yes/No]
```

### Step 5: Attendance Rules
```
Min Attendance %: [75] (default)    Grace %: [5] (default)
Medical Exemption: [Yes/No]    Max Medical Days: [  ]
Attendance Penalty: (•) SEE Ineligible  ( ) Grade Reduction  ( ) Both
```

### Step 6: Review & Activate
```
[Preview Impact on Risk Model]
  └── Estimated risk distribution:
      ├── chronic-absentee: ~95%
      ├── exam-fragility: ~35% (high SEE weight)
      └── balanced: ~20%

[Save as Draft]  [Submit for HOD Review]  [Activate Immediately]
```

---

## 14. CHECKLIST: BEFORE ACTIVATING A NEW COURSE

### Feature Schema Validation
- [ ] All configured components generate corresponding feature columns
- [ ] Stage-gated missingness is correct (pre-tt1 has no scores)
- [ ] No duplicate feature names across components
- [ ] Normalization formulas handle zero-maxMarks gracefully

### Label Engine Validation
- [ ] CE aggregation sums to exactly 60 marks
- [ ] CE pass threshold (40%) is enforced
- [ ] Attendance risk is identical across all 5 stages
- [ ] Semester 1 downstream risk is forced to 0
- [ ] Cross-semester carryover propagates correctly
- [ ] Overall risk = max(attendance, ce, see, downstream) before post-see
- [ ] Overall risk = see at post-see (deterministic)

### ML Model Validation
- [ ] Feature schema is compatible with current model
- [ ] All new features are normalized (0-1 or z-score)
- [ ] Missingness is represented as NaN (not 0 or sentinel)
- [ ] Retraining is triggered if distribution changes significantly

### Role-Based View Validation
- [ ] HOD sees course in department-wide comparison
- [ ] Course Leader sees correct assessment structure in entry workspace
- [ ] Mentor sees course risk for each mentee
- [ ] Queue depth is realistic given course difficulty

### Product Intent Validation
- [ ] Archetype risk profiles are realistic for this course config
- [ ] CE risk signal is strong enough (5-15% at post-assignments)
- [ ] SEE risk correlates with attendance for absentee archetypes
- [ ] Overall risk increases monotonically before post-see
- [ ] "Recovery" (backwards step at post-see) is explainable

---

## 15. APPENDIX: COMPLETE FEATURE LIST PER COURSE CONFIG

### Example: CSE101 (Core, 3 theory + 1 lab credits)

| Feature | Type | Source | Stage Available |
|---------|------|--------|----------------|
| `student_archetype` | categorical | Student profile | All |
| `student_section` | categorical | Student profile | All |
| `course_credits` | float | Course config | All |
| `course_theory_credits` | float | Course config | All |
| `course_lab_credits` | float | Course config | All |
| `course_semester_slot` | int | Course config | All |
| `course_type_core` | binary | Course config | All |
| `tt_count` | int | Course config | All |
| `quiz_count` | int | Course config | All |
| `assignment_count` | int | Course config | All |
| `lab_count` | int | Course config | All |
| `prev_sem_cgpa` | float | Historical | pre-tt1 |
| `prev_sem_backlog_count` | int | Historical | pre-tt1 |
| `carryover_credits` | int | Historical | pre-tt1 |
| `attendance_pct` | float | Attendance entry | All |
| `attendance_consecutive_absent` | int | Attendance entry | All |
| `tt1_score_normalized` | float | Score entry | post-tt1 |
| `tt1_missing_flag` | binary | Score entry | post-tt1 |
| `tt2_score_normalized` | float | Score entry | post-tt2 |
| `tt2_missing_flag` | binary | Score entry | post-tt2 |
| `quiz_avg_normalized` | float | Score entry | post-tt1 (if early) |
| `quiz_count_taken` | int | Score entry | post-tt1 |
| `assign_avg_normalized` | float | Score entry | post-tt1 (if early) |
| `assign_missing_count` | int | Score entry | post-tt1 |
| `lab_avg_normalized` | float | Score entry | post-tt1 |
| `lab_attendance_pct` | float | Attendance entry | post-tt1 |
| `ce_pct` | float | Computed | post-assignments |
| `ce_eligible_flag` | binary | Computed | post-assignments |
| `see_score_normalized` | float | Score entry | post-see |
| `see_absent_flag` | binary | Score entry | post-see |
| `downstream_carryover_flag` | binary | Computed | pre-tt1 |
| `backlog_credits` | int | Historical | pre-tt1 |
| `prereq_passed_count` | int | Graph | pre-tt1 |
| `prereq_failed_count` | int | Graph | pre-tt1 |
| `is_pre_tt1` | binary | Stage flag | All |
| `is_post_tt1` | binary | Stage flag | All |
| `is_post_tt2` | binary | Stage flag | All |
| `is_post_assignments` | binary | Stage flag | All |
| `is_post_see` | binary | Stage flag | All |

---

## 16. RISK HEAD OUTPUTS (What the Model Predicts)

For every student-course-stage, the model outputs:

| Head | Meaning | Range | Interpretation |
|------|---------|-------|----------------|
| `attendanceRisk` | P(attendance < threshold) | 0-1 | Semester-level risk |
| `ceRisk` | P(CE < 40%) | 0-1 | Ineligibility for SEE |
| `seeRisk` | P(SEE < 40% or absent) | 0-1 | Exam failure risk |
| `overallRisk` | P(any failure mode) | 0-1 | Aggregated risk |
| `downstreamCarryoverRisk` | P(carryover from prev sem) | 0-1 | Backlog burden |

**At post-see, all heads collapse to deterministic 0 or 1.**

---

*End of spec. This document should be treated as the single source of truth for course configuration, feature generation, label computation, and role-based view expectations.*
