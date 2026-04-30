# 01 — Literature Table

> Phase: P1 (Literature Foundation)
> Companion: `docs/references.bib`, `docs/paper-evidence/scenario-grounding.md`
> Date: 2026-05-01

This table is the audit trail for every magic number in
`air-mentor-api/src/lib/inference-engine.ts` (driver impacts, baselines,
band thresholds), `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
(weakCO threshold, scenario family shifts), and the assessment-pass
thresholds. Each row classifies the source as `literature` (peer-reviewed
study), `institutional` (MSRUAS academic regulation or industry default
disclosed in the paper), or `engineering` (heuristic chosen for
calibration with no external anchor — must be disclosed in
paper Limitations).

For each `literature` row, the BibTeX key matches `docs/references.bib`.

---

## Section A — Inference engine driver impacts (`inference-engine.ts:39-191`)

| Constant | Code site | Source class | Citation | Justification |
|---|---|---|---|---|
| Attendance below high-risk → +0.28 | `inference-engine.ts:45` | literature | `crede2010class`, `marburger2001absenteeism` | Credé et al. meta-analysis (k=69, N=21,195) reports ρ=0.44 between class attendance and grades and ρ=0.41 with GPA. Attendance is the single strongest known predictor of college performance, exceeding standardised admissions tests. We weight it as the largest single driver in the heuristic. |
| Attendance below medium-risk → +0.14 | `inference-engine.ts:51` | literature | `crede2010class` | Same study; the smaller bump reflects the within-population gradient: each additional 10% absence corresponds to a fractional grade drop in the meta-analysis. We use exactly half the high-risk impact to encode "monotone but not linear escalation" — engineering choice on the half-step, literature on the existence of the gradient. |
| CGPA below high-risk → +0.20 | `inference-engine.ts:59` | institutional + literature | `tinto1993leaving`, `astin1984student` | Tinto frames cumulative academic standing as the dominant measurable component of "academic integration"; Astin treats persistent low engagement as a developmental risk. The exact 0.20 magnitude is institutional (MSRUAS treats CGPA < 5.0 as the academic-warning trigger). |
| CGPA below medium-risk → +0.10 | `inference-engine.ts:65` | institutional | — | MSRUAS CGPA-watch policy. Half-step of the high-risk impact, same engineering rationale as attendance. |
| Backlog count high → +0.18 | `inference-engine.ts:73` | literature | `tinto1993leaving`, `bean2001psychology` | Carryover backlogs operationalise Tinto's "cumulative cascade" and Bean-Eaton's "psychological barriers": each unresolved backlog raises the probability of further failure by stretching attention and confidence. |
| Backlog count medium → +0.09 | `inference-engine.ts:79` | institutional | — | MSRUAS policy threshold (≥1 active backlog triggers watch); half-step of high-risk. |
| TT1/TT2/SEE % < 40 → +0.16 | `inference-engine.ts:91-94` | institutional | — | MSRUAS pass-mark for term tests is 50% (tt1/tt2) and 35% (SEE); 40% is the operational watch line used by faculty. We treat "very low" as 5–10 points below pass on either side, depending on assessment. **No literature anchor.** Disclose in paper Limitations. |
| TT1/TT2/SEE % < 55 → +0.08 | `inference-engine.ts:97-100` | institutional | — | Same as above; 55% reflects the institutional "comfortable pass" boundary. |
| Attendance-history risk count ≥ 2 → +0.08 | `inference-engine.ts:106-110` | literature | `crede2010class` | The repeated-low-attendance signal compounds the Credé attendance-grade relationship over multiple checkpoints. Magnitude is engineering. |
| Question weakness count ≥ 4 → +0.09 | `inference-engine.ts:114-118` | literature | `corbett1995knowledge`, `anderson1996actr` | Knowledge-tracing tradition (Corbett & Anderson) uses fine-grained question-level evidence as primary signal of mastery deficiency. The threshold and exact +0.09 magnitude are engineering. |
| Question weakness count ≥ 2 → +0.05 | `inference-engine.ts:121-124` | engineering | — | Half-step of above; no direct anchor. |
| Quiz % < 45 → +0.06 | `inference-engine.ts:128-132` | institutional | — | MSRUAS internal-evidence convention. |
| Assignment % < 45 → +0.06 | `inference-engine.ts:136-140` | institutional | — | Same. |
| Weak CO count ≥ 2 → +0.10 | `inference-engine.ts:144-148` | literature | `corbett1995knowledge`, `anderson1996actr` | Mastery framework: multiple unmet outcomes signal cumulative skill gap. Magnitude engineering. |
| Weak CO count = 1 → +0.05 | `inference-engine.ts:150-154` | engineering | — | Half-step. |
| Intervention response < −0.05 → +0.08 | `inference-engine.ts:158-162` | literature | `bean2001psychology`, `tinto1993leaving` | "Lack of response after support" matches Bean-Eaton psychological-barrier theory and Tinto's "academic integration failure under intervention". Magnitude engineering. |
| Intervention response > 0.08 → −0.05 | `inference-engine.ts:164-168` | engineering | — | Negative driver acknowledges recovery. No direct empirical anchor for the magnitude; calibrated against synthetic corpus only. |
| Baseline risk = 0.08 | `inference-engine.ts:177` | engineering | — | Population prior for the heuristic so a "no signals fired" student is still slightly above zero. **Disclose in paper Limitations.** |
| Band thresholds: ≥0.7 High, ≥0.35 Medium | `inference-engine.ts:180` | engineering | — | No literature support for these specific cuts. Operator-tunable per `audit-map/08-ml-audit/01-observable-risk-heuristic-fallback.md` GAP-6 (deferred). **Disclose in paper Limitations and as future work P3.** |
| Driver clamp [0.05, 0.95] | `inference-engine.ts:179` | engineering | — | Numerical-stability clamp. Disclose. |

### Summary of source-class distribution, Section A

```
literature   :  8 / 19 rows (≈42%)
institutional:  5 / 19 rows (≈26%)
engineering  :  6 / 19 rows (≈32%)
```

The engineering tier is the honest exposure surface for the paper
Limitations section. The institutional tier is defensible if the paper
states "we use the institutional thresholds of the demonstration site
(MSRUAS undergraduate regulations)".

---

## Section B — Scenario engine family shifts (`msruas-proof-control-plane.ts:988-1036`)

Each family's specific magnitudes are broken out further in
`docs/paper-evidence/scenario-grounding.md`. Summary class:

| Family | Source class | Citation | Brief justification |
|---|---|---|---|
| weak-foundation | literature | `tinto1975dropout`, `tinto1993leaving` | Academic-integration failure; weak prior preparation. |
| low-attendance | literature | `crede2010class`, `marburger2001absenteeism` | Direct attendance-grade relationship, ρ=0.41. |
| high-forgetting | literature | `cepeda2006spacing`, `pashler2007organizing`, `murre2015replication` | Spacing/forgetting-curve literature. |
| coursework-inflation | literature | `astin1984student` | Involvement overload — too many active demands degrade quality of involvement. |
| exam-fragility | literature | `zeidner1998test` | Test anxiety reduces performance under high-stakes exam pressure. |
| carryover-heavy | literature | `tinto1993leaving`, `bean2001psychology` | Cumulative backlog cascade; psychological barriers compound. |
| intervention-resistant | literature | `bean2001psychology` | Psychological-barrier theory: intervention non-response. |
| balanced | engineering | — | Null/control family. Disclose. |

7 of 8 scenario families have a literature anchor; "balanced" is a
deliberate null. The exact magnitude of each shift (e.g.
`sectionAbilityShift = -0.09` for weak-foundation) is
engineering-tier and is calibrated to make the synthetic corpus
discriminable. This will be the lever for the P2 sensitivity sweep.

---

## Section C — Curriculum and mastery thresholds

| Constant | Code site | Source class | Citation | Justification |
|---|---|---|---|---|
| weakCO threshold: `tt2Pct < 50 OR seePct < 45` | `msruas-proof-control-plane.ts:1286` | institutional | — | MSRUAS academic regulation: pass at 50% TT, 35% SEE; 45% is operational support threshold. **P3 task 3.3 will replace this with `mastery < target * 0.85` parameterised by Bloom level.** |
| Pass mark TT1/TT2 = 50% | implicit | institutional | — | MSRUAS regulation. |
| Pass mark SEE = 35% / watch 45% | implicit | institutional | — | MSRUAS regulation. |
| Default Bloom→target mapping (P3) | `msruas-proof-control-plane.ts:1068-1077` (post-P3) | literature | `corbett1995knowledge`, `anderson1996actr` | Bloom-derived targets: remember/understand 0.50, apply 0.60, analyze 0.70, evaluate 0.80, create 0.90 — magnitudes are engineering, framework anchored. Disclose in paper. |

---

## Section D — EDM positioning citations

These are not parameters; they back the framing in the paper Introduction
and Related Work.

| Topic | Citation | Used in |
|---|---|---|
| EDM survey (modern) | `romero2020educational` | Intro, Related Work |
| EDM survey (foundational) | `romero2010data` | Related Work |
| EDM higher-education review | `aldowah2019educational` | Related Work |
| Imbalanced student-grade prediction | `bujang2021imbalanced` | Methods (label imbalance disclosure) |
| Multi-context / individualised BKT | `yudelson2013individualized` | N2 framing |
| Transfer fairness in KT | `doroudi2019fairer` | N2 caveats / Limitations |
| ASSISTments multi-context platform | `heffernan2014assistments` | Discussion (transfer precedent) |

---

## Outstanding holes — to be addressed before P10

1. **Engineering-tier rows must surface in paper Limitations.** Six rows
   in Section A and one each in B and C are engineering-only. The paper
   draft (P10) must include a single subsection that lists these
   verbatim and explains why they are calibrated rather than cited.
2. **Institutional rows need a one-paragraph footnote** in the paper
   Methods describing MSRUAS regulations (provided by the demonstration
   site).
3. **Section B magnitudes** are engineering-tier and are exactly what
   P2 sensitivity sweep (task 2.3) varies ±20% — that sweep is the
   defence for those magnitudes.
4. **No real-data validation** — P10 Limitations will state this in the
   first paragraph (per `docs/POSITIONING.md` recommended option A).

---

## Reproduction note

To regenerate the impact constants used in this table, read
`air-mentor-api/src/lib/learning-dynamics-constants.ts` (created in
P1.2). Each constant in that file carries a JSDoc `@bib` tag whose value
matches a key in `docs/references.bib`. The constants module is the
single ground truth; this table is a pivot of it.
