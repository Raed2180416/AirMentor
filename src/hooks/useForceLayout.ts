import { useEffect, useCallback, useRef } from 'react';
import { useReactFlow, useNodesInitialized } from '@xyflow/react';

import * as d3 from 'd3-force';

export type ForceLayoutOptions = {
  strength?: number;
  distance?: number;
};

export function useForceLayout({ strength = -1000, distance = 250 }: ForceLayoutOptions = {}) {
  const { getNodes, setNodes, getEdges } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);

  const runLayout = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    if (!nodes.length) return;

    // Only simulate top-level nodes
    const topLevelNodes = nodes.filter(n => !n.parentId);

    // Create D3 compatible node array
    const simNodes = topLevelNodes.map((node) => ({
      ...node,
      x: node.position.x || 0,
      y: node.position.y || 0,
      // Lock position if node is currently being dragged
      fx: node.dragging ? node.position.x : null,
      fy: node.dragging ? node.position.y : null,
      // Provide dimensions for rectangular collision
      width: node.measured?.width || (node.type === 'courseBubble' || node.type === 'semesterCluster' ? 140 : 80),
      height: node.measured?.height || (node.type === 'courseBubble' || node.type === 'semesterCluster' ? 140 : 40),
    }));

    const getSimId = (id: string) => {
      const node = nodes.find(n => n.id === id);
      return node?.parentId ? node.parentId : id;
    };

    const simLinks = edges.map((edge) => ({
      source: getSimId(edge.source),
      target: getSimId(edge.target),
      isInternal: edge.data?.isInternal
    })).filter(l => l.source !== l.target);

    // Custom rectangular collision
    const forceCollide = d3.forceCollide().radius((d: any) => {
       const w = d.width / 2;
       const h = d.height / 2;
       return Math.max(w, h) + 10; // Simple bounding circle using max dimension + padding
    }).iterations(3);

    const simulation = d3.forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force('charge', d3.forceManyBody().strength((n: any) => n.type === 'courseBubble' ? strength * 4 : strength))
      .force('collide', forceCollide)
      .force('center', d3.forceCenter(0, 0).strength(0.05))
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance((l: any) => l.isInternal ? distance * 0.5 : distance).strength(0.8))
      .alphaDecay(0.02);

    simulation.on('tick', () => {
      window.requestAnimationFrame(() => {
        setNodes((currentNodes) => {
          return currentNodes.map((node) => {
            // Child nodes shouldn't be overridden by physics, they are handled by React Flow
            if (node.parentId) return node;

            const simNode = simNodes.find((sn) => sn.id === node.id);
            if (!simNode) return node;

            if (node.dragging) {
              simNode.fx = node.position.x;
              simNode.fy = node.position.y;
              return node;
            } else {
              simNode.fx = null;
              simNode.fy = null;
            }

            return {
              ...node,
              position: { x: simNode.x!, y: simNode.y! },
            };
          });
        });
      });
    });

    simulationRef.current = simulation;
  }, [getNodes, getEdges, setNodes, strength, distance]);

  // Restart layout when nodes initialize or underlying graph topology changes
  useEffect(() => {
    if (nodesInitialized) {
      runLayout();
    }
    return () => {
      simulationRef.current?.stop();
    };
  }, [nodesInitialized, runLayout]);

  return simulationRef;
}
