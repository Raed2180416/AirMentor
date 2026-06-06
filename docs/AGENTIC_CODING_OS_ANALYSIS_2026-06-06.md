# Agentic Coding Operating System — Critical Analysis & Build Plan

**Date:** 2026-06-06 | **Audience:** Broke student, just graduated, CachyOS | **Hardware:** Ryzen 7 7840HS, RTX 4060 8GB | **Goal:** Match GPT 5.5 xHigh / Opus 4.8 Max using ONLY free resources | **Timeline:** 1-2 weeks operational

---

## Part 1: The Brutal Truth

### 1.1 The Performance Gap

| Model | Parameters | Context | Cost/1M | Your Local Equivalent | Gap |
|-------|-----------|---------|---------|----------------------|-----|
| GPT 5.5 xHigh | ~1.8T MoE | 256K | ~$15 | **NONE** | Cannot run locally. Period. |
| Claude Opus 4.8 Max | ~175B | 200K | ~$15 | **NONE** | 8GB VRAM cannot hold 175B |
| Claude Sonnet 4 | ~70B equiv | 200K | ~$3 | **Qwen3 32B (too big)** | Still too large for 8GB |
| Claude Haiku 4 | ~20B equiv | 200K | ~$0.25 | **Qwen3 8B / DeepSeek 14B (maybe)** | **Target** |
| GPT-4o-mini | ~8B | 128K | ~$0.15 | **Qwen3 8B / Gemma 3 12B** | **Local can match** |

**Verdict:** You CANNOT match GPT 5.5 or Opus 4.8 locally on RTX 4060. But you CAN build a **smart routing system** that uses free cloud APIs for hard tasks and local models for the 80% of easy tasks. This is actually BETTER than one big model because different tasks need different capabilities.

### 1.2 Free API Tier Reality (June 2026)

| Provider | Free Tier | Rate Limit | Binding Limit | No Card? | Best For |
|----------|-----------|------------|---------------|----------|----------|
| **Google Gemini** | Generous per-project | Varies | Varies | Yes | Broad capability, smart reasoning |
| **Groq** | 1K req/day, 100K tok/day | 20 req/min | **Token/day binds first** | Yes | Fast short calls (70B models) |
| **OpenRouter** | 50 req/day (no $10), 1K (after $10) | 20 req/min | Daily cap | Yes | Model variety |
| **GitHub Models** | ~50 req/day | Varies | Requests/day | Yes (GH account) | GPT-4o, Claude 3.5 |
| **Cloudflare AI** | 10K neurons/day | Per-neuron | Daily neuron cap | Yes | Edge/light tasks |
| **Together AI** | $5 credit signup | Varies | Credit | Yes | OSS models |
| **SambaNova** | $5 credit signup | Varies | Credit | **Yes (explicit)** | Llama, DeepSeek |
| **Cerebras** | Trial tier | Limited | Requests | Yes | Fast inference |

**Key insight:** Groq's "1,000 req/day" sounds generous, but at 100K tokens/day and 1K tokens/call = only **100 calls/day**.

**With 4-5 accounts per provider:**
- Google Gemini: 4 accounts = ~800-1200 calls/day
- Groq: 5 accounts = 500K tokens/day = ~500 calls/day at 1K tokens
- OpenRouter: 5 accounts = 250 req/day (free) or 5K (after $10 each)
- GitHub Models: 5 accounts = 250 req/day
- Cloudflare: 5 accounts = 50K neurons/day
- Together + SambaNova: 10 accounts x $5 = $50 total credit

**Total: ~1,500-2,500 API calls/day for short tasks.** This is genuinely usable for a solo developer.

### 1.3 Local Model Reality on RTX 4060 (8GB VRAM)

