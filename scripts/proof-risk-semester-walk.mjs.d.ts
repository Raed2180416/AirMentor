export function sanitizeArtifactPrefix(rawPrefix: unknown): string
export function parseProofTargetSemester(rawValue: unknown): number | null
export function normalizeSemesterTargetList(rawValue: unknown): number[]
export function resolveSemesterWalkCheckpoint<T extends {
  simulationStageCheckpointId?: string | null
  semesterNumber?: number | null
  stageOrder?: number | null
}>(checkpoints: T[], targetSemester?: number | null): T | undefined
export function buildSemesterScopedArtifactPath(rawPath: string, prefix: unknown, semesterNumber: number): string | null
export function buildSemesterProofSummaryPath(outputDir: string, prefix: unknown, semesterNumber: number): string | null
export function buildCombinedSemesterProofSummaryPath(outputDir: string, prefix: unknown): string | null
