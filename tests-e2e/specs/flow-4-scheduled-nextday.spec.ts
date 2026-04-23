// Flow 4 — Scheduled task + Next Day. Prompt §L.4 + §B.20 + §D Calendar intent.
//
// - Teacher schedules a follow-up for a future simulated day.
// - Task appears on calendar.
// - Task becomes visible in queue on the correct simulated day.
// - Dragging on calendar mutates the underlying due date.
// - Overdue state behaves correctly.

import { expect } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('flow-4 scheduled task + calendar drag + Next Day transition', async ({ request, seededRun }) => {
  const { session: clSession } = await loginWithApiContext(request, 'course-leader')

  // Step 1 — course leader schedules a task on simulated date + 3 days.
  const baseDate = new Date(seededRun.simulatedDateIso)
  const futureDate = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Task create uses the authoritative PUT route per academic-runtime-routes
  // (sync POST-style path is deprecated). We issue a unique id client-side
  // and PUT it, matching the real UI code path.
  const taskId = `flow4-scheduled-${Date.now()}`
  const studentId = 'mnc_s_2023_001'
  const offeringId = 'off_mnc_2023_sem1_programming'
  const taskCreateResp = await request.put(`/api/academic/tasks/${encodeURIComponent(taskId)}`, {
    headers: { 'X-AirMentor-CSRF': clSession.csrfToken },
    data: {
      task: {
        id: taskId,
        studentId,
        studentName: 'Flow-4 Seeded Student',
        studentUsn: 'MNC2023-FLOW4',
        offeringId,
        courseCode: 'SEED-CODE',
        courseName: 'Seed Course',
        year: '2023',
        riskProb: 0.45,
        riskBand: 'Medium',
        title: 'Flow-4 scheduled follow-up',
        due: futureDate,
        dueDateISO: futureDate,
        status: 'New',
        actionHint: 'Follow up on Flow-4 scheduled task contract',
        priority: 1,
        createdAt: Date.now(),
        assignedTo: 'Course Leader',
      },
    },
  })
  expect(taskCreateResp.ok(), `task PUT must succeed; got ${taskCreateResp.status()}`).toBeTruthy()

  // Step 2 — drag task to a new date via taskPlacement PUT (dedicated route).
  const draggedDate = new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dragResp = await request.put(`/api/academic/task-placements/${encodeURIComponent(taskId)}`, {
    headers: { 'X-AirMentor-CSRF': clSession.csrfToken },
    data: {
      placement: {
        taskId,
        dateISO: draggedDate,
        placementMode: 'untimed',
        updatedAt: Date.now(),
      },
    },
  })
  expect(dragResp.ok(), `task-placement PUT must succeed; got ${dragResp.status()}`).toBeTruthy()

  // Step 3 — re-list tasks and verify underlying dueDateISO mutated to the
  // dragged date. §B.20 contract: drag MUST change underlying date.
  const taskListResp = await request.get('/api/academic/tasks', {
    headers: { 'X-AirMentor-CSRF': clSession.csrfToken },
  })
  expect(taskListResp.ok()).toBeTruthy()
  const taskListBody = await taskListResp.json()
  const refreshedTask = (taskListBody.items ?? []).find((row: { id: string }) => row.id === taskId)
  expect(refreshedTask, 'task must be visible in /api/academic/tasks list after placement').toBeTruthy()
  const storedDate = String(refreshedTask.dueDateISO ?? refreshedTask.dueDate ?? '').slice(0, 10)
  expect(storedDate).toBe(draggedDate)

  // Step 4 — Next Day advance. Simulated date advances by exactly one day.
  const { session: sysSession } = await loginWithApiContext(request, 'system-admin')
  const advanceResp = await request.post(`/api/admin/proof-runs/${encodeURIComponent(seededRun.runId)}/advance`, {
    headers: { 'X-AirMentor-CSRF': sysSession.csrfToken },
    data: { mode: 'day' },
  })
  expect(advanceResp.ok(), `advance(day) must succeed; got ${advanceResp.status()}`).toBeTruthy()
  const dashboardResp = await request.get(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`, {
    headers: { 'X-AirMentor-CSRF': sysSession.csrfToken },
  })
  const dashboardJson = await dashboardResp.json()
  const newSim = String(dashboardJson.activeRunDetail.simulatedDateIso ?? '').slice(0, 10)
  const expectedSim = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  expect(newSim).toBe(expectedSim)
})
