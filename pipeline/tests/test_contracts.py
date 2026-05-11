"""Tests for structured exit contract parser."""
from __future__ import annotations

from pipeline.orchestrator import contracts


GOOD = """
some log output
<<AIRMENTOR_PASS_RESULT>>
{
  "pass": "inventory-pass",
  "status": "completed",
  "artifacts": ["audit-map/32-reports/inventory-frontend.md"],
  "citations": ["src/App.tsx:1-120"],
  "intent_affirmed": true,
  "notes": "ok"
}
<<END>>
"""

BAD_STATUS = """
<<AIRMENTOR_PASS_RESULT>>
{"pass":"x","status":"partial","artifacts":[],"citations":[],"intent_affirmed":true,"notes":""}
<<END>>
"""

BAD_INTENT = """
<<AIRMENTOR_PASS_RESULT>>
{"pass":"x","status":"completed","artifacts":[],"citations":[],"intent_affirmed":false,"notes":""}
<<END>>
"""

MALFORMED = "no markers here"

# Identical-content duplication (round-6, 2026-04-22): this happens in
# practice when arctic's `run --format json` streams partial frames that
# each re-emit the growing assistant text (once per streaming event),
# plus the wrapper's post-run `arctic export` dump contains the same
# final message embedded as a JSON string. All copies carry the same
# marker content, so this should be accepted.
DUPLICATED_IDENTICAL = GOOD + "\n" + GOOD

# Divergent duplication: agent re-emitted the marker with different
# content (e.g. it corrected the artifacts path mid-session and re-emitted
# the canonical block at the end of its final message). Take the LAST
# well-formed copy — that's what the contract says ("emit at the bottom
# of your final message").
DIVERGENT_KEEPS_LAST = (
    GOOD
    + "\n<<AIRMENTOR_PASS_RESULT>>\n"
    + '{"pass":"inventory-pass","status":"completed","artifacts":["final-path.md"],'
    + '"citations":["src/App.tsx:1-120"],"intent_affirmed":true,"notes":"final"}'
    + "\n<<END>>\n"
)

# Template-echo (round-6): arctic session JSON dumps the user prompt
# which contains our example marker with placeholders. The parser must
# ignore these and only accept the agent's real emission.
PROMPT_ECHO_THEN_REAL = (
    """
{"type":"user-message","text":"...please end with:\\n<<AIRMENTOR_PASS_RESULT>>\\n{\\n  \\"pass\\": \\"inventory-pass\\",\\n  \\"status\\": \\"completed\\",\\n  \\"artifacts\\": [\\"<absolute or repo-relative paths you wrote>\\"],\\n  \\"citations\\": [\\"<file:line or file:start-end references you relied on>\\"],\\n  \\"intent_affirmed\\": true,\\n  \\"notes\\": \\"<one concise human line; no secrets>\\"\\n}\\n<<END>>"}
"""
    + GOOD
)


def test_parse_good():
    r = contracts.parse_result(GOOD)
    assert r is not None
    assert r.status == "completed"
    assert r.intent_affirmed
    assert r.ok()


def test_parse_bad_status():
    r = contracts.parse_result(BAD_STATUS)
    assert r is not None
    assert not r.ok()


def test_parse_bad_intent():
    r = contracts.parse_result(BAD_INTENT)
    assert r is not None
    assert not r.ok()


def test_parse_malformed():
    assert contracts.parse_result(MALFORMED) is None


def test_parse_identical_duplicates_accepted():
    """Same marker content repeated (e.g. arctic streaming frames) is OK."""
    r = contracts.parse_result(DUPLICATED_IDENTICAL)
    assert r is not None
    assert r.ok()


def test_parse_divergent_duplicates_keeps_last():
    """Two markers with differing content → take the last (final) copy.

    Reasoning: the contract says "emit the block at the bottom of your
    final message", so any earlier marker is a draft/streaming-frame
    intermediate; the final one is authoritative.
    """
    r = contracts.parse_result(DIVERGENT_KEEPS_LAST)
    assert r is not None
    assert r.ok()
    assert r.artifacts == ["final-path.md"]
    assert r.notes == "final"


def test_parse_ignores_prompt_template_echo():
    """Marker with placeholder fields (prompt template echoed back in
    arctic session JSON) must be ignored, real marker accepted."""
    r = contracts.parse_result(PROMPT_ECHO_THEN_REAL)
    assert r is not None, "real marker after template echo must still parse"
    assert r.ok()


def test_prompt_contract_mentions_markers():
    txt = contracts.render_prompt_contract("test-pass")
    assert "<<AIRMENTOR_PASS_RESULT>>" in txt
    assert "<<END>>" in txt
    assert "test-pass" in txt
