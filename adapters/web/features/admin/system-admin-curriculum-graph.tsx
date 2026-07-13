/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- decomposed into ./curriculum-graph-workspace/*; loose typing preserved verbatim from the original monolith */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { T } from '@web/simulation/fixtures';
import { Loader2 } from 'lucide-react';
import { AirMentorApiClient } from '@web/shared/api/client';
import type { ApiCurriculumGraphBundle, ApiGraphNode, ApiGraphEdge } from '@web/shared/api/types';
import type { ThemeMode } from '@kernel/shared/domain';
import { isLightTheme } from '@web/shared/ui/theme';
import { useForceLayout } from '@web/shared/hooks/useForceLayout';
import { getConfiguredApiBaseUrl } from './curriculum-graph-workspace/curriculum-graph-helpers';
import { buildCurriculumGraphElements } from './curriculum-graph-workspace/curriculum-graph-builder';
import { CurriculumGraphCanvas } from './curriculum-graph-workspace/curriculum-graph-canvas';
import { CurriculumGraphToolbar } from './curriculum-graph-workspace/curriculum-graph-toolbar';

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
    const { nodes: newRfNodes, edges: newRfEdges } = buildCurriculumGraphElements({
      apiNodes, apiEdges, expandedSemesters, expandedCourses, expandedOutcomes,
      setApiNodes, setExpandedSemesters, setExpandedCourses, setExpandedOutcomes, setSelectedNodeId,
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
      <CurriculumGraphCanvas
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
        isLight={isLight}
        showMinimap={showMinimap}
        setShowMinimap={setShowMinimap}
        toggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        onSave={handleSave}
        saving={saving}
        ghostLine={ghostLine}
      />

      {/* BOTTOM TOOLBAR */}
      <CurriculumGraphToolbar
        isLight={isLight}
        handleToolbarDragStart={handleToolbarDragStart}
        handleToolbarDragEnd={handleToolbarDragEnd}
        trashRef={trashRef}
        trashHot={trashHot}
      />
    </div>
  );
}
