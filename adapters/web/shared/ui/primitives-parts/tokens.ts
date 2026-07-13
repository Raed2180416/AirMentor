export const UI_EASE = [0.22, 1, 0.36, 1] as const
export const UI_TRANSITION_FAST = { duration: 0.18, ease: UI_EASE } as const
export const UI_TRANSITION_MEDIUM = { duration: 0.26, ease: UI_EASE } as const
export const UI_FONT_SIZES = {
  micro: 9,
  eyebrow: 10,
  meta: 11,
  body: 12,
  bodyStrong: 13,
  title: 16,
  heading: 18,
  hero: 28,
} as const
export const UI_RADII = {
  chip: 10,
  button: 12,
  field: 14,
  card: 18,
  panel: 20,
  modal: 24,
  pill: 999,
} as const
