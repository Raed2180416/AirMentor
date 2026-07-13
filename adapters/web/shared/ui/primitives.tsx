// Backward-compat barrel. The primitives were split into ./primitives-parts/*
// for maintainability; this file re-exports every prior public symbol verbatim so
// existing importers of '@web/shared/ui/primitives' keep working unchanged.
// (react-refresh/only-export-components is disabled for this path in eslint.config.js.)
export {
  UI_EASE,
  UI_TRANSITION_FAST,
  UI_TRANSITION_MEDIUM,
  UI_FONT_SIZES,
  UI_RADII,
} from './primitives-parts/tokens'

export {
  getAccessiblePrimaryAccent,
  getAccessibleDangerAccent,
  ACCESSIBLE_PRIMARY_ACCENT,
  ACCESSIBLE_DANGER_ACCENT,
  getSemanticTone,
  withAlpha,
} from './primitives-parts/color'
export type { SemanticTone } from './primitives-parts/color'

export {
  getSurfaceStyle,
  getFieldChromeStyle,
  getShellBarStyle,
  getIconButtonStyle,
  getSegmentedGroupStyle,
  getSegmentedButtonStyle,
  getPrimaryActionButtonStyle,
} from './primitives-parts/surface-styles'

export { BrandMark, NotificationCountBadge } from './primitives-parts/brand'
export { FieldInput, FieldSelect, FieldTextarea } from './primitives-parts/fields'
export { ModalWorkspace } from './primitives-parts/modal-workspace'
export { Chip } from './primitives-parts/chip'
export { HScrollArea } from './primitives-parts/scroll-area'
export { Bar } from './primitives-parts/bar'
export { Card } from './primitives-parts/card'
export { PageShell, PageBackButton } from './primitives-parts/page'
export { Btn } from './primitives-parts/button'
export { Tooltip, TH, TD } from './primitives-parts/table'
export { RiskBadge, StagePips } from './primitives-parts/risk'
