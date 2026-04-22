# Contradiction Matrix ML

## Model vs Policy Conflation
- Prior state: Conflated model prediction with policy intervention.
- Resolution: Strict separation. Model outputs probs, policy dictates intervention logic.
- Cites: `air-mentor-api/src/lib/proof-risk-model.ts:16-19`

## Simulator Scope
- Prior state: Simulator alters base weights.
- Resolution: Simulator restricted to counterfactual copy-on-write scope.
- Cites: `air-mentor-api/src/lib/proof-risk-model.ts:390-399`

## Scoring Authority
- Prior state: Unclear authority between seeded and runtime.
- Resolution: Seeded authority handles init, runtime authority updates state.
- Cites: `air-mentor-api/src/lib/proof-risk-model.ts:584-592`
