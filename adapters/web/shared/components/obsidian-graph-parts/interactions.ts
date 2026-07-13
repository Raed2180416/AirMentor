import type { MutableRefObject } from "react"
import * as d3 from "d3"
import type { EditingEdge, GraphEdge, GraphNode } from "./types"
import { applyVisibility, getDescendants, nodeRadius, pointToSegmentDistance } from "./helpers"

export interface GraphInteractionParams {
  canvas: HTMLCanvasElement
  sim: d3.Simulation<GraphNode, GraphEdge>
  draw: () => void
  setEditingEdge: (value: EditingEdge | null) => void
  dragNodeRef: MutableRefObject<GraphNode | null>
  dragGroupRef: MutableRefObject<Map<string, { ox: number; oy: number }> | null>
  wasDraggedRef: MutableRefObject<boolean>
  dragStartRef: MutableRefObject<{ x: number; y: number }>
  isPanningRef: MutableRefObject<boolean>
  hoverTimerRef: MutableRefObject<number | null>
  hoveredNodeRef: MutableRefObject<string | null>
  hoverAnimRef: MutableRefObject<{ value: number; target: number }>
  transformRef: MutableRefObject<d3.ZoomTransform>
  selectedNodeIdRef: MutableRefObject<string | null>
  edgeDrawStartRef: MutableRefObject<string | null>
  edgeDrawCursorRef: MutableRefObject<{ x: number; y: number } | null>
  onNodeClickRef: MutableRefObject<((nodeId: string) => void) | undefined>
  onNodeHoverRef: MutableRefObject<((nodeId: string | null) => void) | undefined>
  onEdgeClickRef: MutableRefObject<((edgeId: string) => void) | undefined>
  onEdgeCreateRef: MutableRefObject<((sourceId: string, targetId: string) => void) | undefined>
  onEdgeDeleteRef: MutableRefObject<((edgeId: string) => void) | undefined>
}

