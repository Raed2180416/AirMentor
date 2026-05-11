"""Exhaustive routing matrix.

For every (provider, task_class) pair in the catalog, pin the expected
(model, effort). This test is the contract: changing it requires a
deliberate policy edit, not an accidental drift in pick_model scoring.

Costs zero tokens — every assertion is pure Python on the in-memory DB.
"""
from __future__ import annotations

import pytest

from pipeline.orchestrator import db, router


# Hard-coded contract. Format:
#   (provider, task_class) -> (expected_model, expected_effort)
# Effort must honor EFFORT_FLOOR pins (opus-4.7 → max, etc).
EXPECTED: dict[tuple[str, str], tuple[str, str]] = {
    # ----- github-copilot (richest catalog) -----
    # bookkeeping: fast tier, cheapest ties → claude-haiku-4.5 (alpha first at q6/c2)
    ("github-copilot", "bookkeeping"):   ("claude-haiku-4.5",       "low"),
    ("github-copilot", "recovery"):      ("claude-haiku-4.5",       "low"),
    # orchestration: strong tier first. gemini-3.1-pro-preview sits in TOP
    # tier (round-6 fix), so strong tier resolves to claude-sonnet-4.6 (q8)
    # ahead of gemini-3-pro-preview / claude-sonnet-4.5 (q7).
    ("github-copilot", "orchestration"): ("claude-sonnet-4.6",      "medium"),
    # structured: code-top first → gpt-5.3-codex (q9) + xhigh floor
    ("github-copilot", "structured"):    ("gpt-5.3-codex",          "xhigh"),
    # high-stakes: top tier → gemini-3.1-pro-preview (q9). Round-6 fix
    # (2026-04-22): gpt-5.4 and both opus variants rejected live on 2/3
    # copilot accounts; gemini is the only model verified callable across
    # every copilot slot (matches slot-map.tsv execution_model).
    ("github-copilot", "high-stakes"):   ("gemini-3.1-pro-preview", "xhigh"),

    # ----- native-codex (direct OpenAI) -----
    # bookkeeping: fast tier, alpha tie → gpt-5.3-codex-mini beats gpt-5.4-mini
    ("native-codex", "bookkeeping"):     ("gpt-5.3-codex-mini",     "low"),
    ("native-codex", "recovery"):        ("gpt-5.3-codex-mini",     "low"),
    # orchestration: strong tier → gpt-5.4 (best q9)
    ("native-codex", "orchestration"):   ("gpt-5.4",                "medium"),
    # structured: code-top → gpt-5.3-codex. Floor bumps to xhigh globally.
    ("native-codex", "structured"):      ("gpt-5.3-codex",          "xhigh"),
    ("native-codex", "high-stakes"):     ("gpt-5.3-codex",          "xhigh"),

    # ----- codex (arctic-wrapped) -----
    ("codex", "bookkeeping"):            ("gpt-5.1-codex-mini",     "low"),
    ("codex", "recovery"):               ("gpt-5.1-codex-mini",     "low"),
    ("codex", "orchestration"):          ("gpt-5.4",                "medium"),
    ("codex", "structured"):             ("gpt-5.3-codex",          "xhigh"),
    ("codex", "high-stakes"):            ("gpt-5.3-codex",          "xhigh"),

    # ----- anthropic (claude CLI direct, dash-name variants) -----
    # User intent 2026-04-22: Anthropic OAuth credits are VERY LIMITED.
    # opus-4-6 is bumped to cost=11 so it NEVER auto-picks (still reachable
    # via explicit `requested_model` pin). All sonnet calls run at max
    # reasoning/thinking (floor="max") so scarce credits are high-yield.
    ("anthropic", "bookkeeping"):        ("claude-haiku-4-5",       "low"),
    ("anthropic", "recovery"):           ("claude-haiku-4-5",       "low"),
    ("anthropic", "orchestration"):      ("claude-sonnet-4-6",      "max"),
    ("anthropic", "structured"):         ("claude-sonnet-4-6",      "max"),
    # high-stakes: opus-4-6 excluded by cost=11 > max_cost=10 → strong tier
    # wins → sonnet-4-6 at max reasoning/thinking.
    ("anthropic", "high-stakes"):        ("claude-sonnet-4-6",      "max"),

    # ----- antigravity (9 accounts — gemini/opus) -----
    ("antigravity", "bookkeeping"):      ("gemini-3-flash",         "low"),
    ("antigravity", "recovery"):         ("gemini-3-flash",         "low"),
    ("antigravity", "orchestration"):    ("gemini-3.1-pro-preview", "medium"),
    ("antigravity", "structured"):       ("gemini-3.1-pro-preview", "medium"),
    ("antigravity", "high-stakes"):      ("claude-opus-4.6",        "xhigh"),

    # ----- google (gemini catalog) -----
    # bookkeeping: fast tier, min_q=5 excludes 2.5-flash-lite(q4);
    # alpha tiebreak picks gemini-2.5-flash over gemini-3-flash-preview
    ("google", "bookkeeping"):           ("gemini-2.5-flash",       "low"),
    ("google", "recovery"):              ("gemini-2.5-flash",       "low"),
    ("google", "orchestration"):         ("gemini-3.1-pro-preview", "medium"),
    ("google", "structured"):            ("gemini-3.1-pro-preview", "medium"),
    ("google", "high-stakes"):           ("gemini-3.1-pro-preview", "xhigh"),

    # ----- opencode / openrouter (FREE-ONLY last-resort fallback) -----
    # User intent 2026-04-22: "i don't trust openrouter free for coding".
    # All opencode models are tier="fast" with reduced quality (q ≤ 7) so the
    # structured/high-stakes prefer-lists ("code-top"/"strong"/"top") do NOT
    # reach them in Pass 1. They only become eligible via:
    #   * bookkeeping / recovery / orchestration (fast tier in prefer-list), or
    #   * Pass 2 relax (any-tier, min_quality met) when no preferred match, or
    #   * Pass 3 absolute-best fallback when nothing else qualifies.
    # qwen3-coder:free (q=7) is the best of the lot and wins all 5 classes
    # for opencode. In practice opencode is only reached when the entire
    # arctic fleet is exhausted (opencode has the lowest PROVIDER_PRIORITY).
    ("opencode", "bookkeeping"):         ("openrouter/qwen/qwen3-coder:free", "low"),
    ("opencode", "recovery"):            ("openrouter/qwen/qwen3-coder:free", "low"),
    ("opencode", "orchestration"):       ("openrouter/qwen/qwen3-coder:free", "medium"),
    # structured min_q=7 → qwen3-coder (q=7) qualifies via Pass 2 relax
    ("opencode", "structured"):          ("openrouter/qwen/qwen3-coder:free", "medium"),
    # high-stakes min_q=8 → no opencode model qualifies; Pass 3 absolute-best
    # fallback picks qwen3-coder (highest q=7). xhigh is class default.
    ("opencode", "high-stakes"):         ("openrouter/qwen/qwen3-coder:free", "xhigh"),

    # ----- windsurf (manual-only in rotation, but catalog picks opus-4.7) -----
    ("windsurf", "high-stakes"):         ("claude-opus-4.7",        "max"),
    ("windsurf", "structured"):          ("claude-opus-4.7",        "max"),

    # ----- oss-local (alpha tiebreak at q7/c0 → deepseek-coder-v2 first) -----
    ("oss-local", "bookkeeping"):        ("deepseek-coder-v2",      "low"),
    ("oss-local", "structured"):         ("llama-3.1-70b-instruct", "medium"),
    ("oss-local", "high-stakes"):        ("deepseek-coder-v2",      "xhigh"),
}


