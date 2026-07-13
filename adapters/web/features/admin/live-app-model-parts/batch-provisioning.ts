import type { ApiBatchProvisioningRequest } from '@web/shared/api/types'
import {
  requirePositiveInteger,
  requireText,
} from '../live-app-validation'
import { parseCurriculumFeatureLines } from '../live-app-curriculum-feature-model'

export type BatchProvisioningFormState = {
  termId: string
  sectionLabels: string
  mode: ApiBatchProvisioningRequest['mode']
  studentsPerSection: string
  facultyPoolIds: string[]
  createStudents: boolean
  createMentors: boolean
  createAttendanceScaffolding: boolean
  createAssessmentScaffolding: boolean
  createTranscriptScaffolding: boolean
}

export function defaultBatchProvisioningForm(): BatchProvisioningFormState {
  return {
    termId: '',
    sectionLabels: 'A, B',
    mode: 'live-empty',
    studentsPerSection: '60',
    facultyPoolIds: [],
    createStudents: false,
    createMentors: true,
    createAttendanceScaffolding: true,
    createAssessmentScaffolding: false,
    createTranscriptScaffolding: true,
  }
}

export function buildBatchProvisioningPayload(form: BatchProvisioningFormState): ApiBatchProvisioningRequest {
  return {
    termId: requireText('Setup term', form.termId),
    sectionLabels: parseCurriculumFeatureLines(form.sectionLabels.replace(/,/g, '\n')),
    mode: form.mode ?? 'live-empty',
    studentsPerSection: requirePositiveInteger('Students per section', form.studentsPerSection),
    facultyPoolIds: form.facultyPoolIds.length > 0 ? [...form.facultyPoolIds] : undefined,
    createStudents: form.createStudents,
    createMentors: form.createMentors,
    createAttendanceScaffolding: form.createAttendanceScaffolding,
    createAssessmentScaffolding: form.createAssessmentScaffolding,
    createTranscriptScaffolding: form.createTranscriptScaffolding,
  }
}
