import { eq } from 'drizzle-orm'
import seedData from './seeds/platform.seed.json' with { type: 'json' }
import { type AppDb, createDb, createPool } from './client.js'
import { loadConfig } from '../config.js'
import { runSqlMigrations } from './migrate.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adminRequestNotes,
  adminReminders,
  academicFaculties,
  academicTerms,
  academicCalendarAuditEvents,
  adminRequestTransitions,
  academicAssets,
  academicMeetings,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  adminRequests,
  academicRuntimeState,
  auditEvents,
  batches,
  alertDecisions,
  alertOutcomes,
  bridgeModules,
  branches,
  courseTopicPartitions,
  courses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  curriculumCourses,
  departments,
  electiveBaskets,
  electiveOptions,
  electiveRecommendations,
  facultyAppointments,
  facultyCalendarWorkspaces,
  courseOutcomeOverrides,
  facultyOfferingOwnerships,
  facultyProfiles,
  institutions,
  mentorAssignments,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  policyOverrides,
  reassessmentEvents,
  riskAssessments,
  roleGrants,
  sectionOfferings,
  semesterTransitionLogs,
  simulationResetSnapshots,
  simulationRuns,
  studentAssessmentScores,
  sessions,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
  studentAcademicProfiles,
  studentAttendanceSnapshots,
  studentEnrollments,
  studentInterventions,
  studentLatentStates,
  studentObservedSemesterStates,
  students,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptSubjectResults,
  transcriptTermResults,
  uiPreferences,
  userAccounts,
  userPasswordCredentials,
} from './schema.js'
import { DEFAULT_POLICY } from '../modules/admin-structure.js'
import { seedMsruasProofSandbox } from '../lib/msruas-proof-sandbox.js'
import { hashPassword } from '../lib/passwords.js'
import { nowIso } from '../lib/time.js'

function parseAcademicYearStart(academicYearLabel: string) {
  const match = academicYearLabel.match(/^(\d{4})/)
  return match ? Number(match[1]) : new Date().getUTCFullYear()
}

function inferAdmissionYear(academicYearLabel: string, semesterNumber: number) {
  return parseAcademicYearStart(academicYearLabel) - Math.floor((semesterNumber - 1) / 2)
}

function buildBatchId(branchId: string, admissionYear: number) {
  return `batch_${branchId}_${admissionYear}`
}

function sanitizeIdPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
}

export async function seedDatabase(databaseUrl: string) {
  const pool = createPool(databaseUrl)
  const db = createDb(pool)
  try {
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
    await runSqlMigrations(pool, migrationsDir)
    await seedIntoDatabase(db, pool)

    const adminProfile = await db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, 'fac_sysadmin'))
    return {
      institutionId: seedData.institution.institutionId,
      adminFacultyId: adminProfile[0]?.facultyId ?? null,
    }
  } finally {
    await pool.end()
  }
}