| Model | Size (Q4) | VRAM Needed | Fits? | tok/s | Quality |
|-------|-----------|-------------|-------|-------|---------|
| Qwen3 32B | ~20GB | ~16GB | NO | — | — |
| **Qwen3 8B** | ~5.5GB | ~6GB | **YES** | 25-35 | Best 8B coder |
| **Gemma 3 12B** | ~8GB | ~6GB | **YES** | 25-35 | Google's best small |
| **DeepSeek-R1 7B** | ~4.5GB | ~6GB | **YES** | 30-40 | Reasoning |
| **Llama 3.1 8B** | ~5GB | ~6GB | **YES** | 25-35 | Solid generalist |
| Phi-4 14B | ~9GB | ~8GB | MAYBE | 15-20 | Good reasoning |

**Key:** You can fit ONE model at a time in VRAM. Use Ollama to swap. Your fleet: Qwen3 8B (default), Gemma 3 12B (instruction-heavy), DeepSeek-R1 7B (debugging).

### 1.4 Can You Match GPT 5.5 for CODING?

**No, not directly. But you don't need to.**

| Task Category | % of Work | Required IQ | Local? | Free API? |
|---------------|-----------|-------------|--------|-----------|
| Simple edits, renames, formatting | 30% | Very Low | **YES** | N/A |
| Standard component creation | 25% | Low-Med | **YES** | **YES (Gemini Flash)** |
| Clear bug fixes | 15% | Medium | **YES** | **YES (Groq 70B)** |
| Refactoring | 10% | Medium | **YES** | **YES (Groq 70B)** |
| Complex debugging | 8% | High | NO | **YES (Gemini Pro)** |
| Architecture decisions | 7% | Very High | NO | **MAYBE (Gemini Pro)** |
| Novel algorithms | 5% | Very High | NO | MAYBE |

**Strategy:** Local 8B for 80% easy/medium tasks. Free APIs for 20% hard tasks. A well-orchestrated multi-agent system with focused context windows will outperform a single big model on complex multi-file tasks.

---

## Part 2: The Architecture

### 2.1 Core Design Principles

1. **Tiered Intelligence Routing** — Simple tasks → local, medium → free APIs, hard → best available
2. **Git-Native Everything** — Every agent in its own git worktree. Commits = contract. Rollback always possible.
3. **Immutable Memory** — Decisions stored as immutable records ("beads"), never overwritten.
4. **Context Budget as First-Class Resource** — Track tokens like CPU. Spawn new agents at 80% context.
5. **Kill Criteria** — Agents that loop get killed and reassigned. No infinite retries.
6. **Human in the Loop** — Orchestrator asks YOU for architecture decisions, risky changes, final merges.

### 2.2 System Architecture

```
                    ORCHESTRATOR (You / Main Agent)
                    - Decomposes tasks
                    - Routes to tiers
                    - Manages budgets
                    - Human checkpoints
                           |
    ┌──────────┬──────────┬──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│Tier 1 │ │Tier 2 │ │Tier 3 │ │Tier 4 │ │Tier 5 │
│Local  │ │Free   │ │Free   │ │Free   │ │Review │
│Small  │ │Fast   │ │Smart  │ │Deep   │ │Guard  │
│(8B)   │ │(70B)  │ │(Pro)  │ │(Think)│ │       │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
┌──────────────────────────────────────────────────────┐
│           MEMORY & STATE LAYER                        │
│  - Mem0 (persistent memory)                          │
│  - AGENTS.md (human-curated)                         │
│  - REFLECTION.md (post-task learnings)               │
│  - Git worktrees (isolated execution)                 │
│  - Project knowledge graph (codegraph/ctxo)          │
└──────────────────────────────────────────────────────┘
```

### 2.3 Tier Definitions

| Tier | Name | Models | Use For |
|------|------|--------|---------|
| **T1** | Local Fast | Qwen3 8B, Gemma 3 4B | Simple edits, renames, docs, formatting |
| **T2** | Free Fast | Groq Llama 70B, Groq Qwen3 32B | Standard coding, component creation, clear bugs |
| **T3** | Free Smart | Gemini 2.5 Pro, GitHub GPT-4o | Complex debugging, architecture, multi-file refactor |
| **T4** | Free Deep | Gemini 2.5 Pro long-context | Novel algorithms, system design, research |
| **T5** | Review Guard | Local Phi-4 / Gemma 3 4B | Code review, lint, test analysis (read-only) |

