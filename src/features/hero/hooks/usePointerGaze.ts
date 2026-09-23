import { useEffect, useRef } from 'react'
import { toPointer, type Pointer } from '../model/gaze'

/** Ponteiro em qualquer lugar da página, relativo ao busto; atualizado fora do React (ref lido a cada quadro). */
export function usePointerGaze() {
  const pointer = useRef<Pointer>({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = toPointer(e.clientX, e.clientY, window.innerWidth, window.innerHeight)
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  return pointer
}
