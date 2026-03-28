import type { ReactNode, RefObject } from 'react'
import { T, mono, sora } from './data'
import { EmptyState, RestoreBanner, SectionHeading } from './system-admin-ui'
import { Card, Chip } from './ui-primitives'

type RestoreNotice = { tone: 'neutral' | 'error'; message: string } | null

type SystemAdminHierarchyWorkspaceShellProps = {
  toneColor: string
  restoreNotice: RestoreNotice
  onResetRestore: () => void
  selectorControls: ReactNode
  selectorHelperText: ReactNode
  workspaceColumns: string
  entityRailTitle: string
  entityRailHelper: string
  entityRailCount: number
  entityRailItems: ReactNode
  entityRailEmptyTitle: string
  entityRailEmptyBody: string
  entityRailCreateForm?: ReactNode
  workspacePaneRef?: RefObject<HTMLDivElement | null>
  stickyShadow: string
  workspaceLabel: string
  workspaceHelperText: string
  workspaceMeta?: ReactNode
  tabActions: ReactNode
  overviewNavigator?: ReactNode
  yearEditors?: ReactNode
  children: ReactNode
}

export function SystemAdminHierarchyWorkspaceShell({
  toneColor,
  restoreNotice,
  onResetRestore,
  selectorControls,
  selectorHelperText,
  workspaceColumns,
  entityRailTitle,
  entityRailHelper,
  entityRailCount,
  entityRailItems,
  entityRailEmptyTitle,
  entityRailEmptyBody,
  entityRailCreateForm,
  workspacePaneRef,
  stickyShadow,
  workspaceLabel,
  workspaceHelperText,
  workspaceMeta,
  tabActions,
  overviewNavigator,
  yearEditors,
  children,
}: SystemAdminHierarchyWorkspaceShellProps) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionHeading
        title="University"
        eyebrow="Hierarchy Control"
        caption="Selector-driven control for academic faculty, department, branch, year, section, policy, and semester-wise course setup."
        toneColor={toneColor}
      />

      {restoreNotice ? (
        <RestoreBanner
          tone={restoreNotice.tone}
          title={restoreNotice.tone === 'error' ? 'Faculties workspace restore failed' : 'Faculties workspace restored'}
          message={restoreNotice.message}
          actionLabel="Reset workspace"
          onAction={onResetRestore}
        />
      ) : null}

      <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
        {selectorControls}
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          {selectorHelperText}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: workspaceColumns, gap: 16 }}>
        <Card style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Entity Rail</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text, marginTop: 6 }}>{entityRailTitle}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>{entityRailHelper}</div>
            </div>
            <Chip color={T.accent}>{entityRailCount}</Chip>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {entityRailCount === 0
              ? <EmptyState title={entityRailEmptyTitle} body={entityRailEmptyBody} />
              : entityRailItems}
          </div>

          {entityRailCreateForm}
        </Card>

        <div ref={workspacePaneRef} style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Card style={{ padding: 16, display: 'grid', gap: 14, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, position: 'sticky', top: 0, zIndex: 4, boxShadow: stickyShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subpanel</div>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text, marginTop: 6 }}>{workspaceLabel}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                  {workspaceHelperText}
                </div>
              </div>
              {workspaceMeta ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{workspaceMeta}</div> : null}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tabActions}
            </div>
          </Card>

          {overviewNavigator}
          {yearEditors}
          {children}
        </div>
      </div>
    </div>
  )
}
