import type { UniversityPlugin } from './university-plugin.js'

export type PolicyContext = {
  activePlugin: UniversityPlugin
}

export function createPolicyContext(plugin: UniversityPlugin): PolicyContext {
  return { activePlugin: plugin }
}
