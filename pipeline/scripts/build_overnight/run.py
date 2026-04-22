"""Entry: generate all manifests + prompts + overnight DAG."""
from __future__ import annotations

from .common import emit_artifacts, emit_dag, emit_intent, emit_prompt
from . import nodes_audit, nodes_docs, nodes_impl, nodes_ml, nodes_validation


def main() -> int:
    nodes: list[dict] = []
    nodes += nodes_docs.nodes()
    nodes += nodes_audit.nodes()
    nodes += nodes_ml.nodes()[:4]        # Wave 5: 4 RCA parallel nodes
    nodes += nodes_impl.nodes()          # Waves 6..11 + Phase 11 serial
    nodes += nodes_ml.nodes()[4:]        # Waves 12..14 serial ML training chain
    nodes += nodes_validation.nodes()

    # emit per-node files
    for n in nodes:
        emit_intent(n["id"], n["purpose_short"], n["nonneg"], n["owner_files"])
        emit_artifacts(n["id"], n["artifacts"])
        emit_prompt(
            n["id"], n["title"], n["purpose_short"],
            n["read_first"], n["scope_body"],
            validation_gate=n.get("validation_gate", ""),
        )

    emit_dag(nodes)
    print(f"generated {len(nodes)} nodes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
