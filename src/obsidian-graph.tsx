import { useEffect, useRef, useCallback, useState } from "react"
import * as d3 from "d3"

export type GraphNodeKind = "semester" | "course" | "outcome"
export type GraphEdgeKind = "prerequisite" | "parent-child"

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  code?: string
  semesterNumber?: number
  parentSemesterId?: string
  parentCourseId?: string
  bloomLevel?: string
  masteryTarget?: number
  isExpanded?: boolean
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
  faded?: boolean
  focused?: boolean
  selected?: boolean
  hidden?: boolean
}

export interface GraphEdge {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  kind: GraphEdgeKind
  weight?: number
  faded?: boolean
  focused?: boolean
  selected?: boolean
  hidden?: boolean
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  onEdgeClick?: (edgeId: string) => void
  onEdgeCreate?: (sourceId: string, targetId: string) => void
  onEdgeDelete?: (edgeId: string) => void
  onEdgeWeightChange?: (edgeId: string, weight: number) => void
  selectedNodeId?: string | null
  selectedEdgeId?: string | null
  themeMode?: "dark" | "light"
  layoutKey?: number | string
  showWeights?: boolean
}

function getThemeColors(mode: "dark" | "light") {
  const isDark = mode === "dark"
  return {
    semesterColors: ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#22d3ee"],
    courseColor: isDark ? "#818cf8" : "#4f46e5",
    outcomeColor: isDark ? "#22d3ee" : "#06b6d4",
    prereqColor: isDark ? "#f59e0b" : "#d97706",
    parentChildColor: isDark ? "#6366f1" : "#818cf8",
    bgColor: isDark ? "#0f172a" : "#f8fafc",
    textColor: isDark ? "#f8fafc" : "#0f172a",
    subTextColor: isDark ? "rgba(248,250,252,0.75)" : "rgba(15,23,42,0.65)",
    dimTextColor: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.45)",
    nodeStroke: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.3)",
    gridColor: isDark ? "rgba(248,250,252,0.035)" : "rgba(15,23,42,0.04)",
    shadowColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.15)",
    edgeLabelBg: isDark ? "#1e293b" : "#ffffff",
    edgeLabelText: isDark ? "#fbbf24" : "#b45309",
  }
}

function semesterColor(n: number, palette: string[]) {
  return palette[(n - 1) % palette.length]
}

function nodeRadius(d: GraphNode): number {
  if (d.kind === "semester") return 38
  if (d.kind === "course") return 26
  return 22
}

function applyVisibility(nodes: GraphNode[]) {
  const nm = new Map(nodes.map(n => [n.id, n]))
  for (const n of nodes) {
    if (n.kind === "semester") {
      n.hidden = false
    } else if (n.kind === "course") {
      const parent = n.parentSemesterId ? nm.get(n.parentSemesterId) : undefined
      n.hidden = !parent || !parent.isExpanded
    } else if (n.kind === "outcome") {
      const parent = n.parentCourseId ? nm.get(n.parentCourseId) : undefined
      n.hidden = !parent || parent.hidden || !parent.isExpanded
    }
  }
}

function getDescendants(nodeId: string, nodes: GraphNode[]): string[] {
  const result: string[] = []
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const n of nodes) {
      if ((n.parentSemesterId === current || n.parentCourseId === current) && !result.includes(n.id)) {
        result.push(n.id)
        queue.push(n.id)
      }
    }
  }
  return result
}

