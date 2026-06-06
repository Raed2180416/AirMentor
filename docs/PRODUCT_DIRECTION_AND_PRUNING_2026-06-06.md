# Product Direction And Pruning

**Decision date:** 2026-06-06
**Status:** Authoritative product and repository direction

## Executive Decision

AirMentor should become a deterministic academic decision-rehearsal platform,
not a generic SIS and not a production ML prediction product.

The valuable product is the closed, inspectable loop:

`program configuration -> synthetic evidence -> stage-aware risk -> human review -> intervention rehearsal -> audited outcome`

The repository grew because it attempted to become three products at once:

1. a simulation and research platform;
2. an academic operations suite;
3. an ML experimentation laboratory.

Only the first is currently defensible. The useful parts of the second should
remain as role-specific lenses over the simulation. The third should remain an
offline research capability, not shape the runtime or repository.

## User Job

When an academic program team is considering curriculum, assessment, or support
policy changes, they need to rehearse likely operational consequences before
touching real students, so they can identify weak assumptions, overloaded
queues, policy conflicts, and evidence gaps.

## Core Product Outcomes

The product is successful when a user can:

1. configure one program without editing source constants;
2. reproduce the same scenario and evidence from the same inputs;
3. explain every risk change using evidence visible at that stage;
4. see the same checkpoint truth across admin, course leader, mentor, HoD, and
   student-facing surfaces;
5. record what a human decided and what the simulator predicts next;
6. export the assumptions, evidence, caveats, and results as one reviewable pack.

## Keep And Invest

### Deterministic simulation kernel

Keep stage realization, curriculum dependency effects, policy floors, backlog
progression, intervention timing, and reproducible seeds. This is the product's
hardest-to-copy asset.

### Governed program configuration

Keep curriculum graph authoring, assessment templates, policy configuration,
and versioned publication. Reduce visual experimentation and prioritize a
stable configuration contract.

### Proof playback and cross-role parity

Keep shared checkpoint playback, risk explorer, faculty and mentor views, HoD
analytics, and student evidence views where they expose the same underlying
state. The latest shared-playback and teacher-surface work directly strengthens
the product.

### Traceability and claim boundaries

Keep model governance, feature schema checks, causal-language tests, evidence
provenance, and synthetic-only disclosure. These prevent the demo from claiming
more than the evidence supports.

### Compact runtime model contract

Keep the governed logistic runtime and compact challenger artifacts needed for
shadow comparison. Preserve training corpora externally with manifests and
checksums.

## Maintain But Do Not Expand

### Academic operations surfaces

Hierarchy, faculty assignment, attendance, marks, calendar, requests, and
history should only receive work required to configure or observe a scenario.
Do not pursue broad SIS completeness, billing, admissions, HR, or generalized
workflow automation.

### Student agent shell

Keep it only as a deterministic explanation and evidence-navigation surface.
Do not turn it into an open-ended LLM assistant until the decision model and
pilot workflow are validated.

### Curriculum graph visualization

Keep the integrated graph because curriculum structure affects simulation.
Remove duplicate standalone demos and avoid further visual-engine work unless
users cannot complete configuration.

### ML training scripts

Keep the scripts needed to reproduce governed research. Run them offline and
store outputs outside Git. Do not expose retraining or automatic promotion as a
product feature.

## Archive Or Remove

The following are not part of the active product:

- duplicate standalone curriculum applications;
- the separate Python teacher CLI that duplicated production policy and drifted
  from runtime thresholds;
- model-zoo experiments and repeated benchmark directories;
- generated corpora, embedded databases, Playwright recordings, logs, and
  screenshots in Git;
- agent transcripts, provider-routing machinery, checkpoint queues, and
  historical handoff documents;
- one-off root patch, query, test, and migration-repair scripts;
- superseded guided-demo panels when the real role workflow already demonstrates
  the same loop;
- old branch snapshots after a verified all-refs bundle exists.

## Explicitly Deferred

Do not build these next:

- a second university or an `IITB` stub merely to claim generality;
- real-student predictive serving before a governed data partnership;
- automatic model retraining or challenger promotion;
- a provost ROI dashboard based on simulated retention value;
- a general multi-tenant SIS;
- a broad clean-architecture rewrite;
- another deployment-platform migration without an operational need.

## Next Three Product Bets

### 1. One real runtime template contract

Replace hardcoded M&C identifiers through one narrow vertical slice. The same
template must drive seed creation, curriculum, faculty, students, checkpoints,
and role views. Only then consider a second synthetic program.

### 2. Decision and intervention audit trail

Make each risk review answer: what evidence was visible, what policy applied,
what the human decided, what changed next, and which claims remain simulated.
This is more valuable than adding another model family.

### 3. Pilot evidence export

Produce a compact scenario dossier containing configuration, seed, feature
contract, stage summaries, queue load, intervention assumptions, fairness
checks, and caveats. This is the bridge from demo to a serious pilot
conversation.

## Architecture Direction

The target architecture is directionally useful but its eight-week migration
should not be executed as a standalone rewrite.

Use extraction on contact:

- introduce a pure domain contract when changing grading, policy, risk, or
  curriculum behavior;
- extract one application service when changing a route with direct database
  orchestration;
- extract one UI component when changing a large panel;
- add a boundary test with each extraction.

The immediate architectural priority is not folder shape. It is removing the
runtime dependence on hardcoded program constants and ephemeral output files.

## Repository Retention Policy

### Git

Git contains source, migrations, tests, compact fixtures, active documentation,
and compact runtime model artifacts only.

### External archive

Training corpora, historical models, database snapshots, evidence packs, and
full Git bundles live under `/home/raed/Archives` with:

- a content manifest;
- an archive SHA-256;
- source-file hashes where retraining depends on exact bytes.

### Generated runs

Keep at most:

- the current runtime artifact;
- the last promoted research run;
- the latest failed or shadow run needed for comparison.

Everything else is deleted after archival.

### Documentation

Keep one current positioning document, one current product-direction document,
one system map, one target architecture, one realism audit, and bounded
paper/readiness evidence. Historical plans and handoffs belong in the archive,
not the active repository.

### Scratch work

Scratch scripts must live outside tracked source or under an ignored scratch
directory. A scratch script becomes durable only when it has a stable command,
owner, test, and documented purpose.

## Feature Admission Test

Before adding a feature, all answers must be yes:

1. Does it improve scenario configuration, deterministic simulation, decision
   traceability, cross-role review, or evidence export?
2. Can its claim be supported without real-student data?
3. Is there a simpler existing surface that should absorb it?
4. Can it be tested without committing generated databases or output packs?
5. Will we still want to maintain it after the current demo?

If any answer is no, defer or reject the feature.

## Preservation Record

The June 6 cleanup preserved the pre-cleanup state in:

- `/home/raed/Archives/airmentor-source-snapshot/2026-06-06`
- `/home/raed/Archives/airmentor-model-vault/2026-06-06`
- `/home/raed/Archives/airmentor-training-corpora/2026-06-06`
- `/home/raed/Archives/airmentor-git-bundle/2026-06-06`
- `/home/raed/Archives/airmentor-research-evidence/2026-06-06`
- `/home/raed/Archives/airmentor-local-db/2026-06-06`
- `/home/raed/Archives/airmentor-historical-model-runs/2026-06-06`

This permits aggressive cleanup without requiring model retraining or losing
the historical source/ref graph.
