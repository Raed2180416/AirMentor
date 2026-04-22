"""Rotation / fleet-usage determinism tests.

These exercise the scheduler loop against an in-memory DB seeded with every
account from `audit-map/25-accounts-routing/slot-map.tsv` (plus the
virtual slots). Every assertion is pure Python — zero live CLI calls,
zero tokens burned.

What we verify:
  1. Every ready account sees usage over N rotations (no starvation).
  2. `busy_account_keys` guard never lets two concurrent tasks hit the
     same `auth_source_key`.
  3. Quota-capped slots (usage >= 100%) are skipped.
  4. Cooldown-bound slots are skipped until the cooldown passes.
  5. Manual-only slots (windsurf) are NEVER picked in autopilot.
  6. Pinning `require_provider=windsurf` DOES reach the manual slot.
  7. When all slots are blocked, router returns None deterministically.
"""
from __future__ import annotations

import datetime as dt
from collections import Counter

import pytest

from pipeline.orchestrator import db, router, slot_ledger
from pipeline.orchestrator.slot_ledger import MANUAL_ONLY_SLOTS


# ---------------------------------------------------------------------------
# fleet fixture (mirrors slot-map.tsv + verified virtual slots)
# ---------------------------------------------------------------------------

REAL_FLEET = [
    # (slot,                  provider,          account_key)
    ("anthropic-main",        "anthropic",       "anthropic"),
    ("antigravity-main",      "antigravity",     "antigravity"),
    ("antigravity-02",        "antigravity",     "antigravity:unknownme"),
    ("antigravity-03",        "antigravity",     "antigravity:juniorretard"),
    ("antigravity-04",        "antigravity",     "antigravity:accneww"),
    ("codex-01",              "codex",           "codex:pleasedontmail"),
    ("codex-02",              "codex",           "codex:geowake"),
    ("codex-03",              "codex",           "codex"),
    ("codex-04",              "codex",           "codex:steamraed"),
    ("codex-05",              "codex",           "codex:juniorretard"),
    ("codex-06",              "codex",           "codex:randstuff"),
    ("copilot-raed2180416",   "github-copilot",  "github-copilot"),
    ("copilot-accneww432",    "github-copilot",  "github-copilot:accneww-copilot"),
    ("copilot-03",            "github-copilot",  "github-copilot:boom"),
    ("google-main",           "google",          "google"),
    ("native-codex-session",  "native-codex",    "openai-api"),
    ("claude-code",           "anthropic",       "anthropic-cli"),
    ("copilot-cli",           "github-copilot",  "github-copilot-cli"),
    ("windsurf-cascade",      "windsurf",        "windsurf"),  # manual-only
    ("local-dry-run",         "local-dry",       "dry"),
]


def _seed_fleet(all_ready: bool = True):
    for slot, provider, ak in REAL_FLEET:
        db.upsert_slot(
            slot,
            provider=provider,
            account_key=ak,
            ready=1 if all_ready else 0,
            preferred_model=None,
        )


_TASK_COUNTER = [0]


def _seed_task(task_class: str = "structured", require_provider: str | None = None):
    _TASK_COUNTER[0] += 1
    tid = db.insert_task(
        dag_run_id="rot",
        node_id=f"t-{task_class}-{_TASK_COUNTER[0]}",
        pass_name="p",
        prompt_file="x.md",
        require_provider=require_provider,
        task_class=task_class,
    )
    return db.get_task(tid)


# ---------------------------------------------------------------------------
# 1. Every ready account sees usage (no starvation)
# ---------------------------------------------------------------------------

