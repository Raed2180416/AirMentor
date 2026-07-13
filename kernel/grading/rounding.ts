export type RoundingRules = {
  statusMarkRounding: 'nearest-integer'
  sgpaCgpaDecimals: number
}

export function roundStatusMark(value: number, rules: RoundingRules) {
  if (rules.statusMarkRounding === 'nearest-integer') return Math.round(value)
  return Math.round(value)
}

export function roundToDecimals(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
