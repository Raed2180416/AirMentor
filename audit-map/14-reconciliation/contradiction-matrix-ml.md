# Contradiction Matrix ML

## Model vs Policy Conflation
- Prior state: Conflated model prediction with policy intervention.
- Resolution: Strict separation. Model outputs probs, policy dictates intervention logic.

## Simulator Scope
- Prior state: Simulator alters base weights.
- Resolution: Simulator restricted to counterfactual copy-on-write scope.

## Scoring Authority
- Prior state: Unclear authority between seeded and runtime.
- Resolution: Seeded authority handles init, runtime authority updates state.
