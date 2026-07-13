/**
 * resolveBatchCurriculumFeatures — resolve the effective per-course feature
 * config for a batch across scope profiles, pinned profiles, and batch-local
 * overrides.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts and re-exported
 * from that module (consumed by curriculum-graph and other modules).
 */
import { eq } from 'drizzle-orm'
import {
  batchCurriculumFeatureBindings,
  batchCurriculumFeatureOverrides,
  curriculumFeatureProfileCourses,
  curriculumFeatureProfiles,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import type { ScopeTypeValue } from '../../../../lib/stage-policy.js'
import type { CurriculumFeatureProfileCoursePayload } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import {
  batchFeatureFingerprint,
  curriculumFeatureFingerprint,
  matchesCourseReference,
  normalizeCurriculumFeaturePayload,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { getBatchScopeContext } from './batch-scope-context.js'
import {
  fromResolvedCurriculumFeaturePayload,
  loadMaterializedCurriculumFeatureBundle,
  toCurriculumFeaturePayload,
  type MaterializedCurriculumFeatureItem,
} from './materialized-bundle.js'
import {
  mapBatchCurriculumFeatureBinding,
  mapBatchCurriculumFeatureOverride,
  mapCurriculumFeatureProfile,
  mapCurriculumFeatureProfileCourse,
} from './row-mappers.js'

type ResolvedCurriculumFeatureItem = MaterializedCurriculumFeatureItem & {
  resolvedConfig: CurriculumFeatureProfileCoursePayload
  featureFingerprint: string
  resolvedSource: {
    mode: 'materialized' | 'scope-profile' | 'pinned-profile' | 'batch-local-override'
    label: string
    scopeType?: ScopeTypeValue
    scopeId?: string
    curriculumFeatureProfileId?: string | null
  }
  appliedProfiles: Array<ReturnType<typeof mapCurriculumFeatureProfile>>
  localOverride: ReturnType<typeof mapBatchCurriculumFeatureOverride> | null
}

export async function resolveBatchCurriculumFeatures(context: RouteContext, batchId: string) {
  const scopeContext = await getBatchScopeContext(context, batchId)
  const materializedBundle = await loadMaterializedCurriculumFeatureBundle(context, batchId)
  const [profileRows, profileCourseRows, bindingRowRaw, overrideRowsRaw] = await Promise.all([
    context.db.select().from(curriculumFeatureProfiles),
    context.db.select().from(curriculumFeatureProfileCourses),
    context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, batchId)).then(rows => rows[0] ?? null),
    context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, batchId)),
  ])

  const binding = mapBatchCurriculumFeatureBinding(bindingRowRaw) ?? {
    batchId,
    curriculumFeatureProfileId: null,
    bindingMode: 'inherit-scope-profile' as const,
    status: 'active',
    version: 1,
    createdAt: '',
    updatedAt: '',
  }
  const availableProfiles = profileRows
    .filter(row => row.status === 'active')
    .map(mapCurriculumFeatureProfile)
    .filter(profile => scopeContext.scopeChain.some(scope => scope.scopeType === profile.scopeType && scope.scopeId === profile.scopeId))
    .sort((left, right) => {
      const leftIndex = scopeContext.scopeChain.findIndex(scope => scope.scopeType === left.scopeType && scope.scopeId === left.scopeId)
      const rightIndex = scopeContext.scopeChain.findIndex(scope => scope.scopeType === right.scopeType && scope.scopeId === right.scopeId)
      return leftIndex - rightIndex || left.updatedAt.localeCompare(right.updatedAt)
    })
  const profileCourses = profileCourseRows
    .filter(row => row.status === 'active')
    .map(mapCurriculumFeatureProfileCourse)
  const localOverrides = overrideRowsRaw
    .filter(row => row.status === 'active')
    .map(mapBatchCurriculumFeatureOverride)

  const items = materializedBundle.items.map(item => {
    let resolvedPayload = toCurriculumFeaturePayload(item)
    let resolvedSource: ResolvedCurriculumFeatureItem['resolvedSource'] = {
      mode: 'materialized',
      label: 'Batch materialized config',
    }
    const appliedProfiles: Array<ReturnType<typeof mapCurriculumFeatureProfile>> = []
    if (binding.bindingMode !== 'local-only') {
      for (const profile of availableProfiles) {
        const profileCourse = profileCourses.find(row => (
          row.curriculumFeatureProfileId === profile.curriculumFeatureProfileId
          && matchesCourseReference({
            courseId: item.courseId,
            courseCode: item.courseCode,
            title: item.title,
          }, {
            courseId: row.courseId,
            courseCode: row.courseCode,
            title: row.title,
          })
        ))
        if (!profileCourse) continue
        resolvedPayload = normalizeCurriculumFeaturePayload(profileCourse.config)
        resolvedSource = {
          mode: 'scope-profile',
          label: profile.name,
          scopeType: profile.scopeType,
          scopeId: profile.scopeId,
          curriculumFeatureProfileId: profile.curriculumFeatureProfileId,
        }
        appliedProfiles.push(profile)
      }
    }
    if (binding.bindingMode === 'pin-profile' && binding.curriculumFeatureProfileId) {
      const pinnedProfile = availableProfiles.find(profile => profile.curriculumFeatureProfileId === binding.curriculumFeatureProfileId)
        ?? profileRows.filter(row => row.curriculumFeatureProfileId === binding.curriculumFeatureProfileId && row.status === 'active').map(mapCurriculumFeatureProfile)[0]
        ?? null
      const pinnedCourse = profileCourses.find(row => (
        row.curriculumFeatureProfileId === binding.curriculumFeatureProfileId
        && matchesCourseReference({
          courseId: item.courseId,
          courseCode: item.courseCode,
          title: item.title,
        }, {
          courseId: row.courseId,
          courseCode: row.courseCode,
          title: row.title,
        })
      ))
      if (pinnedProfile && pinnedCourse) {
        resolvedPayload = normalizeCurriculumFeaturePayload(pinnedCourse.config)
        resolvedSource = {
          mode: 'pinned-profile',
          label: pinnedProfile.name,
          scopeType: pinnedProfile.scopeType,
          scopeId: pinnedProfile.scopeId,
          curriculumFeatureProfileId: pinnedProfile.curriculumFeatureProfileId,
        }
        if (!appliedProfiles.some(profile => profile.curriculumFeatureProfileId === pinnedProfile.curriculumFeatureProfileId)) {
          appliedProfiles.push(pinnedProfile)
        }
      }
    }
    const localOverride = localOverrides.find(override => override.curriculumCourseId === item.curriculumCourseId) ?? null
    if (localOverride) {
      resolvedPayload = normalizeCurriculumFeaturePayload(localOverride.override)
      resolvedSource = {
        mode: 'batch-local-override',
        label: 'Batch-local override',
        scopeType: 'batch',
        scopeId: batchId,
        curriculumFeatureProfileId: null,
      }
    }

    return {
      ...item,
      ...fromResolvedCurriculumFeaturePayload(resolvedPayload, item, materializedBundle.items),
      resolvedConfig: resolvedPayload,
      featureFingerprint: curriculumFeatureFingerprint(resolvedPayload),
      resolvedSource,
      appliedProfiles,
      localOverride,
    } satisfies ResolvedCurriculumFeatureItem
  })

  const activeProfileIds = Array.from(new Set(items
    .map(item => item.resolvedSource.curriculumFeatureProfileId)
    .filter((value): value is string => !!value)))
  const primaryCurriculumFeatureProfileId = binding.curriculumFeatureProfileId
    ?? activeProfileIds.at(-1)
    ?? null

  return {
    batchId,
    curriculumImportVersion: materializedBundle.curriculumImportVersion,
    binding,
    availableProfiles,
    primaryCurriculumFeatureProfileId,
    curriculumFeatureProfileFingerprint: batchFeatureFingerprint(items),
    items,
  }
}
