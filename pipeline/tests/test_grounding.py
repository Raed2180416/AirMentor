"""Tests for citation grounding probe."""
from __future__ import annotations

from pipeline.orchestrator import grounding


def test_extract_citations_from_text():
    text = """
    See src/App.tsx:123 and also tests/foo.test.ts:45-67 for details.
    Nothing here: just words with a colon: value.
    """
    cites = grounding.extract_citations_from_text(text)
    assert "src/App.tsx:123" in cites
    assert any(c.startswith("tests/foo.test.ts:") for c in cites)
    # dedup sanity
    assert len(cites) == len(set(cites))


def test_probe_nonexistent_file():
    r = grounding.probe_citation("nonexistent/file.ts:10")
    assert r.exists_on_disk is False
    assert r.lines_valid is False
    assert not r.ok


def test_probe_existing_file(tmp_path, monkeypatch):
    # create a real file inside REPO_ROOT temporarily
    target = grounding.REPO_ROOT / "pipeline" / "tests" / "_fixture.txt"
    target.write_text("line1\nline2\nline3\n", encoding="utf-8")
    try:
        r = grounding.probe_citation("pipeline/tests/_fixture.txt:2")
        assert r.exists_on_disk is True
        assert r.lines_valid is True
        r2 = grounding.probe_citation("pipeline/tests/_fixture.txt:999")
        assert r2.exists_on_disk is True
        assert r2.lines_valid is False
    finally:
        target.unlink(missing_ok=True)


def test_probe_all_filters_failures():
    probes = grounding.probe_all([
        "nope/a.ts:1",
        "nope/b.ts:1",
    ])
    assert len(probes) == 2
    assert all(not p.ok for p in probes)
    assert len(grounding.failing(probes)) == 2
