import { useRef, type PointerEvent } from 'react'
import { createDrag, dragBy, grab, release } from '../model/drag'

/** Arrasto do busto: eventos de ponteiro do Canvas → estado do giro (ref lido a cada quadro pela cena). */
export function useDragRotation() {
  const drag = useRef(createDrag())
  const last = useRef({ x: 0, y: 0, t: 0 })

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    grab(drag.current)
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current.active) return
    const now = performance.now()
    const dt = Math.max((now - last.current.t) / 1000, 1 / 240)
    const dx = (e.clientX - last.current.x) / window.innerWidth
    const dy = (e.clientY - last.current.y) / window.innerHeight
    dragBy(drag.current, dx, dy, dt)
    last.current = { x: e.clientX, y: e.clientY, t: now }
  }
  const onPointerUp = (e: PointerEvent) => {
    release(drag.current, performance.now() - last.current.t)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return { drag, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } }
}
