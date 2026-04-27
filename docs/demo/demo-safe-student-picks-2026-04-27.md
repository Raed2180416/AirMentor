# Demo-Safe Student Picks — 2026-04-27

## Rule for tomorrow

Do not randomly click students. Use these selected students only.

## 1. Clean strong observed-coursework student

- **Student:** Diya Iyer — `mnc_student_030`
- **Course/stage:** Semester 6 observed course rows; safest courses: `AID201A`, `MCC301A`, `MCC310A`
- **Evidence to point at:** Attendance 77–87, TT1 78–87 on several courses, quiz/assignment mostly high, average CE 80.8, weak CO total 0.
- **What to say:** "This is the strong-work evidence example. The proof run is conservative, so I use this to show observed marks, not to claim all risk is low."
- **Edit to perform:** None. Do not use Diya for risk movement.
- **Fallback:** If risk shows medium, say history/conservative stress-test governance is still active and B1 realism is not enabled.

## 2. Attendance/carryover-risk student

- **Student:** Yash Reddy — `mnc_student_079`
- **Course/stage:** Semester 6, `AID201A`, `MCC301A`, or `MCC310A`; post-TT1 or post-assignments only.
- **Evidence to point at:** Attendance 67–71 in several courses, mixed CE, backlog max 16.
- **Expected behavior:** Medium/high observed course risk, monitored reassessment/watch recommendation.
- **Edit to perform:** Attendance improvement edit can be shown, but explain that backlog/CGPA may still dominate risk.
- **Fallback:** If risk does not move, say threshold/driver dominance: attendance improved, but accumulated backlog keeps governance risk active.

## 3. Academic weakness / tutoring student

- **Student:** Mira Patel — `mnc_student_096`
- **Course/stage:** Semester 6, `AMC-S6-32` Data Science and Analytics.
- **Evidence to point at:** Attendance 87 but TT1 38.03, quiz 37.58, assignment 30.11, CE ≈35.2, weak CO 2.
- **Expected behavior:** Academic weakness/tutoring or monitored reassessment recommendation.
- **Edit to perform:** Improve one coursework/attendance cell only if you want to show recompute; do not promise full risk clearance.
- **Fallback:** If risk stays medium/high, explain weak academic evidence and backlog still dominate.

## 4. Prerequisite/carryover student

- **Student:** Aarav Reddy — `mnc_student_061`
- **Course/stage:** Semester 6, `AID201A` or `MCC301A`.
- **Evidence to point at:** Backlog max 23, average CE 46.6, weak CO signals.
- **Expected behavior:** Carryover/prerequisite risk; monitored reassessment or bridge-style support.
- **Edit to perform:** None unless asked. This is a history-driven case.
- **Fallback:** If asked why current mark edit does not clear risk, say prior backlog/prerequisite history is deliberately part of sem2+ pre-TT1 and sem6 risk.

## 5. Borderline pass/fail student

- **Student:** Arjun Reddy — `mnc_student_069`
- **Course/stage:** Semester 6 `AID201A`.
- **Evidence to point at:** Attendance 75, TT1 48.17, quiz 48.93, assignment 52.31, CE ≈49.8, weak CO 1, backlog max 12.
- **Expected behavior:** Borderline concern; watch/reassessment.
- **Edit to perform:** Small improvement can demonstrate data persistence, but do not promise a risk-band transition.
- **Fallback:** Use Mira Patel instead if the UI path is faster.

## Students to avoid as primary stories

- **Vihaan Iyer — `mnc_student_023`:** observed marks are reasonable, but projection risk rises because missing TT2/SEE are treated as zero.
- **Arjun Sharma — `mnc_student_009`:** useful persistent-risk example, but observed current marks are partly strong, so it can confuse unless you explain backlog/history dominance.

## Exact lines to say

- "I am choosing known representative students so the demo is reproducible."
- "This is synthetic proof data; I am showing plausible evidence flow and governance behavior, not claiming production calibration."
- "If a risk score does not drop after one edit, that is because multiple drivers can dominate: backlog, CGPA, weak COs, and attendance."
