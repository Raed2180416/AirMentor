type GraphCompletenessFlag = 'graph' | 'history'

export type FeatureConfidenceClass = 'high' | 'medium' | 'low'

export type GraphAwareFeatureCompleteness = {
  graphAvailable: boolean
  historyAvailable: boolean
  complete: boolean
  missing: GraphCompletenessFlag[]
  fallbackMode: 'graph-aware' | 'policy-only'
  confidenceClass: FeatureConfidenceClass
}

export type GraphAwareFeatureProvenance = {
  curriculumImportVersionId: string | null
  curriculumFeatureProfileFingerprint: string | null
  graphNodeCount: number
  graphEdgeCount: number
  historyCourseCount: number
}

export type GraphAwarePrerequisiteSummaryCompleteness = GraphAwareFeatureCompleteness

export type GraphAwarePrerequisiteSummary = {
  prerequisiteAveragePct: number
  prerequisiteFailureCount: number
  prerequisiteCourseCodes: string[]
  prerequisiteWeakCourseCodes: string[]
  downstreamDependencyLoad: number
  weakPrerequisiteChainCount: number
  repeatedWeakPrerequisiteFamilyCount: number
  featureCompleteness: GraphAwareFeatureCompleteness
  featureProvenance: GraphAwareFeatureProvenance
  completeness: GraphAwareFeatureCompleteness
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
}

