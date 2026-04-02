import { createElement, createRef, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { T } from '../src/data'
import { SystemAdminFacultiesWorkspace } from '../src/system-admin-faculties-workspace'
import { SystemAdminProofDashboardWorkspace } from '../src/system-admin-proof-dashboard-workspace'
import { SystemAdminScopedRegistryLaunches } from '../src/system-admin-scoped-registry-launches'
import type { PolicyFormState, StagePolicyFormState } from '../src/system-admin-governance-editors'
import type { BatchProvisioningFormState, EntityEditorState } from '../src/system-admin-live-app'
import type { LiveAdminDataset, LiveAdminRoute } from '../src/system-admin-live-data'
import type { ApiMentorAssignmentBulkApplyResponse } from '../src/api/types'
import type { BulkMentorAssignmentFormState } from '../src/system-admin-provisioning-helpers'

const data: LiveAdminDataset = {
  institution: {
    institutionId: 'inst_1',
    name: 'AirMentor University',
    timezone: 'Asia/Kolkata',
    academicYearStartMonth: 7,
    status: 'active',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  academicFaculties: [
    {
      academicFacultyId: 'af_1',
      institutionId: 'inst_1',
      code: 'ENG',
      name: 'Engineering',
      overview: 'Engineering faculty overview',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  departments: [
    {
      departmentId: 'dept_1',
      institutionId: 'inst_1',
      academicFacultyId: 'af_1',
      code: 'CSE',
      name: 'Computer Science',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  branches: [
    {
      branchId: 'branch_1',
      departmentId: 'dept_1',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      programLevel: 'UG',
      semesterCount: 8,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  batches: [
    {
      batchId: 'batch_2022',
      branchId: 'branch_1',
      admissionYear: 2022,
      batchLabel: '2022',
      currentSemester: 5,
      sectionLabels: ['A', 'B'],
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  terms: [
    {
      termId: 'term_5',
      branchId: 'branch_1',
      batchId: 'batch_2022',
      academicYearLabel: '2024-25',
      semesterNumber: 5,
      startDate: '2024-08-01',
      endDate: '2024-12-15',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  facultyMembers: [
    {
      facultyId: 'fac_1',
      userId: 'user_1',
      username: 'prof',
      email: 'prof@airmentor.local',
      phone: null,
      employeeCode: 'EMP001',
      displayName: 'Prof. Kavitha Rao',
      designation: 'Professor',
      joinedOn: null,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      appointments: [
        {
          appointmentId: 'appt_1',
          facultyId: 'fac_1',
          departmentId: 'dept_1',
          branchId: 'branch_1',
          isPrimary: true,
          startDate: '2024-01-01',
          endDate: null,
          status: 'active',
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      roleGrants: [
        {
          grantId: 'grant_mentor_1',
          facultyId: 'fac_1',
          roleCode: 'MENTOR',
          scopeType: 'branch',
          scopeId: 'branch_1',
          scopeLabel: 'Computer Science and Engineering',
          startDate: '2024-01-01',
          endDate: null,
          status: 'active',
          version: 1,
        },
      ],
    },
  ],
  students: [
    {
      studentId: 'student_1',
      institutionId: 'inst_1',
      usn: '1AM22CS001',
      rollNumber: null,
      name: 'Aisha Khan',
      email: 'aisha@airmentor.local',
      phone: null,
      admissionDate: '2022-08-01',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      currentCgpa: 8.4,
      activeAcademicContext: {
        enrollmentId: 'enroll_1',
        branchId: 'branch_1',
        branchName: 'Computer Science and Engineering',
        departmentId: 'dept_1',
        departmentName: 'Computer Science',
        termId: 'term_5',
        academicYearLabel: '2024-25',
        semesterNumber: 5,
        sectionCode: 'A',
        batchId: 'batch_2022',
        batchLabel: '2022',
        admissionYear: 2022,
        academicStatus: 'regular',
      },
      activeMentorAssignment: null,
      enrollments: [],
      mentorAssignments: [],
    },
  ],
  courses: [
    {
      courseId: 'course_1',
      institutionId: 'inst_1',
      courseCode: 'CS501',
      title: 'Advanced Algorithms',
      defaultCredits: 4,
      departmentId: 'dept_1',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  curriculumCourses: [
    {
      curriculumCourseId: 'curr_1',
      batchId: 'batch_2022',
      semesterNumber: 5,
      courseId: 'course_1',
      courseCode: 'CS501',
      title: 'Advanced Algorithms',
      credits: 4,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  policyOverrides: [],
  offerings: [
    {
      id: 'course_1',
      offId: 'off_1',
      code: 'CS501',
      title: 'Advanced Algorithms',
      year: '3rd Year',
      dept: 'CSE',
      sem: 5,
      section: 'A',
      count: 60,
      attendance: 91,
      stage: 2,
      stageInfo: {
        stage: 2,
        label: 'In Progress',
        desc: 'Mid-semester',
        color: '#3b82f6',
      },
      tt1Done: true,
      tt2Done: false,
      pendingAction: null,
      sections: ['A'],
      enrolled: [60],
      att: [91],
      branchId: 'branch_1',
      termId: 'term_5',
    },
  ],
  ownerships: [
    {
      ownershipId: 'own_1',
      offeringId: 'off_1',
      facultyId: 'fac_1',
      ownershipRole: 'owner',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  requests: [],
  reminders: [],
}

const route: LiveAdminRoute = {
  section: 'faculties',
  academicFacultyId: 'af_1',
  departmentId: 'dept_1',
  branchId: 'branch_1',
  batchId: 'batch_2022',
}

function makePolicyForm(): PolicyFormState {
  return {
    oMin: '90',
    aPlusMin: '80',
    aMin: '70',
    bPlusMin: '60',
    bMin: '55',
    cMin: '50',
    pMin: '40',
    ce: '60',
    see: '40',
    termTestsWeight: '30',
    quizWeight: '10',
    assignmentWeight: '20',
    maxTermTests: '2',
    maxQuizzes: '2',
    maxAssignments: '2',
    dayStart: '08:30',
    dayEnd: '16:30',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    courseworkWeeks: '16',
    examPreparationWeeks: '1',
    seeWeeks: '3',
    totalWeeks: '20',
    minimumAttendancePercent: '75',
    condonationFloorPercent: '65',
    condonationShortagePercent: '10',
    condonationRequiresApproval: true,
    minimumCeForSeeEligibility: '24',
    allowCondonationForSeeEligibility: true,
    minimumCeMark: '24',
    minimumSeeMark: '16',
    minimumOverallMark: '40',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: '2',
    repeatedCoursePolicy: 'latest-attempt',
    passMarkPercent: '40',
    minimumCgpaForPromotion: '5.0',
    requireNoActiveBacklogs: true,
    highRiskAttendancePercentBelow: '65',
    mediumRiskAttendancePercentBelow: '75',
    highRiskCgpaBelow: '6.0',
    mediumRiskCgpaBelow: '7.0',
    highRiskBacklogCount: '2',
    mediumRiskBacklogCount: '1',
  }
}

function makeStagePolicyForm(): StagePolicyFormState {
  return {
    stages: [
      {
        key: 'pre-tt1',
        label: 'Pre TT1',
        description: 'Opening stage before TT1 closes.',
        semesterDayOffset: '0',
        requiredEvidence: ['attendance'],
        requireQueueClearance: true,
        requireTaskClearance: true,
        advancementMode: 'admin-confirmed',
        color: '#2D8AF0',
      },
    ],
  }
}

function makeEntityEditors(): Pick<EntityEditorState, 'term' | 'curriculum'> {
  return {
    term: {
      termId: '',
      academicYearLabel: '2024-25',
      semesterNumber: '5',
      startDate: '2024-08-01',
      endDate: '2024-12-15',
    },
    curriculum: {
      curriculumCourseId: '',
      semesterNumber: '5',
      courseCode: 'CS501',
      title: 'Advanced Algorithms',
      credits: '4',
    },
  }
}

function makeBatchProvisioningForm(): BatchProvisioningFormState {
  return {
    termId: 'term_5',
    sectionLabels: 'A, B',
    mode: 'mock',
    studentsPerSection: '60',
    facultyPoolIds: ['fac_1'],
    createStudents: true,
    createMentors: true,
    createAttendanceScaffolding: true,
    createAssessmentScaffolding: false,
    createTranscriptScaffolding: true,
  }
}

function makeBulkMentorAssignmentForm(): BulkMentorAssignmentFormState {
  return {
    facultyId: 'fac_1',
    effectiveFrom: '2024-08-01',
    source: 'sysadmin-bulk-mentor-apply',
    selectionMode: 'replace-all',
  }
}

function makeBulkMentorAssignmentPreview(): ApiMentorAssignmentBulkApplyResponse {
  return {
    ok: true,
    preview: true,
    bulkApplyId: null,
    batchId: 'batch_2022',
    batchLabel: '2022',
    sectionCode: 'A',
    facultyId: 'fac_1',
    facultyDisplayName: 'Prof. Kavitha Rao',
    scopeLabel: 'Batch 2022 · Section A',
    effectiveFrom: '2024-08-01',
    source: 'sysadmin-bulk-mentor-apply',
    selectionMode: 'replace-all',
    mentorEligibility: {
      eligible: true,
      appointmentInScope: true,
      mentorGrantInScope: true,
      reasons: [],
    },
    studentIds: ['student_1'],
    summary: {
      targetedStudentCount: 1,
      unchangedCount: 0,
      endedAssignmentCount: 0,
      createdAssignmentCount: 1,
    },
    students: [
      {
        studentId: 'student_1',
        studentName: 'Aisha Khan',
        usn: '1AM22CS001',
        sectionCode: 'A',
        currentMentorFacultyId: null,
        currentMentorAssignmentId: null,
        action: 'assign',
        actionReason: 'No active mentor assignment exists in the selected scope.',
      },
    ],
  }
}

const proofDashboardProps: ComponentProps<typeof SystemAdminProofDashboardWorkspace> = {
  proofDashboard: null,
  proofDashboardLoading: false,
  activeRunCheckpoints: [],
  activeModelDiagnostics: null,
  activeProductionDiagnostics: null,
  activeDiagnosticsTrainingManifestVersion: null,
  activeDiagnosticsCalibrationVersion: null,
  activeDiagnosticsSplitSummary: null,
  activeDiagnosticsWorldSplitSummary: null,
  activeDiagnosticsScenarioFamilies: null,
  activeDiagnosticsHeadSupportSummary: null,
  activeDiagnosticsGovernedRunCount: null,
  activeDiagnosticsSkippedRunCount: null,
  activeDiagnosticsDisplayProbabilityAllowed: null,
  activeDiagnosticsSupportWarning: null,
  activeDiagnosticsPolicyDiagnostics: null,
  activeDiagnosticsCoEvidence: null,
  activeDiagnosticsPolicyAcceptance: null,
  activeDiagnosticsOverallCourseRuntime: null,
  activeDiagnosticsQueueBurden: null,
  activeDiagnosticsUiParity: null,
  selectedProofCheckpoint: null,
  selectedProofCheckpointDetail: null,
  selectedProofCheckpointBlocked: false,
  selectedProofCheckpointHasBlockedProgression: false,
  selectedProofCheckpointCanStepForward: false,
  selectedProofCheckpointCanPlayToEnd: false,
  proofPlaybackRestoreNotice: null,
  onCreateProofImport: () => {},
  onValidateLatestProofImport: () => {},
  onReviewPendingCrosswalks: () => {},
  onApproveLatestProofImport: () => {},
  onCreateProofRun: () => {},
  onRecomputeProofRunRisk: () => {},
  onActivateProofRun: () => {},
  onRetryProofRun: () => {},
  onArchiveProofRun: () => {},
  onRestoreProofSnapshot: () => {},
  onResetProofPlaybackSelection: () => {},
  onSelectProofCheckpoint: () => {},
  onStepProofPlayback: () => {},
  formatSplitSummary: () => '',
  formatKeyedCounts: () => '',
  formatHeadSupportSummary: () => '',
  formatDiagnosticSummary: () => '',
}

const registryLaunchProps: ComponentProps<typeof SystemAdminScopedRegistryLaunches> = {
  registryScopeLabel: 'Batch 2022',
  studentScopeChipLabel: 'Batch 2022',
  facultyScopeChipLabel: 'Batch faculty',
  visibleStudentCount: 1,
  visibleFacultyCount: 1,
  studentToneColor: T.accent,
  facultyToneColor: T.success,
  onOpenScopedStudents: () => {},
  onOpenAllStudents: () => {},
  onOpenScopedFaculty: () => {},
  onOpenAllFaculty: () => {},
}

function renderWorkspace(
  universityTab: 'overview' | 'bands' | 'courses' | 'provision',
  overrides?: Partial<ComponentProps<typeof SystemAdminFacultiesWorkspace>>,
) {
  const markup = renderToStaticMarkup(createElement(SystemAdminFacultiesWorkspace, {
    data,
    route,
    toneColor: T.success,
    restoreNotice: null,
    onResetRestore: () => {},
    selectedAcademicFaculty: data.academicFaculties[0],
    selectedDepartment: data.departments[0],
    selectedBranch: data.branches[0],
    selectedBatch: data.batches[0],
    canonicalProofBatch: null,
    authoritativeOperationalSemester: 5,
    authoritativeOperationalSemesterSource: 'batch',
    selectedSectionCode: 'A',
    selectedAcademicFacultyImpact: {
      departments: 1,
      branches: 1,
      batches: 1,
      students: 1,
      facultyMembers: 1,
      courses: 1,
    },
    facultyDepartments: data.departments,
    departmentBranches: data.branches,
    branchBatches: data.batches,
    structureForms: {
      academicFaculty: { code: 'ENG', name: 'Engineering', overview: '' },
      department: { code: 'CSE', name: 'Computer Science' },
      branch: { code: 'CSE', name: 'Computer Science and Engineering', programLevel: 'UG', semesterCount: '8' },
      batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '5', sectionLabels: 'A, B' },
      term: { academicYearLabel: '2024-25', semesterNumber: '5', startDate: '2024-08-01', endDate: '2024-12-15' },
      curriculum: { semesterNumber: '5', courseCode: 'CS501', title: 'Advanced Algorithms', credits: '4' },
    },
    setStructureForms: () => {},
    setEditingEntity: () => {},
    handleCreateAcademicFaculty: event => event.preventDefault(),
    handleCreateDepartment: event => event.preventDefault(),
    handleCreateBranch: event => event.preventDefault(),
    handleCreateBatch: event => event.preventDefault(),
    navigate: () => {},
    updateSelectedSectionCode: () => {},
    universityTab,
    updateUniversityTab: () => {},
    universityTabOptions: [
      { id: 'overview', label: 'Overview', icon: createElement('span', null, 'O') },
      { id: 'bands', label: 'Bands', icon: createElement('span', null, 'B') },
      { id: 'ce-see', label: 'CE / SEE', icon: createElement('span', null, 'C') },
      { id: 'cgpa', label: 'CGPA Formula', icon: createElement('span', null, 'G') },
      { id: 'stage', label: 'Stage Gates', icon: createElement('span', null, 'S') },
      { id: 'courses', label: 'Courses', icon: createElement('span', null, 'C') },
      { id: 'provision', label: 'Provision', icon: createElement('span', null, 'P') },
    ],
    universityWorkspaceTabCards: [
      { id: 'bands', label: 'Bands', description: 'Bands editor', icon: createElement('span', null, 'B') },
      { id: 'courses', label: 'Courses', description: 'Course editor', icon: createElement('span', null, 'C') },
      { id: 'provision', label: 'Provision', description: 'Provisioning editor', icon: createElement('span', null, 'P') },
    ],
    universityWorkspaceColumns: 'minmax(0, 1fr)',
    universityLevelTitle: 'Years',
    universityLevelHelper: 'Year-level helper',
    universityLeftItems: [{ key: 'batch_2022', title: '3rd Year', subtitle: 'Batch 2022', selected: true, onSelect: () => {} }],
    universityWorkspaceLabel: 'Batch 2022',
    universityWorkspacePaneRef: createRef(),
    stickyShadow: 'none',
    activeBatchPolicyOverride: null,
    activeScopeChain: [
      { scopeType: 'institution', scopeId: 'inst_1', label: 'AirMentor University' },
      { scopeType: 'academic-faculty', scopeId: 'af_1', label: 'Engineering' },
      { scopeType: 'department', scopeId: 'dept_1', label: 'Computer Science' },
      { scopeType: 'branch', scopeId: 'branch_1', label: 'Computer Science and Engineering' },
      { scopeType: 'batch', scopeId: 'batch_2022', label: 'Batch 2022' },
      { scopeType: 'section', scopeId: 'batch_2022::A', label: 'Section A' },
    ],
    activeGovernanceScope: { scopeType: 'section', scopeId: 'batch_2022::A', label: 'Section A' },
    resolvedBatchPolicy: {
      scopeDescriptor: {
        scopeType: 'section',
        scopeId: 'batch_2022::A',
        label: 'Section A',
        batchId: 'batch_2022',
        sectionCode: 'A',
        branchName: 'Computer Science and Engineering',
        simulationRunId: null,
        simulationStageCheckpointId: null,
        studentId: null,
      },
      resolvedFrom: {
        kind: 'policy-override',
        scopeType: 'section',
        scopeId: 'batch_2022::A',
        label: 'Section A override',
      },
      scopeMode: 'section',
      appliedOverrides: [
        { scopeType: 'batch', scopeId: 'batch_2022' },
        { scopeType: 'section', scopeId: 'batch_2022::A' },
      ],
    },
    resolvedStagePolicy: {
      scopeDescriptor: {
        scopeType: 'section',
        scopeId: 'batch_2022::A',
        label: 'Section A',
        batchId: 'batch_2022',
        sectionCode: 'A',
        branchName: 'Computer Science and Engineering',
        simulationRunId: null,
        simulationStageCheckpointId: null,
        studentId: null,
      },
      resolvedFrom: {
        kind: 'policy-override',
        scopeType: 'section',
        scopeId: 'batch_2022::A',
        label: 'Section A stage override',
      },
      scopeMode: 'section',
      appliedOverrides: [
        { scopeType: 'batch', scopeId: 'batch_2022' },
        { scopeType: 'section', scopeId: 'batch_2022::A' },
      ],
    },
    activeScopePolicyOverride: {
      policyOverrideId: 'policy_section',
      scopeType: 'section',
      scopeId: 'batch_2022::A',
      policy: {},
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    activeScopeStageOverride: {
      stagePolicyOverrideId: 'stage_policy_section',
      scopeType: 'section',
      scopeId: 'batch_2022::A',
      policy: { stages: [] },
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    policyForm: makePolicyForm(),
    setPolicyForm: () => {},
    stagePolicyForm: makeStagePolicyForm(),
    setStagePolicyForm: () => {},
    handleSaveScopePolicy: async () => {},
    handleResetScopePolicy: async () => {},
    handleSaveScopeStagePolicy: async () => {},
    handleResetScopeStagePolicy: async () => {},
    entityEditors: makeEntityEditors(),
    setEntityEditors: () => {},
    batchTerms: data.terms,
    currentSemesterTerm: data.terms[0],
    startEditingTerm: () => {},
    resetTermEditor: () => {},
    handleSaveTerm: event => event.preventDefault(),
    handleArchiveTerm: async () => {},
    selectedCurriculumSemester: '5',
    setSelectedCurriculumSemester: () => {},
    curriculumSemesterEntries: [{ semesterNumber: 5, courses: data.curriculumCourses }],
    selectedCurriculumCourseId: 'curr_1',
    startEditingCurriculumCourse: () => {},
    resetCurriculumEditor: () => {},
    handleSaveCurriculumCourse: event => event.preventDefault(),
    handleArchiveCurriculumCourse: async () => {},
    handleBootstrapCurriculumManifest: async () => {},
    scopedCourseLeaderFaculty: data.facultyMembers,
    getScopedCourseLeaderState: () => ({
      matchingOfferings: data.offerings,
      leaderIds: ['fac_1'],
      selectedFacultyId: 'fac_1',
      hasMultipleLeaders: false,
    }),
    handleAssignCurriculumCourseLeader: async () => {},
    batchProvisioningForm: makeBatchProvisioningForm(),
    setBatchProvisioningForm: () => {},
    handleProvisionBatch: async () => {},
    batchFacultyPool: data.facultyMembers,
    batchMentorEligibleFaculty: data.facultyMembers,
    batchOfferingsWithoutOwner: [],
    batchStudentsWithoutEnrollment: [],
    batchStudentsWithoutMentor: data.students,
    batchOfferingsWithoutRoster: [],
    bulkMentorAssignmentForm: makeBulkMentorAssignmentForm(),
    setBulkMentorAssignmentForm: () => {},
    bulkMentorAssignmentPreview: makeBulkMentorAssignmentPreview(),
    handlePreviewBulkMentorAssignment: async () => {},
    handleApplyBulkMentorAssignment: async () => {},
    clearBulkMentorAssignmentPreview: () => {},
    activeUniversityRegistryScope: { label: 'Batch 2022' },
    activeUniversityStudentScopeChipLabel: 'Batch 2022',
    activeUniversityFacultyScopeChipLabel: 'Batch faculty',
    scopedUniversityStudents: data.students,
    filteredUniversityFaculty: data.facultyMembers,
    curriculumFeatureConfig: null,
    curriculumFeatureItems: [],
    selectedCurriculumFeatureCourseId: '',
    setSelectedCurriculumFeatureCourseId: () => {},
    selectedCurriculumFeatureItem: null,
    curriculumFeatureProfileOptions: [],
    curriculumFeatureBindingMode: 'inherit-scope-profile',
    setCurriculumFeatureBindingMode: () => {},
    curriculumFeaturePinnedProfileId: '',
    setCurriculumFeaturePinnedProfileId: () => {},
    curriculumFeatureTargetMode: 'batch-local-override',
    setCurriculumFeatureTargetMode: () => {},
    curriculumFeatureTargetScopeKey: '',
    setCurriculumFeatureTargetScopeKey: () => {},
    curriculumFeatureTargetScopeOptions: [],
    selectedCurriculumFeatureTargetScope: null,
    curriculumFeatureAffectedBatchPreview: [],
    curriculumLinkageGenerationStatus: null,
    curriculumLinkageCandidatesLoading: false,
    selectedCurriculumLinkageCandidates: [],
    curriculumLinkageReviewNote: '',
    setCurriculumLinkageReviewNote: () => {},
    curriculumFeatureForm: {
      assessmentProfile: 'admin-authored',
      outcomesText: '',
      prerequisitesText: '',
      bridgeModulesText: '',
      tt1TopicsText: '',
      tt2TopicsText: '',
      seeTopicsText: '',
      workbookTopicsText: '',
    },
    setCurriculumFeatureForm: () => {},
    handleSaveCurriculumFeatureBinding: async () => {},
    handleRegenerateCurriculumLinkageCandidates: async () => {},
    handleApproveCurriculumLinkageCandidate: async () => {},
    handleRejectCurriculumLinkageCandidate: async () => {},
    handleSaveCurriculumFeatureConfig: async () => {},
    proofDashboardProps,
    registryLaunchProps,
    ...overrides,
  } as ComponentProps<typeof SystemAdminFacultiesWorkspace>))

  return markup
}

describe('system-admin faculties workspace parity', () => {
  it('renders extracted governance controls instead of the old placeholder copy', () => {
    const markup = renderWorkspace('bands')

    expect(markup).toContain('Academic Bands')
    expect(markup).toContain('Save Scope Governance')
    expect(markup).toContain('Scope Section A')
    expect(markup).toContain('Resolved from Section A override')
    expect(markup).toContain('Effective policy resolves from Section A override')
    expect(markup).toContain('fall back to Batch 2022 override')
    expect(markup).not.toContain('Governance controls remain in this workspace')
    expect(markup).not.toContain('The stage policy block is intentionally unchanged while the workspace is extracted.')
  })

  it('renders the extracted stage policy editor with direct save and reset actions', () => {
    const markup = renderWorkspace('stage')

    expect(markup).toContain('Stage Policy')
    expect(markup).toContain('Pre TT1')
    expect(markup).toContain('Save Stage Policy')
    expect(markup).toContain('Reset To Inherited Stage Policy')
    expect(markup).toContain('Resolved from Section A stage override')
    expect(markup).toContain('Effective stage policy resolves from Section A stage override')
    expect(markup).toContain('fall back to Batch 2022 override')
    expect(markup).not.toContain('The stage policy block is intentionally unchanged while the workspace is extracted.')
  })

  it('renders term, curriculum, and course-leader controls from the extracted workspace', () => {
    const markup = renderWorkspace('courses')

    expect(markup).toContain('Terms, Curriculum, And Course Leaders')
    expect(markup).toContain('Academic Terms')
    expect(markup).toContain('Curriculum Rows')
    expect(markup).toContain('Course leader')
    expect(markup).toContain('Bootstrap From Manifest')
    expect(markup).toContain('Prof. Kavitha Rao')
  })

  it('renders deterministic provisioning controls from the extracted workspace', () => {
    const markup = renderWorkspace('provision')

    expect(markup).toContain('Provisioning')
    expect(markup).toContain('Mentor-Ready Faculty')
    expect(markup).toContain('Faculty In Scope')
    expect(markup).toContain('Students Without Mentor')
    expect(markup).toContain('Live Empty')
    expect(markup).toContain('Bulk Mentor Assignment')
    expect(markup).toContain('Preview Bulk Apply')
    expect(markup).toContain('Apply Previewed Mentor Changes')
    expect(markup).toContain('Batch 2022 · Section A')
    expect(markup).toContain('Prof. Kavitha Rao')
    expect(markup).toContain('Run Provisioning')
    expect(markup).toContain('Current semester term 2024-25')
  })

  it('renders canonical proof scope provenance when the proof pilot batch is active', () => {
    const canonicalProofBatch = {
      ...data.batches[0],
      batchId: 'batch_branch_mnc_btech_2023',
      batchLabel: '2023 Proof',
      currentSemester: 6,
    }

    const markup = renderWorkspace('overview', {
      route: {
        ...route,
        batchId: canonicalProofBatch.batchId,
      },
      selectedBatch: canonicalProofBatch,
      canonicalProofBatch,
      authoritativeOperationalSemester: 4,
      authoritativeOperationalSemesterSource: 'proof-run',
    })

    expect(markup).toContain('Pilot Scope Provenance')
    expect(markup).toContain('Canonical proof pilot active')
    expect(markup).toContain('Proof operational semester · Sem 4')
    expect(markup).toContain('Canonical batch 2023 Proof')
  })
})
