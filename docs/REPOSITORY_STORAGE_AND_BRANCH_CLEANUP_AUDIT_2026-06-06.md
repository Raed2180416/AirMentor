# AirMentor Repository Storage and Branch Cleanup Audit

Date: 2026-06-06

## Executive outcome

The preservation-first cleanup is complete.

The executed sequence was:

1. Preserve the small serving-model vault and selected research models.
2. Commit the current dirty source state in logical commits.
3. Reconcile two small divergent commits into the committed current line.
4. Create an external Git bundle before rewriting history.
5. Remove generated files from the index and rewrite history.
6. Make the cleaned current line `main`.
7. Delete redundant local branches and prune stale worktrees.
8. Garbage-collect only after the bundle and model vault verify.

GitHub and the local checkout now use only `main`. GitHub's default branch is
`main`, the rewritten history is pushed, and the pre-cleanup ref graph remains
recoverable from the verified all-refs bundle.

## Measured pre-cleanup state

| Area | Measured size | Finding |
|---|---:|---|
| Entire checkout | 115 GiB | Dominated by generated data, environments, and Git history |
| `air-mentor-api/output` | 55 GiB | Research runs, test databases, and archived models |
| `air-mentor-api/tmp` | 14 GiB | Stale embedded PostgreSQL test database |
| `air-mentor-api/output/test-tmp` | 14 GiB | Stale embedded PostgreSQL test databases |
| Python environments | 8.7 GiB | Reinstallable packages, not trained model artifacts |
| `.git` | 28 GiB | 17.88 GiB packed objects, 5.80 GiB loose objects, 3.76 GiB temporary garbage |
| `air-mentor-api/.eval-db-coverage24` | 5.9 GiB | Generated evaluation DB still tracked in the current tree |
| `air-mentor-api/output/proof-risk-model/_archive` | 31 GiB | Historical research models and corpora, not active serving |
| Root Playwright output | 1.4 GiB | Reproducible test traces and failure archives |
| Node modules | 386 MiB | Reinstallable |

There were no live PostgreSQL processes using the discovered embedded database directories. Every discovered `postmaster.pid` was stale at audit time.

## Final active footprint

| Area | Final size | Retention reason |
|---|---:|---|
| Active checkout after verification cleanup | 206 MiB | Source, compact Git history, configuration, and retained local runtime model |
| `.git` directory | 175 MiB | One rewritten branch; object pack is 118.17 MiB |
| Ignored local runtime-model output | 14 MiB | Convenience copy retained to avoid any retraining dependency |
| Tracked governed serving files | 53 KiB | Fresh-clone seed and serving contract |
| Fresh clone before dependency installation | 137 MiB | Independent remote verification baseline |

The active project therefore dropped by more than 99.8%. Reinstalling
JavaScript dependencies temporarily adds approximately 386 MiB.

## Preserve before deletion

### Runtime model vault

The tracked serving contract is intentionally limited to:

- `air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json`
- `air-mentor-api/model-contract/proof-risk-model/promotion-decision.json`

The verified external model vault retains the approximately 11 MiB research
set, including CatBoost heads, versioned bundles, challenger models, evaluation
reports, metrics, and metadata sidecars.

The bundle currently says:

- model family: `catboost`
- model version: `observable-risk-logit-v9`
- promotion decision: `keep-as-shadow`

Seed-time governance resolves this contradictory state to logistic serving. The model files must still be preserved because code and the CLI load them directly.

A verified external vault was created during this audit:

- archive: `/home/raed/Archives/airmentor-model-vault/2026-06-06/airmentor-model-vault-2026-06-06.tar.zst`
- compressed size: 26 MiB
- archived files: 129
- SHA-256: `191bc3a060c579b7770d62ef9feffa38894403a612cf06aa8947ae6d97c5e911`

The archive hash, archive listing, and all 129 source-file hashes were verified after creation.

### Research model vault

Preserve model binaries, metrics, manifests, and promotion decisions from:

