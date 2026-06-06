# Runtime Model Contract

This directory contains the smallest governed model artifact set required to
seed and verify the AirMentor runtime without retraining.

`proof-risk-model/risk-model-bundle.json` is the active bundle. Its raw
production label is interpreted together with
`proof-risk-model/promotion-decision.json`; the current decision keeps the
CatBoost challenger in shadow mode and serves the logistic contract.

Generated evaluations, training corpora, challenger binaries, and historical
runs belong under ignored `output/` directories or the verified external model
vault. They must not be copied back into Git.

Set `AIRMENTOR_RISK_MODEL_BUNDLE_PATH` to test an explicit replacement bundle.
Keep its adjacent `promotion-decision.json` with it so serving cannot mistake a
shadow challenger for a promoted production model.
