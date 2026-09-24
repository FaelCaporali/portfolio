/**
 * Passes de máscara do gancho de depuração (só em desenvolvimento): a cena renderizada de novo, fora do quadro, com
 * cada grupo pintado de preto, branco ou escondido, sobre fundo branco e sem antisserrilhado. Dá a silhueta da peça,
 * a parte dela escondida pela cabeça e o contorno da cabeça, em pixels do buffer de desenho.
 */
import * as THREE from 'three'

export type Paint = 'preto' | 'branco' | 'oculto'

export interface PassSpec {
  prop: Paint
  bust: Paint
  /** Recorta o busto abaixo deste Y do espaço do glb (a cabeça sem pescoço e ombros). */
  clipBelowY?: number
}

export interface Groups {
  frame: THREE.Object3D
  prop: THREE.Object3D
  bust: THREE.Object3D
}

/** Máscara binária (1 = pixel preto), linhas de cima para baixo, no tamanho do buffer de desenho. */
export interface Mask {
  w: number
  h: number
  data: Uint8Array
}

export const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
const isPoints = (o: THREE.Object3D): o is THREE.Points => (o as Partial<THREE.Points>).isPoints === true

function flat(color: string, clip: THREE.Plane[] | null) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide, clippingPlanes: clip })
}

function meshesOf(root: THREE.Object3D) {
  const list: THREE.Mesh[] = []
  root.traverse((o) => {
    if (isMesh(o)) list.push(o)
  })
  return list
}

/** Renderiza um passe e devolve a máscara; restaura materiais, visibilidade, fundo e cor de limpeza. */
export function renderPass(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, g: Groups, s: PassSpec) {
  const size = gl.getDrawingBufferSize(new THREE.Vector2())
  const target = new THREE.WebGLRenderTarget(size.x, size.y)
  const clip =
    s.clipBelowY === undefined
      ? null
      : [new THREE.Plane(new THREE.Vector3(0, 1, 0), -s.clipBelowY).applyMatrix4(g.frame.matrixWorld)]
  const black = flat('#000000', null)
  const white = flat('#ffffff', null)
  const bustBlack = flat('#000000', clip)
  const bustWhite = flat('#ffffff', clip)

  const saved = new Map<THREE.Mesh, THREE.Mesh['material']>()
  const hidden: THREE.Object3D[] = []
  const hide = (o: THREE.Object3D) => {
    if (!o.visible) return
    o.visible = false
    hidden.push(o)
  }
  const paint = (root: THREE.Object3D, p: Paint, b: THREE.Material, w: THREE.Material) => {
    if (p === 'oculto') {
      hide(root)
      return
    }
    for (const m of meshesOf(root)) {
      saved.set(m, m.material)
      m.material = p === 'preto' ? b : w
    }
  }
  scene.traverse((o) => {
    if (isPoints(o)) hide(o)
  })
  paint(g.prop, s.prop, black, white)
  paint(g.bust, s.bust, bustBlack, bustWhite)

  const background = scene.background
  const clearColor = gl.getClearColor(new THREE.Color())
  const clearAlpha = gl.getClearAlpha()
  const localClipping = gl.localClippingEnabled
  const previousTarget = gl.getRenderTarget()
  scene.background = null
  gl.setClearColor('#ffffff', 1)
  gl.localClippingEnabled = clip !== null
  gl.setRenderTarget(target)
  gl.clear()
  gl.render(scene, camera)
  const rgba = new Uint8Array(size.x * size.y * 4)
  gl.readRenderTargetPixels(target, 0, 0, size.x, size.y, rgba)

  gl.setRenderTarget(previousTarget)
  gl.localClippingEnabled = localClipping
  gl.setClearColor(clearColor, clearAlpha)
  scene.background = background
  saved.forEach((mat, mesh) => (mesh.material = mat))
  hidden.forEach((o) => (o.visible = true))
  ;[black, white, bustBlack, bustWhite].forEach((m) => m.dispose())
  target.dispose()

  const data = new Uint8Array(size.x * size.y)
  for (let y = 0; y < size.y; y++) {
    const src = (size.y - 1 - y) * size.x
    for (let x = 0; x < size.x; x++) data[y * size.x + x] = (rgba[(src + x) * 4] ?? 255) < 128 ? 1 : 0
  }
  return { w: size.x, h: size.y, data }
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Pixels pretos e retângulo que os contém (null se vazia). */
export function stats(m: Mask) {
  let n = 0
  let x0 = m.w
  let y0 = m.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.data[y * m.w + x]) continue
      n++
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  }
  const box: Box | null = n ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null
  return { px: n, box }
}

/** Pixels pretos dentro de um retângulo. */
export function countIn(m: Mask, r: Box) {
  let n = 0
  const xa = Math.max(0, Math.floor(r.x))
  const xb = Math.min(m.w, Math.ceil(r.x + r.w))
  const ya = Math.max(0, Math.floor(r.y))
  const yb = Math.min(m.h, Math.ceil(r.y + r.h))
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) n += m.data[y * m.w + x] ?? 0
  return n
}

/** Pixels pretos dentro de um círculo. */
export function countInCircle(m: Mask, cx: number, cy: number, r: number) {
  let n = 0
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(m.h, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(m.w, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) n += m.data[y * m.w + x] ?? 0
    }
  }
  return n
}

/**
 * Contorno da peça que encosta em outra máscara: pixels de borda da peça (vizinho de 4 fora dela) cujo vizinho de fora
 * pertence a `other` (a cabeça). Fração alta = a silhueta da peça se funde com a da cabeça e não se lê sozinha.
 */
export function contact(m: Mask, other: Mask) {
  let edge = 0
  let touching = 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? -1 : y * m.w + x)
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.data[y * m.w + x]) continue
      const out = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((i) => i < 0 || !m.data[i])
      if (!out.length) continue
      edge++
      if (out.some((i) => i >= 0 && other.data[i])) touching++
    }
  }
  return { edge, touching }
}

/** PNG da máscara: preto sobre branco; `under` (opcional) entra em cinza claro por baixo, como contexto. */
export function toPng(m: Mask, under?: Mask) {
  const canvas = document.createElement('canvas')
  canvas.width = m.w
  canvas.height = m.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(m.w, m.h)
  for (let i = 0; i < m.data.length; i++) {
    const back = under?.data[i] ? 205 : 255
    const v = m.data[i] ? 0 : back
    img.data.set([v, v, v, 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}