**Routing:** T1 always first. Fallback to T2 on failure. T3 on T2 failure after 2 retries. T4 reserved for architecture. T5 runs in parallel for review.

### 2.4 Dual Brain Architecture

**Global Brain (Project Level):**
- Stores: project goals, architecture, tech stack, constraints
- Format: `PROJECT_BRAIN.md` — human-written, never LLM-generated
- Every agent receives this as system prompt prefix

**Local Brain (Task Level):**
- Stores: current task requirements, acceptance criteria, dependencies, files
- Format: `TASK_CONTEXT.md` — generated by orchestrator, human-approved
- Only the working agent receives this

**Gap Prevention:** Before writing code, agent must answer:
1. "What is the user trying to achieve?" (Global Brain)
2. "What are acceptance criteria for THIS task?" (Local Brain)
3. "How does this serve the project goal?" (cross-check)
4. "What files can I modify?" (scope)

This prevents the "agent goes on a tangent" problem.

### 2.5 Subagent Spawning

**Child Spawning (Hierarchical):**
```
Orchestrator
  ├── Child A (independent)
  ├── Child B (independent)
  └── Child C (depends on A+B)
```
Parent manages dependency graph, children run in parallel where possible.

**Sibling Spawning (Sequential with context carry):**
```
Agent 1 → writes HANDOFF.md → Agent 2 picks up
```
Agent 2 receives full context + handoff notes. Agent 1 is killed to free resources.

**Spawning Rules:**
- Context hits 80% of model limit → spawn sibling
- Task needs >5 files and >3 steps → decompose into children
- Same task fails 3 times → kill, spawn fresh sibling with different approach
- Local GPU hits 70% → pause new spawns, queue tasks

### 2.6 Context Budget Management (Hard Limits)

| Tier | Agent Budget | Warning at | Kill at |
|------|--------------|------------|---------|
| T1 (Local 8B) | 16K tokens | 12K (75%) | 20K |
| T2 (Groq 70B) | 32K tokens | 25K (78%) | 40K |
| T3 (Gemini Pro) | 64K tokens | 51K (80%) | 80K |
| T4 (Deep Think) | 32K tokens | 25K (78%) | 40K |
| T5 (Review) | 16K tokens | 12K (75%) | 20K |

**At warning threshold, agent MUST:**
1. Write `HANDOFF.md`: what was done, what's left, key decisions, file state
2. Signal orchestrator to spawn sibling
3. Terminate itself

### 2.7 Memory System (Three Layers)

| Layer | Technology | Scope | Persistence |
|-------|-----------|-------|-------------|
| **Working** | In-context + `.handoff/` files | Current session | Session only |
| **Short-term** | Mem0 + Qdrant (self-hosted) | Last 30 days | Persistent |
| **Long-term** | AGENTS.md + REFLECTION.md + Git | Forever | Git-backed |

**Mem0 Setup:**
```yaml
# docker-compose.yml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
  mem0:
    image: mem0/mem0:latest
    environment:
      - VECTOR_STORE=qdrant
      - QDRANT_URL=http://qdrant:6333
```

**What goes into Mem0:**
- User preferences ("I prefer functional React")
- Bug patterns ("This error usually means X")
- Architecture decisions
- File relationships
- Project conventions

**What does NOT:** Temporary state, large code blocks, model outputs.

### 2.8 Free API Account Pool & Auto-Switching

