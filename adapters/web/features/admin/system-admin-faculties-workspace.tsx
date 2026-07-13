import { useEffect, useState } from 'react'
import { isCanonicalProofBatchId } from '@web/simulation/proof-pilot'
import { SystemAdminHierarchyWorkspaceShell } from './system-admin-hierarchy-workspace-shell'
import { SystemAdminScopedRegistryLaunches } from './system-admin-scoped-registry-launches'
import { SectionHeading } from './system-admin-ui'
import type { SystemAdminFacultiesWorkspaceProps } from './faculties-workspace/types'
import {
  formatScopeTypeLabel,
  validatePrerequisiteDraftAgainstCurriculum,
} from './faculties-workspace/workspace-helpers'
import {
  SystemAdminHierarchyWorkspaceTabs,
  WorkspaceEntityRailItems,
  WorkspaceMeta,
} from './faculties-workspace/workspace-primitives'
import { WorkspaceSelectorControls } from './faculties-workspace/selector-controls'
import { OverviewNavigator, YearEditors } from './faculties-workspace/overview-navigator'
import { GovernancePanels } from './faculties-workspace/governance-panels'
import { CoursesPanel, CurriculumPanel } from './faculties-workspace/courses-panel'
import { ProvisioningPanel } from './faculties-workspace/provisioning-panel'
import {
  AcademicFacultyCreateForm,
  AcademicFacultyDetailCard,
  BranchDetailCard,
  DepartmentDetailCard,
  PickAYearFallback,
} from './faculties-workspace/hierarchy-structure-cards'
import { BatchOverviewCard, BatchSetupChecklist } from './faculties-workspace/batch-overview-card'

export { SystemAdminHierarchyWorkspaceTabs }
export {
  describeGovernanceResolutionMessage,
  describeGovernanceRollbackMessage,
} from './faculties-workspace/workspace-helpers'

