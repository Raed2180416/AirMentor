# Changelog

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md`. Every phase task that
> lands updates §4 of the roadmap and adds an entry here.
> Format: `YYYY-MM-DD · phase(Pn) · short summary · refs`.

---

## Paper venue & deadline (Decision L2)

> Default — override by editing this section.

- **Primary venue:** EDM 2027 (Educational Data Mining).
- **Target submission window:** abstract ~early February 2027, full paper ~one week later
  (extrapolating from EDM 2026 dates: abstract 2026-02-02, full 2026-02-09).
- **Fallback venue 1:** AIED 2027 (similar early-year deadline; rolling Springer LNCS process).
- **Fallback venue 2:** IEEE Transactions on Learning Technologies (rolling, journal).
- **Working back from ~2027-02-01 (T):**

```
2026-05-01  P0 (this week)
2026-05-08  P1 start (3 weeks)
2026-05-29  P2 start (2 weeks)
2026-06-12  P3 + P4 parallel (3 weeks)
2026-07-03  P5 start (2 weeks)
2026-07-17  P6 start (3 weeks)
2026-08-07  P7 start (3 weeks)
2026-08-28  P10 outline (paper drafting begins, parallel from here)
2026-12-01  P10 figures + drafts complete
2027-01-15  P10 internal review
2027-02-01  Submission
```
- **Risk note:** if EDM 2027 dates slip later than EDM 2026, all the above
  shifts; the buffer between P7 close and submission is what absorbs the
  slip. If EDM 2027 dates compress earlier (unlikely), the fallback to
  IEEE TLT (no fixed date) protects the work.

If you choose differently (different venue, different date), edit this
block, then re-run the timeline math at roadmap §9.1.

---

## Phase log

### 2026-05-01 · phase(P0) · roadmap inception, hygiene, scaffolding

- **5f2cd413** untrack `air-mentor-api/dist/` (189 build artifacts), split
  `.claude/settings.local.json` into committed `.claude/settings.json`
  (project-shared subset) and gitignored `.claude/settings.local.json`
  (per-user override). Hardened `.gitignore` with explicit entries.
  Refs K1, K2, K6.
- **21e3269d** wired `RENDER_PUBLIC_API_URL` as primary in
  `.github/workflows/deploy-pages.yml`, `.github/workflows/verify-live-closeout.yml`,
  `scripts/check-railway-deploy-readiness.mjs`. Railway URL kept as
  fallback so Render rollover (P8) is incremental, not flag-day. Refs G10–G12.
- Scaffolded `docs/CAPABILITY_MATRIX.md`, `docs/POSITIONING.md` (L1 default = A),
  `docs/CHANGELOG.md` (this file with L2 default), `docs/BRANCH_STRATEGY.md`,
  `docs/paper-evidence/README.md`. Refs K4, K5, K7, E15, L1, L2.

#### Honest disclosures from the P0 sweep

- **Working tree NOT fully cleaned to zero (roadmap §3 expectation).** At P0 close
  there are ~50 modified `air-mentor-api/src/*` and `src/*` files plus several
  untracked `audit-map/32-reports/*.md` and `docs/*.md` reports. These are
  in-progress work from prior chats (P3 / P5 / P6 bleed) and from
  realism-readiness-security audits. They are **not P0 scope** and were
  intentionally left untouched. Resolve them in the phase commits that own
  them, not as a hygiene sweep.
- **`node_modules/` is partially tracked.** `node_modules/.vite/deps/*` and
  `air-mentor-api/node_modules/.vite/vitest/*` are in the index despite
  `node_modules` being in `.gitignore`. This is the same root cause as the
  dist issue (added before the ignore rule). Treat as **K8** (new issue, P0
  follow-up): `git rm --cached -r node_modules/.vite/ air-mentor-api/node_modules/.vite/`.
  Deferred this commit to keep the P0 blast radius small (could touch
  thousands of files; needs a separate review window).
- **Decision L8 ("Recalibrate vs Retrain coexist?")** is *implied* by the L1
  default to A; flagged here so P3 task 3.7 enters with "full replace" and
  not "coexist".

### Pending — to be filled as phases land

```
2026-05-?? · phase(P1) · learning-dynamics-constants, references.bib, …
2026-05-?? · phase(P2) · generative-process split, baselines, …
…
```