@pytest.mark.parametrize("key,expected", EXPECTED.items())
def test_route_matrix(key, expected):
    provider, task_class = key
    model, effort = expected
    picked_model = router.pick_model(provider, task_class)
    picked_effort = router.pick_effort(task_class, provider, picked_model)
    assert picked_model == model, (
        f"{provider}/{task_class} expected model={model} got {picked_model}"
    )
    assert picked_effort == effort, (
        f"{provider}/{task_class} expected effort={effort} got {picked_effort}"
    )


def test_requested_model_honored_when_supported():
    # user passes requested_model — if in catalog, router honors it verbatim.
    # gemini-3.1-pro-preview is the copilot top-tier model as of round-6
    # (2026-04-22): gpt-5.4 demoted to fast tier after live rejections,
    # both opus variants removed. Test pin-honoring still works for any
    # catalog entry including now-demoted gpt-5.4 (still reachable by pin).
    assert router.pick_model("github-copilot", "bookkeeping",
                             requested_model="gpt-5.4") == "gpt-5.4"
    # And the effort floor still fires for bookkeeping (low).
    assert router.pick_effort("bookkeeping", "github-copilot",
                              "gpt-5.4") == "low"


def test_requested_model_unavailable_falls_back():
    # requesting a model the provider doesn't expose → router ignores request,
    # picks best-in-catalog. opus-4-6 has cost=11 (credit-scarcity guard)
    # which exceeds high-stakes max_cost=10, so the router falls through
    # to strong tier → sonnet-4-6.
    picked = router.pick_model("anthropic", "high-stakes",
                               requested_model="gpt-5.3-codex")
    assert picked == "claude-sonnet-4-6"


def test_unknown_provider_returns_auto_or_requested():
    # catalog miss → return requested or "auto"
    assert router.pick_model("nonexistent-provider", "structured") == "auto"
    assert router.pick_model("nonexistent-provider", "structured",
                             requested_model="custom-model") == "custom-model"


def test_every_provider_has_entry_in_expected_matrix():
    """Guard: if MODEL_CATALOG gains a new provider, matrix must cover it."""
    matrix_providers = {p for (p, _c) in EXPECTED.keys()}
    # local-dry is a test-only stub, exempt from policy matrix.
    expected_providers = set(router.MODEL_CATALOG.keys()) - {"local-dry"}
    missing = expected_providers - matrix_providers
    assert not missing, f"providers without matrix coverage: {missing}"


def test_class_tiers_have_complete_coverage():
    """Every task class in EFFORT_BY_CLASS must also be in CLASS_TIERS."""
    classes_in_effort = set(router.EFFORT_BY_CLASS.keys())
    classes_in_tiers = set(router.CLASS_TIERS.keys())
    assert classes_in_effort == classes_in_tiers, (
        f"mismatch: effort-only={classes_in_effort - classes_in_tiers} "
        f"tiers-only={classes_in_tiers - classes_in_effort}"
    )
