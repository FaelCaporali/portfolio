import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { createClock, tick, type Phase } from '../model/carousel'
import { isHeld, type DragState } from '../model/drag'
import type { PropId } from '../../../content/journey'
import { dissolveUniforms } from './dissolve'
import type { Palco } from './palco'

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
  /** Para onde a troca pode ir, em ordem: vai para a primeira pronta (sem nenhuma pronta, a vida atual fica). */
  candidatas: readonly PropId[]
  /** O busto já está na tela (Bust): antes disso o relógio não anda, e a abertura dura o mesmo de sempre. */
  palco: Palco
  onPhase: (p: Phase) => void
  onNext: (prop: PropId) => void
}

/** Liga o relógio do carrossel ao quadro do Canvas: aplica a desintegração e avisa as trocas de vida e de fase. */
export function Director({
  first,
  reducedMotion,
  hold,
  frozenDissolve,
  drag,
  requested,
  candidatas,
  palco,
  onPhase,
  onNext,
}: DirectorProps) {
  const clock = useRef(createClock())
  useFrame((_, dt) => {
    if (!palco.emCena) return
    if (frozenDissolve !== null) {
      dissolveUniforms.uD.value = frozenDissolve
      return
    }
    // A 1ª pronta (preparada) entre as candidatas: vida que falhou ou demora é pulada até ficar pronta.
    const escolhida = candidatas.find((p) => palco.prontas.has(p))
    const t = tick(clock.current, dt, {
      first,
      reducedMotion,
      held: isHeld(drag.current),
      jump: requested.current !== null,
      hold,
      nextReady: escolhida !== undefined,
    })
    dissolveUniforms.uD.value = t.dissolve
    if (t.next && escolhida !== undefined) onNext(escolhida)
    if (t.phase) onPhase(t.phase)
  })
  return null
}
