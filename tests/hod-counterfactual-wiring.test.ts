import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync('adapters/web/app/operational-workspace.tsx', 'utf8')

describe('HoD counterfactual simulator wiring', () => {
  it('passes the simulator loader from OperationalWorkspace props into route-surface selectors', () => {
    const componentParameter = appSource.match(/function OperationalWorkspace\(\{(?<body>[\s\S]*?)\}: OperationalWorkspaceProps\)/)?.groups?.body ?? ''
    const workspaceStart = appSource.indexOf('const academicWorkspace = {')
    const workspaceEnd = appSource.indexOf('\n  }\n\n  return', workspaceStart)
    const academicWorkspaceObject = workspaceStart >= 0 && workspaceEnd > workspaceStart
      ? appSource.slice(workspaceStart, workspaceEnd)
      : ''

    expect(componentParameter).toContain('loadHodProofCounterfactualSimulator')
    expect(academicWorkspaceObject).toContain('loadHodProofCounterfactualSimulator')
  })
})
