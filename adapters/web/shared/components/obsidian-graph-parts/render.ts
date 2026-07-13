import * as d3 from "d3"
import type { GraphNode, GraphEdge } from "./types"
import type { ThemeColors } from "./helpers"
import { drawArrowhead, nodeRadius, semesterColor } from "./helpers"

export interface RenderGraphParams {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  t: d3.ZoomTransform
  sim: d3.Simulation<GraphNode, GraphEdge>
  dims: { w: number; h: number }
  hoverAnim: { value: number; target: number }
  edgeDrawStart: string | null
  edgeDrawCursor: { x: number; y: number } | null
  colors: ThemeColors
  dpr: number
  showWeights: boolean
}

export function renderGraph(params: RenderGraphParams) {
  const { ctx, canvas, t, sim, dims, hoverAnim, edgeDrawStart, edgeDrawCursor, colors, dpr, showWeights } = params

  const simNodes = sim.nodes() as GraphNode[]
  const linkF = sim.force("link") as d3.ForceLink<GraphNode, GraphEdge> | undefined
  const simEdges = (linkF?.links() ?? []) as GraphEdge[]
  const nm = new Map(simNodes.map(n => [n.id, n]))
  const dw = dims.w
  const dh = dims.h

  const anim = hoverAnim
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
  if (edgeDrawStart && edgeDrawCursor) {
    const sn = sim.nodes() as GraphNode[]
    const src = sn.find(n => n.id === edgeDrawStart)
    if (src) {
      ctx.beginPath()
      ctx.strokeStyle = colors.prereqColor
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 4])
      ctx.moveTo(src.x ?? 0, src.y ?? 0)
      ctx.lineTo(edgeDrawCursor.x, edgeDrawCursor.y)
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
}
