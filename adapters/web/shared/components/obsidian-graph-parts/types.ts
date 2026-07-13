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

export interface Props {
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

export interface EditingEdge {
  id: string
  screenX: number
  screenY: number
  weight: number
}