```yaml
# config/api-pool.yaml
providers:
  google_gemini:
    accounts:
      - { key: GEMINI_KEY_1, daily_tokens: 500000 }
      - { key: GEMINI_KEY_2, daily_tokens: 500000 }
      - { key: GEMINI_KEY_3, daily_tokens: 500000 }
      - { key: GEMINI_KEY_4, daily_tokens: 500000 }
    models: { gemini-2.5-flash: tier_2, gemini-2.5-pro: tier_3 }
    rate_limits: { rpm: 15, tpm: 1000000 }

  groq:
    accounts:
      - { key: GROQ_KEY_1, daily_tokens: 100000 }
      - { key: GROQ_KEY_2, daily_tokens: 100000 }
      - { key: GROQ_KEY_3, daily_tokens: 100000 }
      - { key: GROQ_KEY_4, daily_tokens: 100000 }
      - { key: GROQ_KEY_5, daily_tokens: 100000 }
    models: { llama-3.3-70b: tier_2, qwen3-32b: tier_2 }
    rate_limits: { rpm: 20, tpm: 100000 }

  openrouter:
    accounts:
      - { key: OR_KEY_1, daily_requests: 50 }
      - { key: OR_KEY_2, daily_requests: 50 }
      - { key: OR_KEY_3, daily_requests: 50 }
      - { key: OR_KEY_4, daily_requests: 50 }
      - { key: OR_KEY_5, daily_requests: 50 }
    models: { openrouter/free: tier_2 }
    rate_limits: { rpm: 20 }

  github_models:
    accounts:
      - { key: GH_KEY_1, daily_requests: 50 }
      - { key: GH_KEY_2, daily_requests: 50 }
      - { key: GH_KEY_3, daily_requests: 50 }
      - { key: GH_KEY_4, daily_requests: 50 }
      - { key: GH_KEY_5, daily_requests: 50 }
    models: { gpt-4o: tier_3, claude-3.5-sonnet: tier_3 }
```

**Auto-switching logic:**
1. Task arrives with required tier
2. Query all providers for that tier, filter accounts not at daily limit
3. Pick account with lowest recent latency
4. On 429, immediately retry next account (no waiting)
5. On exhaustion, fallback to next tier down
6. Track usage in SQLite DB
7. Daily reset at midnight UTC

### 2.9 Resource Management (Ryzen 7 7840HS + RTX 4060)

| Component | Max Allowed | Monitor | When Exceeded |
|-----------|-------------|---------|---------------|
| CPU (all cores) | 70% | psutil every 5s | Queue spawns, notify orchestrator |
| GPU compute | 70% | nvidia-smi every 5s | Pause local inference, route to APIs |
| GPU VRAM | 90% | nvidia-smi | Unload model, clear cache |
| RAM | 80% | psutil | Kill oldest idle agents, write state to disk |

**Model swapping:** Keep Qwen3 8B loaded by default. Only swap when explicitly requested. Swap time: ~5-10s from SSD.

### 2.10 MCP Server Strategy

All MCP servers are LOCAL (free). External calls are ONLY to LLM APIs.

| MCP | Purpose | When to Use |
|-----|---------|-------------|
| codegraph | Semantic code graph, complexity | Pre-task planning |
| ctxo | Blast radius, dependencies | Before any edit |
| LogicStamp | React component contracts | React/TS projects |
| context7 | Library docs | Unfamiliar libraries |
| memory | Persistent memory | Every session |
| filesystem | File operations | Every task |
| git | Git operations | Every task |
| semgrep | Security scanning | Code review |
| ripgrep | Fast text search | Every task |

**Skills deployment:**
- `absolute-brainstorm`: Before ANY architectural decision
- `caveman`: All routine coding tasks (saves tokens)
- `clean-code`: During code review
- `clean-architecture`: Before refactoring
- `test-strategy`: Before writing tests

---

## Part 3: Implementation Roadmap (2 Weeks)

### Week 1: Foundation

**Day 1: Environment Setup**
- Install Ollama, pull Qwen3 8B, Gemma 3 12B, DeepSeek-R1 7B
- Install Aider (`pip install aider-chat`)
- Set up 4 Google accounts + API keys
- Set up 5 Groq accounts + API keys
- Set up 5 GitHub accounts + PATs for GitHub Models
- Set up 5 OpenRouter accounts + API keys
- Install inotify-tools, jq, tmux
- Test each provider with a curl call

