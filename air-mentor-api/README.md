# AirMentor API

Node/TypeScript backend for the AirMentor admin-foundation slice.

## Stack

- Fastify
- Drizzle ORM
- PostgreSQL
- Zod
- Vitest

## Quick Start

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run db:seed`.
5. Run `npm run dev`.

The API is backend-only. Opening `http://127.0.0.1:4000/` returns a small API info payload; the admin UI itself should be opened from the frontend dev server, typically `http://127.0.0.1:5173/`.

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

This repo now includes [deploy-railway-api.yml](/home/raed/projects/air-mentor-ui/.github/workflows/deploy-railway-api.yml)
to redeploy the backend from `main`. To enable it in GitHub:

1. Add the repository secret `RAILWAY_TOKEN`.
2. Add the repository variable `RAILWAY_SERVICE` with the Railway service name.
3. Optionally add `RAILWAY_ENVIRONMENT` if the service deploys anywhere other than the default environment.

The workflow builds `air-mentor-api`, then runs `railway up` from the API directory.
`air-mentor-api/railway.json` keeps the deploy behavior consistent by running
`npm run db:migrate` before starting the app.

## Tests

- `npm test` starts an ephemeral real PostgreSQL cluster via `embedded-postgres`.
- The test suite then runs the repo's SQL migrations and seeds against that cluster before exercising the API.

## Default Seed Accounts

- `sysadmin` / `admin1234`
- `hod.cse` / `hod1234`
- `cl.kavitha` / `course1234`
- `mentor.sneha` / `mentor1234`
