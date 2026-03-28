# AirMentor Non-Technical Explanation For Stakeholders

## What this area does
This document explains the product and the main audit conclusions in plain English for non-engineering stakeholders.

## Confirmed observations
- AirMentor is a two-part academic operations product.
- One part is for faculty using the teaching workspace.
- The other part is for system administrators managing the institution, records, policies, and requests.
- The product also includes an evidence-driven proof system that helps faculty understand student risk and intervention context.

## Key workflows and contracts
### What the app does
AirMentor helps an academic institution manage teaching operations, people, courses, and student progress in one system. It also provides a controlled “AI-like” layer that explains risk and intervention context to faculty using structured evidence.

### How it currently works at a high level
- Administrators set up faculties, departments, branches, batches, policies, faculty roles, student records, and course structures.
- Faculty log into the teaching workspace with role-specific views such as Course Leader, Mentor, or HoD.
- The proof system can generate or replay checkpoint-based views of student-risk and intervention evidence.
- Faculty then use screens such as the proof panel, risk explorer, and student shell to review that evidence.

## Findings
### What is strongest
- The product’s purpose is clear and specific.
- The system already models a large part of academic operations in a serious way.
- The proof feature is safer and more controlled than a typical chatbot or generic AI assistant.

### What is weakest
- The codebase is too concentrated in a few very large files.
- Some of the system’s visible behavior depends on hidden stored state, which can make screens feel inconsistent after reload or navigation.
- The proof platform is sophisticated, but the team does not yet have enough operational monitoring around it.

### Where users may struggle
- The admin workspace is powerful but information-dense.
- Role switching, scope selection, and proof checkpoint context can be mentally heavy.
- The request workflow is functional, but some actions require too much prior process knowledge.

### How the AI/ML part helps
- It helps faculty interpret structured student-risk signals.
- It adds evidence-backed context from curriculum, outcomes, assessment, and checkpoint history.
- It can compare current status with policy-based “no action” scenarios.

### Where the AI/ML part currently falls short
- It is not a general intelligent tutor or open-ended advisor.
- It is reliable mainly because it is tightly bounded and partly deterministic.
- The current architecture makes it harder than it should be to evolve and monitor this feature safely.

## Implications
- The most important improvements are not cosmetic. They are architectural and operational.
- If the team fixes those foundations, the product can become both easier to trust and easier to improve.

## Recommendations
1. Break the largest backend and frontend files into smaller responsibility-based modules.
2. Simplify how state is stored and restored so the app feels more predictable.
3. Add better monitoring for proof runs, student shell loads, and risk explorer behavior.
4. Improve admin and proof UX so users always know their current role, scope, and checkpoint context.
5. Clean out leftover mock and prototype artifacts so the codebase more clearly reflects the live product.

## Confirmed facts vs inference
### Confirmed facts
- The app already supports the admin, teaching, and proof workflows described above.
- The current verification baseline for tests and builds is green.

### Reasonable inference
- The product is already valuable, but its next level of maturity depends more on simplification and instrumentation than on adding more features quickly.

## Cross-links
- [00 Executive Summary](./00-executive-summary.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