function average(values: number[]) {
  const filtered = values.filter(value => Number.isFinite(value))
  if (filtered.length === 0) return 0
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function normalizeGraphKey(value: string) {
  return value.trim().toUpperCase()
}

function collectGraphDistances(startGraphKey: string, adjacency: Map<string, string[]>) {
  const distances = new Map<string, number>()
  const queue: Array<{ graphKey: string; distance: number }> = [{ graphKey: normalizeGraphKey(startGraphKey), distance: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    const nextGraphKeys = adjacency.get(current.graphKey) ?? []
    nextGraphKeys.forEach(nextGraphKey => {
      const normalizedNext = normalizeGraphKey(nextGraphKey)
      const nextDistance = current.distance + 1
      const existing = distances.get(normalizedNext)
      if (existing != null && existing <= nextDistance) return
      distances.set(normalizedNext, nextDistance)
      queue.push({ graphKey: normalizedNext, distance: nextDistance })
    })
  }
  return distances
}

function buildFeatureCompleteness(input?: Partial<Pick<GraphAwareFeatureCompleteness, 'graphAvailable' | 'historyAvailable'>>) {
  const graphAvailable = input?.graphAvailable ?? false
  const historyAvailable = input?.historyAvailable ?? false
  const complete = graphAvailable && historyAvailable
  const confidenceClass: FeatureConfidenceClass = complete
    ? 'high'
    : graphAvailable || historyAvailable
      ? 'medium'
      : 'low'
  return {
    graphAvailable,
    historyAvailable,
    complete,
    missing: [
      ...(!graphAvailable ? ['graph' as const] : []),
      ...(!historyAvailable ? ['history' as const] : []),
    ],
    fallbackMode: complete ? 'graph-aware' as const : 'policy-only' as const,
    confidenceClass,
  }
}

function collectGraphNodeCount(adjacencyMaps: Array<Map<string, string[]>>) {
  const nodes = new Set<string>()
  for (const adjacency of adjacencyMaps) {
    for (const [graphKey, relatedKeys] of adjacency.entries()) {
      nodes.add(normalizeGraphKey(graphKey))
      for (const relatedKey of relatedKeys) nodes.add(normalizeGraphKey(relatedKey))
    }
  }
  return nodes.size
}

function collectGraphEdgeCount(adjacency: Map<string, string[]>) {
  return [...adjacency.values()].reduce((sum, relatedKeys) => sum + relatedKeys.length, 0)
}

function buildFeatureProvenance(input?: Partial<GraphAwareFeatureProvenance>) {
  return {
    curriculumImportVersionId: input?.curriculumImportVersionId ?? null,
    curriculumFeatureProfileFingerprint: input?.curriculumFeatureProfileFingerprint ?? null,
    graphNodeCount: input?.graphNodeCount ?? 0,
    graphEdgeCount: input?.graphEdgeCount ?? 0,
    historyCourseCount: input?.historyCourseCount ?? 0,
  }
}

export function buildMissingGraphAwarePrerequisiteSummary(input?: Partial<GraphAwareFeatureCompleteness> & Partial<GraphAwareFeatureProvenance>): GraphAwarePrerequisiteSummary {
  const featureCompleteness = buildFeatureCompleteness({
    graphAvailable: input?.graphAvailable ?? false,
    historyAvailable: input?.historyAvailable ?? false,
  })
  const featureProvenance = buildFeatureProvenance({
    curriculumImportVersionId: input?.curriculumImportVersionId ?? null,
    curriculumFeatureProfileFingerprint: input?.curriculumFeatureProfileFingerprint ?? null,
    graphNodeCount: input?.graphNodeCount ?? 0,
    graphEdgeCount: input?.graphEdgeCount ?? 0,
    historyCourseCount: input?.historyCourseCount ?? 0,
  })
  return {
    prerequisiteAveragePct: 0,
    prerequisiteFailureCount: 0,
    prerequisiteCourseCodes: [],
    prerequisiteWeakCourseCodes: [],
    downstreamDependencyLoad: 0,
    weakPrerequisiteChainCount: 0,
    repeatedWeakPrerequisiteFamilyCount: 0,
    featureCompleteness,
    featureProvenance,
    completeness: featureCompleteness,
  }
}

export function buildGraphAwarePrerequisiteSummary<TSource>(input: {
  source: TSource | null
  sourceGraphKey: string | null
  historicalSourceKeyForGraphKey: (graphKey: string) => string
  sourceByHistoricalKey: Map<string, TSource>
  prerequisiteGraphByGraphKey: Map<string, string[]>
  downstreamGraphByGraphKey: Map<string, string[]>
  graphAvailable: boolean
  curriculumImportVersionId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  graphNodeCount?: number
  graphEdgeCount?: number
  historyCourseCount?: number
  getSemesterNumber: (source: TSource) => number
  getFinalMark: (source: TSource) => number
  getResult: (source: TSource) => string
  getCourseCode: (source: TSource) => string
  getCourseFamily: (courseCode: string) => string
}) {
  if (!input.source || !input.sourceGraphKey) {
    return buildMissingGraphAwarePrerequisiteSummary({
      graphAvailable: input.graphAvailable,
      historyAvailable: false,
    })
  }

  const sourceSemesterNumber = input.getSemesterNumber(input.source)
  const sourceGraphKey = normalizeGraphKey(input.sourceGraphKey)
  const prerequisiteGraphKeys = [...new Set((input.prerequisiteGraphByGraphKey.get(sourceGraphKey) ?? []).map(normalizeGraphKey))]
  const prerequisiteSourcesRaw = prerequisiteGraphKeys
    .map(graphKey => {
      const source = input.sourceByHistoricalKey.get(input.historicalSourceKeyForGraphKey(graphKey)) ?? null
      return source ? { source, graphKey } : null
    })
    .filter(Boolean)
  const prerequisiteSources = prerequisiteSourcesRaw as Array<{ source: TSource; graphKey: string }>

  const directPrerequisiteSources = prerequisiteSources.filter(entry => input.getSemesterNumber(entry.source) < sourceSemesterNumber)
  const prerequisiteAveragePct = directPrerequisiteSources.length > 0
    ? roundToTwo(average(directPrerequisiteSources.map(entry => input.getFinalMark(entry.source))))
    : 0
  const prerequisiteFailureCount = directPrerequisiteSources.filter(entry => input.getResult(entry.source) !== 'Passed').length
  const prerequisiteCourseCodes = directPrerequisiteSources.map(entry => input.getCourseCode(entry.source))
  const prerequisiteWeakCourseCodes = directPrerequisiteSources
    .filter(entry => input.getResult(entry.source) !== 'Passed' || input.getFinalMark(entry.source) < 55)
    .map(entry => input.getCourseCode(entry.source))

  const transitivePrerequisiteDistances = collectGraphDistances(sourceGraphKey, input.prerequisiteGraphByGraphKey)
  const transitivePrerequisiteSourcesRaw = [...transitivePrerequisiteDistances.entries()]
    .map(([graphKey, distance]) => {
      const source = input.sourceByHistoricalKey.get(input.historicalSourceKeyForGraphKey(graphKey)) ?? null
      return source ? { source, graphKey, distance } : null
    })
    .filter(Boolean)
  const transitivePrerequisiteSources = (transitivePrerequisiteSourcesRaw as Array<{ source: TSource; graphKey: string; distance: number }>)
    .filter(entry => input.getSemesterNumber(entry.source) < sourceSemesterNumber)

  const weakTransitiveSources = transitivePrerequisiteSources.filter(entry =>
    input.getResult(entry.source) !== 'Passed' || input.getFinalMark(entry.source) < 55)
  const repeatedWeakPrerequisiteFamilyCount = [...weakTransitiveSources.reduce((accumulator, entry) => {
    const family = input.getCourseFamily(input.getCourseCode(entry.source))
    accumulator.set(family, (accumulator.get(family) ?? 0) + 1)
    return accumulator
  }, new Map<string, number>()).values()].filter(count => count >= 2).length

  const downstreamDistances = collectGraphDistances(sourceGraphKey, input.downstreamGraphByGraphKey)
  const downstreamSourcesRaw = [...downstreamDistances.entries()]
    .map(([graphKey, distance]) => {
      const source = input.sourceByHistoricalKey.get(input.historicalSourceKeyForGraphKey(graphKey)) ?? null
      return source ? { source, graphKey, distance } : null
    })
    .filter(Boolean)
  const downstreamSources = (downstreamSourcesRaw as Array<{ source: TSource; graphKey: string; distance: number }>)
    .filter(entry => input.getSemesterNumber(entry.source) > sourceSemesterNumber)
  const weightedLoad = downstreamSources.reduce((sum, entry) => sum + (1 / Math.max(1, entry.distance)), 0)
  const downstreamDependencyLoad = downstreamSources.length === 0
    ? 0
    : roundToFour(clamp(weightedLoad / 4, 0, 1))

  const historyAvailable =
    prerequisiteSources.length === prerequisiteGraphKeys.length
    && transitivePrerequisiteSources.length === transitivePrerequisiteDistances.size
    && downstreamSources.length === downstreamDistances.size

  const featureCompleteness = buildFeatureCompleteness({
    graphAvailable: input.graphAvailable,
    historyAvailable,
  })
  const featureProvenance = buildFeatureProvenance({
    curriculumImportVersionId: input.curriculumImportVersionId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    graphNodeCount: input.graphNodeCount ?? collectGraphNodeCount([input.prerequisiteGraphByGraphKey, input.downstreamGraphByGraphKey]),
    graphEdgeCount: input.graphEdgeCount ?? collectGraphEdgeCount(input.prerequisiteGraphByGraphKey),
    historyCourseCount: input.historyCourseCount ?? input.sourceByHistoricalKey.size,
  })

  return {
    prerequisiteAveragePct,
    prerequisiteFailureCount,
    prerequisiteCourseCodes,
    prerequisiteWeakCourseCodes,
    downstreamDependencyLoad,
    weakPrerequisiteChainCount: weakTransitiveSources.length,
    repeatedWeakPrerequisiteFamilyCount,
    featureCompleteness,
    featureProvenance,
    completeness: featureCompleteness,
  } satisfies GraphAwarePrerequisiteSummary
}