export function SystemAdminFacultiesWorkspace({
  data,
  route,
  toneColor,
  restoreNotice,
  onResetRestore,
  onDismissRestoreNotice,
  selectedAcademicFaculty,
  selectedDepartment,
  selectedBranch,
  selectedBatch,
  canonicalProofBatch,
  authoritativeOperationalSemester,
  authoritativeOperationalSemesterSource,
  selectedSectionCode,
  selectedAcademicFacultyImpact,
  facultyDepartments,
  departmentBranches,
  branchBatches,
  structureForms,
  setStructureForms,
  setEditingEntity,
  handleCreateAcademicFaculty,
  handleCreateDepartment,
  handleCreateBranch,
  handleCreateBatch,
  navigate,
  updateSelectedSectionCode,
  universityTab,
  updateUniversityTab,
  universityTabOptions,
  universityWorkspaceTabCards,
  universityWorkspaceColumns,
  universityLevelTitle,
  universityLevelHelper,
  universityLeftItems,
  universityWorkspaceLabel,
  universityWorkspacePaneRef,
  stickyShadow,
  activeBatchPolicyOverride,
  activeScopeChain,
  activeGovernanceScope,
  resolvedBatchPolicy,
  resolvedStagePolicy,
  activeScopePolicyOverride,
  activeScopeStageOverride,
  policyForm,
  setPolicyForm,
  stagePolicyForm,
  setStagePolicyForm,
  handleSaveScopePolicy,
  handleResetScopePolicy,
  handleSaveScopeStagePolicy,
  handleResetScopeStagePolicy,
  entityEditors,
  setEntityEditors,
  batchTerms,
  currentSemesterTerm,
  startEditingTerm,
  resetTermEditor,
  handleSaveTerm,
  handleArchiveTerm,
  selectedCurriculumSemester,
  setSelectedCurriculumSemester,
  curriculumSemesterEntries,
  activeUniversityRegistryScope,
  activeUniversityStudentScopeChipLabel,
  activeUniversityFacultyScopeChipLabel,
  scopedUniversityStudents,
  filteredUniversityFaculty,
  curriculumFeatureConfig,
  curriculumFeatureItems,
  selectedCurriculumFeatureCourseId,
  setSelectedCurriculumFeatureCourseId,
  selectedCurriculumFeatureItem,
  selectedCurriculumCourseId,
  startEditingCurriculumCourse,
  resetCurriculumEditor,
  handleSaveCurriculumCourse,
  handleArchiveCurriculumCourse,
  handleBootstrapCurriculumManifest,
  scopedCourseLeaderFaculty,
  getScopedCourseLeaderState,
  handleAssignCurriculumCourseLeader,
  batchProvisioningForm,
  setBatchProvisioningForm,
  handleProvisionBatch,
  handleProvisionSeededDemoWorkspace,
  batchFacultyPool,
  batchMentorEligibleFaculty,
  batchOfferingsWithoutOwner,
  batchStudentsWithoutEnrollment,
  batchStudentsWithoutMentor,
  batchOfferingsWithoutRoster,
  batchSetupReadiness,
  bulkMentorAssignmentForm,
  setBulkMentorAssignmentForm,
  bulkMentorAssignmentPreview,
  handlePreviewBulkMentorAssignment,
  handleApplyBulkMentorAssignment,
  clearBulkMentorAssignmentPreview,
  curriculumFeatureProfileOptions,
  curriculumFeatureBindingMode,
  setCurriculumFeatureBindingMode,
  curriculumFeaturePinnedProfileId,
  setCurriculumFeaturePinnedProfileId,
  curriculumFeatureTargetMode,
  setCurriculumFeatureTargetMode,
  curriculumFeatureTargetScopeKey,
  setCurriculumFeatureTargetScopeKey,
  curriculumFeatureTargetScopeOptions,
  selectedCurriculumFeatureTargetScope,
  curriculumFeatureAffectedBatchPreview,
  curriculumLinkageGenerationStatus,
  curriculumLinkageCandidatesLoading,
  selectedCurriculumLinkageCandidates,
  curriculumLinkageReviewNote,
  setCurriculumLinkageReviewNote,
  curriculumFeatureForm,
  setCurriculumFeatureForm,
  handleSaveCurriculumFeatureBinding,
  handleRegenerateCurriculumLinkageCandidates,
  handleApproveCurriculumLinkageCandidate,
  handleRejectCurriculumLinkageCandidate,
  handleSaveCurriculumFeatureConfig,
  handlePreviewCurriculumFeatureConfig,
  curriculumFeaturePreview,
  handleLoadCurriculumFeatureHistory,
  curriculumFeatureHistory,
  proofDashboardProps,
  onOpenProofDashboard,
  registryLaunchProps,
  apiClient,
}: SystemAdminFacultiesWorkspaceProps) {
  void [
    route,
    canonicalProofBatch,
    activeUniversityRegistryScope,
    activeUniversityStudentScopeChipLabel,
    activeUniversityFacultyScopeChipLabel,
    scopedUniversityStudents,
    filteredUniversityFaculty,
    curriculumFeatureConfig,
    curriculumFeatureItems,
    selectedCurriculumFeatureCourseId,
    setSelectedCurriculumFeatureCourseId,
    curriculumFeatureProfileOptions,
    curriculumFeatureBindingMode,
    setCurriculumFeatureBindingMode,
    curriculumFeaturePinnedProfileId,
    setCurriculumFeaturePinnedProfileId,
    curriculumFeatureTargetMode,
    setCurriculumFeatureTargetMode,
    curriculumFeatureTargetScopeKey,
    setCurriculumFeatureTargetScopeKey,
    curriculumFeatureTargetScopeOptions,
    curriculumFeatureAffectedBatchPreview,
    curriculumLinkageGenerationStatus,
    curriculumLinkageCandidatesLoading,
    selectedCurriculumLinkageCandidates,
    curriculumLinkageReviewNote,
    setCurriculumLinkageReviewNote,
    setCurriculumFeatureForm,
    handleSaveCurriculumFeatureBinding,
    handleRegenerateCurriculumLinkageCandidates,
    handleApproveCurriculumLinkageCandidate,
    handleRejectCurriculumLinkageCandidate,
    handleSaveCurriculumFeatureConfig,
    handlePreviewCurriculumFeatureConfig,
    curriculumFeaturePreview,
    handleLoadCurriculumFeatureHistory,
    curriculumFeatureHistory,
  ]
  const [syntheticProvisioningEnabled, setSyntheticProvisioningEnabled] = useState(false)

  useEffect(() => {
    if (syntheticProvisioningEnabled) return
    if (batchProvisioningForm.mode !== 'mock' && batchProvisioningForm.createStudents === false) return
    setBatchProvisioningForm(prev => (
      prev.mode === 'mock' || prev.createStudents
        ? { ...prev, mode: 'live-empty', createStudents: false }
        : prev
    ))
  }, [batchProvisioningForm.createStudents, batchProvisioningForm.mode, setBatchProvisioningForm, syntheticProvisioningEnabled])

  const selectedCurriculumFeatureTargetScopeChip = selectedCurriculumFeatureTargetScope
    ? `${formatScopeTypeLabel(selectedCurriculumFeatureTargetScope.scopeType)} · ${selectedCurriculumFeatureTargetScope.label}`
    : null
  const curriculumPrerequisiteValidation = validatePrerequisiteDraftAgainstCurriculum(
    selectedCurriculumFeatureItem,
    curriculumFeatureForm.prerequisitesText,
    curriculumSemesterEntries,
  )
  const hasDraftPrerequisiteText = curriculumFeatureForm.prerequisitesText.trim().length > 0
  const hasCurriculumPrerequisiteErrors = curriculumPrerequisiteValidation.errors.length > 0
  const selectedBatchIsCanonicalProof = isCanonicalProofBatchId(selectedBatch?.batchId)
  void [
    selectedCurriculumFeatureTargetScopeChip,
    hasDraftPrerequisiteText,
    hasCurriculumPrerequisiteErrors,
    selectedBatchIsCanonicalProof,
  ]

  return (
    <SystemAdminHierarchyWorkspaceShell
      toneColor={toneColor}
      restoreNotice={restoreNotice}
      onResetRestore={onResetRestore}
      onDismissRestore={onDismissRestoreNotice}
      selectorControls={(
        <WorkspaceSelectorControls
          data={data} selectedAcademicFaculty={selectedAcademicFaculty} selectedDepartment={selectedDepartment}
          selectedBranch={selectedBranch} selectedBatch={selectedBatch} selectedSectionCode={selectedSectionCode}
          facultyDepartments={facultyDepartments} departmentBranches={departmentBranches} branchBatches={branchBatches}
          navigate={navigate} updateSelectedSectionCode={updateSelectedSectionCode}
        />
      )}
      selectorHelperText="Search narrows automatically to the active selector scope. `Year` is a UI alias for the canonical batch record beneath it."
      workspaceColumns={universityWorkspaceColumns}
      entityRailTitle={universityLevelTitle}
      entityRailHelper={universityLevelHelper}
      entityRailCount={universityLeftItems.length}
      entityRailItems={<WorkspaceEntityRailItems universityLeftItems={universityLeftItems} />}
      entityRailEmptyTitle={`No ${universityLevelTitle.toLowerCase()} yet`}
      entityRailEmptyBody="Use the forms on the right to create the first record in this scope."
      entityRailCreateForm={!selectedAcademicFaculty ? (
        <AcademicFacultyCreateForm handleCreateAcademicFaculty={handleCreateAcademicFaculty} structureForms={structureForms} setStructureForms={setStructureForms} />
      ) : null}
      workspacePaneRef={universityWorkspacePaneRef}
      stickyShadow={stickyShadow}
      workspaceLabel={universityWorkspaceLabel}
      workspaceHelperText={selectedBatch
        ? 'Use the editor cards below or the sticky tabs here to jump straight into the exact year-level control surface.'
        : activeGovernanceScope
          ? 'Governance tabs stay live at every inherited scope here, even before you drill all the way into a year.'
          : 'Pick a scope from the hierarchy to unlock governance, policy, and stage controls for that exact layer.'}
      workspaceMeta={<WorkspaceMeta selectedBranch={selectedBranch} selectedBatch={selectedBatch} activeBatchPolicyOverride={activeBatchPolicyOverride} />}
      tabActions={<SystemAdminHierarchyWorkspaceTabs tabs={universityTabOptions} activeTab={universityTab} onChange={tabId => updateUniversityTab(tabId)} />}
      workspacePanelId={`university-panel-${universityTab}`}
      workspacePanelLabelledBy={`university-tab-${universityTab}`}
      overviewNavigator={(
        <OverviewNavigator
          universityTab={universityTab} selectedSectionCode={selectedSectionCode} universityLevelTitle={universityLevelTitle}
          universityLevelHelper={universityLevelHelper} selectedBatch={selectedBatch} branchBatches={branchBatches}
          selectedAcademicFaculty={selectedAcademicFaculty} selectedDepartment={selectedDepartment} selectedBranch={selectedBranch}
          navigate={navigate}
        />
      )}
      yearEditors={(
        <YearEditors universityTab={universityTab} selectedBatch={selectedBatch} universityWorkspaceTabCards={universityWorkspaceTabCards} updateUniversityTab={updateUniversityTab} />
      )}
    >


      <BatchSetupChecklist selectedBatch={selectedBatch} batchSetupReadiness={batchSetupReadiness} />

      {!selectedAcademicFaculty ? (
        <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select an academic faculty in the tree to begin, or create one below." />
      ) : null}

      {selectedAcademicFaculty && !selectedDepartment && (
        <AcademicFacultyDetailCard
          selectedAcademicFaculty={selectedAcademicFaculty} facultyDepartments={facultyDepartments}
          selectedAcademicFacultyImpact={selectedAcademicFacultyImpact} data={data} setEditingEntity={setEditingEntity}
          navigate={navigate} structureForms={structureForms} setStructureForms={setStructureForms} handleCreateDepartment={handleCreateDepartment}
        />
      )}

      {selectedDepartment && !selectedBranch && (
        <DepartmentDetailCard
          selectedDepartment={selectedDepartment} departmentBranches={departmentBranches} data={data}
          setEditingEntity={setEditingEntity} navigate={navigate} selectedAcademicFaculty={selectedAcademicFaculty}
          structureForms={structureForms} setStructureForms={setStructureForms} handleCreateBranch={handleCreateBranch}
        />
      )}

      {selectedBranch && !selectedBatch && (
        <BranchDetailCard
          selectedBranch={selectedBranch} branchBatches={branchBatches} setEditingEntity={setEditingEntity}
          navigate={navigate} selectedAcademicFaculty={selectedAcademicFaculty} selectedDepartment={selectedDepartment}
          structureForms={structureForms} setStructureForms={setStructureForms} handleCreateBatch={handleCreateBatch}
        />
      )}

      {selectedBatch && universityTab === 'overview' && (
        <BatchOverviewCard
          selectedBatch={selectedBatch} authoritativeOperationalSemester={authoritativeOperationalSemester}
          authoritativeOperationalSemesterSource={authoritativeOperationalSemesterSource} activeBatchPolicyOverride={activeBatchPolicyOverride}
          activeGovernanceScope={activeGovernanceScope} activeScopeChain={activeScopeChain} resolvedBatchPolicy={resolvedBatchPolicy}
          setEditingEntity={setEditingEntity} proofDashboardProps={proofDashboardProps} batchSetupReadiness={batchSetupReadiness}
          onOpenProofDashboard={onOpenProofDashboard}
        />
      )}

      <GovernancePanels
        activeGovernanceScope={activeGovernanceScope} universityTab={universityTab} activeScopeChain={activeScopeChain}
        resolvedBatchPolicy={resolvedBatchPolicy} resolvedStagePolicy={resolvedStagePolicy} activeScopePolicyOverride={activeScopePolicyOverride}
        activeScopeStageOverride={activeScopeStageOverride} policyForm={policyForm} setPolicyForm={setPolicyForm}
        stagePolicyForm={stagePolicyForm} setStagePolicyForm={setStagePolicyForm} handleSaveScopePolicy={handleSaveScopePolicy}
        handleResetScopePolicy={handleResetScopePolicy} handleSaveScopeStagePolicy={handleSaveScopeStagePolicy} handleResetScopeStagePolicy={handleResetScopeStagePolicy}
      />

      <CoursesPanel
        selectedBranch={selectedBranch} universityTab={universityTab} selectedBatch={selectedBatch} selectedSectionCode={selectedSectionCode}
        currentSemesterTerm={currentSemesterTerm} batchTerms={batchTerms} entityEditors={entityEditors} setEntityEditors={setEntityEditors}
        startEditingTerm={startEditingTerm} resetTermEditor={resetTermEditor} handleSaveTerm={handleSaveTerm} handleArchiveTerm={handleArchiveTerm}
        selectedCurriculumSemester={selectedCurriculumSemester} setSelectedCurriculumSemester={setSelectedCurriculumSemester}
        curriculumSemesterEntries={curriculumSemesterEntries} handleBootstrapCurriculumManifest={handleBootstrapCurriculumManifest}
        getScopedCourseLeaderState={getScopedCourseLeaderState} startEditingCurriculumCourse={startEditingCurriculumCourse}
        handleArchiveCurriculumCourse={handleArchiveCurriculumCourse} scopedCourseLeaderFaculty={scopedCourseLeaderFaculty}
        handleAssignCurriculumCourseLeader={handleAssignCurriculumCourseLeader} handleSaveCurriculumCourse={handleSaveCurriculumCourse}
        resetCurriculumEditor={resetCurriculumEditor} selectedCurriculumCourseId={selectedCurriculumCourseId}
      />

      <CurriculumPanel selectedBatch={selectedBatch} universityTab={universityTab} apiClient={apiClient} />

      <ProvisioningPanel
        selectedBatch={selectedBatch} universityTab={universityTab} selectedSectionCode={selectedSectionCode}
        batchProvisioningForm={batchProvisioningForm} setBatchProvisioningForm={setBatchProvisioningForm} handleProvisionBatch={handleProvisionBatch}
        handleProvisionSeededDemoWorkspace={handleProvisionSeededDemoWorkspace} batchFacultyPool={batchFacultyPool}
        batchMentorEligibleFaculty={batchMentorEligibleFaculty} batchOfferingsWithoutOwner={batchOfferingsWithoutOwner}
        batchStudentsWithoutEnrollment={batchStudentsWithoutEnrollment} batchStudentsWithoutMentor={batchStudentsWithoutMentor}
        batchOfferingsWithoutRoster={batchOfferingsWithoutRoster} currentSemesterTerm={currentSemesterTerm} batchTerms={batchTerms}
        bulkMentorAssignmentForm={bulkMentorAssignmentForm} setBulkMentorAssignmentForm={setBulkMentorAssignmentForm}
        bulkMentorAssignmentPreview={bulkMentorAssignmentPreview} handlePreviewBulkMentorAssignment={handlePreviewBulkMentorAssignment}
        handleApplyBulkMentorAssignment={handleApplyBulkMentorAssignment} clearBulkMentorAssignmentPreview={clearBulkMentorAssignmentPreview}
        syntheticProvisioningEnabled={syntheticProvisioningEnabled} setSyntheticProvisioningEnabled={setSyntheticProvisioningEnabled}
      />

      <PickAYearFallback
        selectedBranch={selectedBranch} branchBatches={branchBatches} navigate={navigate}
        selectedAcademicFaculty={selectedAcademicFaculty} selectedDepartment={selectedDepartment}
      />

      <SystemAdminScopedRegistryLaunches {...registryLaunchProps} />
    </SystemAdminHierarchyWorkspaceShell>
  )
}
