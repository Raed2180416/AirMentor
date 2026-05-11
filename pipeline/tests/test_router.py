"""Tests for slot ledger + router logic (no live CLIs invoked)."""
from __future__ import annotations

import datetime as dt

from pipeline.orchestrator import db, router, slot_ledger


def _far_future() -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=2)).isoformat(timespec="seconds")


def _past() -> str:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).isoformat(timespec="seconds")


def _seed_slot(slot, **fields):
    db.upsert_slot(slot, **fields)


def _seed_task(require_provider=None, requested_model=None, task_class="structured"):
    tid = db.insert_task(
        dag_run_id="run-r",
        node_id="t",
        pass_name="p",
        prompt_file="x.md",
        require_provider=require_provider,
        requested_model=requested_model,
        task_class=task_class,
    )
    return db.get_task(tid)


def test_pick_prefers_higher_provider_priority():
    # Priority floor check (slot_ledger.PROVIDER_PRIORITY). As of the
    # 2026-04-22 reprioritisation, `codex` (11, native CLI, 6 rotating
    # seats, gpt-5.4 xhigh) sits above `github-copilot` (10, rich catalog
    # incl. opus-4.7). Higher-priority provider must win when all else is
    # equal. If we later revert copilot > codex, flip this assertion and
    # the PROVIDER_PRIORITY numbers together.
    _seed_slot("codex-05", provider="codex", ready=1, preferred_model="gpt-5.4")
    _seed_slot("copilot-X", provider="github-copilot", ready=1, preferred_model="gpt-5.4")
    task = _seed_task()
    pick = slot_ledger.pick_best_slot(task)
    assert pick is not None
    assert pick.slot == "codex-05"


def test_cooldown_excludes_slot():
    _seed_slot("codex-05", provider="codex", ready=1,
               preferred_model="gpt-5.4-mini",
               cooldown_until=_far_future(), cooldown_reason="quota")
    _seed_slot("codex-06", provider="codex", ready=1, preferred_model="gpt-5.4-mini")
    task = _seed_task()
    pick = slot_ledger.pick_best_slot(task)
    assert pick is not None
    assert pick.slot == "codex-06"


def test_expired_cooldown_is_eligible():
    _seed_slot("codex-05", provider="codex", ready=1,
               preferred_model="gpt-5.4-mini",
               cooldown_until=_past(), cooldown_reason="stale")
    task = _seed_task()
    pick = slot_ledger.pick_best_slot(task)
    assert pick is not None
    assert pick.slot == "codex-05"


def test_require_provider_filters():
    _seed_slot("codex-05", provider="codex", ready=1, preferred_model="gpt-5.4")
    _seed_slot("google-main", provider="google", ready=1,
               preferred_model="gemini-3.1-pro-preview")
    task = _seed_task(require_provider="google")
    pick = slot_ledger.pick_best_slot(task, require_provider="google")
    assert pick.slot == "google-main"


def test_router_chooses_model_from_task_class():
    # codex provider + high-stakes → picks best code-top/strong model.
    # Catalog currently rates gpt-5.3-codex (code-top) and gpt-5.4 (strong)
    # equal quality; deterministic tie-break goes to gpt-5.3-codex which
    # also triggers the xhigh effort floor — exactly what we want for
    # high-stakes coding tasks.
    _seed_slot("codex-05", provider="codex", ready=1, preferred_model="gpt-5.4-mini")
    task = _seed_task(task_class="high-stakes")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.model == "gpt-5.3-codex"
    assert route.reasoning_effort == "xhigh"


def test_router_bookkeeping_picks_cheapest_capable():
    # copilot has opus-4.7 and gpt-5.4-mini; bookkeeping must NOT waste opus.
    _seed_slot("copilot-bk", provider="github-copilot", ready=1,
               preferred_model=None, account_key="github-copilot:bk")
    task = _seed_task(task_class="bookkeeping")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    # Any fast-tier model is acceptable, but NEVER an opus.
    assert "opus" not in route.model
    assert route.reasoning_effort == "low"


def test_router_high_stakes_on_copilot_prefers_opus_4_7():
    _seed_slot("copilot-hi", provider="github-copilot", ready=1,
               preferred_model=None, account_key="github-copilot:hi")
    task = _seed_task(task_class="high-stakes")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    # Round-6 (2026-04-22): copilot top tier was gpt-5.4, but live API
    # rejected it with model_not_supported on copilot-03 +
    # copilot-accneww432. Catalog re-tiered: gpt-5.4 → fast, and
    # gemini-3.1-pro-preview → top (verified callable across all 3
    # copilot accounts, matches slot-map.tsv execution_model).
    assert route.model == "gemini-3.1-pro-preview"
    assert route.reasoning_effort == "xhigh"   # high-stakes class default


def test_router_structured_on_anthropic_picks_sonnet_thinking():
    _seed_slot("anthropic-main", provider="anthropic", ready=1,
               preferred_model=None, account_key="anthropic")
    task = _seed_task(task_class="structured")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.model == "claude-sonnet-4-6"
    # User intent 2026-04-22: Anthropic OAuth credits are scarce, so every
    # sonnet call runs at max reasoning/thinking (floor bumped from "high"
    # \u2192 "max"). structured class default is medium; floor wins.
    assert route.reasoning_effort == "max"


def test_router_antigravity_high_stakes_picks_opus_4_6():
    _seed_slot("antigravity-02", provider="antigravity", ready=1,
               preferred_model=None, account_key="antigravity:unknownme")
    task = _seed_task(task_class="high-stakes")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    # antigravity catalog = {opus-4.6, gemini-3.1-pro-preview, gemini-3-flash};
    # high-stakes prefers top → opus-4.6. Effort floor for opus-4.6 = xhigh.
    assert route.model == "claude-opus-4.6"
    assert route.reasoning_effort == "xhigh"


def test_router_antigravity_bookkeeping_picks_gemini_flash():
    _seed_slot("antigravity-02", provider="antigravity", ready=1)
    task = _seed_task(task_class="bookkeeping")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.model == "gemini-3-flash"
    assert route.reasoning_effort == "low"


def test_router_requested_model_wins_when_supported():
    _seed_slot("codex-05", provider="codex", ready=1, preferred_model="gpt-5.4")
    task = _seed_task(requested_model="gpt-5.3-codex")
    route = router.choose_route(task, refresh=False)
    assert route is not None
    assert route.model == "gpt-5.3-codex"


def test_router_none_when_all_cooldown():
    _seed_slot("codex-05", provider="codex", ready=1,
               cooldown_until=_far_future(), preferred_model="gpt-5.4")
    task = _seed_task()
    route = router.choose_route(task, refresh=False)
    assert route is None


def test_soonest_available_returns_earliest():
    later = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).isoformat(timespec="seconds")
    sooner = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)).isoformat(timespec="seconds")
    _seed_slot("codex-01", provider="codex", ready=0,
               cooldown_until=later, preferred_model="gpt-5.4-mini")
    _seed_slot("codex-02", provider="codex", ready=0,
               cooldown_until=sooner, preferred_model="gpt-5.4-mini")
    task = _seed_task()
    pick, eta = slot_ledger.soonest_available(task)
    assert pick is not None
    assert pick.slot == "codex-02"
    assert eta is not None and eta > 0
