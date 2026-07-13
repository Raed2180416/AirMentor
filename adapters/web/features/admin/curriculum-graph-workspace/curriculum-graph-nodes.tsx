/* eslint-disable @typescript-eslint/no-explicit-any */
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import { sora, mono } from '@web/simulation/fixtures';
import { Btn } from '@web/shared/ui/primitives';
import { semesterColor } from './curriculum-graph-helpers';

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

export const nodeTypes = { semesterCluster: SemesterClusterNode, courseBubble: CourseBubbleNode, outcomeNode: OutcomeNode, topicNode: TopicNode, prereqNode: PrereqNode };
