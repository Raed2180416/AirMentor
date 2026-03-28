import { inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  offeringQuestionPapers,
  sectionOfferings,
  simulationQuestionTemplates,
  teacherAllocations,
  worldContextSnapshots,
} from '../db/schema.js'
import type {
  BlueprintNode,
  RuntimeCourse,
  SimulatedQuestionTemplate,
} from './msruas-proof-control-plane.js'

type TrajectoryForScaffolding = {
  sectionCode: 'A' | 'B'
  latentBase: {
    academicPotential: number
  }
  profile: {
    behavior: {
      attendancePropensity: number
    }
  }
}

type LoadEntry = {
  offeringId: string
  courseCode: string
  courseName: string
  sectionCode: string
  semesterNumber: number
  weeklyHours: number
}

export type ProofControlPlaneSeededScaffoldingServiceDeps = {
  average: (values: number[]) => number
  buildSimulatedQuestionTemplates: (input: {
    simulationRunId: string
    semesterNumber: number
    course: RuntimeCourse
    offeringId?: string | null
    tt1Topics: string[]
    tt2Topics: string[]
    seeTopics: string[]
  }) => SimulatedQuestionTemplate[]
  buildTemplatesFromBlueprint: (input: {
    simulationRunId: string
    semesterNumber: number
    course: RuntimeCourse
    offeringId: string
    componentType: 'tt1' | 'tt2' | 'see'
    blueprint: { nodes: BlueprintNode[] }
    topicFallback: string[]
  }) => SimulatedQuestionTemplate[]
  courseCodeForRuntime: (course: Pick<RuntimeCourse, 'officialWebCode' | 'internalCompilerId'>) => string
  createId: (prefix: string) => string
  parseJson: <T>(value: string | null | undefined, fallback: T) => T
  roundToTwo: (value: number) => number
  stableBetween: (label: string, min: number, max: number) => number
  weeklyContactHoursForCourse: (course: Pick<RuntimeCourse, 'title' | 'assessmentProfile' | 'credits'>) => number
}

export type BuildSeededScaffoldingInput = {
  courseLeaderFaculty: Array<{ facultyId: string }>
  now: string
  offerings: Array<typeof sectionOfferings.$inferSelect>
  runSeed: number
  runtimeCourses: RuntimeCourse[]
  sem6OfferingByCourseTitleSection: Map<string, typeof sectionOfferings.$inferSelect>
  simulationRunId: string
  trajectories: TrajectoryForScaffolding[]
}

export type BuiltSeededScaffolding = {
  loadsByFacultyId: Map<string, LoadEntry[]>
  questionTemplateRows: Array<typeof simulationQuestionTemplates.$inferInsert>
  questionTemplatesByScope: Map<string, SimulatedQuestionTemplate[]>
  teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert>
  worldContextRows: Array<typeof worldContextSnapshots.$inferInsert>
}

