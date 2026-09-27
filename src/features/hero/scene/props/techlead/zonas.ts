/**
 * Zonas LIVRES da tela para o fundo da vida techlead (FICHA-PRODUCAO, FECHAMENTO, "Fundo e site (TD)"): em volta da
 * cabeça COM o headset, nunca atrás dela nem da interface (respiro ≥ 16 px da UI e ≥ 16 px da borda). Tudo em px CSS
 * do canvas, medido no resize (nunca por quadro): a interface pelo DOM (../devops/referencias.ts) e a cabeça pela
 * câmera, com o headset (arco acima do crânio, conchas além das orelhas, microfone na frente da boca).
 *   largo/médio: TOPO (acima do texto, até a cabeça), ESQ (entre o texto e a cabeça), BASE (abaixo do texto, até a
 *   cabeça) e DIR (à direita da cabeça, acima do balão de contato);
 *   estreito (retrato): as duas colunas ao lado da cabeça, acima do título.
 * Cada zona é um painel (uma malha); nenhum plano cobre a interface, nem transparente (os portões medem a silhueta).
 */
import * as THREE from 'three'
import type { Formato } from '../devops/composicao'
import type { Ponto, Quadro } from './pincel'
import { medirReferencias } from '../devops/referencias'
import type { Referencias } from '../devops/zonas'

export type Painel = 'topo' | 'esq' | 'base' | 'dir'
export const PAINEIS: readonly Painel[] = ['topo', 'esq', 'base', 'dir']
export type Zonas = Record<Painel, Quadro | null>

/** Respiro da UI e da borda: 16 px da ficha + 4 px de folga (projeção do plano, arredondamento). */
const RESPIRO = 20
const BORDA = 20
/** Folga da cabeça (cabelo além da projeção). */
const CABECA = 12

/** Headset no glb (m), se o glb não der a caixa: arco acima do crânio, conchas além das orelhas e o microfone. */
const HEADSET: readonly (readonly [number, number, number])[] = [
  [-0.125, 0.18, -0.13],
  [0.125, 0.18, -0.13],
  [0, 0.345, -0.13],
  [0.055, 0.09, 0.04],
]
/** Concha do lado da tela esquerda (onde a voz do cliente entra), na altura das orelhas. */
const CONCHA: readonly [number, number, number] = [-0.125, 0.18, -0.13]

const valida = (q: Quadro, minW: number, minH: number): Quadro | null =>
  q.x1 - q.x0 >= minW && q.y1 - q.y0 >= minH ? q : null

const v = new THREE.Vector3()

/** Tela com a cabeça em repouso: a UI, a cabeça com o headset e o OUVIDO (junto à concha do lado da tela esquerda). */
export interface Medida extends Referencias {
  ouvido: Ponto
}

/**
 * Referências da tela (`repouso` = matriz do grupo do fundo), o headset incluído: `headset` são os cantos da caixa dele
 * no glb (sem o cabo); vazio, valem os pontos de HEADSET.
 */
export function medirTela(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  w: number,
  h: number,
  repouso: THREE.Matrix4,
  headset: readonly (readonly [number, number, number])[],
): Medida | null {
  const ref = medirReferencias(canvas, camera, w, h, repouso, null)
  if (!ref) return null
  const c = { ...ref.cabeca }
  const px = (p: readonly [number, number, number]) => {
    v.set(p[0], p[1], p[2]).applyMatrix4(repouso).project(camera)
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h] as const
  }
  for (const p of headset.length ? headset : HEADSET) {
    const [x, y] = px(p)
    c.x0 = Math.min(c.x0, x)
    c.x1 = Math.max(c.x1, x)
    c.y0 = Math.min(c.y0, y)
  }
  return { ...ref, cabeca: c, ouvido: [c.x0 - CABECA - 2, px(CONCHA)[1]] }
}

export function zonasPara(f: Formato, r: Referencias): Zonas {
  const { w, h, ui, cabeca } = r
  const y0 = r.topo + RESPIRO
  if (f === 'estreito') {
    const fim = ui.y0 - RESPIRO
    return {
      topo: null,
      base: null,
      esq: valida({ x0: BORDA, y0, x1: cabeca.x0 - 6, y1: fim }, 50, 100),
      dir: valida({ x0: cabeca.x1 + 6, y0, x1: w - BORDA, y1: fim }, 50, 100),
    }
  }
  const baixo = r.balao ? r.balao.y0 - RESPIRO : h - BORDA
  const x1 = cabeca.x0 - CABECA
  return {
    topo: valida({ x0: BORDA, y0, x1, y1: ui.y0 - RESPIRO }, 200, 70),
    esq: valida({ x0: ui.x1 + RESPIRO, y0: ui.y0 - RESPIRO, x1, y1: ui.y1 + RESPIRO }, 150, 120),
    base: valida({ x0: BORDA, y0: ui.y1 + RESPIRO, x1, y1: h - BORDA }, 200, 90),
    dir: valida({ x0: cabeca.x1 + CABECA, y0, x1: w - BORDA, y1: baixo }, 90, 150),
  }
}
