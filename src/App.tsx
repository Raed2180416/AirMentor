/* eslint-disable react-hooks/purity */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Moon,
  PauseCircle,
  PencilLine,
  Plus,
  ScrollText,
  Send,
  ShieldCheck,
  Sun,
  TriangleAlert,
  UserRound,
  Users2,
} from 'lucide-react'
import {
  CALENDAR_EVENTS,
  ENTRY_KIND_LABELS,
  FACULTY,
  OFFERINGS,
  SUBJECT_RUNS,
  THEME_FAMILIES,
  getDefaultBlueprintQuestions,
  getFacultyById,
  getMenteesForFaculty,
  getOfferingsForSubjectRun,
  getStudentHistory,
  getStudents,
  type BlueprintQuestionSeed,
  type EntryKind,
  type FacultyRecord,
  type MenteeSummary,
  type OfferingSection,
  type Role,
  type SchemeComponentKind,
  type SchemeStatus,
  type Student,
  type SubjectRun,
  type ThemeFamily,
  type ThemeMode,
} from './data'
import './App.css'

type PageId = 'overview' | 'data-hub' | 'scheme' | 'blueprint' | 'queue' | 'mentees' | 'reviews' | 'faculty'
type BannerTone = 'neutral' | 'warning' | 'success' | 'danger'
type SchemeComponentRow = {
  id: string
  kind: SchemeComponentKind
  label: string
  rawMax: number
  normalizedWeight: number
}
type SchemeHistoryEntry = {
  id: string
  at: number
  actorFacultyId: string
  actorRole: Role
  action: string
  note: string
}
type SchemeRuntimeState = {
  subjectRunId: string
  status: SchemeStatus
  components: SchemeComponentRow[]
  lastEditedByFacultyId: string
  lastEditedAt: number
  history: SchemeHistoryEntry[]
}
type BlueprintPart = {
  id: string
  text: string
  maxMarks: number
}
type BlueprintQuestion = {
  id: string
  text: string
  parts: BlueprintPart[]
}
type BlueprintRuntimeState = {
  subjectRunId: string
  status: 'Draft' | 'Published'
  updatedByFacultyId: string
  updatedAt: number
  publishedByFacultyId?: string
  publishedAt?: number
  questions: BlueprintQuestion[]
}
type SectionLockMap = Record<string, Record<EntryKind, boolean>>
type StudentMarksPatch = Partial<Record<EntryKind, number>>
type UnlockRequestStatus = 'Pending' | 'Changes Requested' | 'Approved'
type UnlockRequest = {
  id: string
  subjectRunId: string
  entryKind: EntryKind
  status: UnlockRequestStatus
  requestedByFacultyId: string
  requestedAt: number
  note: string
  reviewedByFacultyId?: string
  reviewedAt?: number
  reviewNote?: string
}
type TaskType = 'Remedial' | 'Follow-up' | 'Attendance' | 'Academic'
type TaskMode = 'one-time' | 'scheduled'
type RecurrencePreset = 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom'
type TaskSeries = {
  id: string
  ownerFacultyId: string
  studentUsn: string
  subjectRunId?: string
  title: string
  taskType: TaskType
  mode: TaskMode
  recurrence: RecurrencePreset
  startDate: string
  time?: string
  endDate?: string
  customDates: Array<{ date: string; time?: string }>
  note: string
  paused: boolean
  endedAt?: number
}
type TaskOccurrenceStatus = 'Pending' | 'Completed' | 'Dismissed'
type TaskOccurrence = {
  id: string
  seriesId: string
  dueDate: string
  time?: string
  status: TaskOccurrenceStatus
  resolvedAt?: number
}
type TaskState = {
  series: TaskSeries[]
  occurrences: TaskOccurrence[]
}
type QueueCardItem = {
  id: string
  tone: BannerTone
  title: string
  detail: string
  meta: string
  actionLabel?: string
  onAction?: () => void
}
type PageMeta = { id: PageId; label: string; icon: LucideIcon }
type ReviewSelection = { kind: 'scheme'; subjectRunId: string } | { kind: 'unlock'; requestId: string }
type TaskComposerState = { isOpen: boolean; editingSeriesId?: string; defaultStudentUsn?: string }
type TaskComposerSubmit = {
  editingSeriesId?: string
  studentUsn: string
  subjectRunId?: string
  title: string
  taskType: TaskType
  mode: TaskMode
  recurrence: RecurrencePreset
  startDate: string
  time?: string
  endDate?: string
  customDates: Array<{ date: string; time?: string }>
  note: string
}
type StudentRow = { offering: OfferingSection; student: Student }

type SchemeValidation = {
  totalNormalized: number
  quizCount: number
  assignmentCount: number
  isValid: boolean
  messages: string[]
}

const STORAGE_KEYS = {
  schemes: 'airmentor-schemes-v3',
  blueprints: 'airmentor-blueprints-v3',
  locks: 'airmentor-locks-v3',
  marks: 'airmentor-marks-v3',
  unlocks: 'airmentor-unlocks-v3',
  tasks: 'airmentor-tasks-v3',
  themeFamily: 'airmentor-theme-family-v3',
  themeMode: 'airmentor-theme-mode-v3',
} as const

const ENTRY_KINDS: EntryKind[] = ['tt1', 'tt2', 'quiz', 'assignment', 'attendance', 'finals']
const TASK_TYPES: TaskType[] = ['Remedial', 'Follow-up', 'Attendance', 'Academic']
const RECURRENCE_OPTIONS: Array<{ value: RecurrencePreset; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom', label: 'Custom dates' },
]
const PAGE_META: Record<PageId, PageMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  'data-hub': { id: 'data-hub', label: 'Data Entry Hub', icon: Layers3 },
  scheme: { id: 'scheme', label: 'Scheme Builder', icon: BookOpen },
  blueprint: { id: 'blueprint', label: 'TT Blueprint', icon: ScrollText },
  queue: { id: 'queue', label: 'Action Queue', icon: Bell },
  mentees: { id: 'mentees', label: 'Mentees', icon: UserRound },
  reviews: { id: 'reviews', label: 'Operational Reviews', icon: ShieldCheck },
  faculty: { id: 'faculty', label: 'Faculty Directory', icon: Users2 },
}