export async function buildSeededScaffolding(
  db: AppDb,
  input: BuildSeededScaffoldingInput,
  deps: ProofControlPlaneSeededScaffoldingServiceDeps,
): Promise<BuiltSeededScaffolding> {
  const questionPaperRows = input.offerings.length > 0
    ? await db.select().from(offeringQuestionPapers).where(inArray(offeringQuestionPapers.offeringId, input.offerings.map(offering => offering.offeringId)))
    : []
  const blueprintByOfferingKind = new Map<string, { nodes: BlueprintNode[] }>()
  for (const paper of questionPaperRows) {
    const parsed = deps.parseJson(paper.blueprintJson, {} as { nodes?: BlueprintNode[] })
    if (Array.isArray(parsed.nodes)) {
      blueprintByOfferingKind.set(`${paper.offeringId}::${paper.kind}`, { nodes: parsed.nodes })
    }
  }

  const teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert> = []
  const worldContextRows: Array<typeof worldContextSnapshots.$inferInsert> = []
  const questionTemplateRows: Array<typeof simulationQuestionTemplates.$inferInsert> = []
  const loadsByFacultyId = new Map<string, LoadEntry[]>()
  const questionTemplatesByScope = new Map<string, SimulatedQuestionTemplate[]>()

  for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
    const semesterCourses = input.runtimeCourses.filter(course => course.semesterNumber === semesterNumber)
    ;(['A', 'B'] as const).forEach((sectionCode, sectionOffset) => {
      const sectionContext = {
        sectionAbilityMean: deps.roundToTwo(deps.average(
          input.trajectories.filter(student => student.sectionCode === sectionCode).map(student => student.latentBase.academicPotential),
        )),
        sectionAttendanceCulture: deps.roundToTwo(deps.average(
          input.trajectories.filter(student => student.sectionCode === sectionCode).map(student => student.profile.behavior.attendancePropensity),
        )),
        teacherStrictnessIndex: deps.roundToTwo(deps.stableBetween(`run-${input.runSeed}-sem-${semesterNumber}-${sectionCode}-strict`, 0.32, 0.78)),
        assessmentDifficultyIndex: deps.roundToTwo(deps.stableBetween(`run-${input.runSeed}-sem-${semesterNumber}-${sectionCode}-difficulty`, 0.38, 0.84)),
        interventionCapacity: deps.roundToTwo(deps.stableBetween(`run-${input.runSeed}-sem-${semesterNumber}-${sectionCode}-capacity`, 0.34, 0.82)),
      }
      worldContextRows.push({
        worldContextSnapshotId: deps.createId('world_context'),
        simulationRunId: input.simulationRunId,
        semesterNumber,
        sectionCode,
        contextType: 'section',
        contextKey: `semester-${semesterNumber}-${sectionCode}`,
        contextJson: JSON.stringify(sectionContext),
        createdAt: input.now,
        updatedAt: input.now,
      })

      semesterCourses.forEach((course, courseIndex) => {
        const faculty = input.courseLeaderFaculty[(courseIndex + sectionOffset) % input.courseLeaderFaculty.length]
        const offeringId = semesterNumber === 6
          ? input.sem6OfferingByCourseTitleSection.get(`${course.title}::${sectionCode}`)?.offeringId ?? null
          : null

        teacherAllocationRows.push({
          teacherAllocationId: deps.createId('teacher_allocation'),
          simulationRunId: input.simulationRunId,
          facultyId: faculty.facultyId,
          offeringId,
          curriculumNodeId: course.curriculumNodeId,
          semesterNumber,
          sectionCode,
          allocationRole: 'course-leader',
          plannedContactHours: deps.weeklyContactHoursForCourse(course),
          createdAt: input.now,
          updatedAt: input.now,
        })

        if (offeringId) {
          const current = loadsByFacultyId.get(faculty.facultyId) ?? []
          current.push({
            offeringId,
            courseCode: deps.courseCodeForRuntime(course),
            courseName: course.title,
            sectionCode,
            semesterNumber,
            weeklyHours: deps.weeklyContactHoursForCourse(course),
          })
          loadsByFacultyId.set(faculty.facultyId, current)
        }

        const simulatedTemplates = deps.buildSimulatedQuestionTemplates({
          simulationRunId: input.simulationRunId,
          semesterNumber,
          course,
          offeringId,
          tt1Topics: course.tt1Topics,
          tt2Topics: course.tt2Topics,
          seeTopics: course.seeTopics,
        })

        const templateGroup = semesterNumber === 6 && offeringId
          ? [
              ...(blueprintByOfferingKind.has(`${offeringId}::tt1`)
                ? deps.buildTemplatesFromBlueprint({
                    simulationRunId: input.simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'tt1',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::tt1`) ?? { nodes: [] },
                    topicFallback: course.tt1Topics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'tt1')),
              ...(blueprintByOfferingKind.has(`${offeringId}::tt2`)
                ? deps.buildTemplatesFromBlueprint({
                    simulationRunId: input.simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'tt2',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::tt2`) ?? { nodes: [] },
                    topicFallback: course.tt2Topics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'tt2')),
              ...(blueprintByOfferingKind.has(`${offeringId}::see`)
                ? deps.buildTemplatesFromBlueprint({
                    simulationRunId: input.simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'see',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::see`) ?? { nodes: [] },
                    topicFallback: course.seeTopics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'see')),
            ]
          : simulatedTemplates

        questionTemplatesByScope.set(offeringId ?? course.curriculumNodeId, templateGroup)
        templateGroup.forEach(template => {
          questionTemplateRows.push({
            simulationQuestionTemplateId: template.simulationQuestionTemplateId,
            simulationRunId: template.simulationRunId,
            semesterNumber: template.semesterNumber,
            curriculumNodeId: template.curriculumNodeId,
            offeringId: template.offeringId,
            componentType: template.componentType,
            questionIndex: template.questionIndex,
            questionCode: template.questionCode,
            questionType: template.questionType,
            questionMarks: template.questionMarks,
            difficultyScaled: template.difficultyScaled,
            transferDemandScaled: template.transferDemandScaled,
            coTagsJson: JSON.stringify(template.coTags),
            topicTagsJson: JSON.stringify(template.topicTags),
            microSkillTagsJson: JSON.stringify(template.microSkillTags),
            sourceType: template.sourceType,
            templateJson: JSON.stringify(template.templateJson),
            createdAt: input.now,
            updatedAt: input.now,
          })
        })
      })
    })
  }

  return {
    loadsByFacultyId,
    questionTemplateRows,
    questionTemplatesByScope,
    teacherAllocationRows,
    worldContextRows,
  }
}