- `full-v6-contract-current/training`
- `full-v6-contract-current/training-family-disjoint`
- `sota-policy-benchmark-20260531T000827Z/work/training`
- `sota-policy-benchmark-20260602T215646Z/training`

The incomplete `sota-policy-benchmark-20260602T225657Z` run has only attendance artifacts and no complete promotion record. It is safe to delete after the completed runs are vaulted.

### Reproducibility corpora

Keep one compressed copy of each distinct corpus below, outside Git:

| Corpus | Rows | Columns | SHA-256 |
|---|---:|---:|---|
| Root `features.csv` | 2,024,000 | 71 | `fc28d65c87b6ea1b468cda6424cbbea6c9e3f72c4c3851342c2f7c17f3e9bafc` |
| `features_v3_fixed.csv` | 607,200 | 71 | `6e19c0e54c4a9e8759eb4e316b67ee5158dfd24d956aa6ac3d5948259d949b68` |
| `features_v3_realistic.csv` | 1,012,000 | 61 | `94199c0a9c8d06eda1e8216d4d3bcffa502faa7db228ba8fb4979ffdaa1a2b82` |
| May 31 promoted benchmark | 607,200 | 71 | `fe927deecbb74151a393b43b5411a418531f908ffd246f52da63c4538d70db46` |
| June 2 completed benchmark | 607,200 | 71 | `ccab092e01484c157e8d86fcf4d4b13d73eb97da2bbc8e42f7f74a86248f46cc` |
| Full v6 contract corpus | 441,600 | 58 | `8719183588241ab25bae0686c0874b16e27493b8125dc1fc6cae69b04e9d20df` |

`full-v6-contract-current/features.csv` and `full-v6-contract-baseline/features.csv` are byte-identical. Keep only one compressed copy.

## Safe to delete after a final dry run

These are reproducible and had no live process ownership during the audit:

- `air-mentor-api/tmp` - 14 GiB
- `air-mentor-api/output/test-tmp` - 14 GiB
- `.venv` - 1.5 GiB
- `air-mentor-api/.venv` - 5.9 GiB
- `air-mentor-api/.tabpfn-venv` - 1.3 GiB
- `node_modules` - 386 MiB
- `output/playwright` - 1.4 GiB
- `dist`
- `.ctxo/.cache`
- `.ctxo/index`
- `.audit`
- stale `.git/worktrees` metadata
- `.git/objects/**/tmp_*` temporary garbage - 3.76 GiB

This first pass can reclaim about 42 GiB without deleting trained models or source history.

`air-mentor-api/tmp_db` is generated, but treat it as archive-first because it may be the convenient local development database. Dump it or rename it out of the repository before deletion.

All listed generated directories were deleted after the corresponding archives
verified. `tmp_db` was archived before deletion. Reinstallable `node_modules`
may be removed again after verification without affecting source or models.

## Untracked and purged from Git

The pre-cleanup commit tracked:

| Path | Current tracked payload |
|---|---:|
| `air-mentor-api/.eval-db-coverage24` | 5.9 GiB across 1,602 files |
| `student_risk_trajectories.csv` | 287 MiB |
| `repomix-output.xml` | 180 MiB |
| `all_microdata_dump.json` | 50 MiB |
| `detailed_cohort_analysis.json` | 21 MiB |
| `repomix-src-output.xml` | 15 MiB |
| `deep_cohort_analysis.json` | 4.8 MiB |

These files were removed from the Git index and rewritten history while
remaining available in the external archives.

```bash
git rm -r --cached --ignore-unmatch \
  air-mentor-api/.eval-db-coverage24 \
  student_risk_trajectories.csv \
  repomix-output.xml \
  repomix-src-output.xml \
  all_microdata_dump.json \
  detailed_cohort_analysis.json \
  deep_cohort_analysis.json
```

`git-filter-repo` 2.47.0 processed all 472 commits using the archived 5,459-path
purge manifest. After reflog expiry and garbage collection, the Git pack is
118.17 MiB with no loose-object garbage. The manifest is preserved at:

`/home/raed/Archives/airmentor-git-bundle/2026-06-06/history-rewrite-paths.txt`

