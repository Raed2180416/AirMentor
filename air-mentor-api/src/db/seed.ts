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
  facultyCalendarAdminWorkspaces,
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
  riskModelArtifacts,
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
import { seedMsruasProofSandbox } from '../adapters/simulation/msruas-proof-sandbox.js'
import { hashPassword } from '../lib/passwords.js'
import { nowIso } from '../lib/time.js'
import { readFile } from 'node:fs/promises'

export type SeedProfile = 'full' | 'control-only'

export async function resolveSeededProductionModelFamily(bundlePath: string, production: { modelFamily?: string | null }) {
  const requestedFamily = production.modelFamily ?? 'logistic'
  if (requestedFamily !== 'catboost') return requestedFamily

  const decisionPath = path.resolve(path.dirname(bundlePath), 'promotion-decision.json')
  try {
    const decision = JSON.parse(await readFile(decisionPath, 'utf8')) as { decision?: string }
    if (
      decision.decision === 'promote'
      || decision.decision === 'promote-to-production'
      || decision.decision === 'promote-as-primary'
      || decision.decision === 'promoted'
    ) {
      return 'catboost'
    }
    console.error(`[seed] CatBoost bundle is shadow-only (${decision.decision ?? 'no decision'}); seeding logistic production family.`)
  } catch {
    console.error('[seed] CatBoost bundle has no promotion decision; seeding logistic production family.')
  }
  return 'logistic'
}

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

