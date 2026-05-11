# Paper Evidence

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` §6.3 and Group E.
> Every quantitative or methodological claim in the paper must be backed by a
> committed file in this directory. Plot scripts live in
> `scripts/paper-figures/` (created in P10), output PDFs in `paper/figures/`.

---

## Index (filled as phases land)

| File | Phase that produces it | Paper section it backs |
|---|---|---|
| `01-literature-table.md` | P1 | Methods · Parameter Grounding |
| `scenario-grounding.md` | P1 | Methods · Scenario Engine |
| `02-validation-protocol.md` | P2 | Experiments · Validation |
| `03-baseline-results.md` | P2 | Experiments · Baselines |
| `04-sensitivity-analysis.md` | P2 | Experiments · Sensitivity |
| `05-multi-program-evidence.md` | P6 | Experiments · Transfer |
| `06-recalibration-results.md` | P7 | Experiments · Recalibration |
| `methods-section-draft.md` | P10 | Methods §full draft |

---

## Rules

1. Every plot or table in the paper has a generation script committed under
   `scripts/paper-figures/` and a corresponding evidence file here that names
   the input data, the seed, and the date generated.
2. Every constant cited in the paper traces to a file in this directory or to
   `docs/references.bib`. No bare numbers in the paper without a footnote.
3. Limitations claimed in the paper (synthetic-only, single-institution,
   undergrad-only, rule-based inference paths) trace back to specific
   sections of `docs/POSITIONING.md` and the relevant evidence file.
4. Internal review pass (P10 task 10.5) verifies (1)–(3) end-to-end before
   submission.
