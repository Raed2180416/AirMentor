import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import type { EditingEdge, GraphEdge, GraphNode, Props } from "./obsidian-graph-parts/types"
import { applyVisibility, getThemeColors } from "./obsidian-graph-parts/helpers"
import { renderGraph } from "./obsidian-graph-parts/render"
import { buildSimulation, buildZoom } from "./obsidian-graph-parts/simulation"
import { createGraphInteractions } from "./obsidian-graph-parts/interactions"

export type { GraphNodeKind, GraphEdgeKind, GraphNode, GraphEdge } from "./obsidian-graph-parts/types"

export default function ObsidianGraph({
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  onEdgeCreate,
  onEdgeDelete,
  onEdgeWeightChange,
  selectedNodeId,
  selectedEdgeId,
  themeMode = "dark",
  layoutKey = 0,
  showWeights = true,
}: Props) {
  const colors = useMemo(() => getThemeColors(themeMode), [themeMode])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const hoverTimerRef = useRef<number | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)
  const hoverAnimRef = useRef({ value: 0, target: 0 })
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeHoverRef = useRef(onNodeHover)
  const onEdgeClickRef = useRef(onEdgeClick)
  const onEdgeCreateRef = useRef(onEdgeCreate)
  const onEdgeDeleteRef = useRef(onEdgeDelete)
  const onEdgeWeightChangeRef = useRef(onEdgeWeightChange)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [editingEdge, setEditingEdge] = useState<EditingEdge | null>(null)
  const dimsRef = useRef(dims)
  const dpr = useMemo(() => typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1, [])
  const dragNodeRef = useRef<GraphNode | null>(null)
  const dragGroupRef = useRef<Map<string, { ox: number; oy: number }> | null>(null)
  const wasDraggedRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const pinnedRef = useRef(false)
  const prevLayoutKeyRef = useRef(layoutKey)
  const edgeDrawStartRef = useRef<string | null>(null)
  const edgeDrawCursorRef = useRef<{ x: number; y: number } | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)

  const mutableNodesRef = useRef<GraphNode[]>([])
  const mutableEdgesRef = useRef<GraphEdge[]>([])

  const W = dims.w
  const H = dims.h

  useEffect(() => {
    dimsRef.current = dims
  }, [dims])

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
    onNodeHoverRef.current = onNodeHover
    onEdgeClickRef.current = onEdgeClick
    onEdgeCreateRef.current = onEdgeCreate
    onEdgeDeleteRef.current = onEdgeDelete
    onEdgeWeightChangeRef.current = onEdgeWeightChange
    selectedNodeIdRef.current = selectedNodeId ?? null
  }, [
    onNodeClick,
    onNodeHover,
    onEdgeClick,
    onEdgeCreate,
    onEdgeDelete,
    onEdgeWeightChange,
    selectedNodeId,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setDims({ w: rect.width || 800, h: rect.height || 600 })
    }
    measure()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(([entry]) => {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        setDims({ w: w || 800, h: h || 600 })
      })
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      if (ro) ro.disconnect()
      else window.removeEventListener("resize", measure)
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const t = transformRef.current
    const sim = simRef.current
    if (!sim) return

    renderGraph({
      ctx,
      canvas,
      t,
      sim,
      dims: dimsRef.current,
      hoverAnim: hoverAnimRef.current,
      edgeDrawStart: edgeDrawStartRef.current,
      edgeDrawCursor: edgeDrawCursorRef.current,
      colors,
      dpr,
      showWeights,
    })
  }, [colors, dpr, showWeights])

  useEffect(() => {
    const existing = mutableNodesRef.current
    const existingMap = new Map(existing.map(n => [n.id, n]))
    const merged: GraphNode[] = []
    for (const n of nodes) {
      const old = existingMap.get(n.id)
      if (old) {
        old.label = n.label
        old.code = n.code
        old.kind = n.kind
        old.semesterNumber = n.semesterNumber
        old.parentSemesterId = n.parentSemesterId
        old.parentCourseId = n.parentCourseId
        old.bloomLevel = n.bloomLevel
        old.masteryTarget = n.masteryTarget
        old.isExpanded = n.isExpanded ?? old.isExpanded
        merged.push(old)
      } else {
        merged.push({ ...n, isExpanded: n.isExpanded ?? false })
      }
    }
    mutableNodesRef.current = merged
    mutableEdgesRef.current = edges.map(e => ({ ...e }))
    applyVisibility(merged)

    const sim = simRef.current
    if (sim) {
      sim.nodes(merged)
      const linkForce = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
      if (linkForce) linkForce.links(mutableEdgesRef.current)
      if (!pinnedRef.current) sim.alpha(0.3).restart()
    }
    draw()
  }, [nodes, edges, draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const layoutKeyChanged = prevLayoutKeyRef.current !== layoutKey
    prevLayoutKeyRef.current = layoutKey
    const cn = mutableNodesRef.current.map(n => layoutKeyChanged
      ? { ...n, x: undefined, y: undefined, fx: null, fy: null }
      : { ...n })
    const ce = mutableEdgesRef.current.map(e => ({ ...e }))
    mutableNodesRef.current = cn
    mutableEdgesRef.current = ce

    if (simRef.current) simRef.current.stop()
    pinnedRef.current = false

    const sim = buildSimulation(cn, ce, dimsRef, draw)
    simRef.current = sim

    const zoom = buildZoom(transformRef, draw)
    d3.select(canvas).call(zoom)

    const { onMove, onMouseMove, onMouseDown, onMouseUp, onContextMenu, onDblClick } = createGraphInteractions({
      canvas,
      sim,
      draw,
      setEditingEdge,
      dragNodeRef,
      dragGroupRef,
      wasDraggedRef,
      dragStartRef,
      isPanningRef,
      hoverTimerRef,
      hoveredNodeRef,
      hoverAnimRef,
      transformRef,
      selectedNodeIdRef,
      edgeDrawStartRef,
      edgeDrawCursorRef,
      onNodeClickRef,
      onNodeHoverRef,
      onEdgeClickRef,
      onEdgeCreateRef,
      onEdgeDeleteRef,
    })

    canvas.addEventListener("mousemove", onMove)
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mouseup", onMouseUp)
    canvas.addEventListener("contextmenu", onContextMenu)
    canvas.addEventListener("dblclick", onDblClick)

    return () => {
      sim.stop()
      canvas.removeEventListener("contextmenu", onContextMenu)
      canvas.removeEventListener("mousemove", onMove)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mousedown", onMouseDown)
      canvas.removeEventListener("mouseup", onMouseUp)
      canvas.removeEventListener("dblclick", onDblClick)
    }
  }, [draw, layoutKey])

  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    const sn = sim.nodes() as GraphNode[]
    const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
    const simEdges = (linkF?.links() ?? []) as GraphEdge[]

    if (selectedNodeId) {
      const adj = new Set([selectedNodeId])
      for (const e of simEdges) {
        const sid = typeof e.source === "string" ? e.source : (e.source as GraphNode).id
        const tid = typeof e.target === "string" ? e.target : (e.target as GraphNode).id
        if (sid === selectedNodeId || tid === selectedNodeId) { adj.add(sid); adj.add(tid) }
      }
      for (const n of sn) {
        n.selected = n.id === selectedNodeId
        n.faded = !adj.has(n.id)
      }
      for (const e of simEdges) {
        const sid = typeof e.source === "string" ? e.source : (e.source as GraphNode).id
        const tid = typeof e.target === "string" ? e.target : (e.target as GraphNode).id
        e.selected = false
        e.focused = (sid === selectedNodeId || tid === selectedNodeId)
        e.faded = !e.focused
      }
    } else {
      for (const n of sn) { n.selected = false; n.faded = false }
      for (const e of simEdges) { e.selected = false; e.focused = false; e.faded = false }
    }
    draw()
  }, [selectedNodeId, draw])

  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    const sn = sim.nodes() as GraphNode[]
    const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
    const simEdges = (linkF?.links() ?? []) as GraphEdge[]

    for (const e of simEdges) {
      e.selected = (e.id === selectedEdgeId)
      e.faded = !!selectedEdgeId && e.id !== selectedEdgeId
      e.focused = false
    }
    for (const n of sn) {
      n.selected = false
      n.faded = !!selectedEdgeId
      n.focused = false
    }
    draw()
  }, [selectedEdgeId, draw])

  // Sync canvas pixel dimensions to container size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = W * dpr
    canvas.height = H * dpr
  }, [W, H, dpr])

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", position: "absolute", top: 0, left: 0, cursor: "grab" }}
      />
      {editingEdge && (
        <div
          style={{
            position: "absolute",
            left: editingEdge.screenX,
            top: editingEdge.screenY,
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
        >
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            autoFocus
            defaultValue={editingEdge.weight}
            style={{
              width: 60,
              height: 28,
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center",
              borderRadius: 8,
              border: `2px solid ${themeMode === "dark" ? "#f59e0b" : "#d97706"}`,
              background: themeMode === "dark" ? "#0f172a" : "#fff",
              color: themeMode === "dark" ? "#f8fafc" : "#0f172a",
              outline: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            }}
            onBlur={(ev) => {
              const w = parseFloat(ev.target.value)
              if (!isNaN(w) && w >= 0.1 && w <= 10) {
                onEdgeWeightChangeRef.current?.(editingEdge.id, w)
              }
              setEditingEdge(null)
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                const w = parseFloat((ev.target as HTMLInputElement).value)
                if (!isNaN(w) && w >= 0.1 && w <= 10) {
                  onEdgeWeightChangeRef.current?.(editingEdge.id, w)
                }
                setEditingEdge(null)
              }
              if (ev.key === "Escape") setEditingEdge(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
