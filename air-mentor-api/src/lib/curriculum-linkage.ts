import curriculumSeedJson from '../db/seeds/msruas-mnc-curriculum.json' with { type: 'json' }
import { runCurriculumLinkagePython } from './curriculum-linkage-python.js'
import { z } from 'zod'

const manifestCourseSchema = z.object({
  title: z.string().min(1),
  semester: z.number().int().positive(),
  credits: z.number().int().positive(),
  assessmentProfile: z.string().min(1),
  explicitPrerequisites: z.array(z.string()).default([]),
  addedPrerequisites: z.array(z.string()).default([]),
  bridgeModules: z.array(z.string()).default([]),
  tt1Topics: z.array(z.string()).default([]),
  tt2Topics: z.array(z.string()).default([]),
  seeTopics: z.array(z.string()).default([]),
  workbookTopics: z.array(z.string()).default([]),
  internalCompilerId: z.string().min(1),
  officialWebCode: z.string().nullish().transform(value => value?.trim() ?? ''),
  officialWebTitle: z.string().nullish().transform(value => value?.trim() ?? ''),
  matchStatus: z.string().min(1),
  mappingNote: z.string().nullish().transform(value => value?.trim() ?? ''),
})

const manifestEdgeSchema = z.object({
  sourceCourse: z.string().min(1),
  targetCourse: z.string().min(1),
  edgeType: z.string().min(1),
  whyAdded: z.string().optional(),
})

const manifestElectiveSchema = z.object({
  stream: z.string().min(1),
  pceGroup: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  semesterSlot: z.string().min(1),
})

const curriculumManifestSchema = z.object({
  courses: z.array(manifestCourseSchema),
  explicitEdges: z.array(manifestEdgeSchema),
  addedEdges: z.array(manifestEdgeSchema),
  electives: z.array(manifestElectiveSchema).default([]),
})

export const supportedCurriculumManifestKeySchema = z.enum(['msruas-mnc-seed'])
export type SupportedCurriculumManifestKey = z.infer<typeof supportedCurriculumManifestKeySchema>

type CurriculumManifest = z.infer<typeof curriculumManifestSchema>
type CurriculumManifestCourse = z.infer<typeof manifestCourseSchema>

export type CurriculumManifestPayloadItem = {
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
  assessmentProfile: string
  outcomes: Array<{ id: string; desc: string; bloom: string }>
  prerequisites: Array<{ sourceCourseCode: string; edgeKind: 'explicit' | 'added'; rationale: string }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
}

export type CurriculumLinkageCandidateDraft = {
  curriculumCourseId: string
  targetCourseCode: string
  targetTitle: string
  sourceCourseCode: string
  sourceTitle: string
  edgeKind: 'explicit' | 'added'
  rationale: string
  confidenceScaled: number
  sources: string[]
  signalSummary: {
    manifestMatch?: boolean
    semanticOverlap?: number
    sharedTokens?: string[]
    llmSuggested?: boolean
    llmConfidenceScaled?: number
  }
}

export type CurriculumLinkageCandidateGenerationStatus = {
  status: 'ok' | 'degraded' | 'error'
  warnings: string[]
  provider: 'python-nlp' | 'typescript-fallback'
}

export type CurriculumLinkageCandidateBuildResult = {
  items: CurriculumLinkageCandidateDraft[]
  candidateGenerationStatus: CurriculumLinkageCandidateGenerationStatus
}

type ResolvedFeatureLike = {
  curriculumCourseId: string
  semesterNumber: number
  courseCode: string
  title: string
  outcomes: Array<{ id: string; desc: string; bloom: string }>
  prerequisites: Array<{ sourceCourseCode: string; edgeKind: 'explicit' | 'added'; rationale: string }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
}

const supportedManifests: Record<SupportedCurriculumManifestKey, CurriculumManifest> = {
  'msruas-mnc-seed': curriculumManifestSchema.parse(curriculumSeedJson),
}

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'into', 'from', 'that', 'this', 'their', 'your', 'using', 'used', 'are', 'was', 'were',
  'will', 'have', 'has', 'had', 'over', 'under', 'before', 'after', 'unit', 'module', 'topic', 'topics', 'course',
  'courses', 'semester', 'theory', 'lab', 'laboratory', 'workbook', 'analysis', 'design', 'system', 'systems',
])

const ollamaProposalSchema = z.object({
  proposals: z.array(z.object({
    sourceCourseCode: z.string().min(1),
    edgeKind: z.enum(['explicit', 'added']).default('added'),
    rationale: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  })).default([]),
})

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string) {
  return Array.from(new Set(normalizeText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !stopWords.has(token))))
}

