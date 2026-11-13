# AirMentor

**Early warning for struggling university students, and a research program on whether such warnings can be trusted.**

At most universities a struggling student is noticed only after they fail an exam. AirMentor checks attendance and
marks at five points in the semester, estimates which students are likely to fail a course and why, and routes each
case to the right person (course leader, mentor or Head of Department) with a suggested next step.

Built as a capstone project at M.S. Ramaiah University of Applied Sciences, Bengaluru (2026).

> **Status:** a working research prototype. Everything here runs on a **simulated** cohort; it has not been used with
> real students, and no claim is made about accuracy or impact on real students. See
> [What this does not show](#what-this-does-not-show).

## The research questions

1. Can a university spot students heading for a failed course early enough to help?
2. Can those warnings be trusted: are the risk estimates calibrated, explained and fair?
3. Can this be studied responsibly before any real student data is used?

## How it works

- **Who uses it:** System Admin, Course Leader, Mentor and Head of Department, each with their own view and
  permissions.
- **What goes in:** attendance, term tests, quizzes, assignments, end-semester exams, CGPA, backlogs and weak course
  outcomes, entered by faculty or imported in bulk.
- **What it estimates:** five risk scores per student and course: attendance, coursework shortfall, end-exam shortfall,
  overall failure, and knock-on risk to later courses that build on this one.
- **What users get:** a queue of flagged cases. Each flag states its reasons (for example low attendance or a weak
  prerequisite), a suggested action and who should act. Escalation to the Head of Department happens only when risk is
  high and earlier support has not worked.

## How the warnings are kept trustworthy

- **A simulated university to test on:** 120 students over six semesters on the real 36-course Mathematics and
  Computing curriculum. Marks, forgetting between assessments and response to help follow published education
  research, and the simulation is checked for realism across many random seeds.
- **Every number has a source:** constants in the risk model are traced to peer-reviewed studies in a literature table
  ([docs/paper-evidence](docs/paper-evidence/)), or marked as assumptions that must be disclosed.
- **Fair comparisons:** prediction methods are compared against simple baselines with bootstrap confidence intervals,
  ablations and fairness checks.
- **Calibration and promotion gates:** risk estimates are calibrated, and a model is promoted only if it passes the
  gates. A more complex CatBoost challenger was kept out because its probabilities were less well calibrated.
- **Explanations are required:** a flag with no explaining reason cannot be rated above Medium.
- **No alert floods:** a cap on how many students can be flagged at once, and a case lifecycle (open, watch, deferred,
  dismissed, resolved, reopened).
- **"What if nobody helps?":** a simulated no-intervention comparison for each case.

## What this does not show

The project keeps a written [claim ledger](docs/paper-evidence/claim-ledger-2026-05-11.md) that separates what the
evidence supports from what it does not. In short:

- no validation on real institutional student data;
- no proven real-world effect of interventions (the comparisons are simulated);
- results come from one simulated institution and programme.

## Built with

TypeScript, React (Vite), Node.js with Fastify, PostgreSQL with Drizzle, Python for model research, Vitest and
Playwright. Security basics: argon2id password hashing, CSRF protection, login rate limiting and an audit log.

## Repository layout

| Path | What is there |
|---|---|
| `adapters/` | The web app (React) |
| `air-mentor-api/` | Backend API, database schema and migrations, model research scripts |
| `kernel/` | Shared domain rules: roles, risk feature contract |
| `universities/` | Institution-specific configuration |
| `pipeline/` | Tooling used to coordinate development work |
| `docs/` | Architecture, model lifecycle, realism audit, paper evidence |
| `tests/`, `tests-e2e/` | Unit and browser (Playwright) tests |

## Running it locally

Requires Node.js 20 or later.

```bash
# Backend with a temporary local database and simulated data
cd air-mentor-api
npm install
npm run dev:seeded
```

```bash
# Web app, in a second terminal from the repository root
npm install
npm run dev
```

Then open http://127.0.0.1:5173/. For a persistent PostgreSQL setup instead, see
[air-mentor-api/README.md](air-mentor-api/README.md).
