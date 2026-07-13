import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { getFieldChromeStyle } from './surface-styles'

export function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...getFieldChromeStyle(), ...(props.style ?? {}) }} />
}

export function FieldSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...getFieldChromeStyle(), ...(props.style ?? {}) }} />
}

export function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...getFieldChromeStyle(), resize: 'vertical', ...(props.style ?? {}) }} />
}
