/**
 * Giro do busto pelo arrasto: entrada do ponteiro, embalo ao soltar e volta à frente depois de um tempo parado.
 * O estado vive num ref, fora do React: os eventos de ponteiro escrevem e o quadro do Canvas lê e integra.
 */
import { approach, clampAbs, degToRad } from '../../../lib/math'

export interface DragState {
  active: boolean
  yaw: number
  pitch: number
  vYaw: number
  vPitch: number
  /** Segundos desde o último toque. */
  idle: number
}

/** 38° no total (arrasto + acompanhar o ponteiro): o perfil completo expõe erros do scan em nariz, boca e orelha. */
export const DRAG_MAX_YAW = degToRad(38)
export const DRAG_MAX_PITCH = 0.35
/** Meia largura da tela gira ~100°. */
const YAW_PER_WIDTH = 3.5
const PITCH_PER_HEIGHT = 1.6
/** Quem parou antes de soltar (ms) não dá embalo. */
const FLING_WINDOW_MS = 80
/** Parado há mais que isso (s), o busto volta sozinho para a frente. */
const RETURN_AFTER = 1.4
/** Depois de soltar (s), a vida atual ainda segura: quem está girando o busto não o perde na mão. */
const HOLD_AFTER_RELEASE = 0.8

export const createDrag = (): DragState => ({ active: false, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, idle: 99 })

export function grab(d: DragState) {
  Object.assign(d, { active: true, vYaw: 0, vPitch: 0, idle: 0 })
}

/** Movimento do ponteiro em fração da tela (dx, dy) em dt segundos; a velocidade vira o embalo ao soltar. */
export function dragBy(d: DragState, dx: number, dy: number, dt: number) {
  const dYaw = dx * YAW_PER_WIDTH
  const dPitch = dy * PITCH_PER_HEIGHT
  d.yaw = clampAbs(d.yaw + dYaw, DRAG_MAX_YAW)
  d.pitch = clampAbs(d.pitch - dPitch, DRAG_MAX_PITCH)
  d.vYaw = dYaw / dt
  d.vPitch = -dPitch / dt
}

export function release(d: DragState, msSinceLastMove: number) {
  if (msSinceLastMove > FLING_WINDOW_MS) {
    d.vYaw = 0
    d.vPitch = 0
  }
  d.active = false
  d.idle = 0
}

/** Um quadro sem a mão no busto: embalo amortecido e, parado, volta suave à frente. */
export function stepDrag(d: DragState, dt: number) {
  if (d.active) return
  d.idle += dt
  d.yaw = clampAbs(d.yaw + d.vYaw * dt, DRAG_MAX_YAW)
  d.pitch = clampAbs(d.pitch + d.vPitch * dt, DRAG_MAX_PITCH)
  const damp = Math.exp(-dt * 4)
  d.vYaw *= damp
  d.vPitch *= damp
  if (d.idle > RETURN_AFTER) {
    const k = approach(dt, 2.2)
    d.yaw -= d.yaw * k
    d.pitch -= d.pitch * k
  }
}

/** A vida atual segura enquanto há mão no busto e um instante depois de soltar. */
export const isHeld = (d: DragState) => d.active || d.idle < HOLD_AFTER_RELEASE
