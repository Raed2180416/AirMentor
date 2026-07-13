export type GradeBand = {
  grade: string
  minimumMark: number
  maximumMark: number
  gradePoint: number
}

export function mapGradeBand(mark: number, gradeBands: GradeBand[]) {
  const safeMark = Math.max(0, Math.min(100, mark))
  return gradeBands.find(band => safeMark >= band.minimumMark && safeMark <= band.maximumMark)
    ?? gradeBands.slice().sort((left, right) => left.minimumMark - right.minimumMark)[0]
}
