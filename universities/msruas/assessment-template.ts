import type { AssessmentTemplate } from '../../kernel/policy/index.js'

export function createMsruasAssessmentTemplate(): AssessmentTemplate {
  return {
    ceSeeSplit: { ce: 60, see: 40 },
    ceComponentCaps: {
      termTestsWeight: 30,
      quizWeight: 10,
      assignmentWeight: 20,
      maxTermTests: 2,
      maxQuizzes: 5,
      maxAssignments: 5,
    },
    workingCalendar: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      dayStart: '08:30',
      dayEnd: '16:30',
      courseworkWeeks: 16,
      examPreparationWeeks: 1,
      seeWeeks: 3,
      totalWeeks: 20,
    },
  }
}