function courseCodeForSeed(course: CurriculumManifestCourse) {
  const normalized = course.officialWebCode.trim().toUpperCase()
  return normalized || course.internalCompilerId.trim().toUpperCase()
}

function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string, topicPartitions: CurriculumManifestPayloadItem['topicPartitions']) {
  const tt1Lead = topicPartitions.tt1[0] ?? courseTitle
  const tt2Lead = topicPartitions.tt2[0] ?? topicPartitions.see[0] ?? courseTitle
  const seeLead = topicPartitions.see[0] ?? topicPartitions.tt2[0] ?? courseTitle
  const workbookLead = topicPartitions.workbook[0] ?? topicPartitions.see[0] ?? courseTitle
  return [
    { id: 'CO1', desc: `Explain the foundational ideas behind ${tt1Lead} in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} methods to solve structured problems around ${tt2Lead}.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse failure patterns, trade-offs, and edge cases in ${seeLead}.`, bloom: 'Analyse' },
    { id: 'CO4', desc: `Evaluate and justify solution choices while working through ${workbookLead}.`, bloom: 'Evaluate' },
  ]
}

function buildManifestPrerequisites(manifest: CurriculumManifest, course: CurriculumManifestCourse) {
  const byTitle = new Map(manifest.courses.map(item => [normalizeText(item.title), courseCodeForSeed(item)]))
  const edgeRows = [
    ...manifest.explicitEdges
      .filter(edge => normalizeText(edge.targetCourse) === normalizeText(course.title))
      .map(edge => ({
        sourceCourseCode: byTitle.get(normalizeText(edge.sourceCourse)) ?? edge.sourceCourse.trim().toUpperCase(),
        edgeKind: 'explicit' as const,
        rationale: edge.edgeType,
      })),
    ...manifest.addedEdges
      .filter(edge => normalizeText(edge.targetCourse) === normalizeText(course.title))
      .map(edge => ({
        sourceCourseCode: byTitle.get(normalizeText(edge.sourceCourse)) ?? edge.sourceCourse.trim().toUpperCase(),
        edgeKind: 'added' as const,
        rationale: edge.whyAdded?.trim() || edge.edgeType,
      })),
  ]
  const unique = new Map<string, { sourceCourseCode: string; edgeKind: 'explicit' | 'added'; rationale: string }>()
  for (const row of edgeRows) {
    const key = `${row.sourceCourseCode.toLowerCase()}::${row.edgeKind}`
    if (!unique.has(key)) unique.set(key, row)
  }
  return [...unique.values()]
}

export function getSupportedCurriculumManifest(manifestKey: SupportedCurriculumManifestKey) {
  return supportedManifests[manifestKey]
}

export function buildManifestPayloadItems(manifestKey: SupportedCurriculumManifestKey): CurriculumManifestPayloadItem[] {
  const manifest = getSupportedCurriculumManifest(manifestKey)
  return manifest.courses
    .map(course => {
      const payload: CurriculumManifestPayloadItem = {
        semesterNumber: course.semester,
        courseCode: courseCodeForSeed(course),
        title: course.title,
        credits: course.credits,
        assessmentProfile: course.assessmentProfile,
        prerequisites: buildManifestPrerequisites(manifest, course),
        bridgeModules: [...course.bridgeModules],
        topicPartitions: {
          tt1: [...course.tt1Topics],
          tt2: [...course.tt2Topics],
          see: [...course.seeTopics],
          workbook: [...course.workbookTopics],
        },
        outcomes: [],
      }
      payload.outcomes = buildDefaultCourseOutcomes(payload.courseCode, payload.title, payload.topicPartitions)
      return payload
    })
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
}