export async function seedIntoDatabase(db: AppDb, client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, now = nowIso()) {
  const seededAcademicFaculty = {
    academicFacultyId: 'academic_faculty_engineering_and_technology',
    institutionId: seedData.institution.institutionId,
    code: 'ENG',
    name: 'Engineering and Technology',
    overview: 'Default seeded academic faculty for the current engineering departments.',
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  } as const

  const termBatchIdByTermId = Object.fromEntries(seedData.terms.map(term => {
    const admissionYear = inferAdmissionYear(term.academicYearLabel, term.semesterNumber)
    return [term.termId, buildBatchId(term.branchId, admissionYear)]
  }))

  const batchAccumulator = new Map<string, {
    batchId: string
    branchId: string
    admissionYear: number
    batchLabel: string
    currentSemester: number
    sectionLabels: Set<string>
  }>()

  for (const term of seedData.terms) {
    const admissionYear = inferAdmissionYear(term.academicYearLabel, term.semesterNumber)
    const batchId = buildBatchId(term.branchId, admissionYear)
    const current = batchAccumulator.get(batchId)
    if (current) {
      current.currentSemester = Math.max(current.currentSemester, term.semesterNumber)
    } else {
      batchAccumulator.set(batchId, {
        batchId,
        branchId: term.branchId,
        admissionYear,
        batchLabel: String(admissionYear),
        currentSemester: term.semesterNumber,
        sectionLabels: new Set<string>(),
      })
    }
  }

  for (const offering of seedData.offerings) {
    const batchId = termBatchIdByTermId[offering.termId]
    if (!batchId) continue
    batchAccumulator.get(batchId)?.sectionLabels.add(offering.sectionCode)
  }

  for (const studentSeed of seedData.students) {
    for (const enrollment of studentSeed.enrollments) {
      const batchId = termBatchIdByTermId[enrollment.termId]
      if (!batchId) continue
      batchAccumulator.get(batchId)?.sectionLabels.add(enrollment.sectionCode)
    }
  }

  const seededBatches = Array.from(batchAccumulator.values()).map(item => ({
    batchId: item.batchId,
    branchId: item.branchId,
    admissionYear: item.admissionYear,
    batchLabel: item.batchLabel,
    currentSemester: item.currentSemester,
    sectionLabelsJson: JSON.stringify(Array.from(item.sectionLabels).sort()),
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }))

  const courseById = Object.fromEntries(seedData.courses.map(course => [course.courseId, course]))
  const termById = Object.fromEntries(seedData.terms.map(term => [term.termId, term]))
  const curriculumRows: Array<{
    curriculumCourseId: string
    batchId: string
    semesterNumber: number
    courseId: string
    courseCode: string
    title: string
    credits: number
    status: string
    version: number
    createdAt: string
    updatedAt: string
  }> = []
  const curriculumSeen = new Set<string>()

  for (const offering of seedData.offerings) {
    const course = courseById[offering.courseId]
    const term = termById[offering.termId]
    const batchId = termBatchIdByTermId[offering.termId]
    if (!course || !term || !batchId) continue
    const uniqueKey = `${batchId}::${term.semesterNumber}::${course.courseCode}`
    if (curriculumSeen.has(uniqueKey)) continue
    curriculumSeen.add(uniqueKey)
    curriculumRows.push({
      curriculumCourseId: `curriculum_${sanitizeIdPart(batchId)}_${term.semesterNumber}_${sanitizeIdPart(course.courseCode)}`,
      batchId,
      semesterNumber: term.semesterNumber,
      courseId: course.courseId,
      courseCode: course.courseCode,
      title: course.title,
      credits: course.defaultCredits,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  const institutionPolicyOverride = {
    policyOverrideId: 'policy_institution_default',
    scopeType: 'institution',
    scopeId: seedData.institution.institutionId,
    policyJson: JSON.stringify(DEFAULT_POLICY),
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  const seededPolicyOverrides = [institutionPolicyOverride]
  const highestBatch = seededBatches.slice().sort((left, right) => right.currentSemester - left.currentSemester)[0]
  if (highestBatch) {
    seededPolicyOverrides.push({
      policyOverrideId: `policy_batch_${sanitizeIdPart(highestBatch.batchId)}`,
      scopeType: 'batch',
      scopeId: highestBatch.batchId,
      policyJson: JSON.stringify({
        ceSeeSplit: {
          ce: 60,
          see: 40,
        },
        ceComponentCaps: {
          termTestsWeight: 25,
          quizWeight: 10,
          assignmentWeight: 25,
          maxTermTests: 2,
          maxQuizzes: 2,
          maxAssignments: 3,
        },
      }),
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  await db.delete(alertOutcomes)
  await db.delete(alertDecisions)
  await db.delete(reassessmentEvents)
  await db.delete(riskAssessments)
  await db.delete(electiveRecommendations)
  await db.delete(simulationResetSnapshots)
  await db.delete(semesterTransitionLogs)
  await db.delete(studentAgentMessages)
  await db.delete(studentAgentSessions)
  await db.delete(studentAgentCards)
  await db.delete(studentObservedSemesterStates)
  await db.delete(studentLatentStates)
  await db.delete(teacherAllocations)
  await db.delete(teacherLoadProfiles)
  await db.delete(simulationRuns)
  await db.delete(electiveOptions)
  await db.delete(electiveBaskets)
  await db.delete(courseTopicPartitions)
  await db.delete(bridgeModules)
  await db.delete(curriculumEdges)
  await db.delete(curriculumNodes)
  await db.delete(curriculumImportVersions)
  await db.delete(auditEvents)
  await db.delete(adminReminders)
  await db.delete(adminRequestTransitions)
  await db.delete(adminRequestNotes)
  await db.delete(adminRequests)
  await db.delete(academicRuntimeState)
  await db.delete(academicAssets)
  await db.delete(policyOverrides)
  await db.delete(courseOutcomeOverrides)
  await db.delete(curriculumCourses)
  await db.delete(academicCalendarAuditEvents)
  await db.delete(academicTaskPlacements)
  await db.delete(academicTaskTransitions)
  await db.delete(academicTasks)
  await db.delete(academicMeetings)
  await db.delete(facultyCalendarWorkspaces)
  await db.delete(offeringQuestionPapers)
  await db.delete(offeringAssessmentSchemes)
  await db.delete(facultyOfferingOwnerships)
  await db.delete(transcriptSubjectResults)
  await db.delete(transcriptTermResults)
  await db.delete(studentInterventions)
  await db.delete(studentAssessmentScores)
  await db.delete(studentAttendanceSnapshots)
  await db.delete(sectionOfferings)
  await db.delete(mentorAssignments)
  await db.delete(studentEnrollments)
  await db.delete(studentAcademicProfiles)
  await db.delete(students)
  await db.delete(roleGrants)
  await db.delete(facultyAppointments)
  await db.delete(facultyProfiles)
  await db.delete(uiPreferences)
  await db.delete(userPasswordCredentials)
  await db.delete(sessions)
  await db.delete(userAccounts)
  await db.delete(academicTerms)
  await db.delete(batches)
  await db.delete(courses)
  await db.delete(branches)
  await db.delete(departments)
  await db.delete(academicFaculties)
  await db.delete(institutions)

  await db.insert(institutions).values({
    ...seedData.institution,
    createdAt: now,
    updatedAt: now,
    version: 1,
  })

  await db.insert(academicFaculties).values(seededAcademicFaculty)

  if (seedData.departments.length > 0) {
    await db.insert(departments).values(seedData.departments.map(item => ({
      ...item,
      institutionId: seedData.institution.institutionId,
      academicFacultyId: seededAcademicFaculty.academicFacultyId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })))
  }

  if (seedData.branches.length > 0) {
    await db.insert(branches).values(seedData.branches.map(item => ({
      ...item,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })))
  }

  if (seededBatches.length > 0) {
    await db.insert(batches).values(seededBatches)
  }

  if (seedData.terms.length > 0) {
    await db.insert(academicTerms).values(seedData.terms.map(item => ({
      ...item,
      batchId: termBatchIdByTermId[item.termId] ?? null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })))
  }

  for (const faculty of seedData.faculty) {
    await db.insert(userAccounts).values({
      userId: faculty.userId,
      institutionId: seedData.institution.institutionId,
      username: faculty.username,
      email: faculty.email,
      phone: faculty.phone,
      status: faculty.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(userPasswordCredentials).values({
      userId: faculty.userId,
      passwordHash: await hashPassword(faculty.password),
      updatedAt: now,
    })
    await db.insert(uiPreferences).values({
      userId: faculty.userId,
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: now,
    })
    await db.insert(facultyProfiles).values({
      facultyId: faculty.facultyId,
      userId: faculty.userId,
      employeeCode: faculty.employeeCode,
      displayName: faculty.displayName,
      designation: faculty.designation,
      joinedOn: faculty.joinedOn,
      status: faculty.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    if (faculty.appointments.length > 0) {
      await db.insert(facultyAppointments).values(faculty.appointments.map(item => ({
        appointmentId: item.appointmentId,
        facultyId: faculty.facultyId,
        departmentId: item.departmentId,
        branchId: item.branchId,
        isPrimary: item.isPrimary ? 1 : 0,
        startDate: item.startDate,
        endDate: null,
        status: item.status,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })))
    }
    if (faculty.roleGrants.length > 0) {
      await db.insert(roleGrants).values(faculty.roleGrants.map(item => ({
        grantId: item.grantId,
        facultyId: faculty.facultyId,
        roleCode: item.roleCode,
        scopeType: item.scopeType,
        scopeId: item.scopeId,
        startDate: item.startDate,
        endDate: null,
        status: item.status,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })))
    }
  }

  for (const studentSeed of seedData.students) {
    await db.insert(students).values({
      studentId: studentSeed.studentId,
      institutionId: seedData.institution.institutionId,
      usn: studentSeed.usn,
      rollNumber: studentSeed.rollNumber,
      name: studentSeed.name,
      email: studentSeed.email,
      phone: studentSeed.phone,
      admissionDate: studentSeed.admissionDate,
      status: studentSeed.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(studentAcademicProfiles).values({
      studentId: studentSeed.studentId,
      prevCgpaScaled: Math.round(Number(studentSeed.prevCgpa ?? 0) * 100),
      createdAt: now,
      updatedAt: now,
    })
    if (studentSeed.enrollments.length > 0) {
      await db.insert(studentEnrollments).values(studentSeed.enrollments.map(item => ({
        enrollmentId: item.enrollmentId,
        studentId: studentSeed.studentId,
        branchId: item.branchId,
        termId: item.termId,
        sectionCode: item.sectionCode,
        rosterOrder: item.rosterOrder ?? 0,
        academicStatus: item.academicStatus,
        startDate: item.startDate,
        endDate: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })))
    }
    if (studentSeed.mentorAssignments.length > 0) {
      await db.insert(mentorAssignments).values(studentSeed.mentorAssignments.map(item => ({
        assignmentId: item.assignmentId,
        studentId: studentSeed.studentId,
        facultyId: item.facultyId,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: null,
        source: item.source,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })))
    }
  }

  if (seedData.courses.length > 0) {
    await db.insert(courses).values(seedData.courses.map(item => ({
      ...item,
      institutionId: seedData.institution.institutionId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })))
  }

  if (curriculumRows.length > 0) {
    await db.insert(curriculumCourses).values(curriculumRows)
  }

  if (seededPolicyOverrides.length > 0) {
    await db.insert(policyOverrides).values(seededPolicyOverrides)
  }

  if (seedData.offerings.length > 0) {
    await db.insert(sectionOfferings).values(seedData.offerings.map(item => ({
      offeringId: item.offeringId,
      courseId: item.courseId,
      termId: item.termId,
      branchId: item.branchId,
      sectionCode: item.sectionCode,
      yearLabel: item.yearLabel,
      attendance: item.attendance,
      studentCount: item.studentCount,
      stage: item.stage,
      stageLabel: item.stageLabel,
      stageDescription: item.stageDescription,
      stageColor: item.stageColor,
      tt1Done: item.tt1Done ? 1 : 0,
      tt2Done: item.tt2Done ? 1 : 0,
      tt1Locked: item.tt1Locked ? 1 : 0,
      tt2Locked: item.tt2Locked ? 1 : 0,
      quizLocked: item.quizLocked ? 1 : 0,
      assignmentLocked: item.assignmentLocked ? 1 : 0,
      pendingAction: item.pendingAction,
      status: item.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })))
  }

  if (seedData.offeringOwnerships.length > 0) {
    await db.insert(facultyOfferingOwnerships).values(seedData.offeringOwnerships.map(item => ({
      ownershipId: item.ownershipId,
      offeringId: item.offeringId,
      facultyId: item.facultyId,
      ownershipRole: item.ownershipRole,
      status: item.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })))
  }

  if (seedData.adminRequests.length > 0) {
    await db.insert(adminRequests).values(seedData.adminRequests.map(item => ({
      adminRequestId: item.adminRequestId,
      requestType: item.requestType,
      scopeType: item.scopeType,
      scopeId: item.scopeId,
      targetEntityRefsJson: JSON.stringify(item.targetEntityRefs),
      priority: item.priority,
      status: item.status,
      requestedByRole: item.requestedByRole,
      requestedByFacultyId: item.requestedByFacultyId,
      ownedByRole: item.ownedByRole,
      ownedByFacultyId: item.ownedByFacultyId,
      summary: item.summary,
      details: item.details,
      notesThreadId: item.notesThreadId,
      dueAt: item.dueAt,
      slaPolicyCode: item.slaPolicyCode,
      decision: item.decision,
      payloadJson: JSON.stringify(item.payload),
      version: 1,
      createdAt: now,
      updatedAt: now,
    })))

    await db.insert(adminRequestTransitions).values(seedData.adminRequests.map(item => ({
      transitionId: `${item.adminRequestId}_seed_transition`,
      adminRequestId: item.adminRequestId,
      previousStatus: null,
      nextStatus: item.status,
      actorRole: 'SYSTEM_ADMIN',
      actorFacultyId: item.ownedByFacultyId,
      noteId: null,
      affectedEntityRefsJson: JSON.stringify(item.targetEntityRefs),
      createdAt: now,
    })))

    await db.insert(auditEvents).values(seedData.adminRequests.map(item => ({
      auditEventId: `${item.adminRequestId}_seed_audit`,
      entityType: 'AdminRequest',
      entityId: item.adminRequestId,
      action: 'seeded',
      actorRole: 'SYSTEM_ADMIN',
      actorId: item.ownedByFacultyId,
      beforeJson: null,
      afterJson: JSON.stringify(item),
      metadataJson: JSON.stringify({ seeded: true }),
      createdAt: now,
    })))
  }

  if (seedData.academicAssets) {
    const assets = [
      ['professor', seedData.academicAssets.professor],
      ['faculty', seedData.academicAssets.faculty],
      ['offerings', seedData.academicAssets.offerings],
      ['yearGroups', seedData.academicAssets.yearGroups],
      ['subjectRuns', seedData.academicAssets.subjectRuns],
      ['teachers', seedData.academicAssets.teachers],
      ['offeringsById', seedData.academicAssets.offeringsById],
      ['studentsByOffering', seedData.academicAssets.studentsByOffering],
      ['menteesByUsn', seedData.academicAssets.menteesByUsn],
      ['studentHistoryByUsn', seedData.academicAssets.studentHistoryByUsn],
    ] as const
    if (assets.length > 0) {
      await db.insert(academicAssets).values(assets.map(([assetKey, payload]) => ({
        assetKey,
        payloadJson: JSON.stringify(payload),
        version: 1,
        updatedAt: now,
      })))
    }

    const runtimeEntries = Object.entries(seedData.academicAssets.runtime)
    if (runtimeEntries.length > 0) {
      await db.insert(academicRuntimeState).values(runtimeEntries.map(([stateKey, payload]) => ({
        stateKey,
        payloadJson: JSON.stringify(payload),
        version: 1,
        updatedAt: now,
      })))
    }
  }

  await seedMsruasProofSandbox(db, {
    institutionId: seedData.institution.institutionId,
    now,
    policy: DEFAULT_POLICY,
  })
}

export async function main() {
  const config = loadConfig()
  await seedDatabase(config.databaseUrl)
}

const currentFilePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
