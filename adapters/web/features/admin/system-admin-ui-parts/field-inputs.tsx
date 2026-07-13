import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Search, X } from 'lucide-react'
import { T, mono } from '@web/simulation/fixtures'
import {
  FieldInput,
  FieldSelect,
  FieldTextarea,
  UI_FONT_SIZES,
  getFieldChromeStyle,
} from '@web/shared/ui/primitives'

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</label>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <FieldInput {...props} />
}

const DROPDOWN_ARROW_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <FieldSelect {...props} style={{
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.55 : 1,
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    backgroundImage: DROPDOWN_ARROW_SVG,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 28,
    ...(props.style ?? {}),
  }} />
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <FieldTextarea {...props} />
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...getFieldChromeStyle(), padding: '0 12px' }}>
        <Search size={14} color={T.muted} />
        <input
          aria-label={ariaLabel}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: T.text, colorScheme: 'inherit', ...mono, fontSize: UI_FONT_SIZES.body }}
        />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            title="Clear"
            onClick={() => onChange('')}
            style={{ width: 24, height: 24, borderRadius: 8, border: 'none', background: 'transparent', color: T.dim, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <X size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