function normalizePythonCandidate(candidate: Record<string, unknown>): CurriculumLinkageCandidateDraft | null {
  const curriculumCourseId = typeof candidate.curriculumCourseId === 'string' ? candidate.curriculumCourseId.trim() : ''
  const targetCourseCode = typeof candidate.targetCourseCode === 'string' ? candidate.targetCourseCode.trim() : ''
  const targetTitle = typeof candidate.targetTitle === 'string' ? candidate.targetTitle.trim() : ''
  const sourceCourseCode = typeof candidate.sourceCourseCode === 'string' ? candidate.sourceCourseCode.trim() : ''
  const sourceTitle = typeof candidate.sourceTitle === 'string' ? candidate.sourceTitle.trim() : ''
  const rationale = typeof candidate.rationale === 'string' ? candidate.rationale.trim() : ''
  if (!curriculumCourseId || !targetCourseCode || !sourceCourseCode || !rationale) return null
  return {
    curriculumCourseId,
    targetCourseCode,
    targetTitle,
    sourceCourseCode,
    sourceTitle,
    edgeKind: candidate.edgeKind === 'explicit' ? 'explicit' : 'added',
    rationale,
    confidenceScaled: typeof candidate.confidenceScaled === 'number' && Number.isFinite(candidate.confidenceScaled)
      ? Math.max(0, Math.min(100, Math.round(candidate.confidenceScaled)))
      : 0,
    sources: Array.isArray(candidate.sources)
      ? candidate.sources.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    signalSummary: typeof candidate.signalSummary === 'object' && candidate.signalSummary != null
      ? candidate.signalSummary as Record<string, unknown>
      : {},
  }
}

function normalizePythonCandidates(rawCandidates: Array<Record<string, unknown>>): CurriculumLinkageCandidateDraft[] {
  return rawCandidates
    .map(normalizePythonCandidate)
    .filter((candidate): candidate is CurriculumLinkageCandidateDraft => !!candidate)
    .sort((left, right) => right.confidenceScaled - left.confidenceScaled || left.targetCourseCode.localeCompare(right.targetCourseCode) || left.sourceCourseCode.localeCompare(right.sourceCourseCode))
}

function findManifestPayloadForCourse(manifestItems: CurriculumManifestPayloadItem[], course: ResolvedFeatureLike) {
  return manifestItems.find(item =>
    item.courseCode.toLowerCase() === course.courseCode.toLowerCase()
    || normalizeText(item.title) === normalizeText(course.title)
  ) ?? null
}

function buildCourseTextBundle(course: ResolvedFeatureLike) {
  return [
    course.courseCode,
    course.title,
    ...course.outcomes.map(item => item.desc),
    ...course.bridgeModules,
    ...course.topicPartitions.tt1,
    ...course.topicPartitions.tt2,
    ...course.topicPartitions.see,
    ...course.topicPartitions.workbook,
  ].join(' ')
}

function semanticOverlapScore(source: ResolvedFeatureLike, target: ResolvedFeatureLike) {
  const sourceTokens = tokenize(buildCourseTextBundle(source))
  const targetTokens = tokenize(buildCourseTextBundle(target))
  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return { score: 0, sharedTokens: [] as string[] }
  }
  const sourceTokenSet = new Set(sourceTokens)
  const sharedTokens = targetTokens.filter(token => sourceTokenSet.has(token))
  const score = sharedTokens.length === 0
    ? 0
    : Number((sharedTokens.length / Math.max(4, Math.min(sourceTokens.length, targetTokens.length))).toFixed(4))
  return {
    score,
    sharedTokens: sharedTokens.slice(0, 8),
  }
}

