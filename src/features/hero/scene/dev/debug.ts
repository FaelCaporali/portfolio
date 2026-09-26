/**
 * Gancho de depuração do estúdio 3D (só em desenvolvimento): `window.__heroDebug`, lido pelo Playwright
 * (3d/tools/captura_prop.mjs e 3d/tools/props/portoes.mjs). Câmera e grupo `frame` (para montar a mesma câmera no
 * Blender), renderer.info com e sem a peça, e as máscaras dos portões de silhueta, tamanho em tela e arte ↔ cena.
 * Medidas em pixels CSS (buffer de desenho ÷ densidade); retângulos no referencial do canvas.
 */
import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { folga } from './folga'
import { centro, cor, mascara, objeto, projetar, type Regra } from './medidas'
import {
  contact,
  countIn,
  countInCircle,
  isMesh,
  renderPass,
  stats,
  toPng,
  type Box,
  type Groups,
  type Mask,
} from './passes'

/** Queixo aproximado no espaço do glb (boca y 0,10; base do busto y 0): a "cabeça" dos portões fica acima dele. */
export const CHIN_Y = 0.04
/** Olhos e boca no espaço do glb (medidos na malha do S13) e raio da zona que a peça não pode cobrir. */
const FACE_ZONES = [
  { nome: 'olhoD', p: [-0.04, 0.18, 0.0], r: 0.016 },
  { nome: 'olhoE', p: [0.04, 0.18, 0.0], r: 0.016 },
  { nome: 'boca', p: [0, 0.1, 0.025], r: 0.022 },
] as const

export interface HeroDebug {
  ready: () => boolean
  camera: () => ReturnType<typeof cameraSnapshot>
  info: () => ReturnType<typeof rendererInfo>
  masks: (rects?: Record<string, Box>, images?: boolean) => ReturnType<typeof measureMasks>
  setPropVisible: (v: boolean) => void
  /** PNG do canvas com o busto numa pose de shape keys (ausentes em 0), renderizado na hora; o rosto volta depois. */
  face: (keys: Record<string, number>) => string
  /** Adereço vestido (medidas.ts): cor com partes escondidas, máscaras por nome, projeção e objetos do frame. */
  medidas: {
    cor: (ocultar?: string[]) => ReturnType<typeof cor>
    mascara: (regras: Regra[]) => ReturnType<typeof mascara>
    projetar: (p: [number, number, number]) => [number, number]
    centro: (nome: string) => ReturnType<typeof centro>
    objeto: (nome: string) => THREE.Object3D | null
    /** Folga mínima (m, espaço do glb) entre as malhas de cada padrão e o busto, na pose atual (folga.ts). */
    folga: (padroes: string[], raio?: number) => ReturnType<typeof folga>
  }
}

declare global {
  interface Window {
    __heroDebug?: HeroDebug
  }
}

function groups(scene: THREE.Scene): Groups | null {
  const frame = scene.getObjectByName('frame')
  const prop = frame?.getObjectByName('prop')
  const bust = frame?.getObjectByName('bust')
  return frame && prop && bust ? { frame, prop, bust } : null
}

const arr = (m: THREE.Matrix4) => Array.from(m.elements)

/** Visível de fato: o objeto e todos os ancestrais (as moedas da v6, por exemplo, ficam escondidas por grupo). */
function shown(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return true
}

function cameraSnapshot(s: RootState) {
  const cam = s.camera as THREE.PerspectiveCamera
  const g = groups(s.scene)
  s.scene.updateMatrixWorld()
  cam.updateMatrixWorld()
  return {
    css: { w: s.size.width, h: s.size.height },
    dpr: s.gl.getPixelRatio(),
    fov: cam.fov,
    aspect: cam.aspect,
    near: cam.near,
    far: cam.far,
    view: cam.view ? { ...cam.view } : null,
    position: cam.position.toArray(),
    quaternion: cam.quaternion.toArray(),
    matrixWorld: arr(cam.matrixWorld),
    projectionMatrix: arr(cam.projectionMatrix),
    frameMatrixWorld: g ? arr(g.frame.matrixWorld) : null,
  }
}

function rendererInfo(s: RootState) {
  const g = groups(s.scene)
  const read = () => {
    s.gl.render(s.scene, s.camera)
    const r = s.gl.info.render
    return { calls: r.calls, triangulos: r.triangles, pontos: r.points, linhas: r.lines }
  }
  const com = read()
  let sem = null
  if (g) {
    g.prop.visible = false
    sem = read()
    g.prop.visible = true
    read()
  }
  const mem = s.gl.info.memory
  return {
    com,
    sem,
    memoria: { geometrias: mem.geometries, texturas: mem.textures },
    programas: s.gl.info.programs?.length,
  }
}

/** Pixels do buffer → CSS. */
function css(b: Box | null, k: number): Box | null {
  return b && { x: b.x / k, y: b.y / k, w: b.w / k, h: b.h / k }
}

