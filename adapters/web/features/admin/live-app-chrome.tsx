// Coordinator/barrel for the System Admin live-app chrome components. Implementation
// lives in ./live-app-chrome-parts/*. This module re-exports the identical public
// surface so existing '@web/features/admin/live-app-chrome' importers keep working
// unchanged.

export { TeachingShellAdminTopBar } from './live-app-chrome-parts/admin-top-bar'

export { OperationsRail } from './live-app-chrome-parts/operations-rail'

export {
  SectionLaunchCard,
  OverviewSupportCard,
  ActionQueueCard,
} from './live-app-chrome-parts/overview-cards'

export {
  AdminDetailTabs,
  AdminDetailTabPanel,
} from './live-app-chrome-parts/admin-detail-tabs'

export { AdminMiniStat } from './live-app-chrome-parts/admin-mini-stat'
