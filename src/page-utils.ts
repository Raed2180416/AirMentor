import type { KeyboardEvent } from 'react'
import type { EntryKind } from './domain'

export function toCellKey(offId: string, kind: EntryKind, studentId: string, field: string) {
  return `${offId}::${kind}::${studentId}::${field}`
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function parseInputValue(raw: string, min: number, max: number): number | undefined {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return undefined
  return clampNumber(Math.round(parsed), min, max)
}

export function shouldBlockNumericKey(e: KeyboardEvent<HTMLInputElement>) {
  const blocked = ['e', 'E', '+', '-', '.', ',']
  if (blocked.includes(e.key)) e.preventDefault()
}

export function inferKindFromPendingAction(pending: string | null): EntryKind {
  if (!pending) return 'tt1'
  const value = pending.toLowerCase()
  if (value.includes('tt2')) return 'tt2'
  if (value.includes('attendance')) return 'attendance'
  if (value.includes('quiz')) return 'quiz'
  if (value.includes('assignment')) return 'assignment'
  if (value.includes('final')) return 'finals'
  return 'tt1'
}

export const ENTRY_STAGE_REQUIREMENTS: Record<EntryKind, number> = {
  tt1: 1,
  tt2: 2,
  quiz: 2,
  assignment: 2,
  attendance: 1,
  finals: 3,
}

export function isEntryKindApplicableForStage(stage: number, kind: EntryKind) {
  return stage >= ENTRY_STAGE_REQUIREMENTS[kind]
}

export function getEntryAccessState(input: { stage: number; kind: EntryKind; isLocked: boolean; canEditMarks: boolean }) {
  const isApplicableForStage = isEntryKindApplicableForStage(input.stage, input.kind)
  const canEdit = input.canEditMarks && !input.isLocked && isApplicableForStage
  return {
    isApplicableForStage,
    isLocked: input.isLocked,
    canEdit,
    canOpenWorkspace: isApplicableForStage && !input.isLocked,
  }
}

export const TAB_DEFS = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'risk', icon: '🎯', label: 'Risk Analysis' },
  { id: 'attendance', icon: '📅', label: 'Attendance' },
  { id: 'tt1', icon: '📝', label: 'TT1' },
  { id: 'tt2', icon: '📝', label: 'TT2' },
  { id: 'quizzes', icon: '❓', label: 'Quizzes' },
  { id: 'assignments', icon: '📄', label: 'Assignments' },
  { id: 'co', icon: '🎯', label: 'CO Attainment' },
  { id: 'gradebook', icon: '📊', label: 'Grade Book' },
] as const

export const ENTRY_CATALOG: { kind: EntryKind; icon: string; title: string; desc: string; tabId: string }[] = [
  { kind: 'tt1', icon: '📝', title: 'TT1 Marks', desc: 'Question-wise marks entry and final submit/lock for TT1.', tabId: 'tt1' },
  { kind: 'tt2', icon: '📝', title: 'TT2 Marks', desc: 'Question-wise marks entry and final submit/lock for TT2.', tabId: 'tt2' },
  { kind: 'quiz', icon: '❓', title: 'Quiz Scores', desc: 'Enter quiz marks across all students in a consistent sheet.', tabId: 'quizzes' },
  { kind: 'assignment', icon: '📄', title: 'Assignment Scores', desc: 'Enter assignment evaluations and update CO evidence.', tabId: 'assignments' },
  { kind: 'attendance', icon: '📅', title: 'Attendance', desc: 'Weekly attendance capture and final attendance lock.', tabId: 'attendance' },
  { kind: 'finals', icon: '🎓', title: 'SEE / Finals', desc: 'Final exam marks and gradebook completion flow.', tabId: 'gradebook' },
]
