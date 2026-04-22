"""Slot ledger: single source of truth for account/model availability.

Reads from two upstream sources and merges:
 - audit-map/25-accounts-routing/slot-map.tsv           (slot identity)
 - audit-map/29-status/arctic-slot-<slot>.status        (live state)
 - audit-map/29-status/route-health-<provider>.status   (native-codex)

Writes into `slots` table. Also adds:
 - windsurf-trial, copilot-cli, claude-code, ccs, oss-local

Key API:
 - `refresh_from_disk()` — pull fresh state
 - `pick_best_slot(task_row) -> Row|None` — choose best currently-ready slot
 - `soonest_available_slot(task_row) -> (slot, eta_seconds)` — for wait-cycler
 - `mark_used(slot, task_id)` — record usage
 - `mark_cooldown(slot, until_iso, reason)` — force cooldown observation
"""
from __future__ import annotations

import datetime as dt
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from . import db

REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIT_MAP = REPO_ROOT / "audit-map"
SLOT_MAP_TSV = AUDIT_MAP / "25-accounts-routing" / "slot-map.tsv"
STATUS_ROOT = AUDIT_MAP / "29-status"

# Provider priority (higher = prefer). The router starts with this and then
# refines by (task_class, model quality, live usage %, cooldown). Copilot is
# top-tier because it exposes the richest model catalog (including opus-4.7)
# and has three accounts for rotation.
PROVIDER_PRIORITY = {
    # Revised 2026-04-22: codex now dispatched via native `codex exec` CLI
    # (executor.py + native_runner + per-slot CODEX_HOME) — gpt-5.4 xhigh
    # accepted directly; arctic envelope bypassed → AIRMENTOR_PASS_RESULT
    # marker emits cleanly without the arctic JSON wrapper stripping it.
    # 6 ChatGPT Team seats (codex-01..06) rotate via LRU, each with
    # independent per-seat quota.
    "codex":          11,   # native CLI, gpt-5.4 xhigh, 6 rotating seats
    "github-copilot": 10,   # richest catalog incl. opus-4.7, gpt-5.3-codex
    "native-codex":    9,   # direct OpenAI, lowest latency
    "anthropic":       7,   # claude CLI direct — sonnet-4.6 thinking
    "antigravity":     6,   # gemini-3.1-pro or claude-opus-4.6 (9 accounts!)
    "google":          5,   # gemini-3.1-pro-preview direct
    "opencode":        4,   # openrouter fallback (kimi, glm, gpt-oss-*)
    "windsurf":        1,   # MANUAL-ONLY — router never auto-picks (see below)
    "oss-local":       1,
    "local-dry":       0,
}

# Slots that NEVER get picked automatically. Only reachable via
# require_slot=<name> or require_provider=<provider> on the task row. This is
# how windsurf/opus-4.7 stays reachable as a manual escape hatch without
# stalling the pipeline waiting for a human to click in the IDE.
MANUAL_ONLY_SLOTS = frozenset({
    "windsurf-cascade",
    # copilot-cli virtual slot requires `gh extension install github/gh-copilot`
    # + a non-standard CLI contract that we do not wire. Keep reachable via
    # explicit require_slot pin only so it never auto-starves a task.
    "copilot-cli",
    # native-codex-session assumes `codex exec -m <model>` for MODEL_CATALOG
    # entries. Local codex CLI (0.122.0) does not accept `gpt-5.3-codex`
    # directly and exits silently (0 bytes, exit=0) — manual-only until
    # model-name mapping is verified for the installed CLI build.
    "native-codex-session",
})

