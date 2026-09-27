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
    x: clampAbs((clientX / width - bustCenterX(width, height)) * 2, 1),
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
  /** Perseguição do alvo do adereço (mirarAlvo): olhos e o pouco que a cabeça acompanha. */
  alvoRight: number
  alvoUp: number
  alvoHeadRight: number
  alvoHeadUp: number
}

export const createGaze = (): Gaze => ({
  followX: 0,
  followY: 0,
  headRight: 0,
  headUp: 0,
  eyeRight: 0,
  eyeUp: 0,
  alvoRight: 0,
  alvoUp: 0,
  alvoHeadRight: 0,
  alvoHeadUp: 0,
})

/**
 * Alvo do olhar imposto pelo adereço da vida, no espaço do glb (vida qa: o bug um pouco à frente de onde está, e
 * depois a lente). `peso` 0 = o ponteiro manda (todas as outras vidas); 1 = só o alvo. Escrito pelo adereço a cada
 * quadro, antes do busto (o useFrame do filho roda primeiro); o adereço zera o peso ao desmontar.
 */
export interface AlvoOlhar {
  peso: number
  x: number
  y: number
  z: number
}
export const alvoDoAdereco: AlvoOlhar = { peso: 0, x: 0, y: 0, z: 0 }
/** Meio dos olhos no espaço do glb (SITE.md): de onde o alvo é mirado. */
const OLHOS_Y = 0.18
const OLHOS_Z = -0.02
/**
 * Perseguição de quem segue um inseto com o olhar: amplitude menor que a geométrica (o olhar mira "através" do alvo,
 * FOCO m atrás, e nunca vai ao canto da órbita), perseguição suave e, quando o alvo foge mais que SACADA rad, uma
 * sacada curta (mais rápida, sem salto). A cabeça acompanha CABECA do ângulo, devagar.
 */
const FOCO = 0.25
const PROFUNDIDADE_MIN = 0.1
const AMPLITUDE = 0.8
const LIMITE = 0.85
const SACADA = 0.09
const RITMO = { persegue: 6, sacada: 22, cabeca: 1.2 }
const CABECA = { right: 0.3, up: 0.15 }

/** Mistura a perseguição do alvo do adereço no olhar (o alvo está no espaço da cabeça). */
export function mirarAlvo(g: Gaze, a: AlvoOlhar, dt: number) {
  if (a.peso <= 0) {
    g.alvoRight = g.eyeRight
    g.alvoUp = g.eyeUp
    g.alvoHeadRight = 0
    g.alvoHeadUp = 0
    return
  }
  const dz = Math.max(PROFUNDIDADE_MIN, a.z - OLHOS_Z + FOCO)
  const right = clampAbs(AMPLITUDE * Math.atan2(a.x, dz), EYE_MAX_YAW * LIMITE)
  const up = clampAbs(AMPLITUDE * Math.atan2(a.y - OLHOS_Y, Math.hypot(a.x, dz)), EYE_MAX_PITCH * LIMITE)
  const erro = Math.hypot(right - g.alvoRight, up - g.alvoUp)
  const k = approach(dt, erro > SACADA ? RITMO.sacada : RITMO.persegue)
  g.alvoRight += (right - g.alvoRight) * k
  g.alvoUp += (up - g.alvoUp) * k
  const kh = approach(dt, RITMO.cabeca)
  g.alvoHeadRight += (right * CABECA.right - g.alvoHeadRight) * kh
  g.alvoHeadUp += (up * CABECA.up - g.alvoHeadUp) * kh
  g.headRight += g.alvoHeadRight * a.peso
  g.headUp += g.alvoHeadUp * a.peso
  g.eyeRight += (g.alvoRight - g.eyeRight) * a.peso
  g.eyeUp += (g.alvoUp - g.eyeUp) * a.peso
}

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
