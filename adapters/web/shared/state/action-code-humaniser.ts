// Frontend mirror of `humanLabelForActionCode` in
// `@air-mentor-api/src/lib/proof-recommendation-text-generator.ts`.
//
// Kept intentionally small and deterministic so UI surfaces that receive a
// raw ProofInterventionActionCode (HoD queue, risk explorer advanced tab,
// faculty profile, sysadmin proof dashboard preview) can render a
// human-readable label without re-fetching the backend narrative. When the
// backend adds a new code, add it to this table too — the unknown-code
// branch falls back to a deterministic Title Case transform instead of
// leaking the raw ALL_CAPS/kebab code.

const HUMAN_LABEL_BY_ACTION_CODE: Readonly<Record<string, string>> = {
  attendance_warning: 'Send attendance warning',
  targeted_remedial_plan: 'Run targeted remedial plan',
  structured_study_plan: 'Assign structured study plan',
  extra_academic_support_plan: 'Extra academic support plan',
  mentor_meeting: 'Schedule mentor meeting',
  faculty_followup_reminder: 'Faculty follow-up reminder',
  hod_escalation_student_action: 'Escalate student case to HoD',
  generic_default_family_action: 'Review and plan next step',
  // Legacy kebab-case code-families still emitted by some pipelines.
  'targeted-tutoring': 'Targeted tutoring',
  'parent-engagement': 'Parent engagement',
  'remedial-plan': 'Remedial plan',
  'structured-study-plan': 'Structured study plan',
  'attendance-warning': 'Attendance warning',
  'mentor-meeting': 'Mentor meeting',
  'hod-escalation': 'HoD escalation',
  'faculty-followup': 'Faculty follow-up',
}

export function humanLabelForActionCode(actionCode: string | null | undefined): string | null {
  if (actionCode == null) return null
  if (typeof actionCode !== 'string' || actionCode.trim() === '') return null
  const mapped = HUMAN_LABEL_BY_ACTION_CODE[actionCode]
  if (mapped) return mapped
  // Unknown / legacy code: normalise snake-case / kebab-case -> Title Case.
  return actionCode
    .split(/[_-]+/)
    .map(token => token.length === 0 ? '' : token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
    .trim()
}

// Convenience: renders the human label, falling back to an explicit display
// string when the action is null/empty. Prevents surfaces from rendering
// 'null' or '' when there's no recommendation.
export function displayActionLabel(actionCode: string | null | undefined, fallback = 'No recommendation'): string {
  return humanLabelForActionCode(actionCode) ?? fallback
}
