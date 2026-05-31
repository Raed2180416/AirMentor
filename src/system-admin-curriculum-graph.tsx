import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow, Controls, Background, MiniMap, applyNodeChanges, applyEdgeChanges,
  Panel, Handle, Position, ReactFlowProvider, BaseEdge, EdgeLabelRenderer, getBezierPath,
  useReactFlow, NodeToolbar
} from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { T, sora, mono } from './data';
import { Btn } from './ui-primitives';
import {
  Save, Loader2, Maximize2, Minimize2, Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.05 }}
      onClick={data.onExpand}
      style={{
        width: 120, height: 120, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}ee, ${color}aa)`,
        border: `4px solid ${color}`, boxShadow: `0 0 32px ${color}44, inset 0 -10px 20px rgba(0,0,0,0.2)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', cursor: 'pointer', position: 'relative'
      }}
    >
      <div style={{ ...sora, fontSize: 16, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Sem {sem}</div>
      <div style={{ ...mono, fontSize: 11, opacity: 0.9, marginTop: 4 }}>{data.courseCount ?? 0} subjects</div>
    </motion.div>
  );
};

const CourseBubbleNode = ({ data, selected }: { data: Record<string, any>, selected?: boolean }) => {
  const sem = Number(data.semesterNumber);
  const color = semesterColor(sem);
  const handleLongPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onMouseDown = () => { handleLongPress.current = setTimeout(() => data.onLongClick(), 600); };
  const onMouseUp = () => { if (handleLongPress.current) clearTimeout(handleLongPress.current); };
  const onClick = () => { if (handleLongPress.current) clearTimeout(handleLongPress.current); data.onClick(); };

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.8)', borderRadius: 8, backdropFilter: 'blur(12px)' }}>
          <Btn size="sm" onClick={() => { const code = prompt('Course Code?'); if (code) data.onUpdate({ courseCode: code }); }} style={{ background: 'transparent', color: '#fff', fontSize: 10 }}>Edit Code</Btn>
          <div style={{ width: 1, background: '#444' }} />
          <Btn size="sm" onClick={() => data.onAddOutcome?.()} style={{ background: 'transparent', color: '#ec4899', fontSize: 10 }}>+ Outcome</Btn>
          <Btn size="sm" onClick={() => data.onAddTopic?.()} style={{ background: 'transparent', color: '#6366f1', fontSize: 10 }}>+ Topic</Btn>
        </div>
      </NodeToolbar>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.05 }}
        onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onClick={onClick}
        style={{
          width: 140, height: 140, borderRadius: '50%',
          background: selected ? `linear-gradient(135deg, ${color}, ${color}dd)` : `linear-gradient(135deg, ${color}dd, ${color}99)`,
          border: selected ? `4px solid #fff` : `2px solid ${color}`,
          boxShadow: selected ? `0 0 0 4px ${color}, 0 8px 24px ${color}66` : '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', position: 'relative'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: 'transparent', border: 'none' }} />
        <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none' }} />
        <div style={{ ...sora, fontSize: 14, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, padding: '0 10px' }}>{data.courseCode || 'NEW'}</div>
        <button className="nodrag" onClick={(e) => { e.stopPropagation(); data.onExpandToggle(); }} style={{ position: 'absolute', bottom: -12, background: '#1e293b', color: '#fff', border: `2px solid ${color}`, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          {data.isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
        <Handle type="source" position={Position.Right} style={{ background: 'transparent', border: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none' }} />
        
        <AnimatePresence>
          {data.isExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="nodrag" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 16, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', border: `1px solid ${color}`, borderRadius: 12, padding: 12, width: 220, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 20 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>ML Configuration</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 9, color: '#cbd5e1' }}>Assessment Profile</label>
                <select value={data.assessmentProfile || 'theory'} onChange={(e) => data.onUpdate({ assessmentProfile: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #334155', color: '#fff', fontSize: 10, borderRadius: 4, padding: '2px 4px' }}>
                  <option value="theory">Theory (TT1, TT2, SEE)</option>
                  <option value="lab">Lab / Practical</option>
                  <option value="project">Project Based</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <label style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={data.tt1Missing || false} onChange={e => data.onUpdate({ tt1Missing: e.target.checked })} /> TT1 Mssg</label>
                <label style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={data.tt2Missing || false} onChange={e => data.onUpdate({ tt2Missing: e.target.checked })} /> TT2 Mssg</label>
                <label style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={data.seeMissing || false} onChange={e => data.onUpdate({ seeMissing: e.target.checked })} /> SEE Mssg</label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 9, color: '#cbd5e1' }}>Uplift Target: {(data.uplift_see || 0) * 100}%</label>
                <input type="range" min="0" max="0.5" step="0.05" value={data.uplift_see || 0} onChange={e => data.onUpdate({ uplift_see: parseFloat(e.target.value) })} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
      <motion.div
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          padding: '8px 12px', borderRadius: 24, minWidth: 120,
          background: selected ? 'rgba(255,255,255,0.9)' : 'rgba(15, 23, 42, 0.7)',
          border: `2px solid ${data.color}`,
          backdropFilter: 'blur(16px)',
          boxShadow: `0 4px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)`,
          display: 'flex', flexDirection: 'column',
          color: selected ? '#000' : '#fff', cursor: 'pointer'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        <Handle type="target" position={Position.Top} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
           <div style={{ ...sora, fontSize: 11, fontWeight: 700 }}>{data.title}</div>
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

        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: `2px solid ${data.color}` }} />
      </motion.div>
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
      <motion.div
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
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
        <div style={{ ...sora, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...mono, fontSize: 9 }}>
           <span style={{ opacity: 0.7 }}>Wt:</span>
           <input type="number" step="1" min="1" max="10" value={data.weight || 1} onChange={(e) => data.onChangeWeight?.(parseInt(e.target.value))} className="nodrag" style={{ width: 30, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'inherit', borderRadius: 4, textAlign: 'center' }} />
        </div>
        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: `2px solid #94a3b8` }} />
      </motion.div>
    </>
  );
};

const nodeTypes = { semesterCluster: SemesterClusterNode, courseBubble: CourseBubbleNode, outcomeNode: OutcomeNode, topicNode: TopicNode };

// -- CUSTOM EDGE (1-10 WEIGHTS) --
const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: any) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  
  const weight = data?.weight ?? 1;
  const isOutcomeLevel = data?.sourceOutcomeId || data?.targetOutcomeId;
  const color = data?.isCoreq ? '#fbbf24' : data?.isCross ? '#a78bfa' : isOutcomeLevel ? '#00f0ff' : T.accent;
  
  const handleWeightChange = (e: any) => {
     let val = parseFloat(e.target.value);
     if (isNaN(val)) return;
     val = Math.max(0, Math.min(10, val));
     setEdges(eds => eds.map(ed => ed.id === id ? { ...ed, data: { ...ed.data, weight: val } } : ed));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: Math.max(2, weight * 1.5), stroke: color, strokeDasharray: isOutcomeLevel ? '5,5' : 'none', filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 12px ${color})` }} />
      {isOutcomeLevel && (
        <circle r="4" fill="#fff" filter={`drop-shadow(0 0 8px #fff)`}>
          <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {!isOutcomeLevel && data?.edgeKind === 'added' && (
        <circle r="3" fill={color} filter={`drop-shadow(0 0 6px ${color})`}>
          <animateMotion dur="3.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
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
    </>
  );
};
const edgeTypes = { custom: CustomEdge };

// -- MAIN LOGIC --

export type SystemAdminCurriculumGraphWorkspaceProps = { batchId: string; themeMode: ThemeMode; apiClient?: AirMentorApiClient; };
export function SystemAdminCurriculumGraphWorkspace({ batchId, themeMode, apiClient: providedApiClient }: SystemAdminCurriculumGraphWorkspaceProps) {
  const apiClient = useMemo(() => providedApiClient ?? new AirMentorApiClient(getConfiguredApiBaseUrl()), [providedApiClient]);
  return <ReactFlowProvider><CurriculumGraphContent batchId={batchId} themeMode={themeMode} apiClient={apiClient} /></ReactFlowProvider>;
}

function CurriculumGraphContent({ batchId, themeMode, apiClient }: { batchId: string; themeMode: ThemeMode; apiClient: AirMentorApiClient }) {
  const [, setGraph] = useState<ApiCurriculumGraphBundle | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiGraphNode[]>([]);
  const [apiEdges, setApiEdges] = useState<ApiGraphEdge[]>([]);
  
  const [expandedSemesters, setExpandedSemesters] = useState<Set<number>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  
  const isLight = isLightTheme(themeMode);

  // Initialize production-grade physics simulation
  useForceLayout({ strength: -800, distance: 250 });

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

    bySem.forEach((courses, sem) => {
      if (expandedSemesters.has(sem)) {
        courses.forEach(c => {
          newRfNodes.push({
            id: c.draftNodeId,
            type: 'courseBubble',
            position: { x: 0, y: 0 },
            data: {
              ...c,
              onClick: () => setExpandedCourses(prev => { const n = new Set(prev); n.add(c.draftNodeId); return n; }),
              isExpanded: expandedCourses.has(c.draftNodeId),
              onExpandToggle: () => {
                if (expandedCourses.has(c.draftNodeId)) {
                  setExpandedCourses(prev => { const n = new Set(prev); n.delete(c.draftNodeId); return n; });
                } else {
                  setExpandedCourses(prev => { const n = new Set(prev); n.add(c.draftNodeId); return n; });
                }
              },
              onUpdate: (patch: any) => {
                setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, ...patch } : n));
              },
              onAddOutcome: () => {
                setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, outcomes: [...(n.outcomes || []), { id: crypto.randomUUID(), desc: 'New Outcome', bloom: 'remember' }] } : n));
              },
              onAddTopic: () => {
                const title = prompt('Topic text?');
                if (title) {
                  setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, topicPartitions: { ...(n.topicPartitions || {}), tt1: [...(n.topicPartitions?.tt1 || []), title] } } : n));
                }
              }
            }
          });

          // Generate Sub-Nodes if Course is expanded
          if (expandedCourses.has(c.draftNodeId)) {
             const RADIUS_X = 180;
             const RADIUS_Y = 160;
             const CENTER_X = 70; // Half of 140px CourseBubble width
             const CENTER_Y = 70; // Half of 140px CourseBubble height

             const outcomes = c.outcomes || [];
             outcomes.forEach((o: any, idx: number) => {
               // Outcomes orbit on the RIGHT semicircle: from -pi/3 to pi/3
               const angle = outcomes.length === 1 ? 0 : (-Math.PI/3) + ((Math.PI*2/3) * (idx / (outcomes.length - 1)));
               const coId = `co-${c.draftNodeId}-${o.id}`;
               newRfNodes.push({
                 id: coId, type: 'outcomeNode', parentId: c.draftNodeId,
                 position: { x: CENTER_X + RADIUS_X * Math.cos(angle) - 60, y: CENTER_Y + RADIUS_Y * Math.sin(angle) - 40 },
                 data: { 
                   title: `CO${idx+1}: ${o.bloom}`, 
                   label: o.desc, 
                   color: semesterColor(sem),
                   bloomLevel: o.bloom,
                   masteryTarget: o.masteryTarget,
                   onChangeBloom: (val: string) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, bloom: val } : ox) } : n)),
                   onChangeMastery: (val: number) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, masteryTarget: val } : ox) } : n)),
                   onChangeText: (text: string) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, outcomes: n.outcomes.map((ox: any) => ox.id === o.id ? { ...ox, desc: text } : ox) } : n)),
                   onRemove: () => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, outcomes: n.outcomes.filter((ox: any) => ox.id !== o.id) } : n))
                 }
               });
             });
             
             const allTopics: {kind: string, title: string}[] = [];
             Object.entries(c.topicPartitions || {}).forEach(([kind, topics]) => {
                (topics as string[]).forEach((t) => allTopics.push({kind, title: t}));
             });

             allTopics.forEach((topic, idx) => {
                const outcomeIndex = outcomes.length > 0 ? idx % outcomes.length : -1;
                const parentNodeId = outcomeIndex >= 0 ? `co-${c.draftNodeId}-${outcomes[outcomeIndex].id}` : c.draftNodeId;
                
                const OUTCOME_CENTER_X = 60; 
                const OUTCOME_CENTER_Y = 40;
                const TOPIC_RADIUS_X = 140;
                const TOPIC_RADIUS_Y = 100;
                
                let pos = { x: 0, y: 0 };
                
                if (outcomeIndex >= 0) {
                  const localIdx = Math.floor(idx / outcomes.length);
                  const totalForThisOutcome = Math.ceil((allTopics.length - outcomeIndex) / outcomes.length);
                  // Orbit from -pi/3 to pi/3 relative to outcome
                  const angle = totalForThisOutcome === 1 ? 0 : (-Math.PI/3) + ((Math.PI*2/3) * (localIdx / (totalForThisOutcome - 1)));
                  pos = { 
                    x: OUTCOME_CENTER_X + TOPIC_RADIUS_X * Math.cos(angle) - 50, 
                    y: OUTCOME_CENTER_Y + TOPIC_RADIUS_Y * Math.sin(angle) - 20 
                  };
                } else {
                  const angle = allTopics.length === 1 ? 0 : (-Math.PI/3) + ((Math.PI*2/3) * (idx / (allTopics.length - 1)));
                  pos = { 
                    x: CENTER_X + RADIUS_X * Math.cos(angle) - 50, 
                    y: CENTER_Y + RADIUS_Y * Math.sin(angle) - 20 
                  };
                }

                const tpId = `tp-${c.draftNodeId}-${topic.kind}-${idx}`;
                const wJson = (c as any).topicPartitionWeightsJson || {};
                const weight = wJson[topic.title] || 1;
                
                newRfNodes.push({
                  id: tpId, type: 'topicNode', parentId: parentNodeId,
                  position: pos,
                  data: { 
                    label: `[${topic.kind.toUpperCase()}] ${topic.title}`, weight,
                    onChangeWeight: (val: number) => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, topicPartitionWeightsJson: { ...((n as any).topicPartitionWeightsJson || {}), [topic.title]: val } } : n)),
                    onRemove: () => setApiNodes(nds => nds.map(n => n.draftNodeId === c.draftNodeId ? { ...n, topicPartitions: { ...n.topicPartitions, [topic.kind]: ((n.topicPartitions as any)[topic.kind as any] as string[]).filter(tx => tx !== topic.title) } } : n))
                  }
                });
             });
          }
        });
      } else {
        if (courses.length > 0 || sem <= 8) {
          newRfNodes.push({
            id: `sem-cluster-${sem}`,
            type: 'semesterCluster',
            position: { x: 0, y: 0 },
            data: {
              semesterNumber: sem,
              courseCount: courses.length,
              onExpand: () => setExpandedSemesters(prev => { const n = new Set(prev); n.add(sem); return n; })
            }
          });
        }
      }
    });

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
        id: e.draftEdgeId,
        source: srcId, target: tgtId,
        type: 'custom', animated: e.edgeKind === 'added' || !!e.sourceOutcomeId,
        data: { weight: e.weight, isCoreq: e.edgeKind === 'corequisite', isCross: e.edgeKind === 'cross_semester', sourceOutcomeId: e.sourceOutcomeId, targetOutcomeId: e.targetOutcomeId }
      });
    });

    // Retain existing positions so force simulation doesn't reset to 0,0 constantly
    setRfNodes(current => {
      const posMap = new Map(current.map(n => [n.id, n.position]));
      return newRfNodes.map(n => ({
        ...n,
        position: posMap.get(n.id) || n.position
      }));
    });
    setRfEdges(newRfEdges);
    
  }, [apiNodes, apiEdges, expandedSemesters, expandedCourses, isLight]);

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

    // Restrict internal wires: Topic -> Outcome ONLY
    if (srcType === 'tp' && tgtType === 'co') {
       // This is an internal wire inside the course
       if (srcCourseId !== tgtCourseId) {
         alert('Internal mappings must remain within the same course bubble.');
         return;
       }
       // We would store this mapping in the Topic partitions or Outcomes logic.
       // For now, just add a UI edge
       setRfEdges(eds => [...eds, {
          id: `manual-tp-co-${crypto.randomUUID()}`, source: params.source, target: params.target,
          type: 'default', animated: true, style: { strokeDasharray: '4', stroke: '#00f0ff' },
          data: { isInternal: true }
       }]);
       return;
    }
    
    if (srcType === 'tp' || tgtType === 'tp') {
       alert('Topics can only be linked to Outcomes (Topic -> Outcome).');
       return;
    }

    if (srcCourse.semesterNumber >= tgtCourse.semesterNumber) {
      alert(`Temporal Error: Cannot map from Semester ${srcCourse.semesterNumber} to Semester ${tgtCourse.semesterNumber}. Prerequisites must flow strictly forward in time.`);
      return;
    }
    
    const newEdge: ApiGraphEdge = {
      draftEdgeId: crypto.randomUUID(), baseCurriculumEdgeId: null,
      sourceDraftNodeId: srcCourseId, targetDraftNodeId: tgtCourseId,
      sourceOutcomeId: parseOutcomeId(params.source),
      targetOutcomeId: parseOutcomeId(params.target),
      edgeKind: 'added', rationale: 'Manually mapped', weight: 1
    };
    setApiEdges(eds => [...eds, newEdge]);
  }, [apiNodes]);

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
    <div ref={containerRef} style={{ width: '100%', height: isFullscreen ? '100vh' : '100%', minHeight: 600, display: 'flex', background: isLight ? '#f4f4f5' : T.bg, color: T.text, overflow: 'hidden', position: 'relative' }}>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={(changes) => setRfNodes(applyNodeChanges(changes, rfNodes))}
          onEdgesChange={(changes) => setRfEdges(applyEdgeChanges(changes, rfEdges))}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
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
              <Btn size="sm" style={{ background: T.accent, color: '#fff' }} onClick={() => {}} disabled={saving}><Save size={14} /> Save</Btn>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
