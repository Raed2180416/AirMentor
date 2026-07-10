import type {
  ApiStageEvidenceKind,
  ApiStagePolicyPayload,
} from '../api/types'
import {
  requireNonNegativeInteger,
  requireText,
} from './live-app-validation'

export type StagePolicyFormState = {
  stages: Array<{
    key: ApiStagePolicyPayload['stages'][number]['key']
    label: string
    description: string
    semesterDayOffset: string
    requiredEvidence: ApiStageEvidenceKind[]
    requireQueueClearance: boolean
    requireTaskClearance: boolean
    advancementMode: ApiStagePolicyPayload['stages'][number]['advancementMode']
    color: string
  }>
}

export const DEFAULT_STAGE_POLICY: ApiStagePolicyPayload = {
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

export const STAGE_EVIDENCE_OPTIONS: ApiStageEvidenceKind[] = ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript']

export function defaultStagePolicyForm(): StagePolicyFormState {
  return {
    stages: DEFAULT_STAGE_POLICY.stages.map(stage => ({
      key: stage.key,
      label: stage.label,
      description: stage.description,
      semesterDayOffset: String(stage.semesterDayOffset),
      requiredEvidence: [...stage.requiredEvidence],
      requireQueueClearance: stage.requireQueueClearance,
      requireTaskClearance: stage.requireTaskClearance,
      advancementMode: stage.advancementMode,
      color: stage.color,
    })),
  }
}

export function hydrateStagePolicyForm(policy: ApiStagePolicyPayload | null | undefined): StagePolicyFormState {
  const source = policy?.stages?.length ? policy : DEFAULT_STAGE_POLICY
  return {
    stages: DEFAULT_STAGE_POLICY.stages.map(defaultStage => {
      const stage = source.stages.find(item => item.key === defaultStage.key) ?? defaultStage
      return {
        key: stage.key,
        label: stage.label,
        description: stage.description,
        semesterDayOffset: String(stage.semesterDayOffset),
        requiredEvidence: [...stage.requiredEvidence],
        requireQueueClearance: stage.requireQueueClearance,
        requireTaskClearance: stage.requireTaskClearance,
        advancementMode: stage.advancementMode,
        color: stage.color,
      }
    }),
  }
}

export function buildStagePolicyPayload(form: StagePolicyFormState): ApiStagePolicyPayload {
  return {
    stages: form.stages.map((stage, index) => ({
      key: stage.key,
      label: requireText(`${stage.key} label`, stage.label),
      description: requireText(`${stage.key} description`, stage.description),
      order: index + 1,
      semesterDayOffset: requireNonNegativeInteger(`${stage.key} semester day offset`, stage.semesterDayOffset),
      requiredEvidence: [...stage.requiredEvidence],
      requireQueueClearance: stage.requireQueueClearance,
      requireTaskClearance: stage.requireTaskClearance,
      advancementMode: stage.advancementMode,
      color: requireText(`${stage.key} color`, stage.color),
    })),
  }
}
