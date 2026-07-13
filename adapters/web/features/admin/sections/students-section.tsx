import { AdminDetailTabPanel } from '../live-app-chrome'
import { StudentsRegistryPanel } from './students/students-registry-panel'
import { StudentWorkspaceHeader } from './students/student-workspace-header'
import { StudentProfileTab } from './students/student-profile-tab'
import { StudentAcademicTab } from './students/student-academic-tab'
import { StudentMentorTab } from './students/student-mentor-tab'
import { StudentProgressionTab } from './students/student-progression-tab'
import { StudentHistoryTab } from './students/student-history-tab'
import type { StudentsSectionProps } from './students/types'

export function StudentsSection(props: StudentsSectionProps) {
  const {
    data,
    route,
    themeMode,
    registryPageColumns,
    registryFilterColumns,
    registryIsSingleColumn,
    registryScope,
    navigate,
    studentRegistryItems,
    studentRegistryViewItems,
    studentRegistryCaption,
    studentRegistryEmptyMessage,
    studentRegistryScopeLabel,
    studentRegistryProofOverlayActive,
    studentRegistrySearch,
    setStudentRegistrySearch,
    effectiveStudentRegistryFilter,
    setStudentRegistryFilter,
    studentFilterDepartments,
    studentFilterBranches,
    studentFilterBatches,
    studentFilterSections,
    visibleAcademicFaculties,
    selectedStudent,
    selectedStudentRouteIsExplicit,
    selectedStudentScopeMismatch,
    selectedStudentDisplayCgpa,
    selectedStudentDisplaySemester,
    selectedStudentDisplayBacklogCount,
    selectedStudentCheckpointCgpaVisible,
    selectedStudentCheckpointSummary,
    selectedStudentCheckpointBanner,
    selectedStudentProofBanner,
    selectedStudentPolicy,
    selectedStudentPolicyLoading,
    selectedStudentPromotionRecommended,
    selectedStudentPromotionRules,
    selectedStudentNextTerms,
    selectedProofCheckpoint,
    studentDetailTab,
    setStudentDetailTab,
    studentForm,
    setStudentForm,
    setEnrollmentForm,
    setMentorForm,
    studentAuditLoading,
    studentAuditEvents,
    handleSaveStudent,
    handleArchiveStudent,
    handleCloseEnrollment,
    handleEndMentorAssignment,
    handlePromoteStudent,
    setEditingEntity,
    resetStudentEditors,
    startEditingEnrollment,
    startEditingMentorAssignment,
  } = props

  return (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <StudentsRegistryPanel
              route={route}
              registryFilterColumns={registryFilterColumns}
              registryIsSingleColumn={registryIsSingleColumn}
              registryScope={registryScope}
              navigate={navigate}
              studentRegistryItems={studentRegistryItems}
              studentRegistryViewItems={studentRegistryViewItems}
              studentRegistryCaption={studentRegistryCaption}
              studentRegistryEmptyMessage={studentRegistryEmptyMessage}
              studentRegistryScopeLabel={studentRegistryScopeLabel}
              studentRegistryProofOverlayActive={studentRegistryProofOverlayActive}
              studentRegistrySearch={studentRegistrySearch}
              setStudentRegistrySearch={setStudentRegistrySearch}
              effectiveStudentRegistryFilter={effectiveStudentRegistryFilter}
              setStudentRegistryFilter={setStudentRegistryFilter}
              studentFilterDepartments={studentFilterDepartments}
              studentFilterBranches={studentFilterBranches}
              studentFilterBatches={studentFilterBatches}
              studentFilterSections={studentFilterSections}
              visibleAcademicFaculties={visibleAcademicFaculties}
              selectedProofCheckpoint={selectedProofCheckpoint}
              resetStudentEditors={resetStudentEditors}
            />

            <div style={{ display: 'grid', gap: 16 }}>
              <StudentWorkspaceHeader
                themeMode={themeMode}
                selectedStudent={selectedStudent}
                selectedStudentRouteIsExplicit={selectedStudentRouteIsExplicit}
                selectedStudentScopeMismatch={selectedStudentScopeMismatch}
                selectedStudentDisplayCgpa={selectedStudentDisplayCgpa}
                selectedStudentDisplaySemester={selectedStudentDisplaySemester}
                selectedStudentCheckpointCgpaVisible={selectedStudentCheckpointCgpaVisible}
                selectedStudentCheckpointSummary={selectedStudentCheckpointSummary}
                selectedStudentPolicy={selectedStudentPolicy}
                selectedStudentPolicyLoading={selectedStudentPolicyLoading}
                selectedProofCheckpoint={selectedProofCheckpoint}
                studentDetailTab={studentDetailTab}
                setStudentDetailTab={setStudentDetailTab}
                studentAuditEvents={studentAuditEvents}
              />

              {studentDetailTab === 'profile' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="profile">
              <StudentProfileTab
                navigate={navigate}
                selectedStudent={selectedStudent}
                selectedStudentDisplayCgpa={selectedStudentDisplayCgpa}
                selectedStudentDisplaySemester={selectedStudentDisplaySemester}
                selectedStudentCheckpointCgpaVisible={selectedStudentCheckpointCgpaVisible}
                selectedStudentCheckpointSummary={selectedStudentCheckpointSummary}
                selectedStudentCheckpointBanner={selectedStudentCheckpointBanner}
                selectedStudentProofBanner={selectedStudentProofBanner}
                selectedStudentPolicy={selectedStudentPolicy}
                selectedStudentPolicyLoading={selectedStudentPolicyLoading}
                selectedStudentPromotionRules={selectedStudentPromotionRules}
                studentForm={studentForm}
                setStudentForm={setStudentForm}
                studentAuditLoading={studentAuditLoading}
                studentAuditEvents={studentAuditEvents}
                handleSaveStudent={handleSaveStudent}
                handleArchiveStudent={handleArchiveStudent}
                setEditingEntity={setEditingEntity}
                resetStudentEditors={resetStudentEditors}
              />
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'academic' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="academic">
              <StudentAcademicTab
                data={data}
                selectedStudent={selectedStudent}
                setEnrollmentForm={setEnrollmentForm}
                setEditingEntity={setEditingEntity}
                handleCloseEnrollment={handleCloseEnrollment}
                startEditingEnrollment={startEditingEnrollment}
              />
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'mentor' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="mentor">
              <StudentMentorTab
                data={data}
                selectedStudent={selectedStudent}
                setMentorForm={setMentorForm}
                setEditingEntity={setEditingEntity}
                handleEndMentorAssignment={handleEndMentorAssignment}
                startEditingMentorAssignment={startEditingMentorAssignment}
              />
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'progression' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="progression">
              <StudentProgressionTab
                selectedStudent={selectedStudent}
                selectedStudentDisplayCgpa={selectedStudentDisplayCgpa}
                selectedStudentDisplaySemester={selectedStudentDisplaySemester}
                selectedStudentDisplayBacklogCount={selectedStudentDisplayBacklogCount}
                selectedStudentCheckpointCgpaVisible={selectedStudentCheckpointCgpaVisible}
                selectedStudentCheckpointSummary={selectedStudentCheckpointSummary}
                selectedStudentCheckpointBanner={selectedStudentCheckpointBanner}
                selectedStudentPolicy={selectedStudentPolicy}
                selectedStudentPolicyLoading={selectedStudentPolicyLoading}
                selectedStudentPromotionRecommended={selectedStudentPromotionRecommended}
                selectedStudentPromotionRules={selectedStudentPromotionRules}
                selectedStudentNextTerms={selectedStudentNextTerms}
                handlePromoteStudent={handlePromoteStudent}
              />
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'history' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="history">
              <StudentHistoryTab
                studentAuditLoading={studentAuditLoading}
                studentAuditEvents={studentAuditEvents}
              />
              </AdminDetailTabPanel>
              )}
            </div>
          </div>
  )
}
