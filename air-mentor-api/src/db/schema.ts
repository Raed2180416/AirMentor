import { integer, text, pgTable } from 'drizzle-orm/pg-core'

export const institutions = pgTable('institutions', {
  institutionId: text('institution_id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  academicYearStartMonth: integer('academic_year_start_month').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicFaculties = pgTable('academic_faculties', {
  academicFacultyId: text('academic_faculty_id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.institutionId),
  code: text('code').notNull(),
  name: text('name').notNull(),
  overview: text('overview'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const departments = pgTable('departments', {
  departmentId: text('department_id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.institutionId),
  academicFacultyId: text('academic_faculty_id').references(() => academicFaculties.academicFacultyId),
  code: text('code').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const branches = pgTable('branches', {
  branchId: text('branch_id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.departmentId),
  code: text('code').notNull(),
  name: text('name').notNull(),
  programLevel: text('program_level').notNull(),
  semesterCount: integer('semester_count').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const batches = pgTable('batches', {
  batchId: text('batch_id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.branchId),
  admissionYear: integer('admission_year').notNull(),
  batchLabel: text('batch_label').notNull(),
  currentSemester: integer('current_semester').notNull(),
  sectionLabelsJson: text('section_labels_json').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicTerms = pgTable('academic_terms', {
  termId: text('term_id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.branchId),
  batchId: text('batch_id').references(() => batches.batchId),
  academicYearLabel: text('academic_year_label').notNull(),
  semesterNumber: integer('semester_number').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const userAccounts = pgTable('user_accounts', {
  userId: text('user_id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.institutionId),
  username: text('username').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const userPasswordCredentials = pgTable('user_password_credentials', {
  userId: text('user_id').primaryKey().references(() => userAccounts.userId),
  passwordHash: text('password_hash').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sessions = pgTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  userId: text('user_id').notNull().references(() => userAccounts.userId),
  activeRoleGrantId: text('active_role_grant_id'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
})

export const uiPreferences = pgTable('ui_preferences', {
  userId: text('user_id').primaryKey().references(() => userAccounts.userId),
  themeMode: text('theme_mode').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
})

export const facultyProfiles = pgTable('faculty_profiles', {
  facultyId: text('faculty_id').primaryKey(),
  userId: text('user_id').notNull().references(() => userAccounts.userId),
  employeeCode: text('employee_code').notNull(),
  displayName: text('display_name').notNull(),
  designation: text('designation').notNull(),
  joinedOn: text('joined_on'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const facultyAppointments = pgTable('faculty_appointments', {
  appointmentId: text('appointment_id').primaryKey(),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  departmentId: text('department_id').notNull().references(() => departments.departmentId),
  branchId: text('branch_id').references(() => branches.branchId),
  isPrimary: integer('is_primary').notNull().default(0),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const roleGrants = pgTable('role_grants', {
  grantId: text('grant_id').primaryKey(),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  roleCode: text('role_code').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const students = pgTable('students', {
  studentId: text('student_id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.institutionId),
  usn: text('usn').notNull(),
  rollNumber: text('roll_number'),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  admissionDate: text('admission_date').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentEnrollments = pgTable('student_enrollments', {
  enrollmentId: text('enrollment_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  branchId: text('branch_id').notNull().references(() => branches.branchId),
  termId: text('term_id').notNull().references(() => academicTerms.termId),
  sectionCode: text('section_code').notNull(),
  rosterOrder: integer('roster_order').notNull().default(0),
  academicStatus: text('academic_status').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const mentorAssignments = pgTable('mentor_assignments', {
  assignmentId: text('assignment_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  source: text('source').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const courses = pgTable('courses', {
  courseId: text('course_id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.institutionId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  defaultCredits: integer('default_credits').notNull(),
  departmentId: text('department_id').notNull().references(() => departments.departmentId),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumCourses = pgTable('curriculum_courses', {
  curriculumCourseId: text('curriculum_course_id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  semesterNumber: integer('semester_number').notNull(),
  courseId: text('course_id').references(() => courses.courseId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  credits: integer('credits').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const policyOverrides = pgTable('policy_overrides', {
  policyOverrideId: text('policy_override_id').primaryKey(),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  policyJson: text('policy_json').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sectionOfferings = pgTable('section_offerings', {
  offeringId: text('offering_id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.courseId),
  termId: text('term_id').notNull().references(() => academicTerms.termId),
  branchId: text('branch_id').notNull().references(() => branches.branchId),
  sectionCode: text('section_code').notNull(),
  yearLabel: text('year_label').notNull(),
  attendance: integer('attendance').notNull(),
  studentCount: integer('student_count').notNull(),
  stage: integer('stage').notNull(),
  stageLabel: text('stage_label').notNull(),
  stageDescription: text('stage_description').notNull(),
  stageColor: text('stage_color').notNull(),
  tt1Done: integer('tt1_done').notNull().default(0),
  tt2Done: integer('tt2_done').notNull().default(0),
  tt1Locked: integer('tt1_locked').notNull().default(0),
  tt2Locked: integer('tt2_locked').notNull().default(0),
  quizLocked: integer('quiz_locked').notNull().default(0),
  assignmentLocked: integer('assignment_locked').notNull().default(0),
  pendingAction: text('pending_action'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const facultyOfferingOwnerships = pgTable('faculty_offering_ownerships', {
  ownershipId: text('ownership_id').primaryKey(),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  ownershipRole: text('ownership_role').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAcademicProfiles = pgTable('student_academic_profiles', {
  studentId: text('student_id').primaryKey().references(() => students.studentId),
  prevCgpaScaled: integer('prev_cgpa_scaled').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAttendanceSnapshots = pgTable('student_attendance_snapshots', {
  attendanceSnapshotId: text('attendance_snapshot_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  presentClasses: integer('present_classes').notNull(),
  totalClasses: integer('total_classes').notNull(),
  attendancePercent: integer('attendance_percent').notNull(),
  source: text('source').notNull(),
  capturedAt: text('captured_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAssessmentScores = pgTable('student_assessment_scores', {
  assessmentScoreId: text('assessment_score_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  termId: text('term_id').references(() => academicTerms.termId),
  componentType: text('component_type').notNull(),
  componentCode: text('component_code'),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  evaluatedAt: text('evaluated_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentInterventions = pgTable('student_interventions', {
  interventionId: text('intervention_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  facultyId: text('faculty_id').references(() => facultyProfiles.facultyId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  interventionType: text('intervention_type').notNull(),
  note: text('note').notNull(),
  occurredAt: text('occurred_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const transcriptTermResults = pgTable('transcript_term_results', {
  transcriptTermResultId: text('transcript_term_result_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  termId: text('term_id').notNull().references(() => academicTerms.termId),
  sgpaScaled: integer('sgpa_scaled').notNull(),
  registeredCredits: integer('registered_credits').notNull(),
  earnedCredits: integer('earned_credits').notNull(),
  backlogCount: integer('backlog_count').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const transcriptSubjectResults = pgTable('transcript_subject_results', {
  transcriptSubjectResultId: text('transcript_subject_result_id').primaryKey(),
  transcriptTermResultId: text('transcript_term_result_id').notNull().references(() => transcriptTermResults.transcriptTermResultId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  credits: integer('credits').notNull(),
  score: integer('score').notNull(),
  gradeLabel: text('grade_label').notNull(),
  gradePoint: integer('grade_point').notNull(),
  result: text('result').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const courseOutcomeOverrides = pgTable('course_outcome_overrides', {
  courseOutcomeOverrideId: text('course_outcome_override_id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.courseId),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  outcomesJson: text('outcomes_json').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const offeringAssessmentSchemes = pgTable('offering_assessment_schemes', {
  offeringId: text('offering_id').primaryKey().references(() => sectionOfferings.offeringId),
  configuredByFacultyId: text('configured_by_faculty_id').references(() => facultyProfiles.facultyId),
  schemeJson: text('scheme_json').notNull(),
  policySnapshotJson: text('policy_snapshot_json').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const offeringQuestionPapers = pgTable('offering_question_papers', {
  paperId: text('paper_id').primaryKey(),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  kind: text('kind').notNull(),
  blueprintJson: text('blueprint_json').notNull(),
  updatedByFacultyId: text('updated_by_faculty_id').references(() => facultyProfiles.facultyId),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicTasks = pgTable('academic_tasks', {
  taskId: text('task_id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  assignedToRole: text('assigned_to_role').notNull(),
  taskType: text('task_type').notNull(),
  status: text('status').notNull(),
  title: text('title').notNull(),
  dueLabel: text('due_label').notNull(),
  dueDateIso: text('due_date_iso'),
  riskProbScaled: integer('risk_prob_scaled').notNull(),
  riskBand: text('risk_band').notNull(),
  priority: integer('priority').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdByFacultyId: text('created_by_faculty_id').references(() => facultyProfiles.facultyId),
  updatedByFacultyId: text('updated_by_faculty_id').references(() => facultyProfiles.facultyId),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicTaskTransitions = pgTable('academic_task_transitions', {
  transitionId: text('transition_id').primaryKey(),
  taskId: text('task_id').notNull().references(() => academicTasks.taskId),
  actorRole: text('actor_role').notNull(),
  actorFacultyId: text('actor_faculty_id').references(() => facultyProfiles.facultyId),
  action: text('action').notNull(),
  fromOwner: text('from_owner'),
  toOwner: text('to_owner').notNull(),
  note: text('note').notNull(),
  occurredAt: text('occurred_at').notNull(),
})

export const academicTaskPlacements = pgTable('academic_task_placements', {
  taskId: text('task_id').primaryKey().references(() => academicTasks.taskId),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  dateIso: text('date_iso').notNull(),
  placementMode: text('placement_mode').notNull(),
  startMinutes: integer('start_minutes'),
  endMinutes: integer('end_minutes'),
  slotId: text('slot_id'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  updatedAt: text('updated_at').notNull(),
})

export const facultyCalendarWorkspaces = pgTable('faculty_calendar_workspaces', {
  facultyId: text('faculty_id').primaryKey().references(() => facultyProfiles.facultyId),
  templateJson: text('template_json').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicCalendarAuditEvents = pgTable('academic_calendar_audit_events', {
  auditEventId: text('audit_event_id').primaryKey(),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
})

export const academicMeetings = pgTable('academic_meetings', {
  meetingId: text('meeting_id').primaryKey(),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  title: text('title').notNull(),
  notes: text('notes'),
  dateIso: text('date_iso').notNull(),
  startMinutes: integer('start_minutes').notNull(),
  endMinutes: integer('end_minutes').notNull(),
  status: text('status').notNull(),
  createdByFacultyId: text('created_by_faculty_id').references(() => facultyProfiles.facultyId),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const academicAssets = pgTable('academic_assets', {
  assetKey: text('asset_key').primaryKey(),
  payloadJson: text('payload_json').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
})

export const academicRuntimeState = pgTable('academic_runtime_state', {
  stateKey: text('state_key').primaryKey(),
  payloadJson: text('payload_json').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
})

export const adminRequests = pgTable('admin_requests', {
  adminRequestId: text('admin_request_id').primaryKey(),
  requestType: text('request_type').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  targetEntityRefsJson: text('target_entity_refs_json').notNull(),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  requestedByRole: text('requested_by_role').notNull(),
  requestedByFacultyId: text('requested_by_faculty_id').notNull().references(() => facultyProfiles.facultyId),
  ownedByRole: text('owned_by_role').notNull(),
  ownedByFacultyId: text('owned_by_faculty_id').references(() => facultyProfiles.facultyId),
  summary: text('summary').notNull(),
  details: text('details').notNull(),
  notesThreadId: text('notes_thread_id').notNull(),
  dueAt: text('due_at').notNull(),
  slaPolicyCode: text('sla_policy_code').notNull(),
  decision: text('decision'),
  payloadJson: text('payload_json').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const adminRequestNotes = pgTable('admin_request_notes', {
  noteId: text('note_id').primaryKey(),
  adminRequestId: text('admin_request_id').notNull().references(() => adminRequests.adminRequestId),
  authorRole: text('author_role').notNull(),
  authorFacultyId: text('author_faculty_id').references(() => facultyProfiles.facultyId),
  visibility: text('visibility').notNull(),
  noteType: text('note_type').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
})

export const adminRequestTransitions = pgTable('admin_request_transitions', {
  transitionId: text('transition_id').primaryKey(),
  adminRequestId: text('admin_request_id').notNull().references(() => adminRequests.adminRequestId),
  previousStatus: text('previous_status'),
  nextStatus: text('next_status').notNull(),
  actorRole: text('actor_role').notNull(),
  actorFacultyId: text('actor_faculty_id').references(() => facultyProfiles.facultyId),
  noteId: text('note_id'),
  affectedEntityRefsJson: text('affected_entity_refs_json').notNull(),
  createdAt: text('created_at').notNull(),
})

export const auditEvents = pgTable('audit_events', {
  auditEventId: text('audit_event_id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  actorRole: text('actor_role').notNull(),
  actorId: text('actor_id'),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
})

export const adminReminders = pgTable('admin_reminders', {
  reminderId: text('reminder_id').primaryKey(),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  title: text('title').notNull(),
  body: text('body').notNull(),
  dueAt: text('due_at').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const allTables = {
  institutions,
  departments,
  academicFaculties,
  branches,
  batches,
  academicTerms,
  userAccounts,
  userPasswordCredentials,
  sessions,
  uiPreferences,
  facultyProfiles,
  facultyAppointments,
  roleGrants,
  students,
  studentEnrollments,
  mentorAssignments,
  courses,
  curriculumCourses,
  policyOverrides,
  sectionOfferings,
  facultyOfferingOwnerships,
  studentAcademicProfiles,
  studentAttendanceSnapshots,
  studentAssessmentScores,
  studentInterventions,
  transcriptTermResults,
  transcriptSubjectResults,
  courseOutcomeOverrides,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  academicTasks,
  academicTaskTransitions,
  academicTaskPlacements,
  facultyCalendarWorkspaces,
  academicCalendarAuditEvents,
  academicMeetings,
  academicAssets,
  academicRuntimeState,
  adminRequests,
  adminRequestNotes,
  adminRequestTransitions,
  auditEvents,
  adminReminders,
}

export type SchemaTableMap = typeof allTables
