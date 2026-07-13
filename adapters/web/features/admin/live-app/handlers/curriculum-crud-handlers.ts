import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageGenerationStatus,
  ApiProofDashboard,
} from '@web/shared/api/types'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import {
  isVisibleAdminRecord,
  resolveBatch,
  resolveBranch,
  type LiveAdminDataset,
} from '../../system-admin-live-data'
import {
  requireDate,
  requirePositiveInteger,
  requireText,
  type EntityEditorState,
} from '../../live-app-model'

type CurriculumFeatureItem = ApiCurriculumFeatureConfigBundle['items'][number]
type CurriculumProofRefreshRetry = { batchIds: string[]; curriculumImportVersionId: string | null; message: string } | null

export interface CurriculumCrudHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  loadAdminData: () => Promise<void>
  selectedBranch: ReturnType<typeof resolveBranch>
  selectedBatch: ReturnType<typeof resolveBatch>
  data: LiveAdminDataset
  entityEditors: EntityEditorState
  curriculumLinkageReviewNote: string
  selectedCurriculumFeatureItem: CurriculumFeatureItem | null
  resetTermEditor: () => void
  resetCurriculumEditor: () => void
  refreshCurriculumFeatureConfig: (batchId: string) => Promise<ApiCurriculumFeatureConfigBundle>
  refreshCurriculumLinkageCandidates: (batchId: string) => Promise<ApiCurriculumLinkageCandidate[]>
  refreshProofDashboard: (batchId: string) => Promise<ApiProofDashboard>
  getQueuedProofRefreshCount: (value: unknown) => number
  setFlashMessage: Dispatch<SetStateAction<string>>
  setCurriculumLinkageGenerationStatus: Dispatch<SetStateAction<ApiCurriculumLinkageGenerationStatus | null>>
  setCurriculumLinkageReviewNote: Dispatch<SetStateAction<string>>
  setCurriculumProofRefreshRetry: Dispatch<SetStateAction<CurriculumProofRefreshRetry>>
}

