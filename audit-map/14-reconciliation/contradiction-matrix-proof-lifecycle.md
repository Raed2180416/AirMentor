# Contradiction Matrix: Proof Lifecycle

| Feature | Doc Claim | Code Reality | Verdict |
|---------|-----------|--------------|---------|
| Activation | Fluid transition | Strict state machine in `proof-control-plane-activation-service.ts` | Code wins |
| Completion | `stopped` == `completed` | `stopped` != `completed-inspectable` (immutable) | Code wins |
| Reset | Reset always full | `reset-current-stage` is partial, `complete-reset` is full | Code wins |
| Date Authority | Client can suggest | Server dictates `proof-control-plane-activation-service.ts` | Code wins |
| Semester Bound | Seamless advance | Hard stop in `proof-control-plane-seeded-semester-service.ts` | Code wins |

## Analysis
The documentation currently underestimates the rigidity of the proof control plane. The state machine (setup-draft -> active-run -> completed-inspectable/stopped) is strictly enforced by the backend services. The distinction between a completed run (which is inspectable but immutable) and a stopped run (which was interrupted) is critical for proper resumption or retrospective analysis. Reset semantics also need clearer documentation, distinguishing between retrying a stage and aborting a run. Finally, semester boundaries are hard stops requiring explicit activation of the new context, contrary to the idea of an automatic, seamless advance.
