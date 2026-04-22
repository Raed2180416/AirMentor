#!/usr/bin/env python3
"""Cheap monitor helper for the overnight run. Single-shot snapshot.

Prints:
  - orchestrator tmux session liveness
  - by_state tally
  - running tasks with duration
  - failed tasks with failure class + last error snippet
  - last 5 task events across the run

Invoke per cycle:
  python -m pipeline.scripts.overnight_monitor <dag_run_id>
"""
from __future__ import annotations

import datetime as dt
import json
import subprocess
import sys

from pipeline.orchestrator import db


def tmux_alive(session: str) -> bool:
    r = subprocess.run(["tmux", "has-session", "-t", session],
                       capture_output=True)
    return r.returncode == 0


def _age(iso: str | None) -> str:
    if not iso:
        return "-"
    try:
        t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return iso
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    now = dt.datetime.now(dt.timezone.utc)
    secs = int((now - t).total_seconds())
    if secs < 0:
        return "0s"
    h, s = divmod(secs, 3600)
    m, s = divmod(s, 60)
    if h:
        return f"{h}h{m}m"
    if m:
        return f"{m}m{s}s"
    return f"{s}s"


def main(dag_run_id: str) -> int:
    db.migrate()
    rows = db.list_tasks(dag_run_id)
    by_state: dict[str, int] = {}
    for r in rows:
        by_state[r["state"]] = by_state.get(r["state"], 0) + 1
    print(f"[{dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}] dag_run={dag_run_id}")
    print(f"orchestrator_alive={tmux_alive('airmentor-pipe-orchestrator')}")
    print("by_state:", json.dumps(by_state, sort_keys=True))

    running = [r for r in rows if r["state"] in {"claimed", "running", "merging"}]
    if running:
        print("\n[running]")
        for r in running:
            print(f"  {r['node_id']:<52} age={_age(r['started_at']):<8} attempt={r['attempt']} slot={r['slot'] or '-'} model={r['model'] or '-'}")

    failed = [r for r in rows if r["state"] == "failed"]
    if failed:
        print(f"\n[failed x{len(failed)}]")
        for r in failed:
            err = (r["last_error"] or "").splitlines()[0][:200]
            print(f"  {r['node_id']:<52} class={r['last_failure_class'] or '-'} err={err}")

    waiting = [r for r in rows if r["state"] == "waiting_slot"]
    if waiting:
        print(f"\n[waiting_slot x{len(waiting)}]")
        for r in waiting[:6]:
            print(f"  {r['node_id']}")

    # recent events
    conn = db.get_conn()
    ids = [r["id"] for r in rows]
    if ids:
        q = f"SELECT task_id, at, kind FROM task_events WHERE task_id IN ({','.join('?'*len(ids))}) ORDER BY id DESC LIMIT 10"
        recent = list(conn.execute(q, ids))
        node_by_id = {r["id"]: r["node_id"] for r in rows}
        print("\n[last 10 events]")
        for e in recent:
            node = node_by_id.get(e["task_id"], f"task{e['task_id']}")
            print(f"  {e['at']}  {node:<48} {e['kind']}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: overnight_monitor.py <dag_run_id>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
