import { describe, expect, it } from 'vitest'
import { getAllAtRiskStudents, getStudents, OFFERINGS } from '../src/data'

describe('seeded student risk drivers', () => {
  it('never serves Medium or High risk students without an observable driver', () => {
    const atRiskRows = getAllAtRiskStudents()

    expect(atRiskRows.length).toBeGreaterThan(0)
    expect(atRiskRows.filter(student => (student.reasons?.length ?? 0) === 0)).toEqual([])
  })

  it('never renders stage-eligible offering risk without driver text for visible seeded students', () => {
    const unexplained = OFFERINGS
      .filter(offering => offering.stage >= 2)
      .flatMap(offering => getStudents(offering).map(student => ({ offering, student })))
      .filter(({ student }) => (student.riskBand === 'Medium' || student.riskBand === 'High') && student.reasons.length === 0)

    expect(unexplained).toEqual([])
  })
})
