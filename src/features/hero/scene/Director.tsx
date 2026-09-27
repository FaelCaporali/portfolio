import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { createClock, tick, type Phase } from '../model/carousel'
import { isHeld, type DragState } from '../model/drag'
import { dissolveUniforms } from './dissolve'

interface DirectorProps {
  first: boolean
  reducedMotion: boolean
  /** Pausa própria da vida atual (s; ausente = a padrão do carrossel). */
  hold?: number
  /** Conferência: desintegração parada neste valor. */
  frozenDissolve: number | null
  drag: RefObject<DragState>
  /** Vida escolhida no indicador, esperando a troca (null = seguir o carrossel). */
  requested: RefObject<number | null>
  onPhase: (p: Phase) => void
  onNext: () => void
}

/** Liga o relógio do carrossel ao quadro do Canvas: aplica a desintegração e avisa as trocas de vida e de fase. */
export function Director({
  first,
  reducedMotion,
  hold,
  frozenDissolve,
  drag,
  requested,
  onPhase,
  onNext,
}: DirectorProps) {
  const clock = useRef(createClock())
  useFrame((_, dt) => {
    if (frozenDissolve !== null) {
      dissolveUniforms.uD.value = frozenDissolve
      return
    }
    const t = tick(clock.current, dt, {
      first,
      reducedMotion,
      held: isHeld(drag.current),
      jump: requested.current !== null,
      hold,
    })
    dissolveUniforms.uD.value = t.dissolve
    if (t.next) onNext()
    if (t.phase) onPhase(t.phase)
  })
  return null
}
