import { T } from '@web/simulation/fixtures'
import { Chip } from '@web/shared/ui/primitives'

export function DemoWorkspaceBadge() {
  return (
    <Chip color={T.warning}>
      Demo workspace · disposable data
    </Chip>
  )
}
