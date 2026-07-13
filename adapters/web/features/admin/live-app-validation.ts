import { AirMentorApiError } from '@web/shared/api/client'

export function toErrorMessage(error: unknown) {
  if (error instanceof AirMentorApiError) {
    const details = error.details
    if (details && typeof details === 'object') {
      const fieldErrors = 'fieldErrors' in details && details.fieldErrors && typeof details.fieldErrors === 'object'
        ? Object.entries(details.fieldErrors as Record<string, unknown>)
            .flatMap(([field, messages]) => Array.isArray(messages) ? messages.map(message => `${field}: ${String(message)}`) : [])
        : []
      const formErrors = 'formErrors' in details && Array.isArray(details.formErrors)
        ? details.formErrors.map(message => String(message))
        : []
      const combined = [...fieldErrors, ...formErrors].filter(Boolean)
      if (combined.length > 0) return `${error.message}. ${combined.join(' · ')}`
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'The request could not be completed.'
}

export function requireText(label: string, value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

export function requirePositiveInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive whole number.`)
  return parsed
}

export function requireNonNegativeInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number.`)
  return parsed
}

export function requirePositiveEvenInteger(label: string, value: string) {
  const parsed = requirePositiveInteger(label, value)
  if (parsed % 2 !== 0) throw new Error(`${label} must be an even whole number.`)
  return parsed
}

export function requireDate(label: string, value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${label} must use YYYY-MM-DD format.`)
  return trimmed
}

export function requireRange(label: string, value: string, minimum: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
  return parsed
}
