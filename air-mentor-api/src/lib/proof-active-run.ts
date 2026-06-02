type ActiveRunLike = {
  updatedAt: string
  createdAt: string
  activeOperationalSemester: number | null
  runLabel: string
  activeFlag?: number | boolean | null
  status?: string | null
  lifecycleState?: string | null
}

export function isActiveProofRunCandidate(run: ActiveRunLike) {
  if ('activeFlag' in run) {
    return run.activeFlag === 1 || run.activeFlag === true
  }
  if ('lifecycleState' in run && typeof run.lifecycleState === 'string') {
    return run.lifecycleState === 'active'
  }
  if ('status' in run && typeof run.status === 'string') {
    return run.status === 'active'
  }
  return true
}

export function isTeacherVisibleActiveProofRunCandidate(run: ActiveRunLike) {
  if (!isActiveProofRunCandidate(run)) return false
  if ('lifecycleState' in run) {
    return run.lifecycleState === 'active' || run.lifecycleState === 'completed-inspectable'
  }
  return true
}

export function pickMostRecentActiveRun<T extends ActiveRunLike>(runs: T[]): T | null {
  const hasLifecycleSignal = runs.some(run => 'activeFlag' in run || 'status' in run || 'lifecycleState' in run)
  const sortable = hasLifecycleSignal
    ? runs.filter(isActiveProofRunCandidate)
    : runs
  return sortable
    .slice()
    .sort((left, right) => (
      right.updatedAt.localeCompare(left.updatedAt)
      || right.createdAt.localeCompare(left.createdAt)
      || ((right.activeOperationalSemester ?? 0) - (left.activeOperationalSemester ?? 0))
      || left.runLabel.localeCompare(right.runLabel)
    ))[0] ?? null
}
