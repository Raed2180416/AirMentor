export function apiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const explicitApiBase = process.env.AIRMENTOR_PW_API_BASE_URL?.trim() || 'http://127.0.0.1:4000'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${explicitApiBase.replace(/\/$/, '')}${normalizedPath}`
}
