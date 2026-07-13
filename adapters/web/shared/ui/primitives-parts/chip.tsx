import type { ReactNode } from 'react'
import { T, mono } from '@web/simulation/fixtures'
import { getAccessibleChipPalette } from './color'
import { UI_RADII } from './tokens'

export const Chip = ({ children, color = T.muted, size = 11 }: { children: ReactNode; color?: string; size?: number }) => {
  const palette = getAccessibleChipPalette(color)
  return (
    <span
      style={{
        ...mono,
        fontSize: size,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: UI_RADII.chip,
        background: palette.background,
        color: palette.tone,
        border: `1px solid ${palette.border}`,
        whiteSpace: 'nowrap' as const,
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  )
}