# Extra virtual slots injected (not in slot-map.tsv). Each row:
#   (slot, provider, preferred_model, rank_override, manual_only)
# manual_only=True → only picked when task has require_provider/require_slot.
VIRTUAL_SLOTS = [
    # slot                       provider          preferred_model            rank  manual
    ("native-codex-session",    "native-codex",   "gpt-5.4",                   95,  False),
    ("claude-code",             "anthropic",      "claude-sonnet-4-6",         85,  False),
    ("copilot-cli",             "github-copilot", "claude-opus-4.7",           90,  False),
    # Windsurf = Electron IDE, no headless CLI. We expose the slot so the
    # operator can explicitly pin a task to it, but we never pick it
    # automatically — that would hang the pipeline waiting for an IDE click.
    ("windsurf-cascade",        "windsurf",       "claude-opus-4.7",           50,  True),
    ("oss-local-llama",         "oss-local",      "llama-3.1-70b-instruct",    20,  False),
    ("local-dry-run",           "local-dry",      "dry",                        0,  False),
    # OpenRouter FREE tier via opencode. Gated by OPENROUTER_API_KEY env.
    # Every model here is :free — kimi-k2 and glm-4.6 (paid) are removed on
    # purpose so no credits are ever drawn from the OpenRouter account.
    ("openrouter-qwen3-coder",  "opencode",       "openrouter/qwen/qwen3-coder:free",                  42, False),
    ("openrouter-deepseek-r1",  "opencode",       "openrouter/deepseek/deepseek-r1:free",              40, False),
    ("openrouter-glm-4.5-air",  "opencode",       "openrouter/z-ai/glm-4.5-air:free",                  36, False),
    ("openrouter-gpt-oss-120b", "opencode",       "openrouter/openai/gpt-oss-120b:free",               34, False),
    ("openrouter-nemotron-3",   "opencode",       "openrouter/nvidia/nemotron-3-super-120b-a12b:free", 32, False),
    ("openrouter-llama-3.3",    "opencode",       "openrouter/meta-llama/llama-3.3-70b-instruct:free", 30, False),
    ("openrouter-qwen3-next",   "opencode",       "openrouter/qwen/qwen3-next-80b-a3b-instruct:free",  28, False),
    ("openrouter-gpt-oss-20b",  "opencode",       "openrouter/openai/gpt-oss-20b:free",                26, False),
]


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        k, v = raw.split("=", 1)
        # bash-quoted values: strip surrounding quotes if simple
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
            v = v[1:-1]
        out[k.strip()] = v
    return out


def _read_slot_map() -> list[dict[str, str]]:
    if not SLOT_MAP_TSV.exists():
        return []
    rows: list[dict[str, str]] = []
    lines = SLOT_MAP_TSV.read_text(encoding="utf-8", errors="replace").splitlines()
    if not lines:
        return rows
    header = lines[0].split("\t")
    for line in lines[1:]:
        if not line.strip() or line.startswith("#"):
            continue
        cols = line.split("\t")
        cols += [""] * (len(header) - len(cols))
        rows.append(dict(zip(header, cols)))
    return rows


