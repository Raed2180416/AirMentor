import numpy as np
from interpret.glassbox import ExplainableBoostingClassifier

X = np.random.rand(100, 3)
y = np.random.randint(0, 2, 100)
ebm = ExplainableBoostingClassifier(interactions=1)
ebm.fit(X, y)

print("intercept:", ebm.intercept_)
for i, name in enumerate(ebm.term_names_):
    print(f"Term: {name}")
    print(f"  features: {ebm.term_features_[i]}")
    print(f"  scores shape: {np.array(ebm.term_scores_[i]).shape}")
    print(f"  bins len: {len(ebm.bins_[i])}")
    for j, b in enumerate(ebm.bins_[i]):
        if isinstance(b, dict):
            print(f"    bin {j} dict keys: {list(b.keys())}")
        else:
            print(f"    bin {j} array shape: {np.array(b).shape}")
