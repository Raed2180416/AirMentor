export function apiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const explicitApiBase = process.env.AIRMENTOR_PW_API_BASE_URL?.trim()
  if (!explicitApiBase) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${explicitApiBase.replace(/\/$/, '')}${normalizedPath}`
}
