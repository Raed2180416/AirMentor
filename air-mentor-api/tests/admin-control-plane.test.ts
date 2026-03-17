import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { academicRuntimeState, sectionOfferings } from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('admin control plane routes', () => {
  it('propagates admin-created faculty records into teaching login, bootstrap, and faculty profile', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const facultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/faculty',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        username: 'meera.iyer',
        email: 'meera.iyer@msruas.ac.in',
        phone: '+91-9000000901',
        password: 'faculty1234',
        employeeCode: 'EMP-T900',
        displayName: 'Dr. Meera Iyer',
        designation: 'Professor',
        joinedOn: '2024-01-01',
        status: 'active',
      },
    })
    expect(facultyCreate.statusCode).toBe(200)
    const createdFaculty = facultyCreate.json()

    const appointmentCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${createdFaculty.facultyId}/appointments`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: 'dept_ece',
        branchId: 'branch_ece_btech',
        isPrimary: true,
        startDate: '2024-01-01',
        status: 'active',
      },
    })
    expect(appointmentCreate.statusCode).toBe(200)

    for (const roleCode of ['COURSE_LEADER', 'MENTOR'] as const) {
      const roleGrantCreate = await current.app.inject({
        method: 'POST',
        url: `/api/admin/faculty/${createdFaculty.facultyId}/role-grants`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: {
          roleCode,
          scopeType: 'branch',
          scopeId: 'branch_ece_btech',
          startDate: '2024-01-01',
          status: 'active',
        },
      })
      expect(roleGrantCreate.statusCode).toBe(200)
    }

    const [eceOffering] = await current.db.select().from(sectionOfferings).where(eq(sectionOfferings.branchId, 'branch_ece_btech')).limit(1)
    expect(eceOffering).toBeTruthy()

    const studentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/students',
      headers: { cookie: adminLogin.cookie },
    })
    expect(studentsResponse.statusCode).toBe(200)
    const student = studentsResponse.json().items.find((item: { activeMentorAssignment: unknown }) => !item.activeMentorAssignment) ?? studentsResponse.json().items[0]
    expect(student).toBeTruthy()

    const ownershipCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offering-ownership',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: eceOffering.offeringId,
        facultyId: createdFaculty.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      },
    })
    expect(ownershipCreate.statusCode).toBe(200)

    const mentorAssignmentCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/mentor-assignments',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        studentId: student.studentId,
        facultyId: createdFaculty.facultyId,
        effectiveFrom: '2026-03-01',
        source: 'sysadmin-seeded-test',
      },
    })
    expect(mentorAssignmentCreate.statusCode).toBe(200)

    const publicFaculty = await current.app.inject({
      method: 'GET',
      url: '/api/academic/public/faculty',
    })
    expect(publicFaculty.statusCode).toBe(200)
    expect(publicFaculty.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        facultyId: createdFaculty.facultyId,
        name: 'Dr. Meera Iyer',
        dept: 'ECE',
        roleTitle: 'Professor',
        allowedRoles: ['Course Leader', 'Mentor'],
      }),
    ]))

    const facultyLogin = await loginAs(current.app, 'meera.iyer', 'faculty1234')
    expect(facultyLogin.response.statusCode).toBe(200)

    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)
    const bootstrap = bootstrapResponse.json()
    const bootstrapFaculty = bootstrap.faculty.find((item: { facultyId: string }) => item.facultyId === createdFaculty.facultyId)
    const teacherCard = bootstrap.teachers.find((item: { id: string }) => item.id === createdFaculty.facultyId)

    expect(bootstrapFaculty).toMatchObject({
      facultyId: createdFaculty.facultyId,
      name: 'Dr. Meera Iyer',
      email: 'meera.iyer@msruas.ac.in',
      dept: 'ECE',
      roleTitle: 'Professor',
      allowedRoles: ['Course Leader', 'Mentor'],
    })
    expect(bootstrapFaculty?.offeringIds).toContain(eceOffering.offeringId)
    expect(bootstrapFaculty?.menteeIds.length).toBe(1)
    expect(teacherCard?.dept).toBe('ECE')

    const profileResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/${createdFaculty.facultyId}`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(profileResponse.statusCode).toBe(200)
    const profile = profileResponse.json()

    expect(profile.primaryDepartment).toEqual({
      departmentId: 'dept_ece',
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    })
    expect(profile.permissions.map((item: { roleCode: string }) => item.roleCode).sort()).toEqual(['COURSE_LEADER', 'MENTOR'])
    expect(profile.appointments[0]).toMatchObject({
      departmentId: 'dept_ece',
      departmentName: 'Electronics and Communication Engineering',
      departmentCode: 'ECE',
      branchId: 'branch_ece_btech',
      branchName: 'B.Tech ECE',
      branchCode: 'BTECH-ECE',
      isPrimary: true,
    })
    expect(profile.currentOwnedClasses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        offeringId: eceOffering.offeringId,
        ownershipRole: 'owner',
      }),
    ]))
    expect(profile.subjectRunCourseLeaderScope.length).toBeGreaterThan(0)
    expect(profile.mentorScope.activeStudentCount).toBe(1)
  })

  it('supports reminders and audit search across admin-managed entities', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const reminderCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/reminders',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        title: 'Follow up with HoD',
        body: 'Review cross-department load balancing.',
        dueAt: '2026-03-20T09:00:00.000Z',
        status: 'pending',
      },
    })
    expect(reminderCreate.statusCode).toBe(200)
    const createdReminder = reminderCreate.json()

    const reminderPatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/reminders/${createdReminder.reminderId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        title: createdReminder.title,
        body: createdReminder.body,
        dueAt: createdReminder.dueAt,
        status: 'done',
        version: createdReminder.version,
      },
    })
    expect(reminderPatch.statusCode).toBe(200)

    const remindersResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/reminders',
      headers: { cookie: adminLogin.cookie },
    })
    expect(remindersResponse.statusCode).toBe(200)
    expect(remindersResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reminderId: createdReminder.reminderId,
        status: 'done',
      }),
    ]))

    const auditResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/audit-events?entityType=AdminReminder&entityId=${createdReminder.reminderId}`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(auditResponse.statusCode).toBe(200)
    expect(auditResponse.json().items.map((item: { action: string }) => item.action)).toEqual(['created', 'updated'])

    const searchResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/search?q=Kavitha',
      headers: { cookie: adminLogin.cookie },
    })
    expect(searchResponse.statusCode).toBe(200)
    expect(searchResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'faculty-member',
        route: expect.objectContaining({
          section: 'faculty-members',
          facultyMemberId: 't1',
        }),
      }),
    ]))
  })

  it('enforces the faculty timetable direct-edit window while keeping markers editable and reflected in teaching profile status', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const facultyLogin = await loginAs(current.app, 't1', '1234')
    expect(adminLogin.response.statusCode).toBe(200)
    expect(facultyLogin.response.statusCode).toBe(200)

    const offeringsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/offerings',
      headers: { cookie: adminLogin.cookie },
    })
    expect(offeringsResponse.statusCode).toBe(200)
    const offering = offeringsResponse.json().items.find((item: { code: string }) => item.code === 'CS401') ?? offeringsResponse.json().items[0]
    expect(offering).toBeTruthy()

    const template = {
      facultyId: 't1',
      slots: [{ id: 'slot-1', label: 'P1', startTime: '09:00', endTime: '10:00' }],
      dayStartMinutes: 540,
      dayEndMinutes: 1020,
      classBlocks: [{
        id: 'block-1',
        facultyId: 't1',
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day: 'Mon',
        kind: 'regular',
        startMinutes: 540,
        endMinutes: 600,
        slotId: 'slot-1',
        slotSpan: 1,
      }],
      updatedAt: 1,
    }
    const workspace = {
      publishedAt: null,
      markers: [{
        markerId: 'marker-1',
        facultyId: 't1',
        markerType: 'semester-start',
        title: 'Semester Start',
        note: 'Opening day',
        dateISO: '2026-08-01',
        endDateISO: null,
        allDay: true,
        startMinutes: null,
        endMinutes: null,
        color: '#2563eb',
        createdAt: 1,
        updatedAt: 1,
      }],
    }

    const initialSave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { template, workspace },
    })
    expect(initialSave.statusCode).toBe(200)
    const savedCalendar = initialSave.json()
    expect(savedCalendar.workspace.publishedAt).toBeTruthy()
    expect(savedCalendar.classEditingLocked).toBe(false)

    const profileResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/t1',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(profileResponse.statusCode).toBe(200)
    expect(profileResponse.json().timetableStatus).toMatchObject({
      hasTemplate: true,
      publishedAt: savedCalendar.workspace.publishedAt,
    })

    const recentAuditResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/audit-events/recent?limit=20',
      headers: { cookie: adminLogin.cookie },
    })
    expect(recentAuditResponse.statusCode).toBe(200)
    expect(recentAuditResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'FacultyTimetableAdmin',
        entityId: 't1',
      }),
    ]))

    const [calendarRow] = await current.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId'))
    expect(calendarRow).toBeTruthy()
    const currentPayload = JSON.parse(calendarRow.payloadJson) as Record<string, unknown>
    await current.db.update(academicRuntimeState).set({
      payloadJson: JSON.stringify({
        ...currentPayload,
        t1: {
          ...(currentPayload.t1 as Record<string, unknown>),
          publishedAt: '2026-02-01T00:00:00.000Z',
        },
      }),
      version: calendarRow.version + 1,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId'))

    const markerOnlySave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template,
        workspace: {
          publishedAt: '2026-02-01T00:00:00.000Z',
          markers: [
            {
              ...workspace.markers[0],
              note: 'Opening day updated by admin after the class edit window.',
              updatedAt: 2,
            },
          ],
        },
      },
    })
    expect(markerOnlySave.statusCode).toBe(200)
    expect(markerOnlySave.json().classEditingLocked).toBe(true)

    const blockedTemplateSave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template: {
          ...template,
          classBlocks: [
            ...template.classBlocks,
            {
              ...template.classBlocks[0],
              id: 'block-2',
              startMinutes: 600,
              endMinutes: 660,
            },
          ],
          updatedAt: 2,
        },
        workspace: markerOnlySave.json().workspace,
      },
    })
    expect(blockedTemplateSave.statusCode).toBe(403)
  })
})
