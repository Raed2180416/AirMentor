import { Trash2, BookOpen, GraduationCap } from 'lucide-react';
import { T } from '@web/simulation/fixtures';
import { getGlass } from './curriculum-graph-helpers';

export type CurriculumGraphToolbarProps = {
  isLight: boolean;
  handleToolbarDragStart: (type: string) => (e: React.DragEvent) => void;
  handleToolbarDragEnd: () => void;
  trashRef: React.RefObject<HTMLDivElement | null>;
  trashHot: boolean;
};

export function CurriculumGraphToolbar({
  isLight,
  handleToolbarDragStart,
  handleToolbarDragEnd,
  trashRef,
  trashHot,
}: CurriculumGraphToolbarProps) {
  return (
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
  );
}
