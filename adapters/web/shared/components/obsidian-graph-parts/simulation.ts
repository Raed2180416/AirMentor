import type { MutableRefObject } from "react"
import * as d3 from "d3"
import type { GraphNode, GraphEdge } from "./types"
import { nodeRadius } from "./helpers"

export function buildSimulation(
  cn: GraphNode[],
  ce: GraphEdge[],
  dimsRef: MutableRefObject<{ w: number; h: number }>,
  draw: () => void,
) {
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

  return sim
}

export function buildZoom(
  transformRef: MutableRefObject<d3.ZoomTransform>,
  draw: () => void,
) {
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

  return zoom
}
