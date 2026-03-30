import { describe, expect, it } from 'vitest'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  compileMsruasCurriculumWorkbook,
  EMBEDDED_CURRICULUM_SOURCE_LABEL,
  EMBEDDED_CURRICULUM_SOURCE_PATH,
  validateCompiledCurriculum,
} from '../src/lib/msruas-curriculum-compiler.js'

describe('msruas curriculum compiler', () => {
  it('compiles the embedded MNC manifest when no workbook file is available', () => {
    const compiled = compileMsruasCurriculumWorkbook(EMBEDDED_CURRICULUM_SOURCE_PATH)
    const validation = validateCompiledCurriculum(compiled)
    const outputChecksum = buildCurriculumOutputChecksum(compiled)
    const certificate = buildCompletenessCertificate(compiled, validation)

    expect(compiled.sourcePath).toBe(EMBEDDED_CURRICULUM_SOURCE_PATH)
    expect(compiled.sourceLabel).toBe(EMBEDDED_CURRICULUM_SOURCE_LABEL)
    expect(compiled.sourceType).toBe('bundled-json')
    expect(compiled.sourceNotes).toEqual([
      expect.objectContaining({
        sourceType: 'bundled-json',
        reference: EMBEDDED_CURRICULUM_SOURCE_LABEL,
      }),
    ])
    expect(validation).toMatchObject({
      semesterCoverage: [1, 6],
      courseCount: 36,
      totalCredits: 118,
      explicitEdgeCount: 24,
      addedEdgeCount: 20,
      bridgeModuleCount: 10,
      electiveOptionCount: 18,
    })
    expect(certificate).toMatchObject({
      sourceLabel: EMBEDDED_CURRICULUM_SOURCE_LABEL,
      sourcePath: EMBEDDED_CURRICULUM_SOURCE_PATH,
      outputChecksum,
    })
  })
})
