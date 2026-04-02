// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { readSubmittedField } from '../src/system-admin-live-app'

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
