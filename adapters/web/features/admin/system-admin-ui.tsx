// Coordinator/barrel for the System Admin shared UI kit. Implementation lives in
// ./system-admin-ui-parts/*. This module re-exports the identical public surface
// so existing '@web/features/admin/system-admin-ui' importers keep working unchanged.

export type { AdminSectionId, BreadcrumbSegment } from './system-admin-ui-parts/types'

export {
  TOP_TABS,
  WEEKDAYS_6,
  WEEKDAYS_7,
} from './system-admin-ui-parts/constants'

export {
  formatDate,
  formatDateTime,
  getReadOnlyInputStyle,
  getStatusColor,
  normalizeSearch,
} from './system-admin-ui-parts/helpers'

export {
  FieldLabel,
  SearchField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from './system-admin-ui-parts/field-inputs'

export {
  InfoBanner,
  QueueBulkActions,
  RestoreBanner,
} from './system-admin-ui-parts/banners'

export {
  EmptyState,
  MetricCard,
  SectionHeading,
} from './system-admin-ui-parts/section-widgets'

export {
  AdminBreadcrumbs,
  AdminTopBar,
} from './system-admin-ui-parts/top-bar'

export {
  AuthFeature,
  DayToggle,
  EntityButton,
  HeroBadge,
  ModalFrame,
} from './system-admin-ui-parts/misc-widgets'
