# AirMentor API

Node/TypeScript backend for the AirMentor admin-foundation slice.

## Stack

- Fastify
- Drizzle ORM
- PostgreSQL
- Zod
- Vitest
- Optional local Python NLP helper for curriculum linkage review

## Quick Start

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run db:seed`.
5. Run `npm run dev`.

The API is backend-only. Opening `http://127.0.0.1:4000/` returns a small API info payload; the admin UI itself should be opened from the frontend dev server, typically `http://127.0.0.1:5173/`.

Curriculum linkage review can use the local Python helper in `scripts/curriculum_linkage_nlp.py` when `spacy` and `sentence-transformers` are installed from `requirements.txt`. The helper is best-effort; if Python dependencies are missing, the TypeScript linkage code falls back to the existing heuristic path.
To run the helper locally, install the Python deps in `air-mentor-api` with:

- `python3 -m pip install -r requirements.txt`

For local browser access from Vite, the default CORS allowlist already includes:
- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `http://127.0.0.1:4173`
- `http://localhost:4173`

Override this with `CORS_ALLOWED_ORIGINS` if you run the frontend from a different origin.

## Shared Railway Test Database

For the fastest testing loop, you can point both your local API and the deployed
Railway API at the same Railway test Postgres database.

1. Put the Railway test Postgres connection string in `air-mentor-api/.env` as either:
   - `DATABASE_URL=...`
   - or `RAILWAY_TEST_DATABASE_URL=...`
2. Set the deployed Railway service `DATABASE_URL` to that same test database.
3. Run the local API normally with `npm run dev` or `npm run db:migrate`.

The API now auto-loads `.env` and `.env.local`, so you do not need to export the
variables manually first.

If local and deployed APIs share the same database, any write you make locally
will also be visible to the deployed API immediately. That is ideal for rapid
testing, but it also means `npm run db:seed` will reset the shared test database.
Use seeding on the shared Railway database only when you intentionally want a full reset.

For a GitHub Pages frontend deployed on a different origin from the API, set:
- `CORS_ALLOWED_ORIGINS=https://raed2180416.github.io`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAME_SITE=none`

That keeps credentialed browser requests working across origins with `credentials: 'include'`.

## Railway Deploy

The frontend on GitHub Pages and the API on Railway are deployed separately.
If the UI starts calling routes such as `/api/admin/reminders` and the live API
returns `Route ... not found`, the frontend is newer than the Railway deploy.

For the previous completed full governed mock-data validation snapshot, see:
- [full-mock-data-validation-2026-03-23.md](/home/raed/projects/air-mentor-ui/docs/full-mock-data-validation-2026-03-23.md)

This repo now includes [deploy-railway-api.yml](/home/raed/projects/air-mentor-ui/.github/workflows/deploy-railway-api.yml)
to redeploy the backend from `main`. To enable it in GitHub:

1. Add the repository secret `RAILWAY_TOKEN`.
2. Add the repository variable `RAILWAY_SERVICE` with the Railway service name.
3. Optionally add `RAILWAY_ENVIRONMENT` if the service deploys anywhere other than the default environment.

The workflow builds `air-mentor-api`, then runs `railway up` from the API directory.
`air-mentor-api/railway.json` keeps the deploy behavior consistent by running
`npm run db:migrate` before starting the app.

If you also set the repository variable `RAILWAY_PUBLIC_API_URL`, the workflow
will run a post-deploy `GET /health` check against the live Railway service.

For the GitHub Pages frontend deploy, set the repository variable
`VITE_AIRMENTOR_API_BASE_URL` to the live Railway API origin, for example:

- `https://your-airmentor-api.up.railway.app`

## Proof Release Checklist

Use this exact sequence for a release-ready proof verification:

1. Merge to `main`.
2. Wait for:
   - GitHub Pages deploy to finish
   - Railway API deploy to finish
3. Verify the live API healthcheck:
   - `GET /health`
4. Log in on the live site as `sysadmin`.
5. Open the seeded proof batch route:
   - `#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023`
6. Check the active proof dashboard diagnostics:
   - active proof run present
   - active production artifact present
   - artifact version visible
   - calibration version visible
   - governed split summary visible
   - overall-course runtime summary visible
   - queue burden summary visible
7. If the active proof artifact is missing or stale, trigger:
   - `POST /api/admin/proof-runs/:simulationRunId/recompute-risk`
8. Re-open proof diagnostics and verify:
   - active artifact version updated
   - governed `policyDiagnostics` present
   - governed `coEvidenceDiagnostics` present
   - `overallCourseRuntimeSummary` present
   - `queueBurdenSummary` present
   - active-run parity diagnostics present
9. Run the live proof smoke verifier with external URLs:
   - `PLAYWRIGHT_APP_URL=<live-frontend-url> PLAYWRIGHT_API_URL=<live-api-url> npm run verify:proof-closure:live`

## Live Operator Walkthrough

Use this flow on the deployed site to confirm proof parity visually:

1. Log in as `sysadmin`.
2. Open the seeded proof batch route above.
3. Select `Sem 6 · Semester Close`.
4. Verify on sysadmin:
   - checkpoint banner shows blocked progression when queue items remain
   - queue counts are visible for open, watch, and resolved states
   - blocking and watched student counts are visible
   - queue preview cards show `CO evidence mode`
   - `Δ` and `Lift` chips are visible
   - governed diagnostics are distinct from active-run parity diagnostics
5. Log in as a `Course Leader`.
6. Open the teacher proof panel and confirm:
   - same checkpoint
   - same blocked state
   - same queue row student/course
   - same `Δ`, `Lift`, and `CO evidence mode`
7. Open the teacher risk explorer and confirm:
   - stage blocked banner
   - previous band
   - risk change
   - counterfactual lift
   - policy phenotype
   - CO evidence mode
8. Open the student shell and confirm:
   - same checkpoint
   - stage blocked banner
   - risk change
   - counterfactual lift
   - policy phenotype
   - CO evidence mode
9. Switch to `HoD`.
10. Confirm HoD analytics and drilldown show:
    - same checkpoint
    - blocked-state context
    - selected-student risk change
    - selected-student counterfactual lift
    - selected-student CO evidence mode
11. Open HoD risk explorer and confirm the same student/checkpoint remain in sync.

## Tests

- `npm test` starts an ephemeral real PostgreSQL cluster via `embedded-postgres`.
- The test suite then runs the repo's SQL migrations and seeds against that cluster before exercising the API.

## Default Seed Accounts

- `sysadmin` / `admin1234`
- `hod.cse` / `hod1234`
- `cl.kavitha` / `course1234`
- `mentor.sneha` / `mentor1234`