export function createCurriculumCrudHandlers(deps: CurriculumCrudHandlerDeps) {
  const {
    apiClient,
    runAction,
    loadAdminData,
    selectedBranch,
    selectedBatch,
    data,
    entityEditors,
    curriculumLinkageReviewNote,
    selectedCurriculumFeatureItem,
    resetTermEditor,
    resetCurriculumEditor,
    refreshCurriculumFeatureConfig,
    refreshCurriculumLinkageCandidates,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    setFlashMessage,
    setCurriculumLinkageGenerationStatus,
    setCurriculumLinkageReviewNote,
    setCurriculumProofRefreshRetry,
  } = deps

  const handleSaveTerm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch || !selectedBatch) return
    await runAction(async () => {
      if (entityEditors.term.termId) {
        const current = data.terms.find(item => item.termId === entityEditors.term.termId)
        if (!current) throw new Error('Selected term could not be found.')
        await apiClient.updateTerm(current.termId, {
          branchId: selectedBranch.branchId,
          batchId: selectedBatch.batchId,
          academicYearLabel: requireText('Academic year label', entityEditors.term.academicYearLabel),
          semesterNumber: requirePositiveInteger('Semester number', entityEditors.term.semesterNumber),
          startDate: requireDate('Term start date', entityEditors.term.startDate),
          endDate: requireDate('Term end date', entityEditors.term.endDate),
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Academic term updated.')
      } else {
        await apiClient.createTerm({
          branchId: selectedBranch.branchId,
          batchId: selectedBatch.batchId,
          academicYearLabel: requireText('Academic year label', entityEditors.term.academicYearLabel),
          semesterNumber: requirePositiveInteger('Semester number', entityEditors.term.semesterNumber),
          startDate: requireDate('Term start date', entityEditors.term.startDate),
          endDate: requireDate('Term end date', entityEditors.term.endDate),
          status: 'active',
        })
        setFlashMessage('Academic term created.')
      }
      resetTermEditor()
    })
  }

  const handleArchiveTerm = async (termId: string) => {
    const target = data.terms.find(item => item.termId === termId)
    if (!target) return
    await runAction(async () => {
      await apiClient.updateTerm(target.termId, {
        branchId: target.branchId,
        batchId: target.batchId,
        academicYearLabel: target.academicYearLabel,
        semesterNumber: target.semesterNumber,
        startDate: target.startDate,
        endDate: target.endDate,
        status: 'deleted',
        version: target.version,
      })
      if (entityEditors.term.termId === termId) resetTermEditor()
      setFlashMessage('Academic term archived.')
    })
  }

  const handleSaveCurriculumCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBatch) return
    await runAction(async () => {
      let courseCodeForRefresh = entityEditors.curriculum.courseCode
      const matchingCourse = data.courses.find(item => item.courseCode.toLowerCase() === entityEditors.curriculum.courseCode.toLowerCase() && isVisibleAdminRecord(item.status)) ?? null
      if (entityEditors.curriculum.curriculumCourseId) {
        const current = data.curriculumCourses.find(item => item.curriculumCourseId === entityEditors.curriculum.curriculumCourseId)
        if (!current) throw new Error('Selected curriculum course could not be found.')
        courseCodeForRefresh = current.courseCode
        await apiClient.updateCurriculumCourse(current.curriculumCourseId, {
          batchId: selectedBatch.batchId,
          semesterNumber: requirePositiveInteger('Curriculum semester number', entityEditors.curriculum.semesterNumber),
          courseId: matchingCourse?.courseId ?? null,
          courseCode: requireText('Course code', entityEditors.curriculum.courseCode),
          title: requireText('Course title', entityEditors.curriculum.title),
          credits: requirePositiveInteger('Course credits', entityEditors.curriculum.credits),
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Curriculum course updated.')
      } else {
        await apiClient.createCurriculumCourse({
          batchId: selectedBatch.batchId,
          semesterNumber: requirePositiveInteger('Curriculum semester number', entityEditors.curriculum.semesterNumber),
          courseId: matchingCourse?.courseId ?? null,
          courseCode: requireText('Course code', entityEditors.curriculum.courseCode),
          title: requireText('Course title', entityEditors.curriculum.title),
          credits: requirePositiveInteger('Course credits', entityEditors.curriculum.credits),
          status: 'active',
        })
        setFlashMessage('Curriculum course created.')
      }
      resetCurriculumEditor()
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(`Curriculum course saved for ${courseCodeForRefresh}. Any required proof refresh is now queued by the backend.`)
    })
  }

  const handleBootstrapCurriculumManifest = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const result = await apiClient.bootstrapCurriculum(selectedBatch.batchId, { manifestKey: 'msruas-mnc-seed' })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        queuedCount > 0
          ? `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, generated ${result.generatedCandidateCount} prerequisite suggestion${result.generatedCandidateCount === 1 ? '' : 's'}, and queued ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'}.${generationNote}`
          : `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, and generated ${result.generatedCandidateCount} prerequisite suggestion${result.generatedCandidateCount === 1 ? '' : 's'}.${generationNote}`,
      )
    })
  }

  const handleRegenerateCurriculumLinkageCandidates = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.regenerateCurriculumLinkageCandidates(selectedBatch.batchId, {
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.regeneration_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.regenerated', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
        generatedCount: result.items.length,
        candidateGenerationStatus: result.candidateGenerationStatus.status,
      })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        result.items.length > 0
          ? `Generated ${result.items.length} prerequisite suggestion${result.items.length === 1 ? '' : 's'} for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`
          : `No prerequisite suggestions generated for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`,
      )
    })
  }

  const handleApproveCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.approveCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
          reviewNote: curriculumLinkageReviewNote.trim() || undefined,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.approval_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumLinkageCandidateId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.approved', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumLinkageCandidateId,
        affectedBatchIds: result.affectedBatchIds,
        proofRefreshQueued: result.proofRefreshQueued,
        proofRefreshStatus: result.proofRefresh?.status ?? null,
        queuedProofRefreshCount: getQueuedProofRefreshCount(result),
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      setCurriculumLinkageReviewNote('')
      if (!result.proofRefreshQueued && result.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: result.affectedBatchIds,
          curriculumImportVersionId: result.curriculumImportVersionId,
          message: result.proofRefreshWarning
            ?? 'Prerequisite suggestion accepted, but proof refresh queueing failed for one or more affected batches. Retry immediately to restore proof parity.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(
        !result.proofRefreshQueued
          ? `Suggestion accepted, but proof refresh queueing failed. ${result.proofRefreshWarning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
          : queuedCount > 0
          ? `Suggestion accepted and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
          : 'Prerequisite suggestion accepted.',
      )
    })
  }

  const handleRejectCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.rejectCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
        reviewNote: curriculumLinkageReviewNote.trim() || undefined,
      })
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      setCurriculumLinkageReviewNote('')
      setFlashMessage('Prerequisite suggestion rejected.')
    })
  }

  const handleArchiveCurriculumCourse = async (curriculumCourseId: string) => {
    const current = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!current) return
    await runAction(async () => {
      await apiClient.updateCurriculumCourse(current.curriculumCourseId, {
        batchId: current.batchId,
        semesterNumber: current.semesterNumber,
        courseId: current.courseId,
        courseCode: current.courseCode,
        title: current.title,
        credits: current.credits,
        status: 'deleted',
        version: current.version,
      })
      if (entityEditors.curriculum.curriculumCourseId === curriculumCourseId) resetCurriculumEditor()
      await loadAdminData()
      await refreshCurriculumFeatureConfig(current.batchId)
      await refreshCurriculumLinkageCandidates(current.batchId)
      await refreshProofDashboard(current.batchId)
      setFlashMessage(`Curriculum course archived for ${current.courseCode}. Any required proof refresh is now queued by the backend.`)
    })
  }

  return {
    handleSaveTerm,
    handleArchiveTerm,
    handleSaveCurriculumCourse,
    handleBootstrapCurriculumManifest,
    handleRegenerateCurriculumLinkageCandidates,
    handleApproveCurriculumLinkageCandidate,
    handleRejectCurriculumLinkageCandidate,
    handleArchiveCurriculumCourse,
  }
}