**Day 2: Local Model Validation**
- Benchmark Qwen3 8B on coding tasks (tok/s, accuracy)
- Benchmark Gemma 3 12B on same tasks
- Benchmark DeepSeek-R1 7B on reasoning
- Measure VRAM for each
- Document which model handles which tasks

**Day 3: API Router & Pool**
- Build `api_router.py` with SQLite tracking
- Implement account pool, rate limit tracking
- Implement auto-fallback logic
- Test with all providers
- Build CLI usage dashboard

**Day 4: Orchestrator Shell**
- Build `orchestrator.py` main entry point
- Implement task decomposition (heuristic first)
- Implement tier routing logic
- Implement context budget tracking
- Build `TASK_CONTEXT.md` generation

**Day 5: Git Worktree Automation**
- Build `agent-spin <feature>` script
- Build `agent-merge <feature>` script
- Build `agent-clean` script
- Test parallel worktrees
- Configure Aider for worktrees

**Day 6: Memory Layer**
- Set up Mem0 + Qdrant via Docker
- Build `memory_store.py` wrapper
- Implement fact extraction
- Test retrieval
- Set up AGENTS.md and REFLECTION.md templates

**Day 7: Integration & Testing**
- End-to-end test: feature request → decompose → execute → merge
- Test resource monitoring
- Test auto-fallback on rate limits
- Document gaps

### Week 2: Hardening

**Day 8: Multi-Agent Parallelism**
- Implement Agent Teams (shared task list)
- Implement peer-to-peer messaging
- Test parallel execution on real multi-file task
- Implement file locking

**Day 9: Quality Gates**
- Build @reviewer agent (lint, test, security)
- Implement plan approval before risky tasks
- Implement MAX_ITERATIONS=8 with forced reflection
- Test on previously looping tasks

**Day 10: MCP Integration**
- Set up all local MCP servers
- Build MCP router
- Test codegraph → impact analysis → safe edit flow
- Test ctxo → blast radius → task scoping

**Day 11: Self-Improvement Loop**
- Implement REFLECTION.md generation
- Build AGENTS.md update workflow (human approval)
- Test compound learning over 5 tasks
- Build prompt improvement tracking

**Day 12: Resource Optimization**
- Implement smart model swapping
- Implement agent hibernation (write state, kill process)
- Implement agent resurrection (read state, continue)
- Test under CPU/GPU pressure

**Day 13: Real Project Test**
- Pick a real task from backlog
- Run full pipeline end-to-end
- Measure: time saved, token usage, API calls
- Document lessons

**Day 14: Polish & Document**
- Write comprehensive README
- Document architecture
- Set up systemd services
- Create quick-start guide

---

## Part 4: Critical Gaps & What You're Missing

1. **Orchestrator Crash Recovery** — What happens when the orchestrator crashes? You need persistent task state (SQLite) that survives restarts.

2. **Conflict Resolution** — Two agents modifying the same file. Git worktrees prevent this during execution, but merges need a strategy.

3. **Testing the System Itself** — Agents write code. How do you verify it works? Automated test runners must be part of the pipeline.

4. **Security Isolation** — Agents run arbitrary code on your main machine. Consider:
   - Firejail for process isolation
   - Docker containers for untrusted code
   - VMs for really risky tasks

5. **State Sync Across Worktrees** — 3 agents in 3 worktrees need to know about each other's changes. Git fetch + rebase, automated.

6. **Cost Accounting Dashboard** — Real-time: tokens used today, remaining quota per provider, time until reset.

7. **Human Checkpoints** — System should pause and ask YOU before:
   - Deleting files
   - Modifying config files
   - Paid API calls
   - Architecture changes
   - Pushing to remote repos

8. **Network Bandwidth** — Multiple agents downloading models, pulling repos, calling APIs. Home connection can saturate. Mitigate with local caches.

9. **Model Context Protocol (MCP) Server Lifecycle** — You have 10+ MCP servers. They consume RAM. Need start/stop management, not always-running.

10. **Agent State Serialization** — When killing an agent to free RAM, you need to serialize its full state (context, files open, current task progress) to disk, then resurrect later.

