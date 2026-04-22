# Layered Architecture

Critical map of devgenius.io's 5-layer agentic stack against our pipeline v2.
The article's thesis — **"serious agentic coding needs a stack, not a favorite
tool"** — is exactly how this repo is now organized. Tools are installed per
layer; nothing at a layer pretends to solve another layer's problem.

## The 5 layers (from the article)

| # | Layer | Question it answers | Failure modes it reduces |
|---|---|---|---|
| 1 | Delivery Methodology | When should the AI analyze, plan, and implement? | Consistency failures · Specification gaps |
| 2 | Agent Discipline | How should the AI behave while building? | Review bottlenecks · Consistency failures |
| 3 | Technical Context | What does the code actually mean? | Review bottlenecks · Multi-session conflicts |
| 4 | Token Optimization | How much tool output enters context? | Context loss |
| 5 | Product Surface | Where does the operator run the whole system? | Multi-session conflicts · Review bottlenecks |

## What we adopted at each layer

### Layer 1 — Delivery Methodology

**Installed:** `specify` (GitHub spec-kit) via `uv tool install`.

**How it plugs in:**
  - Available on `$PATH` as `/home/raed/.local/bin/specify`.
  - Workflow: `specify init → /specify → /plan → /tasks → /implement`.
  - Spec artifacts live in a `.specify/` directory at repo root; our pipeline
    can treat each `/tasks` output line as a node in a pipeline DAG.

**How our pipeline enforces Layer 1 already:**
  - Per-pass `intent.yaml` (`pipeline/agents/manifests/*.intent.yaml`) is
    **executable spec** — the validator stack fails the pass if
    `intent_affirmed=false` in the structured exit marker.
  - Per-pass `artifacts.yaml` declares `required_sections` + `min_bytes` so
    under-specified output → hard failure.

**Gap closed:** we now use the spec-kit artefact chain to *generate* the
intent/artifact pairs from human-language feature descriptions instead of
hand-writing them.

### Layer 2 — Agent Discipline

**Installed:** `obra/superpowers` skill library cloned to
`~/.claude/skills/_superpowers`, with per-skill symlinks
`~/.claude/skills/sp-*` so claude-code auto-loads them.

Skills registered (14):
  - `sp-test-driven-development`
  - `sp-systematic-debugging`
  - `sp-verification-before-completion`
  - `sp-writing-plans` · `sp-executing-plans`
  - `sp-brainstorming` · `sp-writing-skills`
  - `sp-subagent-driven-development`
  - `sp-dispatching-parallel-agents`
  - `sp-using-git-worktrees`
  - `sp-using-superpowers`
  - `sp-requesting-code-review` · `sp-receiving-code-review`
  - `sp-finishing-a-development-branch`

**How our pipeline enforces Layer 2 already:**
  - The **structured exit contract** (`contracts.py`) is a verification-gate:
    no `<<AIRMENTOR_PASS_RESULT>>{json}<<END>>` → task failed regardless of
    exit code.
  - The **grounding probe** (`grounding.py`) refuses citations to
    nonexistent `file:line` → hallucinated claims fail the pass.
  - The **scope-glob check** in validator.py refuses writes outside the
    declared `write_scope_glob`.

**Gap closed:** TDD + systematic-debugging + subagent-delegation are now
auto-loaded skills inside every Claude Code session run by the pipeline.

### Layer 3 — Technical Context

**Installed:** `alperhankendi/Ctxo` built under
`~/.local/share/ai-tools/Ctxo`, wrapper script at
`~/.local/bin/ctxo`, registered as stdio MCP for:
  - `claude mcp add ctxo -- /home/raed/.local/bin/ctxo`
  - `codex mcp add ctxo /home/raed/.local/bin/ctxo`
  - `.mcp.json` wired by `ctxo init --tools claude-code -y`

Ctxo tools claude/codex now call automatically when reasoning about code:
  - `get_blast_radius` — "what breaks if I change this?"
  - `get_logic_slice` — "what does this symbol depend on?"
  - `get_why_context` — git intent behind a line
  - `get_symbol_importance` — PageRank over the dependency graph
  - `find_dead_code` / `get_pr_impact`

**How our pipeline enforces Layer 3 already:**
  - The **grounding probe** verifies every claim refers to a real line, but
    it does NOT explain *meaning*. Ctxo fills the meaning gap.

**Run before first use:** `ctxo index` (builds `.ctxo/` graph). Incremental
watcher then keeps it fresh via the installed git hooks.

