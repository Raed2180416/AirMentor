import { describe, expect, it } from 'vitest'
import {
  isInspectableProofRunLifecycle,
  resolveFacultyProofOperationalSemester,
} from '../src/adapters/simulation/proof-control-plane-tail-service.js'

describe('proof-control-plane-tail-service helpers', () => {
  it('returns unavailable instead of falling back to semester 6', () => {
    expect(resolveFacultyProofOperationalSemester(null, null)).toBeNull()
  })

  it('treats stopped runs as non-inspectable lifecycle states', () => {
    expect(isInspectableProofRunLifecycle('stopped')).toBe(false)
    expect(isInspectableProofRunLifecycle('completed-inspectable')).toBe(true)
  })
})
