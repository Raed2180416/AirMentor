import { describe, expect, it } from 'vitest'
import { msruasPlugin } from '@universities/msruas'
import { iitbPlugin } from '@universities/iitb'
import type { UniversityPlugin } from '@kernel/policy'

/**
 * Proves the university-plugin system is generic — the platform is NOT hardcoded
 * to MSRUAS. A second institution (IITB) plugs into the same UniversityPlugin
 * contract and produces genuinely different policy, so the same student inputs
 * would be evaluated differently per institution.
 *
 * Behaviour-neutral: this only asserts on the pure plugin outputs; it does not
 * wire plugin selection into any runtime path.
 */
describe('university plugin system is university-agnostic', () => {
  const plugins: UniversityPlugin[] = [msruasPlugin, iitbPlugin]

  it('both institutions implement the full UniversityPlugin contract', () => {
    for (const plugin of plugins) {
      expect(typeof plugin.universityId).toBe('string')
      expect(plugin.universityId.length).toBeGreaterThan(0)
      expect(typeof plugin.getGradingSystem).toBe('function')
      expect(typeof plugin.getPassRules).toBe('function')
      expect(typeof plugin.getPromotionRules).toBe('function')
      expect(typeof plugin.getAssessmentTemplate).toBe('function')
      expect(typeof plugin.getRiskRules).toBe('function')
      expect(typeof plugin.getAttendanceRules).toBe('function')
    }
    expect(msruasPlugin.universityId).not.toBe(iitbPlugin.universityId)
  })

  it('risk thresholds diverge between institutions', () => {
    const msruas = msruasPlugin.getRiskRules()
    const iitb = iitbPlugin.getRiskRules()
    expect(msruas.highRiskAttendancePercentBelow).toBe(65)
    expect(iitb.highRiskAttendancePercentBelow).toBe(70)
    expect(msruas.highRiskBacklogCount).not.toBe(iitb.highRiskBacklogCount)
    expect(msruas).not.toEqual(iitb)
  })

  it('pass rules diverge between institutions', () => {
    const msruas = msruasPlugin.getPassRules()
    const iitb = iitbPlugin.getPassRules()
    // MSRUAS runs a 60/40 CE/SEE split; IITB a 50/50 split — different exam scales.
    expect(msruas.ceMaximum).toBe(60)
    expect(iitb.ceMaximum).toBe(50)
    expect(msruas.seeMaximum).toBe(40)
    expect(iitb.seeMaximum).toBe(50)
    expect(msruas).not.toEqual(iitb)
  })

  it('the same student is graded differently under each institution', () => {
    // A student at 68% attendance sits above MSRUAS's high-risk cutoff (65) but
    // below IITB's (70) — so the identical input yields a different risk band
    // purely from the active institution's policy. That is the whole point of
    // the plugin layer.
    const attendancePct = 68
    const msruasRisk = msruasPlugin.getRiskRules()
    const iitbRisk = iitbPlugin.getRiskRules()

    const msruasHighRisk = attendancePct < msruasRisk.highRiskAttendancePercentBelow
    const iitbHighRisk = attendancePct < iitbRisk.highRiskAttendancePercentBelow

    expect(msruasHighRisk).toBe(false)
    expect(iitbHighRisk).toBe(true)
    expect(msruasHighRisk).not.toBe(iitbHighRisk)
  })
})
