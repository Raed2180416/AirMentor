import { z } from 'zod'

export const scopeTypeValues = ['institution', 'academic-faculty', 'department', 'branch', 'batch', 'section'] as const
export type ScopeTypeValue = (typeof scopeTypeValues)[number]

const SECTION_SCOPE_SEPARATOR = '::'

export function normalizeSectionCode(sectionCode: string) {
  return sectionCode.trim().toUpperCase()
}

export function encodeSectionScopeId(batchId: string, sectionCode: string) {
  const normalizedBatchId = batchId.trim()
  const normalizedSectionCode = normalizeSectionCode(sectionCode)
  if (!normalizedBatchId || !normalizedSectionCode) {
    throw new Error('Section scope ids require both a batch id and a section code.')
  }
  return `${normalizedBatchId}${SECTION_SCOPE_SEPARATOR}${normalizedSectionCode}`
}

export function decodeSectionScopeId(scopeId: string) {
  const [batchId, sectionCode, ...remainder] = scopeId.split(SECTION_SCOPE_SEPARATOR)
  if (remainder.length > 0) return null
  const normalizedBatchId = batchId?.trim() ?? ''
  const normalizedSectionCode = normalizeSectionCode(sectionCode ?? '')
  if (!normalizedBatchId || !normalizedSectionCode) return null
  return {
    batchId: normalizedBatchId,
    sectionCode: normalizedSectionCode,
  }
}

export const stagePolicyStageKeyValues = [
  'pre-tt1',
  'post-tt1',
  'post-tt2',
  'post-assignments',
  'post-see',
] as const
export type StagePolicyStageKey = (typeof stagePolicyStageKeyValues)[number]

export const stageEvidenceKindValues = [
  'attendance',
  'tt1',
  'tt2',
  'quiz',
  'assignment',
  'finals',
  'transcript',
] as const
export type StageEvidenceKind = (typeof stageEvidenceKindValues)[number]

export const stagePolicyStageSchema = z.object({
  key: z.enum(stagePolicyStageKeyValues),
  label: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().positive(),
  semesterDayOffset: z.number().int().min(0),
  requiredEvidence: z.array(z.enum(stageEvidenceKindValues)).default([]),
  requireQueueClearance: z.boolean().default(true),
  requireTaskClearance: z.boolean().default(true),
  advancementMode: z.enum(['admin-confirmed', 'automatic']).default('admin-confirmed'),
  color: z.string().min(1).default('#5B8DEF'),
})

export const stagePolicyPayloadSchema = z.object({
  stages: z.array(stagePolicyStageSchema).min(stagePolicyStageKeyValues.length).max(stagePolicyStageKeyValues.length),
}).transform(input => {
  const byKey = new Map(input.stages.map(stage => [stage.key, stage]))
  return {
    stages: stagePolicyStageKeyValues.map((key, index) => {
      const stage = byKey.get(key)
      if (!stage) {
        throw new Error(`Missing stage definition for ${key}`)
      }
      return {
        ...stage,
        order: index + 1,
      }
    }),
  }
})

export type StagePolicyPayload = z.infer<typeof stagePolicyPayloadSchema>

export const DEFAULT_STAGE_POLICY: StagePolicyPayload = {
  stages: [
    {
      key: 'pre-tt1',
      label: 'Pre TT1',
      description: 'Opening stage before TT1 closes. Scheme setup, attendance updates, and class execution stay open here.',
      order: 1,
      semesterDayOffset: 0,
      requiredEvidence: ['attendance'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#2D8AF0',
    },
    {
      key: 'post-tt1',
      label: 'Post TT1',
      description: 'First checkpoint after TT1 evidence is present and locked.',
      order: 2,
      semesterDayOffset: 35,
      requiredEvidence: ['tt1'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F59E0B',
    },
    {
      key: 'post-tt2',
      label: 'Post TT2',
      description: 'Checkpoint after TT2 evidence is present and locked.',
      order: 3,
      semesterDayOffset: 77,
      requiredEvidence: ['tt2'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#8B5CF6',
    },
    {
      key: 'post-assignments',
      label: 'Post Assignments',
      description: 'Checkpoint after assignment evidence is present and locked. Assignment work may be entered earlier but cannot skip TT2.',
      order: 4,
      semesterDayOffset: 98,
      requiredEvidence: ['assignment'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F97316',
    },
    {
      key: 'post-see',
      label: 'Post SEE',
      description: 'Checkpoint after SEE evidence is present and locked. This is the end-of-semester progression gate.',
      order: 5,
      semesterDayOffset: 119,
      requiredEvidence: ['finals'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#EF4444',
    },
  ],
}

export function canonicalizeStagePolicy(input?: unknown) {
  if (!input) return DEFAULT_STAGE_POLICY
  const parsed = stagePolicyPayloadSchema.safeParse(input)
  return parsed.success ? parsed.data : DEFAULT_STAGE_POLICY
}

export function stagePolicyStageByKey(policy: StagePolicyPayload, key: StagePolicyStageKey) {
  return policy.stages.find(stage => stage.key === key) ?? DEFAULT_STAGE_POLICY.stages.find(stage => stage.key === key) ?? DEFAULT_STAGE_POLICY.stages[0]
}
