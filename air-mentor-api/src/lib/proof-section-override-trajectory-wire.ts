// Track C Phase 2 (2026-04-23): thin wire module that bridges
// proof-section-override-applier.ts to the StudentTrajectory shape built
// inside msruas-proof-control-plane.ts.
//
// This module exists as a separate file (rather than inline in
// msruas-proof-control-plane.ts) solely so the wire can be unit-tested
// without pulling in the 4800-line control-plane and all its DB / curriculum
// dependencies. The pure fn here operates on the minimal structural shape
// needed for section-override application.
//
// Flag gating happens in proof-section-override-applier.ts:
// AIRMENTOR_SECTION_OVERRIDES_V1 off -> applier returns identity; this
// wrapper then returns the original trajectory.

import {
  applySectionOverridesToProfile,
  type SectionOverrides,
} from './proof-section-override-applier.js'

// Structural subset of StudentTrajectory.profile that the applier touches.
// Mirrors the fields in msruas-proof-control-plane.ts's StudentTrajectory
// type but is deliberately not imported from there (keeps this file DB-free
// and test-trivial).
export type TrajectoryLikeForOverride = {
  studentId: string
  sectionCode: string
  profile: {
    behavior: {
      practiceCompliance: number
      helpSeekingTendency: number
      examPressure: number
      attendancePropensity: number
      // Other behavior fields on the full StudentTrajectory are preserved via
      // structural spread below; this type only names the override targets.
      [otherKey: string]: unknown
    }
    dynamics: {
      consistency: number
      volatility: number
      [otherKey: string]: unknown
    }
    intervention: {
      interventionReceptivity: number
      [otherKey: string]: unknown
    }
    [otherProfileKey: string]: unknown
  }
  [otherTrajectoryKey: string]: unknown
}

export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

export function maybeApplySectionOverridesToTrajectory<T extends TrajectoryLikeForOverride>(
  trajectory: T,
  sectionOverrides: SectionOverrides | null,
  runSeed: number,
): T {
  if (!sectionOverrides) return trajectory
  const applied = applySectionOverridesToProfile({
    latent: {
      behavior: {
        practiceCompliance: trajectory.profile.behavior.practiceCompliance,
        helpSeekingTendency: trajectory.profile.behavior.helpSeekingTendency,
        examPressure: trajectory.profile.behavior.examPressure,
        attendancePropensity: trajectory.profile.behavior.attendancePropensity,
      },
      dynamics: {
        consistency: trajectory.profile.dynamics.consistency,
        volatility: trajectory.profile.dynamics.volatility,
      },
      intervention: {
        interventionReceptivity: trajectory.profile.intervention.interventionReceptivity,
      },
    },
    sectionCode: trajectory.sectionCode,
    overrides: sectionOverrides,
    studentId: trajectory.studentId,
    runSeed: `run-${runSeed}`,
  })
  if (!applied.applied) return trajectory
  return {
    ...trajectory,
    profile: {
      ...trajectory.profile,
      behavior: {
        ...trajectory.profile.behavior,
        practiceCompliance: roundToTwo(applied.latent.behavior.practiceCompliance),
        helpSeekingTendency: roundToTwo(applied.latent.behavior.helpSeekingTendency),
        examPressure: roundToTwo(applied.latent.behavior.examPressure),
        attendancePropensity: roundToTwo(applied.latent.behavior.attendancePropensity),
      },
      dynamics: {
        ...trajectory.profile.dynamics,
        consistency: roundToTwo(applied.latent.dynamics.consistency),
        volatility: roundToTwo(applied.latent.dynamics.volatility),
      },
      intervention: {
        ...trajectory.profile.intervention,
        interventionReceptivity: roundToTwo(applied.latent.intervention.interventionReceptivity),
      },
    },
  }
}
