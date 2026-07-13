/**
 * Retired batch-provision cascade (R9).
 *
 * The offering provisioning endpoint is a single multi-table transactional
 * CASCADE (offerings -> ownerships -> enrollments -> profiles -> attendance /
 * transcript scaffolding) whose parity tests lock EXACT row counts and insert
 * order. Per the R9 no-split rule it is kept as ONE cohesive adapter file rather
 * than being fragmented across use-cases. The body below is moved VERBATIM from
 * the legacy handler in modules/academic-admin-offerings-routes.ts — no logic,
 * query, ordering or row-count semantics changed.
 *
 * NOTE: the very first executed statement is `rejectRetiredBatchProvisioning()`,
 * which always throws — the entire cascade beneath it is retained verbatim but
 * is currently unreachable (the endpoint always returns the "retired" 400).
 *
 * This file exceeds the 400-line architecture cap as one function by design
 * (transactional cascade must not be split); flag it to the orchestrator for a
 * ratchet exception.
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../../../../app.js'
import {
  academicTerms,
  batches,
  branches,
  courses,
  departments,
  facultyAppointments,
  facultyCalendarWorkspaces,
  facultyOfferingOwnerships,
  facultyProfiles,
  institutions,
  mentorAssignments,
  curriculumCourses,
  roleGrants,
  sectionOfferings,
  simulationRuns,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentEnrollments,
  students,
  transcriptSubjectResults,
  transcriptTermResults,
} from '../../../../db/schema.js'
import {
  buildFacultyTimetableTemplates,
  getFacultyMentorProvisioningEligibility,
  weeklyContactHoursForCourse,
} from '../../../../lib/academic-provisioning.js'
import { createId } from '../../../../lib/ids.js'
import { badRequest, notFound } from '../../../../lib/http-errors.js'
import { parseJson, stringifyJson } from '../../../../lib/json.js'
import { DEFAULT_STAGE_POLICY } from '../../../../lib/stage-policy.js'
import type { AcademicRouteDependencies } from '../../../../modules/academic.js'
import {
  enqueueProofRefreshForBatches,
  resolveBatchCurriculumFeatures,
  resolveBatchPolicy,
  resolveBatchStagePolicy,
} from '../../../../modules/admin-structure.js'
import { emitAuditEvent, parseOrThrow, requireRole } from '../../../../modules/support.js'

function rejectRetiredBatchProvisioning(): void {
  throw badRequest('Batch provisioning is retired. Start the canonical demo simulation from the System Admin Proof Dashboard.')
}

export async function provisionBatch(
  context: RouteContext,
  deps: AcademicRouteDependencies,
  request: FastifyRequest,
) {
  const {
    batchProvisioningSchema,
    getAcademicRuntimeState,
    mockStudentIdentity,
    saveAcademicRuntimeState,
  } = deps

  const auth = requireRole(request, ['SYSTEM_ADMIN'])
  rejectRetiredBatchProvisioning()
  const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
  const body = parseOrThrow(batchProvisioningSchema, request.body)
  const now = context.now()
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [term] = await context.db.select().from(academicTerms).where(eq(academicTerms.termId, body.termId))
  if (!term) throw notFound('Academic term not found')
  if (term.batchId && term.batchId !== batch.batchId) throw badRequest('Term does not belong to the selected batch')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')
  const [activeLiveRun] = await context.db
    .select({ simulationRunId: simulationRuns.simulationRunId })
    .from(simulationRuns)
    .where(and(eq(simulationRuns.batchId, params.batchId), eq(simulationRuns.activeFlag, 1), isNull(simulationRuns.demoWorkspaceId)))
    .limit(1)
  if (activeLiveRun) throw badRequest('An active live simulation run exists for this batch. Archive or reset it before reprovisioning.')
  const sections = (body.sectionLabels.length > 0 ? body.sectionLabels : parseJson(batch.sectionLabelsJson, [] as string[]))
    .map(item => item.trim())
    .filter(Boolean)
  if (sections.length === 0) throw badRequest('At least one section label is required for provisioning')

  const [resolvedBatchPolicy, resolvedStagePolicy, resolvedCurriculumFeatures, curriculumRows, courseRows, appointmentRows, facultyRows, grantRows, existingOwnershipRows, existingOfferings, existingStudents, existingEnrollments, _existingMentorRows, existingAttendanceRows, existingAssessmentRows, existingTranscriptRows, existingTranscriptSubjectRows, existingProfileRows, existingCalendars, runtimeStudentPatches, runtimeDrafts, runtimeCellValues, runtimeLockByOffering, runtimeLockAuditByTarget] = await Promise.all([
    resolveBatchPolicy(context, params.batchId),
    resolveBatchStagePolicy(context, params.batchId),
    resolveBatchCurriculumFeatures(context, params.batchId),
    context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, params.batchId)),
    context.db.select().from(courses),
    context.db.select().from(facultyAppointments),
    context.db.select().from(facultyProfiles),
    context.db.select().from(roleGrants),
    context.db.select().from(facultyOfferingOwnerships),
    context.db.select().from(sectionOfferings),
    context.db.select().from(students),
    context.db.select().from(studentEnrollments),
    context.db.select().from(mentorAssignments),
    context.db.select().from(studentAttendanceSnapshots),
    context.db.select().from(studentAssessmentScores),
    context.db.select().from(transcriptTermResults),
    context.db.select().from(transcriptSubjectResults),
    context.db.select().from(studentAcademicProfiles),
    context.db.select().from(facultyCalendarWorkspaces),
    getAcademicRuntimeState(context, 'studentPatches') as Promise<Record<string, unknown>>,
    getAcademicRuntimeState(context, 'drafts') as Promise<Record<string, number>>,
    getAcademicRuntimeState(context, 'cellValues') as Promise<Record<string, number>>,
    getAcademicRuntimeState(context, 'lockByOffering') as Promise<Record<string, Record<string, boolean>>>,
    getAcademicRuntimeState(context, 'lockAuditByTarget') as Promise<Record<string, unknown>>,
  ])
  const scopedCurriculum = curriculumRows
    .filter(row => row.status !== 'deleted' && row.status !== 'archived' && row.semesterNumber === term.semesterNumber)
    .sort((left, right) => left.courseCode.localeCompare(right.courseCode))
  if (scopedCurriculum.length === 0) {
    throw badRequest('No active curriculum rows exist for the selected batch and semester')
  }
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const featureByCurriculumCourseId = new Map(resolvedCurriculumFeatures.items.map(item => [item.curriculumCourseId, item]))
  const stageSeed = resolvedStagePolicy.effectivePolicy.stages[0] ?? DEFAULT_STAGE_POLICY.stages[0]

  const eligibleAppointments = appointmentRows.filter(row => (
    (body.facultyPoolIds && body.facultyPoolIds.length > 0 ? body.facultyPoolIds.includes(row.facultyId) : true)
    && row.status !== 'deleted'
    && (row.branchId === branch.branchId || row.departmentId === department.departmentId)
  ))
  const facultyPool = facultyRows.filter(row => (
    (body.facultyPoolIds && body.facultyPoolIds.length > 0 ? body.facultyPoolIds.includes(row.facultyId) : eligibleAppointments.some(appointment => appointment.facultyId === row.facultyId))
    && row.status !== 'deleted'
  ))
  if (facultyPool.length === 0) throw badRequest('No active faculty pool is available for provisioning')
  const mentorEligibilitySectionCode = sections.length === 1 ? sections[0] ?? null : null
  const mentorEligibleFacultyPool = facultyPool.filter(faculty => getFacultyMentorProvisioningEligibility({
    facultyId: faculty.facultyId,
    effectiveFrom: term.startDate,
    scope: {
      academicFacultyId: department.academicFacultyId,
      departmentId: department.departmentId,
      branchId: branch.branchId,
      batchId: batch.batchId,
      sectionCode: mentorEligibilitySectionCode,
    },
    appointments: appointmentRows,
    roleGrants: grantRows,
  }).eligible)
  if (body.createMentors && mentorEligibleFacultyPool.length === 0) {
    throw badRequest(
      'No active mentor-eligible faculty are available for provisioning in the selected scope.',
      { reasons: ['Provisioning mentor creation requires an active appointment plus an active MENTOR grant that covers the selected batch or section.'] },
    )
  }

  const offeringByKey = new Map<string, typeof sectionOfferings.$inferSelect>(
    existingOfferings.map(row => [`${row.termId}::${row.courseId}::${row.sectionCode}`, row] as const),
  )
  const activeOwnershipByOfferingId = new Map(
    existingOwnershipRows
      .filter(row => row.status === 'active')
      .map(row => [row.offeringId, row] as const),
  )
  const loadByFacultyId = new Map<string, number>(facultyPool.map(row => [row.facultyId, 0]))
  activeOwnershipByOfferingId.forEach(row => {
    loadByFacultyId.set(row.facultyId, (loadByFacultyId.get(row.facultyId) ?? 0) + 1)
  })

  const assignedLoads = new Map<string, Array<{ offeringId: string; courseCode: string; courseName: string; sectionCode: string; semesterNumber: number; weeklyHours: number }>>()
  const provisionedOfferings: typeof sectionOfferings.$inferSelect[] = []
  let createdOfferingCount = 0
  for (const curriculumCourse of scopedCurriculum) {
    const featureConfig = featureByCurriculumCourseId.get(curriculumCourse.curriculumCourseId)
    const course = curriculumCourse.courseId ? courseById.get(curriculumCourse.courseId) : null
    if (!course) continue
    const weeklyHours = weeklyContactHoursForCourse({
      title: course.title,
      assessmentProfile: featureConfig?.assessmentProfile ?? 'admin-authored',
      credits: curriculumCourse.credits,
    })
    for (const sectionCode of sections) {
      const key = `${term.termId}::${course.courseId}::${sectionCode}`
      const existingOffering = offeringByKey.get(key)
      if (existingOffering) {
        provisionedOfferings.push(existingOffering)
        if (!activeOwnershipByOfferingId.has(existingOffering.offeringId)) {
          const assignedFaculty = [...facultyPool].sort((left, right) => (
            (loadByFacultyId.get(left.facultyId) ?? 0) - (loadByFacultyId.get(right.facultyId) ?? 0)
            || left.facultyId.localeCompare(right.facultyId)
          ))[0]
          const createdOwnership = {
            ownershipId: createId('ownership'),
            offeringId: existingOffering.offeringId,
            facultyId: assignedFaculty.facultyId,
            ownershipRole: 'course-professor',
            status: 'active',
            version: 1,
            createdAt: now,
            updatedAt: now,
          } as typeof facultyOfferingOwnerships.$inferSelect
          await context.db.insert(facultyOfferingOwnerships).values(createdOwnership)
          activeOwnershipByOfferingId.set(existingOffering.offeringId, createdOwnership)
          loadByFacultyId.set(assignedFaculty.facultyId, (loadByFacultyId.get(assignedFaculty.facultyId) ?? 0) + weeklyHours)
        }
        continue
      }
      const created = {
        offeringId: createId('offering'),
        courseId: course.courseId,
        termId: term.termId,
        branchId: branch.branchId,
        sectionCode,
        yearLabel: `${Math.ceil(term.semesterNumber / 2)} Year`,
        attendance: 0,
        studentCount: 0,
        stage: stageSeed.order,
        stageLabel: stageSeed.label,
        stageDescription: stageSeed.description,
        stageColor: stageSeed.color,
        tt1Done: 0,
        tt2Done: 0,
        tt1Locked: 0,
        tt2Locked: 0,
        quizLocked: 0,
        assignmentLocked: 0,
        finalsLocked: 0,
        pendingAction: null,
        status: 'active',
        demoWorkspaceId: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      await context.db.insert(sectionOfferings).values(created)
      offeringByKey.set(key, created)
      provisionedOfferings.push(created)
      createdOfferingCount += 1
      const assignedFaculty = [...facultyPool].sort((left, right) => (
        (loadByFacultyId.get(left.facultyId) ?? 0) - (loadByFacultyId.get(right.facultyId) ?? 0)
        || left.facultyId.localeCompare(right.facultyId)
      ))[0]
      loadByFacultyId.set(assignedFaculty.facultyId, (loadByFacultyId.get(assignedFaculty.facultyId) ?? 0) + weeklyHours)
      assignedLoads.set(assignedFaculty.facultyId, [
        ...(assignedLoads.get(assignedFaculty.facultyId) ?? []),
        {
          offeringId: created.offeringId,
          courseCode: course.courseCode,
          courseName: course.title,
          sectionCode,
          semesterNumber: term.semesterNumber,
          weeklyHours,
        },
      ])
      const existingOwnership = activeOwnershipByOfferingId.get(created.offeringId) ?? null
      if (!existingOwnership) {
        const createdOwnership = {
          ownershipId: createId('ownership'),
          offeringId: created.offeringId,
          facultyId: assignedFaculty.facultyId,
          ownershipRole: 'course-professor',
          status: 'active',
          demoWorkspaceId: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        } as typeof facultyOfferingOwnerships.$inferSelect
        await context.db.insert(facultyOfferingOwnerships).values(createdOwnership)
        activeOwnershipByOfferingId.set(created.offeringId, createdOwnership)
      }
    }
  }

  for (const offering of provisionedOfferings) {
    const existingOwnership = activeOwnershipByOfferingId.get(offering.offeringId) ?? null
    if (existingOwnership) {
      const course = courseById.get(offering.courseId)
      const curriculumCourse = scopedCurriculum.find(row => row.courseId === offering.courseId)
      const featureConfig = curriculumCourse ? featureByCurriculumCourseId.get(curriculumCourse.curriculumCourseId) : null
      if (!course || !curriculumCourse) continue
      assignedLoads.set(existingOwnership.facultyId, [
        ...(assignedLoads.get(existingOwnership.facultyId) ?? []),
        {
          offeringId: offering.offeringId,
          courseCode: course.courseCode,
          courseName: course.title,
          sectionCode: offering.sectionCode,
          semesterNumber: term.semesterNumber,
          weeklyHours: weeklyContactHoursForCourse({
            title: course.title,
            assessmentProfile: featureConfig?.assessmentProfile ?? 'admin-authored',
            credits: curriculumCourse.credits,
          }),
        },
      ])
    }
  }

  const timetablePayload = buildFacultyTimetableTemplates(assignedLoads)
  for (const [facultyId, template] of Object.entries(timetablePayload)) {
    const existing = existingCalendars.find(row => row.facultyId === facultyId) ?? null
    if (existing) {
      await context.db.update(facultyCalendarWorkspaces).set({
        templateJson: stringifyJson(template),
        version: existing.version + 1,
        updatedAt: now,
      }).where(eq(facultyCalendarWorkspaces.facultyId, facultyId))
    } else {
      await context.db.insert(facultyCalendarWorkspaces).values({
        facultyId,
        templateJson: stringifyJson(template),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  let createdStudentCount = 0
  let createdEnrollmentCount = 0
  let createdMentorCount = 0
  let createdAttendanceCount = 0
  const createdAssessmentCount = 0
  let createdTranscriptCount = 0
  const resetOfferingIds = new Set<string>()
  const sectionEnrollments = existingEnrollments.filter(row => row.termId === term.termId && sections.includes(row.sectionCode) && row.academicStatus === 'active')
  const sectionCounts = new Map<string, number>()
  sections.forEach(sectionCode => sectionCounts.set(sectionCode, sectionEnrollments.filter(row => row.sectionCode === sectionCode).length))
  const institutionId = existingStudents[0]?.institutionId ?? (await context.db.select().from(institutions).limit(1))[0]?.institutionId
  if (!institutionId) throw notFound('Institution is not configured')
  const existingUsnSet = new Set(existingStudents.map(row => row.usn))
  const profileStudentIds = new Set(existingProfileRows.map(row => row.studentId))

  if (body.mode !== 'mock' && body.createStudents) {
    throw badRequest('Synthetic student creation is only available in mock mode.')
  }

  if (body.mode === 'mock') {
    for (const sectionCode of sections) {
      const currentCount = sectionCounts.get(sectionCode) ?? 0
      for (let offset = currentCount; offset < body.studentsPerSection; offset += 1) {
        const globalIndex = sections.indexOf(sectionCode) * body.studentsPerSection + offset
        const identity = mockStudentIdentity(globalIndex)
        const usnBase = `1MS${String(batch.admissionYear).slice(-2)}${branch.code.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}${String(globalIndex + 1).padStart(3, '0')}`
        const usn = existingUsnSet.has(usnBase) ? `${usnBase}${sectionCode}` : usnBase
        existingUsnSet.add(usn)
        const studentId = createId('student')
        await context.db.insert(students).values({
          studentId,
          institutionId,
          usn,
          rollNumber: `${sectionCode}${String(offset + 1).padStart(3, '0')}`,
          name: identity.name,
          email: identity.email,
          phone: identity.phone,
          admissionDate: `${batch.admissionYear}-08-01`,
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        createdStudentCount += 1
        await context.db.insert(studentEnrollments).values({
          enrollmentId: createId('enrollment'),
          studentId,
          branchId: branch.branchId,
          termId: term.termId,
          sectionCode,
          rosterOrder: offset + 1,
          academicStatus: 'active',
          startDate: term.startDate,
          endDate: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        createdEnrollmentCount += 1
        if (!profileStudentIds.has(studentId)) {
          await context.db.insert(studentAcademicProfiles).values({
            studentId,
            prevCgpaScaled: 650 + ((globalIndex % 25) * 10),
            createdAt: now,
            updatedAt: now,
          })
          profileStudentIds.add(studentId)
        }
        if (body.createMentors && mentorEligibleFacultyPool.length > 0) {
          const mentorFaculty = mentorEligibleFacultyPool[globalIndex % mentorEligibleFacultyPool.length]!
          await context.db.insert(mentorAssignments).values({
            assignmentId: createId('mentor_assignment'),
            studentId,
            facultyId: mentorFaculty.facultyId,
            effectiveFrom: term.startDate,
            effectiveTo: null,
            source: 'sysadmin-provisioning',
            version: 1,
            createdAt: now,
            updatedAt: now,
          })
          createdMentorCount += 1
        }
      }
    }
  }

  const refreshedEnrollments = await context.db.select().from(studentEnrollments).where(eq(studentEnrollments.termId, term.termId))
  const attendanceKeySet = new Set(existingAttendanceRows.map(row => `${row.studentId}::${row.offeringId}`))
  const assessmentRowsByOfferingId = new Map<string, Array<typeof studentAssessmentScores.$inferSelect>>()
  existingAssessmentRows
    .filter(row => row.termId === term.termId)
    .forEach(row => {
      assessmentRowsByOfferingId.set(row.offeringId, [...(assessmentRowsByOfferingId.get(row.offeringId) ?? []), row])
    })
  const transcriptByStudent = new Map(existingTranscriptRows.filter(row => row.termId === term.termId).map(row => [row.studentId, row]))
  const transcriptSubjectKeySet = new Set(existingTranscriptSubjectRows.map(row => `${row.transcriptTermResultId}::${row.courseCode}`))
  const enrollmentsBySection = new Map<string, typeof refreshedEnrollments>()
  sections.forEach(sectionCode => enrollmentsBySection.set(sectionCode, refreshedEnrollments.filter(row => row.sectionCode === sectionCode && row.academicStatus === 'active')))

  for (const offering of provisionedOfferings) {
    const enrolledStudents = enrollmentsBySection.get(offering.sectionCode) ?? []
    const course = courseById.get(offering.courseId)
    if (!course) continue
    const stagePatch: Partial<typeof sectionOfferings.$inferInsert> = {
      studentCount: enrolledStudents.length,
      attendance: body.createAttendanceScaffolding ? 78 : offering.attendance,
      stage: offering.stage,
      stageLabel: offering.stageLabel,
      stageDescription: offering.stageDescription,
      stageColor: offering.stageColor,
      tt1Done: offering.tt1Done,
      tt2Done: offering.tt2Done,
      tt1Locked: offering.tt1Locked,
      tt2Locked: offering.tt2Locked,
      quizLocked: offering.quizLocked,
      assignmentLocked: offering.assignmentLocked,
      finalsLocked: offering.finalsLocked,
      pendingAction: offering.pendingAction,
      version: offering.version + 1,
      updatedAt: now,
    }
    if (offering.stage <= stageSeed.order) {
      stagePatch.stage = stageSeed.order
      stagePatch.stageLabel = stageSeed.label
      stagePatch.stageDescription = stageSeed.description
      stagePatch.stageColor = stageSeed.color
      stagePatch.pendingAction = null
    }
    if (!body.createAttendanceScaffolding && offering.stage <= stageSeed.order) {
      const seededAttendanceRows = existingAttendanceRows.filter(row => row.offeringId === offering.offeringId)
      if (seededAttendanceRows.length > 0) {
        await context.db.delete(studentAttendanceSnapshots).where(eq(studentAttendanceSnapshots.offeringId, offering.offeringId))
      }
      stagePatch.attendance = 0
      resetOfferingIds.add(offering.offeringId)
    }
    if (!body.createAssessmentScaffolding && offering.stage <= stageSeed.order) {
      const seededAssessmentRows = assessmentRowsByOfferingId.get(offering.offeringId) ?? []
      if (seededAssessmentRows.length > 0) {
        await context.db.delete(studentAssessmentScores).where(eq(studentAssessmentScores.offeringId, offering.offeringId))
        assessmentRowsByOfferingId.delete(offering.offeringId)
      }
      stagePatch.tt1Done = 0
      stagePatch.tt2Done = 0
      stagePatch.tt1Locked = 0
      stagePatch.tt2Locked = 0
      stagePatch.quizLocked = 0
      stagePatch.assignmentLocked = 0
      stagePatch.finalsLocked = 0
      resetOfferingIds.add(offering.offeringId)
    }
    await context.db.update(sectionOfferings).set(stagePatch).where(eq(sectionOfferings.offeringId, offering.offeringId))
    for (const [index, enrollment] of enrolledStudents.entries()) {
      if (body.createAttendanceScaffolding) {
        const attendanceKey = `${enrollment.studentId}::${offering.offeringId}`
        if (!attendanceKeySet.has(attendanceKey)) {
          const totalClasses = 50
          const presentClasses = 36 + ((index + offering.sectionCode.charCodeAt(0)) % 12)
          await context.db.insert(studentAttendanceSnapshots).values({
            attendanceSnapshotId: createId('attendance'),
            studentId: enrollment.studentId,
            offeringId: offering.offeringId,
            presentClasses,
            totalClasses,
            attendancePercent: Math.round((presentClasses / totalClasses) * 100),
            source: 'sysadmin-provisioning',
            capturedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          createdAttendanceCount += 1
          attendanceKeySet.add(attendanceKey)
        }
      }
      void index
      if (body.createTranscriptScaffolding) {
        const transcript = transcriptByStudent.get(enrollment.studentId) ?? null
        const ensuredTranscript = transcript ?? {
          transcriptTermResultId: createId('transcript_term'),
          studentId: enrollment.studentId,
          termId: term.termId,
          sgpaScaled: 720 + ((index % 15) * 8),
          registeredCredits: scopedCurriculum.reduce((sum, item) => sum + item.credits, 0),
          earnedCredits: scopedCurriculum.reduce((sum, item) => sum + item.credits, 0),
          backlogCount: 0,
          createdAt: now,
          updatedAt: now,
        }
        if (!transcript) {
          await context.db.insert(transcriptTermResults).values(ensuredTranscript)
          transcriptByStudent.set(enrollment.studentId, ensuredTranscript)
          createdTranscriptCount += 1
        }
        const subjectKey = `${ensuredTranscript.transcriptTermResultId}::${course.courseCode}`
        if (!transcriptSubjectKeySet.has(subjectKey)) {
          const score = 58 + (index % 28)
          const gradeLabel = score >= 90 ? 'O' : score >= 80 ? 'A+' : score >= 70 ? 'A' : score >= 60 ? 'B+' : score >= 55 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'P' : 'F'
          const gradePoint = gradeLabel === 'O' ? 10 : gradeLabel === 'A+' ? 9 : gradeLabel === 'A' ? 8 : gradeLabel === 'B+' ? 7 : gradeLabel === 'B' ? 6 : gradeLabel === 'C' ? 5 : gradeLabel === 'P' ? 4 : 0
          await context.db.insert(transcriptSubjectResults).values({
            transcriptSubjectResultId: createId('transcript_subject'),
            transcriptTermResultId: ensuredTranscript.transcriptTermResultId,
            courseCode: course.courseCode,
            title: course.title,
            credits: scopedCurriculum.find(item => item.courseId === course.courseId)?.credits ?? course.defaultCredits,
            score,
            gradeLabel,
            gradePoint,
            result: score >= 40 ? 'PASS' : 'FAIL',
            createdAt: now,
            updatedAt: now,
          })
          transcriptSubjectKeySet.add(subjectKey)
        }
      }
    }
  }

  if (resetOfferingIds.size > 0) {
    const resetIds = Array.from(resetOfferingIds)
    const shouldResetKey = (key: string) => resetIds.some(offeringId => key.startsWith(`${offeringId}::`))
    const nextStudentPatches = Object.fromEntries(
      Object.entries(runtimeStudentPatches).filter(([key]) => !shouldResetKey(key)),
    )
    const nextDrafts = Object.fromEntries(
      Object.entries(runtimeDrafts).filter(([key]) => !shouldResetKey(key)),
    )
    const nextCellValues = Object.fromEntries(
      Object.entries(runtimeCellValues).filter(([key]) => !shouldResetKey(key)),
    )
    const nextLockByOffering = Object.fromEntries(
      Object.entries(runtimeLockByOffering).map(([offeringId, locks]) => {
        if (!resetOfferingIds.has(offeringId)) return [offeringId, locks]
        return [offeringId, {
          tt1: false,
          tt2: false,
          quiz: false,
          assignment: false,
          finals: false,
          attendance: false,
        }]
      }),
    )
    const nextLockAuditByTarget = Object.fromEntries(
      Object.entries(runtimeLockAuditByTarget).filter(([key]) => !shouldResetKey(key)),
    )
    await Promise.all([
      saveAcademicRuntimeState(context, 'studentPatches', nextStudentPatches),
      saveAcademicRuntimeState(context, 'drafts', nextDrafts),
      saveAcademicRuntimeState(context, 'cellValues', nextCellValues),
      saveAcademicRuntimeState(context, 'lockByOffering', nextLockByOffering),
      saveAcademicRuntimeState(context, 'lockAuditByTarget', nextLockAuditByTarget),
    ])
  }

  await emitAuditEvent(context, {
    entityType: 'BatchProvisioning',
    entityId: params.batchId,
    action: 'executed',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId ?? auth.userId,
    after: {
      batchId: params.batchId,
      termId: term.termId,
      sections,
      mode: body.mode,
    },
    metadata: {
      createdOfferingCount,
      createdStudentCount,
      createdEnrollmentCount,
      createdMentorCount,
      createdAttendanceCount,
      createdAssessmentCount,
      createdTranscriptCount,
      facultyPoolCount: facultyPool.length,
      mentorFacultyPoolCount: mentorEligibleFacultyPool.length,
    },
  })

  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: [params.batchId],
    actorFacultyId: auth.facultyId ?? null,
    now: context.now(),
    curriculumImportVersionId: resolvedCurriculumFeatures.curriculumImportVersion?.curriculumImportVersionId ?? null,
  })

  return {
    ok: true,
    batchId: params.batchId,
    termId: term.termId,
    sections,
    affectedBatchIds: [params.batchId],
    summary: {
      createdOfferingCount,
      createdStudentCount,
      createdEnrollmentCount,
      createdMentorCount,
      createdAttendanceCount,
      createdAssessmentCount,
      createdTranscriptCount,
      facultyPoolCount: facultyPool.length,
      mentorFacultyPoolCount: mentorEligibleFacultyPool.length,
      curriculumCourseCount: scopedCurriculum.length,
    },
    policyFingerprint: resolvedBatchPolicy.effectivePolicy,
    curriculumFeatureProfileFingerprint: resolvedCurriculumFeatures.curriculumFeatureProfileFingerprint,
    proofRefresh,
  }
}
