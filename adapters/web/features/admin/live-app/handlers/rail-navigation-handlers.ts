import type { Dispatch, SetStateAction } from 'react'
import {
  defaultRegistryFilter,
  hydrateRegistryFilter,
  type LiveAdminRoute,
  type LiveAdminSectionId,
  type RegistryFilterState,
  type UniversityScopeState,
} from '../../system-admin-live-data'

export interface RailNavigationHandlerDeps {
  route: LiveAdminRoute
  activeUniversityRegistryScope: UniversityScopeState | null
  registryScope: UniversityScopeState | null
  setRegistryScope: Dispatch<SetStateAction<UniversityScopeState | null>>
  setStudentRegistryFilter: Dispatch<SetStateAction<RegistryFilterState>>
  setFacultyRegistryFilter: Dispatch<SetStateAction<RegistryFilterState>>
  clearRegistryScope: () => void
  navigate: (nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
}

export function createRailNavigationHandlers(deps: RailNavigationHandlerDeps) {
  const {
    route,
    activeUniversityRegistryScope,
    registryScope,
    setRegistryScope,
    setStudentRegistryFilter,
    setFacultyRegistryFilter,
    clearRegistryScope,
    navigate,
  } = deps

  const handleRailSectionChange = (section: LiveAdminSectionId) => {
    if (section === route.section) return
    if (section === 'students' || section === 'faculty-members') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      if (nextScope) {
        setRegistryScope(nextScope)
        if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(nextScope))
        else setFacultyRegistryFilter(hydrateRegistryFilter(nextScope))
      } else if (route.section === 'faculties') {
        clearRegistryScope()
        if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
        else setFacultyRegistryFilter(defaultRegistryFilter())
      }
      navigate({ section })
      return
    }
    if (section === 'faculties') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      navigate({
        section: 'faculties',
        academicFacultyId: nextScope?.academicFacultyId ?? undefined,
        departmentId: nextScope?.departmentId ?? undefined,
        branchId: nextScope?.branchId ?? undefined,
        batchId: nextScope?.batchId ?? undefined,
      })
      return
    }
    navigate({ section })
  }

  return { handleRailSectionChange }
}