def test_rotation_covers_every_ready_account():
    """200 structured tasks against a full fleet under realistic
    concurrency: each task holds its account busy for ~15 ticks (simulating
    a ~15s CLI run). With the LRU decay in `_effective_rank`, every ready
    account must appear at least once in the pick stream."""
    _seed_fleet(all_ready=True)
    picks: list[str] = []
    # 15-tick busy window = realistic task duration; forces exploration of
    # the fleet when the top-priority keys are in-flight.
    busy_window = 15
    release_queue: list[tuple[int, str]] = []
    for tick in range(200):
        release_queue = [(t, k) for (t, k) in release_queue if t > tick]
        current = {k for (_t, k) in release_queue}
        task = _seed_task("structured")
        route = router.choose_route(task, exclude_account_keys=current, refresh=False)
        if route is None:
            continue
        assert route.account_key not in current, (
            f"busy-key collision at tick {tick}: {route.account_key}"
        )
        picks.append(route.account_key or route.slot)
        release_queue.append((tick + busy_window, route.account_key or route.slot))
    counter = Counter(picks)
    # Auto-eligible = ready + not manual_only. Exclude windsurf + dry-run,
    # plus any slot the router treats as manual-only (look up account_key
    # by slot from REAL_FLEET).
    manual_slots = set(MANUAL_ONLY_SLOTS)
    manual_account_keys = {
        ak for (slot, _p, ak) in REAL_FLEET if slot in manual_slots
    }
    expected_accounts = {
        ak for (_s, _p, ak) in REAL_FLEET
    } - {"windsurf", "dry"} - manual_account_keys
    missing = expected_accounts - set(counter)
    assert not missing, (
        f"starved after 200 picks (window={busy_window}): {missing}. "
        f"Distribution: {dict(counter)}"
    )
    # Sanity: distribution should be reasonably even across the 19 ready
    # accounts. No account gets more than 3x the median.
    median = sorted(counter.values())[len(counter) // 2]
    hogs = {k: v for k, v in counter.items() if v > 3 * median}
    assert not hogs, f"load hogs (>3x median={median}): {hogs}"


def test_rotation_never_picks_manual_only_slot():
    _seed_fleet(all_ready=True)
    for _ in range(100):
        task = _seed_task("high-stakes")
        route = router.choose_route(task, refresh=False)
        assert route is not None
        assert route.slot != "windsurf-cascade", (
            "windsurf should never be auto-picked"
        )


def test_windsurf_reachable_when_pinned_by_require_provider():
    _seed_fleet(all_ready=True)
    task = _seed_task("high-stakes", require_provider="windsurf")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.slot == "windsurf-cascade"
    assert route.provider == "windsurf"
    # catalog says claude-opus-4.7 for windsurf
    assert route.model == "claude-opus-4.7"
    assert route.reasoning_effort == "max"


# ---------------------------------------------------------------------------
# 2. busy_account_keys guard — no concurrent same-account collisions
# ---------------------------------------------------------------------------

def test_busy_account_keys_guard():
    _seed_fleet(all_ready=True)
    # simulate 3 copilot accounts all busy → next copilot-requiring task falls
    # back to another provider, NEVER to an already-busy copilot key.
    busy = {
        "github-copilot",
        "github-copilot:accneww-copilot",
        "github-copilot:boom",
        "github-copilot-cli",   # virtual slot account key
    }
    task = _seed_task("high-stakes")
    route = router.choose_route(task, exclude_account_keys=busy, refresh=False)
    assert route is not None
    assert route.provider != "github-copilot"
    assert route.account_key not in busy


# ---------------------------------------------------------------------------
# 3. Quota-blocked slot is skipped
# ---------------------------------------------------------------------------

def test_quota_blocked_slot_skipped():
    # seed only two copilot slots; one with usage 100% (quota blocked),
    # one healthy. Router must pick the healthy one.
    db.upsert_slot("copilot-maxed", provider="github-copilot", ready=0,
                   account_key="github-copilot:maxed",
                   usage_primary_pct=100.0,
                   cooldown_until="2099-01-01T00:00:00+00:00")
    db.upsert_slot("copilot-ok", provider="github-copilot", ready=1,
                   account_key="github-copilot:ok",
                   usage_primary_pct=20.0)
    task = _seed_task("structured", require_provider="github-copilot")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.slot == "copilot-ok"


# ---------------------------------------------------------------------------
# 4. Cooldown respected
# ---------------------------------------------------------------------------

def test_cooldown_blocks_then_expires():
    now = dt.datetime.now(dt.timezone.utc)
    future = (now + dt.timedelta(hours=1)).isoformat(timespec="seconds")
    past = (now - dt.timedelta(minutes=5)).isoformat(timespec="seconds")
    db.upsert_slot("s-cool", provider="codex", ready=1,
                   account_key="codex:cooling", cooldown_until=future,
                   preferred_model="gpt-5.4")
    db.upsert_slot("s-free", provider="codex", ready=1,
                   account_key="codex:free", cooldown_until=past,
                   preferred_model="gpt-5.4")
    task = _seed_task("structured")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.slot == "s-free"   # expired cooldown is eligible


# ---------------------------------------------------------------------------
# 5. All blocked → None (no infinite loop)
# ---------------------------------------------------------------------------

def test_all_slots_blocked_returns_none():
    now = dt.datetime.now(dt.timezone.utc)
    future = (now + dt.timedelta(hours=1)).isoformat(timespec="seconds")
    for slot, provider, ak in REAL_FLEET:
        db.upsert_slot(slot, provider=provider, account_key=ak, ready=1,
                       cooldown_until=future)
    task = _seed_task("structured")
    route = router.choose_route(task, refresh=False)
    assert route is None


def test_no_slots_seeded_returns_none():
    task = _seed_task("structured")
    route = router.choose_route(task, refresh=False)
    assert route is None


# ---------------------------------------------------------------------------
# 6. Deterministic replay — identical state → identical route
# ---------------------------------------------------------------------------

def test_deterministic_replay_when_pick_count_reset():
    """Determinism contract: identical slot state → identical route.
    We reset pick_count between calls to isolate the selection from LRU
    bookkeeping (which intentionally mutates state on every pick)."""
    _seed_fleet(all_ready=True)
    task = _seed_task("high-stakes")
    route_a = router.choose_route(task, refresh=False)
    # Reset LRU counters so second call sees the same state as the first.
    from pipeline.orchestrator.db import tx as _tx
    with _tx() as conn:
        conn.execute("UPDATE slots SET pick_count = 0")
    task2 = _seed_task("high-stakes")
    route_b = router.choose_route(task2, refresh=False)
    assert route_a is not None and route_b is not None
    assert (route_a.slot, route_a.provider, route_a.model, route_a.reasoning_effort) == \
           (route_b.slot, route_b.provider, route_b.model, route_b.reasoning_effort)
