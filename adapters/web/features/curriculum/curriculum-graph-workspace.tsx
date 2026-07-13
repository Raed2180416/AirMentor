import { useCallback, useEffect, useMemo, useState } from 'react'
import ObsidianGraph, { type GraphNode, type GraphEdge } from '@web/shared/components/obsidian-graph'
import { Btn, Card, Chip, withAlpha } from '@web/shared/ui/primitives'
import { T } from '@web/simulation/fixtures'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { ApiCurriculumGraphBundle, ApiGraphNode, ApiGraphEdge } from '@web/shared/api/types'
import { Loader2, Undo2, Redo2, AlertTriangle, Info, Sparkles } from 'lucide-react'

type Props = {
  batchId: string
  apiClient: AirMentorApiClient
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)airmentor_csrf=([^;]*)/)
  return match ? match[1] : ''
}

function computeMLFeatures(nodes: ApiGraphNode[], edges: ApiGraphEdge[]): Map<string, Record<string, string | number>> {
  const featureMap = new Map<string, Record<string, string | number>>()
  const nodeById = new Map(nodes.map(n => [n.draftNodeId, n]))
  const prereqOf = new Map<string, string[]>()
  const dependsOn = new Map<string, string[]>()
  for (const n of nodes) {
    prereqOf.set(n.draftNodeId, [])
    dependsOn.set(n.draftNodeId, [])
  }
  for (const e of edges) {
    if (e.edgeKind === 'explicit' || e.edgeKind === 'added') {
      prereqOf.get(e.sourceDraftNodeId)?.push(e.targetDraftNodeId)
      dependsOn.get(e.targetDraftNodeId)?.push(e.sourceDraftNodeId)
    }
  }
  for (const node of nodes) {
    const visited = new Set<string>()
    const queue: Array<{ id: string; depth: number }> = [{ id: node.draftNodeId, depth: 0 }]
    let maxDepth = 0
    while (queue.length > 0) {
      const curr = queue.shift()!
      if (visited.has(curr.id)) continue
      visited.add(curr.id)
      maxDepth = Math.max(maxDepth, curr.depth)
      for (const prereq of dependsOn.get(curr.id) ?? []) {
        if (!visited.has(prereq)) queue.push({ id: prereq, depth: curr.depth + 1 })
      }
    }
    const downVisited = new Set<string>()
    const downQueue = [node.draftNodeId]
    let downstreamCount = 0
    while (downQueue.length > 0) {
      const curr = downQueue.shift()!
      if (downVisited.has(curr)) continue
      downVisited.add(curr)
      if (curr !== node.draftNodeId) downstreamCount++
      for (const target of prereqOf.get(curr) ?? []) {
        if (!downVisited.has(target)) downQueue.push(target)
      }
    }
    let weakChainCount = 0
    for (const prereq of dependsOn.get(node.draftNodeId) ?? []) {
      const prereqNode = nodeById.get(prereq)
      if (prereqNode && prereqNode.outcomes.length === 0) weakChainCount++
    }
    featureMap.set(node.draftNodeId, {
      'Chain Depth': maxDepth,
      'Downstream Load': downstreamCount,
      'Weak Chains': weakChainCount,
      'Prereq Count': dependsOn.get(node.draftNodeId)?.length ?? 0,
      'Credits': node.credits,
      'Outcomes': node.outcomes.length,
    })
  }
  return featureMap
}

function apiNodesToGraphNodes(nodes: ApiGraphNode[]): GraphNode[] {
  return nodes.map(n => ({
    id: n.draftNodeId,
    kind: 'course' as const,
    code: n.courseCode,
    label: `${n.title} \u00b7 Sem ${n.semesterNumber} \u00b7 ${n.credits}cr`,
    semesterNumber: n.semesterNumber,
    x: n.positionX || Math.random() * 600,
    y: n.positionY || Math.random() * 400,
  }))
}