def refresh_from_disk() -> None:
    """Sync slot table from slot-map.tsv + live status files + virtual slots."""
    # 1. virtual slots (injected baseline)
    for slot, provider, model, rank, manual_only in VIRTUAL_SLOTS:
        db.upsert_slot(
            slot,
            provider=provider,
            preferred_model=model,
            rank_override=rank,
            ready=_probe_virtual_slot_ready(slot, provider),
        )

    # 2. slot-map rows
    for row in _read_slot_map():
        slot = (row.get("slot") or row.get("slot_id") or "").strip()
        if not slot:
            continue
        provider = (row.get("provider") or "").strip() or "unknown"
        account_label = (row.get("account_label") or row.get("account") or "").strip()
        identity_hint = (row.get("identity_hint") or "").strip()
        db.upsert_slot(
            slot,
            provider=provider,
            account_label=account_label,
            identity_hint=identity_hint,
        )

    # 3. live status files
    for status_file in STATUS_ROOT.glob("arctic-slot-*.status"):
        slot = status_file.stem.replace("arctic-slot-", "")
        data = _parse_env_file(status_file)
        provider = data.get("provider", "unknown")
        cooldown_until = data.get("cooldown_next_eligible_at") or None
        cooldown_reason = data.get("cooldown_reason") or None
        usage_p = _maybe_float(data.get("usage_limit_primary_percent"))
        usage_s = _maybe_float(data.get("usage_limit_secondary_percent"))
        primary_reset = data.get("usage_limit_primary_reset_at") or None
        secondary_reset = data.get("usage_limit_secondary_reset_at") or None
        exec_state = data.get("execution_route_state") or ""
        exec_verify = data.get("execution_verification_state") or ""
        last_probe = data.get("execution_last_probe_failure_class") or None
        preferred_model = data.get("execution_model") or None
        # Quota guard: usage_limit_*_percent is % REMAINING (matches arctic
        # probe: 100 = fresh, 0 = exhausted). A slot at ≤5% remaining is
        # effectively maxed — don't route to avoid guaranteed 429s.
        # Threshold mirrors arctic-slot-usage.sh line 165 (≤5.0 triggers
        # cooling-down in the status file). Previous logic had this inverted
        # (≥100 → blocked), which flagged every fresh slot as unavailable.
        QUOTA_EXHAUSTED_FLOOR = 5.0
        quota_blocked = False
        if usage_p is not None and usage_p <= QUOTA_EXHAUSTED_FLOOR:
            quota_blocked = True
        if usage_s is not None and usage_s <= QUOTA_EXHAUSTED_FLOOR:
            quota_blocked = True
        ready = int(
            not quota_blocked
            and exec_verify == "verified"
            and exec_state not in {"quota-blocked", "cooling-down", "provider-rejected",
                                   "auth-or-entitlement", "silent-provider-failure",
                                   "below-model-floor", "failed", "unexpected-output"}
        )
        if quota_blocked and not cooldown_until:
            # Synthesize a cooldown anchored at the known reset timestamp if
            # present; else the next billing hour. This lets `soonest_available`
            # report a real ETA instead of silently stalling.
            reset_at = primary_reset or secondary_reset
            if reset_at:
                cooldown_until = reset_at
                cooldown_reason = cooldown_reason or "usage-cap-reached"
        # Round-6 fix (2026-04-22): do NOT overwrite an existing DB cooldown
        # with None. Operators and `mark_cooldown()` write longer-horizon
        # cooldowns (e.g. 48h anthropic OAuth credit lockout) that the arctic
        # status file on disk doesn't know about. Previously this loop
        # clobbered those writes on every `refresh_from_disk()` call, which
        # silently re-enabled broken slots. Now: only pass cooldown_until
        # when we have a real value; preserve DB state otherwise.
        #
        # Round-7 fix (2026-04-22): the Round-6 guard also trapped SYNTHESIZED
        # cooldowns that originated from this loop (reason='usage-cap-reached')
        # when the underlying quota later recovered. All 6 codex slots got
        # stuck in an 84-min phantom cooldown after a transient quota dip
        # because the later sync saw `quota_blocked=False, cooldown_until=None`
        # on disk, fell into the "preserve DB state" branch, and never cleared
        # the stale DB cooldown. Tell synthesized from operator cooldowns by
        # reason: if existing DB cooldown's reason is 'usage-cap-reached' and
        # quota now unblocked, actively clear it.
        fields = dict(
            provider=provider,
            preferred_model=preferred_model,
            ready=ready,
            usage_primary_pct=usage_p,
            usage_secondary_pct=usage_s,
            primary_reset_at=primary_reset,
            secondary_reset_at=secondary_reset,
            last_probe_class=last_probe,
        )
        if cooldown_until:
            fields["cooldown_until"] = cooldown_until
            fields["cooldown_reason"] = cooldown_reason
        elif not quota_blocked:
            # Quota has recovered. Clear any synthesized quota-cap cooldown
            # we previously wrote; leave non-quota cooldowns (e.g. 48h
            # anthropic OAuth credit lockout with reason='credit-lockout')
            # intact because those originate from mark_cooldown(), not from
            # this sync loop. sqlite3.Row uses keyed indexing (no .get()).
            existing = db.get_slot(slot)
            if existing is not None:
                try:
                    prior_reason = existing["cooldown_reason"]
                except (IndexError, KeyError):
                    prior_reason = None
                if prior_reason == "usage-cap-reached":
                    fields["cooldown_until"] = None
                    fields["cooldown_reason"] = None
        db.upsert_slot(slot, **fields)

    # 4. native-codex health
    native_health = STATUS_ROOT / "route-health-native-codex.status"
    if native_health.exists():
        data = _parse_env_file(native_health)
        cooldown_until = data.get("cooldown_next_eligible_at") or None
        ready = int(data.get("cooldown_state", "clear") == "clear")
        fields = dict(
            provider="native-codex",
            preferred_model=data.get("preferred_model") or "gpt-5.4",
            ready=ready,
        )
        if cooldown_until:
            fields["cooldown_until"] = cooldown_until
            fields["cooldown_reason"] = data.get("cooldown_reason") or None
        db.upsert_slot("native-codex-session", **fields)


