import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function HScrollArea({ children, style, vertical = false, dataRosterScroll }: { children: ReactNode; style?: CSSProperties; vertical?: boolean; dataRosterScroll?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, active: false })
  const [dragging, setDragging] = useState(false)

  const endDrag = useCallback(() => {
    drag.current.active = false
    drag.current.pointerId = -1
    setDragging(false)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [data-no-drag-scroll="true"]')) return
    const el = ref.current
    if (!el) return
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft, active: true }
    setDragging(true)
    el.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !drag.current.active || drag.current.pointerId !== e.pointerId) return
    const delta = e.clientX - drag.current.startX
    el.scrollLeft = drag.current.startScrollLeft - delta
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || drag.current.pointerId !== e.pointerId) return
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    endDrag()
  }, [endDrag])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    if (e.key === 'ArrowRight') {
      el.scrollBy({ left: 80, behavior: 'smooth' })
    } else if (e.key === 'ArrowLeft') {
      el.scrollBy({ left: -80, behavior: 'smooth' })
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`scrollable-x scroll-pane scroll-pane--dense${dragging ? ' is-dragging' : ''}`}
      data-roster-scroll={dataRosterScroll}
      style={{ overflowX: 'auto', overflowY: vertical ? 'auto' : style?.overflowY, cursor: dragging ? 'grabbing' : 'grab', overscrollBehaviorX: 'contain', ...style }}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onPointerLeave={e => {
        if (drag.current.active && drag.current.pointerId === e.pointerId) onPointerUp(e)
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}
