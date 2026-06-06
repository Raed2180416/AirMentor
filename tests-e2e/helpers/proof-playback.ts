const PROOF_PLAYBACK_SELECTION_STORAGE_KEY = 'airmentor-proof-playback-selection'

type BrowserPage = {
  goto(url: string, options?: { waitUntil?: 'domcontentloaded' }): Promise<unknown>
  evaluate(script: string): Promise<unknown>
}

export async function pinProofPlaybackCheckpoint(
  page: BrowserPage,
  runId: string,
  checkpointId: string,
  workspace: 'academic' | 'system-admin' = 'academic',
) {
  const storageKey = JSON.stringify(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)
  const selection = JSON.stringify({
    simulationRunId: runId,
    simulationStageCheckpointId: checkpointId,
    updatedAt: new Date().toISOString(),
    workspace,
    source: 'playwright-proof-pin',
  })
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await page.evaluate(`window.localStorage.setItem(${storageKey}, ${JSON.stringify(selection)})`)
}
