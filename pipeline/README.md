# AirMentor Pipeline v2

Deterministic, parallel-safe, hallucination-guarded automation layer.
Sits on top of existing `audit-map/16-scripts/` infra. Does not replace it.

## Why v2

Existing pipeline is sequential, relies on byte/line count for validation,
has no structured exit contract, no hallucination probe, no DAG, no live TUI.
Symptoms: random exits, early false completion, prompt drift, context loss.

## Guarantees

| Property | Mechanism |
|---|---|
| Atomic task claim | SQLite WAL + `UPDATE ... WHERE state='pending'` returning rowcount |
| No early exit | Structured exit contract `<<AIRMENTOR_PASS_RESULT>>{json}<<END>>` — missing ⇒ failed |
| No hallucination | Grounding probe: every `file:line` cite must exist |
| No scope creep | Per-pass `write_scope_glob` — git-diff rejected outside glob |
| No intent drift | `intent.yaml` + post-pass intent-guard model check |
| Parallel safe | Disjoint write-scope DAG + merge-controller serialises shared-ledger writes |
| Account cycling | Slot ledger with cooldown/credit timers, blocks until slot opens, picks best ranked |
| Model fit | Task class → model + reasoning-effort, with OSS fallback |
| Token econ | Caveman auto by remaining quota, minimal prompt bundle, per-pass doc injection |
| Live visibility | Textual TUI, tmux attach to any subagent, SQLite query ad hoc |
| Determinism | All ops idempotent, retries resume from checkpoint, no wall-clock dependence in logic |

## Layout

```
pipeline/
  db/schema.sql              SQLite schema
  orchestrator/              core
  tui/dashboard.py           live TUI
  agents/manifests/*.yaml    per-pass contracts
  scripts/*.sh               bootstrap
  tests/*.py                 unit
```

## Quickstart

```bash
# install OSS deps (idempotent)
bash pipeline/scripts/install-deps.sh

# init DB + load DAG
python3 -m pipeline.orchestrator.main init --dag pipeline/agents/dag.yaml

# run (detached tmux, parallel where safe)
bash pipeline/scripts/start.sh

# watch live
bash pipeline/scripts/attach-tui.sh

# attach specific subagent tmux
tmux attach -t airmentor-pipe-<pass-name>
```

## Integrations

- `audit-map/16-scripts/_audit-common.sh` — slot helpers reused
- `audit-map/25-accounts-routing/slot-map.tsv` — account inventory source of truth
- `audit-map/16-scripts/tmux-start-job.sh` — tmux launcher reused
- `audit-map/16-scripts/arctic-session-wrapper.sh` — arctic slot exec
- `audit-map/16-scripts/claude-session-wrapper.sh` — claude exec
- `audit-map/16-scripts/caveman-auto-mode-by-usage.sh` — caveman ladder

## New providers added

- `windsurf-trial` — Windsurf Cascade via its CLI (14-day)
- `ccs` — [kaitranntt/ccs] multi-account switcher, fallback router
- `oss-local` — local OSS model via `ollama`/`llama.cpp` for low-risk tasks

## Non-goals

- Not a replacement for `audit-map/` governance
- Not a model training pipeline
- Not a secrets manager (uses existing XDG-scoped slot dirs)
