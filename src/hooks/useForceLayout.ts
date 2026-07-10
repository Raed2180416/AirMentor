import { useEffect, useCallback, useRef } from 'react';
import { useReactFlow, useNodesInitialized } from '@xyflow/react';
import * as d3 from 'd3-force';

export type ForceLayoutOptions = {
  semesterCount?: number;
  expandedSemesters?: Set<number>;
};

const SEM_SPACING = 400;

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  width: number;
  height: number;
  targetX: number;
  targetY: number;
  dragging?: boolean;
};

export function useForceLayout({
  semesterCount: _semesterCount = 8,
  expandedSemesters: _expandedSemesters,
}: ForceLayoutOptions = {}) {
  const { getNodes, setNodes } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);

  const runLayout = useCallback(() => {
    const nodes = getNodes();
    if (!nodes.length) return;

    // Only simulate true top-level nodes (semester clusters). Courses now use
    // parentId so React Flow handles them natively — no physics needed.
    const topLevelNodes = nodes.filter(n => !n.parentId && n.type === 'semesterCluster');
    if (!topLevelNodes.length) return;

    const activeSems = new Set(topLevelNodes.map(n => Number(n.data?.semesterNumber)));
    const sortedSems = [...activeSems].sort((a, b) => a - b);
    const semIndex = new Map(sortedSems.map((s, i) => [s, i]));
    const totalWidth = (sortedSems.length - 1) * SEM_SPACING;
    const startX = -totalWidth / 2;

    const simNodes: SimNode[] = topLevelNodes.map((node) => {
      const sem = Number(node.data?.semesterNumber);
      const idx = semIndex.get(sem) ?? 0;
      const targetX = startX + idx * SEM_SPACING;
      const targetY = 0;
      return {
        ...node,
        x: node.position.x || targetX,
        y: node.position.y || targetY,
        targetX,
        targetY,
        fx: node.dragging ? node.position.x : null,
        fy: node.dragging ? node.position.y : null,
        width: node.measured?.width || 140,
        height: node.measured?.height || 140,
      };
    });

    const forceCollide = d3.forceCollide()
      .radius((d: d3.SimulationNodeDatum) => Math.max((d as SimNode).width, (d as SimNode).height) / 2 + 20)
      .strength(0.3)
      .iterations(2);

    const forceTarget = (alpha: number) => {
      for (const node of simNodes) {
        if (node.dragging) continue;
        const tx = node.targetX ?? (node.x ?? 0);
        const ty = node.targetY ?? (node.y ?? 0);
        node.vx = (node.vx || 0) + (tx - (node.x ?? 0)) * 0.05 * alpha;
        node.vy = (node.vy || 0) + (ty - (node.y ?? 0)) * 0.05 * alpha;
      }
    };

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .velocityDecay(0.85)   // very heavy damping — no oscillation
      .alphaDecay(0.12)       // cool fast
      .alphaMin(0.001)        // stop early
      .alpha(0.35)            // gentle start
      .force('collide', forceCollide)
      .force('target', forceTarget);

    let frameId = 0;
    simulation.on('tick', () => {
      frameId = window.requestAnimationFrame(() => {
        setNodes((currentNodes) => {
          const simMap = new Map(simNodes.map(sn => [sn.id, sn]));
          return currentNodes.map((node) => {
            // Keep child nodes untouched — React Flow handles parent-relative positioning
            if (node.parentId) return node;
            const simNode = simMap.get(node.id);
            if (!simNode) return node;
            if (node.dragging) {
              simNode.fx = node.position.x;
              simNode.fy = node.position.y;
              return node;
            }
            simNode.fx = null;
            simNode.fy = null;
            return { ...node, position: { x: simNode.x!, y: simNode.y! } };
          });
        });
      });
    });

    simulation.on('end', () => {
      if (frameId) cancelAnimationFrame(frameId);
      simulation.stop();
    });

    const timeout = setTimeout(() => {
      if (frameId) cancelAnimationFrame(frameId);
      simulation.stop();
    }, 700);

    simulationRef.current = simulation;
    return () => {
      clearTimeout(timeout);
      if (frameId) cancelAnimationFrame(frameId);
      simulation.stop();
    };
  }, [getNodes, setNodes]);

  useEffect(() => {
    if (!nodesInitialized) return;
    const cleanup = runLayout();
    return () => {
      cleanup?.();
      simulationRef.current?.stop();
    };
  }, [nodesInitialized, runLayout]);

  return simulationRef;
}
