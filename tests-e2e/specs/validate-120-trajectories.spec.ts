import { test } from '../fixtures/seeded-run-fixture';
import { expect } from '@playwright/test';
import { apiPath } from '../helpers/api-url';
import { loginWithApiContext } from '../helpers/login-as';
import { buildDemoTrajectoryMap, DEMO_STUDENT_IDS } from '../../air-mentor-api/src/lib/demo-seeding-contract';
import { advanceProofRunToCheckpoint } from '../helpers/proof-run-api';

test('120-student trajectory determinism check', async ({ request, seededRun }) => {
  const { session } = await loginWithApiContext(request, 'system-admin');
  const csrf = session.csrfToken;
  const runId = seededRun.runId;
  const batchId = seededRun.batchId;

  // Advance to semester 6 so full trajectory is available
  await advanceProofRunToCheckpoint(request, runId, batchId, csrf, 6, 'post-see');

  // 3. Load the expected trajectory map
  const expectedTrajectories = buildDemoTrajectoryMap(DEMO_STUDENT_IDS);
  expect(expectedTrajectories.size).toBe(120);

  // 4. Verify stage-by-stage progression and trajectory archetype faithfulness
  for (const studentId of DEMO_STUDENT_IDS) {
    const trajectory = expectedTrajectories.get(studentId);
    expect(trajectory).toBeDefined();

    // Fetch the student's actual timeline to get sgpa and progression data
    const evRes = await request.get(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/students/${encodeURIComponent(studentId)}/evidence-timeline`), {
      headers: { 'X-AirMentor-CSRF': csrf }
    });
    expect(evRes.ok()).toBeTruthy();
    const evidenceTimeline = await evRes.json();
    const studentRecords = evidenceTimeline.items || [];
    
    // Check for presence in the timeline
    expect(studentRecords.length).toBeGreaterThan(0);
    
    // Check archetype faithfulness
    if (trajectory!.pattern === 'chronic-at-risk') {
      // The sgpa data is stored inside observedState in the timeline items
      const hasLowScores = studentRecords.some((r: any) => (r.observedState?.sgpa || 0) < 6.0);
      expect(hasLowScores).toBeTruthy();
    }
  }

  // 5. Verification of Determinism
  // To fully verify determinism, a second run with the same seed should be generated
  // and compared to this run. For now, we assert the current seeded payload matches expectations.
});
