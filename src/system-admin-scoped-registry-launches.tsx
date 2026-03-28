import { UserCog, Users } from 'lucide-react'
import { T, mono, sora } from './data'
import { Btn, Card, Chip } from './ui-primitives'

type SystemAdminScopedRegistryLaunchesProps = {
  registryScopeLabel: string | null
  studentScopeChipLabel: string
  facultyScopeChipLabel: string
  visibleStudentCount: number
  visibleFacultyCount: number
  studentToneColor: string
  facultyToneColor: string
  onOpenScopedStudents: () => void
  onOpenAllStudents: () => void
  onOpenScopedFaculty: () => void
  onOpenAllFaculty: () => void
}

export function SystemAdminScopedRegistryLaunches({
  registryScopeLabel,
  studentScopeChipLabel,
  facultyScopeChipLabel,
  visibleStudentCount,
  visibleFacultyCount,
  studentToneColor,
  facultyToneColor,
  onOpenScopedStudents,
  onOpenAllStudents,
  onOpenScopedFaculty,
  onOpenAllFaculty,
}: SystemAdminScopedRegistryLaunchesProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color={studentToneColor} />
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Students View</div>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          {registryScopeLabel
            ? `Launch #/admin/students with ${registryScopeLabel} preserved as the current scope.`
            : 'Launch the full global #/admin/students registry, or preserve the current hierarchy scope if one is active.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={registryScopeLabel ? studentToneColor : T.dim}>{visibleStudentCount} visible</Chip>
          <Chip color={studentScopeChipLabel === 'Global registry' ? T.dim : T.accent}>{studentScopeChipLabel}</Chip>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn type="button" variant="ghost" onClick={onOpenScopedStudents}>Open #/admin/students</Btn>
          <Btn type="button" variant="ghost" onClick={onOpenAllStudents}>Open All Students</Btn>
        </div>
      </Card>

      <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCog size={14} color={facultyToneColor} />
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Faculty View</div>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          Open the faculty registry scoped to {registryScopeLabel ?? 'the current hierarchy view'}.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={facultyToneColor}>{visibleFacultyCount} visible</Chip>
          <Chip color={facultyScopeChipLabel === 'All faculty' ? T.dim : T.accent}>{facultyScopeChipLabel}</Chip>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn type="button" variant="ghost" onClick={onOpenScopedFaculty}>Open Scoped Faculty</Btn>
          <Btn type="button" variant="ghost" onClick={onOpenAllFaculty}>Open Full Faculty</Btn>
        </div>
      </Card>
    </div>
  )
}