## Pre-cleanup branch verdict

The GitHub repository has only one remote branch: `main`. GitHub already uses `main` as its default branch.

The current branch descends from remote `main` and is 18 commits ahead, before counting the uncommitted working tree.

### Redundant local branches

Twenty-seven local branches were ancestors of the current branch and added no
unique commits. They and their stale worktree registrations were deleted after
the preservation bundle verified.

Large alias groups include:

- 9 branches at `888e625f`
- 6 branches at `b591aee3`
- 6 branches at current `b1903f54`
- 6 branches at `5a40f6a8`

### Divergent branches requiring handling

`main` has one unique commit:

- `09779865 fix(api): inject policy to fix Next Stage risk recomputation and timeout`

`p6a-program-template-contract-2026-05-12` has one unique documentation commit:

- `508cedf5 docs: plan P6A program template contract`

Both patches are unique according to `git cherry`. Reconcile them before deleting those branches.

Four Cascade snapshot branches have different commit IDs but the same tree:

- `1d93af1f`
- `2d9381ca`
- `3cb36518`
- `ce03f079`

Together they retain one duplicate content set of approximately 9.0 GiB. Preserve one snapshot in the external Git bundle if desired, then delete all four refs.

### Executed main migration

The dirty branch was not simply renamed. Its intended source state and the two
unique divergent patches were consolidated, history was filtered, and the
result was force-pushed with an exact lease against the audited remote SHA.

```bash
git push --force-with-lease=main:71dbed307484c7f641e8aa3328e9394e9e8d5c52 origin main
```

The verified pre-cleanup bundle is:

`/home/raed/Archives/airmentor-git-bundle/2026-06-06/airmentor-all-refs-before-cleanup-2026-06-06.bundle`

## Final verification

- Remote and local branch inventory: `main` only.
- Remote default branch: `main`.
- Final runtime-preservation commit: `b64b3c103705ec333d8099f63d1c5efddb8f1f6e`.
- Fresh clone `git fsck --full`: passed.
- Fresh clone frontend production build: passed.
- Fresh clone API TypeScript build: passed.
- Fresh clone root suite: 65 files and 331 tests passed.
- Fresh clone serving-model contract: 7 tests passed.
- Academic checkpoint and cross-role parity: 15 tests passed.
- Fresh clone shared-playback browser flow: passed across system-admin, course
  leader, mentor, and HoD with zero console or page errors.
- Tracked runtime model hashes match the verified model-vault sources.

The fresh clone did not use `AIRMENTOR_RISK_MODEL_BUNDLE_PATH` or any local
ignored model output. It seeded from the tracked governed contract.

The compact browser evidence pack is preserved at:

`/home/raed/Archives/airmentor-verification/2026-06-06/browser-proof`

## Cleanup utility guard

`air-mentor-api/scripts/cleanup_stale_artifacts.py` was hardened during this audit:

- old benchmarks now require `--include-old-benchmarks`;
- training corpora now require `--include-training-corpora`;
- the default dry run no longer selects either category.

Do not use either opt-in flag until the corresponding model and corpus archives verify.

## Verification commands

```bash
bash scripts/audit-repository-storage.sh
node scripts/check-repo-hygiene.mjs
git status --short --branch
git count-objects -vH
git worktree prune --dry-run --verbose
```

The cleanup completion criteria were:

- the model vault and corpus archive hashes verify;
- the source build and targeted tests pass from the cleaned checkout;
- GitHub `main` points to the intended cleaned commit;
- a fresh clone can seed and run without local ignored artifacts;
- history no longer contains the purge manifest paths or `.env.tunnel`;
- the current checkout and fresh clone pass repository hygiene checks.
- the preservation bundle verifies and enumerates the old refs.

All criteria passed. The separate dependency-security lane remains open:
`npm audit` reports 14 advisories (7 moderate and 7 high), including direct
dependencies `drizzle-orm`, `fastify`, `vite`, and `xlsx`. Several fixes require
major-version review, and `xlsx` has no npm-provided fix, so those upgrades were
not mixed into this storage and history operation.