11. **Token Counting Accuracy** — Your budget management depends on accurate token counting. Use tiktoken or the provider's token endpoint. Don't estimate.

12. **Rate Limit Prediction** — Don't just react to 429s. Predict when you'll hit limits and pre-emptively route to other providers.

13. **A/B Testing for Models** — For the same task type, try T1 and T2 simultaneously, compare output quality, learn which tier is actually needed.

14. **Warm-Up for Local Models** — Local models need warm-up time after swap. First call is slow. Send a dummy "hello" call after loading.

15. **Disk Space Management** — Multiple worktrees, multiple model downloads, Mem0 vectors, logs. You can burn through 500GB fast on a laptop SSD. Set retention policies.

---

## Part 5: SOTA Research Synthesis (What Actually Works in 2026)

### 5.1 From Addy Osmani (Google) — The Code Agent Orchestra

**Key findings:**
- **3 focused agents outperform 1 generalist working 3x as long.** Parallelism, specialization, isolation, compound learning multiply.
- **Subagents are the simplest pattern and the one to try first.** Parent decomposes task, spawns children, manages dependency graph manually.
- **Hierarchical subagents (teams of teams) give 3x deeper decomposition.** Spawn feature leads that spawn specialists. Parent only talks to 2 agents.
- **Agent Teams (Claude Code experimental) add coordination primitives:** shared task list, dependency tracking, peer-to-peer messaging, file locking.
- **3-5 teammates is the sweet spot.** Token costs scale linearly.
- **Loop guardrails with forced reflection cut stuck agents.** MAX_ITERATIONS=8 + "What failed? What specific change would fix it?"
- **Dedicated @reviewer teammate auto-triggers on every task completion.** 1 reviewer per 3-4 builders.
- **Multi-model routing:** Planning → cheap model, Implementation → premium, Review → security model.
- **Worktree lifecycle scripts:** `agent-spin`, `agent-merge`, `agent-clean` — ~12 lines of bash.
- **CRITICAL: Never let an agent write AGENTS.md.** LLM-generated context files reduce success rates by ~3% and increase inference costs by 20%. Human-curated only.
- **Self-Reflection with REFLECTION.md proposals.** After every task, agent writes what surprised it, one pattern for AGENTS.md, one prompt improvement. Lead reviews and merges.
- **Token Budgeting and Kill Criteria.** Hard per-agent budgets. At 85%, auto-pause. If stuck 3+ iterations, kill and reassign.

### 5.2 From Agentic Patterns — Sub-Agent Spawning

**Key findings:**
- **Declarative YAML Configuration** for agent definitions (role, goal, tools, model)
- **Dynamic Spawning** based on task complexity analysis
- **Git Worktree Isolation** for 10-100 subagents (filesystem-level)
- **Cloud Worker Spawning** for 100+ agents (container/VM isolation)
- Trade-offs: More agents = more coordination overhead, more token cost, more latency

### 5.3 From TokenMix — Free LLM API 2026

**Key findings:**
- **Google Gemini** is the best first stop for broad testing (most generous free tier)
- **Groq** is strongest for fast short responses but token/day binds quickly
- **OpenRouter** is best for model variety behind one API
- **Free tiers are routing lanes, not a single backend.** Mix providers as fallback.
- **"Stop pretending this is free. Add a paid budget cap and router."**
- **Headline limit is often not the binding limit.** Tokens/day and concurrent caps hit first.

### 5.4 From Aider vs Claude Code 2026

**Key findings:**
- **Aider = Git as primary contract.** Commit-centric, maximum provider flexibility, open source.
- **Claude Code = Agent runtime as primary contract.** Subagents, hooks, policy-aware delegation.
- **Aider wins when:** You want provider arbitrage, commit-level traceability, explicit manual control.
- **Claude Code wins when:** You need subagents, hooks, richer runtime automation, policy-aware delegation.
- **Aider cost profile:** Lets you route to any provider explicitly.
- **Claude Code cost profile:** Pro/Max usage shared across Claude and Claude Code.
- **For your system:** Use Aider as the git-first execution engine for individual agents, and build your own orchestrator for the multi-agent layer.