export function createGraphInteractions(params: GraphInteractionParams) {
  const {
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
    // preserved for parity with the original (its call site is commented out); unused here
    onEdgeDeleteRef: _onEdgeDeleteRef,
  } = params

  const onMove = (ev: MouseEvent) => {
    if (dragNodeRef.current || isPanningRef.current) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = window.setTimeout(() => {
      const r = canvas.getBoundingClientRect()
      const px = ev.clientX - r.left, py = ev.clientY - r.top
      const tr = transformRef.current
      const xi = tr.invertX(px), yi = tr.invertY(py)
      const sn = sim.nodes() as GraphNode[]
      let best: GraphNode | null = null, bestD = Infinity
      for (const n of sn) {
        if (n.hidden) continue
        const d = Math.sqrt(((n.x ?? 0) - xi) ** 2 + ((n.y ?? 0) - yi) ** 2)
        if (d < nodeRadius(n) + 8 && d < bestD) { bestD = d; best = n }
      }
      if (best) {
        hoveredNodeRef.current = best.id
        hoverAnimRef.current.target = 1
        const adj = new Set([best.id])
        const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
        const simEdges = (linkF?.links() ?? []) as GraphEdge[]
        for (const e of simEdges) {
          const sid = typeof e.source === "string" ? e.source : (e.source as GraphNode).id
          const tid = typeof e.target === "string" ? e.target : (e.target as GraphNode).id
          if (sid === best.id || tid === best.id) {
            adj.add(sid); adj.add(tid)
            e.faded = false; e.focused = true
          } else {
            e.faded = true; e.focused = false
          }
        }
        for (const n of sn) {
          if (adj.has(n.id)) { n.faded = false; n.focused = true }
          else { n.faded = true; n.focused = false }
        }
        onNodeHoverRef.current?.(best.id)
      } else {
        hoveredNodeRef.current = null
        hoverAnimRef.current.target = 0
        const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
        const simEdges = (linkF?.links() ?? []) as GraphEdge[]
        for (const e of simEdges) { e.faded = false; e.focused = false }
        for (const n of sn) { n.faded = false; n.focused = false }
        onNodeHoverRef.current?.(null)
      }
      draw()
    }, 80)
  }

  const onMouseDown = (ev: MouseEvent) => {
    if (ev.button !== 0) return
    const r = canvas.getBoundingClientRect()
    const px = ev.clientX - r.left, py = ev.clientY - r.top
    const tr = transformRef.current
    const xi = tr.invertX(px), yi = tr.invertY(py)
    const sn = sim.nodes() as GraphNode[]

    let hitNode: GraphNode | null = null
    for (const n of sn) {
      if (n.hidden) continue
      if (Math.sqrt(((n.x ?? 0) - xi) ** 2 + ((n.y ?? 0) - yi) ** 2) < nodeRadius(n) + 8) {
        hitNode = n
        break
      }
    }

    if (hitNode) {
      dragNodeRef.current = hitNode
      wasDraggedRef.current = false
      dragStartRef.current = { x: ev.clientX, y: ev.clientY }

      if (hitNode.id === selectedNodeIdRef.current) {
        // Dragging from the selected node → edge draw mode
        edgeDrawStartRef.current = hitNode.id
        // Pin source so it doesn't drift while drawing
        hitNode.fx = hitNode.x
        hitNode.fy = hitNode.y
      } else {
        // Normal node drag
        edgeDrawStartRef.current = null
        const descendants = getDescendants(hitNode.id, sn)
        const offsets = new Map<string, { ox: number; oy: number }>()
        for (const descId of descendants) {
          const desc = sn.find(d => d.id === descId)!
          offsets.set(descId, { ox: (desc.x ?? 0) - (hitNode.x ?? 0), oy: (desc.y ?? 0) - (hitNode.y ?? 0) })
        }
        dragGroupRef.current = offsets
      }
      return
    }

    onNodeClickRef.current?.("")
  }

  const onMouseMove = (ev: MouseEvent) => {
    if (!dragNodeRef.current) return
    const dx = Math.abs(ev.clientX - dragStartRef.current.x)
    const dy = Math.abs(ev.clientY - dragStartRef.current.y)

    if (!wasDraggedRef.current && (dx > 3 || dy > 3)) {
      wasDraggedRef.current = true

      if (edgeDrawStartRef.current) {
        // Edge draw mode — track cursor in graph space
        const r = canvas.getBoundingClientRect()
        const tr = transformRef.current
        edgeDrawCursorRef.current = {
          x: tr.invertX(ev.clientX - r.left),
          y: tr.invertY(ev.clientY - r.top),
        }
        draw()
        return
      }

      // Normal drag: release any pins and heat the simulation
      dragNodeRef.current.fx = null
      dragNodeRef.current.fy = null
      sim.alphaTarget(0.3).restart()
      if (dragGroupRef.current) {
        const sn = sim.nodes() as GraphNode[]
        for (const [descId] of dragGroupRef.current) {
          const desc = sn.find(d => d.id === descId)!
          desc.fx = null
          desc.fy = null
        }
      }
    }

    if (!wasDraggedRef.current) return

    if (edgeDrawStartRef.current) {
      const r = canvas.getBoundingClientRect()
      const tr = transformRef.current
      edgeDrawCursorRef.current = {
        x: tr.invertX(ev.clientX - r.left),
        y: tr.invertY(ev.clientY - r.top),
      }
      draw()
      return
    }

    const r = canvas.getBoundingClientRect()
    const tr = transformRef.current
    const newX = tr.invertX(ev.clientX - r.left)
    const newY = tr.invertY(ev.clientY - r.top)

    const dragged = dragNodeRef.current
    dragged.fx = newX
    dragged.fy = newY
    dragged.x = newX
    dragged.y = newY

    if (dragGroupRef.current) {
      const sn = sim.nodes() as GraphNode[]
      for (const [descId, { ox, oy }] of dragGroupRef.current) {
        const desc = sn.find(d => d.id === descId)!
        desc.fx = newX + ox
        desc.fy = newY + oy
        desc.x = newX + ox
        desc.y = newY + oy
      }
    }

    draw()
  }

  const onMouseUp = (ev: MouseEvent) => {
    const wasDragged = wasDraggedRef.current

    // Edge draw completion (dragged from selected node to another node)
    if (edgeDrawStartRef.current && dragNodeRef.current && wasDragged) {
      const startId = edgeDrawStartRef.current
      edgeDrawStartRef.current = null
      edgeDrawCursorRef.current = null
      dragNodeRef.current = null
      wasDraggedRef.current = false

      // Unpin source
      const sn = sim.nodes() as GraphNode[]
      const src = sn.find(n => n.id === startId)
      if (src) { src.fx = null; src.fy = null }

      const r = canvas.getBoundingClientRect()
      const tr = transformRef.current
      const xi = tr.invertX(ev.clientX - r.left)
      const yi = tr.invertY(ev.clientY - r.top)

      let targetNode: GraphNode | null = null
      let bestDist = Infinity
      for (const n of sn) {
        if (n.hidden || n.id === startId) continue
        const d = Math.sqrt(((n.x ?? 0) - xi) ** 2 + ((n.y ?? 0) - yi) ** 2)
        if (d < nodeRadius(n) + 15 && d < bestDist) { bestDist = d; targetNode = n }
      }
      if (targetNode) onEdgeCreateRef.current?.(startId, targetNode.id)
      return
    }

    // Edge draw cancelled (clicked selected node without dragging)
    if (edgeDrawStartRef.current && dragNodeRef.current) {
      const startId = edgeDrawStartRef.current
      edgeDrawStartRef.current = null
      edgeDrawCursorRef.current = null
      dragNodeRef.current = null
      wasDraggedRef.current = false
      const sn = sim.nodes() as GraphNode[]
      const src = sn.find(n => n.id === startId)
      if (src) { src.fx = null; src.fy = null }
      // Fall through to normal click handling below
    }

    // Normal drag cleanup
    if (dragNodeRef.current) {
      if (dragGroupRef.current) {
        const sn = sim.nodes() as GraphNode[]
        for (const [descId] of dragGroupRef.current) {
          const desc = sn.find(d => d.id === descId)!
          desc.fx = null
          desc.fy = null
        }
        dragGroupRef.current = null
      }
      sim.alphaTarget(0)
      dragNodeRef.current = null
    }

    if (!wasDragged && ev.button === 0) {
      const r = canvas.getBoundingClientRect()
      const tr = transformRef.current
      const xi = tr.invertX(ev.clientX - r.left)
      const yi = tr.invertY(ev.clientY - r.top)
      const sn = sim.nodes() as GraphNode[]
      const nm = new Map(sn.map(n => [n.id, n]))

      for (const n of sn) {
        if (n.hidden) continue
        const dist = Math.sqrt(((n.x ?? 0) - xi) ** 2 + ((n.y ?? 0) - yi) ** 2)
        if (dist < nodeRadius(n) + 5) {
          if (n.kind === "semester" || n.kind === "course") {
            n.isExpanded = !n.isExpanded
            applyVisibility(sn)
          }
          onNodeClickRef.current?.(n.id)
          return
        }
      }

      const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
      const simEdges = (linkF?.links() ?? []) as GraphEdge[]
      let bestEdge: GraphEdge | null = null
      let bestDist = Infinity
      for (const e of simEdges) {
        if (e.hidden) continue
        const s = typeof e.source === "string" ? nm.get(e.source) : (e.source as GraphNode)
        const t = typeof e.target === "string" ? nm.get(e.target) : (e.target as GraphNode)
        if (!s || !t || s.hidden || t.hidden) continue
        const dist = pointToSegmentDistance(xi, yi, s.x ?? 0, s.y ?? 0, t.x ?? 0, t.y ?? 0)
        if (dist < 9 && dist < bestDist) { bestDist = dist; bestEdge = e }
      }
      if (bestEdge) {
        onEdgeClickRef.current?.(bestEdge.id)
        return
      }

      onNodeClickRef.current?.("")
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    const r = canvas.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    const tr = transformRef.current
    const xi = tr.invertX(px), yi = tr.invertY(py)
    const sn = sim.nodes() as GraphNode[]
    const nm = new Map(sn.map(n => [n.id, n]))
    const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
    const simEdges = (linkF?.links() ?? []) as GraphEdge[]

    // Check if right-click hit an edge
    let bestEdge: GraphEdge | null = null
    let bestDist = Infinity
    for (const e of simEdges) {
      if (e.hidden) continue
      const s = typeof e.source === "string" ? nm.get(e.source) : (e.source as GraphNode)
      const t = typeof e.target === "string" ? nm.get(e.target) : (e.target as GraphNode)
      if (!s || !t || s.hidden || t.hidden) continue
      const dist = pointToSegmentDistance(xi, yi, s.x ?? 0, s.y ?? 0, t.x ?? 0, t.y ?? 0)
      if (dist < 12 && dist < bestDist) { bestDist = dist; bestEdge = e }
    }

    if (bestEdge) {
      // if (window.confirm("Delete this link?")) {
      //   onEdgeDeleteRef.current?.(bestEdge.id)
      // }
      return
    }
  }

  const onDblClick = (ev: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    const px = ev.clientX - r.left, py = ev.clientY - r.top
    const tr = transformRef.current
    const xi = tr.invertX(px), yi = tr.invertY(py)
    const sn = sim.nodes() as GraphNode[]
    const nm = new Map(sn.map(n => [n.id, n]))
    const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
    const simEdges = (linkF?.links() ?? []) as GraphEdge[]

    let bestEdge: GraphEdge | null = null
    let bestDist = Infinity
    for (const e of simEdges) {
      if (e.hidden) continue
      const s = typeof e.source === "string" ? nm.get(e.source) : (e.source as GraphNode)
      const t = typeof e.target === "string" ? nm.get(e.target) : (e.target as GraphNode)
      if (!s || !t || s.hidden || t.hidden) continue
      const dist = pointToSegmentDistance(xi, yi, s.x ?? 0, s.y ?? 0, t.x ?? 0, t.y ?? 0)
      if (dist < 12 && dist < bestDist) { bestDist = dist; bestEdge = e }
    }

    if (bestEdge && bestEdge.weight != null) {
      const s = typeof bestEdge.source === "string" ? nm.get(bestEdge.source) : (bestEdge.source as GraphNode)
      const t = typeof bestEdge.target === "string" ? nm.get(bestEdge.target) : (bestEdge.target as GraphNode)
      if (s && t) {
        const mx = ((s.x ?? 0) + (t.x ?? 0)) / 2
        const my = ((s.y ?? 0) + (t.y ?? 0)) / 2
        const screenX = tr.applyX(mx) + r.left
        const screenY = tr.applyY(my) + r.top
        setEditingEdge({ id: bestEdge.id, screenX, screenY, weight: bestEdge.weight })
      }
    }
  }

  return { onMove, onMouseDown, onMouseMove, onMouseUp, onContextMenu, onDblClick }
}
