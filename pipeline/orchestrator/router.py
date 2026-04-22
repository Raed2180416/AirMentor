"""Account router v2.

Decides (slot, provider, model, reasoning_effort) per task. Waits for slot
availability when all out. Emits audit events.

Model/reasoning policy maps live here; kept narrow and explicit so the model
assignment is a pure function of (task_class, risk_class, slot capabilities).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Iterable

from . import db, slot_ledger

# ---------- reasoning effort ladder ----------

# Baseline effort per task class. The router picks max(class-default,
# floor-pin) for the chosen model. "max" maps to claude `--effort max` /
# codex `--reasoning=xhigh` depending on the runner.
EFFORT_BY_CLASS = {
    "bookkeeping":    "low",      # trivial: typo, rename
    "structured":     "medium",   # feature/test/refactor
    "high-stakes":    "xhigh",    # arch/security/migration
    "orchestration":  "medium",   # planning DAGs
    "recovery":       "low",      # cheap retry
}

# Per-model effort floor. Any route where (provider, model) matches will
# bump to at least this effort regardless of task_class. Wildcard "*" in
# provider matches anything. Both dash and dot variants are listed because
# anthropic CLI uses "claude-opus-4-6" while copilot/antigravity use the
# dotted form. Rather than normalize everywhere, we register both keys.
EFFORT_FLOOR = {
    ("*", "claude-opus-4.7"):            "max",
    ("*", "claude-opus-4-7"):            "max",
    ("*", "claude-opus-4.6"):            "xhigh",
    ("*", "claude-opus-4-6"):            "xhigh",
    ("*", "claude-opus-4.5"):            "xhigh",
    ("*", "gpt-5.3-codex"):              "xhigh",
    ("*", "gpt-5.2-codex"):              "xhigh",
    ("*", "gpt-5.1-codex-max"):          "xhigh",
    # Anthropic OAuth account has VERY LIMITED credits — always run sonnet at
    # max reasoning/thinking so the few calls we do make are high-quality.
    # opus-4-6 is gated out of auto-routing via cost=11 (see catalog below).
    ("anthropic", "claude-sonnet-4-6"):  "max",   # sonnet thinking + max reasoning
    ("anthropic", "claude-sonnet-4.6"):  "max",
}

_EFFORT_ORDER = ("low", "medium", "high", "xhigh", "max")


def _effort_max(a: str, b: str) -> str:
    try:
        return a if _EFFORT_ORDER.index(a) >= _EFFORT_ORDER.index(b) else b
    except ValueError:
        return a or b or "medium"


# ---------- model catalog ----------

# Each entry: {tier, quality (0-10), cost (0-10, lower = cheaper)}.
# Data sources:
#   - audit-map/18-snapshots/accounts/*/models-*.txt  (auth-verified catalogs)
#   - codex --help (native-codex)
#   - user intent (2026-04-22)
# Do NOT add a model here unless it's been verified as callable on the
# provider's auth — unreachable entries silently degrade routing.
MODEL_CATALOG: dict[str, dict[str, dict[str, int | str]]] = {
    "github-copilot": {
        # 2026-04-22 ROUND-6 catalog rebuild:
        # - claude-opus-4.7/4.6 removed: live API rejects model_not_supported
        #   on copilot-03 + copilot-accneww432 (only raed2180416 has them
        #   enabled; that slot is usage-window-exhausted until 2026-05-01).
        # - gpt-5.4 DEMOTED from top → fast (qty 6) for same reason:
        #   verified live rejection on copilot-03 + copilot-accneww432 at
        #   2026-04-22T05:08:58Z with body
        #   `{"code":"model_not_supported","param":"model"}`.
        # - gpt-5.3-codex / gpt-5.2-codex / gpt-5.1-codex-max also pulled
        #   back to code-only tiers (same cache-vs-live mismatch risk).
        # - gemini-3.1-pro-preview PROMOTED to top: it matches every
        #   copilot slot's `preferred_model` (execution_model column in
        #   slot-map.tsv), is callable on all 3 accounts, and is what
        #   the arctic plugin will route to by default.
        # - claude-sonnet-4.6 / 4.5 kept as strong backup; they route
        #   through Anthropic BYOK on copilot which is the one subset
        #   enabled on copilot-03 per GitHub settings.
        # To re-enable gpt-5.4/opus: toggle each in every copilot
        # account's GitHub settings and restore tier=top.
        "gemini-3.1-pro-preview":   {"tier": "top",       "quality": 9,  "cost": 4},
        "gemini-3-pro-preview":     {"tier": "strong",    "quality": 7,  "cost": 4},
        "claude-sonnet-4.6":        {"tier": "strong",    "quality": 8,  "cost": 5},
        "claude-sonnet-4.5":        {"tier": "strong",    "quality": 7,  "cost": 4},
        "gpt-5.3-codex":            {"tier": "code-top",  "quality": 9,  "cost": 6},
        "gpt-5.2-codex":            {"tier": "code",      "quality": 8,  "cost": 5},
        "gpt-5.1-codex-max":        {"tier": "code",      "quality": 8,  "cost": 5},
        "gpt-5.1-codex":            {"tier": "code",      "quality": 7,  "cost": 4},
        "gpt-5.4":                  {"tier": "fast",      "quality": 6,  "cost": 6},
        "gpt-5.4-mini":             {"tier": "fast",      "quality": 6,  "cost": 2},
        "claude-haiku-4.5":         {"tier": "fast",      "quality": 6,  "cost": 2},
        "gemini-3-flash-preview":   {"tier": "fast",      "quality": 5,  "cost": 1},
        "grok-code-fast-1":         {"tier": "fast",      "quality": 6,  "cost": 2},
        "gpt-5-mini":               {"tier": "fast",      "quality": 5,  "cost": 1},
    },
    "native-codex": {
        "gpt-5.4":                  {"tier": "strong",    "quality": 9,  "cost": 6},
        "gpt-5.4-mini":             {"tier": "fast",      "quality": 6,  "cost": 2},
        "gpt-5.3-codex":            {"tier": "code-top",  "quality": 9,  "cost": 6},
        "gpt-5.3-codex-mini":       {"tier": "fast",      "quality": 6,  "cost": 2},
        "gpt-5.2":                  {"tier": "strong",    "quality": 8,  "cost": 5},
    },
    "codex": {
        "gpt-5.4":                  {"tier": "strong",    "quality": 9,  "cost": 6},
        "gpt-5.3-codex":            {"tier": "code-top",  "quality": 9,  "cost": 6},
        "gpt-5.2-codex":            {"tier": "code",      "quality": 8,  "cost": 5},
        "gpt-5.2":                  {"tier": "strong",    "quality": 8,  "cost": 5},
        "gpt-5.1-codex-max":        {"tier": "code",      "quality": 8,  "cost": 5},
        "gpt-5.1-codex":            {"tier": "code",      "quality": 7,  "cost": 4},
        "gpt-5.1-codex-mini":       {"tier": "fast",      "quality": 6,  "cost": 2},
    },
    "anthropic": {
        # opus-4-6 is REACHABLE via explicit `requested_model` pin but EXCLUDED
        # from auto-routing (cost=11 > all class max_cost) because the
        # Anthropic OAuth account has very limited remaining credits.
        # For high-stakes work the router falls to sonnet-4-6 with max
        # reasoning (EFFORT_FLOOR above forces "max" for any anthropic
        # sonnet route).
        "claude-opus-4-6":          {"tier": "top",       "quality": 9,  "cost": 11},
        "claude-sonnet-4-6":        {"tier": "strong",    "quality": 8,  "cost": 5},
        "claude-haiku-4-5":         {"tier": "fast",      "quality": 6,  "cost": 2},
    },
    "antigravity": {
        "claude-opus-4.6":          {"tier": "top",       "quality": 9,  "cost": 9},
        "gemini-3.1-pro-preview":   {"tier": "strong",    "quality": 8,  "cost": 4},
        "gemini-3-flash":           {"tier": "fast",      "quality": 5,  "cost": 1},
    },
    "google": {
        "gemini-3.1-pro-preview":   {"tier": "strong",    "quality": 8,  "cost": 4},
        "gemini-3-pro-preview":     {"tier": "strong",    "quality": 7,  "cost": 4},
        "gemini-2.5-pro":           {"tier": "strong",    "quality": 7,  "cost": 4},
        "gemini-3-flash-preview":   {"tier": "fast",      "quality": 5,  "cost": 1},
        "gemini-2.5-flash":         {"tier": "fast",      "quality": 5,  "cost": 1},
        "gemini-2.5-flash-lite":    {"tier": "fast",      "quality": 4,  "cost": 0},
    },
    "windsurf": {
        "claude-opus-4.7":          {"tier": "top",       "quality": 10, "cost": 0},  # manual-only
    },
    "opencode": {
        # OpenRouter FREE tier — every entry is :free (no credits drawn).
        # ALL entries are demoted to tier="fast" with reduced quality on
        # purpose. Rationale (user intent 2026-04-22): "i don't trust these
        # openrouter free models, they aren't very good for coding". By
        # keeping them in tier="fast" only, structured/high-stakes prefer-
        # lists ("code-top"/"strong"/"top") never reach them — so coding
        # tasks always stay on the arctic fleet (copilot gpt-5.3-codex,
        # antigravity opus-4.6, codex, etc.). These remain eligible for
        # bookkeeping/recovery/orchestration (fast-tier classes), and for
        # explicit pins via `require_provider=opencode` / `requested_model`.
        "openrouter/qwen/qwen3-coder:free":                   {"tier": "fast", "quality": 7, "cost": 0},
        "openrouter/deepseek/deepseek-r1:free":               {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/z-ai/glm-4.5-air:free":                   {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/openai/gpt-oss-120b:free":                {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/nvidia/nemotron-3-super-120b-a12b:free":  {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/meta-llama/llama-3.3-70b-instruct:free":  {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/qwen/qwen3-next-80b-a3b-instruct:free":   {"tier": "fast", "quality": 6, "cost": 0},
        "openrouter/openai/gpt-oss-20b:free":                 {"tier": "fast", "quality": 5, "cost": 0},
        "openrouter/google/gemma-4-31b-it:free":              {"tier": "fast", "quality": 5, "cost": 0},
    },
    "oss-local": {
        "llama-3.1-70b-instruct":   {"tier": "strong",    "quality": 7,  "cost": 0},
        "qwen2.5-coder-32b":        {"tier": "code",      "quality": 7,  "cost": 0},
        "deepseek-coder-v2":        {"tier": "code",      "quality": 7,  "cost": 0},
    },
    "local-dry": {
        "dry":                      {"tier": "fast",      "quality": 1,  "cost": 0},
    },
}

# Preferred tiers per task class (ordered: first match wins when multiple
# candidates clear the min_quality / max_cost guard). "max_cost" is a token
# discipline: bookkeeping NEVER escalates to opus-tier even if available.
CLASS_TIERS: dict[str, dict] = {
    "bookkeeping":    {"prefer": ("fast",),                         "max_cost": 3,  "min_quality": 5},
    "structured":     {"prefer": ("code-top", "strong", "code"),    "max_cost": 7,  "min_quality": 7},
    "high-stakes":    {"prefer": ("top", "code-top", "strong"),     "max_cost": 10, "min_quality": 8},
    "orchestration":  {"prefer": ("strong", "fast"),                "max_cost": 6,  "min_quality": 6},
    "recovery":       {"prefer": ("fast",),                         "max_cost": 3,  "min_quality": 5},
}


# Legacy compatibility: some tests still import PROVIDER_MODELS. Derive it
# from the catalog so there is a single source of truth.
PROVIDER_MODELS: dict[str, set[str]] = {
    prov: set(models.keys()) for prov, models in MODEL_CATALOG.items()
}


@dataclass
class Route:
    slot: str
    provider: str
    account: str
    model: str
    reasoning_effort: str
    reason: str
    account_key: str | None = None    # arctic auth_source_key (e.g. codex:steamraed)


def pick_model(provider: str, task_class: str,
               requested_model: str | None = None) -> str:
    """Deterministically pick the best model for (provider, task_class).

    Algorithm — ORDERED TIER SEARCH (preserves user intent):
      1. Honor `requested_model` iff the provider exposes it.
      2. Walk `CLASS_TIERS[class].prefer` in order. For the first tier with
         at least one model that passes (min_quality, max_cost), return the
         winner of that tier.
      3. Within a tier, rank by (quality desc, cost asc, name asc). Name is
         a deterministic tiebreaker — no hidden RNG.
      4. Fallback chain when no preferred tier matches:
           (a) any tier whose best model meets min_quality
           (b) the highest-quality model in the catalog (ignores max_cost)
         This keeps the router from returning "auto" on a populated catalog.

    Same (provider, class, requested) triple → same model name, always.
    """
    catalog = MODEL_CATALOG.get(provider, {})
    if not catalog:
        return requested_model or "auto"
    if requested_model and requested_model in catalog:
        return requested_model
    spec = CLASS_TIERS.get(task_class, CLASS_TIERS["structured"])
    min_q = int(spec["min_quality"])
    max_c = int(spec["max_cost"])
    # Sort key: ascending (-quality, cost, name). First element wins.
    #   -quality asc  = quality desc  (best model first)
    #   cost asc      = cheapest ties first   (token-efficient tiebreak)
    #   name asc      = alphabetical tiebreak (deterministic for tests)
    def _key(pair: tuple[str, dict]) -> tuple[int, int, str]:
        m, meta = pair
        return (-int(meta["quality"]), int(meta["cost"]), m)

    # Pass 1: ordered tier walk. First tier with any in-budget candidate wins.
    for tier in spec["prefer"]:
        candidates = [
            (m, meta) for m, meta in catalog.items()
            if meta["tier"] == tier
            and int(meta["quality"]) >= min_q
            and int(meta["cost"]) <= max_c
        ]
        if candidates:
            candidates.sort(key=_key)
            return candidates[0][0]
    # Pass 2: any tier, quality >= min_q (relax max_cost).
    relaxed = [
        (m, meta) for m, meta in catalog.items()
        if int(meta["quality"]) >= min_q
    ]
    if relaxed:
        relaxed.sort(key=_key)
        return relaxed[0][0]
    # Pass 3: absolute best-in-catalog (ignores min_q too).
    everything = list(catalog.items())
    if everything:
        everything.sort(key=_key)
        return everything[0][0]
    return "auto"


def pick_effort(task_class: str, provider: str, model: str,
                override: str | None = None) -> str:
    """Resolve reasoning effort for the chosen route.

    Override > EFFORT_FLOOR > EFFORT_BY_CLASS.
    Floor rules fire for any (provider, model) match (including '*' wildcard).
    """
    base = EFFORT_BY_CLASS.get(task_class, "medium")
    floor = EFFORT_FLOOR.get((provider, model)) or EFFORT_FLOOR.get(("*", model))
    picked = _effort_max(base, floor) if floor else base
    if override:
        picked = _effort_max(picked, override)
    return picked


# Legacy shim — some call sites still use the old name.
def _model_for(task_row, slot_row_provider: str) -> str:
    requested = task_row["requested_model"] if task_row and task_row["requested_model"] else None
    task_class = task_row["task_class"] if task_row else "structured"
    return pick_model(slot_row_provider, task_class, requested)


def choose_route(
    task_row,
    *,
    exclude_slots: Iterable[str] = (),
    exclude_account_keys: Iterable[str] = (),
    refresh: bool = True,
) -> Route | None:
    """Select a Route for the task. Pure read unless refresh=True.

    The scheduler loop calls with refresh=True once per poll; inner retries
    within a single task should pass refresh=False to avoid slot-state churn
    and to keep tests deterministic.

    `exclude_account_keys`: arctic `auth_source_key`s currently held by other
    running tasks. Skipping these prevents two concurrent tasks from hitting
    the same account's quota simultaneously.
    """
    if refresh:
        slot_ledger.refresh_from_disk()
    require_provider = None
    require_account_key = None
    if task_row:
        require_provider = task_row["require_provider"] if task_row["require_provider"] else None
        try:
            require_account_key = task_row["require_account_key"]
        except (IndexError, KeyError):
            require_account_key = None
    pick = slot_ledger.pick_best_slot(
        task_row,
        exclude_slots=exclude_slots,
        exclude_account_keys=exclude_account_keys,
        require_provider=require_provider,
        require_account_key=require_account_key,
    )
    if pick is None:
        return None
    task_class = task_row["task_class"] if task_row else "structured"
    effort_override = task_row["reasoning_effort"] if task_row and task_row["reasoning_effort"] else None
    requested = task_row["requested_model"] if task_row and task_row["requested_model"] else None
    model = pick_model(pick.provider, task_class, requested)
    effort = pick_effort(task_class, pick.provider, model, effort_override)
    return Route(
        slot=pick.slot,
        provider=pick.provider,
        account=pick.account,
        account_key=getattr(pick, "account_key", None),
        model=model,
        reasoning_effort=effort,
        reason=f"{pick.reason}; class={task_class}",
    )


def wait_for_any_slot(
    task_row,
    *,
    exclude_slots: Iterable[str] = (),
    max_wait_seconds: int = 6 * 3600,
    poll_seconds: int = 30,
) -> Route | None:
    """Block until a slot is ready or budget exhausted.

    Emits `waiting_slot` events so the TUI shows live ETA.
    """
    deadline = time.time() + max_wait_seconds
    while True:
        route = choose_route(task_row, exclude_slots=exclude_slots, refresh=True)
        if route is not None:
            return route
        pick, eta = slot_ledger.soonest_available(task_row)
        payload = {
            "status": "waiting",
            "earliest_slot": pick.slot if pick else None,
            "earliest_provider": pick.provider if pick else None,
            "eta_seconds": eta,
        }
        if task_row:
            db.log_event(task_row["id"], "waiting_slot", payload)
        if time.time() >= deadline:
            return None
        time.sleep(max(5, min(poll_seconds, eta or poll_seconds)))
