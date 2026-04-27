# Class Distribution Sanity — 2026-04-27

## Verdict

**AMBER.** Semester 6 observed coursework distribution is believable for a synthetic stress test, but not production-realistic. It contains useful low/medium/high examples and enough spread for a demo. Post-TT2/SEE projection fields are not realistic because TT2/SEE are missing and represented as 0 in risk-driver text.

## Source

- Observed marks: `/tmp/airmentor-demo-logs/marks-realism/trajectory-sample.json`
- Class stats: `/tmp/airmentor-demo-logs/marks-realism/class-distribution.json`
- Semester selected: **Semester 6**

## Semester 6 all-course distribution

| count | riskProjectionCount | riskBands | queues | passFail |
| --- | --- | --- | --- | --- |
| 720 | 120 | {"Medium":114,"High":6} | {"idle":88,"watch":32} | {"C/Pass":359,"B/Good":143,"D/Borderline":183,"A/Strong":12,"Fail-risk":23} |

## Metric summary

| metric | mean | min | p10 | p50 | p90 | max |
| --- | --- | --- | --- | --- | --- | --- |
| attendancePct | 79.2 | 64 | 71 | 79 | 88 | 96 |
| tt1Pct | 61.2 | 33 | 46.5 | 61.4 | 75.6 | 90 |
| tt2Pct |  |  |  |  |  |  |
| quizPct | 60.1 | 25.4 | 44.2 | 59.8 | 75.1 | 94.5 |
| assignmentPct | 62 | 29.6 | 45.9 | 62.7 | 77.1 | 95.4 |
| cePctApprox | 61.1 | 32.3 | 45.7 | 61.7 | 75.7 | 93.2 |
| seePct |  |  |  |  |  |  |
| overallPctApprox | 61.1 | 32.3 | 45.7 | 61.7 | 75.7 | 93.2 |

## Course-level summary

| course | title | count | attMean | tt1Mean | quizMean | assignmentMean | ceMean | weakCoMean | observedRiskCounts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID201A | Artificial Intelligence | 120 | 80.4 | 61.1 | 60.6 | 62 | 61.2 | 0.5 | {"Low":28,"Medium":81,"High":11} |
| AMC-S6-32 | Data Science and Analytics | 120 | 79 | 61.8 | 60.5 | 62.5 | 61.6 | 0.5 | {"Low":30,"Medium":79,"High":11} |
| AMC-S6-33 | Dept Elective - II | 120 | 76.3 | 60.9 | 60.4 | 61.4 | 60.9 | 0.6 | {"Low":23,"Medium":79,"High":18} |
| AMC-S6-34 | Mini Project | 120 | 81.9 | 61.9 | 61 | 62.6 | 61.8 | 0.5 | {"Low":30,"Medium":79,"High":11} |
| MCC301A | Optimization Techniques | 120 | 79.6 | 60 | 58.3 | 61.4 | 59.9 | 0.7 | {"Low":27,"Medium":75,"High":18} |
| MCC310A | Parallel & Distributed Computing | 120 | 77.8 | 61.6 | 59.7 | 61.8 | 61 | 0.5 | {"Low":26,"Medium":85,"High":9} |

## Top projection drivers

| driver | count |
| --- | --- |
| TT2 performance is very low (0%) | 120 |
| SEE performance is very low (0%) | 120 |
| Active backlog count is high (3) | 14 |
| Active backlog count is above the watch threshold (1) | 11 |
| Active backlog count is high (11) | 9 |

## Sanity answers

1. **Too flat?** No. Attendance ranges 64–96, TT1 ranges 33–90, CE ranges 32.3–93.2.
2. **Unrealistic clustering?** Not for a synthetic stress test. Median CE is 61.7 with p10 45.7 and p90 75.7.
3. **Enough low/medium/high examples?** Yes in observed course rows. Risk projections are mostly medium (114 medium / 6 high), so use selected examples rather than random clicking.
4. **Failure/pass rates believable?** For a stress-test, yes: 23 fail-risk rows out of 720, plus 183 borderline rows.
5. **SEE separation?** No. SEE is not present in observed sem6 evidence and appears as 0 in projection drivers. Do not claim SEE realism.
6. **Coursework inflation visible?** Yes. Some students have passable assignment/quiz while risk remains due to backlog/CGPA; this is useful but must be explained.
7. **Risk concentration matches weak evidence?** Partially. Weak students/backlog cases align; clean strong students can still show medium projection because of conservative/missing-evidence drivers.
