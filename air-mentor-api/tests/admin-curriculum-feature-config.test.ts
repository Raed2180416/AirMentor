import { afterEach, describe, expect, it } from 'vitest'
import { MSRUAS_PROOF_BATCH_ID } from '../src/lib/msruas-proof-sandbox.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('admin curriculum feature config', () => {
  it('keeps the proof batch under CSE with two 60-student sections', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [departmentsResponse, branchesResponse, batchesResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/admin/departments',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/branches',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/batches',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/students',
        headers: { cookie: adminLogin.cookie },
      }),
    ])

    expect(departmentsResponse.statusCode).toBe(200)
    expect(branchesResponse.statusCode).toBe(200)
    expect(batchesResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)

    const departments = departmentsResponse.json().items as Array<{ departmentId: string; academicFacultyId: string | null }>
    const branches = branchesResponse.json().items as Array<{ branchId: string; departmentId: string }>
    const batches = batchesResponse.json().items as Array<{ batchId: string; branchId: string; sectionLabels: string[] }>
    const students = studentsResponse.json().items as Array<{
      activeAcademicContext: null | { batchId: string | null; sectionCode: string | null }
    }>

    const proofDepartment = departments.find(item => item.departmentId === 'dept_cse') ?? null
    const proofBranch = branches.find(item => item.branchId === 'branch_mnc_btech') ?? null
    const proofBatch = batches.find(item => item.batchId === MSRUAS_PROOF_BATCH_ID) ?? null

    expect(proofDepartment?.academicFacultyId).toBe('academic_faculty_engineering_and_technology')
    expect(proofBranch?.departmentId).toBe('dept_cse')
    expect(proofBatch?.branchId).toBe('branch_mnc_btech')
    expect(proofBatch?.sectionLabels).toEqual(['A', 'B'])

    const proofStudents = students.filter(item => item.activeAcademicContext?.batchId === MSRUAS_PROOF_BATCH_ID)
    const sectionCounts = proofStudents.reduce<Record<string, number>>((acc, item) => {
      const sectionCode = item.activeAcademicContext?.sectionCode ?? 'unknown'
      acc[sectionCode] = (acc[sectionCode] ?? 0) + 1
      return acc
    }, {})

    expect(proofStudents).toHaveLength(120)
    expect(sectionCounts).toEqual({ A: 60, B: 60 })
  })

  it('round-trips sysadmin-owned model inputs for a proof batch course', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const initialResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/curriculum-feature-config`,
      headers: { cookie: adminLogin.cookie },
    })

    expect(initialResponse.statusCode).toBe(200)
    const initialConfig = initialResponse.json() as {
      items: Array<{
        curriculumCourseId: string
        semesterNumber: number
        courseCode: string
        assessmentProfile: string
      }>
    }

    const targetCourse = initialConfig.items.find(item => item.semesterNumber >= 6) ?? initialConfig.items[0] ?? null
    const prerequisiteCourse = initialConfig.items.find(item => item.curriculumCourseId !== targetCourse?.curriculumCourseId) ?? null

    expect(targetCourse).toBeTruthy()
    expect(prerequisiteCourse).toBeTruthy()
    if (!targetCourse || !prerequisiteCourse) throw new Error('Expected seeded proof curriculum courses for the feature config test')

    const updateResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/curriculum-feature-config/${targetCourse.curriculumCourseId}`,
      headers: {
        cookie: adminLogin.cookie,
        origin: TEST_ORIGIN,
      },
      payload: {
        assessmentProfile: 'ce-40-see-60',
        outcomes: [
          { id: 'CO1', bloom: 'Analyze', desc: 'Diagnose prerequisite gaps before TT1 closes.' },
          { id: 'CO2', bloom: 'Create', desc: 'Build a recovery plan from weak outcome evidence.' },
        ],
        prerequisites: [
          {
            sourceCourseCode: prerequisiteCourse.courseCode,
            edgeKind: 'explicit',
            rationale: 'Required foundation for the proof-batch regression test.',
          },
        ],
        bridgeModules: ['Vector refresher', 'Discrete structures remediation'],
        topicPartitions: {
          tt1: ['Module 1 foundations', 'Module 2 proofs'],
          tt2: ['Module 3 optimization'],
          see: ['Module 4 synthesis'],
          workbook: ['Lab remediation worksheet'],
        },
      },
    })

    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json()).toMatchObject({
      ok: true,
      batchId: MSRUAS_PROOF_BATCH_ID,
      curriculumCourseId: targetCourse.curriculumCourseId,
      curriculumImportVersionId: expect.any(String),
    })

    const refreshedResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/curriculum-feature-config`,
      headers: { cookie: adminLogin.cookie },
    })

    expect(refreshedResponse.statusCode).toBe(200)
    const refreshedConfig = refreshedResponse.json() as {
      curriculumImportVersion: null | { curriculumImportVersionId: string }
      items: Array<{
        curriculumCourseId: string
        assessmentProfile: string
        outcomes: Array<{ id: string; bloom: string; desc: string }>
        prerequisites: Array<{ sourceCourseCode: string; edgeKind: 'explicit' | 'added'; rationale: string }>
        bridgeModules: string[]
        topicPartitions: { tt1: string[]; tt2: string[]; see: string[]; workbook: string[] }
      }>
    }
    const refreshedCourse = refreshedConfig.items.find(item => item.curriculumCourseId === targetCourse.curriculumCourseId) ?? null

    expect(refreshedConfig.curriculumImportVersion?.curriculumImportVersionId).toBe(updateResponse.json().curriculumImportVersionId)
    expect(refreshedCourse).toMatchObject({
      assessmentProfile: 'ce-40-see-60',
      outcomes: [
        { id: 'CO1', bloom: 'Analyze', desc: 'Diagnose prerequisite gaps before TT1 closes.' },
        { id: 'CO2', bloom: 'Create', desc: 'Build a recovery plan from weak outcome evidence.' },
      ],
      prerequisites: [
        {
          sourceCourseCode: prerequisiteCourse.courseCode,
          edgeKind: 'explicit',
          rationale: 'Required foundation for the proof-batch regression test.',
        },
      ],
      bridgeModules: ['Discrete structures remediation', 'Vector refresher'],
      topicPartitions: {
        tt1: ['Module 1 foundations', 'Module 2 proofs'],
        tt2: ['Module 3 optimization'],
        see: ['Module 4 synthesis'],
        workbook: ['Lab remediation worksheet'],
      },
    })
  })
})