def _probe_virtual_slot_ready(slot: str, provider: str) -> int:
    """Cheap readiness probe for virtual slots.

    Strategy: check that the expected CLI binary is on PATH. Full auth check is
    deferred to first use; this prevents false "ready" that never works.
    """
    import os
    bin_map = {
        "windsurf":       ["windsurf", "cascade"],
        "github-copilot": ["gh", "copilot"],
        "anthropic":      ["claude"],
        "native-codex":   ["codex"],
        "ccs":            ["ccs"],
        "oss-local":      ["ollama"],
        "opencode":       ["opencode"],
        "local-dry":      [],  # always ready; runs a local bash stub
    }
    bins = bin_map.get(provider)
    if bins is None:
        return 0
    if bins == []:
        return 1  # no binary required
    # OpenRouter-backed slots need an API key set in env
    if slot.startswith("openrouter-") and not os.environ.get("OPENROUTER_API_KEY"):
        return 0
    for b in bins:
        if _which(b):
            return 1
    return 0


def _which(name: str) -> bool:
    try:
        subprocess.check_output(["which", name], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def _maybe_float(v: str | None) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


# ---------- selection ----------

@dataclass
class SlotPick:
    slot: str
    provider: str
    account: str
    model: str
    reason: str
    account_key: str | None = None


def _effective_rank(slot_row) -> int:
    """Composite rank: provider priority (dominant) + operator override -
    live usage % penalty - LRU decay.

    LRU decay (pick_count * 25) is chosen so 4 picks on a slot drop it one
    full provider tier (100 rank units). This guarantees fleet-wide
    rotation even when several high-priority slots are available: after
    each tier is used ~4x, the next-tier slots become competitive.
    Without this, low-priority accounts like google (rank 500) would
    starve behind copilot (1000) forever.
    """
    base = PROVIDER_PRIORITY.get(slot_row["provider"], 0) * 100
    override = 0
    try:
        override = slot_row["rank_override"] or 0
    except (IndexError, KeyError):
        override = 0
    usage_p = slot_row["usage_primary_pct"] or 0.0
    usage_penalty = int(usage_p)
    pick_count = 0
    try:
        pick_count = int(slot_row["pick_count"] or 0)
    except (IndexError, KeyError, TypeError):
        pick_count = 0
    return base + int(override) - usage_penalty - pick_count * 25


def _row_field(row, name: str, default=None):
    try:
        return row[name]
    except (IndexError, KeyError):
        return default


def pick_best_slot(
    task_row,
    *,
    exclude_slots: Iterable[str] = (),
    exclude_account_keys: Iterable[str] = (),
    require_provider: str | None = None,
    require_account_key: str | None = None,
) -> SlotPick | None:
    exclude = set(exclude_slots)
    exclude_keys = set(k for k in exclude_account_keys if k)
    require_prov = require_provider or (task_row["require_provider"] if task_row else None)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    best: SlotPick | None = None
    best_rank = -10**9
    for row in db.list_slots():
        if row["slot"] in exclude:
            continue
        if not row["ready"]:
            continue
        # Skip manual-only slots (e.g. windsurf) unless the task explicitly
        # targets them by provider or slot. This keeps opus-4.7 reachable
        # for a pinned task without ever stalling the autopilot on an IDE.
        if row["slot"] in MANUAL_ONLY_SLOTS:
            if not (require_prov and row["provider"] == require_prov):
                continue
        if require_prov and row["provider"] != require_prov:
            continue
        # account-level guards (schema may predate account_key column)
        row_ak = _row_field(row, "account_key")
        if require_account_key and row_ak != require_account_key:
            continue
        if row_ak and row_ak in exclude_keys:
            continue
        cooldown = row["cooldown_until"]
        if cooldown and cooldown > now:
            continue
        rank = _effective_rank(row)
        if rank > best_rank:
            best_rank = rank
            model = task_row["requested_model"] if task_row and task_row["requested_model"] else None
            preferred = _row_field(row, "preferred_model") or _row_field(row, "execution_model")
            model = model or preferred or "auto"
            account = _row_field(row, "account") or _row_field(row, "account_label") or row["slot"]
            best = SlotPick(
                slot=row["slot"],
                provider=row["provider"],
                account=account,
                model=model,
                reason=f"rank={rank}",
                account_key=row_ak,
            )
    # LRU bookkeeping: increment the pick counter so the next caller sees
    # this slot at a lower rank, spreading load across the fleet.
    if best is not None:
        try:
            db.increment_slot_pick(best.slot)
        except Exception:
            pass   # never block routing on a bookkeeping failure
    return best


def soonest_available(task_row) -> tuple[SlotPick | None, int | None]:
    """If no slot ready now, return earliest cooldown expiry + that slot."""
    now = dt.datetime.now(dt.timezone.utc)
    best_eta = None
    best_pick: SlotPick | None = None
    require = task_row["require_provider"] if task_row else None
    for row in db.list_slots():
        if require and row["provider"] != require:
            continue
        cooldown = _row_field(row, "cooldown_until")
        if not cooldown:
            continue
        try:
            until = dt.datetime.fromisoformat(cooldown.replace("Z", "+00:00"))
        except Exception:
            continue
        eta = int((until - now).total_seconds())
        if eta < 0:
            continue
        if best_eta is None or eta < best_eta:
            best_eta = eta
            model = task_row["requested_model"] if task_row and task_row["requested_model"] else None
            preferred = _row_field(row, "preferred_model") or _row_field(row, "execution_model")
            model = model or preferred or "auto"
            account = _row_field(row, "account") or _row_field(row, "account_label") or row["slot"]
            best_pick = SlotPick(
                slot=row["slot"],
                provider=row["provider"],
                account=account,
                model=model,
                reason=f"eta={eta}s",
                account_key=_row_field(row, "account_key"),
            )
    return best_pick, best_eta


def mark_used(slot: str, task_id: int) -> None:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    db.upsert_slot(slot, last_used_at=now)
    db.record_slot_event(slot, "picked", {"at": now}, task_id=task_id)


def mark_cooldown(slot: str, until_iso: str, reason: str) -> None:
    db.upsert_slot(slot, cooldown_until=until_iso, cooldown_reason=reason)
    db.record_slot_event(slot, "cooldown_hit", {"until": until_iso, "reason": reason})


def clear_cooldown(slot: str) -> None:
    db.upsert_slot(slot, cooldown_until=None, cooldown_reason=None)
    db.record_slot_event(slot, "cooldown_clear", {})