async function queryOllamaForLinkageSuggestions(input: {
  targetCourse: ResolvedFeatureLike
  candidateSources: ResolvedFeatureLike[]
}) {
  const baseUrl = process.env.AIRMENTOR_OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'
  const model = process.env.AIRMENTOR_CURRICULUM_LINKAGE_OLLAMA_MODEL ?? 'qwen2.5:7b-instruct'
  const prompt = [
    'You are helping curate prerequisite and cross-course linkage proposals for an academic curriculum.',
    'Return strict JSON only, matching the provided schema.',
    'Only suggest source courses from the provided candidate list.',
    'Do not repeat existing prerequisites.',
    'Be conservative. Prefer no proposal over a weak proposal.',
    '',
    `Target course: ${input.targetCourse.courseCode} | ${input.targetCourse.title} | semester ${input.targetCourse.semesterNumber}`,
    `Target outcomes: ${input.targetCourse.outcomes.map(item => `${item.id}: ${item.desc}`).join(' ; ')}`,
    `Target topics: ${[...input.targetCourse.topicPartitions.tt1, ...input.targetCourse.topicPartitions.tt2, ...input.targetCourse.topicPartitions.see].join(' ; ')}`,
    `Existing prerequisites: ${input.targetCourse.prerequisites.map(item => item.sourceCourseCode).join(', ') || 'none'}`,
    '',
    'Candidate sources:',
    ...input.candidateSources.map(course => (
      `- ${course.courseCode} | ${course.title} | sem ${course.semesterNumber} | topics ${[...course.topicPartitions.tt1, ...course.topicPartitions.tt2, ...course.topicPartitions.see].join(' ; ')}`
    )),
  ].join('\n')

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: {
        type: 'object',
        properties: {
          proposals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceCourseCode: { type: 'string' },
                edgeKind: { type: 'string', enum: ['explicit', 'added'] },
                rationale: { type: 'string' },
                confidence: { type: 'number' },
              },
              required: ['sourceCourseCode', 'edgeKind', 'rationale'],
            },
          },
        },
        required: ['proposals'],
      },
      options: {
        temperature: 0,
      },
    }),
    signal: AbortSignal.timeout(6000),
  })

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`)
  }

  const payload = await response.json() as { response?: string }
  const parsed = ollamaProposalSchema.safeParse(JSON.parse(payload.response ?? '{}'))
  return parsed.success ? parsed.data.proposals : []
}

export async function buildCurriculumLinkageCandidates(input: {
  manifestKey?: SupportedCurriculumManifestKey | null
  items: ResolvedFeatureLike[]
  targetCurriculumCourseIds?: string[] | null
}): Promise<CurriculumLinkageCandidateBuildResult> {
  const manifestItems = input.manifestKey ? buildManifestPayloadItems(input.manifestKey) : []
  const pythonResult = runCurriculumLinkagePython({
    manifestItems,
    items: input.items.map(item => ({
      curriculumCourseId: item.curriculumCourseId,
      semesterNumber: item.semesterNumber,
      courseCode: item.courseCode,
      title: item.title,
      outcomes: item.outcomes,
      prerequisites: item.prerequisites,
      bridgeModules: item.bridgeModules,
      topicPartitions: item.topicPartitions,
    })),
    targetCurriculumCourseIds: input.targetCurriculumCourseIds ?? null,
  })
  if (pythonResult?.candidates) {
    const normalizedCandidates = normalizePythonCandidates(pythonResult.candidates)
    if (normalizedCandidates.length > 0 || pythonResult.status === 'ok') {
      return {
        items: normalizedCandidates,
        candidateGenerationStatus: {
          status: pythonResult.status,
          warnings: pythonResult.warnings ?? [],
          provider: 'python-nlp',
        },
      }
    }
  }
  const scopedTargets = input.targetCurriculumCourseIds?.length
    ? input.items.filter(item => input.targetCurriculumCourseIds!.includes(item.curriculumCourseId))
    : input.items
  const byCourseCode = new Map(input.items.map(item => [item.courseCode.toLowerCase(), item]))
  const candidatesByTarget = new Map<string, Map<string, CurriculumLinkageCandidateDraft>>()

  for (const target of scopedTargets) {
    const activePrerequisiteCodes = new Set(target.prerequisites.map(item => item.sourceCourseCode.toLowerCase()))
    const targetMap = new Map<string, CurriculumLinkageCandidateDraft>()
    const manifestMatch = manifestItems.length > 0 ? findManifestPayloadForCourse(manifestItems, target) : null
    if (manifestMatch) {
      for (const prerequisite of manifestMatch.prerequisites) {
        if (activePrerequisiteCodes.has(prerequisite.sourceCourseCode.toLowerCase())) continue
        const sourceCourse = byCourseCode.get(prerequisite.sourceCourseCode.toLowerCase())
        if (!sourceCourse) continue
        targetMap.set(`${sourceCourse.courseCode.toLowerCase()}::${prerequisite.edgeKind}`, {
          curriculumCourseId: target.curriculumCourseId,
          targetCourseCode: target.courseCode,
          targetTitle: target.title,
          sourceCourseCode: sourceCourse.courseCode,
          sourceTitle: sourceCourse.title,
          edgeKind: prerequisite.edgeKind,
          rationale: prerequisite.rationale,
          confidenceScaled: prerequisite.edgeKind === 'explicit' ? 96 : 92,
          sources: ['manifest'],
          signalSummary: {
            manifestMatch: true,
          },
        })
      }
    }

    const semanticCandidates = input.items
      .filter(source => source.curriculumCourseId !== target.curriculumCourseId)
      .filter(source => source.semesterNumber < target.semesterNumber)
      .filter(source => !activePrerequisiteCodes.has(source.courseCode.toLowerCase()))
      .map(source => ({
        source,
        ...semanticOverlapScore(source, target),
      }))
      .filter(entry => entry.score >= 0.18 || entry.sharedTokens.length >= 3)
      .sort((left, right) => right.score - left.score || left.source.semesterNumber - right.source.semesterNumber)
      .slice(0, 6)

    for (const entry of semanticCandidates) {
      const key = `${entry.source.courseCode.toLowerCase()}::added`
      const existing = targetMap.get(key)
      const rationale = entry.sharedTokens.length > 0
        ? `Topic and outcome overlap detected around ${entry.sharedTokens.slice(0, 4).join(', ')}.`
        : `Semantic overlap suggests ${entry.source.courseCode} underpins ${target.courseCode}.`
      if (existing) {
        existing.confidenceScaled = Math.max(existing.confidenceScaled, Math.round(entry.score * 100))
        existing.sources = Array.from(new Set([...existing.sources, 'semantic']))
        existing.signalSummary.semanticOverlap = Math.max(existing.signalSummary.semanticOverlap ?? 0, entry.score)
        existing.signalSummary.sharedTokens = entry.sharedTokens
        continue
      }
      targetMap.set(key, {
        curriculumCourseId: target.curriculumCourseId,
        targetCourseCode: target.courseCode,
        targetTitle: target.title,
        sourceCourseCode: entry.source.courseCode,
        sourceTitle: entry.source.title,
        edgeKind: 'added',
        rationale,
        confidenceScaled: Math.max(55, Math.min(88, Math.round(entry.score * 100))),
        sources: ['semantic'],
        signalSummary: {
          semanticOverlap: entry.score,
          sharedTokens: entry.sharedTokens,
        },
      })
    }

    const llmSources = semanticCandidates
      .map(entry => entry.source)
      .filter(source => !targetMap.has(`${source.courseCode.toLowerCase()}::explicit`) && !targetMap.has(`${source.courseCode.toLowerCase()}::added`))
      .slice(0, 5)

    if (llmSources.length > 0 && scopedTargets.length <= 6) {
      try {
        const proposals = await queryOllamaForLinkageSuggestions({
          targetCourse: target,
          candidateSources: llmSources,
        })
        for (const proposal of proposals) {
          if (activePrerequisiteCodes.has(proposal.sourceCourseCode.toLowerCase())) continue
          const sourceCourse = byCourseCode.get(proposal.sourceCourseCode.toLowerCase())
          if (!sourceCourse || sourceCourse.semesterNumber >= target.semesterNumber) continue
          const key = `${sourceCourse.courseCode.toLowerCase()}::${proposal.edgeKind}`
          const existing = targetMap.get(key)
          const llmConfidenceScaled = Math.max(40, Math.min(95, Math.round((proposal.confidence ?? 0.66) * 100)))
          if (existing) {
            existing.confidenceScaled = Math.max(existing.confidenceScaled, llmConfidenceScaled)
            existing.sources = Array.from(new Set([...existing.sources, 'llm']))
            existing.signalSummary.llmSuggested = true
            existing.signalSummary.llmConfidenceScaled = llmConfidenceScaled
            if (proposal.rationale.length > existing.rationale.length) {
              existing.rationale = proposal.rationale
            }
            continue
          }
          targetMap.set(key, {
            curriculumCourseId: target.curriculumCourseId,
            targetCourseCode: target.courseCode,
            targetTitle: target.title,
            sourceCourseCode: sourceCourse.courseCode,
            sourceTitle: sourceCourse.title,
            edgeKind: proposal.edgeKind,
            rationale: proposal.rationale,
            confidenceScaled: llmConfidenceScaled,
            sources: ['llm'],
            signalSummary: {
              llmSuggested: true,
              llmConfidenceScaled,
            },
          })
        }
      } catch {
        // Local assist is optional. Deterministic + semantic signals remain sufficient for review.
      }
    }

    candidatesByTarget.set(target.curriculumCourseId, targetMap)
  }

  const fallbackWarnings = [
    ...(pythonResult?.warnings ?? []),
    ...(pythonResult ? [] : ['Python NLP helper unavailable. Using TypeScript heuristic fallback.']),
  ]

  return {
    items: [...candidatesByTarget.values()]
      .flatMap(map => [...map.values()])
      .sort((left, right) => right.confidenceScaled - left.confidenceScaled || left.targetCourseCode.localeCompare(right.targetCourseCode) || left.sourceCourseCode.localeCompare(right.sourceCourseCode)),
    candidateGenerationStatus: {
      status: fallbackWarnings.length > 0 ? 'degraded' : 'ok',
      warnings: fallbackWarnings,
      provider: 'typescript-fallback',
    },
  }
}
