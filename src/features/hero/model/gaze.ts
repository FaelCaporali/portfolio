/**
 * Olhar: sem arrasto a cabeça acompanha o ponteiro devagar; os olhos sempre miram o ponteiro no mundo, descontado o
 * giro da cabeça (com a cabeça arrastada eles continuam olhando para o cursor).
 */
import { approach, clampAbs } from '../../../lib/math'
import { DRAG_MAX_YAW, type DragState } from './drag'
import { bustCenterX } from './layout'

/** Posição do cursor normalizada em [-1, 1], com o centro no busto. */
export interface Pointer {
  x: number
  y: number
}

/** Quanto a cabeça acompanha o ponteiro sozinha (rad no canto da tela). */
const FOLLOW_YAW = 0.16
const FOLLOW_PITCH = 0.08
/** Para onde os olhos miram no mundo quando o ponteiro está no canto da tela (rad). */
const GAZE_YAW = 0.42
const GAZE_PITCH = 0.26
/** Limite do olho dentro da órbita (rad): com a cabeça muito girada, o olho para no canto em vez de sair da órbita. */
const EYE_MAX_YAW = 0.45
const EYE_MAX_PITCH = 0.28

/** Coordenadas da tela → ponteiro relativo ao busto (no layout largo o busto está à direita do centro). */
export function toPointer(clientX: number, clientY: number, width: number, height: number): Pointer {
  return {
    x: clampAbs((clientX / width - bustCenterX(width)) * 2, 1),
    y: -((clientY / height) * 2 - 1),
  }
}

/** Ângulos da cabeça e dos olhos neste quadro (rad). Objeto reaproveitado entre quadros. */
export interface Gaze {
  /** Acompanhamento suavizado do ponteiro, em [-1, 1]. */
  followX: number
  followY: number
  headRight: number
  headUp: number
  eyeRight: number
  eyeUp: number
}

export const createGaze = (): Gaze => ({ followX: 0, followY: 0, headRight: 0, headUp: 0, eyeRight: 0, eyeUp: 0 })

export function stepGaze(g: Gaze, p: Pointer, d: DragState, dt: number) {
  const k = approach(dt, 3)
  const follow = d.active ? 0 : 1
  g.followX += (p.x * follow - g.followX) * k
  g.followY += (p.y * follow - g.followY) * k
  g.headRight = clampAbs(d.yaw + g.followX * FOLLOW_YAW, DRAG_MAX_YAW)
  g.headUp = d.pitch + g.followY * FOLLOW_PITCH
  g.eyeRight = clampAbs(p.x * GAZE_YAW - g.headRight, EYE_MAX_YAW)
  g.eyeUp = clampAbs(p.y * GAZE_PITCH - g.headUp, EYE_MAX_PITCH)
}
