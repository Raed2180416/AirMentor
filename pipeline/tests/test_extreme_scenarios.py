"""Extreme scenarios — edge cases the autopilot MUST survive deterministically.

Every test here is a pathological state the real fleet can enter, simulated
in-memory with zero token cost. If any of these break, the scheduler will
stall, spin, or mis-route in production.

Covered scenarios:
  1. Quota exhaustion — every slot at usage>=100%.
  2. Global cooldown — every slot cooling until the far future.
  3. Mixed exhaustion + partial recovery (one slot's cooldown in the past).
  4. Manual-only slot reached ONLY via require_provider pin.
  5. require_account_key pin works for a specific arctic account.
  6. Busy-key guard at capacity=1 forces true round-robin.
  7. Catalog drift — unknown provider falls back gracefully.
  8. Slot without account_key (legacy row) — router still handles.
  9. Task with pre-pinned reasoning_effort overrides floor.
 10. Zero-fleet — no slots seeded at all → None, no crash.
 11. Only windsurf available — auto-rotation returns None (manual-only).
 12. Mixed providers, all quota-capped except one → that one always wins.
"""
from __future__ import annotations

import datetime as dt

import pytest

from pipeline.orchestrator import db, router, slot_ledger


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _future(mins: int = 60) -> str:
    return (_now() + dt.timedelta(minutes=mins)).isoformat(timespec="seconds")


def _past(mins: int = 5) -> str:
    return (_now() - dt.timedelta(minutes=mins)).isoformat(timespec="seconds")


_TC = [0]


def _task(task_class: str = "structured", **kw):
    _TC[0] += 1
    tid = db.insert_task(
        dag_run_id="ext",
        node_id=f"t{_TC[0]}",
        pass_name="p",
        prompt_file="x.md",
        task_class=task_class,
        **kw,
    )
    return db.get_task(tid)


# --------------------------------------------------------------------------
# 1. Quota exhaustion everywhere
# --------------------------------------------------------------------------

def test_all_slots_quota_capped_returns_none():
    for slot, prov in [("copilot-1", "github-copilot"), ("codex-1", "codex"),
                       ("anthropic-1", "anthropic"), ("antigravity-1", "antigravity")]:
        db.upsert_slot(
            slot, provider=prov, ready=0,
            account_key=f"{prov}:test",
            usage_primary_pct=100.0,
            cooldown_until=_future(120),
            cooldown_reason="usage-cap",
        )
    route = router.choose_route(_task("structured"), refresh=False)
    assert route is None


# --------------------------------------------------------------------------
# 2. Everyone cooling
# --------------------------------------------------------------------------

def test_all_slots_cooling_returns_none_and_soonest_reports_eta():
    db.upsert_slot("a", provider="codex", ready=1, account_key="codex:a",
                   cooldown_until=_future(30))
    db.upsert_slot("b", provider="codex", ready=1, account_key="codex:b",
                   cooldown_until=_future(90))
    task = _task("structured")
    assert router.choose_route(task, refresh=False) is None
    pick, eta = slot_ledger.soonest_available(task)
    assert pick is not None
    assert pick.slot == "a"                 # 30m < 90m
    assert eta is not None and eta > 0      # positive ETA
    assert eta < 60 * 60                    # < 1h


# --------------------------------------------------------------------------
# 3. Mixed exhaustion + one slot with expired cooldown is eligible
# --------------------------------------------------------------------------

def test_expired_cooldown_wins_over_still_cooling():
    db.upsert_slot("hot", provider="codex", ready=1, account_key="codex:hot",
                   cooldown_until=_future(60))
    db.upsert_slot("cold", provider="codex", ready=1, account_key="codex:cold",
                   cooldown_until=_past(5))     # expired
    route = router.choose_route(_task("structured"), refresh=False)
    assert route is not None
    assert route.slot == "cold"


# --------------------------------------------------------------------------
# 4. Windsurf manual-only — reachable ONLY by require_provider pin
# --------------------------------------------------------------------------

def test_windsurf_pin_reaches_manual_only_slot():
    db.upsert_slot("copilot-r", provider="github-copilot", ready=1,
                   account_key="github-copilot:real")
    db.upsert_slot("windsurf-cascade", provider="windsurf", ready=1,
                   account_key="windsurf")
    # Auto → picks copilot (never windsurf)
    auto = router.choose_route(_task("high-stakes"), refresh=False)
    assert auto is not None
    assert auto.slot == "copilot-r"
    # Pinned → windsurf reached, opus-4.7 chosen with max effort
    pinned = router.choose_route(
        _task("high-stakes", require_provider="windsurf"), refresh=False
    )
    assert pinned is not None
    assert pinned.slot == "windsurf-cascade"
    assert pinned.model == "claude-opus-4.7"
    assert pinned.reasoning_effort == "max"


# --------------------------------------------------------------------------
# 5. require_account_key pins a specific arctic account
# --------------------------------------------------------------------------

def test_require_account_key_picks_exact_slot():
    db.upsert_slot("codex-01", provider="codex", ready=1, account_key="codex:a")
    db.upsert_slot("codex-02", provider="codex", ready=1, account_key="codex:b")
    db.upsert_slot("codex-03", provider="codex", ready=1, account_key="codex:c")
    task = _task("structured", require_account_key="codex:b")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.account_key == "codex:b"
    assert route.slot == "codex-02"


