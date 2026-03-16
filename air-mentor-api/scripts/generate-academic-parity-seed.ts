import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COURSES,
  FACULTY,
  FACULTY_DIRECTORY,
  MENTEES,
  OFFERINGS,
  PROFESSOR,
  YEAR_GROUPS,
  SUBJECT_RUNS,
  TEACHERS,
  getStudentHistoryRecord,
  getStudents,
} from '../../air-mentor-ui/src/data.ts'
import { createLocalAirMentorRepositories } from '../../air-mentor-ui/src/repositories.ts'
import { createTransition, type QueueTransition, type SharedTask, type TaskType } from '../../air-mentor-ui/src/domain.ts'

const BASE_NOW_ISO = '2026-03-16T00:00:00.000Z'
const BASE_NOW = new Date(BASE_NOW_ISO).getTime()

type YearLabel = '1st Year' | '2nd Year' | '3rd Year' | '4th Year'

function toDepartmentId(code: string) {
  return `dept_${code.toLowerCase()}`
}

function toBranchId(code: string) {
  return `branch_${code.toLowerCase()}_btech`
}

function normalizeStudentId(usn: string) {
  return `student_${usn.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

function inferAdmissionDate(yearLabel: string) {
  if (yearLabel === '1st Year') return '2025-08-01'
  if (yearLabel === '2nd Year') return '2024-08-01'
  if (yearLabel === '3rd Year') return '2023-08-01'
  return '2022-08-01'
}

function buildAcademicYearLabel(yearLabel: YearLabel) {
  if (yearLabel === '1st Year') return '2025-26'
  if (yearLabel === '2nd Year') return '2024-25'
  if (yearLabel === '3rd Year') return '2023-24'
  return '2022-23'
}

function createSeedTransition(id: string, input: Omit<QueueTransition, 'id' | 'at'> & { atOffsetHours?: number }) {
  return {
    id,
    at: BASE_NOW + ((input.atOffsetHours ?? 0) * 60 * 60 * 1000),
    actorRole: input.actorRole,
    actorTeacherId: input.actorTeacherId,
    action: input.action,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    note: input.note,
  } satisfies QueueTransition
}

function buildSeedTasks(): SharedTask[] {
  const originalNow = Date.now
  const originalRandom = Math.random
  Date.now = () => BASE_NOW
  Math.random = () => 0.271828
  try {
    const courseLeaderTasks: SharedTask[] = (() => {
      const { generateTasks } = requireAcademicDataModule()
      return generateTasks().map((task: SharedTask, index: number) => ({
        ...task,
        createdAt: BASE_NOW + index,
        updatedAt: BASE_NOW + index,
        taskType: 'Follow-up',
        assignedTo: 'Course Leader',
        transitionHistory: [
          createSeedTransition(`seed-transition-cl-${index}`, {
            action: 'Created from automatic high-risk trigger',
            actorRole: 'Auto',
            toOwner: 'Course Leader',
            note: 'Student crossed automatic academic-risk threshold.',
          }),
        ],
      }))
    })()

    const mentorTasks: SharedTask[] = MENTEES
      .filter(mentee => mentee.avs >= 0.5)
      .slice(0, 8)
      .map((mentee, index) => ({
        id: `mentor-seed-${mentee.id}-${index}`,
        studentId: mentee.id,
        studentName: mentee.name,
        studentUsn: mentee.usn,
        offeringId: '',
        courseCode: mentee.courseRisks[0]?.code ?? 'GEN',
        courseName: mentee.courseRisks[0]?.title ?? 'Mentor Follow-up',
        year: mentee.year,
        riskProb: mentee.avs,
        riskBand: mentee.avs >= 0.7 ? 'High' : mentee.avs >= 0.35 ? 'Medium' : 'Low',
        title: `Mentor follow-up with ${mentee.name.split(' ')[0]}`,
        due: 'This week',
        status: mentee.interventions.length > 0 ? 'In Progress' : 'New',
        actionHint: 'Mentor intervention and counselling review',
        priority: Math.round(mentee.avs * 100),
        createdAt: BASE_NOW + 100 + index,
        updatedAt: BASE_NOW + 100 + index,
        taskType: 'Follow-up' as TaskType,
        assignedTo: 'Mentor',
        transitionHistory: [
          createSeedTransition(`seed-transition-mentor-${index}`, {
            action: 'Created from mentor vulnerability watchlist',
            actorRole: 'Auto',
            toOwner: 'Mentor',
            note: 'Seeded mentor queue item for mock walkthrough.',
          }),
        ],
      }))

    const cs401A = OFFERINGS.find(item => item.code === 'CS401' && item.section === 'A') ?? OFFERINGS[0]
    const cs403C = OFFERINGS.find(item => item.code === 'CS403' && item.section === 'C') ?? OFFERINGS[0]

    const overdueRemedial: SharedTask = {
      id: 'seed-remedial-overdue-m1',
      studentId: 'm1',
      studentName: 'Aarav Sharma',
      studentUsn: '1MS23CS001',
      offeringId: cs401A.offId,
      courseCode: cs401A.code,
      courseName: cs401A.title,
      year: cs401A.year,
      riskProb: 0.82,
      riskBand: 'High',
      title: 'Overdue remedial follow-up for Aarav',
      due: 'Overdue',
      dueDateISO: '2026-03-05',
      status: 'In Progress',
      actionHint: 'Check-in slipped past due date; mentor follow-up is overdue.',
      priority: 92,
      createdAt: BASE_NOW + 1_000,
      updatedAt: BASE_NOW + 1_000,
      taskType: 'Remedial',
      assignedTo: 'Mentor',
      sourceRole: 'Course Leader',
      manual: true,
      remedialPlan: {
        planId: 'plan-aarav-overdue',
        title: 'Algorithm recovery sprint',
        createdAt: BASE_NOW,
        ownerRole: 'Mentor',
        dueDateISO: '2026-03-05',
        checkInDatesISO: ['2026-03-03', '2026-03-08'],
        steps: [
          { id: 'step-1', label: 'Attend remedial on recurrence relations', completedAt: BASE_NOW - 86_400_000 },
          { id: 'step-2', label: 'Submit guided practice sheet' },
          { id: 'step-3', label: 'Mentor review discussion' },
        ],
      },
      transitionHistory: [
        createSeedTransition('seed-transition-aarav-1', {
          action: 'Created and deferred to Mentor',
          actorRole: 'Course Leader',
          fromOwner: 'Course Leader',
          toOwner: 'Mentor',
          note: 'High-risk case handed to mentor for ongoing support.',
        }),
        createSeedTransition('seed-transition-aarav-2', {
          action: 'Remedial check-in logged',
          actorRole: 'Mentor',
          fromOwner: 'Mentor',
          toOwner: 'Mentor',
          note: 'Initial remedial session completed; next step is overdue.',
          atOffsetHours: 1,
        }),
      ],
    }

    const pendingUnlockTask: SharedTask = {
      id: 'seed-unlock-pending-cs401a-tt1',
      studentId: `${cs401A.offId}-tt1-lock`,
      studentName: 'Class Data Lock',
      studentUsn: 'N/A',
      offeringId: cs401A.offId,
      courseCode: cs401A.code,
      courseName: cs401A.title,
      year: cs401A.year,
      riskProb: 0.45,
      riskBand: 'Medium',
      title: `Unlock request: ${cs401A.code} Sec ${cs401A.section} · TT1`,
      due: 'Today',
      status: 'New',
      actionHint: 'Course Leader requested HoD unlock for TT1 correction after late moderation issue.',
      priority: 80,
      createdAt: BASE_NOW + 2_000,
      updatedAt: BASE_NOW + 2_000,
      taskType: 'Academic',
      assignedTo: 'HoD',
      escalated: true,
      sourceRole: 'Course Leader',
      manual: true,
      requestNote: 'Late moderation issue was discovered after TT1 lock. Need controlled correction for a small set of students.',
      handoffNote: 'Please unlock TT1 once moderation discrepancy is verified.',
      unlockRequest: {
        offeringId: cs401A.offId,
        kind: 'tt1',
        status: 'Pending',
        requestedByRole: 'Course Leader',
        requestedByFacultyId: 't1',
        requestedAt: BASE_NOW + 2_000,
        requestNote: 'Late moderation issue was discovered after TT1 lock. Need controlled correction for a small set of students.',
        handoffNote: 'Please unlock TT1 once moderation discrepancy is verified.',
      },
      transitionHistory: [
        createSeedTransition('seed-transition-unlock-pending', {
          action: 'Unlock requested',
          actorRole: 'Course Leader',
          fromOwner: 'Course Leader',
          toOwner: 'HoD',
          note: 'Seeded pending unlock example for mock review flow.',
        }),
      ],
    }

    const rejectedUnlockTask: SharedTask = {
      id: 'seed-unlock-rejected-cs403c-tt1',
      studentId: `${cs403C.offId}-tt1-lock`,
      studentName: 'Class Data Lock',
      studentUsn: 'N/A',
      offeringId: cs403C.offId,
      courseCode: cs403C.code,
      courseName: cs403C.title,
      year: cs403C.year,
      riskProb: 0.35,
      riskBand: 'Medium',
      title: `Unlock request: ${cs403C.code} Sec ${cs403C.section} · TT1`,
      due: 'Resolved',
      status: 'Resolved',
      actionHint: 'Rejected after HoD confirmed mark sheet was already ratified.',
      priority: 60,
      createdAt: BASE_NOW + 3_000,
      updatedAt: BASE_NOW + 3_000,
      taskType: 'Academic',
      assignedTo: 'HoD',
      escalated: true,
      sourceRole: 'Course Leader',
      manual: true,
      requestNote: 'Requested TT1 unlock for a re-evaluation challenge, but the sheet had already been ratified.',
      handoffNote: 'Please review whether this ratified sheet can be reopened.',
      unlockRequest: {
        offeringId: cs403C.offId,
        kind: 'tt1',
        status: 'Rejected',
        requestedByRole: 'Course Leader',
        requestedByFacultyId: 't1',
        requestedAt: BASE_NOW - 86_400_000,
        requestNote: 'Requested TT1 unlock for a re-evaluation challenge, but the sheet had already been ratified.',
        handoffNote: 'Please review whether this ratified sheet can be reopened.',
        reviewedAt: BASE_NOW - 43_200_000,
        reviewNote: 'Ratified score sheet should not be reopened.',
      },
      transitionHistory: [
        createSeedTransition('seed-transition-unlock-rejected-1', {
          action: 'Unlock requested',
          actorRole: 'Course Leader',
          fromOwner: 'Course Leader',
          toOwner: 'HoD',
          note: 'Seeded rejected unlock case.',
          atOffsetHours: -24,
        }),
        createSeedTransition('seed-transition-unlock-rejected-2', {
          action: 'Unlock rejected',
          actorRole: 'HoD',
          fromOwner: 'HoD',
          toOwner: 'HoD',
          note: 'Ratified sheet must remain locked.',
          atOffsetHours: -12,
        }),
      ],
    }

    return [...courseLeaderTasks, overdueRemedial, pendingUnlockTask, rejectedUnlockTask, ...mentorTasks]
  } finally {
    Date.now = originalNow
    Math.random = originalRandom
  }
}

function requireAcademicDataModule() {
  return { generateTasks: (awaitImportCache.generateTasks ??= getGenerateTasks()) }
}

let awaitImportCache: { generateTasks?: () => SharedTask[] } = {}

function getGenerateTasks() {
  const mod = (globalThis as unknown as { __academicDataModule?: { generateTasks: () => SharedTask[] } }).__academicDataModule
  if (mod) return mod.generateTasks
  throw new Error('Academic data module cache is unavailable.')
}

async function main() {
  const academicDataModule = await import('../../air-mentor-ui/src/data.ts')
  ;(globalThis as unknown as { __academicDataModule?: { generateTasks: () => SharedTask[] } }).__academicDataModule = {
    generateTasks: academicDataModule.generateTasks,
  }

  const originalNow = Date.now
  const originalRandom = Math.random
  Date.now = () => BASE_NOW
  Math.random = () => 0.314159
  try {
    const repositories = createLocalAirMentorRepositories()
    const groupedTermMap = new Map<string, { termId: string; branchId: string; academicYearLabel: string; semesterNumber: number; startDate: string; endDate: string; status: string }>()
    const terms: Array<{ termId: string; branchId: string; academicYearLabel: string; semesterNumber: number; startDate: string; endDate: string; status: string }> = []
    for (const offering of OFFERINGS) {
      const yearLabel = offering.year as YearLabel
      const branchId = toBranchId(offering.dept)
      const academicYearLabel = buildAcademicYearLabel(yearLabel)
      const key = `${branchId}::${offering.sem}`
      if (groupedTermMap.has(key)) continue
      const term = {
        termId: `term_${offering.dept.toLowerCase()}_sem${offering.sem}`,
        branchId,
        academicYearLabel,
        semesterNumber: offering.sem,
        startDate: '2026-08-01',
        endDate: '2026-12-15',
        status: 'active',
      }
      groupedTermMap.set(key, term)
      terms.push(term)
    }

    const departments = Array.from(new Set(COURSES.map(course => course.dept))).sort().map(deptCode => ({
      departmentId: toDepartmentId(deptCode),
      code: deptCode,
      name: deptCode === 'CSE' ? 'Computer Science and Engineering' : deptCode === 'ECE' ? 'Electronics and Communication Engineering' : deptCode,
      status: 'active',
    }))

    const branches = departments.map(department => ({
      branchId: toBranchId(department.code),
      departmentId: department.departmentId,
      code: `BTECH-${department.code}`,
      name: `B.Tech ${department.code}`,
      programLevel: 'undergraduate',
      semesterCount: 8,
      status: 'active',
    }))

    const facultyCredentialMap: Record<string, { username: string; password: string; employeeCode: string; designation: string; phone: string }> = {
      t1: { username: 'kavitha.rao', password: '1234', employeeCode: 'EMP-T001', designation: 'Associate Professor', phone: '+91-9000000001' },
      t2: { username: 'arvind.kumar', password: '1234', employeeCode: 'EMP-T002', designation: 'Professor', phone: '+91-9000000002' },
      t3: { username: 'sneha.nair', password: '1234', employeeCode: 'EMP-T003', designation: 'Assistant Professor', phone: '+91-9000000003' },
      t4: { username: 'rajesh.bhat', password: '1234', employeeCode: 'EMP-T004', designation: 'Associate Professor', phone: '+91-9000000004' },
      t5: { username: 'ananya.iyer', password: '1234', employeeCode: 'EMP-T005', designation: 'Assistant Professor', phone: '+91-9000000005' },
      t6: { username: 'vikram.nair', password: '1234', employeeCode: 'EMP-T006', designation: 'Professor', phone: '+91-9000000006' },
    }

    const faculty = [
      {
        userId: 'user_sysadmin',
        facultyId: 'fac_sysadmin',
        username: 'sysadmin',
        email: 'sysadmin@airmentor.local',
        phone: '+91-9000000999',
        employeeCode: 'EMP-0001',
        displayName: 'System Admin',
        designation: 'Administrator',
        joinedOn: '2024-01-01',
        status: 'active',
        password: 'admin1234',
        appointments: [
          {
            appointmentId: 'appt_sysadmin_cse',
            departmentId: toDepartmentId('CSE'),
            branchId: toBranchId('CSE'),
            isPrimary: true,
            startDate: '2024-01-01',
            status: 'active',
          },
        ],
        roleGrants: [
          {
            grantId: 'grant_sysadmin_global',
            roleCode: 'SYSTEM_ADMIN',
            scopeType: 'institution',
            scopeId: 'inst_airmentor',
            startDate: '2024-01-01',
            status: 'active',
          },
          {
            grantId: 'grant_sysadmin_hod_cse',
            roleCode: 'HOD',
            scopeType: 'department',
            scopeId: 'dept_cse',
            startDate: '2024-01-01',
            status: 'active',
          },
        ],
      },
      ...FACULTY.map(account => {
        const credentials = facultyCredentialMap[account.facultyId]
        const directory = FACULTY_DIRECTORY.find(item => item.id === account.facultyId)
        const appointments = [
          {
            appointmentId: `appt_${account.facultyId}_${account.dept.toLowerCase()}`,
            departmentId: toDepartmentId(account.dept),
            branchId: toBranchId(account.dept),
            isPrimary: true,
            startDate: '2024-01-01',
            status: 'active',
          },
        ]
        const roleGrants = account.allowedRoles.map(role => ({
          grantId: `grant_${account.facultyId}_${role.toLowerCase().replace(/\s+/g, '_')}`,
          roleCode: role === 'Course Leader' ? 'COURSE_LEADER' : role === 'Mentor' ? 'MENTOR' : 'HOD',
          scopeType: role === 'HoD' ? 'department' : 'branch',
          scopeId: role === 'HoD' ? toDepartmentId(account.dept) : toBranchId(account.dept),
          startDate: '2024-01-01',
          status: 'active',
        }))
        return {
          userId: `user_${account.facultyId}`,
          facultyId: account.facultyId,
          username: credentials.username,
          email: directory?.email ?? `${credentials.username}@airmentor.local`,
          phone: credentials.phone,
          employeeCode: credentials.employeeCode,
          displayName: account.name,
          designation: credentials.designation,
          joinedOn: '2024-01-01',
          status: 'active',
          password: credentials.password,
          appointments,
          roleGrants,
        }
      }),
    ]

    const courses = COURSES.map(course => ({
      courseId: course.id,
      courseCode: course.code,
      title: course.title,
      defaultCredits: 4,
      departmentId: toDepartmentId(course.dept),
      status: 'active',
    }))

    const offerings = OFFERINGS.map(offering => ({
      offeringId: offering.offId,
      courseId: offering.id,
      termId: `term_${offering.dept.toLowerCase()}_sem${offering.sem}`,
      branchId: toBranchId(offering.dept),
      sectionCode: offering.section,
      yearLabel: offering.year,
      attendance: offering.attendance,
      studentCount: offering.count,
      stage: offering.stage,
      stageLabel: offering.stageInfo.label,
      stageDescription: offering.stageInfo.desc,
      stageColor: offering.stageInfo.color,
      tt1Done: offering.tt1Done,
      tt2Done: offering.tt2Done,
      tt1Locked: !!offering.tt1Locked,
      tt2Locked: !!offering.tt2Locked,
      quizLocked: !!offering.quizLocked,
      assignmentLocked: !!offering.asgnLocked,
      pendingAction: offering.pendingAction,
      status: 'active',
    }))

    const offeringOwnerships = FACULTY.flatMap(account =>
      account.offeringIds.map(offeringId => ({
        ownershipId: `ownership_${account.facultyId}_${offeringId}`,
        offeringId,
        facultyId: account.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      })),
    )

    const mentorFacultyByMenteeId = Object.fromEntries(
      FACULTY.flatMap(account => account.menteeIds.map(menteeId => [menteeId, account.facultyId])),
    )
    const menteeByUsn = Object.fromEntries(MENTEES.map(mentee => [mentee.usn, mentee]))

    const uniqueStudents = new Map<string, {
      studentId: string
      usn: string
      rollNumber: string
      name: string
      email: string
      phone: string
      admissionDate: string
      status: string
      prevCgpa: number
      enrollment: {
        enrollmentId: string
        branchId: string
        termId: string
        sectionCode: string
        academicStatus: string
        startDate: string
        rosterOrder: number
      }
      mentorFacultyId: string | null
    }>()

    const baselineStudentsByOffering = Object.fromEntries(
      OFFERINGS.map(offering => [offering.offId, getStudents(offering)]),
    ) as Record<string, ReturnType<typeof getStudents>>

    for (const offering of OFFERINGS) {
      const termId = `term_${offering.dept.toLowerCase()}_sem${offering.sem}`
      const branchId = toBranchId(offering.dept)
      const roster = getStudents(offering)
      roster.forEach((student, index) => {
        const studentKey = `${termId}::${offering.section}::${student.usn}`
        const existing = uniqueStudents.get(studentKey)
        if (existing) return
        const mentee = menteeByUsn[student.usn] && menteeByUsn[student.usn].section === offering.section && menteeByUsn[student.usn].year === offering.year && menteeByUsn[student.usn].dept === offering.dept
          ? menteeByUsn[student.usn]
          : undefined
        uniqueStudents.set(studentKey, {
          studentId: normalizeStudentId(`${termId}_${offering.section}_${student.usn}`),
          usn: student.usn,
          rollNumber: student.usn.slice(-3),
          name: student.name,
          email: `${student.usn.toLowerCase()}@student.airmentor.local`,
          phone: student.phone,
          admissionDate: inferAdmissionDate(offering.year),
          status: 'active',
          prevCgpa: student.prevCgpa,
          enrollment: {
            enrollmentId: `enrollment_${termId}_${offering.section}_${student.usn.toLowerCase()}`,
            branchId,
            termId,
            sectionCode: offering.section,
            academicStatus: 'active',
            startDate: '2026-08-01',
            rosterOrder: index,
          },
          mentorFacultyId: mentee ? mentorFacultyByMenteeId[mentee.id] ?? null : null,
        })
      })
    }

    const students = Array.from(uniqueStudents.values()).map(student => ({
      studentId: student.studentId,
      usn: student.usn,
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email,
      phone: student.phone,
      admissionDate: student.admissionDate,
      status: student.status,
      prevCgpa: student.prevCgpa,
      enrollments: [student.enrollment],
      mentorAssignments: student.mentorFacultyId ? [{
        assignmentId: `assignment_${student.usn.toLowerCase()}`,
        facultyId: student.mentorFacultyId,
        effectiveFrom: '2026-08-01',
        source: 'seed',
      }] : [],
    }))

    const studentHistoryByUsn = Object.fromEntries(Array.from(uniqueStudents.values()).map(student => {
      const term = terms.find(item => item.termId === student.enrollment.termId)
      const yearLabel = OFFERINGS.find(offering => offering.section === student.enrollment.sectionCode && `term_${offering.dept.toLowerCase()}_sem${offering.sem}` === student.enrollment.termId)?.year
      return [student.usn, getStudentHistoryRecord({
        usn: student.usn,
        studentName: student.name,
        dept: student.enrollment.branchId.includes('ece') ? 'ECE' : 'CSE',
        yearLabel,
        prevCgpa: student.prevCgpa,
      })]
    }))

    const professor = { ...PROFESSOR }
    const runtime = {
      studentPatches: repositories.entryData.getStudentPatchesSnapshot(),
      schemeByOffering: repositories.entryData.getSchemeStateSnapshot(OFFERINGS),
      ttBlueprintsByOffering: repositories.entryData.getBlueprintSnapshot(OFFERINGS),
      drafts: repositories.entryData.getDraftSnapshot(),
      cellValues: repositories.entryData.getCellValueSnapshot(),
      lockByOffering: repositories.locksAudit.getLockSnapshot(OFFERINGS),
      lockAuditByTarget: repositories.locksAudit.getLockAuditSnapshot(),
      tasks: buildSeedTasks(),
      resolvedTasks: repositories.tasks.getResolvedTasksSnapshot({ 'seed-unlock-rejected-cs403c-tt1': BASE_NOW - 43_200_000 }),
      timetableByFacultyId: repositories.calendar.getTimetableTemplatesSnapshot(FACULTY, OFFERINGS),
      taskPlacements: repositories.calendar.getTaskPlacementsSnapshot(),
      calendarAudit: repositories.calendar.getCalendarAuditSnapshot(),
    }

    const payload = {
      generatedAt: BASE_NOW_ISO,
      institution: {
        institutionId: 'inst_airmentor',
        name: 'AirMentor Academic Demo University',
        timezone: 'Asia/Kolkata',
        academicYearStartMonth: 8,
        status: 'active',
      },
      departments,
      branches,
      terms,
      faculty,
      courses,
      offerings,
      offeringOwnerships,
      students,
      adminRequests: [
        {
          adminRequestId: 'request_001',
          requestType: 'faculty role or mapping update',
          scopeType: 'department',
          scopeId: 'dept_cse',
          targetEntityRefs: [{ entityType: 'faculty_profile', entityId: 't6' }],
          priority: 'P2',
          status: 'New',
          requestedByRole: 'HOD',
          requestedByFacultyId: 't1',
          ownedByRole: 'SYSTEM_ADMIN',
          ownedByFacultyId: 'fac_sysadmin',
          summary: 'Grant additional mentor mapping coverage',
          details: 'Need temporary mentor reassignment capacity for section A.',
          notesThreadId: 'request_001',
          dueAt: '2026-03-18T17:00:00.000Z',
          slaPolicyCode: 'P2_STANDARD',
          decision: null,
          payload: {
            requestedGrant: 'MENTOR',
            reason: 'Expanded load coverage',
          },
        },
      ],
      academicAssets: {
        professor,
        faculty: FACULTY,
        offerings: OFFERINGS,
        yearGroups: YEAR_GROUPS,
        subjectRuns: SUBJECT_RUNS,
        teachers: TEACHERS,
        offeringsById: Object.fromEntries(OFFERINGS.map(offering => [offering.offId, offering])),
        studentsByOffering: baselineStudentsByOffering,
        menteesByUsn: Object.fromEntries(MENTEES.map(mentee => [mentee.usn, mentee])),
        studentHistoryByUsn,
        runtime,
      },
    }

    const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/seeds/platform.seed.json')
    await mkdir(path.dirname(outFile), { recursive: true })
    await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${outFile}`)
  } finally {
    Date.now = originalNow
    Math.random = originalRandom
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
