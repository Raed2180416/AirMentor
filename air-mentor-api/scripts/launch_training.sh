#!/bin/bash
# AirMentor SOTA Training Launcher
# Run this to retrain the ML model with fixed generator labels

set -e

echo "=========================================="
echo "AirMentor SOTA Model Retraining"
echo "=========================================="

REPO_ROOT="/home/raed/Projects/air-mentor-ui/air-mentor-api"
PYTHON="$REPO_ROOT/.venv/bin/python"

cd "$REPO_ROOT"

# Verify Python and deps exist
echo "Checking Python environment..."
if [ ! -f "$PYTHON" ]; then
    echo "ERROR: .venv Python not found at $PYTHON"
    echo "Run: cd $REPO_ROOT && uv venv"
    exit 1
fi

# Check core deps
$PYTHON -c "import numpy, pandas, sklearn, xgboost, lightgbm, catboost; print('All ML deps available')" || {
    echo "ERROR: Missing Python ML dependencies"
    echo "Install: cd $REPO_ROOT && .venv/bin/pip install numpy pandas scikit-learn xgboost lightgbm catboost"
    exit 1
}

echo "Python: $($PYTHON --version)"
echo "Repo: $REPO_ROOT"
echo ""

# Run the full benchmark
echo "Starting full SOTA policy benchmark..."
echo "This will:"
echo "  1. Generate fresh synthetic data with fixed labels (~14-16% at-risk)"
echo "  2. Validate feature contract and temporal leakage"
echo "  3. Train per-head ensemble (XGB + LGBM + CatBoost + meta-learner)"
echo "  4. Run shadow benchmarks (AutoGluon, TabPFN, PyTabKit)"
echo "  5. Export predictions and generate reports"
echo ""
echo "Estimated time: 45-90 minutes on CPU"
echo "Output dir: $REPO_ROOT/output/proof-risk-model/"
echo ""

mkdir -p "$REPO_ROOT/output/proof-risk-model"

$PYTHON "$REPO_ROOT/scripts/run_sota_policy_benchmark.py" \
    --mode full \
    --students 120 \
    --semesters 6 \
    --seed 20260531 \
    --use-gpu cpu \
    --min-free-disk-gb 1 \
    --allow-heavy-models \
    "$@"

echo ""
echo "=========================================="
echo "Training complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Check output: ls $REPO_ROOT/output/proof-risk-model/sota-policy-benchmark-*"
echo "  2. Copy new artifact paths into academic.ts and other services"
echo "  3. Remove the inference-engine fallback (productionModel: null)"
echo "  4. Run E2E tests to validate"
