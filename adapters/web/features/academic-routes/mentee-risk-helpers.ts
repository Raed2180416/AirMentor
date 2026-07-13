import { T, type Mentee } from '@web/simulation/fixtures'
import { type RiskBand } from '@kernel/shared/domain'

export function getMenteeCurrentRiskProb(mentee: Mentee) {
  return typeof mentee.primaryRiskProb === 'number' && Number.isFinite(mentee.primaryRiskProb)
    ? mentee.primaryRiskProb
    : mentee.avs
}

export function getMenteeCurrentRiskBand(mentee: Mentee): RiskBand | null {
  if (mentee.primaryRiskBand) return mentee.primaryRiskBand
  const risk = getMenteeCurrentRiskProb(mentee)
  return risk >= 0.6 ? 'High' : risk >= 0.35 ? 'Medium' : risk >= 0 ? 'Low' : null
}

export function getRiskColorForBand(band: RiskBand | null) {
  return band === 'High' ? T.danger : band === 'Medium' ? T.warning : band === 'Low' ? T.success : T.dim
}

export function sortMenteeCourseRisksByCurrentAuthority(mentee: Mentee) {
  return [...mentee.courseRisks]
    .filter(risk => risk.risk >= 0)
    .sort((left, right) => {
      if ((left.primaryCase ?? false) !== (right.primaryCase ?? false)) return Number(right.primaryCase === true) - Number(left.primaryCase === true)
      if ((left.countsTowardCapacity ?? false) !== (right.countsTowardCapacity ?? false)) return Number(right.countsTowardCapacity === true) - Number(left.countsTowardCapacity === true)
      if (mentee.primaryCourseCode && left.code !== right.code) {
        if (left.code === mentee.primaryCourseCode) return -1
        if (right.code === mentee.primaryCourseCode) return 1
      }
      const leftRank = left.priorityRank ?? Number.MAX_SAFE_INTEGER
      const rightRank = right.priorityRank ?? Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) return leftRank - rightRank
      return right.risk - left.risk || left.code.localeCompare(right.code)
    })
}
