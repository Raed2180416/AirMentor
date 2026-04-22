# Pipeline v2 Runbook

One-page operator guide. Assumes `pipeline/.venv` created by install-deps.

## 0. First time

```bash
bash pipeline/scripts/install-deps.sh
```

Creates `pipeline/.venv` + migrates `$HOME/.local/state/airmentor/pipeline.db`.
Probes optional provider CLIs; does not install them.

## 1. Load a DAG

```bash
source pipeline/.venv/bin/activate
python -m pipeline.orchestrator.main init --dag pipeline/agents/dag.yaml
# → prints JSON; copy dag_run_id
```

Idempotent per `(dag_run_id, node_id)` — re-running will not duplicate.

## 2. Run

### Detached (recommended)

```bash
bash pipeline/scripts/start.sh --dag pipeline/agents/dag.yaml --parallel 4
# spawns tmux sessions:
#   airmentor-pipe-orchestrator   scheduler loop
#   airmentor-pipe-tui            live dashboard
#   airmentor-pipe-<pass>-<id>    one per running subagent
```

### Foreground

```bash
python -m pipeline.orchestrator.main run --dag-run-id <id> --parallel 4
```

## 3. Observe

```bash
# TUI
bash pipeline/scripts/attach-tui.sh

# plain status
python -m pipeline.orchestrator.main status --dag-run-id <id>

# slot ledger
python -m pipeline.orchestrator.main slots

# deep inspect one task
python -m pipeline.orchestrator.main show-task --task-id 7

# attach subagent tmux
bash pipeline/scripts/attach-task.sh 7
```

## 4. Intervene

```bash
# abort everything running (kills tmux + DB state=cancelled)
python -m pipeline.orchestrator.main abort --dag-run-id <id>

# stop all pipeline tmux sessions (non-destructive)
bash pipeline/scripts/stop.sh

# full reset (drops DB; requires YES prompt)
python -m pipeline.orchestrator.main reset
```

## 5. End-to-end self-check (no LLMs)

```bash
rm -f $HOME/.local/state/airmentor/pipeline.db*
python -m pipeline.orchestrator.main init --dag pipeline/agents/dry-run-dag.yaml
python -m pipeline.orchestrator.main run --dag-run-id <id> --parallel 2 --poll 1
```

Expected result: 3/3 completed, 0 failed. Artifacts land in `pipeline/tmp/`.
Exercises every validator (structured_exit → artifact_manifest → scope_glob →
grounding → intent_guard).

## 6. Failure triage

| Symptom | First look |
|---|---|
| Task stays `pending` | deps not completed → `show-task` its parents |
| Task stays `ready` for long | all slots cooling → `slots` + `route-health-*.status` |
| Task `failed` with `no_route` | provider quota/cooldown depleted past budget |
| Task `failed` with `validator_failed` | `show-task` shows which check + detail |
| Task `failed` with `timeout` | wrapper stopped updating log/result; raise `hard_timeout_s` |
| Task `failed` with `executor_exception` | python error; check `$HOME/.local/state/airmentor/orchestrator.log` |
| DB locked | WAL busy; wait 10 s; only one orchestrator should run per DB |

## 7. Defining a new pass

1. Prompt: `audit-map/20-prompts/<pass>.md` (plain markdown).
2. Intent: `pipeline/agents/manifests/<pass>.intent.yaml` — `purpose`, `nonneg`, `owner_files`.
3. Artifacts: `pipeline/agents/manifests/<pass>.artifacts.yaml` — list of `{path, min_lines, min_bytes, required_sections, write_mode}`.
4. Add node to `pipeline/agents/dag.yaml` with `pass`, `prompt_file`, `intent_file`, `manifest_file`, `write_scope_glob`, `parallel_group`, `depends_on`, `priority`.
5. `init` again (idempotent). New nodes get inserted; existing ones untouched.

## 8. Unit tests

```bash
./pipeline/.venv/bin/python -m pytest pipeline/tests -ra
# 51 passed
```

Covers:
- `test_contracts` — structured exit marker parsing
- `test_grounding` — file:line citation probe
- `test_db` — atomic claim, parallel group capacity, **per-account_key guard**, merge locks
- `test_dag` — cycle detection, materialisation, idempotence
- `test_validator` — 5-gate stack
- `test_router` — slot pick, cooldown, model-class mapping
- `test_merge_controller` — file + SQLite merge locks
- `test_executor_smoke` — prompt composition + wrapper script
- `test_worktree` — per-task git worktree create / clean-merge / cleanup
- `test_native_runner` — marker synthesis, DB session-id capture, exception handling
- `test_briefing` — outcome record + ancestor pack chaining

## 9. 5-layer stack (see `pipeline/docs/LAYERED_ARCHITECTURE.md`)

| Layer | Tool | Status |
|---|---|---|
| L1 Methodology | `specify` (spec-kit) | installed via `uv tool install` |
| L2 Discipline | `superpowers` skills | cloned to `~/.claude/skills/_superpowers`, 14 skills symlinked as `sp-*` |
| L3 Semantic context | `ctxo` MCP | built, registered in `claude mcp` + `codex mcp`, run `ctxo index` once per repo |
| L4 Token optimization | `rtk` | pending Rust toolchain; install: `curl -fsSL https://rtk-ai.app/install.sh \| sh` |
| L5 Product shell | this pipeline | `pipeline/` — DAG + worktree + ledger + TUI |

Runner decision matrix: `pipeline/docs/DECISION_MATRIX.md`.

## 10. Safe parallelism guarantee

Five independent guards, applied in order:

1. `write_scope_glob` overlap check at validator time
2. `parallel_group` capacity cap (`--group-capacity N`)
3. `busy_account_keys` concurrency guard (arctic auth_source_key cannot be hit by 2 concurrent tasks)
4. Per-task git worktree (`orchestrator/worktree.py`) — one filesystem branch per running task
5. Shared-ledger merge lock (`orchestrator/merge_controller.py`)
