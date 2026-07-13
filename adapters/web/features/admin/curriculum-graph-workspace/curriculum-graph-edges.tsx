/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
import { T, mono } from '@web/simulation/fixtures';

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
export const edgeTypes = { custom: CustomEdge };
