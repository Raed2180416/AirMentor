# College Demo Script — 2026-04-27

Use this verbatim. Each block has the line to say + the click to make.

## Pre-flight (before the audience walks in)

- Terminal A:
  ```
  bash scripts/demo-start-backend.sh
  ```
  Wait for the green "backend ready" line.
- Terminal B:
  ```
  bash scripts/demo-start-frontend.sh
  ```
- Terminal C (optional):
  ```
  node scripts/demo-bootstrap-proof.mjs
  ```
- Browser at `http://127.0.0.1:5173/`. Login form visible.

If anything fails: read the troubleshooting table in
`docs/demo/local-backend-startup-2026-04-27.md`.

## 1. Frame (30s)

> "What you are about to see is AirMentor running on this laptop with
> a local-first synthetic proof dataset. The dataset models the
> MSRUAS BTech Mathematics & Computing 2023 batch across six
> semesters. Every assertion you'll see is reproducible and the
> backend never touches real institutional data."

## 2. Sysadmin login (15s)

> "Logging in as system administrator."

- Enter `sysadmin / admin1234`. Submit.

## 3. Active proof run (45s)

> "The proof dashboard surfaces the active simulation run. This is
> the same `sim_mnc_2023_first6_v1` row we created with one click."

- Navigate to the proof dashboard.
- Point at: run id, status `active`, sem 6 currently activated, 30
  stage checkpoints visible.

## 4. Show seeded surfaces (60s)

> "The simulation seeds 120 students, 10 faculty, both sections,
> course outcomes, question-level CO mappings, attendance,
> timetable, queues, and stage checkpoints — all in one click."

- Open the seeded teacher credential list. Point at `mnc_t1` row.
- Say: "Every faculty account in this list uses
  `faculty1234` for tonight's demo."

## 5. Logout sysadmin → login teacher (45s)

- Logout.
- Login `rohit.menon / faculty1234`.

> "Rohit is a course leader. He sees only what he is allowed to see
> for the active proof run."

- Point at: only assigned offerings visible, only mentees listed,
  proof playback context already loaded.

## 6. Inspect a student (90s)

- Open Aarav Sharma in `mnc_s6_amc_s6_32_a` (Data Science and
  Analytics, sec A).

> "Aarav has an attendance of 28/32, prior CGPA 6.01, current risk
> probability 0.6257 in the medium band. The risk drivers panel
> attributes that to a thin prior-history signal plus a few weak
> course outcomes already detected."

## 7. Edit attendance + show recompute (90s)

- Open the attendance editor. Drop Aarav's present count from 28 to
  12. Save.

> "I'm dropping his attendance from 88 percent to 38 percent. Watch
> the risk recompute."

- Reopen the student's risk explorer.

> "Probability moved from 0.6257 to 0.6330. The band did NOT flip
> because we did not cross the high-risk threshold of 0.7. That is
> honest behavior. The driver panel now attributes the new risk to
> the attendance drop."

(Restore attendance with another save, optional.)

## 8. Stage advance, evidence reveal (90s)

- Switch back to sysadmin. Activate semester 1.

> "Watch what happens when we move to the start of semester 1, before
> TT1 closes."

- Show the cohort: 0 low / 120 medium / 0 high. No queue. No
  recommendations.

> "There is no prior CGPA, no backlog, no prerequisite history at
> this point. The system refuses to overclaim."

- Activate sem 1 post-TT1 view.

> "TT1 evidence comes in. The cohort moves to all-low because the
> seeded sem 1 cohort performs well on TT1. Risk delta minus 4.8."

- Activate sem 4 pre-TT1.

> "Now we are at the start of semester 4. Prior history is rich.
> Sixteen students start with a low-risk band purely from the prior
> CGPA / backlog / prerequisite signal. The pre-TT1 view DOES use
> historical evidence when it is available."

## 9. Queue + recommendation (60s)

- Activate sem 6 post-TT1.
- Open the queue panel.

> "Twenty-two queue cases open at post-TT1 — that's the first stage
> the system asks the teacher to act. Each row carries a
> recommended action: attendance recovery, targeted tutoring,
> prerequisite bridge, or pre-SEE rescue."

## 9b. Marks progression story (90s)

Use only the selected students in
`docs/demo/demo-safe-student-picks-2026-04-27.md`. Do not randomly
click students for the marks-realism story.

> "At pre-TT1, we intentionally avoid showing future marks."