function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx, projY = y1 + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  size: number,
  color: string
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, -size * 0.32)
  ctx.lineTo(-size * 0.65, 0)
  ctx.lineTo(-size, size * 0.32)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

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
  const colors = getThemeColors(themeMode)

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
  const [editingEdge, setEditingEdge] = useState<{ id: string; screenX: number; screenY: number; weight: number } | null>(null)
  const dimsRef = useRef(dims)
  dimsRef.current = dims
  const dprRef = useRef(typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1)
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

  onNodeClickRef.current = onNodeClick
  onNodeHoverRef.current = onNodeHover
  onEdgeClickRef.current = onEdgeClick
  onEdgeCreateRef.current = onEdgeCreate
  onEdgeDeleteRef.current = onEdgeDelete
  onEdgeWeightChangeRef.current = onEdgeWeightChange
  selectedNodeIdRef.current = selectedNodeId ?? null

  const W = dims.w
  const H = dims.h
  const dpr = dprRef.current

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
  }, [nodes, edges])

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

    const simNodes = sim.nodes() as GraphNode[]
    const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
    const simEdges = (linkF?.links() ?? []) as GraphEdge[]
    const nm = new Map(simNodes.map(n => [n.id, n]))
    const dw = dimsRef.current.w
    const dh = dimsRef.current.h

    const anim = hoverAnimRef.current
    anim.value += (anim.target - anim.value) * 0.15
    const hoverBlend = anim.value

    ctx.fillStyle = colors.bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(t.x * dpr, t.y * dpr)
    ctx.scale(t.k * dpr, t.k * dpr)
    const gridSize = 50
    const viewX = -t.x / t.k
    const viewY = -t.y / t.k
    const viewW = dw / t.k
    const viewH = dh / t.k
    const startGX = Math.floor(viewX / gridSize) * gridSize
    const startGY = Math.floor(viewY / gridSize) * gridSize
    ctx.strokeStyle = colors.gridColor
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let gx = startGX; gx < viewX + viewW; gx += gridSize) {
      ctx.moveTo(gx, viewY)
      ctx.lineTo(gx, viewY + viewH)
    }
    for (let gy = startGY; gy < viewY + viewH; gy += gridSize) {
      ctx.moveTo(viewX, gy)
      ctx.lineTo(viewX + viewW, gy)
    }
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.translate(t.x * dpr, t.y * dpr)
    ctx.scale(t.k * dpr, t.k * dpr)

    for (const e of simEdges) {
      if (e.hidden) continue
      const s = typeof e.source === "string" ? nm.get(e.source) : (e.source as GraphNode)
      const tg = typeof e.target === "string" ? nm.get(e.target) : (e.target as GraphNode)
      if (!s || !tg || s.hidden || tg.hidden) continue

      const sx = s.x ?? 0, sy = s.y ?? 0, tx = tg.x ?? 0, ty = tg.y ?? 0
      const sr = nodeRadius(s), tr = nodeRadius(tg)
      const dx = tx - sx, dy = ty - sy, dist = Math.sqrt(dx * dx + dy * dy) || 1
      const x1 = sx + (dx / dist) * sr, y1 = sy + (dy / dist) * sr
      const x2 = tx - (dx / dist) * tr, y2 = ty - (dy / dist) * tr

      let alpha = 0.45, color = colors.parentChildColor, lw = 1.5
      if (e.kind === "prerequisite") { color = colors.prereqColor; lw = 2.2; alpha = 0.8 }

      if (e.selected) { alpha = 1; lw = 3.5 }
      else if (e.focused) { alpha = 0.9; lw = 2.8 }
      else if (e.faded) { alpha = 0.02 }

      if (hoverBlend > 0.01 && !e.selected && !e.faded && !e.focused) {
        alpha *= (1 - hoverBlend * 0.45)
      }

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = lw

      if (e.kind === "parent-child") {
        ctx.setLineDash([4, 4])
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const perpX = -(y2 - y1) / dist * 14
        const perpY = (x2 - x1) / dist * 14
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(mx + perpX, my + perpY, x2, y2)
      } else {
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      }
      ctx.stroke()
      ctx.setLineDash([])

      if (e.selected) {
        ctx.beginPath()
        ctx.strokeStyle = colors.textColor
        ctx.globalAlpha = 0.3
        ctx.lineWidth = lw + 3
        if (e.kind === "parent-child") {
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const perpX = -(y2 - y1) / dist * 14
          const perpY = (x2 - x1) / dist * 14
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo(mx + perpX, my + perpY, x2, y2)
        } else {
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
        }
        ctx.stroke()
      }

      if (e.kind === "prerequisite" && alpha > 0.05) {
        const ang = Math.atan2(y2 - y1, x2 - x1)
        drawArrowhead(ctx, x2, y2, ang, 10, color)
      }

      // Weight label on all visible edges when showWeights is true
      if (showWeights && e.weight != null && alpha > 0.15 && t.k >= 0.4) {
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const label = String(e.weight)
        ctx.font = "bold 10px monospace"
        const textW = ctx.measureText(label).width
        const padX = 5
        const pillW = textW + padX * 2
        const pillH = 14
        ctx.fillStyle = colors.edgeLabelBg
        ctx.globalAlpha = alpha * 0.85
        ctx.beginPath()
        ctx.roundRect(mx - pillW / 2, my - pillH / 2, pillW, pillH, 4)
        ctx.fill()
        ctx.fillStyle = colors.edgeLabelText
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.globalAlpha = alpha
        ctx.fillText(label, mx, my + 0.5)
      }
    }

    // Temporary edge preview during edge draw
    if (edgeDrawStartRef.current && edgeDrawCursorRef.current) {
      const sn = sim.nodes() as GraphNode[]
      const src = sn.find(n => n.id === edgeDrawStartRef.current)
      if (src) {
        ctx.beginPath()
        ctx.strokeStyle = colors.prereqColor
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.moveTo(src.x ?? 0, src.y ?? 0)
        ctx.lineTo(edgeDrawCursorRef.current.x, edgeDrawCursorRef.current.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    const drawN = (d: GraphNode) => {
      if (d.hidden) return
      const r = nodeRadius(d), x = d.x ?? 0, y = d.y ?? 0

      let alpha = 1
      if (d.faded) alpha = 0.1
      if (d.focused) alpha = 1
      if (hoverBlend > 0.01 && !d.selected && !d.faded && !d.focused) {
        alpha = 1 - hoverBlend * 0.5
      }

      ctx.globalAlpha = alpha

      let fc = colors.outcomeColor, sc = colors.nodeStroke, sw = 1.5
      if (d.kind === "semester") {
        fc = semesterColor(d.semesterNumber ?? 1, colors.semesterColors)
        sw = 2.5
      } else if (d.kind === "course") {
        fc = colors.courseColor
        sw = 2
      }

      if (d.focused) { ctx.shadowColor = fc; ctx.shadowBlur = 16 }
      if (d.selected) { sc = colors.textColor; sw = 3.5; ctx.shadowColor = fc; ctx.shadowBlur = 26 }
      if (d.faded) { ctx.shadowBlur = 0 }

      if (!d.faded) {
        ctx.shadowColor = colors.shadowColor
        ctx.shadowBlur = d.kind === "semester" ? 10 : 6
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = d.kind === "semester" ? 3 : 2
      }

      ctx.fillStyle = fc
      ctx.strokeStyle = sc
      ctx.lineWidth = sw
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      if (d.kind !== "outcome" && t.k >= 0.4) {
        const ringR = r + 5
        ctx.beginPath()
        ctx.arc(x, y, ringR, 0, 2 * Math.PI)
        ctx.strokeStyle = d.isExpanded ? "rgba(128,128,128,0.25)" : colors.textColor
        ctx.lineWidth = 1.5
        ctx.globalAlpha = d.isExpanded ? (0.3 * alpha) : (0.7 * alpha)
        ctx.stroke()
        ctx.globalAlpha = alpha

        ctx.beginPath()
        ctx.arc(x + ringR * 0.7, y - ringR * 0.7, 5, 0, 2 * Math.PI)
        ctx.fillStyle = d.isExpanded ? "#ef4444" : "#22c55e"
        ctx.fill()
      }

      if (t.k >= 0.4 && !d.faded) {
        ctx.fillStyle = colors.textColor
        ctx.font = d.kind === "semester" ? "bold 13px Sora,sans-serif" : d.kind === "course" ? "bold 11px Sora,sans-serif" : "10px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const lbl = d.kind === "semester" ? `S${d.semesterNumber}` : d.kind === "course" ? (d.code ?? d.label) : d.label.substring(0, 22)
        ctx.fillText(lbl, x, y)

        if (d.kind === "semester" && t.k >= 0.65) {
          ctx.font = "9px monospace"
          ctx.fillStyle = colors.subTextColor
          ctx.fillText(d.label, x, y + r + 14)
        }
        if (d.kind === "course" && t.k >= 0.65) {
          ctx.font = "8px monospace"
          ctx.fillStyle = colors.dimTextColor
          ctx.fillText(d.label, x, y + r + 12)
        }
      }
    }

    const nf = simNodes.filter(d => !d.focused && !d.selected)
    const f = simNodes.filter(d => d.focused || d.selected)
    nf.forEach(drawN)
    f.forEach(drawN)
    ctx.restore()
  }, [dpr, themeMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cn = mutableNodesRef.current
    const ce = mutableEdgesRef.current
    const layoutKeyChanged = prevLayoutKeyRef.current !== layoutKey
    prevLayoutKeyRef.current = layoutKey

    if (simRef.current) simRef.current.stop()
    pinnedRef.current = false

    if (layoutKeyChanged) {
      for (const n of cn) {
        n.x = undefined
        n.y = undefined
        n.fx = null
        n.fy = null
      }
    }

    const dw = dimsRef.current.w
    const dh = dimsRef.current.h
    const maxSem = Math.max(1, ...cn.filter(n => n.kind === "semester").map(n => n.semesterNumber ?? 1))
    const colStep = Math.min(240, (dw - 120) / Math.max(maxSem, 1))
    const nm = new Map(cn.map(n => [n.id, n]))

    for (const n of cn) {
      if (n.x == null) {
        if (n.kind === "semester") {
          n.x = 80 + (n.semesterNumber ?? 1) * colStep
          n.y = dh / 2
        } else if (n.kind === "course" && n.parentSemesterId) {
          const p = nm.get(n.parentSemesterId)
          n.x = (p?.x ?? dw / 2) + (Math.random() - 0.5) * 70
          n.y = (p?.y ?? dh / 2) + Math.min(140, dh * 0.28) + (Math.random() - 0.5) * 50
        } else if (n.kind === "outcome" && n.parentCourseId) {
          const p = nm.get(n.parentCourseId)
          n.x = (p?.x ?? dw / 2) + (Math.random() - 0.5) * 50
          n.y = (p?.y ?? dh / 2) + Math.min(120, dh * 0.24) + (Math.random() - 0.5) * 35
        } else {
          n.x = dw / 2 + (Math.random() - 0.5) * 40
          n.y = dh / 2 + (Math.random() - 0.5) * 40
        }
      }
    }

    const sim = d3.forceSimulation<GraphNode>(cn)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(ce).id(d => d.id)
        .distance(e => e.kind === "prerequisite" ? 220 : 110)
        .strength(e => e.kind === "prerequisite" ? 0.12 : 0.22))
      .force("charge", d3.forceManyBody<GraphNode>().strength(-30))
      .force("collide", d3.forceCollide<GraphNode>().radius(d => nodeRadius(d) + 10).strength(0.85))
      .force("x", d3.forceX<GraphNode>(d => {
        const ww = dimsRef.current.w
        if (d.kind === "semester") return 80 + (d.semesterNumber ?? 1) * colStep
        if (d.kind === "course" && d.parentSemesterId) return nm.get(d.parentSemesterId)?.x ?? ww / 2
        if (d.kind === "outcome" && d.parentCourseId) return nm.get(d.parentCourseId)?.x ?? ww / 2
        return ww / 2
      }).strength(d => d.kind === "semester" ? 0.3 : 0.12))
      .force("y", d3.forceY<GraphNode>(d => {
        const hh = dimsRef.current.h
        if (d.kind === "semester") return hh / 2
        if (d.kind === "course" && d.parentSemesterId) return (nm.get(d.parentSemesterId)?.y ?? hh / 2) + Math.min(150, hh * 0.32)
        if (d.kind === "outcome" && d.parentCourseId) return (nm.get(d.parentCourseId)?.y ?? hh / 2) + Math.min(130, hh * 0.27)
        return hh / 2
      }).strength(d => d.kind === "semester" ? 0.3 : 0.1))
      .alphaDecay(0.02)
      .velocityDecay(0.5)
      .on("tick", () => {
        draw()
      })
    simRef.current = sim

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 6])
      .filter(event => {
        if (event.type === "wheel") return true
        if (event.type === "mousedown" && event.button === 2) return true
        return false
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform
        draw()
      })
    d3.select(canvas).call(zoom)

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
        if (window.confirm("Delete this link?")) {
          onEdgeDeleteRef.current?.(bestEdge.id)
        }
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