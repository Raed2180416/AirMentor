import path from 'node:path'

export function sanitizeArtifactPrefix(rawPrefix) {
  const trimmed = typeof rawPrefix === 'string' ? rawPrefix.trim() : ''
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function parseProofTargetSemester(rawValue) {
  if (rawValue == null) return null
  const trimmed = String(rawValue).trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid AIRMENTOR_PROOF_TARGET_SEMESTER: ${trimmed}`)
  }
  return value
}

export function normalizeSemesterTargetList(rawValue) {
  if (rawValue == null) return []
  const values = String(rawValue)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(parseProofTargetSemester)
    .filter((value) => value != null)

  return values.filter((value, index) => values.indexOf(value) === index)
}

export function resolveSemesterWalkCheckpoint(checkpoints, targetSemester = null) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    throw new Error('Proof dashboard should expose at least one checkpoint')
  }

  const scopedCheckpoints = targetSemester == null
    ? checkpoints.slice()
    : checkpoints.filter(item => item?.semesterNumber === targetSemester)

  if (scopedCheckpoints.length === 0) {
    throw new Error(`No proof checkpoint is available for semester ${targetSemester}`)
  }

  scopedCheckpoints.sort((left, right) =>
    (Number(left?.semesterNumber ?? 0) - Number(right?.semesterNumber ?? 0))
    || (Number(left?.stageOrder ?? 0) - Number(right?.stageOrder ?? 0))
    || String(left?.simulationStageCheckpointId ?? '').localeCompare(String(right?.simulationStageCheckpointId ?? '')),
  )

  return scopedCheckpoints.at(-1)
}

export function buildSemesterScopedArtifactPath(rawPath, prefix, semesterNumber) {
  const safePrefix = sanitizeArtifactPrefix(prefix)
  if (!safePrefix) return null
  return path.join(
    path.dirname(rawPath),
    `${safePrefix}-semester-${semesterNumber}-${path.basename(rawPath)}`,
  )
}

export function buildSemesterProofSummaryPath(outputDir, prefix, semesterNumber) {
  const safePrefix = sanitizeArtifactPrefix(prefix)
  if (!safePrefix) return null
  return path.join(outputDir, `${safePrefix}-semester-${semesterNumber}-proof-risk-walk-summary.json`)
}

export function buildCombinedSemesterProofSummaryPath(outputDir, prefix) {
  const safePrefix = sanitizeArtifactPrefix(prefix)
  if (!safePrefix) return null
  return path.join(outputDir, `${safePrefix}-semester-walk-summary.json`)
}
