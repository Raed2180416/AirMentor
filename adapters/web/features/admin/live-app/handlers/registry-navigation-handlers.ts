import type { Dispatch, SetStateAction } from 'react'
import {
  defaultRegistryFilter,
  hydrateRegistryFilter,
  type LiveAdminRoute,
  type RegistryFilterState,
  type UniversityScopeState,
} from '../../system-admin-live-data'
import type { UniversityTab } from '../../live-app-model'

export interface RegistryNavigationHandlerDeps {
  activeUniversityRegistryScope: UniversityScopeState | null
  registryScope: UniversityScopeState | null
  setRegistryScope: Dispatch<SetStateAction<UniversityScopeState | null>>
  setStudentRegistryFilter: Dispatch<SetStateAction<RegistryFilterState>>
  setFacultyRegistryFilter: Dispatch<SetStateAction<RegistryFilterState>>
  clearRegistryScope: () => void
  navigate: (nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  updateUniversityTab: (nextTab: UniversityTab, options?: { recordHistory?: boolean; scroll?: boolean }) => void
  updateSelectedSectionCode: (nextSectionCode: string | null, options?: { recordHistory?: boolean }) => void
}

export function createRegistryNavigationHandlers(deps: RegistryNavigationHandlerDeps) {
  const {
    activeUniversityRegistryScope,
    registryScope,
    setRegistryScope,
    setStudentRegistryFilter,
    setFacultyRegistryFilter,
    clearRegistryScope,
    navigate,
    updateUniversityTab,
    updateSelectedSectionCode,
  } = deps

  const handleOpenScopedRegistry = (section: 'students' | 'faculty-members') => {
    if (activeUniversityRegistryScope) {
      setRegistryScope(activeUniversityRegistryScope)
      if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
      else setFacultyRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
    } else if (section === 'students') {
      clearRegistryScope()
      setStudentRegistryFilter(defaultRegistryFilter())
    } else {
      clearRegistryScope()
      setFacultyRegistryFilter(defaultRegistryFilter())
    }
    navigate({ section })
  }
  const handleOpenFullRegistry = (section: 'students' | 'faculty-members') => {
    clearRegistryScope()
    if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
    else setFacultyRegistryFilter(defaultRegistryFilter())
    navigate({ section })
  }
  const handleReturnToScopedUniversity = () => {
    if (!registryScope) return
    updateUniversityTab('overview', { recordHistory: false })
    updateSelectedSectionCode(registryScope.sectionCode, { recordHistory: false })
    navigate({
      section: 'faculties',
      academicFacultyId: registryScope.academicFacultyId ?? undefined,
      departmentId: registryScope.departmentId ?? undefined,
      branchId: registryScope.branchId ?? undefined,
      batchId: registryScope.batchId ?? undefined,
    }, { recordHistory: false })
  }

  return { handleOpenScopedRegistry, handleOpenFullRegistry, handleReturnToScopedUniversity }
}
