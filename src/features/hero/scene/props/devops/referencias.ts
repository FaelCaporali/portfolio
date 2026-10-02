/**
 * Referências da tela para as zonas do diagrama (zonas.ts), medidas no resize: a interface pelo DOM do herói (caixa do
 * texto, indicador de vidas, balão de contato) e, pela câmera, a cabeça (pontos do glb com o busto em repouso) e a
 * prancheta (caixa da mesa projetada). Nada por quadro.
 */
import * as THREE from 'three'
import type { Quadro } from './pincel'
import type { Referencias } from './zonas'

/** Silhueta da cabeça no glb (SITE.md): orelhas/cabelo x ±0,1 na altura dos olhos; topo; queixo. */
const CABECA: readonly (readonly [number, number, number])[] = [
  [-0.1, 0.18, -0.1],
  [0.1, 0.18, -0.1],
  [0, 0.33, -0.1],
  [0, 0.04, 0],
]

function relativo(r: DOMRect, c: DOMRect): Quadro {
  return { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top }
}

/**
 * Se o texto conta na medida: sem `vida`, o texto do herói em cena (sem as amostras); com `vida`, o texto dela, lido
 * na amostra parada que o herói mantém escondida para cada vida (HeroCopy, data-medida; #138: o fundo pinta antes de a
 * vida entrar, e a medida não depende do quadro em que a animação das letras está) no lugar do texto em cena.
 */
function conta(el: Element | null, vida: string | undefined) {
  const amostra = el?.closest('[data-medida]')
  if (amostra) return vida !== undefined && amostra.getAttribute('data-medida') === vida
  return vida === undefined || !el?.closest('[data-vida-texto]')
}

/** Caixa (px CSS do canvas) do texto do herói, do fim do indicador e do balão; null sem o DOM do herói. */
function lerUi(canvas: HTMLCanvasElement, vida?: string) {
  const sec = canvas.closest('section')
  const c = canvas.getBoundingClientRect()
  const copia = sec?.querySelector('[data-hero-copy]')
  if (!sec || !copia) return null
  // O contêiner do texto ocupa a coluna inteira: vale a união do que está desenhado nele (linhas de texto e botões).
  const ui: Quadro = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const somar = (r: DOMRect) => {
    if (r.width < 2 || r.height < 2) return
    const q = relativo(r, c)
    ui.x0 = Math.min(ui.x0, q.x0)
    ui.y0 = Math.min(ui.y0, q.y0)
    ui.x1 = Math.max(ui.x1, q.x1)
    ui.y1 = Math.max(ui.y1, q.y1)
  }
  const walk = document.createTreeWalker(copia, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim() || n.parentElement?.closest('.sr-only') || !conta(n.parentElement, vida)) continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) somar(r)
  }
  for (const el of copia.querySelectorAll('a, button')) somar(el.getBoundingClientRect())
  if (!Number.isFinite(ui.x0)) return null
  const nav = document.querySelector('nav[aria-label="Timeline"]')
  const cab = sec.querySelector(':scope > header')
  const fimNav = nav ? relativo(nav.getBoundingClientRect(), c).y1 : 0
  const fimCab = cab ? relativo(cab.getBoundingClientRect(), c).y1 : 0
  const topo = Math.max(fimNav, fimCab)
  const bal = document.querySelector('div.fixed > button')
  const balao = bal ? relativo(bal.getBoundingClientRect(), c) : null
  return { ui, topo: topo || 76, balao }
}

const v = new THREE.Vector3()
const caixa = new THREE.Box3()

/** Referências para a tela `w`×`h`: `repouso` = matriz do frame com a cabeça em repouso (o grupo do fundo). */
export function medirReferencias(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  w: number,
  h: number,
  repouso: THREE.Matrix4,
  mesa: THREE.Object3D | null,
  /** A vida cujo texto conta (a amostra dela, HeroCopy); sem ela, o texto em cena. */
  vida?: string,
): Referencias | null {
  const dom = lerUi(canvas, vida)
  if (!dom) return null
  const px = (p: THREE.Vector3) => {
    p.project(camera)
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h] as const
  }
  const cab = CABECA.map(([x, y, z]) => px(v.set(x, y, z).applyMatrix4(repouso)))
  const cabeca: Quadro = {
    x0: Math.min(...cab.map((p) => p[0])),
    y0: Math.min(...cab.map((p) => p[1])),
    x1: Math.max(...cab.map((p) => p[0])),
    y1: Math.max(...cab.map((p) => p[1])),
  }
  let m: Quadro = { x0: cabeca.x0, y0: h, x1: cabeca.x1, y1: h }
  if (mesa) {
    mesa.updateWorldMatrix(true, true)
    caixa.setFromObject(mesa, true)
    const pts: (readonly [number, number])[] = []
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? caixa.max.x : caixa.min.x, i & 2 ? caixa.max.y : caixa.min.y, i & 4 ? caixa.max.z : caixa.min.z)
      pts.push(px(v))
    }
    m = {
      x0: Math.min(...pts.map((p) => p[0])),
      y0: Math.min(...pts.map((p) => p[1])),
      x1: Math.max(...pts.map((p) => p[0])),
      y1: Math.max(...pts.map((p) => p[1])),
    }
  }
  return { w, h, ui: dom.ui, topo: dom.topo, balao: dom.balao, cabeca, mesa: m }
}
