"""Tests for SQLite orchestration primitives."""
from __future__ import annotations

from pipeline.orchestrator import db


def _seed_task(node_id="a", deps=()):
    return db.insert_task(
        dag_run_id="run-1",
        node_id=node_id,
        pass_name="demo-pass",
        prompt_file="pipeline/tests/_nonexistent.md",
        depends_on=list(deps),
    )


def test_insert_and_get():
    tid = _seed_task()
    row = db.get_task(tid)
    assert row["pass_name"] == "demo-pass"
    assert row["state"] == "pending"


def test_mark_ready_if_deps_done():
    a = _seed_task("a")
    b = _seed_task("b", deps=["a"])
    # initially only "a" should become ready (no deps); "b" waits
    db.mark_ready_if_deps_done("run-1")
    assert db.get_task(a)["state"] == "ready"
    assert db.get_task(b)["state"] == "pending"
    # complete "a" manually
    db.set_task_state(a, "completed")
    db.mark_ready_if_deps_done("run-1")
    assert db.get_task(b)["state"] == "ready"


def test_claim_next_ready_is_atomic():
    a = _seed_task("a")
    b = _seed_task("b")
    db.mark_ready_if_deps_done("run-1")
    claimed = db.claim_next_ready(dag_run_id="run-1")
    assert claimed is not None
    assert claimed["state"] == "claimed"
    # claim a second one
    claimed2 = db.claim_next_ready(dag_run_id="run-1")
    assert claimed2 is not None
    assert claimed2["id"] != claimed["id"]
    # no more ready
    none_left = db.claim_next_ready(dag_run_id="run-1")
    assert none_left is None


def test_parallel_group_capacity_one():
    a = db.insert_task(
        dag_run_id="run-1", node_id="ga", pass_name="p",
        prompt_file="x.md", parallel_group="g1",
    )
    b = db.insert_task(
        dag_run_id="run-1", node_id="gb", pass_name="p",
        prompt_file="x.md", parallel_group="g1",
    )
    db.mark_ready_if_deps_done("run-1")
    c1 = db.claim_next_ready(dag_run_id="run-1")
    c2 = db.claim_next_ready(dag_run_id="run-1")
    # second claim should be blocked because g1 already has one running
    # and default group_capacity is 1
    assert c1 is not None
    assert c2 is None
    # scheduler explicitly allows parallel by bumping group_capacity AND
    # putting the group in allow_parallel_groups
    c3 = db.claim_next_ready(
        dag_run_id="run-1",
        allow_parallel_groups=["g1"],
        group_capacity=4,
    )
    assert c3 is not None
    # but a 5th claim with capacity 2 should now be blocked (2 active, cap=2)
    c4 = db.claim_next_ready(
        dag_run_id="run-1",
        allow_parallel_groups=["g1"],
        group_capacity=2,
    )
    assert c4 is None


def test_account_key_guard_blocks_concurrent_use():
    """Two tasks pinned to the same arctic account_key must never claim together."""
    t1 = db.insert_task(
        dag_run_id="run-ak", node_id="a", pass_name="p", prompt_file="x.md",
    )
    t2 = db.insert_task(
        dag_run_id="run-ak", node_id="b", pass_name="p", prompt_file="x.md",
    )
    # pre-assign the same account_key on both tasks (router usually does this
    # at claim time; tests simulate by patching the row)
    db.update_task_fields(t1, account_key="codex:hazzy")
    db.update_task_fields(t2, account_key="codex:hazzy")
    db.mark_ready_if_deps_done("run-ak")
    first = db.claim_next_ready(dag_run_id="run-ak")
    assert first is not None
    # second claim while first is in-flight, with busy_account_keys set:
    blocked = db.claim_next_ready(
        dag_run_id="run-ak",
        busy_account_keys=["codex:hazzy"],
    )
    assert blocked is None
    # once first is done, second becomes claimable again
    db.set_task_state(first["id"], "completed")
    after = db.claim_next_ready(dag_run_id="run-ak")
    assert after is not None
    assert after["id"] == t2


def test_merge_lock_roundtrip():
    assert db.acquire_merge_lock("ledger.md", "holder-A", ttl_s=60) is True
    assert db.acquire_merge_lock("ledger.md", "holder-B", ttl_s=60) is False
    db.release_merge_lock("ledger.md", "holder-A")
    assert db.acquire_merge_lock("ledger.md", "holder-B", ttl_s=60) is True


def test_slot_upsert_and_list():
    db.upsert_slot("codex-05", provider="codex", preferred_model="gpt-5.4-mini", ready=1)
    db.upsert_slot("codex-05", preferred_model="gpt-5.4")
    rows = db.list_slots()
    assert len(rows) == 1
    assert rows[0]["preferred_model"] == "gpt-5.4"


def test_record_validator_and_grounding():
    tid = _seed_task()
    db.record_validator_result(
        task_id=tid, attempt=1, check_name="structured_exit",
        passed=True, severity="info", detail={"ok": True},
    )
    results = db.list_validator_results(tid, attempt=1)
    assert len(results) == 1
    db.record_grounding_probe(
        task_id=tid, attempt=1, citation="src/App.tsx:1",
        path="src/App.tsx", line_start=1, line_end=1,
        exists_on_disk=True, lines_valid=True,
    )
