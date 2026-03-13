# Grading, Transcripts, And Student History

## Academic Evaluation Model

AirMentor must model the MSRUAS academic structure as follows:

- Continuous Evaluation contributes `60`
- Semester End Evaluation contributes `40`
- final subject score is `100`

## Continuous Evaluation Breakdown

### Fixed TT Portion

- TT1 raw max is `25`
- TT2 raw max is `25`
- TT1 + TT2 raw total is `50`
- this fixed TT total is normalized to `30` inside CE

Normalization formula:

- `tt1Normalized = (tt1Raw / 25) * 15`
- `tt2Normalized = (tt2Raw / 25) * 15`
- `ttNormalizedTotal = tt1Normalized + tt2Normalized`

### Configurable Quiz And Assignment Portion

The remaining `30` of CE belongs to quizzes and assignments.

Rules:

- quizzes allowed count: `0`, `1`, or `2`
- assignments allowed count: `0`, `1`, or `2`
- at least one of quiz or assignment must exist
- the total CE weight assigned across quizzes and assignments must equal `30`
- raw maxima for each quiz and assignment are configurable per offering

Allowed examples:

- quiz `10`, assignment `20`
- quiz `20`, assignment `10`
- quiz `30`, assignment `0`
- quiz `0`, assignment `30`

The system must not hardcode raw quiz or assignment maximums.

## Semester End Evaluation

SEE always contributes `40` to the final subject score.

Allowed raw max values for SEE:

- `50`
- `100`

Normalization formula:

- `seeNormalized = (seeRaw / seeRawMax) * 40`

The raw max is defined per course offering scheme.

## Scheme Ownership And Locking

Each course offering owns one evaluation scheme.

The evaluation scheme defines:

- TT raw max, fixed at `25` for TT1 and `25` for TT2
- quiz count
- assignment count
- raw max for each quiz
- raw max for each assignment
- CE weights for quiz and assignment groups totaling `30`
- SEE raw max of `50` or `100`

Rules:

- the scheme may be edited only before first marks entry starts
- the moment any marks entry begins for that offering, the scheme becomes locked
- only HoD can reopen via explicit reset or unlock workflow

## Subject Score Calculation

The final subject score out of `100` is:

- `finalSubjectScore = ce60 + see40`

Where:

- `ce60 = ttNormalizedTotal + normalizedQuizContribution + normalizedAssignmentContribution`
- `see40 = seeNormalized`

No pre-rounding rule:

- compute normalized contributions as exact decimals
- sum to exact final subject score out of `100`
- apply grade-band thresholds on the exact value
- only round for display if needed after grade band is decided

## Grade Band Mapping

| Final Subject Score | Grade | GPA Point |
| --- | --- | --- |
| `> 90` and `<= 100` | `O` | `10` |
| `> 74` and `<= 90` | `A+` | `9` |
| `> 60` and `<= 74` | `A` | `8` |
| `>= 55` and `<= 60` | `B+` | `7` |
| `>= 50` and `< 55` | `B` | `6` |
| `> 44` and `< 50` | `C` | `5` |
| `>= 40` and `<= 44` | `P` | `4` |
| `< 40` | `Fail` or `Absent` | `0` |

## Boundary Examples

These examples must be hard-coded into tests:

| Final Score | Expected Grade | Expected GPA |
| --- | --- | --- |
| `40` | `P` | `4` |
| `44` | `P` | `4` |
| `44.01` | `C` | `5` |
| `50` | `B` | `6` |
| `55` | `B+` | `7` |
| `60` | `B+` | `7` |
| `74` | `A` | `8` |
| `90` | `A+` | `9` |
| `90.01` | `O` | `10` |

## SGPA And CGPA

### Subject GPA

Each subject produces one GPA point from the grade band.

### SGPA

For one semester:

- `SGPA = sum(subjectCredits * subjectGpaPoint) / sum(subjectCredits)`

### CGPA

Across all included semesters:

- `CGPA = sum(subjectCredits * subjectGpaPoint for all included transcript records) / sum(subjectCredits for all included transcript records)`

## Transcript Ownership

AirMentor owns transcript history in v1 because:

- student history must be visible in the product
- prior results are needed later for risk modeling
- SGPA and CGPA must be auditable inside the platform

Transcript ownership includes:

- semester identity
- subject records
- credits
- final subject score
- final grade
- GPA point
- pass or fail state
- attempt number
- backlog indicator
- repeat indicator
- inclusion flags for SGPA and CGPA

## Repeated Subjects And Historical Attempts

Official repeat-subject academic policy is not hardcoded in this pack. Instead, the transcript model must support it explicitly.

Required fields per transcript subject attempt:

- `attemptNumber`
- `isRepeatAttempt`
- `supersedesTranscriptRecordId` when applicable
- `includeInSgpa`
- `includeInCgpa`
- `resultStatus`

Calculation rule:

- SGPA and CGPA calculations use only records whose inclusion flags are true

This keeps the data model deterministic without guessing institutional replacement policy too early.

## Transcript Result Statuses

Required statuses:

- `Pass`
- `Fail`
- `Absent`
- `Withheld`
- `Incomplete`

Only `Pass`, `Fail`, and `Absent` are grade-band mapped by default in v1. `Withheld` and `Incomplete` remain non-final statuses and must not be treated as final GPA outcomes until academic operations resolve them.

## Student History Page

The student history page is a planned read-oriented surface and must be designed now even if implemented later.

### Entry Points

- from student drawer
- from mentor detail
- from HoD student drill-down

### Mandatory Sections

- profile summary
- current semester quick summary
- previous semester SGPA timeline
- cumulative CGPA timeline
- semester cards
- subject table per semester
- backlog and repeat history
- intervention timeline
- risk-context summary for future modeling inputs

### Course Leader Visibility

Can see:

- semester results
- subject attempts
- final grades
- SGPA and CGPA
- backlog and repeat history
- prior CE and SEE summaries when available

### Mentor Visibility

Can see:

- semester-level performance summary
- subject outcome summary
- SGPA and CGPA
- backlog and repeat markers
- current and prior interventions

Cannot see:

- historical question-wise raw marks
- detailed marks-entry sheets

### HoD Visibility

Can see:

- all final-outcome and supervisory transcript surfaces
- reset or audit-relevant transcript history metadata

## History-Driven Risk Foundations

The first backend phase does not need to implement the final risk model, but it must preserve the following inputs:

- prior semester SGPA trend
- cumulative CGPA
- prior backlog count
- repeated-subject history
- failed-subject history
- attendance trend when available
- prior intervention count and recency

## Import Readiness

Transcript ingestion must support both:

- direct manual entry for small corrections
- bulk import for institutional or spreadsheet-driven data loads

The import model must validate:

- student identity existence
- subject or course identity
- semester identity
- credits
- final grade and GPA consistency
- inclusion flags for SGPA and CGPA
