/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type { Dispatch, SetStateAction } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { ApiGraphNode, ApiGraphEdge } from '@web/shared/api/types';

// -- MAIN LOGIC (rendered node/edge derivation) --
// Pure derivation of the React Flow node/edge sets from the API graph plus the
// current expansion state. Extracted verbatim from the CurriculumGraphContent
// build effect; setState dispatchers are passed in so the node `data` callbacks
// keep the exact same closures as before.
export function buildCurriculumGraphElements({
  apiNodes,
  apiEdges,
  expandedSemesters,
  expandedCourses,
  expandedOutcomes,
  setApiNodes,
  setExpandedSemesters,
  setExpandedCourses,
  setExpandedOutcomes,
  setSelectedNodeId,
}: {
  apiNodes: ApiGraphNode[];
  apiEdges: ApiGraphEdge[];
  expandedSemesters: Set<number>;
  expandedCourses: Set<string>;
  expandedOutcomes: Set<string>;
  setApiNodes: Dispatch<SetStateAction<ApiGraphNode[]>>;
  setExpandedSemesters: Dispatch<SetStateAction<Set<number>>>;
  setExpandedCourses: Dispatch<SetStateAction<Set<string>>>;
  setExpandedOutcomes: Dispatch<SetStateAction<Set<string>>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
}): { nodes: Node[]; edges: Edge[] } {
    const newRfNodes: Node[] = [];
    const newRfEdges: Edge[] = [];

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

  return { nodes: newRfNodes, edges: newRfEdges };
}
