import { T } from './data'
import { Chip } from './ui-primitives'

export function DemoWorkspaceBadge() {
  return (
    <Chip color={T.warning}>
      Demo workspace · disposable data
    </Chip>
  )
}
