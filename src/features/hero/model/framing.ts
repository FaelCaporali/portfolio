/**
 * Enquadramento da câmera. Largo: busto à direita do texto. Celular: busto centrado no espaço livre entre o header e
 * o texto e escalado para ocupar ~80% dele (a altura do texto varia com a tela e com a vida que quebra em duas linhas).
 * Medidas do busto a fov 38: altura ~0,40 da tela, centro 0,013 da tela abaixo do centro.
 */
import { degToRad, radToDeg } from '../../../lib/math'
import { BUST_SHIFT, SHORT_LANDSCAPE, isWide } from './layout'

export interface Framing {
  fov: number
  /** Deslocamento da janela de vista (setViewOffset), em pixels. */
  offsetX: number
  offsetY: number
}

const WIDE_FOV = 24
/** Celular deitado: nome e indicador ocupam ~1/4 da altura; o busto fica menor e desce para baixo deles. */
const SHORT_FOV = 30
const SHORT_DROP = 0.1
/** Tangente da meia abertura de referência (fov 38). */
const REF = Math.tan(degToRad(19))
const BUST_HEIGHT = 0.4
const BUST_CENTER_DROP = 0.013
const FILL = 0.8

/** free = [topo, base] do espaço livre em pixels (base do header, topo do texto). */
export function computeFraming(width: number, height: number, [top, bottom]: readonly [number, number]): Framing {
  // Janela de vista deslocada: x negativo leva o busto para a direita, y positivo o leva para cima.
  if (isWide(width, height)) {
    if (height <= SHORT_LANDSCAPE)
      return { fov: SHORT_FOV, offsetX: -width * BUST_SHIFT, offsetY: -height * SHORT_DROP }
    return { fov: WIDE_FOV, offsetX: -width * BUST_SHIFT, offsetY: height * 0.06 }
  }

  const free = Math.max(bottom - top, height * 0.3)
  const half = Math.atan((REF * BUST_HEIGHT * height) / (FILL * free))
  const fov = Math.min(60, Math.max(30, radToDeg(2 * half)))
  const k = REF / Math.tan(degToRad(fov / 2))
  return { fov, offsetX: 0, offsetY: height * (0.5 + BUST_CENTER_DROP * k) - (bottom - free / 2) }
}
