import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import {
  ReactFlow, Controls, Background, MiniMap, applyNodeChanges, applyEdgeChanges,
  Panel, Handle, Position, ReactFlowProvider, BaseEdge, EdgeLabelRenderer, getBezierPath,
  useReactFlow, NodeToolbar
} from '@xyflow/react';
import type { Node, Edge, Connection, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { T, sora, mono } from './data';
import { Btn } from './ui-primitives';
import {
  Save, Loader2, Maximize2, Minimize2, Map as MapIcon,
  Plus, Trash2, BookOpen, GraduationCap
} from 'lucide-react';
import { AirMentorApiClient } from './api/client';
import type { ApiCurriculumGraphBundle, ApiGraphNode, ApiGraphEdge } from './api/types';
import type { ThemeMode } from './domain';
import { isLightTheme } from './theme';
import { useForceLayout } from './hooks/useForceLayout';

function getConfiguredApiBaseUrl() {
  const configured = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim();
  return configured || 'http://127.0.0.1:4000';
}

const SEMESTER_PALETTE: Record<number, string> = {
  1: '#22d3ee', 2: '#34d399', 3: '#fbbf24', 4: '#fb923c', 5: '#f472b6', 6: '#a78bfa',
  7: '#ef4444', 8: '#3b82f6',
};
function semesterColor(n: number) { return SEMESTER_PALETTE[n] ?? SEMESTER_PALETTE[1]; }

const getGlass = (isLight: boolean) => isLight ? {
  background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
} : {
  background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
};

// -- CUSTOM NODES --

const SemesterClusterNode = ({ data }: { data: Record<string, any> }) => {
  const sem = Number(data.semesterNumber);
  const color = semesterColor(sem);
  return (
    <div
      style={{
        width: 140, height: 140, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}ee, ${color}aa)`,
        border: `4px solid ${color}`,
        boxShadow: `0 0 40px ${color}44, inset 0 -10px 20px rgba(0,0,0,0.2)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', cursor: 'pointer', position: 'relative'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, border: '2px solid #fff', width: 10, height: 10 }} />
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Sem {sem}</div>
      <div style={{ ...mono, fontSize: 11, opacity: 0.9, marginTop: 4 }}>{data.courseCount ?? 0} subjects</div>
    </div>
  );
};

const CourseBubbleNode = ({ data, selected }: { data: Record<string, any>; selected?: boolean }) => {
  const sem = Number(data.semesterNumber);
  const color = semesterColor(sem);
  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div style={{ display: 'flex', gap: 6, padding: '4px 10px', background: 'rgba(0,0,0,0.85)', borderRadius: 10, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Btn size="sm" onClick={() => { const code = prompt('Course Code?'); if (code) data.onUpdate({ courseCode: code }); }} style={{ background: 'transparent', color: '#fff', fontSize: 10 }}>Edit Code</Btn>
          <div style={{ width: 1, background: '#444' }} />
          <Btn size="sm" onClick={() => data.onAddOutcome?.()} style={{ background: 'transparent', color: '#ec4899', fontSize: 10 }}>+ Outcome</Btn>
          <Btn size="sm" onClick={() => data.onAddTopic?.()} style={{ background: 'transparent', color: '#6366f1', fontSize: 10 }}>+ Topic</Btn>
        </div>
      </NodeToolbar>
      <div
        style={{
          width: 140, height: 140, borderRadius: '50%',
          background: selected ? `linear-gradient(135deg, ${color}, ${color}dd)` : `linear-gradient(135deg, ${color}dd, ${color}99)`,
          border: selected ? `4px solid #fff` : `2px solid ${color}`,
          boxShadow: selected ? `0 0 0 4px ${color}, 0 8px 24px ${color}66` : '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', position: 'relative'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid ${color}`, width: 8, height: 8 }} />
        <Handle type="target" position={Position.Top} style={{ background: '#fff', border: `2px solid ${color}`, width: 8, height: 8 }} />
        <div style={{ ...sora, fontSize: 14, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, padding: '0 10px' }}>{data.courseCode || 'NEW'}</div>
        <div style={{ ...mono, fontSize: 9, opacity: 0.8, marginTop: 2 }}>{data.title?.slice(0, 20) || ''}</div>
        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid ${color}`, width: 8, height: 8 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: `2px solid ${color}`, width: 8, height: 8 }} />
      </div>
    </>
  );
};

const OutcomeNode = ({ data, selected }: { data: Record<string, any>, selected?: boolean }) => {
  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.8)', borderRadius: 8, backdropFilter: 'blur(12px)' }}>
          <Btn size="sm" onClick={() => data.onRemove?.()} style={{ background: 'transparent', color: '#ef4444', fontSize: 10 }}>Delete</Btn>
        </div>
      </NodeToolbar>
      <div
        style={{
          padding: '8px 12px', borderRadius: '4px 24px 4px 24px', minWidth: 140,
          background: selected ? 'rgba(255,255,255,0.95)' : 'rgba(15, 23, 42, 0.75)',
          border: `3px solid ${data.color}`,
          backdropFilter: 'blur(16px)',
          boxShadow: `0 0 20px ${data.color}44, inset 0 2px 4px rgba(255,255,255,0.1)`,
          display: 'flex', flexDirection: 'column',
          color: selected ? '#000' : '#fff', cursor: 'grab', position: 'relative'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        <Handle type="target" position={Position.Top} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
             <div style={{ background: data.color, color: '#000', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 800, ...sora }}>{data.title?.split(':')[0]}</div>
             <div style={{ ...sora, fontSize: 11, fontWeight: 700 }}>{data.title?.split(':')[1]?.trim()}</div>
           </div>
           <select 
             value={data.bloomLevel || 'remember'} 
             onChange={(e) => data.onChangeBloom?.(e.target.value)}
             className="nodrag"
             style={{ fontSize: 9, background: 'transparent', border: '1px solid #444', color: 'inherit', borderRadius: 4 }}
           >
             <option value="remember">Remember</option><option value="understand">Understand</option><option value="apply">Apply</option>
             <option value="analyze">Analyze</option><option value="evaluate">Evaluate</option><option value="create">Create</option>
           </select>
        </div>

        <textarea
          value={data.label}
          onChange={(e) => data.onChangeText?.(e.target.value)}
          className="nodrag"
          style={{ ...mono, fontSize: 9, opacity: 0.9, lineHeight: 1.2, background: 'transparent', border: 'none', color: 'inherit', resize: 'none', height: 40, outline: 'none', marginBottom: 4 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...mono, fontSize: 9 }}>
           <span style={{ opacity: 0.7 }}>Mastery Tgt:</span>
           <input type="number" step="0.05" min="0" max="1" value={data.masteryTarget || 0.6} onChange={(e) => data.onChangeMastery?.(parseFloat(e.target.value))} className="nodrag" style={{ width: 40, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'inherit', borderRadius: 4, textAlign: 'center' }} />
        </div>

        {data.isExpandable && (
          <div
            className="nodrag"
            onClick={(e) => { e.stopPropagation(); data.onExpandToggle?.(); }}
            style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: data.isExpanded ? data.color : 'rgba(255,255,255,0.3)', border: `2px solid ${data.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: data.isExpanded ? '#000' : '#fff', cursor: 'pointer', zIndex: 10 }}
          >
            {data.isExpanded ? '−' : '+'}
          </div>
        )}
        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
      </div>
    </>
  );
};

const TopicNode = ({ data, selected }: { data: Record<string, any>, selected?: boolean }) => {
  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.8)', borderRadius: 8, backdropFilter: 'blur(12px)' }}>
          <Btn size="sm" onClick={() => data.onRemove?.()} style={{ background: 'transparent', color: '#ef4444', fontSize: 10 }}>Delete</Btn>
        </div>
      </NodeToolbar>
      <div
        style={{
          padding: '6px 12px', borderRadius: 24, minWidth: 100,
          background: selected ? 'rgba(255,255,255,0.9)' : 'rgba(30, 41, 59, 0.7)',
          border: `1px solid rgba(255,255,255,0.2)`,
          backdropFilter: 'blur(16px)',
          boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          color: selected ? '#000' : '#cbd5e1', cursor: 'pointer'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
        <Handle type="target" position={Position.Top} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
        <div style={{ ...sora, fontSize: 10, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, background: '#64748b', color: '#fff', borderRadius: 4, padding: '1px 4px' }}>TOPIC</span>
          {data.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...mono, fontSize: 9 }}>
           <span style={{ opacity: 0.7 }}>Wt:</span>
           <input type="number" step="1" min="1" max="10" value={data.weight || 1} onChange={(e) => data.onChangeWeight?.(parseInt(e.target.value))} className="nodrag" style={{ width: 30, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'inherit', borderRadius: 4, textAlign: 'center' }} />
        </div>
        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
      </div>
    </>
  );
};

const PrereqNode = ({ data }: { data: Record<string, any> }) => {
  const sem = Number(data.semesterNumber);
  const color = semesterColor(sem);
  return (
    <div
      style={{
        padding: '6px 14px', borderRadius: 4, minWidth: 110,
        background: 'rgba(244, 63, 94, 0.2)', border: `3px solid ${color}`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 0 16px ${color}33`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color: '#fff', cursor: 'default'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid ${color}` }} />
      <div style={{ ...sora, fontSize: 10, fontWeight: 700 }}>{data.title}</div>
      <div style={{ ...mono, fontSize: 9, opacity: 0.7 }}>{data.label?.slice(0, 18) || ''}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid ${color}` }} />
    </div>
  );
};

const nodeTypes = { semesterCluster: SemesterClusterNode, courseBubble: CourseBubbleNode, outcomeNode: OutcomeNode, topicNode: TopicNode, prereqNode: PrereqNode };

// -- CUSTOM EDGE (1-10 WEIGHTS) --
const CustomEdge = memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: any) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  
  const weight = data?.weight ?? 1;
  const isOutcomeLevel = data?.sourceOutcomeId || data?.targetOutcomeId;
  const isInternal = data?.isInternal;
  const color = isInternal
    ? data?.isOutcome ? '#22d3ee' : data?.isPrereq ? '#f472b6' : data?.isTopic ? '#94a3b8' : data?.isSemesterCourse ? '#fbbf24' : '#64748b'
    : data?.isCoreq ? '#fbbf24' : data?.isCross ? '#a78bfa' : isOutcomeLevel ? '#00f0ff' : T.accent;

  const baseWidth = isInternal
    ? data?.isOutcome ? 2.5 : data?.isPrereq ? 2.5 : data?.isSemesterCourse ? 3 : 1.5
    : Math.max(2, weight * 1.5);
  
  const handleWeightChange = (e: any) => {
     let val = parseFloat(e.target.value);
     if (isNaN(val)) return;
     val = Math.max(0, Math.min(10, val));
     setEdges(eds => eds.map(ed => ed.id === id ? { ...ed, data: { ...ed.data, weight: val } } : ed));
  };

  const internalStyle = isInternal ? { strokeWidth: 1, opacity: 0.35, strokeDasharray: '2,4', filter: 'none' } : {};

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: baseWidth,
          stroke: color,
          strokeDasharray: isInternal ? (data?.isOutcome || data?.isPrereq ? '4,4' : data?.isSemesterCourse ? 'none' : '2,4') : isOutcomeLevel ? '5,5' : 'none',
          opacity: isInternal ? (data?.isOutcome || data?.isPrereq ? 0.65 : data?.isSemesterCourse ? 0.8 : 0.35) : 1,
          filter: `drop-shadow(0 0 ${isInternal ? 3 : 6}px ${color})`,
        }}
      />

      {!isInternal && isOutcomeLevel && (
        <circle r="4" fill="#fff" filter={`drop-shadow(0 0 8px #fff)`}>
          <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {!isInternal && !isOutcomeLevel && data?.edgeKind === 'added' && (
        <circle r="3" fill={color} filter={`drop-shadow(0 0 6px ${color})`}>
          <animateMotion dur="3.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {!isInternal && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="nodrag nopan">
            <div style={{ background: T.bg, padding: '4px 8px', borderRadius: 8, border: `1px solid ${color}`, ...mono, fontSize: 10, color: T.text, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <div style={{ color, fontWeight: 700 }}>{isOutcomeLevel ? 'outcome-link' : data?.isCoreq ? 'coreq' : data?.isCross ? 'cross' : 'prereq'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: T.muted }}>wt:</span>
                <input type="number" min="0" max="10" step="0.5" value={weight} onChange={handleWeightChange} className="nodrag" style={{ width: 40, background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, color: T.text, ...mono, fontSize: 10, textAlign: 'center' }} />
              </div>
              <button onClick={(e) => { e.stopPropagation(); setEdges(eds => eds.filter(ed => ed.id !== id)); }} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', padding: 0, marginTop: 2 }}>remove</button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
CustomEdge.displayName = 'CustomEdge';
const edgeTypes = { custom: CustomEdge };

// -- MAIN LOGIC --

export type SystemAdminCurriculumGraphWorkspaceProps = { batchId: string; themeMode?: ThemeMode; apiClient?: AirMentorApiClient; };
export function SystemAdminCurriculumGraphWorkspace({ batchId, themeMode = 'frosted-focus-dark', apiClient: providedApiClient }: SystemAdminCurriculumGraphWorkspaceProps) {
  const apiClient = useMemo(() => providedApiClient ?? new AirMentorApiClient(getConfiguredApiBaseUrl()), [providedApiClient]);
  return <ReactFlowProvider><CurriculumGraphContent batchId={batchId} themeMode={themeMode} apiClient={apiClient} /></ReactFlowProvider>;
}

function CurriculumGraphContent({ batchId, themeMode, apiClient }: { batchId: string; themeMode: ThemeMode; apiClient: AirMentorApiClient }) {
  const [, setGraph] = useState<ApiCurriculumGraphBundle | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiGraphNode[]>([]);
  const [apiEdges, setApiEdges] = useState<ApiGraphEdge[]>([]);

  const [expandedSemesters, setExpandedSemesters] = useState<Set<number>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedOutcomes, setExpandedOutcomes] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Ghost line for right-drag edge creation
  const [ghostLine, setGhostLine] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);

  const { fitView, screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  const isLight = isLightTheme(themeMode);

  // -- RIGHT-CLICK EDGE CREATION --
  const rightClickDragRef = useRef<{ active: boolean; sourceId: string | null; start: { x: number; y: number } }>({ active: false, sourceId: null, start: { x: 0, y: 0 } });

  // -- DRAG-DROP TOOLBAR --
  const [draggingFromToolbar, setDraggingFromToolbar] = useState<string | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const [trashHot, setTrashHot] = useState(false);
  const dragStartRef = useRef<{ id: string; x: number; y: number } | null>(null);

  // Calm physics: only semesters get gentle target-seeking; courses use parentId
  useForceLayout({ semesterCount: 8, expandedSemesters });

  // Compute what to render based on expanded states
  useEffect(() => {
    let newRfNodes: Node[] = [];
    let newRfEdges: Edge[] = [];
    
    const bySem = new Map<number, ApiGraphNode[]>();
    for (let i = 1; i <= 8; i++) bySem.set(i, []);
    apiNodes.forEach(n => {
      const s = n.semesterNumber || 1;
      if (!bySem.has(s)) bySem.set(s, []);
      bySem.get(s)!.push(n);
    });

    // Build prereq mapping
    const prereqsOf = new Map<string, string[]>();
    apiEdges.forEach(e => {
      if (e.edgeKind === 'explicit' || e.edgeKind === 'added') {
        if (!prereqsOf.has(e.targetDraftNodeId)) prereqsOf.set(e.targetDraftNodeId, []);
        prereqsOf.get(e.targetDraftNodeId)!.push(e.sourceDraftNodeId);
      }
    });

    bySem.forEach((courses, sem) => {
      // Always render the semester cluster node so any edges referencing it are safe
      newRfNodes.push({
        id: `sem-cluster-${sem}`,
        type: 'semesterCluster',
        position: { x: 0, y: 0 },
        data: {
          semesterNumber: sem, courseCount: courses.length, isExpanded: expandedSemesters.has(sem),
          onClick: () => setSelectedNodeId(prev => prev === `sem-cluster-${sem}` ? null : `sem-cluster-${sem}`),
          onToggle: () => setExpandedSemesters(prev => {
            const n = new Set(prev);
            if (n.has(sem)) {
              n.delete(sem);
              // Collapse all courses in this semester too
              const courseIds = (bySem.get(sem) || []).map(c => c.draftNodeId);
              setExpandedCourses(prevCo => {
                const nco = new Set(prevCo);
                courseIds.forEach(id => nco.delete(id));
                return nco;
              });
            } else n.add(sem);
            return n;
          })
        }
      });

      if (expandedSemesters.has(sem)) {
        const coursesInSem = courses;
        courses.forEach((c, cIdx) => {
          const count = coursesInSem.length;
          const angle = count === 1 ? 0 : (cIdx / count) * Math.PI * 2;
          const ORBIT_R = 240;
          newRfNodes.push({
            id: c.draftNodeId,
            type: 'courseBubble',
            parentId: `sem-cluster-${sem}`,
            position: { x: ORBIT_R * Math.cos(angle), y: ORBIT_R * Math.sin(angle) },
            data: {
              ...c,
              isExpanded: expandedCourses.has(c.draftNodeId),
              onClick: () => setSelectedNodeId(prev => prev === c.draftNodeId ? null : c.draftNodeId),
              onExpandToggle: () => {
                setExpandedCourses(prev => {
                  const n = new Set(prev);
                  if (n.has(c.draftNodeId)) n.delete(c.draftNodeId);
                  else n.add(c.draftNodeId);
                  return n;
                });
              },
              onUpdate: (patch: any) => {
                setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, ...patch } : n));
              },
              onAddOutcome: () => {
                setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                  ...n,
                  outcomes: [...(n.outcomes || []), { id: crypto.randomUUID(), desc: 'New Outcome', bloom: 'remember', masteryTarget: 0.6 }]
                } : n));
              },
              onAddTopic: () => {
                const title = prompt('Topic text?');
                if (title) {
                  setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                    ...n,
                    topicPartitions: { ...(n.topicPartitions || {}), tt1: [...(n.topicPartitions?.tt1 || []), title] }
                  } : n));
                }
              }
            }
          });

          // Visual line semester -> course when expanded
          newRfEdges.push({
            id: `internal-sem-${sem}-${c.draftNodeId}`,
            source: `sem-cluster-${sem}`,
            target: c.draftNodeId,
            type: 'custom',
            data: { isInternal: true, isSemesterCourse: true }
          });

          // -- DUAL-HEMISPHERE EXPANSION --
          if (expandedCourses.has(c.draftNodeId)) {
            const CENTER_X = 70;
            const CENTER_Y = 70;
            const RADIUS = 260;

            const outcomes = c.outcomes || [];
            const prereqIds = prereqsOf.get(c.draftNodeId) || [];

            // RIGHT HEMISPHERE: Outcomes (angles -PI/2 to PI/2)
            outcomes.forEach((o: any, idx: number) => {
              const angle = outcomes.length === 1 ? 0 : (-Math.PI / 2) + (Math.PI * (idx / (outcomes.length - 1)));
              const coId = `co-${c.draftNodeId}-${o.id}`;
              newRfNodes.push({
                id: coId, type: 'outcomeNode', parentId: c.draftNodeId,
                position: { x: CENTER_X + RADIUS * Math.cos(angle) - 60, y: CENTER_Y + RADIUS * Math.sin(angle) - 40 },
                data: {
                  title: `CO${idx + 1}: ${o.bloom}`, label: o.desc, color: '#22d3ee',
                  bloomLevel: o.bloom, masteryTarget: o.masteryTarget,
                  isExpandable: true,
                  isExpanded: expandedOutcomes.has(coId),
                  onExpandToggle: () => setExpandedOutcomes(prev => {
                    const n = new Set(prev);
                    if (n.has(coId)) n.delete(coId);
                    else n.add(coId);
                    return n;
                  }),
                  onChangeBloom: (val: string) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                    ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, bloom: val } : ox)
                  } : n)),
                  onChangeMastery: (val: number) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                    ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, masteryTarget: val } : ox)
                  } : n)),
                  onChangeText: (text: string) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                    ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, desc: text } : ox)
                  } : n)),
                  onRemove: () => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                    ...n, outcomes: n.outcomes.filter((ox: any) => ox.id !== o.id)
                  } : n))
                }
              });

              newRfEdges.push({
                id: `internal-co-${coId}`,
                source: c.draftNodeId,
                target: coId,
                type: 'custom',
                data: { isInternal: true, isOutcome: true }
              });
            });

            // LEFT HEMISPHERE: Prerequisites (angles PI/2 to 3PI/2)
            prereqIds.forEach((prereqId, idx) => {
              const prereqNode = apiNodes.find(n => n.draftNodeId === prereqId);
              if (!prereqNode) return;
              const angle = prereqIds.length === 1 ? Math.PI : (Math.PI / 2) + (Math.PI * (idx / (prereqIds.length - 1)));
              const prNodeId = `pr-${c.draftNodeId}-${prereqId}`;
              newRfNodes.push({
                id: prNodeId,
                type: 'prereqNode', parentId: c.draftNodeId,
                position: { x: CENTER_X + RADIUS * Math.cos(angle) - 60, y: CENTER_Y + RADIUS * Math.sin(angle) - 20 },
                data: { title: prereqNode.courseCode, label: prereqNode.title, color: '#f472b6', semesterNumber: prereqNode.semesterNumber }
              });
              newRfEdges.push({
                id: `internal-pr-${c.draftNodeId}-${prereqId}`,
                source: prNodeId,
                target: c.draftNodeId,
                type: 'custom',
                data: { isInternal: true, isPrereq: true }
              });
            });

            // Topics: only shown when a specific outcome is expanded
            outcomes.forEach((o, oIdx) => {
              const coId = `co-${c.draftNodeId}-${o.id}`;
              if (!expandedOutcomes.has(coId)) return;
              const allTopics: { kind: string; title: string }[] = [];
              Object.entries(c.topicPartitions || {}).forEach(([kind, topics]) => {
                (topics as string[]).forEach((t) => allTopics.push({ kind, title: t }));
              });
              if (allTopics.length === 0) return;
              const orbitR = 140;
              allTopics.forEach((topic, tIdx) => {
                const total = allTopics.length;
                const angle = total === 1 ? Math.PI / 2 : Math.PI / 4 + (Math.PI * (tIdx / (total - 1)));
                const tpId = `tp-${coId}-${topic.kind}-${tIdx}`;
                const wJson = (c as any).topicPartitionWeightsJson || {};
                newRfNodes.push({
                  id: tpId, type: 'topicNode', parentId: coId,
                  position: { x: 60 + orbitR * Math.cos(angle) - 50, y: 40 + orbitR * Math.sin(angle) - 20 },
                  data: {
                    label: `[${topic.kind.toUpperCase()}] ${topic.title}`, weight: wJson[topic.title] || 1,
                    onChangeWeight: (val: number) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                      ...n, topicPartitionWeightsJson: { ...((n as any).topicPartitionWeightsJson || {}), [topic.title]: val }
                    } : n)),
                    onRemove: () => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? {
                      ...n, topicPartitions: { ...n.topicPartitions, [topic.kind]: ((n.topicPartitions as any)[topic.kind as any] as string[]).filter((tx: string) => tx !== topic.title) }
                    } : n))
                  }
                });
                newRfEdges.push({
                  id: `internal-tp-${tpId}`,
                  source: coId,
                  target: tpId,
                  type: 'custom',
                  data: { isInternal: true, isTopic: true }
                });
              });
            });
          }
        });
      } else {
        // collapsed state: no extra nodes beyond the semester cluster (already added above)
      }
    });

    // -- EDGES --
    apiEdges.forEach(e => {
      const srcNode = apiNodes.find(n => n.draftNodeId === e.sourceDraftNodeId);
      const tgtNode = apiNodes.find(n => n.draftNodeId === e.targetDraftNodeId);
      if (!srcNode || !tgtNode) return;
      const srcSem = srcNode.semesterNumber || 1;
      const tgtSem = tgtNode.semesterNumber || 1;
      let srcId = `sem-cluster-${srcSem}`;
      if (expandedSemesters.has(srcSem)) srcId = srcNode.draftNodeId;
      if (expandedCourses.has(srcNode.draftNodeId) && e.sourceOutcomeId) srcId = `co-${srcNode.draftNodeId}-${e.sourceOutcomeId}`;
      let tgtId = `sem-cluster-${tgtSem}`;
      if (expandedSemesters.has(tgtSem)) tgtId = tgtNode.draftNodeId;
      if (expandedCourses.has(tgtNode.draftNodeId) && e.targetOutcomeId) tgtId = `co-${tgtNode.draftNodeId}-${e.targetOutcomeId}`;
      if (srcId === tgtId) return;
      newRfEdges.push({
        id: e.draftEdgeId, source: srcId, target: tgtId,
        type: 'custom', animated: e.edgeKind === 'added' || !!e.sourceOutcomeId,
        data: { weight: e.weight, isCoreq: e.edgeKind === 'corequisite', isCross: e.edgeKind === 'cross_semester', sourceOutcomeId: e.sourceOutcomeId, targetOutcomeId: e.targetOutcomeId }
      });
    });

    setRfNodes(current => {
      const posMap = new Map(current.map(n => [n.id, n.position]));
      return newRfNodes.map(n => {
        // Preserve position only for D3-managed top-level semester nodes.
        // Child nodes (courses, outcomes, prereqs, topics) always use freshly
        // computed orbital positions — React Flow handles parent-relative drag.
        if (!n.parentId && n.type === 'semesterCluster') {
          const existingPos = posMap.get(n.id);
          return existingPos ? { ...n, position: existingPos } : n;
        }
        return n;
      });
    });
    setRfEdges(newRfEdges);
  }, [apiNodes, apiEdges, expandedSemesters, expandedCourses, expandedOutcomes, isLight, selectedNodeId]);

  const reloadGraph = useCallback(async () => {
    try {
      const bundle = await apiClient.getCurriculumGraph(batchId);
      setGraph(bundle);
      setApiNodes(bundle.nodes);
      setApiEdges(bundle.edges);
      setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 200);
    } catch (err: unknown) { console.error(err); }
    finally { setLoading(false); }
  }, [apiClient, batchId, fitView]);

  useEffect(() => { reloadGraph(); }, [reloadGraph]);

  // -- ON CONNECT (standard left-click) --
  const onConnect = useCallback((params: Connection) => {
    const parseCourseId = (id: string) => id.startsWith('co-') || id.startsWith('tp-') ? id.split('-')[1] : id;
    const parseOutcomeId = (id: string) => id.startsWith('co-') ? id.split('-').slice(2).join('-') : undefined;
    const srcCourseId = parseCourseId(params.source);
    const tgtCourseId = parseCourseId(params.target);
    const srcCourse = apiNodes.find(n => n.draftNodeId === srcCourseId);
    const tgtCourse = apiNodes.find(n => n.draftNodeId === tgtCourseId);
    if (!srcCourse || !tgtCourse) return;
    const srcType = params.source?.split('-')[0];
    const tgtType = params.target?.split('-')[0];
    if (srcType === 'tp' && tgtType === 'co') {
      if (srcCourseId !== tgtCourseId) { alert('Internal mappings must remain within the same course bubble.'); return; }
      setRfEdges(eds => [...eds, { id: `manual-tp-co-${crypto.randomUUID()}`, source: params.source, target: params.target, type: 'default', animated: true, style: { strokeDasharray: '4', stroke: '#00f0ff' }, data: { isInternal: true } }]);
      return;
    }
    if (srcType === 'tp' || tgtType === 'tp') { alert('Topics can only be linked to Outcomes (Topic -> Outcome).'); return; }
    if (srcCourse.semesterNumber >= tgtCourse.semesterNumber) {
      alert(`Temporal Error: Prerequisites must flow strictly forward in time.`);
      return;
    }
    const newEdge: ApiGraphEdge = {
      draftEdgeId: crypto.randomUUID(), baseCurriculumEdgeId: null,
      sourceDraftNodeId: srcCourseId, targetDraftNodeId: tgtCourseId,
      sourceOutcomeId: parseOutcomeId(params.source), targetOutcomeId: parseOutcomeId(params.target),
      edgeKind: 'added', rationale: 'Manually mapped', weight: 1
    };
    setApiEdges(eds => [...eds, newEdge]);
  }, [apiNodes]);

  // -- RIGHT-CLICK EDGE CREATION (drag) --
  const handleContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
  }, []);

  const parseCourseId = (id: string) => id.startsWith('co-') || id.startsWith('tp-') || id.startsWith('pr-') ? id.split('-')[1] : id;
  const parseOutcomeId = (id: string) => id.startsWith('co-') ? id.split('-').slice(2).join('-') : undefined;

  const createEdgeBetween = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const srcCourseId = parseCourseId(sourceId);
    const tgtCourseId = parseCourseId(targetId);
    const srcCourse = apiNodes.find(n => n.draftNodeId === srcCourseId);
    const tgtCourse = apiNodes.find(n => n.draftNodeId === tgtCourseId);
    if (!srcCourse || !tgtCourse) return;
    if (srcCourse.semesterNumber >= tgtCourse.semesterNumber) {
      alert('Prerequisites must flow forward in time.');
      return;
    }
    const newEdge: ApiGraphEdge = {
      draftEdgeId: crypto.randomUUID(), baseCurriculumEdgeId: null,
      sourceDraftNodeId: srcCourseId, targetDraftNodeId: tgtCourseId,
      sourceOutcomeId: parseOutcomeId(sourceId), targetOutcomeId: parseOutcomeId(targetId),
      edgeKind: 'added', rationale: 'Right-drag edge', weight: 1
    };
    setApiEdges(eds => [...eds, newEdge]);
  }, [apiNodes]);

  const isSubnode = (id: string) => id.startsWith('co-') || id.startsWith('pr-');

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    // Only allow edge drawing from subnodes (outcomes / prereqs)
    if (!isSubnode(node.id)) {
      setGhostLine(null);
      return;
    }
    rightClickDragRef.current = { active: true, sourceId: node.id, start: { x: event.clientX, y: event.clientY } };
    setGhostLine({ from: { x: event.clientX, y: event.clientY }, to: { x: event.clientX, y: event.clientY } });
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!rightClickDragRef.current.active) return;
      setGhostLine({ from: rightClickDragRef.current.start, to: { x: e.clientX, y: e.clientY } });
    };
    const onUp = (e: MouseEvent) => {
      if (!rightClickDragRef.current.active) return;
      const sourceId = rightClickDragRef.current.sourceId;
      // Use elementFromPoint to reliably find the node under the cursor
      let targetId: string | null = null;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        let nodeEl = el.closest('[data-id]') as HTMLElement | null;
        if (!nodeEl) {
          let p: HTMLElement | null = el as HTMLElement;
          while (p && !p.classList?.contains('react-flow__node') && !p.hasAttribute?.('data-id')) {
            p = p.parentElement;
          }
          if (p) nodeEl = p;
        }
        if (nodeEl) {
          const id = nodeEl.getAttribute('data-id');
          if (id && id !== sourceId) targetId = id;
        }
      }
      // Only allow edges between subnodes (outcomes / prereqs)
      if (sourceId && targetId && isSubnode(sourceId) && isSubnode(targetId)) {
        createEdgeBetween(sourceId, targetId);
      }
      rightClickDragRef.current = { active: false, sourceId: null, start: { x: 0, y: 0 } };
      setGhostLine(null);
      setHoverNodeId(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [createEdgeBetween]);

  // -- EDGE RIGHT-CLICK DELETE --
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    setApiEdges(eds => eds.filter(e => e.draftEdgeId !== edge.id));
  }, []);

  // -- DRAG-DROP TOOLBAR --
  const handleToolbarDragStart = (type: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type }));
    setDraggingFromToolbar(type);
  };
  const handleToolbarDragEnd = () => setDraggingFromToolbar(null);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const dataStr = event.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (data.type === 'course') {
      const sem = Math.max(1, Math.round(flowPos.x / 300) + 1);
      const newNode: ApiGraphNode = {
        draftNodeId: `course-${crypto.randomUUID()}`,
        courseCode: 'NEW', title: 'New Course', semesterNumber: sem, credits: 3,
        positionX: flowPos.x, positionY: flowPos.y,
        assessmentProfile: 'theory', outcomes: [], bridgeModules: [],
        topicPartitions: { tt1: [], tt2: [], see: [], workbook: [] }
      };
      setApiNodes(prev => [...prev, newNode]);
    } else if (data.type === 'semester') {
      const sem = Math.max(1, Math.round(flowPos.x / 300) + 1);
      // Adding a semester just means adding a course to it — the semester cluster is visual-only.
      // Create a placeholder course in that semester.
      const newNode: ApiGraphNode = {
        draftNodeId: `course-${crypto.randomUUID()}`,
        courseCode: 'NEW', title: 'New Course', semesterNumber: sem, credits: 3,
        positionX: flowPos.x, positionY: flowPos.y,
        assessmentProfile: 'theory', outcomes: [], bridgeModules: [],
        topicPartitions: { tt1: [], tt2: [], see: [], workbook: [] }
      };
      setApiNodes(prev => [...prev, newNode]);
      setExpandedSemesters(prev => {
        const n = new Set(prev); n.add(sem); return n;
      });
    }
  }, [screenToFlowPosition]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Track trash hover on node drag
  const handleNodeDrag = useCallback((_event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => {
    if (!trashRef.current) return;
    const rect = trashRef.current.getBoundingClientRect();
    const clientX = (_event as MouseEvent).clientX ?? (_event as TouchEvent).touches?.[0]?.clientX;
    const clientY = (_event as MouseEvent).clientY ?? (_event as TouchEvent).touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return;
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    setTrashHot(inside);
  }, []);

  const handleNodeDragStart = useCallback((_event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => {
    dragStartRef.current = { id: node.id, x: node.position.x, y: node.position.y };
  }, []);

  const handleNodeDragStop = useCallback((event: React.MouseEvent | MouseEvent | TouchEvent, node: Node) => {
    if (!trashRef.current) return;
    const rect = trashRef.current.getBoundingClientRect();
    const clientX = (event as MouseEvent).clientX ?? (event as TouchEvent).changedTouches?.[0]?.clientX;
    const clientY = (event as MouseEvent).clientY ?? (event as TouchEvent).changedTouches?.[0]?.clientY;
    if (clientX == null || clientY == null) return;
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    setTrashHot(false);
    if (inside) {
      setApiNodes(prev => prev.filter(n => n.draftNodeId !== node.id));
      setApiEdges(prev => prev.filter(ed => ed.sourceDraftNodeId !== node.id && ed.targetDraftNodeId !== node.id));
    }
  }, []);

  // -- SAVE --
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.saveCurriculumGraphDraft(batchId, { nodes: apiNodes, edges: apiEdges });
    } catch (err) { console.error('Save failed', err); }
    finally { setSaving(false); }
  }, [apiClient, batchId, apiNodes, apiEdges]);

  const handleNodesChange = useCallback((changes: any) => setRfNodes((nds: any) => applyNodeChanges(changes, nds)), []);
  const handleEdgesChange = useCallback((changes: any) => setRfEdges((eds: any) => applyEdgeChanges(changes, eds)), []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) return <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}><Loader2 size={40} className="animate-spin" /></div>;

  return (
    <div ref={containerRef} style={{ width: '100%', height: isFullscreen ? '100vh' : '100%', minHeight: 640, display: 'flex', background: isLight ? '#f4f4f5' : T.bg, color: T.text, overflow: 'hidden', position: 'relative' }}>

      {/* MAIN CANVAS */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneContextMenu={handleContextMenu}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            if (node.type === 'courseBubble') {
              setExpandedCourses(prev => {
                const n = new Set(prev);
                if (n.has(node.id)) {
                  n.delete(node.id);
                  // Collapse all outcomes of this course too
                  setExpandedOutcomes(prevO => {
                    const no = new Set(prevO);
                    prevO.forEach(oid => { if (oid.startsWith(`co-${node.id}-`)) no.delete(oid); });
                    return no;
                  });
                } else n.add(node.id);
                return n;
              });
            }
            if (node.type === 'semesterCluster') {
              const sem = Number(node.data?.semesterNumber);
              const currentlyExpanded = expandedSemesters.has(sem);
              if (currentlyExpanded) {
                setExpandedSemesters(prev => {
                  const n = new Set(prev);
                  n.delete(sem);
                  return n;
                });
                const courseIds = apiNodes.filter(n => n.semesterNumber === sem).map(n => n.draftNodeId);
                setExpandedCourses(prev => {
                  const n = new Set(prev);
                  courseIds.forEach(id => n.delete(id));
                  return n;
                });
              } else {
                setExpandedSemesters(prev => new Set([...prev, sem]));
              }
            }
          }}
          onPaneClick={() => setSelectedNodeId(null)}
          onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
          onNodeMouseLeave={() => setHoverNodeId(null)}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
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
              <Btn size="sm" style={{ background: T.accent, color: '#fff' }} onClick={handleSave} disabled={saving}>
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

      {/* BOTTOM TOOLBAR */}
      <div
        style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          zIndex: 50
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            padding: '10px 18px',
            borderRadius: 24,
            ...getGlass(isLight),
            display: 'flex', gap: 16, alignItems: 'center',
            transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(-8px) scale(1.05)';
            el.style.boxShadow = isLight ? '0 12px 40px rgba(0,0,0,0.12)' : '0 12px 40px rgba(0,0,0,0.5)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(0) scale(1)';
            el.style.boxShadow = isLight ? '0 8px 32px rgba(0,0,0,0.05)' : '0 8px 32px rgba(0,0,0,0.4)';
          }}
        >
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.muted, fontWeight: 600 }}>Toolbox</div>
          <div style={{ width: 1, height: 20, background: T.border, opacity: 0.4 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              draggable
              onDragStart={handleToolbarDragStart('course')}
              onDragEnd={handleToolbarDragEnd}
              style={{
                width: 48, height: 48, borderRadius: '50%', background: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'grab', color: '#fff', boxShadow: `0 0 14px ${T.accent}66`,
                border: '2px solid rgba(255,255,255,0.3)'
              }}
              title="Drag to add Course"
            >
              <GraduationCap size={20} />
            </div>
            <div
              draggable
              onDragStart={handleToolbarDragStart('semester')}
              onDragEnd={handleToolbarDragEnd}
              style={{
                width: 48, height: 48, borderRadius: '50%', background: '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'grab', color: '#fff', boxShadow: '0 0 14px rgba(99,102,241,0.45)',
                border: '2px solid rgba(255,255,255,0.3)'
              }}
              title="Drag to add Semester"
            >
              <BookOpen size={20} />
            </div>
            <div
              ref={trashRef}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: trashHot ? '#ef4444' : 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: `2px solid ${trashHot ? '#ef4444' : 'rgba(239,68,68,0.5)'}`,
                boxShadow: trashHot ? '0 0 14px rgba(239,68,68,0.5)' : 'none'
              }}
              title="Drag node here to delete"
            >
              <Trash2 size={20} color={trashHot ? '#fff' : '#ef4444'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
