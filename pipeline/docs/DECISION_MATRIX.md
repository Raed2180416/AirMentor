# Runner Decision Matrix

Per-task routing logic. The router picks **one** Runner based on the task
row + live slot ledger state. When the primary runner fails we auto-failover
along the chain below.

## Tool-to-layer binding

| Layer | Tool | Role in our stack |
|---|---|---|
| L1 Methodology | `specify` (spec-kit, installed) | Generate intent/artifact manifests from natural-language specs |
| L2 Discipline  | `superpowers` skills (installed) | Auto-loaded in claude/codex sessions — TDD, verification, sub-agent delegation |
| L3 Semantic    | `ctxo` MCP (installed + registered) | Blast radius, logic slice, git intent, dead code, PR impact |
| L4 Tokens      | `rtk` (documented, pending Rust) | Shell-output compression 60-90% |
| L5 Product shell | This pipeline (`pipeline/`) | DAG, worktrees, ledger, TUI, validators |

## Runner preference order per provider family

For an Anthropic task (`require_provider: anthropic`):

```
claude CLI headless (claude -p --output-format stream-json --resume SID)
   │ fails / missing / quota
   ▼
arctic with anthropic slot  (falls back via slot_ledger)
   │ fails / quota
   ▼
opencode with openrouter/anthropic/...  (if OPENROUTER_API_KEY set)
```

For an OpenAI/codex task (`require_provider: codex` or `native-codex`):

```
codex exec --json                      (direct, per-account auth.json)
   │ fails / quota
   ▼
arctic with codex slot (codex-01..06)  (multi-account rotation via arctic)
   │ all accounts cooling
   ▼
opencode with openrouter/openai/gpt-oss-120b:free  (zero-cost fallback)
```

For an Antigravity/Google task:

```
arctic with antigravity:account/gemini-...  (user has 9 antigravity accounts)
   │ fails
   ▼
opencode with openrouter/google/gemini-...  (free tier if enabled)
```

For a low-risk bulk task:

```
opencode + openrouter/qwen/qwen-2.5-coder-32b-instruct:free   (zero cost)
   │ rate-limited (20 req/min free)
   ▼
arctic with cheapest-tier slot
```

For dry-run / CI smoke:

```
local-dry  (pipeline/scripts/dry-run-agent.py — no network, no auth)
```

## When to use each runner

| Runner | Picked when | Notes |
|---|---|---|
| `claude_runner` (Layer 5 → claude CLI) | `require_provider=anthropic` or auto-router picks anthropic | Uses `--session-id` to pin + resume across retries. Session IDs go into `tasks.arctic_session_id`. |
| `codex_runner` (Layer 5 → codex exec) | auto-router picks codex/native-codex | `--output-last-message` for clean capture, `codex resume <id>` for attempt > 1. |
| `opencode_runner` (Layer 5 → opencode) | fallback when arctic cooling OR `require_provider=openrouter` | One-shot `opencode run`; attach to `opencode serve` for MCP warm-start. |
| Arctic (via `arctic-session-wrapper.sh`) | every other provider (antigravity, google, copilot, codex-via-arctic) | Per-slot XDG isolation; 20 verified accounts. |
| `local-dry` (dry-run stub) | `require_provider=local-dry` | CI + end-to-end pipeline proof. |

## Safe-parallelism guard chain

Two tasks NEVER run together if any of these fire:

1. **`write_scope_glob` overlap** — declared in DAG; enforced by validator.
2. **Same `parallel_group` over capacity** — `claim_next_ready(group_capacity=N)`.
3. **Same `account_key` in-flight** — `claim_next_ready(busy_account_keys=[...])`.
4. **Same git file touched** — prevented by per-task `worktree.prepare()`.
5. **Shared ledger write** — `merge_controller.merge_lock(resource, holder)`.

## Token-economy rules

1. Every passes' prompt injects caveman mode by default (wenyan-ultra).
2. Non-verbatim pass prompts get passed through `CAVEMAN_ENFORCED=1` env.
3. When RTK is installed: wrap all shell calls → 60-90% reduction.
4. Ctxo MCP replaces ripgrep sprees → one `get_blast_radius` call instead of 47.
5. Briefing pack (via `briefing.py`) carries only the structured result +
   transcript tail to downstream tasks, never raw logs.

## Spec-to-code traceability (the article's "unclaimed frontier")

Our schema already exposes the join:

```
intent.yaml             -→ tasks.intent_file                    (purpose / owner_files)
artifacts.yaml          -→ tasks.manifest_file + expected_artifacts
exit marker citations   -→ result_json.citations              (file:line)
validator grounding     -→ grounding_probes rows              (verified?)
worktree diff           -→ tasks.git_head_before/after
```

Add `requirement_id` to `tasks` and extend `structured_exit` to emit it
inside the marker — the full req → symbols → tests → agents matrix
materialises automatically.