function App() {
  const [themeFamily, setThemeFamily] = usePersistentState<ThemeFamily>(STORAGE_KEYS.themeFamily, () => 'calm-neutral')
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>(STORAGE_KEYS.themeMode, () => 'light')
  const [schemeStates, setSchemeStates] = usePersistentState<Record<string, SchemeRuntimeState>>(STORAGE_KEYS.schemes, buildInitialSchemeStates)
  const [blueprintStates, setBlueprintStates] = usePersistentState<Record<string, BlueprintRuntimeState>>(STORAGE_KEYS.blueprints, buildInitialBlueprintStates)
  const [sectionLocks, setSectionLocks] = usePersistentState<SectionLockMap>(STORAGE_KEYS.locks, buildInitialSectionLocks)
  const [marks, setMarks] = usePersistentState<Record<string, StudentMarksPatch>>(STORAGE_KEYS.marks, () => ({}))
  const [unlockRequests, setUnlockRequests] = usePersistentState<UnlockRequest[]>(STORAGE_KEYS.unlocks, buildInitialUnlockRequests)
  const [taskState, setTaskState] = usePersistentState<TaskState>(STORAGE_KEYS.tasks, buildInitialTaskState)
  const [currentFacultyId, setCurrentFacultyId] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('Course Leader')
  const [currentPage, setCurrentPage] = useState<PageId>('overview')
  const [selectedSubjectRunId, setSelectedSubjectRunId] = useState<string | null>(null)
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all')
  const [selectedEntryKind, setSelectedEntryKind] = useState<EntryKind>('tt1')
  const [selectedReview, setSelectedReview] = useState<ReviewSelection | null>(null)
  const [taskComposerState, setTaskComposerState] = useState<TaskComposerState>({ isOpen: false })

  useEffect(() => {
    document.body.dataset.themeFamily = themeFamily
    document.body.dataset.themeMode = themeMode
    document.documentElement.style.colorScheme = themeMode
  }, [themeFamily, themeMode])

  const currentFaculty = currentFacultyId ? getFacultyById(currentFacultyId) : null
  const role = currentFaculty ? (currentFaculty.roles.includes(activeRole) ? activeRole : currentFaculty.roles[0]) : null
  const availablePages = role ? pagesForRole(role).map((pageId) => PAGE_META[pageId]) : []
  const page = availablePages.some((item) => item.id === currentPage) ? currentPage : availablePages[0]?.id ?? 'overview'
  const assignedSubjectRuns = currentFaculty
    ? SUBJECT_RUNS.filter((subjectRun) => currentFaculty.subjectRunIds.includes(subjectRun.subjectRunId))
    : []
  const visibleSubjectRuns = currentFaculty && role === 'HoD'
    ? SUBJECT_RUNS.filter((subjectRun) => subjectRun.dept === currentFaculty.dept)
    : assignedSubjectRuns
  const subjectRunId = visibleSubjectRuns.some((subjectRun) => subjectRun.subjectRunId === selectedSubjectRunId)
    ? selectedSubjectRunId
    : visibleSubjectRuns[0]?.subjectRunId ?? null
  const selectedSubjectRun = visibleSubjectRuns.find((subjectRun) => subjectRun.subjectRunId === subjectRunId) ?? null
  const subjectOfferings = selectedSubjectRun ? getOfferingsForSubjectRun(selectedSubjectRun.subjectRunId) : []
  const sectionFilter = selectedSectionFilter === 'all' || subjectOfferings.some((offering) => offering.offId === selectedSectionFilter)
    ? selectedSectionFilter
    : 'all'
  const filteredOfferings = sectionFilter === 'all'
    ? subjectOfferings
    : subjectOfferings.filter((offering) => offering.offId === sectionFilter)
  const selectedScheme = selectedSubjectRun ? schemeStates[selectedSubjectRun.subjectRunId] ?? null : null
  const selectedBlueprint = selectedSubjectRun ? blueprintStates[selectedSubjectRun.subjectRunId] ?? null : null
  const filteredRows = filteredOfferings.flatMap((offering) => getStudents(offering).map((student) => ({ offering, student })))
  const mentees = currentFaculty ? getMenteesForFaculty(currentFaculty.facultyId) : []
  const mentorSeries = currentFaculty ? taskState.series.filter((series) => series.ownerFacultyId === currentFaculty.facultyId) : []
  const mentorSeriesMap = Object.fromEntries(mentorSeries.map((series) => [series.id, series])) as Record<string, TaskSeries>
  const dueMentorOccurrences = currentFaculty
    ? taskState.occurrences
        .filter((occurrence) => {
          const series = mentorSeriesMap[occurrence.seriesId]
          return Boolean(series && !series.paused && !series.endedAt && occurrence.status === 'Pending' && occurrence.dueDate <= todayIso())
        })
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    : []
  const pendingSchemeReviews = currentFaculty && role === 'HoD'
    ? SUBJECT_RUNS.filter((subjectRun) => subjectRun.dept === currentFaculty.dept && schemeStates[subjectRun.subjectRunId]?.status === 'Submitted')
    : []
  const pendingUnlockReviews = currentFaculty && role === 'HoD'
    ? unlockRequests.filter((request) => {
        const subjectRun = SUBJECT_RUNS.find((item) => item.subjectRunId === request.subjectRunId)
        return request.status === 'Pending' && subjectRun?.dept === currentFaculty.dept
      })
    : []
  const reviewItems: ReviewSelection[] = [
    ...pendingSchemeReviews.map((subjectRun) => ({ kind: 'scheme' as const, subjectRunId: subjectRun.subjectRunId })),
    ...pendingUnlockReviews.map((request) => ({ kind: 'unlock' as const, requestId: request.id })),
  ]
  const review = selectedReview && reviewItems.some((item) => sameReview(item, selectedReview)) ? selectedReview : reviewItems[0] ?? null
  const selectedTaskSeries = taskComposerState.editingSeriesId
    ? mentorSeries.find((series) => series.id === taskComposerState.editingSeriesId) ?? null
    : null

  function patchScheme(subjectRunKey: string, updater: (scheme: SchemeRuntimeState) => SchemeRuntimeState) {
    setSchemeStates((previous) => ({ ...previous, [subjectRunKey]: updater(previous[subjectRunKey]) }))
  }

  function patchBlueprint(subjectRunKey: string, updater: (blueprint: BlueprintRuntimeState) => BlueprintRuntimeState) {
    setBlueprintStates((previous) => ({ ...previous, [subjectRunKey]: updater(previous[subjectRunKey]) }))
  }

  function freezeSubjectRun(subjectRunKey: string, actor: FacultyRecord, note: string) {
    patchScheme(subjectRunKey, (scheme) => {
      if (scheme.status === 'Frozen') return scheme
      return {
        ...scheme,
        status: 'Frozen',
        history: [
          ...scheme.history,
          makeSchemeHistory({ actorFacultyId: actor.facultyId, actorRole: actor.roles.includes('HoD') && role === 'HoD' ? 'HoD' : 'Course Leader', action: 'Frozen', note }),
        ],
      }
    })
  }

  function handleMarkChange(row: StudentRow, entryKind: EntryKind, rawValue: string) {
    if (!selectedSubjectRun || !currentFaculty) return
    const parsed = rawValue === '' ? undefined : Number(rawValue)
    setMarks((previous) => ({
      ...previous,
      [row.student.id]: {
        ...previous[row.student.id],
        [entryKind]: parsed,
      },
    }))
    if (schemeStates[selectedSubjectRun.subjectRunId]?.status === 'Approved') {
      freezeSubjectRun(selectedSubjectRun.subjectRunId, currentFaculty, `Marks entry started for ${ENTRY_KIND_LABELS[entryKind]}.`)
    }
  }

  function createUnlockRequest(note: string) {
    if (!selectedSubjectRun || !currentFaculty) return
    const hasPending = unlockRequests.some(
      (request) => request.subjectRunId === selectedSubjectRun.subjectRunId && request.entryKind === selectedEntryKind && request.status === 'Pending',
    )
    if (hasPending) return
    setUnlockRequests((previous) => [
      ...previous,
      {
        id: uid('unlock'),
        subjectRunId: selectedSubjectRun.subjectRunId,
        entryKind: selectedEntryKind,
        status: 'Pending',
        requestedByFacultyId: currentFaculty.facultyId,
        requestedAt: Date.now(),
        note,
      },
    ])
  }

  function saveTask(payload: TaskComposerSubmit) {
    if (!currentFaculty) return
    setTaskState((previous) => upsertTaskState(previous, currentFaculty.facultyId, payload))
    setTaskComposerState({ isOpen: false })
  }

  const courseLeaderQueue: QueueCardItem[] = currentFaculty
    ? [
        ...assignedSubjectRuns.flatMap((subjectRun) => {
          const scheme = schemeStates[subjectRun.subjectRunId]
          if (!scheme) return []
          const items: QueueCardItem[] = []
          if (scheme.status === 'Changes Requested') {
            items.push({
              id: `scheme-changes-${subjectRun.subjectRunId}`,
              tone: 'warning',
              title: `${subjectRun.code} needs scheme changes`,
              detail: latestSchemeNote(scheme),
              meta: 'Open Scheme Builder',
              actionLabel: 'Open scheme',
              onAction: () => {
                setSelectedSubjectRunId(subjectRun.subjectRunId)
                setCurrentPage('scheme')
              },
            })
          }
          if (scheme.status === 'Submitted') {
            items.push({
              id: `scheme-submitted-${subjectRun.subjectRunId}`,
              tone: 'neutral',
              title: `${subjectRun.code} is awaiting HoD review`,
              detail: 'The shared scheme is locked while HoD reviews it.',
              meta: 'Review pending',
            })
          }
          return items
        }),
        ...unlockRequests
          .filter((request) => request.requestedByFacultyId === currentFaculty.facultyId)
          .map((request): QueueCardItem => {
            const subjectRun = SUBJECT_RUNS.find((item) => item.subjectRunId === request.subjectRunId)
            return {
              id: request.id,
              tone: request.status === 'Approved' ? 'success' : request.status === 'Changes Requested' ? 'warning' : 'neutral',
              title: `${subjectRun?.code ?? request.subjectRunId} ${ENTRY_KIND_LABELS[request.entryKind]} unlock ${request.status.toLowerCase()}`,
              detail: request.reviewNote || request.note,
              meta: 'Subject-run scoped',
              actionLabel: 'Open hub',
              onAction: () => {
                setSelectedSubjectRunId(request.subjectRunId)
                setSelectedEntryKind(request.entryKind)
                setCurrentPage('data-hub')
              },
            }
          }),
      ]
    : []

  const hodQueue: QueueCardItem[] = [
    ...pendingSchemeReviews.map((subjectRun) => ({
      id: `hod-scheme-${subjectRun.subjectRunId}`,
      tone: 'warning' as const,
      title: `${subjectRun.code} scheme approval pending`,
      detail: 'Shared scheme submitted for HoD review.',
      meta: `${subjectRun.sectionOfferingIds.length} section(s)`,
      actionLabel: 'Review',
      onAction: () => {
        setSelectedReview({ kind: 'scheme', subjectRunId: subjectRun.subjectRunId })
        setCurrentPage('reviews')
      },
    })),
    ...pendingUnlockReviews.map((request) => ({
      id: `hod-unlock-${request.id}`,
      tone: 'neutral' as const,
      title: `${ENTRY_KIND_LABELS[request.entryKind]} unlock pending`,
      detail: request.note,
      meta: 'Applies across all sections in the semester',
      actionLabel: 'Review',
      onAction: () => {
        setSelectedReview({ kind: 'unlock', requestId: request.id })
        setCurrentPage('reviews')
      },
    })),
  ]

  const mentorQueue: QueueCardItem[] = dueMentorOccurrences.map((occurrence) => {
    const series = mentorSeriesMap[occurrence.seriesId]
    const mentee = mentees.find((item) => item.usn === series?.studentUsn)
    return {
      id: occurrence.id,
      tone: series?.taskType === 'Remedial' ? 'warning' : 'neutral',
      title: series?.title ?? 'Scheduled task',
      detail: `${mentee?.name ?? series?.studentUsn ?? 'Student'} · ${series?.taskType ?? 'Follow-up'}`,
      meta: `${formatDate(occurrence.dueDate)}${occurrence.time ? ` at ${formatTime(occurrence.time)}` : ''}`,
    }
  })

  const queueItems = role === 'HoD' ? hodQueue : role === 'Mentor' ? mentorQueue : courseLeaderQueue

  if (!currentFaculty || !role) {
    return (
      <LoginPage
        onLogin={(facultyId) => {
          const faculty = getFacultyById(facultyId)
          if (!faculty) return
          setCurrentFacultyId(faculty.facultyId)
          setActiveRole(faculty.roles[0])
          setCurrentPage(pagesForRole(faculty.roles[0])[0] ?? 'overview')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">AM</div>
          <div>
            <div className="eyebrow">AirMentor</div>
            <div className="brand-title">Operational mock</div>
          </div>
        </div>
        <div className="sidebar-profile card-shell">
          <div className="avatar-circle">{currentFaculty.initials}</div>
          <div>
            <strong>{currentFaculty.name}</strong>
            <p>{currentFaculty.title}</p>
          </div>
        </div>
        <div className="chip-row sidebar-role-row">
          {currentFaculty.roles.map((roleItem) => (
            <RoleBadge key={roleItem} role={roleItem} />
          ))}
        </div>
        <nav className="sidebar-nav">
          {availablePages.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={cls('nav-item', page === item.id && 'is-active')}
                type="button"
                onClick={() => setCurrentPage(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <button
          className="button button-secondary sidebar-logout"
          type="button"
          onClick={() => {
            setCurrentFacultyId(null)
            setSelectedSubjectRunId(null)
            setSelectedReview(null)
            setTaskComposerState({ isOpen: false })
          }}
        >
          Log out
        </button>
      </aside>
      <div className="app-main">
        <TopBar
          faculty={currentFaculty}
          role={role}
          queueCount={queueItems.length}
          themeFamily={themeFamily}
          themeMode={themeMode}
          onRoleChange={(nextRole) => {
            setActiveRole(nextRole)
            setCurrentPage(pagesForRole(nextRole)[0] ?? 'overview')
          }}
          onThemeFamilyChange={setThemeFamily}
          onThemeModeChange={setThemeMode}
        />
        <main className="app-content">
          {page === 'overview' && (
            <OverviewPage
              faculty={currentFaculty}
              role={role}
              queueItems={queueItems}
              assignedSubjectRuns={assignedSubjectRuns}
              departmentSubjectRuns={SUBJECT_RUNS.filter((subjectRun) => subjectRun.dept === currentFaculty.dept)}
              schemes={schemeStates}
              mentees={mentees}
              dueOccurrences={dueMentorOccurrences}
              onOpenQueue={() => setCurrentPage('queue')}
              onOpenReviews={() => setCurrentPage('reviews')}
              onOpenMentees={() => setCurrentPage('mentees')}
            />
          )}
          {page === 'data-hub' && role === 'Course Leader' && selectedSubjectRun && selectedScheme && (
            <CourseLeaderHub
              faculty={currentFaculty}
              subjectRuns={assignedSubjectRuns}
              selectedSubjectRun={selectedSubjectRun}
              selectedScheme={selectedScheme}
              selectedBlueprint={selectedBlueprint}
              offerings={subjectOfferings}
              sectionFilter={sectionFilter}
              entryKind={selectedEntryKind}
              rows={filteredRows}
              marks={marks}
              locks={sectionLocks}
              unlockRequests={unlockRequests}
              onSubjectRunChange={setSelectedSubjectRunId}
              onSectionFilterChange={setSelectedSectionFilter}
              onEntryKindChange={setSelectedEntryKind}
              onRequestUnlock={createUnlockRequest}
              onMarkChange={handleMarkChange}
            />
          )}
          {page === 'scheme' && role === 'Course Leader' && selectedSubjectRun && selectedScheme && (
            <SchemeBuilderPage
              key={selectedSubjectRun.subjectRunId}
              subjectRun={selectedSubjectRun}
              scheme={selectedScheme}
              onUpdateComponents={(components) => patchScheme(selectedSubjectRun.subjectRunId, (scheme) => ({ ...scheme, components }))}
              onSaveDraft={(note) => {
                patchScheme(selectedSubjectRun.subjectRunId, (scheme) => ({
                  ...scheme,
                  lastEditedAt: Date.now(),
                  lastEditedByFacultyId: currentFaculty.facultyId,
                  history: [...scheme.history, makeSchemeHistory({ actorFacultyId: currentFaculty.facultyId, actorRole: 'Course Leader', action: 'Edited draft', note })],
                }))
              }}
              onSubmit={(note) => {
                patchScheme(selectedSubjectRun.subjectRunId, (scheme) => ({
                  ...scheme,
                  status: 'Submitted',
                  lastEditedAt: Date.now(),
                  lastEditedByFacultyId: currentFaculty.facultyId,
                  history: [...scheme.history, makeSchemeHistory({ actorFacultyId: currentFaculty.facultyId, actorRole: 'Course Leader', action: 'Submitted to HoD', note })],
                }))
                setCurrentPage('queue')
              }}
            />
          )}
          {page === 'blueprint' && role === 'Course Leader' && selectedSubjectRun && selectedScheme && selectedBlueprint && (
            <BlueprintBuilderPage
              key={selectedSubjectRun.subjectRunId}
              subjectRun={selectedSubjectRun}
              scheme={selectedScheme}
              blueprint={selectedBlueprint}
              onUpdateQuestions={(questions) => patchBlueprint(selectedSubjectRun.subjectRunId, (blueprint) => ({ ...blueprint, questions, updatedAt: Date.now(), updatedByFacultyId: currentFaculty.facultyId }))}
              onPublish={(questions) => {
                const stamp = Date.now()
                patchBlueprint(selectedSubjectRun.subjectRunId, (blueprint) => ({
                  ...blueprint,
                  questions,
                  status: 'Published',
                  updatedAt: stamp,
                  updatedByFacultyId: currentFaculty.facultyId,
                  publishedAt: stamp,
                  publishedByFacultyId: currentFaculty.facultyId,
                }))
                freezeSubjectRun(selectedSubjectRun.subjectRunId, currentFaculty, 'TT blueprint published. The scheme is now frozen.')
              }}
            />
          )}
          {page === 'reviews' && role === 'HoD' && (
            <OperationalReviewsPage
              key={review ? review.kind === 'scheme' ? review.subjectRunId : review.requestId : 'empty'}
              schemes={schemeStates}
              subjectRuns={SUBJECT_RUNS.filter((subjectRun) => subjectRun.dept === currentFaculty.dept)}
              unlockRequests={unlockRequests}
              review={review}
              onSelectReview={setSelectedReview}
              onRequestSchemeChanges={(subjectRunKey, note) => {
                patchScheme(subjectRunKey, (scheme) => ({
                  ...scheme,
                  status: 'Changes Requested',
                  history: [...scheme.history, makeSchemeHistory({ actorFacultyId: currentFaculty.facultyId, actorRole: 'HoD', action: 'Changes requested', note })],
                }))
              }}
              onApproveScheme={(subjectRunKey, note) => {
                patchScheme(subjectRunKey, (scheme) => ({
                  ...scheme,
                  status: 'Approved',
                  history: [...scheme.history, makeSchemeHistory({ actorFacultyId: currentFaculty.facultyId, actorRole: 'HoD', action: 'Approved & Locked', note })],
                }))
              }}
              onRequestUnlockChanges={(requestId, note) => {
                setUnlockRequests((previous) => previous.map((request) => request.id === requestId ? { ...request, status: 'Changes Requested', reviewedAt: Date.now(), reviewedByFacultyId: currentFaculty.facultyId, reviewNote: note } : request))
              }}
              onApproveUnlock={(requestId, note) => {
                const currentRequest = unlockRequests.find((request) => request.id === requestId)
                if (!currentRequest) return
                setUnlockRequests((previous) => previous.map((request) => request.id === requestId ? { ...request, status: 'Approved', reviewedAt: Date.now(), reviewedByFacultyId: currentFaculty.facultyId, reviewNote: note } : request))
                setSectionLocks((previous) => {
                  const next = { ...previous }
                  getOfferingsForSubjectRun(currentRequest.subjectRunId).forEach((offering) => {
                    next[offering.offId] = { ...next[offering.offId], [currentRequest.entryKind]: false }
                  })
                  return next
                })
              }}
            />
          )}
          {page === 'faculty' && role === 'HoD' && (
            <FacultyDirectoryPage faculty={currentFaculty} members={FACULTY.filter((faculty) => faculty.dept === currentFaculty.dept)} />
          )}
          {page === 'mentees' && role === 'Mentor' && (
            <MentorWorkspace
              key={currentFaculty.facultyId}
              mentees={mentees}
              series={mentorSeries}
              occurrences={taskState.occurrences.filter((occurrence) => mentorSeriesMap[occurrence.seriesId])}
              onOpenComposer={(payload) => setTaskComposerState({ isOpen: true, ...payload })}
              onTogglePause={(seriesId) => setTaskState((previous) => ({ ...previous, series: previous.series.map((series) => series.id === seriesId ? { ...series, paused: !series.paused } : series) }))}
              onEndSeries={(seriesId) => {
                const today = todayIso()
                setTaskState((previous) => ({
                  series: previous.series.map((series) => series.id === seriesId ? { ...series, endedAt: Date.now() } : series),
                  occurrences: previous.occurrences.filter((occurrence) => !(occurrence.seriesId === seriesId && occurrence.status === 'Pending' && occurrence.dueDate > today)),
                }))
              }}
              onResolveOccurrence={(occurrenceId, status) => setTaskState((previous) => ({ ...previous, occurrences: previous.occurrences.map((occurrence) => occurrence.id === occurrenceId ? { ...occurrence, status, resolvedAt: Date.now() } : occurrence) }))}
            />
          )}
          {page === 'queue' && (
            <QueuePage
              role={role}
              items={queueItems}
              occurrences={dueMentorOccurrences}
              mentorSeriesMap={mentorSeriesMap}
              mentees={mentees}
              onResolveOccurrence={(occurrenceId, status) => setTaskState((previous) => ({ ...previous, occurrences: previous.occurrences.map((occurrence) => occurrence.id === occurrenceId ? { ...occurrence, status, resolvedAt: Date.now() } : occurrence) }))}
            />
          )}
        </main>
      </div>
      {taskComposerState.isOpen && role === 'Mentor' && (
        <TaskComposerModal
          key={taskComposerState.editingSeriesId ?? taskComposerState.defaultStudentUsn ?? 'new'}
          faculty={currentFaculty}
          mentees={mentees}
          subjectRuns={assignedSubjectRuns}
          series={selectedTaskSeries}
          defaultStudentUsn={taskComposerState.defaultStudentUsn}
          onClose={() => setTaskComposerState({ isOpen: false })}
          onSubmit={saveTask}
        />
      )}
    </div>
  )
}

function LoginPage({ onLogin }: { onLogin: (facultyId: string) => void }) {
  const [facultyId, setFacultyId] = useState(FACULTY[0]?.facultyId ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const selectedFaculty = FACULTY.find((faculty) => faculty.facultyId === facultyId) ?? FACULTY[0]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== '1234') {
      setError('Invalid password')
      return
    }
    setError('')
    onLogin(facultyId)
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="eyebrow">AirMentor Mock</div>
        <h1>Shared schemes, operational reviews, and calmer theme controls.</h1>
        <p className="login-copy">
          The mock now runs on one faculty source, one subject-run scheme, queue-based HoD approvals, and scheduled mentor tasks with recurring occurrences.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-faculty">Faculty account</label>
          <select id="login-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
            {FACULTY.map((faculty) => (
              <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.name}</option>
            ))}
          </select>
          <label className="field-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Use 1234" />
          {error && <div className="inline-error">{error}</div>}
          <button className="button button-primary" type="submit">Login</button>
        </form>
        <div className="login-account-card">
          <strong>{selectedFaculty.name}</strong>
          <p>{selectedFaculty.title}</p>
          <div className="chip-row">
            {selectedFaculty.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TopBar(props: {
  faculty: FacultyRecord
  role: Role
  queueCount: number
  themeFamily: ThemeFamily
  themeMode: ThemeMode
  onRoleChange: (role: Role) => void
  onThemeFamilyChange: (family: ThemeFamily) => void
  onThemeModeChange: (mode: ThemeMode) => void
}) {
  const { faculty, role, queueCount, themeFamily, themeMode, onRoleChange, onThemeFamilyChange, onThemeModeChange } = props
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">Signed in as {faculty.initials}</div>
        <h2>{role} workspace</h2>
      </div>
      <div className="topbar-controls">
        <div className="control-group">
          <label className="field-label" htmlFor="role-switch">Role</label>
          <select id="role-switch" value={role} onChange={(event) => onRoleChange(event.target.value as Role)}>
            {faculty.roles.map((roleOption) => (
              <option key={roleOption} value={roleOption}>{roleOption}</option>
            ))}
          </select>
        </div>
        <div className="control-group control-group-wide">
          <label className="field-label" htmlFor="theme-family">Theme family</label>
          <select id="theme-family" value={themeFamily} onChange={(event) => onThemeFamilyChange(event.target.value as ThemeFamily)}>
            {THEME_FAMILIES.map((family) => (
              <option key={family.id} value={family.id}>{family.label}</option>
            ))}
          </select>
        </div>
        <div className="segmented-control" role="tablist" aria-label="Theme mode">
          <button className={cls('segmented-option', themeMode === 'light' && 'is-selected')} type="button" onClick={() => onThemeModeChange('light')}>
            <Sun size={16} /> Light
          </button>
          <button className={cls('segmented-option', themeMode === 'dark' && 'is-selected')} type="button" onClick={() => onThemeModeChange('dark')}>
            <Moon size={16} /> Dark
          </button>
        </div>
        <div className="queue-chip">
          <Bell size={16} />
          <span>{queueCount}</span>
        </div>
      </div>
    </header>
  )
}

function OverviewPage(props: {
  faculty: FacultyRecord
  role: Role
  queueItems: QueueCardItem[]
  assignedSubjectRuns: SubjectRun[]
  departmentSubjectRuns: SubjectRun[]
  schemes: Record<string, SchemeRuntimeState>
  mentees: MenteeSummary[]
  dueOccurrences: TaskOccurrence[]
  onOpenQueue: () => void
  onOpenReviews: () => void
  onOpenMentees: () => void
}) {
  const { faculty, role, queueItems, assignedSubjectRuns, departmentSubjectRuns, schemes, mentees, dueOccurrences, onOpenQueue, onOpenReviews, onOpenMentees } = props
  const stats = role === 'HoD'
    ? [
        { label: 'Pending scheme reviews', value: String(departmentSubjectRuns.filter((subjectRun) => schemes[subjectRun.subjectRunId]?.status === 'Submitted').length), icon: ShieldCheck },
        { label: 'Department subject-runs', value: String(departmentSubjectRuns.length), icon: GraduationCap },
        { label: 'Faculty members', value: String(FACULTY.filter((member) => member.dept === faculty.dept).length), icon: Users2 },
      ]
    : role === 'Mentor'
      ? [
          { label: 'Mentees', value: String(mentees.length), icon: Users2 },
          { label: 'High-risk flags', value: String(mentees.filter((mentee) => mentee.courseRisks.some((risk) => risk.riskBand === 'High')).length), icon: TriangleAlert },
          { label: 'Due occurrences', value: String(dueOccurrences.length), icon: Clock3 },
        ]
      : [
          { label: 'Assigned subject-runs', value: String(assignedSubjectRuns.length), icon: GraduationCap },
          { label: 'Awaiting HoD review', value: String(assignedSubjectRuns.filter((subjectRun) => schemes[subjectRun.subjectRunId]?.status === 'Submitted').length), icon: ShieldCheck },
          { label: 'Changes requested', value: String(assignedSubjectRuns.filter((subjectRun) => schemes[subjectRun.subjectRunId]?.status === 'Changes Requested').length), icon: PencilLine },
        ]

  return (
    <div className="page-stack">
      <PageHeader
        title={`Welcome back, ${faculty.name.split(' ')[1] ?? faculty.name}`}
        subtitle={role === 'HoD'
          ? 'Review scheme locks and marks unlocks without direct data-entry access.'
          : role === 'Mentor'
            ? 'Track at-risk mentees and scheduled follow-ups from one place.'
            : 'Manage shared subject-run schemes, blueprint publish, and section-filtered marks entry.'}
      />
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <section className="stat-card card-shell" key={stat.label}>
              <div className="stat-icon"><Icon size={18} /></div>
              <div className="stat-copy">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </section>
          )
        })}
      </div>
      <div className="content-grid content-grid-double">
        <section className="card-shell">
          <div className="section-heading">
            <div>
              <h3>Action snapshot</h3>
              <p>Your current role-specific queue.</p>
            </div>
            <button className="button button-secondary" type="button" onClick={onOpenQueue}>Open queue</button>
          </div>
          <div className="list-stack">
            {queueItems.length === 0 && <EmptyState title="Nothing urgent" description="This role has no active queue items right now." />}
            {queueItems.slice(0, 4).map((item) => <QueueNoticeCard key={item.id} item={item} />)}
          </div>
        </section>
        <section className="card-shell">
          <div className="section-heading">
            <div>
              <h3>Upcoming calendar</h3>
              <p>Mock checkpoints across scheme review, TT windows, and mentor follow-ups.</p>
            </div>
            {role === 'HoD' ? (
              <button className="button button-secondary" type="button" onClick={onOpenReviews}>Open reviews</button>
            ) : role === 'Mentor' ? (
              <button className="button button-secondary" type="button" onClick={onOpenMentees}>Open mentees</button>
            ) : null}
          </div>
          <div className="list-stack">
            {CALENDAR_EVENTS.map((event) => (
              <article className="timeline-row" key={`${event.date}-${event.label}`}>
                <div className="timeline-date">{event.date}</div>
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.type}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function CourseLeaderHub(props: {
  faculty: FacultyRecord
  subjectRuns: SubjectRun[]
  selectedSubjectRun: SubjectRun
  selectedScheme: SchemeRuntimeState
  selectedBlueprint: BlueprintRuntimeState | null
  offerings: OfferingSection[]
  sectionFilter: string
  entryKind: EntryKind
  rows: StudentRow[]
  marks: Record<string, StudentMarksPatch>
  locks: SectionLockMap
  unlockRequests: UnlockRequest[]
  onSubjectRunChange: (value: string) => void
  onSectionFilterChange: (value: string) => void
  onEntryKindChange: (value: EntryKind) => void
  onRequestUnlock: (note: string) => void
  onMarkChange: (row: StudentRow, entryKind: EntryKind, value: string) => void
}) {
  const { faculty, subjectRuns, selectedSubjectRun, selectedScheme, selectedBlueprint, offerings, sectionFilter, entryKind, rows, marks, locks, unlockRequests, onSubjectRunChange, onSectionFilterChange, onEntryKindChange, onRequestUnlock, onMarkChange } = props
  const [note, setNote] = useState('')
  const filteredOfferings = sectionFilter === 'all' ? offerings : offerings.filter((offering) => offering.offId === sectionFilter)
  const locked = filteredOfferings.some((offering) => locks[offering.offId]?.[entryKind])
  const latestUnlock = unlockRequests
    .filter((request) => request.subjectRunId === selectedSubjectRun.subjectRunId && request.entryKind === entryKind)
    .sort((left, right) => right.requestedAt - left.requestedAt)[0]
  const marksEditable = (selectedScheme.status === 'Approved' || selectedScheme.status === 'Frozen') && !locked
  const banner = schemeBanner(selectedScheme, selectedBlueprint)

  return (
    <div className="page-stack">
      <PageHeader title="Data Entry Hub" subtitle="One subject-run selector, one section filter, shared scheme state, and subject-run scoped unlock requests." />
      <section className="card-shell toolbar-card">
        <div className="toolbar-grid">
          <div className="control-group control-group-wide">
            <label className="field-label" htmlFor="subject-run-hub">Subject-run</label>
            <select id="subject-run-hub" value={selectedSubjectRun.subjectRunId} onChange={(event) => onSubjectRunChange(event.target.value)}>
              {subjectRuns.map((subjectRun) => (
                <option key={subjectRun.subjectRunId} value={subjectRun.subjectRunId}>{subjectRun.code} · {subjectRun.title}</option>
              ))}
            </select>
          </div>
          <div className="control-group control-group-wide">
            <label className="field-label" htmlFor="section-filter">Section filter</label>
            <select id="section-filter" value={sectionFilter} onChange={(event) => onSectionFilterChange(event.target.value)}>
              <option value="all">All sections</option>
              {offerings.map((offering) => (
                <option key={offering.offId} value={offering.offId}>Section {offering.section}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="chip-row">
          {selectedSubjectRun.courseLeaderFacultyIds.map((facultyId) => {
            const leader = getFacultyById(facultyId)
            return leader ? <InlineBadge key={facultyId}>{leader.name}</InlineBadge> : null
          })}
          <InlineBadge>{selectedSubjectRun.yearLabel}</InlineBadge>
          <InlineBadge>{`Semester ${selectedSubjectRun.semester}`}</InlineBadge>
          <InlineBadge>{`SEE ${selectedSubjectRun.seeRawMax}`}</InlineBadge>
        </div>
      </section>
      <Banner tone={banner.tone} title={banner.title} description={banner.description} />
      <div className="content-grid content-grid-double">
        <section className="card-shell">
          <div className="section-heading">
            <div>
              <h3>Section locks</h3>
              <p>Section-specific locks stay visible even though unlock approval is subject-run scoped.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Section</th>
                  {ENTRY_KINDS.map((kind) => <th key={kind}>{ENTRY_KIND_LABELS[kind]}</th>)}
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.offId}>
                    <td>{offering.section}</td>
                    {ENTRY_KINDS.map((kind) => (
                      <td key={kind}><InlineBadge tone={locks[offering.offId]?.[kind] ? 'warning' : 'success'}>{locks[offering.offId]?.[kind] ? 'Locked' : 'Open'}</InlineBadge></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card-shell">
          <div className="section-heading">
            <div>
              <h3>Unlock request</h3>
              <p>Only Course Leaders can request unlocks; HoD handles them from Operational Reviews.</p>
            </div>
            <RoleBadge role={faculty.roles.includes('Course Leader') ? 'Course Leader' : faculty.roles[0]} />
          </div>
          <div className="chip-row">
            {ENTRY_KINDS.map((kind) => (
              <button key={kind} className={cls('pill-button', entryKind === kind && 'is-selected')} type="button" onClick={() => onEntryKindChange(kind)}>
                {ENTRY_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <div className="info-stack">
            <strong>{ENTRY_KIND_LABELS[entryKind]} status</strong>
            <p>{locked ? `Locked across ${filteredOfferings.length} filtered section(s).` : 'Currently open for marks entry.'}</p>
            {latestUnlock && <InlineBadge tone={latestUnlock.status === 'Approved' ? 'success' : latestUnlock.status === 'Changes Requested' ? 'warning' : 'neutral'}>{`Latest request: ${latestUnlock.status}`}</InlineBadge>}
            {latestUnlock?.reviewNote && <p>{latestUnlock.reviewNote}</p>}
          </div>
          {locked && (
            <>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why this dataset should reopen across every section in the same semester." />
              <button className="button button-primary" type="button" onClick={() => { onRequestUnlock(note || `Reopen ${ENTRY_KIND_LABELS[entryKind]} across all sections for correction.`); setNote('') }}>
                Request unlock
              </button>
            </>
          )}
        </section>
      </div>
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>Marks entry</h3>
            <p>Editing marks while the scheme is Approved immediately freezes it. HoD cannot reach this editor.</p>
          </div>
          <InlineBadge tone={marksEditable ? 'success' : 'warning'}>{marksEditable ? 'Editable' : 'Blocked'}</InlineBadge>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>USN</th>
                <th>Name</th>
                <th>Section</th>
                <th>{ENTRY_KIND_LABELS[entryKind]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const value = marks[row.student.id]?.[entryKind] ?? baseMark(row.student, row.offering, selectedSubjectRun, entryKind)
                return (
                  <tr key={row.student.id}>
                    <td>{row.student.usn}</td>
                    <td>{row.student.name}</td>
                    <td>{row.offering.section}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={maxForEntryKind(selectedSubjectRun, selectedScheme, entryKind)}
                        value={value ?? ''}
                        disabled={!marksEditable}
                        onChange={(event) => onMarkChange(row, entryKind, event.target.value)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SchemeBuilderPage(props: {
  subjectRun: SubjectRun
  scheme: SchemeRuntimeState
  onUpdateComponents: (components: SchemeComponentRow[]) => void
  onSaveDraft: (note: string) => void
  onSubmit: (note: string) => void
}) {
  const { subjectRun, scheme, onUpdateComponents, onSaveDraft, onSubmit } = props
  const [note, setNote] = useState('')
  const validation = validateScheme(scheme.components)
  const editable = scheme.status === 'Draft' || scheme.status === 'Changes Requested'

  function updateComponent(componentId: string, key: keyof SchemeComponentRow, value: string) {
    onUpdateComponents(
      scheme.components.map((component) => {
        if (component.id !== componentId) return component
        if (key === 'kind' || key === 'label') return { ...component, [key]: value }
        return { ...component, [key]: Number(value) }
      }),
    )
  }

  function addComponent(kind: SchemeComponentKind) {
    const count = scheme.components.filter((component) => component.kind === kind).length + 1
    onUpdateComponents([
      ...scheme.components,
      {
        id: uid(`component-${kind}`),
        kind,
        label: `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${count}`,
        rawMax: kind === 'quiz' ? 10 : 15,
        normalizedWeight: kind === 'quiz' ? 10 : 15,
      },
    ])
  }

  return (
    <div className="page-stack">
      <PageHeader title="Shared Scheme Builder" subtitle="One component table for quizzes and assignments, with shared draft ownership across course leaders." />
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>{subjectRun.code} · evaluation scheme</h3>
            <p>{`Last edited by ${facultyName(scheme.lastEditedByFacultyId)} on ${formatStamp(scheme.lastEditedAt)}.`}</p>
          </div>
          <InlineBadge tone={scheme.status === 'Approved' || scheme.status === 'Frozen' ? 'success' : 'warning'}>{scheme.status === 'Approved' ? 'Approved & Locked' : scheme.status}</InlineBadge>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Label</th>
                <th>Raw max</th>
                <th>Normalized weight</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scheme.components.map((component) => (
                <tr key={component.id}>
                  <td>
                    <select value={component.kind} disabled={!editable} onChange={(event) => updateComponent(component.id, 'kind', event.target.value)}>
                      <option value="quiz">Quiz</option>
                      <option value="assignment">Assignment</option>
                    </select>
                  </td>
                  <td>
                    <input value={component.label} disabled={!editable} onChange={(event) => updateComponent(component.id, 'label', event.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={component.rawMax} disabled={!editable} onChange={(event) => updateComponent(component.id, 'rawMax', event.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={component.normalizedWeight} disabled={!editable} onChange={(event) => updateComponent(component.id, 'normalizedWeight', event.target.value)} />
                  </td>
                  <td>
                    {editable && (
                      <button className="button button-ghost" type="button" onClick={() => onUpdateComponents(scheme.components.filter((item) => item.id !== component.id))}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="chip-row">
            <button className="button button-secondary" type="button" onClick={() => addComponent('quiz')} disabled={validation.quizCount >= 2}><Plus size={16} /> Add quiz</button>
            <button className="button button-secondary" type="button" onClick={() => addComponent('assignment')} disabled={validation.assignmentCount >= 2}><Plus size={16} /> Add assignment</button>
          </div>
        )}
        <div className="validation-panel">
          <strong>Validation summary</strong>
          <p>{`Total normalized weight: ${validation.totalNormalized} / 30 · Quizzes: ${validation.quizCount} · Assignments: ${validation.assignmentCount}`}</p>
          <ul>
            {validation.messages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={!editable} placeholder="Add draft context or explain what changed." />
        {editable && (
          <div className="action-row">
            <button className="button button-secondary" type="button" disabled={!validation.isValid} onClick={() => { onSaveDraft(note || 'Course Leader updated the shared draft.'); setNote('') }}>
              Save draft
            </button>
            <button className="button button-primary" type="button" disabled={!validation.isValid} onClick={() => { onSubmit(note || 'Shared scheme draft sent for HoD review.'); setNote('') }}>
              <Send size={16} /> Submit to HoD
            </button>
          </div>
        )}
      </section>
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>Review history</h3>
            <p>Shared back-and-forth across the approval lifecycle.</p>
          </div>
        </div>
        <div className="list-stack">
          {scheme.history.slice().reverse().map((entry) => (
            <article className="activity-row" key={entry.id}>
              <div>
                <strong>{entry.action}</strong>
                <p>{entry.note}</p>
              </div>
              <div className="activity-meta">
                <span>{facultyName(entry.actorFacultyId)}</span>
                <span>{formatStamp(entry.at)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function BlueprintBuilderPage(props: {
  subjectRun: SubjectRun
  scheme: SchemeRuntimeState
  blueprint: BlueprintRuntimeState
  onUpdateQuestions: (questions: BlueprintQuestion[]) => void
  onPublish: (questions: BlueprintQuestion[]) => void
}) {
  const { subjectRun, scheme, blueprint, onUpdateQuestions, onPublish } = props
  const total = blueprint.questions.reduce((sum, question) => sum + question.parts.reduce((partSum, part) => partSum + part.maxMarks, 0), 0)
  const editable = blueprint.status === 'Draft'
  const publishReady = editable && scheme.status === 'Approved' && total === 25

  return (
    <div className="page-stack">
      <PageHeader title="Structured TT Blueprint" subtitle="Stable numbering, per-part marks, total 25 validation, and publish-driven freeze." />
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>{subjectRun.code} · TT1 blueprint</h3>
            <p>{`Updated by ${facultyName(blueprint.updatedByFacultyId)} on ${formatStamp(blueprint.updatedAt)}.`}</p>
          </div>
          <InlineBadge tone={blueprint.status === 'Published' ? 'success' : 'warning'}>{blueprint.status}</InlineBadge>
        </div>
        <div className="list-stack">
          {blueprint.questions.map((question, questionIndex) => (
            <article className="question-card" key={question.id}>
              <div className="question-header">
                <strong>{`Question ${questionIndex + 1}`}</strong>
                <span>{`${question.parts.reduce((sum, part) => sum + part.maxMarks, 0)} marks`}</span>
              </div>
              <input
                value={question.text}
                disabled={!editable}
                onChange={(event) => onUpdateQuestions(blueprint.questions.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))}
              />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Prompt</th>
                      <th>Max marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {question.parts.map((part, partIndex) => (
                      <tr key={part.id}>
                        <td>{`Q${questionIndex + 1}${String.fromCharCode(97 + partIndex)}`}</td>
                        <td>
                          <input
                            value={part.text}
                            disabled={!editable}
                            onChange={(event) => onUpdateQuestions(blueprint.questions.map((item) => item.id !== question.id ? item : { ...item, parts: item.parts.map((subPart) => subPart.id === part.id ? { ...subPart, text: event.target.value } : subPart) }))}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={part.maxMarks}
                            disabled={!editable}
                            onChange={(event) => onUpdateQuestions(blueprint.questions.map((item) => item.id !== question.id ? item : { ...item, parts: item.parts.map((subPart) => subPart.id === part.id ? { ...subPart, maxMarks: Number(event.target.value) } : subPart) }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
        <div className="validation-panel">
          <strong>{`Raw total: ${total} / 25`}</strong>
          {scheme.status !== 'Approved' && blueprint.status !== 'Published' && <p>HoD must approve the scheme before publish unlocks.</p>}
        </div>
        {editable && (
          <div className="action-row">
            <button className="button button-secondary" type="button" onClick={() => onUpdateQuestions(blueprint.questions)}>Save draft</button>
            <button className="button button-primary" type="button" disabled={!publishReady} onClick={() => onPublish(blueprint.questions)}>Publish and freeze scheme</button>
          </div>
        )}
        {blueprint.status === 'Published' && blueprint.publishedAt && (
          <Banner tone="success" title="Blueprint published" description={`Published by ${facultyName(blueprint.publishedByFacultyId ?? blueprint.updatedByFacultyId)} on ${formatStamp(blueprint.publishedAt)}.`} />
        )}
      </section>
    </div>
  )
}

function OperationalReviewsPage(props: {
  schemes: Record<string, SchemeRuntimeState>
  subjectRuns: SubjectRun[]
  unlockRequests: UnlockRequest[]
  review: ReviewSelection | null
  onSelectReview: (review: ReviewSelection | null) => void
  onRequestSchemeChanges: (subjectRunId: string, note: string) => void
  onApproveScheme: (subjectRunId: string, note: string) => void
  onRequestUnlockChanges: (requestId: string, note: string) => void
  onApproveUnlock: (requestId: string, note: string) => void
}) {
  const { schemes, subjectRuns, unlockRequests, review, onSelectReview, onRequestSchemeChanges, onApproveScheme, onRequestUnlockChanges, onApproveUnlock } = props
  const [note, setNote] = useState('')
  const pendingSchemes = subjectRuns.filter((subjectRun) => schemes[subjectRun.subjectRunId]?.status === 'Submitted')
  const pendingUnlocks = unlockRequests.filter((request) => request.status === 'Pending')
  const selectedSchemeRun = review?.kind === 'scheme' ? subjectRuns.find((subjectRun) => subjectRun.subjectRunId === review.subjectRunId) ?? null : null
  const selectedScheme = selectedSchemeRun ? schemes[selectedSchemeRun.subjectRunId] ?? null : null
  const selectedUnlock = review?.kind === 'unlock' ? unlockRequests.find((request) => request.id === review.requestId) ?? null : null

  return (
    <div className="page-stack">
      <PageHeader title="Operational Reviews" subtitle="HoD can approve or return schemes and marks unlocks here, without any direct data-entry path." />
      <div className="content-grid content-grid-triple">
        <section className="card-shell list-panel">
          <div className="section-heading">
            <div>
              <h3>Pending items</h3>
              <p>Select a scheme approval or unlock request.</p>
            </div>
          </div>
          <div className="list-stack">
            {pendingSchemes.map((subjectRun) => (
              <button key={subjectRun.subjectRunId} className={cls('list-card', review?.kind === 'scheme' && review.subjectRunId === subjectRun.subjectRunId && 'is-active')} type="button" onClick={() => onSelectReview({ kind: 'scheme', subjectRunId: subjectRun.subjectRunId })}>
                <strong>{`${subjectRun.code} scheme approval`}</strong>
                <p>{subjectRun.title}</p>
              </button>
            ))}
            {pendingUnlocks.map((request) => (
              <button key={request.id} className={cls('list-card', review?.kind === 'unlock' && review.requestId === request.id && 'is-active')} type="button" onClick={() => onSelectReview({ kind: 'unlock', requestId: request.id })}>
                <strong>{`${subjectCode(request.subjectRunId)} ${ENTRY_KIND_LABELS[request.entryKind]} unlock`}</strong>
                <p>{request.note}</p>
              </button>
            ))}
            {pendingSchemes.length === 0 && pendingUnlocks.length === 0 && <EmptyState title="Queue clear" description="No HoD review items are pending right now." />}
          </div>
        </section>
        <section className="card-shell detail-panel detail-panel-wide">
          {selectedSchemeRun && selectedScheme && (
            <>
              <div className="section-heading">
                <div>
                  <h3>{`${selectedSchemeRun.code} · scheme review`}</h3>
                  <p>Read-only view of the submitted shared scheme.</p>
                </div>
                <InlineBadge tone="warning">Submitted</InlineBadge>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Label</th>
                      <th>Raw max</th>
                      <th>Normalized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScheme.components.map((component) => (
                      <tr key={component.id}>
                        <td>{component.kind}</td>
                        <td>{component.label}</td>
                        <td>{component.rawMax}</td>
                        <td>{component.normalizedWeight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the requested changes or approval note." />
              <div className="action-row">
                <button className="button button-secondary" type="button" onClick={() => onRequestSchemeChanges(selectedSchemeRun.subjectRunId, note || 'Please adjust the component balance before lock approval.')}>Request changes</button>
                <button className="button button-primary" type="button" onClick={() => onApproveScheme(selectedSchemeRun.subjectRunId, note || 'Scheme approved and locked at subject-run level.')}>Approve and lock</button>
              </div>
            </>
          )}
          {selectedUnlock && (
            <>
              <div className="section-heading">
                <div>
                  <h3>{`${subjectCode(selectedUnlock.subjectRunId)} · ${ENTRY_KIND_LABELS[selectedUnlock.entryKind]} unlock`}</h3>
                  <p>Approval reopens the same dataset across all sections of this subject-run and semester only.</p>
                </div>
                <InlineBadge tone="warning">Pending</InlineBadge>
              </div>
              <div className="info-stack">
                <strong>Request note</strong>
                <p>{selectedUnlock.note}</p>
                <strong>Requested by</strong>
                <p>{facultyName(selectedUnlock.requestedByFacultyId)}</p>
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ask for more context or add an approval note." />
              <div className="action-row">
                <button className="button button-secondary" type="button" onClick={() => onRequestUnlockChanges(selectedUnlock.id, note || 'Add more correction detail before unlock approval.')}>Return request</button>
                <button className="button button-primary" type="button" onClick={() => onApproveUnlock(selectedUnlock.id, note || 'Unlock approved across all sections for the subject-run.')}>Approve unlock</button>
              </div>
            </>
          )}
          {!selectedSchemeRun && !selectedUnlock && <EmptyState title="Choose a review item" description="Select a pending scheme approval or unlock request from the left column." />}
        </section>
      </div>
    </div>
  )
}

function FacultyDirectoryPage(props: { faculty: FacultyRecord; members: FacultyRecord[] }) {
  const { faculty, members } = props
  return (
    <div className="page-stack">
      <PageHeader title="Faculty Directory" subtitle={`Canonical ${faculty.dept} faculty roles, subject-runs, sections, and mentees all come from the same source now.`} />
      <div className="card-grid">
        {members.map((member) => (
          <article className="card-shell faculty-card" key={member.facultyId}>
            <div className="faculty-card-header">
              <div className="avatar-circle">{member.initials}</div>
              <div>
                <strong>{member.name}</strong>
                <p>{member.title}</p>
              </div>
            </div>
            <div className="chip-row">
              {member.roles.map((role) => <RoleBadge key={role} role={role} />)}
            </div>
            <dl className="meta-list">
              <div><dt>Subject-runs</dt><dd>{member.subjectRunIds.length}</dd></div>
              <div><dt>Sections</dt><dd>{member.sectionOfferingIds.length}</dd></div>
              <div><dt>Mentees</dt><dd>{member.menteeUsns.length}</dd></div>
            </dl>
            <div className="stack-list compact">
              {member.subjectRunIds.map((subjectRunId) => {
                const subjectRun = SUBJECT_RUNS.find((item) => item.subjectRunId === subjectRunId)
                return subjectRun ? <span key={subjectRunId}>{`${subjectRun.code} · Semester ${subjectRun.semester}`}</span> : null
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function MentorWorkspace(props: {
  mentees: MenteeSummary[]
  series: TaskSeries[]
  occurrences: TaskOccurrence[]
  onOpenComposer: (payload: { editingSeriesId?: string; defaultStudentUsn?: string }) => void
  onTogglePause: (seriesId: string) => void
  onEndSeries: (seriesId: string) => void
  onResolveOccurrence: (occurrenceId: string, status: TaskOccurrenceStatus) => void
}) {
  const { mentees, series, occurrences, onOpenComposer, onTogglePause, onEndSeries, onResolveOccurrence } = props
  const [selectedUsn, setSelectedUsn] = useState(mentees[0]?.usn ?? '')
  const currentUsn = mentees.some((mentee) => mentee.usn === selectedUsn) ? selectedUsn : mentees[0]?.usn ?? ''
  const selectedMentee = mentees.find((mentee) => mentee.usn === currentUsn) ?? null
  const history = selectedMentee ? getStudentHistory(selectedMentee.usn) : null
  const dueOccurrences = occurrences.filter((occurrence) => occurrence.status === 'Pending' && occurrence.dueDate <= todayIso())

  return (
    <div className="page-stack">
      <PageHeader title="Mentor workspace" subtitle="One-time and scheduled tasks now share the same composer, recurrence rules, and occurrence queue." />
      <div className="content-grid content-grid-triple">
        <section className="card-shell list-panel">
          <div className="section-heading">
            <div>
              <h3>Mentees</h3>
              <p>Select a student and create follow-up tasks.</p>
            </div>
            <button className="button button-primary" type="button" onClick={() => onOpenComposer({ defaultStudentUsn: currentUsn })}><Plus size={16} /> Add task</button>
          </div>
          <div className="list-stack">
            {mentees.map((mentee) => (
              <button key={mentee.usn} className={cls('list-card', currentUsn === mentee.usn && 'is-active')} type="button" onClick={() => setSelectedUsn(mentee.usn)}>
                <strong>{mentee.name}</strong>
                <p>{mentee.usn}</p>
                <div className="chip-row">
                  {mentee.courseRisks.slice(0, 2).map((risk) => (
                    <InlineBadge key={risk.code} tone={risk.riskBand === 'High' ? 'danger' : risk.riskBand === 'Medium' ? 'warning' : 'neutral'}>{`${risk.code} ${risk.riskBand ?? 'Open'}`}</InlineBadge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="card-shell detail-panel detail-panel-wide">
          {selectedMentee ? (
            <>
              <div className="section-heading">
                <div>
                  <h3>{selectedMentee.name}</h3>
                  <p>{`${selectedMentee.usn} · ${selectedMentee.yearLabel} · Section ${selectedMentee.section}`}</p>
                </div>
                <InlineBadge tone="neutral">{`CGPA ${selectedMentee.prevCgpa.toFixed(1)}`}</InlineBadge>
              </div>
              <div className="card-grid card-grid-compact">
                {selectedMentee.courseRisks.map((risk) => (
                  <article className="soft-card" key={risk.code}>
                    <strong>{risk.code}</strong>
                    <p>{risk.title}</p>
                    <InlineBadge tone={risk.riskBand === 'High' ? 'danger' : risk.riskBand === 'Medium' ? 'warning' : 'success'}>{risk.riskBand ?? 'No model yet'}</InlineBadge>
                  </article>
                ))}
              </div>
              <section className="subsection">
                <h4>Interventions</h4>
                <div className="stack-list compact">
                  {selectedMentee.interventions.length === 0 && <span>No interventions recorded yet.</span>}
                  {selectedMentee.interventions.map((intervention) => <span key={`${intervention.date}-${intervention.note}`}>{`${intervention.date} · ${intervention.type} · ${intervention.note}`}</span>)}
                </div>
              </section>
              {history && (
                <section className="subsection">
                  <h4>Academic history</h4>
                  <div className="stack-list compact">
                    {history.terms.map((term) => <span key={term.label}>{`${term.label} · SGPA ${term.sgpa.toFixed(2)} · ${term.highlights.join(', ')}`}</span>)}
                  </div>
                </section>
              )}
            </>
          ) : (
            <EmptyState title="No mentees mapped" description="This faculty record currently has no mentee assignments in the mock data." />
          )}
        </section>
      </div>
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>Task series</h3>
            <p>Pause, end, or edit future occurrences without changing past completions.</p>
          </div>
        </div>
        <div className="card-grid">
          {series.length === 0 && <EmptyState title="No task series yet" description="Create one-time or scheduled tasks from the mentee panel." />}
          {series.map((item) => (
            <article className="card-shell task-series-card" key={item.id}>
              <div className="section-heading">
                <div>
                  <strong>{item.title}</strong>
                  <p>{`${item.taskType} · ${item.mode === 'one-time' ? 'One-time' : recurrenceLabel(item.recurrence)}`}</p>
                </div>
                <div className="chip-row">
                  {item.paused && <InlineBadge tone="warning">Paused</InlineBadge>}
                  {item.endedAt && <InlineBadge>Ended</InlineBadge>}
                </div>
              </div>
              <p>{item.note}</p>
              <div className="stack-list compact">
                {occurrences.filter((occurrence) => occurrence.seriesId === item.id).slice(0, 4).map((occurrence) => (
                  <span key={occurrence.id}>{`${formatDate(occurrence.dueDate)}${occurrence.time ? ` at ${formatTime(occurrence.time)}` : ''} · ${occurrence.status}`}</span>
                ))}
              </div>
              <div className="action-row">
                <button className="button button-secondary" type="button" onClick={() => onOpenComposer({ editingSeriesId: item.id })}>Edit schedule</button>
                <button className="button button-secondary" type="button" onClick={() => onTogglePause(item.id)}><PauseCircle size={16} /> {item.paused ? 'Resume' : 'Pause'}</button>
                <button className="button button-ghost" type="button" onClick={() => onEndSeries(item.id)}>End recurrence</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="card-shell">
        <div className="section-heading">
          <div>
            <h3>Due occurrences</h3>
            <p>Only current due occurrences appear in the active queue.</p>
          </div>
        </div>
        <div className="list-stack">
          {dueOccurrences.length === 0 && <EmptyState title="No due occurrences" description="Future recurring items stay out of the queue until their date arrives." />}
          {dueOccurrences.map((occurrence) => {
            const seriesItem = series.find((item) => item.id === occurrence.seriesId)
            if (!seriesItem) return null
            return (
              <article className="activity-row" key={occurrence.id}>
                <div>
                  <strong>{seriesItem.title}</strong>
                  <p>{`${formatDate(occurrence.dueDate)}${occurrence.time ? ` at ${formatTime(occurrence.time)}` : ''}`}</p>
                </div>
                <div className="action-row compact-row">
                  <button className="button button-secondary" type="button" onClick={() => onResolveOccurrence(occurrence.id, 'Dismissed')}>Dismiss</button>
                  <button className="button button-primary" type="button" onClick={() => onResolveOccurrence(occurrence.id, 'Completed')}>Complete</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function QueuePage(props: {
  role: Role
  items: QueueCardItem[]
  occurrences: TaskOccurrence[]
  mentorSeriesMap: Record<string, TaskSeries>
  mentees: MenteeSummary[]
  onResolveOccurrence: (occurrenceId: string, status: TaskOccurrenceStatus) => void
}) {
  const { role, items, occurrences, mentorSeriesMap, mentees, onResolveOccurrence } = props
  return (
    <div className="page-stack">
      <PageHeader title="Action Queue" subtitle={role === 'HoD' ? 'Approvals only. HoD cannot edit schemes or marks from here.' : role === 'Mentor' ? 'Only due occurrences are active; future ones remain off-queue.' : 'Shared scheme feedback and unlock outcomes surface here for course leaders.'} />
      <section className="card-shell">
        <div className="list-stack">
          {items.length === 0 && <EmptyState title="Queue clear" description="No active items for the current role." />}
          {items.map((item) => <QueueNoticeCard key={item.id} item={item} />)}
          {role === 'Mentor' && occurrences.map((occurrence) => {
            const series = mentorSeriesMap[occurrence.seriesId]
            const mentee = mentees.find((item) => item.usn === series?.studentUsn)
            if (!series) return null
            return (
              <article className="activity-row" key={occurrence.id}>
                <div>
                  <strong>{series.title}</strong>
                  <p>{`${mentee?.name ?? series.studentUsn} · ${formatDate(occurrence.dueDate)}${occurrence.time ? ` at ${formatTime(occurrence.time)}` : ''}`}</p>
                </div>
                <div className="action-row compact-row">
                  <button className="button button-secondary" type="button" onClick={() => onResolveOccurrence(occurrence.id, 'Dismissed')}>Dismiss</button>
                  <button className="button button-primary" type="button" onClick={() => onResolveOccurrence(occurrence.id, 'Completed')}>Complete</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function TaskComposerModal(props: {
  faculty: FacultyRecord
  mentees: MenteeSummary[]
  subjectRuns: SubjectRun[]
  series: TaskSeries | null
  defaultStudentUsn?: string
  onClose: () => void
  onSubmit: (payload: TaskComposerSubmit) => void
}) {
  const { faculty, mentees, subjectRuns, series, defaultStudentUsn, onClose, onSubmit } = props
  const [studentUsn, setStudentUsn] = useState(series?.studentUsn ?? defaultStudentUsn ?? mentees[0]?.usn ?? '')
  const [subjectRunId, setSubjectRunId] = useState(series?.subjectRunId ?? subjectRuns[0]?.subjectRunId ?? '')
  const [title, setTitle] = useState(series?.title ?? 'Mentor check-in')
  const [taskType, setTaskType] = useState<TaskType>(series?.taskType ?? 'Follow-up')
  const [mode, setMode] = useState<TaskMode>(series?.mode ?? 'one-time')
  const [recurrence, setRecurrence] = useState<RecurrencePreset>(series?.recurrence ?? 'weekly')
  const [startDate, setStartDate] = useState(series?.startDate ?? todayIso())
  const [time, setTime] = useState(series?.time ?? '09:00')
  const [endDate, setEndDate] = useState(series?.endDate ?? '')
  const [customDates, setCustomDates] = useState<Array<{ date: string; time?: string }>>(series?.customDates.length ? series.customDates : [{ date: todayIso(), time: '09:00' }])
  const [note, setNote] = useState(series?.note ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      editingSeriesId: series?.id,
      studentUsn,
      subjectRunId: subjectRunId || undefined,
      title,
      taskType,
      mode,
      recurrence,
      startDate,
      time: mode === 'scheduled' && recurrence !== 'custom' ? time : mode === 'one-time' ? time : undefined,
      endDate: endDate || undefined,
      customDates,
      note,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <h3>{series ? 'Edit task series' : 'Add mentor task'}</h3>
            <p>{`${faculty.name} can schedule one-time or recurring follow-ups without the task type snapping back.`}</p>
          </div>
          <button className="button button-ghost" type="button" onClick={onClose}>Close</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="toolbar-grid">
            <div className="control-group control-group-wide">
              <label className="field-label" htmlFor="task-student">Student</label>
              <select id="task-student" value={studentUsn} onChange={(event) => setStudentUsn(event.target.value)}>
                {mentees.map((mentee) => <option key={mentee.usn} value={mentee.usn}>{mentee.name}</option>)}
              </select>
            </div>
            <div className="control-group control-group-wide">
              <label className="field-label" htmlFor="task-subject-run">Subject-run</label>
              <select id="task-subject-run" value={subjectRunId} onChange={(event) => setSubjectRunId(event.target.value)}>
                <option value="">No subject-run</option>
                {subjectRuns.map((subjectRun) => <option key={subjectRun.subjectRunId} value={subjectRun.subjectRunId}>{`${subjectRun.code} · ${subjectRun.title}`}</option>)}
              </select>
            </div>
          </div>
          <div className="toolbar-grid">
            <div className="control-group control-group-wide">
              <label className="field-label" htmlFor="task-title">Title</label>
              <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="control-group">
              <label className="field-label" htmlFor="task-type">Task type</label>
              <select id="task-type" value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>
                {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div className="segmented-control" role="tablist" aria-label="Task mode">
            <button className={cls('segmented-option', mode === 'one-time' && 'is-selected')} type="button" onClick={() => setMode('one-time')}>One-time</button>
            <button className={cls('segmented-option', mode === 'scheduled' && 'is-selected')} type="button" onClick={() => setMode('scheduled')}>Scheduled</button>
          </div>
          <div className="toolbar-grid">
            <div className="control-group">
              <label className="field-label" htmlFor="task-start-date">Start date</label>
              <input id="task-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="control-group">
              <label className="field-label" htmlFor="task-time">Time metadata</label>
              <select id="task-time" value={time} onChange={(event) => setTime(event.target.value)}>
                {timeOptions().map((option) => <option key={option} value={option}>{formatTime(option)}</option>)}
              </select>
            </div>
            {mode === 'scheduled' && recurrence !== 'custom' && (
              <div className="control-group">
                <label className="field-label" htmlFor="task-end-date">End date</label>
                <input id="task-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            )}
          </div>
          {mode === 'scheduled' && (
            <div className="control-group control-group-wide">
              <label className="field-label" htmlFor="task-recurrence">Schedule type</label>
              <select id="task-recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value as RecurrencePreset)}>
                {RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          )}
          {mode === 'scheduled' && recurrence === 'custom' && (
            <div className="list-stack">
              {customDates.map((item, index) => (
                <div className="toolbar-grid" key={`${item.date}-${index}`}>
                  <div className="control-group">
                    <label className="field-label">Custom date</label>
                    <input type="date" value={item.date} onChange={(event) => setCustomDates(customDates.map((entry, entryIndex) => entryIndex === index ? { ...entry, date: event.target.value } : entry))} />
                  </div>
                  <div className="control-group">
                    <label className="field-label">Time metadata</label>
                    <select value={item.time ?? '09:00'} onChange={(event) => setCustomDates(customDates.map((entry, entryIndex) => entryIndex === index ? { ...entry, time: event.target.value } : entry))}>
                      {timeOptions().map((option) => <option key={option} value={option}>{formatTime(option)}</option>)}
                    </select>
                  </div>
                  <div className="control-group control-group-action">
                    <button className="button button-ghost" type="button" disabled={customDates.length === 1} onClick={() => setCustomDates(customDates.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>
                </div>
              ))}
              <button className="button button-secondary" type="button" onClick={() => setCustomDates([...customDates, { date: addDays(todayIso(), customDates.length + 1), time: '09:00' }])}><Plus size={16} /> Add custom date</button>
            </div>
          )}
          <label className="field-label" htmlFor="task-note">Notes</label>
          <textarea id="task-note" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="action-row">
            <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit">{series ? 'Save schedule' : 'Create task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">AirMentor</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  )
}

function Banner({ tone, title, description }: { tone: BannerTone; title: string; description: string }) {
  return (
    <section className={cls('banner', `banner-${tone}`)}>
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  )
}

function QueueNoticeCard({ item }: { item: QueueCardItem }) {
  return (
    <article className={cls('queue-card', `tone-${item.tone}`)}>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
        <span className="helper-text">{item.meta}</span>
      </div>
      {item.onAction && item.actionLabel && <button className="button button-secondary" type="button" onClick={item.onAction}>{item.actionLabel}</button>}
    </article>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <CheckCircle2 size={20} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  return <span className={cls('role-badge', roleClass(role))}>{role}</span>
}

function InlineBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BannerTone }) {
  return <span className={cls('inline-badge', `tone-${tone}`)}>{children}</span>
}

function usePersistentState<T>(key: string, factory: () => T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : factory()
    } catch {
      return factory()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore storage failures in the mock
    }
  }, [key, state])
  return [state, setState] as const
}

function pagesForRole(role: Role): PageId[] {
  return role === 'HoD'
    ? ['overview', 'reviews', 'faculty', 'queue']
    : role === 'Mentor'
      ? ['overview', 'mentees', 'queue']
      : ['overview', 'data-hub', 'scheme', 'blueprint', 'queue']
}

function roleClass(role: Role): string {
  return role === 'HoD' ? 'role-hod' : role === 'Mentor' ? 'role-mentor' : 'role-course-leader'
}

function sameReview(left: ReviewSelection, right: ReviewSelection): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'scheme' && right.kind === 'scheme') {
    return left.subjectRunId === right.subjectRunId
  }
  if (left.kind === 'unlock' && right.kind === 'unlock') {
    return left.requestId === right.requestId
  }
  return false
}

function schemeBanner(scheme: SchemeRuntimeState, blueprint: BlueprintRuntimeState | null) {
  if (scheme.status === 'Draft') {
    return { tone: 'warning' as const, title: 'Open scheme', description: 'Evaluation scheme is not locked in yet. Marks entry stays blocked until HoD approval.' }
  }
  if (scheme.status === 'Submitted') {
    return { tone: 'warning' as const, title: 'Awaiting HoD review', description: 'The shared draft is submitted and read-only until HoD returns or approves it.' }
  }
  if (scheme.status === 'Changes Requested') {
    return { tone: 'danger' as const, title: 'HoD requested changes', description: latestSchemeNote(scheme) }
  }
  if (scheme.status === 'Approved') {
    return { tone: 'success' as const, title: 'Approved and locked', description: blueprint?.status === 'Published' ? 'Blueprint already published. The subject-run is now effectively frozen.' : 'Marks entry is allowed. Publishing the TT blueprint or starting marks entry will freeze the scheme.' }
  }
  return { tone: 'neutral' as const, title: 'Frozen', description: blueprint?.status === 'Published' ? 'TT blueprint published. The evaluation scheme is immutable.' : 'Marks activity has already started. The evaluation scheme can no longer change.' }
}

function validateScheme(components: SchemeComponentRow[]): SchemeValidation {
  const totalNormalized = components.reduce((sum, component) => sum + component.normalizedWeight, 0)
  const quizCount = components.filter((component) => component.kind === 'quiz').length
  const assignmentCount = components.filter((component) => component.kind === 'assignment').length
  const messages: string[] = []
  if (components.length === 0) messages.push('Add at least one component.')
  if (totalNormalized !== 30) messages.push('Normalized weight must total exactly 30.')
  if (quizCount > 2) messages.push('At most two quizzes are allowed in v1.')
  if (assignmentCount > 2) messages.push('At most two assignments are allowed in v1.')
  return { totalNormalized, quizCount, assignmentCount, isValid: messages.length === 0, messages: messages.length ? messages : ['Validation passed.'] }
}

function makeSchemeHistory(input: { actorFacultyId: string; actorRole: Role; action: string; note: string }): SchemeHistoryEntry {
  return { id: uid('history'), at: Date.now(), actorFacultyId: input.actorFacultyId, actorRole: input.actorRole, action: input.action, note: input.note }
}

function baseMark(student: Student, offering: OfferingSection, subjectRun: SubjectRun, entryKind: EntryKind): number | null {
  if (entryKind === 'tt1') return student.tt1Score
  if (entryKind === 'tt2') return student.tt2Score
  if (entryKind === 'quiz') return [student.quiz1, student.quiz2].filter((value): value is number => value !== null).reduce((sum, value) => sum + value, 0)
  if (entryKind === 'assignment') return [student.assignment1, student.assignment2].filter((value): value is number => value !== null).reduce((sum, value) => sum + value, 0)
  if (entryKind === 'attendance') return Math.round((student.present / student.totalClasses) * 100)
  return offering.stageInfo.stage >= 3 ? Math.round(subjectRun.seeRawMax * 0.68) : null
}

function maxForEntryKind(subjectRun: SubjectRun, scheme: SchemeRuntimeState, entryKind: EntryKind): number {
  if (entryKind === 'tt1' || entryKind === 'tt2') return 25
  if (entryKind === 'attendance') return 100
  if (entryKind === 'finals') return subjectRun.seeRawMax
  if (entryKind === 'quiz') return scheme.components.filter((component) => component.kind === 'quiz').reduce((sum, component) => sum + component.rawMax, 0) || 20
  return scheme.components.filter((component) => component.kind === 'assignment').reduce((sum, component) => sum + component.rawMax, 0) || 30
}

function buildInitialSchemeStates(): Record<string, SchemeRuntimeState> {
  const base = Date.now() - SUBJECT_RUNS.length * 86_400_000
  return Object.fromEntries(
    SUBJECT_RUNS.map((subjectRun, index) => {
      const courseLeaderId = subjectRun.courseLeaderFacultyIds[0]
      const hodId = FACULTY.find((faculty) => faculty.dept === subjectRun.dept && faculty.roles.includes('HoD'))?.facultyId ?? FACULTY[0].facultyId
      const createdAt = base + index * 86_400_000
      const history: SchemeHistoryEntry[] = [
        { id: uid('history'), at: createdAt, actorFacultyId: courseLeaderId, actorRole: 'Course Leader' as const, action: 'Draft created', note: 'Initial shared scheme draft created for the subject-run.' },
      ]
      if (subjectRun.initialSchemeStatus !== 'Draft') {
        history.push({ id: uid('history'), at: createdAt + 3_600_000, actorFacultyId: courseLeaderId, actorRole: 'Course Leader' as const, action: 'Submitted to HoD', note: 'Shared scheme draft sent for HoD review.' })
      }
      if (subjectRun.initialSchemeStatus === 'Changes Requested') {
        history.push({ id: uid('history'), at: createdAt + 7_200_000, actorFacultyId: hodId, actorRole: 'HoD' as const, action: 'Changes requested', note: 'Rebalance the component spread before approval.' })
      }
      if (subjectRun.initialSchemeStatus === 'Approved' || subjectRun.initialSchemeStatus === 'Frozen') {
        history.push({ id: uid('history'), at: createdAt + 7_200_000, actorFacultyId: hodId, actorRole: 'HoD' as const, action: 'Approved & Locked', note: 'Scheme approved and locked at subject-run level.' })
      }
      if (subjectRun.initialSchemeStatus === 'Frozen') {
        history.push({ id: uid('history'), at: createdAt + 10_800_000, actorFacultyId: courseLeaderId, actorRole: 'Course Leader' as const, action: 'Frozen', note: 'TT blueprint publish or marks activity already started.' })
      }
      return [
        subjectRun.subjectRunId,
        {
          subjectRunId: subjectRun.subjectRunId,
          status: subjectRun.initialSchemeStatus,
          components: subjectRun.componentSeeds.map((component) => ({ ...component })),
          lastEditedByFacultyId: courseLeaderId,
          lastEditedAt: createdAt + 3_600_000,
          history,
        },
      ]
    }),
  )
}

function buildInitialBlueprintStates(): Record<string, BlueprintRuntimeState> {
  const base = Date.now() - SUBJECT_RUNS.length * 43_200_000
  return Object.fromEntries(
    SUBJECT_RUNS.map((subjectRun, index) => {
      const courseLeaderId = subjectRun.courseLeaderFacultyIds[0]
      const published = subjectRun.initialSchemeStatus === 'Frozen'
      return [
        subjectRun.subjectRunId,
        {
          subjectRunId: subjectRun.subjectRunId,
          status: published ? 'Published' : 'Draft',
          updatedByFacultyId: courseLeaderId,
          updatedAt: base + index * 43_200_000,
          publishedByFacultyId: published ? courseLeaderId : undefined,
          publishedAt: published ? base + index * 43_200_000 + 1_800_000 : undefined,
          questions: cloneBlueprint(getDefaultBlueprintQuestions(subjectRun.code)),
        },
      ]
    }),
  )
}

function buildInitialSectionLocks(): SectionLockMap {
  return Object.fromEntries(
    OFFERINGS.map((offering) => {
      const subjectRun = SUBJECT_RUNS.find((item) => item.subjectRunId === offering.subjectRunId)
      return [offering.offId, Object.fromEntries(ENTRY_KINDS.map((kind) => [kind, subjectRun?.initialLockedKinds.includes(kind) ?? false])) as Record<EntryKind, boolean>]
    }),
  )
}

function buildInitialUnlockRequests(): UnlockRequest[] {
  const now = Date.now()
  const requests: UnlockRequest[] = []
  const cs401 = SUBJECT_RUNS.find((subjectRun) => subjectRun.code === 'CS401')
  const cs702 = SUBJECT_RUNS.find((subjectRun) => subjectRun.code === 'CS702')
  if (cs401) {
    requests.push({
      id: 'unlock-seed-cs401',
      subjectRunId: cs401.subjectRunId,
      entryKind: 'quiz',
      status: 'Pending',
      requestedByFacultyId: 't7',
      requestedAt: now - 7_200_000,
      note: 'Quiz moderation corrections are ready. Reopen quiz entry across all sections for the same semester.',
    })
  }
  if (cs702) {
    requests.push({
      id: 'unlock-seed-cs702',
      subjectRunId: cs702.subjectRunId,
      entryKind: 'assignment',
      status: 'Changes Requested',
      requestedByFacultyId: 't4',
      requestedAt: now - 18_000_000,
      note: 'Need to reopen assignment entry after rubric update.',
      reviewedByFacultyId: 't1',
      reviewedAt: now - 14_400_000,
      reviewNote: 'Attach evidence summary before the unlock can be approved.',
    })
  }
  return requests
}

function buildInitialTaskState(): TaskState {
  const today = todayIso()
  const series: TaskSeries[] = [
    { id: 'series-aarav', ownerFacultyId: 't1', studentUsn: '1MS23CS001', subjectRunId: 'sr-cs401-sem4-2025', title: 'Algorithm recovery check-in', taskType: 'Remedial', mode: 'scheduled', recurrence: 'weekly', startDate: addDays(today, -7), time: '09:30', customDates: [], note: 'Review practice sheet completion and TT recovery pacing.', paused: false },
    { id: 'series-meera', ownerFacultyId: 't8', studentUsn: '1MS23CS041', subjectRunId: 'sr-cs403-sem4-2025', title: 'OS lab follow-up', taskType: 'Follow-up', mode: 'scheduled', recurrence: 'custom', startDate: today, customDates: [{ date: today, time: '11:00' }, { date: addDays(today, 7), time: '11:00' }, { date: addDays(today, 14), time: '15:00' }], note: 'Keep lab evidence and mentor notes in sync.', paused: false },
    { id: 'series-ishita', ownerFacultyId: 't1', studentUsn: '1MS23CS019', title: 'Attendance recovery call', taskType: 'Attendance', mode: 'one-time', recurrence: 'custom', startDate: today, time: '16:00', customDates: [], note: 'Confirm attendance documents and next milestones.', paused: false },
  ]
  const occurrences = series.flatMap((seriesItem) => generateOccurrences(seriesItem, 10)).map((occurrence) => occurrence.seriesId === 'series-aarav' && occurrence.dueDate < today ? { ...occurrence, status: 'Completed' as const, resolvedAt: Date.now() - 3_600_000 } : occurrence)
  return { series, occurrences }
}

function upsertTaskState(previous: TaskState, ownerFacultyId: string, payload: TaskComposerSubmit): TaskState {
  const seriesId = payload.editingSeriesId ?? uid('series')
  const nextSeries: TaskSeries = {
    id: seriesId,
    ownerFacultyId,
    studentUsn: payload.studentUsn,
    subjectRunId: payload.subjectRunId,
    title: payload.title,
    taskType: payload.taskType,
    mode: payload.mode,
    recurrence: payload.mode === 'one-time' ? 'custom' : payload.recurrence,
    startDate: payload.startDate,
    time: payload.time,
    endDate: payload.endDate,
    customDates: payload.customDates,
    note: payload.note,
    paused: payload.editingSeriesId ? previous.series.find((series) => series.id === payload.editingSeriesId)?.paused ?? false : false,
    endedAt: previous.series.find((series) => series.id === payload.editingSeriesId)?.endedAt,
  }
  const nextSeriesList = payload.editingSeriesId ? previous.series.map((series) => series.id === payload.editingSeriesId ? nextSeries : series) : [...previous.series, nextSeries]
  const generated = generateOccurrences(nextSeries, 10)
  const cutoff = todayIso()
  const preserved = previous.occurrences.filter((occurrence) => occurrence.seriesId !== seriesId || occurrence.status !== 'Pending' || occurrence.dueDate <= cutoff)
  const futureGenerated = generated.filter((occurrence) => occurrence.dueDate > cutoff || payload.editingSeriesId === undefined)
  return {
    series: nextSeriesList,
    occurrences: [...preserved.filter((occurrence) => occurrence.seriesId !== seriesId), ...preserved.filter((occurrence) => occurrence.seriesId === seriesId), ...futureGenerated],
  }
}

function generateOccurrences(series: TaskSeries, limit: number): TaskOccurrence[] {
  if (series.mode === 'one-time') {
    return [{ id: uid('occurrence'), seriesId: series.id, dueDate: series.startDate, time: series.time, status: 'Pending' }]
  }
  if (series.recurrence === 'custom') {
    return [...series.customDates].sort((left, right) => left.date.localeCompare(right.date)).map((item) => ({ id: uid('occurrence'), seriesId: series.id, dueDate: item.date, time: item.time, status: 'Pending' as const }))
  }
  const occurrences: TaskOccurrence[] = []
  let cursor = series.startDate
  while (occurrences.length < limit) {
    if (series.endDate && cursor > series.endDate) break
    if (series.recurrence === 'weekdays' && isWeekend(cursor)) {
      cursor = addDays(cursor, 1)
      continue
    }
    occurrences.push({ id: uid('occurrence'), seriesId: series.id, dueDate: cursor, time: series.time, status: 'Pending' })
    cursor = series.recurrence === 'daily' ? addDays(cursor, 1) : series.recurrence === 'weekly' ? addDays(cursor, 7) : series.recurrence === 'monthly' ? addMonths(cursor, 1) : addDays(cursor, 1)
  }
  return occurrences
}

function cloneBlueprint(seeds: BlueprintQuestionSeed[]): BlueprintQuestion[] {
  return seeds.map((seed) => ({ id: seed.id, text: seed.text, parts: seed.parts.map((part) => ({ id: part.id, text: part.text, maxMarks: part.maxMarks })) }))
}

function facultyName(facultyId: string): string {
  return getFacultyById(facultyId)?.name ?? facultyId
}

function subjectCode(subjectRunId: string): string {
  return SUBJECT_RUNS.find((subjectRun) => subjectRun.subjectRunId === subjectRunId)?.code ?? subjectRunId
}

function latestSchemeNote(scheme: SchemeRuntimeState): string {
  return scheme.history[scheme.history.length - 1]?.note ?? 'Open the scheme to review the latest note.'
}

function cls(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(' ')
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function todayIso(): string {
  return formatIsoDate(new Date())
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function addDays(value: string, amount: number): string {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatIsoDate(date)
}

function addMonths(value: string, amount: number): string {
  const date = parseIsoDate(value)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return formatIsoDate(date)
}

function isWeekend(value: string): boolean {
  const day = parseIsoDate(value).getUTCDay()
  return day === 0 || day === 6
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseIsoDate(value))
}

function formatStamp(value: number): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)))
}

function recurrenceLabel(value: RecurrencePreset): string {
  return RECURRENCE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function timeOptions(): string[] {
  const items: string[] = []
  for (let hour = 8; hour <= 18; hour += 1) {
    items.push(`${String(hour).padStart(2, '0')}:00`)
    if (hour !== 18) items.push(`${String(hour).padStart(2, '0')}:30`)
  }
  return items
}

export default App