# --------------------------------------------------------------------------
# 6. Busy-key guard at tight concurrency
# --------------------------------------------------------------------------

def test_busy_key_guard_forces_round_robin_when_capacity_one_per_account():
    # 3 copilot slots, each with unique account_key. If we mark 2 busy,
    # router must pick the remaining free one.
    db.upsert_slot("copilot-1", provider="github-copilot", ready=1,
                   account_key="copilot:a")
    db.upsert_slot("copilot-2", provider="github-copilot", ready=1,
                   account_key="copilot:b")
    db.upsert_slot("copilot-3", provider="github-copilot", ready=1,
                   account_key="copilot:c")
    task = _task("structured")
    route = router.choose_route(
        task, exclude_account_keys={"copilot:a", "copilot:b"}, refresh=False
    )
    assert route is not None
    assert route.account_key == "copilot:c"
    assert route.slot == "copilot-3"


# --------------------------------------------------------------------------
# 7. Unknown provider in DB — catalog miss handled
# --------------------------------------------------------------------------

def test_unknown_provider_row_is_skipped_gracefully():
    db.upsert_slot("alien-1", provider="alien-corp", ready=1,
                   account_key="alien:1")
    db.upsert_slot("codex-ok", provider="codex", ready=1,
                   account_key="codex:ok")
    route = router.choose_route(_task("structured"), refresh=False)
    assert route is not None
    # alien-corp has provider priority 0 (unknown). codex (800) wins.
    assert route.slot == "codex-ok"


# --------------------------------------------------------------------------
# 8. Slot with NULL account_key — legacy rows still work
# --------------------------------------------------------------------------

def test_slot_without_account_key_still_routes():
    db.upsert_slot("legacy-slot", provider="codex", ready=1,
                   account_key=None, preferred_model="gpt-5.4")
    route = router.choose_route(_task("structured"), refresh=False)
    assert route is not None
    assert route.slot == "legacy-slot"
    assert route.account_key is None


# --------------------------------------------------------------------------
# 9. Task-level reasoning_effort override beats the floor
# --------------------------------------------------------------------------

def test_task_level_effort_override_beats_class_default():
    db.upsert_slot("codex-ok", provider="codex", ready=1,
                   account_key="codex:ok")
    # bookkeeping class default = "low"; override pushes to "xhigh"
    task = _task("bookkeeping", reasoning_effort="xhigh")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.reasoning_effort == "xhigh"


def test_floor_overrides_lower_override():
    # A task cannot downgrade below a hard floor. Anthropic sonnet floor
    # was raised from "high" \u2192 "max" on 2026-04-22 to preserve scarce OAuth
    # credits (every call runs at max reasoning/thinking). Task asks for
    # "low"; router must keep the "max" floor.
    db.upsert_slot("anthropic-1", provider="anthropic", ready=1,
                   account_key="anthropic")
    task = _task("structured", reasoning_effort="low")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.model == "claude-sonnet-4-6"
    assert route.reasoning_effort == "max"   # floor wins over "low"


# --------------------------------------------------------------------------
# 10. Zero fleet
# --------------------------------------------------------------------------

def test_empty_fleet_returns_none():
    assert router.choose_route(_task("structured"), refresh=False) is None


# --------------------------------------------------------------------------
# 11. Only manual-only slots available → None in auto mode
# --------------------------------------------------------------------------

def test_only_windsurf_available_auto_mode_returns_none():
    db.upsert_slot("windsurf-cascade", provider="windsurf", ready=1,
                   account_key="windsurf")
    route = router.choose_route(_task("high-stakes"), refresh=False)
    assert route is None       # auto never picks manual-only


# --------------------------------------------------------------------------
# 12. All providers capped except one → that one wins every pick
# --------------------------------------------------------------------------

def test_lone_healthy_slot_serves_all_picks():
    db.upsert_slot("copilot-dead", provider="github-copilot", ready=0,
                   account_key="copilot:dead", cooldown_until=_future(120))
    db.upsert_slot("codex-dead", provider="codex", ready=0,
                   account_key="codex:dead", cooldown_until=_future(120))
    db.upsert_slot("anthropic-ok", provider="anthropic", ready=1,
                   account_key="anthropic")
    for _ in range(25):
        route = router.choose_route(_task("structured"), refresh=False)
        assert route is not None
        assert route.slot == "anthropic-ok"
        assert route.model == "claude-sonnet-4-6"


# --------------------------------------------------------------------------
# 13. Quota reset timestamp synthesized into cooldown during refresh
# --------------------------------------------------------------------------

def test_quota_blocked_slot_is_not_ready():
    # Direct DB row simulates what refresh_from_disk computes when reading
    # an arctic .status file with usage_primary_pct=100.
    db.upsert_slot(
        "codex-maxed", provider="codex",
        account_key="codex:maxed",
        ready=0,                           # computed ready=0 by refresh
        usage_primary_pct=100.0,
        cooldown_until=_future(30),
        cooldown_reason="usage-cap-reached",
    )
    route = router.choose_route(_task("structured"), refresh=False)
    assert route is None                   # not routed, quota-blocked
