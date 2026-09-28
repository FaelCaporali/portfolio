/**
 * Medidas de adereço vestido (só em desenvolvimento; ver debug.ts): a cena desenhada de novo, no mesmo quadro, com
 * partes escondidas (cor) ou pintadas de preto/branco (máscara). Tudo acontece numa chamada síncrona, então o olhar,
 * o piscar e a pose são os mesmos em todas as variantes (a comparação "com × sem óculos" usa os mesmos pixels).
 * Nomes são expressões regulares testadas contra o nome da malha, dos ancestrais (até `frame`) e do material.
 * Lido por 3d/tools/props/medidas_vela.mjs.
 */
import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { isMesh, mascaraCortada, type Mask } from './passes'

type Tinta = 'preto' | 'branco' | 'oculto'
/** Regra de máscara: a primeira que casa decide a tinta da malha; nenhuma casa → branco (oclusor). */
export type Regra = [padrao: string, tinta: Tinta]

/** Imagem RGBA (linhas de cima para baixo) no tamanho do buffer de desenho. */
export interface Imagem {
  w: number
  h: number
  data: Uint8Array
}

const isPoints = (o: THREE.Object3D): o is THREE.Points => (o as Partial<THREE.Points>).isPoints === true

function frameOf(s: RootState) {
  const f = s.scene.getObjectByName('frame')
  if (!f) throw new Error('cena sem o grupo frame')
  return f
}

/** Nomes que identificam a malha: ela, os ancestrais até o frame e os materiais. */
function nomes(o: THREE.Object3D, frame: THREE.Object3D) {
  const out: string[] = []
  for (let p: THREE.Object3D | null = o; p && p !== frame; p = p.parent) out.push(p.name)
  if (isMesh(o)) for (const m of [o.material].flat()) out.push(m.name)
  return out
}

const casa = (o: THREE.Object3D, frame: THREE.Object3D, padrao: string) => {
  const re = new RegExp(padrao)
  return nomes(o, frame).some((n) => n && re.test(n))
}

/** Esconde temporariamente cada objeto que casa; devolve a restauração. */
function esconder(frame: THREE.Object3D, padroes: string[]) {
  const escondidos: THREE.Object3D[] = []
  frame.traverse((o) => {
    if (o.visible && padroes.some((p) => o.name && new RegExp(p).test(o.name))) {
      o.visible = false
      escondidos.push(o)
    }
  })
  return () => escondidos.forEach((o) => (o.visible = true))
}

/** Lê o buffer de desenho logo depois de renderizar (mesma tarefa: o buffer ainda não foi apresentado). */
function ler(gl: THREE.WebGLRenderer): Imagem {
  const ctx = gl.getContext()
  const w = ctx.drawingBufferWidth
  const h = ctx.drawingBufferHeight
  const raw = new Uint8Array(w * h * 4)
  ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, raw)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) data.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
  return { w, h, data }
}

/** A cena como o visitante vê, com os objetos cujo NOME casa com `ocultar` escondidos. */
export function cor(s: RootState, ocultar: string[] = []): Imagem {
  const restaurar = esconder(frameOf(s), ocultar)
  s.gl.setRenderTarget(null)
  s.gl.render(s.scene, s.camera)
  const img = ler(s.gl)
  restaurar()
  return img
}

/** Máscara (1 = preto) do que as regras pintam de preto, com o resto do frame como oclusor branco. */
export function mascara(s: RootState, regras: Regra[]): Mask {
  const frame = frameOf(s)
  const preto = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false, side: THREE.DoubleSide })
  const branco = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, side: THREE.DoubleSide })
  const trocados = new Map<THREE.Mesh, THREE.Mesh['material']>()
  const cortados: THREE.Material[] = []
  const escondidos: THREE.Object3D[] = []
  s.scene.traverse((o) => {
    if (isPoints(o) && o.visible) {
      o.visible = false
      escondidos.push(o)
    }
  })
  frame.traverse((o) => {
    if (!isMesh(o)) return
    const tinta = regras.find(([p]) => casa(o, frame, p))?.[1] ?? 'branco'
    if (tinta === 'oculto') {
      if (o.visible) escondidos.push(o)
      o.visible = false
      return
    }
    trocados.set(o, o.material)
    // Adereço com degradê próprio: só a parte visível conta (passes.ts, mascaraCortada).
    const c = mascaraCortada(o, tinta === 'preto' ? '#000000' : '#ffffff')
    if (c) cortados.push(c)
    o.material = c ?? (tinta === 'preto' ? preto : branco)
  })
  const background = s.scene.background
  const clear = s.gl.getClearColor(new THREE.Color())
  const alpha = s.gl.getClearAlpha()
  s.scene.background = null
  s.gl.setClearColor('#ffffff', 1)
  s.gl.setRenderTarget(null)
  s.gl.clear()
  s.gl.render(s.scene, s.camera)
  const img = ler(s.gl)
  s.gl.setClearColor(clear, alpha)
  s.scene.background = background
  trocados.forEach((m, o) => (o.material = m))
  escondidos.forEach((o) => (o.visible = true))
  preto.dispose()
  branco.dispose()
  cortados.forEach((m) => m.dispose())
  const data = new Uint8Array(img.w * img.h)
  for (let i = 0; i < data.length; i++) data[i] = (img.data[i * 4] ?? 255) < 128 ? 1 : 0
  // Deixa o quadro como estava para o próximo screenshot.
  s.gl.render(s.scene, s.camera)
  return { w: img.w, h: img.h, data }
}

/** Ponto do espaço do glb → pixel do buffer de desenho. */
export function projetar(s: RootState, p: [number, number, number]): [number, number] {
  const frame = frameOf(s)
  s.scene.updateMatrixWorld()
  const v = new THREE.Vector3(...p).applyMatrix4(frame.matrixWorld).project(s.camera)
  const ctx = s.gl.getContext()
  const w = ctx.drawingBufferWidth
  const h = ctx.drawingBufferHeight
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
}

/** Centro, no espaço do glb, de um objeto do frame (ex.: os olhos). */
export function centro(s: RootState, nome: string): [number, number, number] | null {
  const frame = frameOf(s)
  const o = frame.getObjectByName(nome)
  if (!o) return null
  s.scene.updateMatrixWorld()
  const box = new THREE.Box3().setFromObject(o)
  const c = box.getCenter(new THREE.Vector3()).applyMatrix4(frame.matrixWorld.clone().invert())
  return [c.x, c.y, c.z]
}

/** Objeto do frame por nome, para os casos ruins das provas (lente opaca, boné estourado, peça sobre o texto). */
export const objeto = (s: RootState, nome: string) => frameOf(s).getObjectByName(nome) ?? null