function mapEdgeKind(backendKind: string): GraphEdge['kind'] {
  switch (backendKind) {
    case 'explicit':
    case 'added':
      return 'prerequisite'
    case 'corequisite':
    case 'cross_semester':
      return 'parent-child'
    default:
      return 'prerequisite'
  }
}

function apiEdgesToGraphEdges(edges: ApiGraphEdge[]): GraphEdge[] {
  return edges.map(e => ({
    id: e.draftEdgeId,
    source: e.sourceDraftNodeId,
    target: e.targetDraftNodeId,
    kind: mapEdgeKind(e.edgeKind),
    weight: e.weight,
  }))
}

export default function CurriculumGraphWorkspace({ batchId, apiClient }: Props) {
  const [bundle, setBundle] = useState<ApiCurriculumGraphBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [mlOverlay, setMlOverlay] = useState<{ nodeId: string; features: Record<string, string | number> } | null>(null)
  const [showValidation, setShowValidation] = useState(false)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.getCurriculumGraph(batchId)
      setBundle(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load curriculum graph')
    } finally {
      setLoading(false)
    }
  }, [batchId, apiClient])

  useEffect(() => { void loadGraph() }, [loadGraph])

  const graphNodes = useMemo(() => bundle ? apiNodesToGraphNodes(bundle.nodes) : [], [bundle])
  const graphEdges = useMemo(() => bundle ? apiEdgesToGraphEdges(bundle.edges) : [], [bundle])
  const mlFeatures = useMemo(() => bundle ? computeMLFeatures(bundle.nodes, bundle.edges) : new Map(), [bundle])

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId)
    if (nodeId && mlFeatures.has(nodeId)) {
      setMlOverlay({ nodeId, features: mlFeatures.get(nodeId)! })
    } else {
      setMlOverlay(null)
    }
  }, [mlFeatures])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(prev => prev === nodeId ? null : nodeId)
  }, [])

  const flash = useCallback((msg: string) => {
    setFlashMessage(msg)
    setTimeout(() => setFlashMessage(null), 4000)
  }, [])

  const handleUndo = useCallback(async () => {
    if (!bundle?.history.canUndo) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/batches/${batchId}/curriculum-graph/undo`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-airmentor-csrf': getCsrfToken() },
      })
      if (!res.ok) throw new Error('Undo failed')
      await loadGraph()
      flash('Undo applied')
    } catch (err) {
      flash(`Undo failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally { setSaving(false) }
  }, [batchId, loadGraph, flash, bundle])

  const handleRedo = useCallback(async () => {
    if (!bundle?.history.canRedo) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/batches/${batchId}/curriculum-graph/redo`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-airmentor-csrf': getCsrfToken() },
      })
      if (!res.ok) throw new Error('Redo failed')
      await loadGraph()
      flash('Redo applied')
    } catch (err) {
      flash(`Redo failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally { setSaving(false) }
  }, [batchId, loadGraph, flash, bundle])

  const handlePublish = useCallback(async () => {
    if (!bundle) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/admin/batches/${batchId}/curriculum-graph/publish`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-airmentor-csrf': getCsrfToken() },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? 'Publish failed')
      }
      await loadGraph()
      flash('Graph published \u2014 ML simulation queued')
    } catch (err) {
      flash(`Publish failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally { setPublishing(false) }
  }, [batchId, loadGraph, flash, bundle])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12, color: T.muted }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        Loading curriculum graph...
      </div>
    )
  }

  if (error) {
    return (
      <Card style={{ padding: 24, textAlign: 'center' }}>
        <AlertTriangle size={24} style={{ color: T.warning, marginBottom: 8 }} />
        <div style={{ color: T.dim, marginBottom: 12 }}>{error}</div>
        <Btn onClick={loadGraph}>Retry</Btn>
      </Card>
    )
  }

  if (!bundle || bundle.nodes.length === 0) {
    return (
      <Card style={{ padding: 24, textAlign: 'center' }}>
        <Info size={24} style={{ color: T.muted, marginBottom: 8 }} />
        <div style={{ color: T.dim, marginBottom: 12 }}>
          No curriculum graph data available for this batch.
          Bootstrap the curriculum first from the structure tab.
        </div>
      </Card>
    )
  }

  const validation = bundle.validation
  const hasErrors = validation.errors.length > 0
  const hasWarnings = validation.warnings.length > 0

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip color={bundle.draftStatus === 'draft' ? T.accent : T.dim}>
          {bundle.draftStatus === 'draft' ? 'Draft' : 'Published'}
        </Chip>
        {hasErrors && (
          <button
            onClick={() => setShowValidation(v => !v)}
            style={{
              background: withAlpha(T.danger, '15'), color: T.danger,
              border: `1px solid ${withAlpha(T.danger, '40')}`, borderRadius: 6,
              padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <AlertTriangle size={12} /> {validation.errors.length} errors
          </button>
        )}
        {hasWarnings && (
          <button
            onClick={() => setShowValidation(v => !v)}
            style={{
              background: withAlpha(T.warning, '15'), color: T.warning,
              border: `1px solid ${withAlpha(T.warning, '40')}`, borderRadius: 6,
              padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Info size={12} /> {validation.warnings.length} warnings
          </button>
        )}
        {!hasErrors && !hasWarnings && <Chip color={T.success}>Valid</Chip>}
        <div style={{ flex: 1 }} />
        <Btn
          onClick={handleUndo}
          disabled={!bundle.history.canUndo || saving}
          title="Undo last change"
        >
          <Undo2 size={14} />
        </Btn>
        <Btn
          onClick={handleRedo}
          disabled={!bundle.history.canRedo || saving}
          title="Redo last undo"
        >
          <Redo2 size={14} />
        </Btn>
        <Btn
          onClick={handlePublish}
          disabled={publishing || hasErrors || bundle.draftStatus !== 'draft'}
          style={{ background: hasErrors ? undefined : T.accent, color: hasErrors ? undefined : '#fff' }}
        >
          <Sparkles size={14} style={{ marginRight: 4 }} />
          {publishing ? 'Publishing...' : 'Publish'}
        </Btn>
      </div>

      {/* Flash message */}
      {flashMessage && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, fontSize: 12,
          background: withAlpha(T.accent, '20'), color: T.accent,
        }}>
          {flashMessage}
        </div>
      )}

      {/* Graph canvas */}
      <Card style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: 500 }}>
        <ObsidianGraph
          nodes={graphNodes}
          edges={graphEdges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={null}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onEdgeClick={() => {}}
        />

        {/* ML Feature i-dot overlay */}
        {mlOverlay && hoveredNodeId && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: T.surface2, borderRadius: 8, padding: '10px 14px',
            border: `1px solid ${withAlpha(T.muted, '26')}`,
            fontSize: 11, minWidth: 160, boxShadow: `0 4px 16px rgba(0,0,0,0.12)`,
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              ML Features
            </div>
            {Object.entries(mlOverlay.features).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: T.muted }}>
                <span>{key}</span>
                <span style={{ color: T.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Validation popup */}
        {showValidation && (hasErrors || hasWarnings) && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 20,
            maxWidth: 360, maxHeight: 220, overflowY: 'auto',
            background: T.surface2, borderRadius: 8, padding: '10px 12px',
            border: `1px solid ${withAlpha(T.muted, '20')}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.15)`,
            display: 'grid', gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validation</span>
              <button onClick={() => setShowValidation(false)} style={{ background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            {validation.errors.map((err, i) => (
              <div key={`e${i}`} style={{
                padding: '5px 8px', borderRadius: 5, fontSize: 11,
                background: withAlpha(T.danger, '12'), color: T.danger,
                border: `1px solid ${withAlpha(T.danger, '25')}`,
              }}>
                {err}
              </div>
            ))}
            {validation.warnings.map((warn, i) => (
              <div key={`w${i}`} style={{
                padding: '5px 8px', borderRadius: 5, fontSize: 11,
                background: withAlpha(T.warning, '12'), color: T.warning,
                border: `1px solid ${withAlpha(T.warning, '25')}`,
              }}>
                {warn}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
