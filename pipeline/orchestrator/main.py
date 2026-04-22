"""Pipeline CLI + scheduler loop.

Subcommands:
  init      — load DAG YAML, materialise tasks in DB
  run       — scheduler loop: claim ready tasks (parallel when safe), execute
  status    — one-shot status print
  resume    — re-run scheduler against an existing dag_run_id
  abort     — mark all non-terminal tasks in a run as cancelled
  slots     — refresh slot ledger, print table
  reset     — drop + re-init DB (danger)
  show-task — print one task's full detail
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import signal
import sys
import time
from pathlib import Path

from . import db, dag as dag_mod, executor, slot_ledger

DEFAULT_PARALLEL = int(os.environ.get("AIRMENTOR_PIPELINE_PARALLEL", "4"))
DEFAULT_POLL = int(os.environ.get("AIRMENTOR_PIPELINE_POLL_SECONDS", "5"))


# ---------- commands ----------

def cmd_init(args: argparse.Namespace) -> int:
    db.migrate()
    dag_path = Path(args.dag).resolve()
    if not dag_path.is_file():
        print(f"ERROR: DAG file not found: {dag_path}", file=sys.stderr)
        return 2
    spec = dag_mod.load_dag(dag_path)
    dag_mod.materialise(spec)
    slot_ledger.refresh_from_disk()
    print(json.dumps({
        "dag_run_id": spec.dag_run_id,
        "dag_file": str(spec.dag_file),
        "nodes": len(spec.nodes),
    }, indent=2))
    return 0


def _active_parallel_groups(dag_run_id: str) -> set[str]:
    rows = db.list_tasks(dag_run_id)
    return {r["parallel_group"] for r in rows
            if r["parallel_group"] and r["state"] in
            {"claimed", "running", "merging"}}


def _busy_account_keys(dag_run_id: str) -> list[str]:
    """Return `account_key`s currently held by claimed/running tasks in this run.

    Two tasks must never hit the same arctic auth_source_key at once — that
    would trigger quota overlap + rate-limit across both. Returning this set
    lets `claim_next_ready` skip any candidate pinned to a busy key.
    """
    rows = db.list_tasks(dag_run_id)
    out: list[str] = []
    for r in rows:
        if r["state"] not in {"claimed", "running", "merging"}:
            continue
        try:
            ak = r["account_key"]
        except (IndexError, KeyError):
            ak = None
        if ak:
            out.append(ak)
    return out


def _terminal_states() -> set[str]:
    return {"completed", "failed", "cancelled"}


def _all_terminal(dag_run_id: str) -> bool:
    rows = db.list_tasks(dag_run_id)
    return bool(rows) and all(r["state"] in _terminal_states() for r in rows)


def cmd_run(args: argparse.Namespace) -> int:
    db.migrate()
    slot_ledger.refresh_from_disk()
    dag_run_id = args.dag_run_id
    if not dag_run_id:
        print("ERROR: --dag-run-id required (run `init` first)", file=sys.stderr)
        return 2
    parallel = int(args.parallel or DEFAULT_PARALLEL)
    poll = int(args.poll or DEFAULT_POLL)

    running: dict[int, cf.Future] = {}
    stop = {"flag": False}

    def _sigint(signum, frame):
        stop["flag"] = True
    signal.signal(signal.SIGINT, _sigint)
    signal.signal(signal.SIGTERM, _sigint)

    with cf.ThreadPoolExecutor(max_workers=parallel) as pool:
        while not stop["flag"]:
            # promote ready
            db.mark_ready_if_deps_done(dag_run_id)

            # drain finished futures
            for tid in list(running):
                fut = running[tid]
                if fut.done():
                    try:
                        fut.result()
                    except Exception as e:
                        db.log_event(tid, "executor_exception", {"error": str(e)})
                        db.set_task_state(tid, "failed",
                                          last_failure_class="executor_exception",
                                          last_error=str(e)[:2000])
                    running.pop(tid, None)

            if _all_terminal(dag_run_id) and not running:
                break

            # claim more up to parallel cap
            while len(running) < parallel:
                # every group with in-flight work is allowed to add more up to
                # group_capacity; scope glob + account_key guards prevent
                # accidental collisions
                allow_groups = _active_parallel_groups(dag_run_id)
                busy_keys = _busy_account_keys(dag_run_id)
                group_cap = int(args.group_capacity or parallel)
                task = db.claim_next_ready(
                    dag_run_id=dag_run_id,
                    allow_parallel_groups=list(allow_groups),
                    busy_account_keys=busy_keys,
                    group_capacity=group_cap,
                )
                if task is None:
                    break
                tid = int(task["id"])
                running[tid] = pool.submit(executor.execute_task, tid)
                db.log_event(tid, "scheduled",
                             {"parallel_active": len(running) + 1,
                              "group": task["parallel_group"],
                              "busy_account_keys": busy_keys})

            time.sleep(poll)

        # drain
        for tid, fut in list(running.items()):
            try:
                fut.result(timeout=1)
            except Exception:
                pass

    # finalize run
    rows = db.list_tasks(dag_run_id)
    failed = [r for r in rows if r["state"] == "failed"]
    state = "completed" if not failed else "failed"
    db.finish_run(dag_run_id, state,
                  notes=f"failed_tasks={len(failed)}")
    print(json.dumps({
        "dag_run_id": dag_run_id,
        "state": state,
        "total": len(rows),
        "failed": len(failed),
    }, indent=2))
    return 0 if state == "completed" else 1


def cmd_status(args: argparse.Namespace) -> int:
    db.migrate()
    dag_run_id = args.dag_run_id
    rows = db.list_tasks(dag_run_id) if dag_run_id else []
    by_state: dict[str, int] = {}
    for r in rows:
        by_state[r["state"]] = by_state.get(r["state"], 0) + 1
    out = {
        "dag_run_id": dag_run_id,
        "by_state": by_state,
        "tasks": [
            {
                "id": r["id"],
                "node": r["node_id"],
                "pass": r["pass_name"],
                "state": r["state"],
                "attempt": r["attempt"],
                "slot": r["slot"],
                "model": r["model"],
                "last_failure": r["last_failure_class"],
            }
            for r in rows
        ],
    }
    print(json.dumps(out, indent=2, default=str))
    return 0


def cmd_slots(args: argparse.Namespace) -> int:
    db.migrate()
    slot_ledger.refresh_from_disk()
    rows = db.list_slots()
    print(json.dumps(
        [dict(r) for r in rows], indent=2, default=str,
    ))
    return 0


def cmd_abort(args: argparse.Namespace) -> int:
    db.migrate()
    dag_run_id = args.dag_run_id
    rows = db.list_tasks(dag_run_id)
    for r in rows:
        if r["state"] not in _terminal_states():
            db.set_task_state(r["id"], "cancelled",
                              last_failure_class="user_abort",
                              last_error="aborted by operator")
            if r["tmux_session"]:
                import subprocess
                subprocess.run(["tmux", "kill-session", "-t", r["tmux_session"]], check=False)
    db.finish_run(dag_run_id, "cancelled", notes="operator abort")
    return 0


def cmd_show_task(args: argparse.Namespace) -> int:
    db.migrate()
    t = db.get_task(int(args.task_id))
    if not t:
        print("not found", file=sys.stderr)
        return 2
    events = list(db.get_conn().execute(
        "SELECT * FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 50",
        (t["id"],)).fetchall())
    validators = db.list_validator_results(t["id"])
    print(json.dumps({
        "task": dict(t),
        "events": [dict(e) for e in events],
        "validators": [dict(v) for v in validators],
    }, indent=2, default=str))
    return 0


def cmd_reset(args: argparse.Namespace) -> int:
    p = db.db_path()
    if p.exists():
        confirm = input(f"DELETE {p}? type YES: ")
        if confirm.strip() != "YES":
            print("aborted")
            return 1
        p.unlink()
        for suffix in ("-wal", "-shm"):
            (p.parent / (p.name + suffix)).unlink(missing_ok=True)
    db.migrate()
    print("reset ok")
    return 0


# ---------- entry ----------

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="airmentor-pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("--dag", required=True)
    p_init.set_defaults(func=cmd_init)

    p_run = sub.add_parser("run")
    p_run.add_argument("--dag-run-id", required=True)
    p_run.add_argument("--parallel", type=int, default=None,
                       help="max concurrent tasks across the whole DAG (default 4)")
    p_run.add_argument("--group-capacity", type=int, default=None,
                       help="max concurrent tasks within a single parallel_group "
                            "(default: same as --parallel)")
    p_run.add_argument("--poll", type=int, default=None)
    p_run.set_defaults(func=cmd_run)

    p_status = sub.add_parser("status")
    p_status.add_argument("--dag-run-id")
    p_status.set_defaults(func=cmd_status)

    p_slots = sub.add_parser("slots")
    p_slots.set_defaults(func=cmd_slots)

    p_abort = sub.add_parser("abort")
    p_abort.add_argument("--dag-run-id", required=True)
    p_abort.set_defaults(func=cmd_abort)

    p_show = sub.add_parser("show-task")
    p_show.add_argument("--task-id", required=True)
    p_show.set_defaults(func=cmd_show_task)

    p_reset = sub.add_parser("reset")
    p_reset.set_defaults(func=cmd_reset)

    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == "__main__":
    raise SystemExit(main())
