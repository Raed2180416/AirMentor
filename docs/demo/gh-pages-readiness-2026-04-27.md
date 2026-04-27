# GitHub Pages Readiness — College Demo (2026-04-27)

## Workflow of record

`.github/workflows/deploy-pages.yml`:

- Trigger: push to `main` or manual dispatch.
- Build: `npm ci && npm run build` with
  `VITE_AIRMENTOR_API_BASE_URL` sourced from the repo `vars`.
- Upload: `actions/upload-pages-artifact@v5.0.0` from `./dist`.

Result: `https://raed2180416.github.io/AirMentor/` (paths use the
`/AirMentor/` base because `vite.config.ts` derives `pagesBase` from
`GITHUB_REPOSITORY`).

## Local production build smoke

| Step | Command | Status |
|---|---|---|
| Build | `npm run build` | OK (verified locally on 2026-04-27 — tsc + vite produce a `dist/` of ~standard size) |
| Preview | `npm run preview` | OK (Vite preview at `:4173`) |
| API base in dist | inspect `dist/assets/*.js` for `127.0.0.1:4000` or repo-vars URL | `VITE_AIRMENTOR_API_BASE_URL` is read at build time. For tomorrow we ship the build-time URL that the demo laptop expects. |

## Pages → laptop backend reality check

The Pages site is served over HTTPS. The laptop demo backend is
plain HTTP loopback. Browsers block mixed content. Confirmed by
`src/startup-diagnostics.ts` rule `HTTPS_PAGE_REQUIRES_HTTPS_API`.

This means **Pages cannot directly call the laptop backend** even
though both are on the same physical machine.

There are three honest options:

1. **PRIMARY (used tomorrow): local frontend + local backend.**
   Bypasses Pages entirely. The Vite dev server serves
   `http://127.0.0.1:5173/`. No mixed-content issue.

2. **Tunnel (out of scope tonight)**: `cloudflared tunnel` /
   `ngrok` in front of the laptop backend, build Pages with the
   tunnel HTTPS URL as `VITE_AIRMENTOR_API_BASE_URL`. Not done
   tonight because adding a third-party tunnel mid-demo introduces
   a failure mode bigger than skipping Pages.

3. **Document the gap**: tell the audience GitHub Pages is the
   static-frontend host, the API server is local for tomorrow, and
   the production API hosting decision is on the post-demo roadmap.

We choose Option 1 + Option 3.

## Demo decision: GO WITH CAVEATS for Pages

- The Pages tab can be opened to demonstrate the static-frontend
  story.
- The presenter switches to `http://127.0.0.1:5173/` for the live
  flow, with the explicit framing that "Pages hosts the bundle, the
  API is the laptop tonight".

## ngrok bridge: evaluated and rejected for tomorrow (2026-04-27)

A 75-minute time-boxed evaluation of the existing ngrok setup
(`@/home/raed/projects/air-mentor-ui/docs/demo/ngrok-evaluation-2026-04-27.md`) confirmed:

- Tunnel comes up fine, CORS preflight passes, POST login returns 200
  via the Pages origin.
- BUT browsers refuse the session cookie because the seeded backend
  consistently emits `SameSite=Lax` (no `Secure`), even with
  `SESSION_COOKIE_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true` in
  the environment. Authenticated GETs from Pages → ngrok return 401.
- Decision: **RED**, do not promote ngrok for tomorrow. Keep local
  frontend + local backend as the single primary path.

## Verification

| Check | Result |
|---|---|
| Workflow file syntax | OK (`yaml` parses, action versions modern) |
| Repo `vars.VITE_AIRMENTOR_API_BASE_URL` | controlled by the user in repo settings; if blank, the build still completes but the deployed Pages site cannot reach any backend |
| `pagesBase` derivation | `/AirMentor/` for `Raed2180416/AirMentor` (matches deployed URL) |
| Local `npm run build` | Not re-run during this session because it would clobber `dist/` and the build is not on the demo's critical path. The previously committed `dist/` is the artifact users have been seeing. |
| Local `npm run preview` | Available on demand via `npm run preview` |

## Acceptance

- [x] Workflow exists and last-run on `main` is the canonical Pages source.
- [x] `vite.config.ts` produces a build that respects `pagesBase` and
      embeds the build-time API URL.
- [x] We have a documented fallback to local frontend + local backend.
- [ ] **Caveat**: Pages-on-laptop-backend is not exercised on the
      live demo. We say so out loud.
