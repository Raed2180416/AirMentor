#!/usr/bin/env python3
"""
Generate proper CatBoost feature registry from TypeScript feature definitions.

This creates a human-readable feature catalog with provenance, value ranges,
and missingness indicators for the CatBoost training pipeline.

Usage:
    python generate_feature_registry.py --output feature-registry-proper.json
"""

import argparse
import json
from pathlib import Path

# Feature definitions synchronized with OBSERVABLE_FEATURE_KEYS in proof-risk-model.ts
FEATURE_DEFINITIONS = [
    # Core attendance features (indices 0-2)
    {"index": 0, "key": "attendancePctScaled", "name": "Attendance Percentage", "type": "scaled_percentage", "range": [0, 100], "monotone": -1, "description": "Current semester attendance percentage (scaled 0-100)"},
    {"index": 1, "key": "attendanceTrendScaled", "name": "Attendance Trend", "type": "scaled_delta", "range": [-100, 100], "monotone": 1, "description": "Recent attendance trajectory (negative = declining)"},
    {"index": 2, "key": "attendanceHistoryRiskScaled", "name": "Attendance History Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Historical attendance pattern risk score"},
    
    # CGPA features (indices 3-4)
    {"index": 3, "key": "currentCgpaScaled", "name": "Current CGPA", "type": "scaled_gpa", "range": [0, 100], "monotone": -1, "description": "Cumulative GPA scaled (higher = lower risk)"},
    {"index": 4, "key": "backlogPressureScaled", "name": "Backlog Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Active backlog course pressure"},
    
    # Assessment features (indices 5-13)
    {"index": 5, "key": "tt1RiskScaled", "name": "TT1 Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Term Test 1 performance risk"},
    {"index": 6, "key": "tt2RiskScaled", "name": "TT2 Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Term Test 2 performance risk"},
    {"index": 7, "key": "seeRiskScaled", "name": "SEE Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Semester End Exam performance risk"},
    {"index": 8, "key": "quizRiskScaled", "name": "Quiz Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Quiz performance risk"},
    {"index": 9, "key": "assignmentRiskScaled", "name": "Assignment Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Assignment performance risk"},
    
    # Prerequisite/curriculum features (indices 10-21)
    {"index": 10, "key": "weakCoPressureScaled", "name": "Weak CO Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Course Outcome weakness pressure"},
    {"index": 11, "key": "weakQuestionPressureScaled", "name": "Weak Question Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Question-level weakness pressure"},
    {"index": 12, "key": "courseworkTtMismatchScaled", "name": "Coursework-TT Mismatch", "type": "mismatch_score", "range": [0, 100], "monotone": 1, "description": "Gap between coursework and term test performance"},
    {"index": 13, "key": "ttMomentumRiskScaled", "name": "TT Momentum Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Term test trend momentum risk"},
    {"index": 14, "key": "interventionResidualRiskScaled", "name": "Intervention Residual Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Remaining risk after interventions"},
    {"index": 15, "key": "prerequisitePressureScaled", "name": "Prerequisite Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Prerequisite course weakness pressure"},
    {"index": 16, "key": "prerequisiteAverageRiskScaled", "name": "Prerequisite Average Risk", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Average risk across prerequisites"},
    {"index": 17, "key": "prerequisiteFailurePressureScaled", "name": "Prerequisite Failure Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Prerequisite failure pressure"},
    {"index": 18, "key": "prerequisiteChainDepthScaled", "name": "Prerequisite Chain Depth", "type": "count_scaled", "range": [0, 100], "monotone": 1, "description": "Depth of weak prerequisite chain"},
    {"index": 19, "key": "prerequisiteWeakCourseRateScaled", "name": "Prerequisite Weak Course Rate", "type": "rate_scaled", "range": [0, 100], "monotone": 1, "description": "Rate of weak prerequisite courses"},
    {"index": 20, "key": "prerequisiteCarryoverLoadScaled", "name": "Prerequisite Carryover Load", "type": "load_scaled", "range": [0, 100], "monotone": 1, "description": "Backlog carryover load from prerequisites"},
    {"index": 21, "key": "prerequisiteRecencyWeightedFailureScaled", "name": "Prerequisite Recency-Weighted Failure", "type": "risk_score", "range": [0, 100], "monotone": 1, "description": "Recent prerequisite failures weighted by recency"},
    
    # Dependency features (indices 22-25)
    {"index": 22, "key": "downstreamDependencyLoadScaled", "name": "Downstream Dependency Load", "type": "load_scaled", "range": [0, 100], "monotone": 1, "description": "Load from downstream course dependencies"},
    {"index": 23, "key": "weakPrerequisiteChainCountScaled", "name": "Weak Prerequisite Chain Count", "type": "count_scaled", "range": [0, 100], "monotone": 1, "description": "Number of weak prerequisite chains"},
    {"index": 24, "key": "repeatedWeakPrerequisiteFamilyCountScaled", "name": "Repeated Weak Prerequisite Family Count", "type": "count_scaled", "range": [0, 100], "monotone": 1, "description": "Repeated weakness in prerequisite families"},
    
    # Temporal/stage features (indices 25-30)
    {"index": 25, "key": "semesterProgressScaled", "name": "Semester Progress", "type": "progress_scaled", "range": [0, 100], "monotone": 0, "description": "Progress through current semester"},
    {"index": 26, "key": "stagePreTt1Scaled", "name": "Stage: Pre-TT1", "type": "binary_indicator", "range": [0, 1], "monotone": 0, "description": "Binary: currently in pre-TT1 stage"},
    {"index": 27, "key": "stagePostTt1Scaled", "name": "Stage: Post-TT1", "type": "binary_indicator", "range": [0, 1], "monotone": 0, "description": "Binary: currently in post-TT1 stage"},
    {"index": 28, "key": "stagePostTt2Scaled", "name": "Stage: Post-TT2", "type": "binary_indicator", "range": [0, 1], "monotone": 0, "description": "Binary: currently in post-TT2 stage"},
    {"index": 29, "key": "stagePostAssignmentsScaled", "name": "Stage: Post-Assignments", "type": "binary_indicator", "range": [0, 1], "monotone": 0, "description": "Binary: currently in post-assignments stage"},
    {"index": 30, "key": "stagePostSeeScaled", "name": "Stage: Post-SEE", "type": "binary_indicator", "range": [0, 1], "monotone": 0, "description": "Binary: currently in post-SEE stage"},
    
    # Section/context features (index 31)
    {"index": 31, "key": "sectionPressureScaled", "name": "Section Pressure", "type": "pressure_score", "range": [0, 100], "monotone": 1, "description": "Peer performance pressure from section"},
    
    # Interaction features (indices 32-36)
    {"index": 32, "key": "tt1tt2ExamCompoundRiskScaled", "name": "TT1-TT2 Exam Compound Risk", "type": "compound_risk", "range": [0, 100], "monotone": 1, "description": "Combined TT1-TT2 exam risk (interaction)"},
    {"index": 33, "key": "courseworkCompoundRiskScaled", "name": "Coursework Compound Risk", "type": "compound_risk", "range": [0, 100], "monotone": 1, "description": "Combined coursework risk (interaction)"},
    {"index": 34, "key": "stagePostTt2TtCompoundInteractionScaled", "name": "Post-TT2 TT Compound Interaction", "type": "interaction", "range": [0, 100], "monotone": 1, "description": "Stage-TT interaction at post-TT2"},
    {"index": 35, "key": "attendanceTrendCompoundRiskScaled", "name": "Attendance Trend Compound Risk", "type": "compound_risk", "range": [0, 100], "monotone": 1, "description": "Attendance trend × current attendance interaction"},
    {"index": 36, "key": "stagePostAssignmentsCourseworkInteractionScaled", "name": "Post-Assignments Coursework Interaction", "type": "interaction", "range": [0, 100], "monotone": 1, "description": "Stage-coursework interaction at post-assignments"},
    
    # Missingness indicators (indices 37-43) - v8 additions
    {"index": 37, "key": "cgpaMissingScaled", "name": "CGPA Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: CGPA was missing (imputed)"},
    {"index": 38, "key": "backlogMissingScaled", "name": "Backlog Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: Backlog data was missing"},
    {"index": 39, "key": "tt1MissingScaled", "name": "TT1 Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: TT1 mark was missing (pre-TT1 stage)"},
    {"index": 40, "key": "tt2MissingScaled", "name": "TT2 Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: TT2 mark was missing (pre-TT2 stage)"},
    {"index": 41, "key": "seeMissingScaled", "name": "SEE Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: SEE mark was missing (pre-SEE stage)"},
    {"index": 42, "key": "quizMissingScaled", "name": "Quiz Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: Quiz marks were missing"},
    {"index": 43, "key": "assignmentMissingScaled", "name": "Assignment Missing Indicator", "type": "missing_flag", "range": [0, 1], "monotone": 0, "description": "Binary: Assignment marks were missing"},
]


def generate_registry():
    """Generate comprehensive feature registry."""
    
    # Categorize features
    categories = {
        "attendance": [0, 1, 2],
        "cgpa_backlog": [3, 4],
        "assessment": [5, 6, 7, 8, 9],
        "prerequisite": [10, 11, 15, 16, 17, 18, 19, 20, 21],
        "curriculum_structure": [12, 13, 14, 22, 23, 24],
        "temporal_stage": [25, 26, 27, 28, 29, 30],
        "context": [31],
        "interactions": [32, 33, 34, 35, 36],
        "missingness_flags": [37, 38, 39, 40, 41, 42, 43],
    }
    
    # Build category lookup
    category_by_index = {}
    for cat, indices in categories.items():
        for idx in indices:
            category_by_index[idx] = cat
    
    # Add category and monotone constraint info
    features = []
    for feat in FEATURE_DEFINITIONS:
        indexed_feat = {
            **feat,
            "category": category_by_index.get(feat["index"], "unknown"),
            "monotoneConstraint": feat.get("monotone", 0),
            "trainingColumn": f"feat_{feat['index']}",
        }
        features.append(indexed_feat)
    
    # Summary statistics
    monotone_increasing = sum(1 for f in features if f.get("monotone") == 1)
    monotone_decreasing = sum(1 for f in features if f.get("monotone") == -1)
    unconstrained = sum(1 for f in features if f.get("monotone") == 0)
    missingness_flags = sum(1 for f in features if f["type"] == "missing_flag")
    
    registry = {
        "registryVersion": "observable-risk-features-v5",
        "generatedAt": pd.Timestamp.now().isoformat() if 'pd' in globals() else None,
        "totalFeatures": len(features),
        "featureSchema": {
            "name": "observable-risk-features-v5",
            "description": "Scaled 0-100 risk features with explicit missingness indicators",
            "source": "TypeScript proof-risk-model.ts OBSERVABLE_FEATURE_KEYS",
        },
        "summary": {
            "byCategory": {cat: len(indices) for cat, indices in categories.items()},
            "monotoneConstraints": {
                "increasing": monotone_increasing,
                "decreasing": monotone_decreasing,
                "unconstrained": unconstrained,
            },
            "missingnessIndicators": missingness_flags,
        },
        "features": features,
        "provenance": {
            "codeSource": "air-mentor-api/src/lib/proof-risk-model.ts",
            "constantName": "OBSERVABLE_FEATURE_KEYS",
            "exportMethod": "CatBoost training CSV via evaluate-proof-risk-model.ts",
            "schemaVersion": "v5 (interaction features + missingness flags)",
        },
        "temporalFeatures": {
            "description": "Stage encoding allows shared model across all checkpoints",
            "implementation": "One-hot encoded stage indicators (indices 26-30)",
            "stages": ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"],
        },
        "crossCourseFeatures": {
            "description": "Prerequisite chain weakness and dependency load",
            "features": [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        },
        "interventionFeatures": {
            "description": "Intervention response tracking",
            "features": [14],
        },
        "missingnessHandling": {
            "description": "Explicit NaN handling in CatBoost (nan_mode='Min')",
            "flags": missingness_flags,
            "criticalDistinction": "TT1=null (pre-TT1) vs TT1=0 (failed) via tt1MissingScaled",
        },
    }
    
    return registry


def main():
    parser = argparse.ArgumentParser(description="Generate CatBoost feature registry")
    parser.add_argument("--output", "-o", required=True, help="Output JSON path")
    args = parser.parse_args()
    
    registry = generate_registry()
    
    # Add timestamp
    from datetime import datetime
    registry["generatedAt"] = datetime.now().isoformat()
    
    with open(args.output, "w") as f:
        json.dump(registry, f, indent=2)
    
    print(f"[registry] Generated {registry['totalFeatures']} features")
    print(f"[registry] Categories: {registry['summary']['byCategory']}")
    print(f"[registry] Monotone constraints: {registry['summary']['monotoneConstraints']}")
    print(f"[registry] Wrote to {args.output}")


if __name__ == "__main__":
    main()
