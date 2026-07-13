import type { Dispatch, SetStateAction } from 'react'
import type { LiveAdminDataset } from '../../system-admin-live-data'
import { defaultEntityEditorState, type EntityEditorState } from '../../live-app-model'

export interface CurriculumEditorHelperDeps {
  data: LiveAdminDataset
  authoritativeOperationalSemester: number | null | undefined
  selectedCurriculumSemester: string
  setEntityEditors: Dispatch<SetStateAction<EntityEditorState>>
  setSelectedCurriculumSemester: Dispatch<SetStateAction<string>>
  setSelectedCurriculumCourseId: Dispatch<SetStateAction<string>>
}

export function createCurriculumEditorHelpers(deps: CurriculumEditorHelperDeps) {
  const {
    data,
    authoritativeOperationalSemester,
    selectedCurriculumSemester,
    setEntityEditors,
    setSelectedCurriculumSemester,
    setSelectedCurriculumCourseId,
  } = deps

  const startEditingTerm = (termId: string) => {
    const target = data.terms.find(item => item.termId === termId)
    if (!target) return
    setEntityEditors(prev => ({
      ...prev,
      term: {
        termId: target.termId,
        academicYearLabel: target.academicYearLabel,
        semesterNumber: String(target.semesterNumber),
        startDate: target.startDate,
        endDate: target.endDate,
      },
    }))
  }

  const resetTermEditor = () => {
    setEntityEditors(prev => ({
      ...prev,
      term: defaultEntityEditorState(String(authoritativeOperationalSemester ?? 1)).term,
    }))
  }

  const startEditingCurriculumCourse = (curriculumCourseId: string) => {
    const target = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!target) return
    setSelectedCurriculumSemester(String(target.semesterNumber))
    setSelectedCurriculumCourseId(target.curriculumCourseId)
    setEntityEditors(prev => ({
      ...prev,
      curriculum: {
        curriculumCourseId: target.curriculumCourseId,
        semesterNumber: String(target.semesterNumber),
        courseCode: target.courseCode,
        title: target.title,
        credits: String(target.credits),
      },
    }))
  }

  const resetCurriculumEditor = () => {
    setEntityEditors(prev => ({
      ...prev,
      curriculum: defaultEntityEditorState(selectedCurriculumSemester || String(authoritativeOperationalSemester ?? 1)).curriculum,
    }))
  }

  return { startEditingTerm, resetTermEditor, startEditingCurriculumCourse, resetCurriculumEditor }
}
