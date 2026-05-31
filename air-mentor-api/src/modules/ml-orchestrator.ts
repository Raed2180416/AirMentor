import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync } from 'fs'
import { join } from 'path'
import { eq, and, desc } from 'drizzle-orm'
import { AppDb } from '../db/client.js'
import { simulationRuns, riskModelArtifacts } from '../db/schema.js'
import { createId } from '../lib/ids.js'

const execAsync = promisify(exec)

export function startMlOrchestrator(db: AppDb) {
  let isRunning = false

  setInterval(async () => {
    if (isRunning) return
    isRunning = true
    try {
      // Find recently completed simulation runs from auto-publish
      const [run] = await db.select()
        .from(simulationRuns)
        .where(
          and(
            eq(simulationRuns.status, 'completed'),
            eq(simulationRuns.runLabel, 'Curriculum Adaptation Check (auto-publish)')
          )
        )
        .orderBy(desc(simulationRuns.completedAt))
        .limit(1)

      if (run) {
        console.log(`[ML Orchestrator] Found newly completed simulation run ${run.simulationRunId}. Starting ML pipeline...`)
        
        // Mark as processing to avoid duplicate runs
        await db.update(simulationRuns)
          .set({ runLabel: 'Curriculum Adaptation Check (auto-publish) - PROCESSING' })
          .where(eq(simulationRuns.simulationRunId, run.simulationRunId))

        // 1. Run Data Extraction & Training & Promotion
        try {
          // This script automatically spawns train_catboost_challenger.py and evaluates promotion gates.
          await execAsync('npm run evaluate:proof-risk-model', { cwd: process.cwd(), env: { ...process.env, AIRMENTOR_EVAL_OUTPUT_DIR: 'output/proof-risk-model' } })
          console.log(`[ML Orchestrator] ML training and extraction completed successfully.`)

          // Read the promotion decision
          const promotionPath = join(process.cwd(), 'output', 'proof-risk-model', 'promotion-decision.json')
          const promotionDecision = JSON.parse(readFileSync(promotionPath, 'utf8'))
          console.log(`[ML Orchestrator] Promotion Decision: ${promotionDecision.decision} - ${promotionDecision.reasoning}`)

          // Store promotion decision metadata if needed
          if (promotionDecision.decision === 'PROMOTED') {
            console.log(`[ML Orchestrator] Promoting CatBoost model for batch ${run.batchId}...`)
            
            // Find the active production artifact
            const [activeProd] = await db.select().from(riskModelArtifacts)
              .where(and(eq(riskModelArtifacts.batchId, run.batchId), eq(riskModelArtifacts.artifactType, 'production'), eq(riskModelArtifacts.activeFlag, 1)))
              .limit(1)

            if (activeProd) {
              // Deprecate old one
              await db.update(riskModelArtifacts)
                .set({ activeFlag: 0 })
                .where(eq(riskModelArtifacts.riskModelArtifactId, activeProd.riskModelArtifactId))

              // Insert new one
              await db.insert(riskModelArtifacts).values({
                ...activeProd,
                riskModelArtifactId: createId('risk_model_artifact'),
                modelFamily: 'catboost',
                artifactVersion: promotionDecision.metrics?.challenger?.version || 'catboost_v1',
                activeFlag: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              console.log(`[ML Orchestrator] CatBoost model successfully promoted in database!`)
            }
          }
          // 3. Mark as processed
          await db.update(simulationRuns)
            .set({ runLabel: `Curriculum Adaptation Check (auto-publish) - PROCESSED - ${promotionDecision.decision}` })
            .where(eq(simulationRuns.simulationRunId, run.simulationRunId))
            
          console.log(`[ML Orchestrator] Orchestration cycle complete for ${run.simulationRunId}.`)
        } catch (execErr) {
          console.error(`[ML Orchestrator] Error during script execution for ${run.simulationRunId}:`, execErr)
          // Revert label so it can be retried or mark as FAILED
          await db.update(simulationRuns)
            .set({ runLabel: 'Curriculum Adaptation Check (auto-publish) - FAILED' })
            .where(eq(simulationRuns.simulationRunId, run.simulationRunId))
        }
      }
    } catch (err) {
      console.error('[ML Orchestrator] Error during orchestration cycle:', err)
    } finally {
      isRunning = false
    }
  }, 15000)
}
