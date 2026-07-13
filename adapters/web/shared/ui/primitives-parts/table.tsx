import type { CSSProperties, ReactNode } from 'react'
import { T, mono } from '@web/simulation/fixtures'
import { UI_FONT_SIZES } from './tokens'

export const Tooltip = ({ label, children }: { label: string; children: ReactNode }) => (
  <span title={label} style={{ borderBottom: `1px dashed currentColor`, cursor: 'help', textDecoration: 'none' }}>{children}</span>
)

export const TH = ({ children }: { children: ReactNode }) => (
  <th style={{ textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${T.border}`, ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>
)

export const TD = ({ children, style = {}, ...rest }: { children: ReactNode; style?: CSSProperties; colSpan?: number }) => (
  <td {...rest} style={{ padding: '11px 12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle', ...style }}>{children}</td>
)
