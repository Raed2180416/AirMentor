import type { AssessmentTemplate } from '../../kernel/policy/index.js'

export function createIitbAssessmentTemplate(): AssessmentTemplate {
  return {
    ceSeeSplit: { ce: 50, see: 50 },
    ceComponentCaps: {
      termTestsWeight: 25,
      quizWeight: 10,
      assignmentWeight: 15,
      maxTermTests: 2,
      maxQuizzes: 4,
      maxAssignments: 4,
    },
    workingCalendar: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      dayStart: '08:30',
      dayEnd: '17:30',
      courseworkWeeks: 14,
      examPreparationWeeks: 2,
      seeWeeks: 4,
      totalWeeks: 20,
    },
  }
}
