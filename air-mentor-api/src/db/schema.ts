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

export const userPasswordSetupTokens = pgTable('user_password_setup_tokens', {
  passwordSetupTokenId: text('password_setup_token_id').primaryKey(),
  userId: text('user_id').notNull().references(() => userAccounts.userId),
  purpose: text('purpose').notNull(),
  tokenHash: text('token_hash').notNull(),
  issuedToEmail: text('issued_to_email').notNull(),
  requestedByUserId: text('requested_by_user_id').references(() => userAccounts.userId),
  expiresAt: text('expires_at').notNull(),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').notNull(),
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

export const loginRateLimitWindows = pgTable('login_rate_limit_windows', {
  attemptKey: text('attempt_key').primaryKey(),
  failureCount: integer('failure_count').notNull().default(0),
  windowStartedAt: text('window_started_at').notNull(),
  lastFailedAt: text('last_failed_at').notNull(),
  updatedAt: text('updated_at').notNull(),
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

export const stagePolicyOverrides = pgTable('stage_policy_overrides', {
  stagePolicyOverrideId: text('stage_policy_override_id').primaryKey(),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  policyJson: text('policy_json').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumFeatureProfiles = pgTable('curriculum_feature_profiles', {
  curriculumFeatureProfileId: text('curriculum_feature_profile_id').primaryKey(),
  name: text('name').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumFeatureProfileCourses = pgTable('curriculum_feature_profile_courses', {
  curriculumFeatureProfileCourseId: text('curriculum_feature_profile_course_id').primaryKey(),
  curriculumFeatureProfileId: text('curriculum_feature_profile_id').notNull().references(() => curriculumFeatureProfiles.curriculumFeatureProfileId),
  courseId: text('course_id').references(() => courses.courseId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  assessmentProfile: text('assessment_profile').notNull(),
  outcomesJson: text('outcomes_json').notNull(),
  prerequisitesJson: text('prerequisites_json').notNull(),
  bridgeModulesJson: text('bridge_modules_json').notNull(),
  topicPartitionsJson: text('topic_partitions_json').notNull(),
  featureFingerprint: text('feature_fingerprint').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const batchCurriculumFeatureBindings = pgTable('batch_curriculum_feature_bindings', {
  batchId: text('batch_id').primaryKey().references(() => batches.batchId),
  curriculumFeatureProfileId: text('curriculum_feature_profile_id').references(() => curriculumFeatureProfiles.curriculumFeatureProfileId),
  bindingMode: text('binding_mode').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const batchCurriculumFeatureOverrides = pgTable('batch_curriculum_feature_overrides', {
  batchCurriculumFeatureOverrideId: text('batch_curriculum_feature_override_id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  curriculumCourseId: text('curriculum_course_id').notNull().references(() => curriculumCourses.curriculumCourseId),
  courseId: text('course_id').references(() => courses.courseId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  overrideJson: text('override_json').notNull(),
  featureFingerprint: text('feature_fingerprint').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumLinkageCandidates = pgTable('curriculum_linkage_candidates', {
  curriculumLinkageCandidateId: text('curriculum_linkage_candidate_id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  curriculumCourseId: text('curriculum_course_id').notNull().references(() => curriculumCourses.curriculumCourseId),
  sourceCurriculumCourseId: text('source_curriculum_course_id').references(() => curriculumCourses.curriculumCourseId),
  sourceCourseId: text('source_course_id').references(() => courses.courseId),
  sourceCourseCode: text('source_course_code').notNull(),
  sourceTitle: text('source_title').notNull(),
  targetCourseCode: text('target_course_code').notNull(),
  targetTitle: text('target_title').notNull(),
  edgeKind: text('edge_kind').notNull(),
  rationale: text('rationale').notNull(),
  confidenceScaled: integer('confidence_scaled').notNull(),
  sourcesJson: text('sources_json').notNull(),
  signalSummaryJson: text('signal_summary_json').notNull(),
  status: text('status').notNull(),
  reviewNote: text('review_note'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumImportVersions = pgTable('curriculum_import_versions', {
  curriculumImportVersionId: text('curriculum_import_version_id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  sourceLabel: text('source_label').notNull(),
  sourceChecksum: text('source_checksum').notNull(),
  sourcePath: text('source_path'),
  sourceType: text('source_type').notNull(),
  compilerVersion: text('compiler_version').notNull(),
  outputChecksum: text('output_checksum').notNull(),
  firstSemester: integer('first_semester').notNull(),
  lastSemester: integer('last_semester').notNull(),
  courseCount: integer('course_count').notNull(),
  totalCredits: integer('total_credits').notNull(),
  explicitEdgeCount: integer('explicit_edge_count').notNull(),
  addedEdgeCount: integer('added_edge_count').notNull(),
  bridgeModuleCount: integer('bridge_module_count').notNull(),
  electiveOptionCount: integer('elective_option_count').notNull(),
  unresolvedMappingCount: integer('unresolved_mapping_count').notNull(),
  validationStatus: text('validation_status').notNull(),
  completenessCertificateJson: text('completeness_certificate_json').notNull(),
  approvedByFacultyId: text('approved_by_faculty_id').references(() => facultyProfiles.facultyId),
  approvedAt: text('approved_at'),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumValidationResults = pgTable('curriculum_validation_results', {
  curriculumValidationResultId: text('curriculum_validation_result_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  validatorVersion: text('validator_version').notNull(),
  status: text('status').notNull(),
  summaryJson: text('summary_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumNodes = pgTable('curriculum_nodes', {
  curriculumNodeId: text('curriculum_node_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  semesterNumber: integer('semester_number').notNull(),
  courseId: text('course_id').references(() => courses.courseId),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  credits: integer('credits').notNull(),
  internalCompilerId: text('internal_compiler_id').notNull(),
  officialWebCode: text('official_web_code'),
  officialWebTitle: text('official_web_title'),
  matchStatus: text('match_status').notNull(),
  mappingNote: text('mapping_note'),
  assessmentProfile: text('assessment_profile').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const curriculumEdges = pgTable('curriculum_edges', {
  curriculumEdgeId: text('curriculum_edge_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  sourceCurriculumNodeId: text('source_curriculum_node_id').notNull().references(() => curriculumNodes.curriculumNodeId),
  targetCurriculumNodeId: text('target_curriculum_node_id').notNull().references(() => curriculumNodes.curriculumNodeId),
  edgeKind: text('edge_kind').notNull(),
  rationale: text('rationale').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const bridgeModules = pgTable('bridge_modules', {
  bridgeModuleId: text('bridge_module_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  curriculumNodeId: text('curriculum_node_id').notNull().references(() => curriculumNodes.curriculumNodeId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  moduleTitlesJson: text('module_titles_json').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const courseTopicPartitions = pgTable('course_topic_partitions', {
  courseTopicPartitionId: text('course_topic_partition_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  curriculumNodeId: text('curriculum_node_id').notNull().references(() => curriculumNodes.curriculumNodeId),
  partitionKind: text('partition_kind').notNull(),
  topicsJson: text('topics_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const electiveBaskets = pgTable('elective_baskets', {
  electiveBasketId: text('elective_basket_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  semesterNumber: integer('semester_number').notNull(),
  stream: text('stream').notNull(),
  pceGroup: text('pce_group').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const electiveOptions = pgTable('elective_options', {
  electiveOptionId: text('elective_option_id').primaryKey(),
  electiveBasketId: text('elective_basket_id').notNull().references(() => electiveBaskets.electiveBasketId),
  code: text('code').notNull(),
  title: text('title').notNull(),
  stream: text('stream').notNull(),
  semesterSlot: text('semester_slot').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const officialCodeCrosswalks = pgTable('official_code_crosswalks', {
  officialCodeCrosswalkId: text('official_code_crosswalk_id').primaryKey(),
  curriculumImportVersionId: text('curriculum_import_version_id').notNull().references(() => curriculumImportVersions.curriculumImportVersionId),
  curriculumNodeId: text('curriculum_node_id').notNull().references(() => curriculumNodes.curriculumNodeId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  internalCompilerId: text('internal_compiler_id').notNull(),
  officialWebCode: text('official_web_code'),
  officialWebTitle: text('official_web_title'),
  confidence: text('confidence').notNull(),
  evidenceSource: text('evidence_source').notNull(),
  reviewStatus: text('review_status').notNull(),
  overrideReason: text('override_reason'),
  approvedByFacultyId: text('approved_by_faculty_id').references(() => facultyProfiles.facultyId),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationRuns = pgTable('simulation_runs', {
  simulationRunId: text('simulation_run_id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  curriculumImportVersionId: text('curriculum_import_version_id').references(() => curriculumImportVersions.curriculumImportVersionId),
  curriculumFeatureProfileId: text('curriculum_feature_profile_id').references(() => curriculumFeatureProfiles.curriculumFeatureProfileId),
  curriculumFeatureProfileFingerprint: text('curriculum_feature_profile_fingerprint'),
  parentSimulationRunId: text('parent_simulation_run_id'),
  runLabel: text('run_label').notNull(),
  status: text('status').notNull(),
  activeFlag: integer('active_flag').notNull().default(0),
  seed: integer('seed').notNull(),
  sectionCount: integer('section_count').notNull(),
  studentCount: integer('student_count').notNull(),
  facultyCount: integer('faculty_count').notNull(),
  semesterStart: integer('semester_start').notNull(),
  semesterEnd: integer('semester_end').notNull(),
  activeOperationalSemester: integer('active_operational_semester').notNull(),
  sourceType: text('source_type').notNull(),
  policySnapshotJson: text('policy_snapshot_json').notNull(),
  engineVersionsJson: text('engine_versions_json').notNull(),
  metricsJson: text('metrics_json').notNull(),
  progressJson: text('progress_json'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  workerLeaseToken: text('worker_lease_token'),
  workerLeaseExpiresAt: text('worker_lease_expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const teacherLoadProfiles = pgTable('teacher_load_profiles', {
  teacherLoadProfileId: text('teacher_load_profile_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  semesterNumber: integer('semester_number').notNull(),
  sectionLoadCount: integer('section_load_count').notNull(),
  weeklyContactHours: integer('weekly_contact_hours').notNull(),
  assignedCredits: integer('assigned_credits').notNull(),
  permissionsJson: text('permissions_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const teacherAllocations = pgTable('teacher_allocations', {
  teacherAllocationId: text('teacher_allocation_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  facultyId: text('faculty_id').notNull().references(() => facultyProfiles.facultyId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code'),
  allocationRole: text('allocation_role').notNull(),
  plannedContactHours: integer('planned_contact_hours').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentLatentStates = pgTable('student_latent_states', {
  studentLatentStateId: text('student_latent_state_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  latentStateJson: text('latent_state_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentBehaviorProfiles = pgTable('student_behavior_profiles', {
  studentBehaviorProfileId: text('student_behavior_profile_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  sectionCode: text('section_code').notNull(),
  currentSemester: integer('current_semester').notNull(),
  programScopeVersion: text('program_scope_version').notNull(),
  profileJson: text('profile_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentTopicStates = pgTable('student_topic_states', {
  studentTopicStateId: text('student_topic_state_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  semesterNumber: integer('semester_number').notNull(),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  sectionCode: text('section_code').notNull(),
  topicKey: text('topic_key').notNull(),
  topicName: text('topic_name').notNull(),
  stateJson: text('state_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentCoStates = pgTable('student_co_states', {
  studentCoStateId: text('student_co_state_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  semesterNumber: integer('semester_number').notNull(),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  sectionCode: text('section_code').notNull(),
  coCode: text('co_code').notNull(),
  coTitle: text('co_title').notNull(),
  stateJson: text('state_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const worldContextSnapshots = pgTable('world_context_snapshots', {
  worldContextSnapshotId: text('world_context_snapshot_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code'),
  contextType: text('context_type').notNull(),
  contextKey: text('context_key').notNull(),
  contextJson: text('context_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationQuestionTemplates = pgTable('simulation_question_templates', {
  simulationQuestionTemplateId: text('simulation_question_template_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  semesterNumber: integer('semester_number').notNull(),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  componentType: text('component_type').notNull(),
  questionIndex: integer('question_index').notNull(),
  questionCode: text('question_code').notNull(),
  questionType: text('question_type').notNull(),
  questionMarks: integer('question_marks').notNull(),
  difficultyScaled: integer('difficulty_scaled').notNull(),
  transferDemandScaled: integer('transfer_demand_scaled').notNull(),
  coTagsJson: text('co_tags_json').notNull(),
  topicTagsJson: text('topic_tags_json').notNull(),
  microSkillTagsJson: text('micro_skill_tags_json').notNull(),
  sourceType: text('source_type').notNull(),
  templateJson: text('template_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationStageCheckpoints = pgTable('simulation_stage_checkpoints', {
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  semesterNumber: integer('semester_number').notNull(),
  stageKey: text('stage_key').notNull(),
  stageLabel: text('stage_label').notNull(),
  stageDescription: text('stage_description').notNull(),
  stageOrder: integer('stage_order').notNull(),
  previousCheckpointId: text('previous_checkpoint_id'),
  nextCheckpointId: text('next_checkpoint_id'),
  summaryJson: text('summary_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationStageQueueCases = pgTable('simulation_stage_queue_cases', {
  simulationStageQueueCaseId: text('simulation_stage_queue_case_id').primaryKey(),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').notNull().references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  primaryOfferingId: text('primary_offering_id').references(() => sectionOfferings.offeringId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  stageKey: text('stage_key').notNull(),
  assignedToRole: text('assigned_to_role'),
  assignedFacultyId: text('assigned_faculty_id').references(() => facultyProfiles.facultyId),
  status: text('status').notNull(),
  recommendedAction: text('recommended_action'),
  dueAt: text('due_at'),
  countsTowardCapacity: integer('counts_toward_capacity').notNull().default(0),
  priorityRank: integer('priority_rank'),
  governanceReason: text('governance_reason').notNull(),
  primaryCourseCode: text('primary_course_code').notNull(),
  primaryCourseTitle: text('primary_course_title').notNull(),
  supportingCourseCount: integer('supporting_course_count').notNull().default(0),
  supportingSourceKeysJson: text('supporting_source_keys_json').notNull(),
  caseJson: text('case_json').notNull(),
  detailJson: text('detail_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationStageStudentProjections = pgTable('simulation_stage_student_projections', {
  simulationStageStudentProjectionId: text('simulation_stage_student_projection_id').primaryKey(),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').notNull().references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  courseCode: text('course_code').notNull(),
  courseTitle: text('course_title').notNull(),
  riskProbScaled: integer('risk_prob_scaled').notNull(),
  riskBand: text('risk_band').notNull(),
  noActionRiskProbScaled: integer('no_action_risk_prob_scaled').notNull(),
  noActionRiskBand: text('no_action_risk_band').notNull(),
  recommendedAction: text('recommended_action'),
  simulatedActionTaken: text('simulated_action_taken'),
  queueState: text('queue_state'),
  reassessmentState: text('reassessment_state'),
  evidenceWindow: text('evidence_window').notNull(),
  projectionJson: text('projection_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationStageOfferingProjections = pgTable('simulation_stage_offering_projections', {
  simulationStageOfferingProjectionId: text('simulation_stage_offering_projection_id').primaryKey(),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').notNull().references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  courseCode: text('course_code').notNull(),
  courseTitle: text('course_title').notNull(),
  stage: integer('stage').notNull(),
  stageLabel: text('stage_label').notNull(),
  stageDescription: text('stage_description').notNull(),
  pendingAction: text('pending_action'),
  projectionJson: text('projection_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const simulationStageQueueProjections = pgTable('simulation_stage_queue_projections', {
  simulationStageQueueProjectionId: text('simulation_stage_queue_projection_id').primaryKey(),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').notNull().references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  simulationStageQueueCaseId: text('simulation_stage_queue_case_id').references(() => simulationStageQueueCases.simulationStageQueueCaseId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  courseCode: text('course_code').notNull(),
  courseTitle: text('course_title').notNull(),
  assignedToRole: text('assigned_to_role'),
  assignedFacultyId: text('assigned_faculty_id').references(() => facultyProfiles.facultyId),
  taskType: text('task_type').notNull(),
  status: text('status').notNull(),
  riskBand: text('risk_band').notNull(),
  riskProbScaled: integer('risk_prob_scaled').notNull(),
  noActionRiskProbScaled: integer('no_action_risk_prob_scaled').notNull(),
  recommendedAction: text('recommended_action'),
  simulatedActionTaken: text('simulated_action_taken'),
  detailJson: text('detail_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentQuestionResults = pgTable('student_question_results', {
  studentQuestionResultId: text('student_question_result_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  semesterNumber: integer('semester_number').notNull(),
  curriculumNodeId: text('curriculum_node_id').references(() => curriculumNodes.curriculumNodeId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  simulationQuestionTemplateId: text('simulation_question_template_id').notNull().references(() => simulationQuestionTemplates.simulationQuestionTemplateId),
  componentType: text('component_type').notNull(),
  sectionCode: text('section_code').notNull(),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  resultJson: text('result_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAgentCards = pgTable('student_agent_cards', {
  studentAgentCardId: text('student_agent_card_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  cardVersion: integer('card_version').notNull().default(1),
  sourceSnapshotHash: text('source_snapshot_hash').notNull(),
  cardJson: text('card_json').notNull(),
  citationMapJson: text('citation_map_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAgentSessions = pgTable('student_agent_sessions', {
  studentAgentSessionId: text('student_agent_session_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  studentAgentCardId: text('student_agent_card_id').notNull().references(() => studentAgentCards.studentAgentCardId),
  viewerFacultyId: text('viewer_faculty_id').references(() => facultyProfiles.facultyId),
  viewerRole: text('viewer_role').notNull(),
  status: text('status').notNull(),
  responseMode: text('response_mode').notNull(),
  cardVersion: integer('card_version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentAgentMessages = pgTable('student_agent_messages', {
  studentAgentMessageId: text('student_agent_message_id').primaryKey(),
  studentAgentSessionId: text('student_agent_session_id').notNull().references(() => studentAgentSessions.studentAgentSessionId),
  actorType: text('actor_type').notNull(),
  messageType: text('message_type').notNull(),
  body: text('body').notNull(),
  citationsJson: text('citations_json').notNull(),
  guardrailCode: text('guardrail_code'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const studentObservedSemesterStates = pgTable('student_observed_semester_states', {
  studentObservedSemesterStateId: text('student_observed_semester_state_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  termId: text('term_id').references(() => academicTerms.termId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  observedStateJson: text('observed_state_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const riskEvidenceSnapshots = pgTable('risk_evidence_snapshots', {
  riskEvidenceSnapshotId: text('risk_evidence_snapshot_id').primaryKey(),
  simulationRunId: text('simulation_run_id').references(() => simulationRuns.simulationRunId),
  simulationStageCheckpointId: text('simulation_stage_checkpoint_id').references(() => simulationStageCheckpoints.simulationStageCheckpointId),
  batchId: text('batch_id').references(() => batches.batchId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  courseCode: text('course_code').notNull(),
  courseTitle: text('course_title').notNull(),
  stageKey: text('stage_key'),
  evidenceWindow: text('evidence_window').notNull(),
  featureSchemaVersion: text('feature_schema_version').notNull(),
  featureJson: text('feature_json').notNull(),
  labelJson: text('label_json').notNull(),
  sourceRefsJson: text('source_refs_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const riskModelArtifacts = pgTable('risk_model_artifacts', {
  riskModelArtifactId: text('risk_model_artifact_id').primaryKey(),
  batchId: text('batch_id').references(() => batches.batchId),
  simulationRunId: text('simulation_run_id').references(() => simulationRuns.simulationRunId),
  curriculumFeatureProfileId: text('curriculum_feature_profile_id').references(() => curriculumFeatureProfiles.curriculumFeatureProfileId),
  curriculumFeatureProfileFingerprint: text('curriculum_feature_profile_fingerprint'),
  artifactType: text('artifact_type').notNull(),
  modelFamily: text('model_family').notNull(),
  artifactVersion: text('artifact_version').notNull(),
  featureSchemaVersion: text('feature_schema_version').notNull(),
  sourceRunIdsJson: text('source_run_ids_json').notNull(),
  payloadJson: text('payload_json').notNull(),
  evaluationJson: text('evaluation_json').notNull(),
  status: text('status').notNull(),
  activeFlag: integer('active_flag').notNull().default(1),
  createdByFacultyId: text('created_by_faculty_id').references(() => facultyProfiles.facultyId),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const semesterTransitionLogs = pgTable('semester_transition_logs', {
  semesterTransitionLogId: text('semester_transition_log_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  fromSemester: integer('from_semester').notNull(),
  toSemester: integer('to_semester').notNull(),
  summaryJson: text('summary_json').notNull(),
  createdAt: text('created_at').notNull(),
})

export const simulationResetSnapshots = pgTable('simulation_reset_snapshots', {
  simulationResetSnapshotId: text('simulation_reset_snapshot_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  snapshotLabel: text('snapshot_label').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  createdAt: text('created_at').notNull(),
})

export const simulationLifecycleAudits = pgTable('simulation_lifecycle_audits', {
  simulationLifecycleAuditId: text('simulation_lifecycle_audit_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  actionType: text('action_type').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdByFacultyId: text('created_by_faculty_id').references(() => facultyProfiles.facultyId),
  createdAt: text('created_at').notNull(),
})

export const riskAssessments = pgTable('risk_assessments', {
  riskAssessmentId: text('risk_assessment_id').primaryKey(),
  simulationRunId: text('simulation_run_id').references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  termId: text('term_id').references(() => academicTerms.termId),
  assessmentScope: text('assessment_scope').notNull(),
  riskProbScaled: integer('risk_prob_scaled').notNull(),
  riskBand: text('risk_band').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  driversJson: text('drivers_json').notNull(),
  evidenceWindow: text('evidence_window').notNull(),
  evidenceSnapshotId: text('evidence_snapshot_id'),
  modelVersion: text('model_version').notNull(),
  policyVersion: text('policy_version').notNull(),
  sourceType: text('source_type').notNull(),
  assessedAt: text('assessed_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const reassessmentEvents = pgTable('reassessment_events', {
  reassessmentEventId: text('reassessment_event_id').primaryKey(),
  riskAssessmentId: text('risk_assessment_id').notNull().references(() => riskAssessments.riskAssessmentId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  assignedToRole: text('assigned_to_role').notNull(),
  assignedFacultyId: text('assigned_faculty_id').references(() => facultyProfiles.facultyId),
  dueAt: text('due_at').notNull(),
  status: text('status').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const alertDecisions = pgTable('alert_decisions', {
  alertDecisionId: text('alert_decision_id').primaryKey(),
  riskAssessmentId: text('risk_assessment_id').notNull().references(() => riskAssessments.riskAssessmentId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  decisionType: text('decision_type').notNull(),
  queueOwnerRole: text('queue_owner_role').notNull(),
  note: text('note').notNull(),
  reassessmentDueAt: text('reassessment_due_at'),
  cooldownUntil: text('cooldown_until'),
  monitoringPolicyVersion: text('monitoring_policy_version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const alertOutcomes = pgTable('alert_outcomes', {
  alertOutcomeId: text('alert_outcome_id').primaryKey(),
  alertDecisionId: text('alert_decision_id').notNull().references(() => alertDecisions.alertDecisionId),
  outcomeStatus: text('outcome_status').notNull(),
  acknowledgedByFacultyId: text('acknowledged_by_faculty_id').references(() => facultyProfiles.facultyId),
  acknowledgedAt: text('acknowledged_at'),
  outcomeNote: text('outcome_note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const electiveRecommendations = pgTable('elective_recommendations', {
  electiveRecommendationId: text('elective_recommendation_id').primaryKey(),
  simulationRunId: text('simulation_run_id').references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  semesterNumber: integer('semester_number').notNull(),
  recommendedCode: text('recommended_code').notNull(),
  recommendedTitle: text('recommended_title').notNull(),
  stream: text('stream').notNull(),
  rationaleJson: text('rationale_json').notNull(),
  alternativesJson: text('alternatives_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const riskOverrides = pgTable('risk_overrides', {
  riskOverrideId: text('risk_override_id').primaryKey(),
  riskAssessmentId: text('risk_assessment_id').notNull().references(() => riskAssessments.riskAssessmentId),
  simulationRunId: text('simulation_run_id').references(() => simulationRuns.simulationRunId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  overrideBand: text('override_band').notNull(),
  overrideNote: text('override_note').notNull(),
  createdByFacultyId: text('created_by_faculty_id').references(() => facultyProfiles.facultyId),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const alertAcknowledgements = pgTable('alert_acknowledgements', {
  alertAcknowledgementId: text('alert_acknowledgement_id').primaryKey(),
  alertDecisionId: text('alert_decision_id').notNull().references(() => alertDecisions.alertDecisionId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  acknowledgedByFacultyId: text('acknowledged_by_faculty_id').references(() => facultyProfiles.facultyId),
  status: text('status').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const reassessmentResolutions = pgTable('reassessment_resolutions', {
  reassessmentResolutionId: text('reassessment_resolution_id').primaryKey(),
  reassessmentEventId: text('reassessment_event_id').notNull().references(() => reassessmentEvents.reassessmentEventId),
  batchId: text('batch_id').notNull().references(() => batches.batchId),
  resolvedByFacultyId: text('resolved_by_faculty_id').references(() => facultyProfiles.facultyId),
  resolutionStatus: text('resolution_status').notNull(),
  note: text('note'),
  resolutionJson: text('resolution_json'),
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
  finalsLocked: integer('finals_locked').notNull().default(0),
  pendingAction: text('pending_action'),
  status: text('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const offeringStageAdvancementAudits = pgTable('offering_stage_advancement_audits', {
  offeringStageAdvancementAuditId: text('offering_stage_advancement_audit_id').primaryKey(),
  offeringId: text('offering_id').notNull().references(() => sectionOfferings.offeringId),
  batchId: text('batch_id').references(() => batches.batchId),
  termId: text('term_id').references(() => academicTerms.termId),
  advancedByFacultyId: text('advanced_by_faculty_id').references(() => facultyProfiles.facultyId),
  fromStageKey: text('from_stage_key').notNull(),
  toStageKey: text('to_stage_key').notNull(),
  auditJson: text('audit_json').notNull(),
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

export const studentInterventionResponseStates = pgTable('student_intervention_response_states', {
  studentInterventionResponseStateId: text('student_intervention_response_state_id').primaryKey(),
  simulationRunId: text('simulation_run_id').notNull().references(() => simulationRuns.simulationRunId),
  studentId: text('student_id').notNull().references(() => students.studentId),
  semesterNumber: integer('semester_number').notNull(),
  sectionCode: text('section_code').notNull(),
  offeringId: text('offering_id').references(() => sectionOfferings.offeringId),
  interventionId: text('intervention_id'),
  interventionType: text('intervention_type').notNull(),
  responseStateJson: text('response_state_json').notNull(),
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

export const facultyCalendarAdminWorkspaces = pgTable('faculty_calendar_admin_workspaces', {
  facultyId: text('faculty_id').primaryKey().references(() => facultyProfiles.facultyId),
  workspaceJson: text('workspace_json').notNull(),
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

export const operationalTelemetryEvents = pgTable('operational_telemetry_events', {
  operationalTelemetryEventId: text('operational_telemetry_event_id').primaryKey(),
  source: text('source').notNull(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  eventTimestamp: text('event_timestamp').notNull(),
  payloadJson: text('payload_json').notNull(),
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
  userPasswordSetupTokens,
  sessions,
  loginRateLimitWindows,
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
  curriculumImportVersions,
  curriculumValidationResults,
  curriculumNodes,
  curriculumEdges,
  bridgeModules,
  courseTopicPartitions,
  electiveBaskets,
  electiveOptions,
  officialCodeCrosswalks,
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
  facultyCalendarAdminWorkspaces,
  academicCalendarAuditEvents,
  academicMeetings,
  simulationRuns,
  simulationLifecycleAudits,
  teacherLoadProfiles,
  teacherAllocations,
  studentLatentStates,
  studentBehaviorProfiles,
  studentTopicStates,
  studentCoStates,
  worldContextSnapshots,
  simulationQuestionTemplates,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageStudentProjections,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  studentQuestionResults,
  studentAgentCards,
  studentAgentSessions,
  studentAgentMessages,
  studentObservedSemesterStates,
  riskEvidenceSnapshots,
  riskModelArtifacts,
  semesterTransitionLogs,
  simulationResetSnapshots,
  riskAssessments,
  reassessmentEvents,
  alertDecisions,
  alertOutcomes,
  electiveRecommendations,
  riskOverrides,
  alertAcknowledgements,
  reassessmentResolutions,
  studentInterventionResponseStates,
  academicAssets,
  academicRuntimeState,
  adminRequests,
  adminRequestNotes,
  adminRequestTransitions,
  auditEvents,
  operationalTelemetryEvents,
  adminReminders,
}

export type SchemaTableMap = typeof allTables
