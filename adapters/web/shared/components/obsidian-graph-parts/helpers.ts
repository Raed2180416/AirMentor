import type { GraphNode } from "./types"

export function getThemeColors(mode: "dark" | "light") {
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

export type ThemeColors = ReturnType<typeof getThemeColors>

export function semesterColor(n: number, palette: string[]) {
  return palette[(n - 1) % palette.length]
}

export function nodeRadius(d: GraphNode): number {
  if (d.kind === "semester") return 38
  if (d.kind === "course") return 26
  return 22
}

export function applyVisibility(nodes: GraphNode[]) {
  const nm = new Map(nodes.map(n => [n.id, n]))
  for (const n of nodes) {
    if (n.kind === "semester") {
      n.hidden = false
    } else if (n.kind === "course") {
      if (n.parentSemesterId) {
        const parent = nm.get(n.parentSemesterId)
        n.hidden = !parent || !parent.isExpanded
      } else {
        n.hidden = false
      }
    } else if (n.kind === "outcome") {
      const parent = n.parentCourseId ? nm.get(n.parentCourseId) : undefined
      n.hidden = !parent || parent.hidden || !parent.isExpanded
    }
  }
}

export function getDescendants(nodeId: string, nodes: GraphNode[]): string[] {
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

export function pointToSegmentDistance(
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

export function drawArrowhead(
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
