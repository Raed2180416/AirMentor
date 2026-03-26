import { z } from 'zod'

export const scopeTypeValues = ['institution', 'academic-faculty', 'department', 'branch', 'batch'] as const
export type ScopeTypeValue = (typeof scopeTypeValues)[number]

export const stagePolicyStageKeyValues = [
  'semester-start',
  'post-tt1',
  'post-reassessment',
  'post-tt2',
  'post-see',
  'semester-close',
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
      key: 'semester-start',
      label: 'Semester Start',
      description: 'Opening checkpoint using early attendance and carryover history before TT1 closes.',
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
      description: 'First major risk checkpoint after TT1 evidence lands and the first queue decision is made.',
      order: 2,
      semesterDayOffset: 35,
      requiredEvidence: ['attendance', 'tt1'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F59E0B',
    },
    {
      key: 'post-reassessment',
      label: 'Post Reassessment',
      description: 'Follow-up window after the deterministic intervention path is opened but before TT2 is locked.',
      order: 3,
      semesterDayOffset: 49,
      requiredEvidence: ['attendance', 'tt1'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F97316',
    },
    {
      key: 'post-tt2',
      label: 'Post TT2',
      description: 'Checkpoint after TT2 where response is judged against the earlier intervention path.',
      order: 4,
      semesterDayOffset: 77,
      requiredEvidence: ['attendance', 'tt1', 'tt2'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#8B5CF6',
    },
    {
      key: 'post-see',
      label: 'Post SEE',
      description: 'Checkpoint after SEE where final risk, action effect, and advisory fit are recomputed.',
      order: 5,
      semesterDayOffset: 119,
      requiredEvidence: ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#EF4444',
    },
    {
      key: 'semester-close',
      label: 'Semester Close',
      description: 'Closing checkpoint after transcript-grade consolidation and queue resolution.',
      order: 6,
      semesterDayOffset: 133,
      requiredEvidence: ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#10B981',
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

