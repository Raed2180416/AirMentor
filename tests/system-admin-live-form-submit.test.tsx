// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { buildCurriculumFeaturePayload, readSubmittedField, validateCurriculumFeaturePrerequisites } from '@web/features/admin/system-admin-live-app'

describe('system-admin live hierarchy form submission', () => {
  it('reads the current DOM field value instead of a stale fallback', () => {
    document.body.innerHTML = `
      <form>
        <input name="departmentName" value="Quality Systems QA6767 Updated" />
      </form>
    `

    const form = document.querySelector('form')
    expect(form).not.toBeNull()

    expect(readSubmittedField(form as HTMLFormElement, 'departmentName', 'Quality Systems QA6767')).toBe('Quality Systems QA6767 Updated')
  })

  it('supports textarea and select fields used by hierarchy editors', () => {
    document.body.innerHTML = `
      <form>
        <textarea name="academicFacultyOverview">Updated overview</textarea>
        <select name="branchProgramLevel">
          <option value="UG" selected>UG</option>
          <option value="PG">PG</option>
        </select>
      </form>
    `

    const form = document.querySelector('form')
    expect(form).not.toBeNull()

    expect(readSubmittedField(form as HTMLFormElement, 'academicFacultyOverview', '')).toBe('Updated overview')
    expect(readSubmittedField(form as HTMLFormElement, 'branchProgramLevel', 'PG')).toBe('UG')
  })

  it('falls back when the named field is not present in the submitted form', () => {
    document.body.innerHTML = '<form></form>'

    const form = document.querySelector('form')
    expect(form).not.toBeNull()

    expect(readSubmittedField(form as HTMLFormElement, 'departmentName', 'Fallback Department')).toBe('Fallback Department')
  })
})

describe('system-admin curriculum model input parsing', () => {
  it('requires prerequisite edge kind instead of defaulting to explicit', () => {
    expect(() => buildCurriculumFeaturePayload({
      assessmentProfile: 'admin-authored',
      outcomesText: 'CO1 | Understand | Explain the concept',
      prerequisitesText: 'CS101 | | Missing edge kind',
      bridgeModulesText: '',
      tt1TopicsText: '',
      tt2TopicsText: '',
      seeTopicsText: '',
      workbookTopicsText: '',
    })).toThrow('Prerequisite line 1 must use "COURSE_CODE | explicit|added | Rationale".')
  })

  it('allows same-semester added prerequisite links in the live save validator', () => {
    const targetCourse = {
      curriculumCourseId: 'curr_1',
      courseCode: 'CS501',
      semesterNumber: 5,
    } as never
    const items = [
      targetCourse,
      {
        curriculumCourseId: 'curr_2',
        courseCode: 'CS502',
        semesterNumber: 5,
      } as never,
    ]

    expect(() => validateCurriculumFeaturePrerequisites(targetCourse, [{
      sourceCourseCode: 'CS502',
      edgeKind: 'added',
      rationale: 'Same-semester supporting signal approved by sysadmin review.',
    }], items)).not.toThrow()
  })

  it('rejects same-semester explicit prerequisite links in the live save validator', () => {
    const targetCourse = {
      curriculumCourseId: 'curr_1',
      courseCode: 'CS501',
      semesterNumber: 5,
    } as never
    const items = [
      targetCourse,
      {
        curriculumCourseId: 'curr_2',
        courseCode: 'CS502',
        semesterNumber: 5,
      } as never,
    ]

    expect(() => validateCurriculumFeaturePrerequisites(targetCourse, [{
      sourceCourseCode: 'CS502',
      edgeKind: 'explicit',
      rationale: 'Explicit official prerequisite must come from an earlier semester.',
    }], items)).toThrow('Prerequisite edges require an earlier semester. Found semester 5 -> 5.')
  })
})