### Layer 4 — Token Optimization

**Not installed yet:** `rtk` (Rust Token Killer) needs a Rust toolchain we
don't have on this box. Document install path in the runbook; until it's
present we rely on:
  - `AUDIT_PROMPT_VERBATIM=1` env in our arctic wrapper to skip caveman
    injection where we've already crafted the prompt.
  - Caveman mode (wenyan-ultra) as the default communication style, per the
    `~/.agents/AGENTS.md` policy.
  - Manifest-enforced `min_bytes` / `min_lines` so agents can't pad.

**Gap to close when Rust is available:**
```bash
curl -fsSL https://rtk-ai.app/install.sh | sh
# rtk auto-integrates into opencode via the @openrtk plugin
```

### Layer 5 — Product Surface

**Built in-house:** this pipeline itself (`pipeline/`) is our Layer-5
operational shell. What it gives us that `gsd-2` and similar products
sell:

| Capability | Our module |
|---|---|
| DAG + dependency resolution | `orchestrator/dag.py` |
| Atomic task claim (WAL) | `orchestrator/db.py :: claim_next_ready` |
| Multi-provider runner dispatch | `orchestrator/executor.py` |
| Anthropic-native path (user can't use API) | `orchestrator/claude_runner.py` |
| OpenAI-direct codex path | `orchestrator/codex_runner.py` |
| OpenRouter free fallback via opencode | `orchestrator/opencode_runner.py` |
| Arctic multi-account rotation | `audit-map/16-scripts/arctic-session-wrapper.sh` |
| **Per-task git worktree isolation** | `orchestrator/worktree.py` |
| Per-account concurrency guard | `db.claim_next_ready(busy_account_keys=...)` |
| Context handoff (briefing pack) | `orchestrator/briefing.py` |
| Session resume | `arctic_session_id` in tasks + `claude --resume` |
| Live TUI + plain fallback | `tui/dashboard.py` |
| Cost / usage ledger | `orchestrator/slot_ledger.py` |
| Validator stack | `orchestrator/validator.py` |
| Cooldown-aware router | `orchestrator/router.py` |

## The "Gap nobody has filled yet"

The article's unclaimed frontier: **spec-to-code traceability** — requirement
→ implementing symbols → covering tests → PR impact.

Our current coverage:

| Question | Answer today |
|---|---|
| Which code symbols implement requirement RQ-12? | `intent.yaml :: owner_files` → validator scope-glob enforces the link |
| Which tests cover this spec item? | `artifacts.yaml :: required_sections` can include test file paths |
| If this requirement changes, what breaks? | **Gap.** Depends on Ctxo `get_blast_radius` being called during the planning pass |
| Which agents are touching the same requirement? | `db.claim_next_ready(busy_account_keys=..., allow_parallel_groups=...)` + git-worktree isolation per task |

**Next step to close the gap fully:** add a `requirement_id` column on
tasks + artefacts, emit it inside the structured exit marker, and join in
the validator to produce a `requirement → {symbols, tests, agents, PRs}`
matrix. Pipeline already has the hooks (`result_json` + intent schema).

## Minimum viable combination (our default)

From the article's combinations table, we're running combination **#2
(Team workflow, larger repos)** augmented with Layer-5 in-house:

```
BMAD-METHOD (optional)   spec-kit      <-- L1  installed (specify)
   ⟶ superpowers skills                 <-- L2  installed (~/.claude/skills/sp-*)
      ⟶ Ctxo MCP                        <-- L3  installed + MCP registered
         ⟶ RTK (pending Rust)           <-- L4  documented, not installed
            ⟶ our pipeline (L5 shell)   <-- built in pipeline/
```

## 5 lessons applied

1. **No layer-confusion.** Every pass manifest declares a `task_class`; each
   task class already implies the right reasoning effort + model, so we
   don't debate "which tool" — the DAG node declares intent + scope and the
   router handles selection.
2. **Good planning ≠ safe changes.** That's why we gate with Layer 3 (Ctxo)
   + the scope-glob check + git worktree merge-conflict detection.
3. **Token optimisation is reliability.** Our validator fails empty or
   thin artefacts; caveman mode is default; RTK-style shell filtering is on
   the roadmap.
4. **Lightest stack wins first.** The dry-run DAG uses only `local-dry`,
   zero accounts, zero quota, zero network — pipeline proof in 15 seconds.
5. **Spec-to-code traceability next.** `requirement_id` column is the next
   schema migration; all the other wiring is already there.