/** Retângulo de cada malha da peça na tela (vértices projetados; sem oclusão). */
function partBoxes(prop: THREE.Object3D, camera: THREE.Camera, w: number, h: number) {
  const v = new THREE.Vector3()
  const out: { nome: string; box: Box; triangulos: number }[] = []
  prop.traverse((o) => {
    if (!isMesh(o) || !shown(o)) return
    const mesh = o
    const pos = mesh.geometry.getAttribute('position')
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < pos.count; i++) {
      // getVertexPosition aplica ossos e morfos (no glb quantizado, a desquantização da malha com skin está nas
      // matrizes inversas dos ossos: a posição crua × matrixWorld sairia em outra escala).
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).project(camera)
      const x = ((v.x + 1) / 2) * w
      const y = ((1 - v.y) / 2) * h
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    const index = mesh.geometry.getIndex()
    const triangulos = Math.round((index ? index.count : pos.count) / 3)
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const nome = `${String(out.length)}:${mesh.name || o.parent?.name || mat?.name || 'sem nome'}`
    out.push({ nome, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, triangulos })
  })
  return out
}

/** Zonas do rosto na tela: centro e raio em pixels do buffer. */
function faceZones(frame: THREE.Object3D, camera: THREE.Camera, w: number, h: number) {
  const toScreen = (p: THREE.Vector3) => {
    p.applyMatrix4(frame.matrixWorld).project(camera)
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h] as const
  }
  return FACE_ZONES.map((z) => {
    const [cx, cy] = toScreen(new THREE.Vector3(...z.p))
    const [ex] = toScreen(new THREE.Vector3(z.p[0] + z.r, z.p[1], z.p[2]))
    return { nome: z.nome, cx, cy, r: Math.abs(ex - cx) }
  })
}

function measureMasks(s: RootState, rects: Record<string, Box> = {}, images = true) {
  const g = groups(s.scene)
  if (!g) return null
  s.scene.updateMatrixWorld()
  s.camera.updateMatrixWorld()
  const k = s.gl.getPixelRatio()
  const pass = (spec: Parameters<typeof renderPass>[4]) => renderPass(s.gl, s.scene, s.camera, g, spec)
  const visible = pass({ prop: 'preto', bust: 'branco' })
  const total = pass({ prop: 'preto', bust: 'oculto' })
  const head = pass({ prop: 'oculto', bust: 'preto', clipBelowY: CHIN_Y })
  const bust = pass({ prop: 'oculto', bust: 'preto' })
  const sv = stats(visible)
  const st = stats(total)
  const sh = stats(head)
  const touch = contact(visible, bust)
  const overUi = Object.fromEntries(
    Object.entries(rects).map(([nome, r]) => {
      const px = countIn(visible, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k })
      return [nome, px / (k * k)]
    }),
  )
  const face = faceZones(g.frame, s.camera, visible.w, visible.h).map((z) => ({
    nome: z.nome,
    centro: [z.cx / k, z.cy / k],
    raio: z.r / k,
    pxCobertos: countInCircle(visible, z.cx, z.cy, z.r) / (k * k),
  }))
  const png = (m: Mask, under?: Mask) => (images ? toPng(m, under) : '')
  return {
    dpr: k,
    peca: { px: sv.px / (k * k), box: css(sv.box, k), pxTotal: st.px / (k * k), boxTotal: css(st.box, k) },
    ocultaPelaCabeca: st.px ? 1 - sv.px / st.px : 0,
    contornoNaCabeca: touch.edge ? touch.touching / touch.edge : 0,
    cabeca: { box: css(sh.box, k), queixoY: CHIN_Y },
    busto: { box: css(stats(bust).box, k) },
    partes: partBoxes(g.prop, s.camera, s.size.width, s.size.height),
    rosto: face,
    sobreUi: overUi,
    imagens: {
      silhueta: png(visible),
      silhuetaTotal: png(total),
      contexto: png(visible, bust),
      cabeca: png(head),
      busto: png(bust),
    },
  }
}

function facePose(s: RootState, keys: Record<string, number>) {
  const g = groups(s.scene)
  if (!g) return ''
  const saved: [number[], number[]][] = []
  g.bust.traverse((o) => {
    if (!isMesh(o) || !o.morphTargetDictionary || !o.morphTargetInfluences) return
    const inf = o.morphTargetInfluences
    saved.push([inf, [...inf]])
    for (const [name, i] of Object.entries(o.morphTargetDictionary)) inf[i] = keys[name] ?? 0
  })
  s.gl.render(s.scene, s.camera)
  const png = s.gl.domElement.toDataURL('image/png')
  for (const [inf, v] of saved) v.forEach((x, i) => (inf[i] = x))
  return png
}

export function createHeroDebug(get: () => RootState): HeroDebug {
  return {
    ready: () => {
      const g = groups(get().scene)
      let meshes = 0
      g?.prop.traverse((o) => {
        if (isMesh(o)) meshes++
      })
      return meshes > 0
    },
    camera: () => cameraSnapshot(get()),
    info: () => rendererInfo(get()),
    masks: (rects, images) => measureMasks(get(), rects, images),
    setPropVisible: (v) => {
      const g = groups(get().scene)
      if (g) g.prop.visible = v
    },
    face: (keys) => facePose(get(), keys),
    medidas: {
      cor: (ocultar) => cor(get(), ocultar),
      mascara: (regras) => mascara(get(), regras),
      projetar: (p) => projetar(get(), p),
      centro: (nome) => centro(get(), nome),
      objeto: (nome) => objeto(get(), nome),
      folga: (padroes, raio) => folga(get(), padroes, raio),
    },
  }
}
