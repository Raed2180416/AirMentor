# AirMentor Repository Storage and Branch Cleanup Audit

Date: 2026-06-06

## Executive decision

Do not delete all branches or run Git garbage collection yet.

The correct sequence is:

1. Preserve the small serving-model vault and selected research models.
2. Commit the current dirty source state in logical commits.
3. Reconcile two small divergent commits into the committed current line.
4. Create an external Git bundle before rewriting history.
5. Remove generated files from the index and rewrite history.
6. Make the cleaned current line `main`.
7. Delete redundant local branches and prune stale worktrees.
8. Garbage-collect only after the bundle and model vault verify.

## Measured state

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

## Preserve before deletion

### Runtime model vault

The current runtime model contract is approximately 11 MiB:

- `air-mentor-api/output/proof-risk-model/risk-model-bundle.json`
- `air-mentor-api/output/proof-risk-model/promotion-decision.json`
- Five `catboost_<head>_v1.json` files
- `risk-model-bundle-v10.json`
- `risk-model-bundle-v11.json`
- `v3_xgboost_overallCourseRisk.json`
- `v3_lightgbm_overallCourseRisk.txt`
- `v3_catboost_overallCourseRisk.cbm`
- Evaluation report, metrics, and metadata sidecars

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

## Untrack and purge from Git

The current commit still tracks:

| Path | Current tracked payload |
|---|---:|
| `air-mentor-api/.eval-db-coverage24` | 5.9 GiB across 1,602 files |
| `student_risk_trajectories.csv` | 287 MiB |
| `repomix-output.xml` | 180 MiB |
| `all_microdata_dump.json` | 50 MiB |
| `detailed_cohort_analysis.json` | 21 MiB |
| `repomix-src-output.xml` | 15 MiB |
| `deep_cohort_analysis.json` | 4.8 MiB |

These files should be removed from the Git index while remaining available in the external archive:

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

Removing them from the latest commit is not enough to shrink `.git`. Use `git filter-repo` in a disposable clone after the preservation bundle is verified.

`git filter-repo` is not currently installed on this machine.

## Branch verdict

The GitHub repository has only one remote branch: `main`. GitHub already uses `main` as its default branch.

The current branch descends from remote `main` and is 18 commits ahead, before counting the uncommitted working tree.

### Safe local branch deletions after current work is committed

Twenty-seven local branches are ancestors of the current branch. They add no unique commits and can be deleted after their stale worktrees are pruned.

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

### Recommended main migration

Do not simply rename the dirty current branch.

Recommended sequence:

```bash
# 1. Commit the current source, test, migration, and documentation work
#    in logical commits. Do not include generated databases or output.

# 2. Reconcile the two small divergent commits.
git cherry-pick 09779865
git cherry-pick 508cedf5

# 3. Create preservation refs before branch surgery.
git tag pre-consolidation-main-2026-06-06 main
git tag pre-consolidation-cascade-2026-06-06 1d93af1f
git tag pre-consolidation-current-2026-06-06 HEAD

# 4. Create and verify an external bundle.
git bundle create /external/path/AirMentor-pre-consolidation-2026-06-06.bundle --all
git bundle verify /external/path/AirMentor-pre-consolidation-2026-06-06.bundle

# 5. In a disposable clone, purge generated history with git-filter-repo.
# 6. Point cleaned main at the reconciled current line.
# 7. Push with an exact lease against the audited remote main.
git push --force-with-lease=main:71dbed307484c7f641e8aa3328e9394e9e8d5c52 origin main
```

After the cleaned `main` is pushed and verified, delete redundant local refs and expire old reflogs. Do not run aggressive garbage collection before the external bundle verifies.

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

The cleanup is complete only when:

- the model vault and corpus archive hashes verify;
- the source build and targeted tests pass from the cleaned checkout;
- GitHub `main` points to the intended cleaned commit;
- a fresh clone can seed and run without local ignored artifacts;
- the preservation bundle restores the old refs in a throwaway directory.
