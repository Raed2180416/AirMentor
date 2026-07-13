import type {
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigPayload,
} from '@web/shared/api/types'
import { requireText } from './live-app-validation'

export type CurriculumFeatureFormState = {
  assessmentProfile: string
  outcomesText: string
  prerequisitesText: string
  bridgeModulesText: string
  tt1TopicsText: string
  tt2TopicsText: string
  seeTopicsText: string
  workbookTopicsText: string
}

export function defaultCurriculumFeatureForm(): CurriculumFeatureFormState {
  return {
    assessmentProfile: 'admin-authored',
    outcomesText: '',
    prerequisitesText: '',
    bridgeModulesText: '',
    tt1TopicsText: '',
    tt2TopicsText: '',
    seeTopicsText: '',
    workbookTopicsText: '',
  }
}

export function hydrateCurriculumFeatureForm(item: ApiCurriculumFeatureConfigBundle['items'][number] | null): CurriculumFeatureFormState {
  if (!item) return defaultCurriculumFeatureForm()
  return {
    assessmentProfile: item.assessmentProfile || 'admin-authored',
    outcomesText: item.outcomes.map(outcome => `${outcome.id} | ${outcome.bloom} | ${outcome.desc}`).join('\n'),
    prerequisitesText: item.prerequisites.map(prerequisite => `${prerequisite.sourceCourseCode} | ${prerequisite.edgeKind} | ${prerequisite.rationale}`).join('\n'),
    bridgeModulesText: item.bridgeModules.join('\n'),
    tt1TopicsText: item.topicPartitions.tt1.join('\n'),
    tt2TopicsText: item.topicPartitions.tt2.join('\n'),
    seeTopicsText: item.topicPartitions.see.join('\n'),
    workbookTopicsText: item.topicPartitions.workbook.join('\n'),
  }
}

export function parseCurriculumFeatureLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

export function buildCurriculumFeaturePayload(form: CurriculumFeatureFormState): ApiCurriculumFeatureConfigPayload {
  const outcomes = parseCurriculumFeatureLines(form.outcomesText).map((line, index) => {
    const [id, bloom, ...descParts] = line.split('|').map(part => part.trim())
    if (!id || !bloom || descParts.length === 0) {
      throw new Error(`Outcome line ${index + 1} must use "COx | Bloom | Description".`)
    }
    return {
      id,
      bloom,
      desc: descParts.join(' | '),
    }
  })
  const prerequisites = parseCurriculumFeatureLines(form.prerequisitesText).map((line, index) => {
    const [sourceCourseCode, rawKind, ...rationaleParts] = line.split('|').map(part => part.trim())
    const normalizedKind = (rawKind ?? '').toLowerCase()
    const edgeKind: 'explicit' | 'added' | null = normalizedKind === 'explicit'
      ? 'explicit'
      : normalizedKind === 'added'
        ? 'added'
        : null
    const rationale = rationaleParts.join(' | ').trim()
    if (!sourceCourseCode || !edgeKind || !rationale) {
      throw new Error(`Prerequisite line ${index + 1} must use "COURSE_CODE | explicit|added | Rationale".`)
    }
    return {
      sourceCourseCode,
      edgeKind,
      rationale,
    }
  })
  if (outcomes.length === 0) {
    throw new Error('At least one course outcome is required.')
  }
  return {
    assessmentProfile: requireText('Assessment profile', form.assessmentProfile),
    outcomes,
    prerequisites,
    bridgeModules: parseCurriculumFeatureLines(form.bridgeModulesText),
    topicPartitions: {
      tt1: parseCurriculumFeatureLines(form.tt1TopicsText),
      tt2: parseCurriculumFeatureLines(form.tt2TopicsText),
      see: parseCurriculumFeatureLines(form.seeTopicsText),
      workbook: parseCurriculumFeatureLines(form.workbookTopicsText),
    },
  }
}

export function validateCurriculumFeaturePrerequisites(
  targetCourse: ApiCurriculumFeatureConfigBundle['items'][number],
  prerequisites: ApiCurriculumFeatureConfigPayload['prerequisites'],
  items: ApiCurriculumFeatureConfigBundle['items'],
) {
  const targetSemesterNumber = Number(targetCourse.semesterNumber ?? 0)
  if (!Number.isFinite(targetSemesterNumber) || targetSemesterNumber <= 0) return

  const courseByCode = new Map(
    items.map(item => [item.courseCode.trim().toLowerCase(), item] as const),
  )

  for (const prerequisite of prerequisites) {
    const sourceCourse = courseByCode.get(prerequisite.sourceCourseCode.trim().toLowerCase())
    if (!sourceCourse) continue
    const sourceSemesterNumber = Number(sourceCourse.semesterNumber ?? 0)
    if (!Number.isFinite(sourceSemesterNumber) || sourceSemesterNumber <= 0) continue
    if (prerequisite.edgeKind === 'explicit' && sourceSemesterNumber >= targetSemesterNumber) {
      throw new Error(`Prerequisite edges require an earlier semester. Found semester ${sourceSemesterNumber} -> ${targetSemesterNumber}.`)
    }
  }
}
