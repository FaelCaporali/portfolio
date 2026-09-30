/**
 * Medida da tela e zonas LIVRES da vida ai (FICHA §4.1 e §3): tudo em px CSS do canvas, medido no resize (nunca por
 * quadro). A interface vem do DOM (../devops/referencias.ts); a cabeça, da SILHUETA real do busto (vértices acima do
 * queixo, com a cabeça em repouso); o robô, da caixa dele montado na mesa. Respiro ≥ 16 px da UI e da borda (+ 4).
 *   largo/médio: IDE no canto de cima à esquerda (acima do texto), o CHAT na coluna da direita (acima do robô) e o lado
 *   HUMANO da noite na faixa de baixo à esquerda (abaixo do texto);
 *   estreito (retrato): IDE e humano na coluna à esquerda da cabeça, o chat na da direita, acima do título.
 */
import * as THREE from 'three'
import type { Formato } from '../devops/composicao'
import { medirReferencias } from '../devops/referencias'
import type { Referencias } from '../devops/zonas'
import type { Ponto, Quadro } from './pincel'
import type { Cena } from './roteiro'

export type Zonas = Record<Cena, Quadro | null>

/** Respiro da UI e da borda: 16 px da ficha + 4 px de folga (projeção do plano, arredondamento). */
const RESPIRO = 20
const BORDA = 20
/** Folga da cabeça (cabelo além da projeção). */
const CABECA = 14
/** Vértices do busto acima desta altura do glb (m) formam a cabeça (queixo ≈ 0,04; a barba desce um pouco). */
const ACIMA = 0.035

export interface Medida extends Referencias {
  /** Robô montado (px) e a base dele na mesa (o fio chega aí); sem o robô, a mesa sugerida. */
  robo: Quadro | null
  pe: Ponto
}

const v = new THREE.Vector3()
const inv = new THREE.Matrix4()
const m = new THREE.Matrix4()

/** Vértices da cabeça no espaço do glb (um a cada 3), lidos uma vez da malha do busto. */
export function verticesCabeca(bust: THREE.Object3D, frame: THREE.Object3D): Float32Array {
  const out: number[] = []
  frame.updateWorldMatrix(true, true)
  inv.copy(frame.matrixWorld).invert()
  bust.traverse((o) => {
    if ((o as Partial<THREE.Mesh>).isMesh !== true) return
    const mesh = o as THREE.Mesh
    m.multiplyMatrices(inv, mesh.matrixWorld)
    const n = mesh.geometry.getAttribute('position').count
    for (let i = 0; i < n; i += 3) {
      mesh.getVertexPosition(i, v).applyMatrix4(m)
      if (v.y > ACIMA) out.push(v.x, v.y, v.z)
    }
  })
  return new Float32Array(out)
}

/** Caixa (px) de pontos no espaço `matriz` (glb → mundo) projetados pela câmera. */
function caixaPx(pts: Float32Array, matriz: THREE.Matrix4, camera: THREE.Camera, w: number, h: number): Quadro {
  const q = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (let i = 0; i + 2 < pts.length; i += 3) {
    v.set(pts[i] ?? 0, pts[i + 1] ?? 0, pts[i + 2] ?? 0)
      .applyMatrix4(matriz)
      .project(camera)
    const x = ((v.x + 1) / 2) * w
    const y = ((1 - v.y) / 2) * h
    q.x0 = Math.min(q.x0, x)
    q.x1 = Math.max(q.x1, x)
    q.y0 = Math.min(q.y0, y)
    q.y1 = Math.max(q.y1, y)
  }
  return q
}

/**
 * Referências da tela com a cabeça em repouso (`repouso` = matriz do grupo do fundo): a UI, a silhueta da cabeça e o
 * robô (`robo`: cantos da caixa dele no espaço do grupo da mesa, `mesaMundo` a matriz desse grupo; nulos sem o glb).
 */
export function medirTela(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  w: number,
  h: number,
  repouso: THREE.Matrix4,
  cabeca: Float32Array,
  robo: { cantos: Float32Array; base: Float32Array; mundo: THREE.Matrix4 } | null,
  /** A vida cujo texto conta (a amostra dela); sem ela, o texto em cena. */
  vida?: string,
): Medida | null {
  const ref = medirReferencias(canvas, camera, w, h, repouso, null, vida)
  if (!ref || cabeca.length < 30) return null
  const cab = caixaPx(cabeca, repouso, camera, w, h)
  const r = robo ? caixaPx(robo.cantos, robo.mundo, camera, w, h) : null
  const b = robo ? caixaPx(robo.base, robo.mundo, camera, w, h) : null
  const pe: Ponto = b ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : [cab.x1 - (cab.x1 - cab.x0) * 0.2, cab.y1 + 60]
  return { ...ref, cabeca: cab, robo: r, pe }
}

const valida = (q: Quadro, minW: number, minH: number): Quadro | null =>
  q.x1 - q.x0 >= minW && q.y1 - q.y0 >= minH ? q : null

/** Zonas das três janelas: fora da cabeça, da UI, da borda e do robô. */
export function zonasPara(f: Formato, md: Medida): Zonas {
  const { w, h, ui, cabeca, robo } = md
  const y0 = md.topo + RESPIRO
  if (f === 'estreito') {
    const fim = ui.y0 - RESPIRO
    const x1 = cabeca.x0 - 6
    const meio = y0 + (fim - y0) * 0.5
    const baixoD = robo && robo.x1 > cabeca.x1 ? Math.min(fim, robo.y0 - 8) : fim
    return {
      ide: valida({ x0: BORDA, y0, x1, y1: meio - 4 }, 50, 60),
      humano: valida({ x0: BORDA, y0: meio + 4, x1, y1: fim }, 50, 60),
      chat: valida({ x0: cabeca.x1 + 6, y0, x1: w - BORDA, y1: baixoD }, 50, 100),
    }
  }
  const x1 = cabeca.x0 - CABECA
  const chatX0 = cabeca.x1 + CABECA
  const baixo = md.balao ? md.balao.y0 - RESPIRO : h - BORDA
  // O robô não esconde o chat: a coluna para acima dele se ele entrar nela.
  const chatY1 = robo && robo.x1 > chatX0 ? Math.min(baixo, robo.y0 - 12) : baixo
  return {
    ide: valida({ x0: BORDA, y0, x1, y1: ui.y0 - RESPIRO }, 200, 70),
    humano: valida({ x0: BORDA, y0: ui.y1 + RESPIRO, x1, y1: h - BORDA }, 200, 90),
    chat: valida({ x0: chatX0, y0, x1: w - BORDA, y1: chatY1 }, 90, 150),
  }
}