export async function seedIntoDatabase(
  db: AppDb,
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  now = nowIso(),
  options: { profile?: SeedProfile } = {},
) {
  const seedProfile = options.profile ?? 'full'
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
  await db.delete(facultyCalendarAdminWorkspaces)
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

  if (seedProfile === 'control-only') {
    const sysadmin = seedData.faculty.find(faculty => faculty.facultyId === 'fac_sysadmin')
    if (!sysadmin) throw new Error('Control-only seed profile requires fac_sysadmin in platform seed data')
    await db.insert(userAccounts).values({
      userId: sysadmin.userId,
      institutionId: seedData.institution.institutionId,
      username: sysadmin.username,
      email: sysadmin.email,
      phone: sysadmin.phone,
      status: sysadmin.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(userPasswordCredentials).values({
      userId: sysadmin.userId,
      passwordHash: await hashPassword(sysadmin.password),
      updatedAt: now,
    })
    await db.insert(uiPreferences).values({
      userId: sysadmin.userId,
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: now,
    })
    await db.insert(facultyProfiles).values({
      facultyId: sysadmin.facultyId,
      userId: sysadmin.userId,
      employeeCode: sysadmin.employeeCode,
      displayName: sysadmin.displayName,
      designation: sysadmin.designation,
      joinedOn: sysadmin.joinedOn,
      status: sysadmin.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const systemAdminGrant = sysadmin.roleGrants.find(grant => grant.roleCode === 'SYSTEM_ADMIN')
    if (!systemAdminGrant) throw new Error('Control-only seed profile requires a SYSTEM_ADMIN grant for fac_sysadmin')
    await db.insert(roleGrants).values({
      grantId: systemAdminGrant.grantId,
      facultyId: sysadmin.facultyId,
      roleCode: systemAdminGrant.roleCode,
      scopeType: systemAdminGrant.scopeType,
      scopeId: systemAdminGrant.scopeId,
      startDate: systemAdminGrant.startDate,
      endDate: null,
      status: systemAdminGrant.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(policyOverrides).values(institutionPolicyOverride)
    return
  }

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

    // Seed default course outcomes so graph builder shows outcome nodes
    const seenCourseOutcomes = new Set<string>()
    const outcomeRows: Array<typeof courseOutcomeOverrides.$inferInsert> = []
    for (const row of curriculumRows) {
      const key = `${row.courseId}::${row.batchId}`
      if (seenCourseOutcomes.has(key)) continue
      seenCourseOutcomes.add(key)
      outcomeRows.push({
        courseOutcomeOverrideId: `outcome_override_${sanitizeIdPart(row.batchId)}_${sanitizeIdPart(row.courseCode)}`,
        courseId: row.courseId,
        scopeType: 'batch',
        scopeId: row.batchId,
        outcomesJson: JSON.stringify([
          { id: 'co_1', desc: `Understand core concepts of ${row.title}`, bloom: 'understand', masteryTarget: 0.6 },
          { id: 'co_2', desc: `Apply ${row.title} principles to solve problems`, bloom: 'apply', masteryTarget: 0.7 },
          { id: 'co_3', desc: `Analyze and evaluate ${row.title} scenarios`, bloom: 'analyze', masteryTarget: 0.75 },
        ]),
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }
    if (outcomeRows.length > 0) await db.insert(courseOutcomeOverrides).values(outcomeRows)

    // Also seed minimal graph tables so curriculum graph builder works after fresh seed
    const batchToCourses = new Map<string, typeof curriculumRows>()
    for (const row of curriculumRows) {
      if (!batchToCourses.has(row.batchId)) batchToCourses.set(row.batchId, [])
      batchToCourses.get(row.batchId)!.push(row)
    }

    for (const [batchId, courses] of batchToCourses) {
      const importVersionId = `curriculum_import_${sanitizeIdPart(batchId)}_seed_v1`
      const existing = await db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, importVersionId))
      if (existing.length > 0) continue

      const firstSem = Math.min(...courses.map(c => c.semesterNumber))
      const lastSem = Math.max(...courses.map(c => c.semesterNumber))
      const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0)

      await db.insert(curriculumImportVersions).values({
        curriculumImportVersionId: importVersionId,
        batchId,
        sourceLabel: `Auto-seeded from offerings for ${batchId}`,
        sourceChecksum: '',
        sourceType: 'auto_seed',
        compilerVersion: 'seed_v1',
        outputChecksum: '',
        firstSemester: firstSem,
        lastSemester: lastSem,
        courseCount: courses.length,
        totalCredits,
        explicitEdgeCount: 0,
        addedEdgeCount: 0,
        bridgeModuleCount: 0,
        electiveOptionCount: 0,
        unresolvedMappingCount: 0,
        validationStatus: 'seeded',
        completenessCertificateJson: JSON.stringify({ seeded: true }),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })

      const nodeRows = courses.map(c => ({
        curriculumNodeId: `node_${sanitizeIdPart(batchId)}_${sanitizeIdPart(c.courseCode)}`,
        curriculumImportVersionId: importVersionId,
        batchId,
        semesterNumber: c.semesterNumber,
        courseId: c.courseId,
        courseCode: c.courseCode,
        title: c.title,
        credits: c.credits,
        internalCompilerId: c.courseCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        officialWebCode: null,
        officialWebTitle: null,
        matchStatus: 'auto_seeded',
        mappingNote: 'Auto-seeded from batch offerings',
        assessmentProfile: 'theory_heavy',
        outcomeBloomLevel: null,
        outcomeMasteryTarget: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }))

      await db.insert(curriculumNodes).values(nodeRows)

      const partitionRows = courses.flatMap(c => {
        const nodeId = `node_${sanitizeIdPart(batchId)}_${sanitizeIdPart(c.courseCode)}`
        return ['tt1', 'tt2', 'see', 'workbook'].map(kind => ({
          courseTopicPartitionId: `topic_${kind}_${sanitizeIdPart(batchId)}_${sanitizeIdPart(c.courseCode)}`,
          curriculumImportVersionId: importVersionId,
          curriculumNodeId: nodeId,
          partitionKind: kind,
          topicsJson: JSON.stringify([]),
          createdAt: now,
          updatedAt: now,
        }))
      })

      await db.insert(courseTopicPartitions).values(partitionRows)
    }
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

      const runtimePayload = seedData.academicAssets.runtime as Record<string, unknown>
      const timetablePayload = (runtimePayload.timetableByFacultyId as Record<string, unknown> | undefined) ?? {}
      const timetableEntries = Object.entries(timetablePayload)
        .filter(([, payload]) => payload && typeof payload === 'object')
      if (timetableEntries.length > 0) {
        await db.insert(facultyCalendarWorkspaces).values(timetableEntries.map(([facultyId, payload]) => ({
          facultyId,
          templateJson: JSON.stringify(payload),
          version: 1,
          createdAt: now,
          updatedAt: now,
        })))
      }

      const adminWorkspacePayload = (runtimePayload.adminCalendarByFacultyId as Record<string, unknown> | undefined) ?? {}
      const adminWorkspaceEntries = Object.entries(adminWorkspacePayload)
        .filter(([, payload]) => payload && typeof payload === 'object')
      if (adminWorkspaceEntries.length > 0) {
        await db.insert(facultyCalendarAdminWorkspaces).values(adminWorkspaceEntries.map(([facultyId, payload]) => ({
          facultyId,
          workspaceJson: JSON.stringify(payload),
          version: 1,
          createdAt: now,
          updatedAt: now,
        })))
      }
    }
  }

  await seedMsruasProofSandbox(db, {
    institutionId: seedData.institution.institutionId,
    now,
    policy: DEFAULT_POLICY,
  })

  try {
    const seedDir = path.dirname(fileURLToPath(import.meta.url))
    const bundleCandidates = [
      process.env.AIRMENTOR_RISK_MODEL_BUNDLE_PATH
        ? path.resolve(process.env.AIRMENTOR_RISK_MODEL_BUNDLE_PATH)
        : null,
      path.resolve(process.cwd(), 'output/proof-risk-model/risk-model-bundle.json'),
      path.resolve(process.cwd(), 'model-contract/proof-risk-model/risk-model-bundle.json'),
      path.resolve(seedDir, '../../output/proof-risk-model/risk-model-bundle.json'),
      path.resolve(seedDir, '../../model-contract/proof-risk-model/risk-model-bundle.json'),
    ].filter((candidate): candidate is string => Boolean(candidate))

    let bundlePath = ''
    let bundleRaw = ''
    for (const candidate of [...new Set(bundleCandidates)]) {
      try {
        bundleRaw = await readFile(candidate, 'utf8')
        bundlePath = candidate
        break
      } catch {
        // Try the next explicit runtime or repository contract location.
      }
    }
    if (!bundlePath) {
      throw new Error(`risk model bundle not found; checked ${bundleCandidates.join(', ')}`)
    }
    console.error(`[seed] found risk model bundle at ${bundlePath}`)
    const bundle = JSON.parse(bundleRaw)
    if (bundle && bundle.production && bundle.challenger && bundle.correlations) {
      const productionModelFamily = await resolveSeededProductionModelFamily(bundlePath, bundle.production)
      bundle.production.modelFamily = productionModelFamily
      console.error(`[seed] seeding ${productionModelFamily} risk model artifacts into risk_model_artifacts...`)
      await db.insert(riskModelArtifacts).values([
        {
          riskModelArtifactId: `rma_prod_${Date.now()}`,
          batchId: 'batch_branch_mnc_btech_2023',
          simulationRunId: 'sim_mnc_2023_first6_v1',
          curriculumFeatureProfileId: null,
          curriculumFeatureProfileFingerprint: null,
          artifactType: 'production',
          modelFamily: productionModelFamily,
          artifactVersion: bundle.production.modelVersion,
          featureSchemaVersion: bundle.production.featureSchemaVersion,
          sourceRunIdsJson: JSON.stringify([]),
          payloadJson: JSON.stringify(bundle.production),
          evaluationJson: JSON.stringify({}),
          status: 'active',
          activeFlag: 1,
          createdByFacultyId: 'fac_sysadmin',
          createdAt: now,
          updatedAt: now,
        },
        {
          riskModelArtifactId: `rma_chal_${Date.now()}`,
          batchId: 'batch_branch_mnc_btech_2023',
          simulationRunId: 'sim_mnc_2023_first6_v1',
          curriculumFeatureProfileId: null,
          curriculumFeatureProfileFingerprint: null,
          artifactType: 'challenger',
          modelFamily: bundle.challenger.modelFamily,
          artifactVersion: bundle.challenger.modelVersion,
          featureSchemaVersion: bundle.challenger.featureSchemaVersion,
          sourceRunIdsJson: JSON.stringify([]),
          payloadJson: JSON.stringify(bundle.challenger),
          evaluationJson: JSON.stringify({}),
          status: 'active',
          activeFlag: 1,
          createdByFacultyId: 'fac_sysadmin',
          createdAt: now,
          updatedAt: now,
        },
        {
          riskModelArtifactId: `rma_corr_${Date.now()}`,
          batchId: 'batch_branch_mnc_btech_2023',
          simulationRunId: 'sim_mnc_2023_first6_v1',
          curriculumFeatureProfileId: null,
          curriculumFeatureProfileFingerprint: null,
          artifactType: 'correlation',
          modelFamily: 'association-summary',
          artifactVersion: bundle.correlations.artifactVersion,
          featureSchemaVersion: bundle.correlations.featureSchemaVersion,
          sourceRunIdsJson: JSON.stringify([]),
          payloadJson: JSON.stringify(bundle.correlations),
          evaluationJson: JSON.stringify({}),
          status: 'active',
          activeFlag: 1,
          createdByFacultyId: 'fac_sysadmin',
          createdAt: now,
          updatedAt: now,
        }
      ])
      console.error(`[seed] successfully seeded ${productionModelFamily} risk model artifacts.`)
    } else {
      console.warn(`[seed] risk model bundle was empty or invalid.`)
    }
  } catch (error) {
    console.warn(`[seed] skipped seeding risk model artifacts: ${(error as Error).message}`)
  }
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