### 5.5 From Mem0 — Agent Memory 2026

**Key findings:**
- Memory is now a **dedicated architectural component**, not just a longer prompt.
- Mem0 extracts facts and stores in vector DB indexed by user, session, agent identifiers.
- **Self-hosted Mem0 + Qdrant = fully local, no API keys, no cloud, no data leaving machine.**
- Reference skills exist for Claude Code, Codex, Cursor, Windsurf — teaches your IDE how to build with Mem0.
- Two categories: Reference skills (always injected) and Task skills (contextual).

---

## Part 6: Unbiased Critical Assessment

### What Will Work

1. **Free API pooling with auto-switching.** This is proven. Multiple accounts per provider = genuine capacity multiplication. 1,500-2,500 calls/day is real.

2. **Local 8B models for routine coding.** Qwen3 8B is genuinely good at simple coding tasks. It will handle 30% of your work effortlessly.

3. **Git worktree isolation.** This is the safest way to run parallel agents. No merge conflicts during execution.

4. **Tiered routing.** Not every task needs a genius. This saves tokens and improves speed.

5. **Context budget management with handoffs.** This prevents the "agent loses track of what it's doing" problem.

6. **Mem0 for persistent memory.** Self-hosted, free, proven architecture.

### What Will NOT Work (Without Significant Effort)

1. **Matching GPT 5.5 xHigh on EVERY task.** Not possible on your hardware. Accept this and design around it.

2. **Fully autonomous agents with no human oversight.** You WILL need to review code before merging. Plan for this.

3. **Running 10+ agents simultaneously on a laptop.** RAM and VRAM will choke. You need serialization/hibernation.

4. **One-week timeline for the full system.** The foundation, yes. Production-ready orchestration, no. Plan for 2 weeks foundation + ongoing iteration.

5. **Zero-cost forever.** Some providers will tighten free tiers. Budget $10-20/month for a paid backup (DeepSeek is cheapest at ~$0.50/1M tokens).

### What I Would Do Differently

1. **Start with Aider + custom orchestrator, not building from scratch.** Aider already handles the git-worktree-model-routing layer. Build the orchestrator on top.

2. **Use Claude Code's Agent Teams if you have Pro/Max access.** The shared task list and dependency tracking is genuinely useful. If not, build a simpler version.

3. **Invest in PROJECT_BRAIN.md first.** This is your highest-leverage document. Spend a day writing it. Every agent will be better because of it.

4. **Measure before optimizing.** Don't build complex routing logic before you know your actual workload. Start with simple rules, collect data, then optimize.

5. **Plan for the "agent writes broken code" problem.** Build test automation FIRST, not as an afterthought. Every agent output should be testable.

6. **Consider Docker for agent isolation.** Running arbitrary generated code on your main machine is risky. Firejail or Docker containers provide safety.

---

## Part 7: Recommended Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| **Local LLM Backend** | Ollama | Best balance of ease-of-use and performance. Native GPU support. |
| **Local Models** | Qwen3 8B (default), Gemma 3 12B, DeepSeek-R1 7B | Best quality for VRAM budget |
| **Git Worktrees** | Native git + bash scripts | Proven, zero dependencies |
| **Agent Execution** | Aider | Git-first, provider-flexible, open source |
| **Orchestrator** | Python (custom) | You need custom routing logic |
| **API Router** | Python + SQLite | Track quotas, implement fallback |
| **Memory** | Mem0 OSS + Qdrant | Self-hosted, vector-backed, persistent |
| **Resource Monitor** | psutil + pynvml | Cross-platform, lightweight |
| **MCP Servers** | All local (codegraph, ctxo, etc.) | Already set up for AirMentor |
| **Skills** | Windsurf/Claude skills | Deployed per task |
| **Container Isolation** | Docker or Podman | For untrusted generated code |
| **Terminal Multiplexer** | tmux | Agent Teams run in split panes |
| **Task Queue** | SQLite + Python | No extra dependencies |
