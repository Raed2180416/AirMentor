/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactFlow, Controls, Background, MiniMap, Panel } from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { T } from '@web/simulation/fixtures';
import { Btn } from '@web/shared/ui/primitives';
import { Save, Maximize2, Minimize2, Map as MapIcon } from 'lucide-react';
import { getGlass } from './curriculum-graph-helpers';
import { nodeTypes } from './curriculum-graph-nodes';
import { edgeTypes } from './curriculum-graph-edges';

export type CurriculumGraphCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (params: Connection) => void;
  onNodeContextMenu: (event: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu: (event: React.MouseEvent, edge: Edge) => void;
  onPaneContextMenu: (event: MouseEvent | React.MouseEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeMouseEnter: (event: React.MouseEvent, node: Node) => void;
  onNodeMouseLeave: () => void;
  onNodeDragStart: (event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => void;
  onNodeDrag: (event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => void;
  onNodeDragStop: (event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => void;
  isLight: boolean;
  showMinimap: boolean;
  setShowMinimap: (value: boolean) => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  onSave: () => void;
  saving: boolean;
  ghostLine: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
};

export function CurriculumGraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneContextMenu,
  onDrop,
  onDragOver,
  onNodeClick,
  onPaneClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  isLight,
  showMinimap,
  setShowMinimap,
  toggleFullscreen,
  isFullscreen,
  onSave,
  saving,
  ghostLine,
}: CurriculumGraphCanvasProps) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodesFocusable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: -200, y: -100, zoom: 0.75 }}
        minZoom={0.15}
        maxZoom={1.5}
      >
        <Background color={T.muted} gap={28} size={1} />
        <Controls style={{ background: getGlass(isLight).background, border: getGlass(isLight).border }} />
        {showMinimap && <MiniMap style={{ background: getGlass(isLight).background }} maskColor={isLight ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.2)'} />}

        <Panel position="top-left" style={{ margin: 16 }}>
          <div style={{ ...getGlass(isLight), padding: '8px 16px', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setShowMinimap(!showMinimap)} title="Toggle Minimap"><MapIcon size={14} /></Btn>
            <div style={{ width: 1, height: 16, background: T.border }} />
            <Btn size="sm" style={{ background: T.accent, color: '#fff' }} onClick={onSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </Panel>

        <Panel position="bottom-center" style={{ marginBottom: 12 }}>
          <div style={{ ...getGlass(isLight), padding: '6px 16px', borderRadius: 20, fontSize: 11, color: T.muted, display: 'flex', gap: 16, alignItems: 'center', pointerEvents: 'none' }}>
            <span><b>Left Click</b> select</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span><b>Right-drag</b> link</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span><b>Right-click</b> edge → delete</span>
          </div>
        </Panel>
      </ReactFlow>
      {ghostLine && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <line x1={ghostLine.from.x} y1={ghostLine.from.y} x2={ghostLine.to.x} y2={ghostLine.to.y} stroke="#22d3ee" strokeWidth={2} strokeDasharray="4 4" />
        </svg>
      )}
    </div>
  );
}