> "After TT1, the system can identify early academic weakness."

> "After TT2, we can distinguish recovery from persistent weakness."

> "After assignments/quizzes, coursework evidence refines but does not
> magically erase exam weakness."

> "After SEE, the system reflags exam fragility if final performance
> contradicts coursework."

> "From semester 4 onward, accumulated CGPA/backlogs/prerequisite
> history visibly differentiates pre-TT1 risk."

Then add the caveat:

> "Tonight's proof run uses the stable synthetic baseline. B1 mark
> realism is not enabled, so I am demonstrating stage-safe evidence
> flow and plausible governance behavior, not claiming production
> academic calibration."

Safe students:

- Diya Iyer (`mnc_student_030`) — clean strong observed coursework.
- Yash Reddy (`mnc_student_079`) — attendance/carryover risk.
- Mira Patel (`mnc_student_096`) — academic weakness / tutoring.
- Aarav Reddy (`mnc_student_061`) — prerequisite/carryover history.
- Arjun Reddy (`mnc_student_069`) — borderline pass/fail concern.

Guardrail:

- Do not use post-TT2/post-SEE as proof of final-exam realism tonight.
  Current synthetic projection payloads conservatively show missing
  TT2/SEE as `0%` in driver text. Use those stages only to explain
  checkpoint mechanics unless B1 realism is separately proven.

## 10. HoD analytics (90s)

- Logout teacher. Login `devika.shetty / faculty1234`.
- Switch active role to HOD.
- Open the HoD page.

> "Devika is the head of department. The HoD page surfaces the live
> proof analytics: course hotspots, faculty operations, student
> watch list, reassessment audit, and the counterfactual simulator."

- Walk through:
  - 6 course hotspot rows
  - 15 faculty operations rows
  - 120 student watch rows
  - reassessment audit (empty in default seed; mention "this list
    grows when teachers resolve queue cases")
  - counterfactual simulator (with-vs-without intervention sem-6)

## 11. Refresh / relogin (30s)

- Hit Cmd-R in the browser.

> "Session and active proof run survive refresh."

- Logout. Login. Open the same student.

> "Edited evidence persists across logout/login because it is in
> the database, not the browser."

## 12. Data safety (45s)

> "Tonight's backend is an embedded local Postgres in a tempdir.
> When I close this laptop, every demo run is gone. Real
> institutional data lives on a separate database that this demo
> never opens."

## 13. Roadmap (60s)

> "What you saw is a credible operational proof. What is on the
> roadmap before we claim production readiness:
>
> 1. Real-data calibration of the risk model on actual MSRUAS data.
> 2. Shifted-world validation — does the model hold under
>    distribution shifts?
> 3. Production hardening of the API host (currently demoing
>    laptop-local; the GitHub Pages frontend is shipped, the API
>    host is the next deployment decision).
> 4. CO blueprint v2 with Bloom-level refinement.
> 5. Post-B1 mark realism is being evaluated on Lightning.ai in
>    parallel; tonight's demo runs on the stable current-v8 baseline."

## Emergency fallbacks

| Failure | Action |
|---|---|
| GitHub Pages cannot reach laptop | use local frontend (`http://127.0.0.1:5173/`) |
| Backend unreachable | re-run `bash scripts/demo-start-backend.sh` |
| Create-simulation hangs | proof run is already active; click "Open active proof run" instead |
| Teacher login fails | reseed via backend restart, re-run `node scripts/demo-bootstrap-proof.mjs` |
| Risk does not move | use Aarav Sharma + attendance edit (verified to move probability 0.6257→0.633) |
| HoD page 403 | role context is COURSE_LEADER; switch to HOD before opening the page |
| HoD analytics slow | open the saved screenshot from `docs/demo/screenshots-2026-04-27/` |

## Things to AVOID saying

1. "This predicts real-world outcomes." — it does not yet.
2. "We are deployed in production." — backend is local for tomorrow.
3. "CatBoost is integrated." — research, not demo.
4. "B1 mark realism is enabled." — synthetic baseline only.
5. "We have institutional data onboarded." — proof sandbox only.

## Things to SAY proudly

1. "Six-semester deterministic proof, all 30 stage checkpoints."
2. "Stage-safe evidence handling: TT1 hidden until post-TT1."
3. "Edited attendance recomputes risk in the same session."
4. "Demo data is local-only by construction; production data is
   never touched."
5. "Counterfactual simulator answers no-action vs intervention."
