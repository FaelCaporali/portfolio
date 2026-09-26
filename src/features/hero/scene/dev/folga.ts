/**
 * Folga entre o adereço e o busto (só em desenvolvimento; ver debug.ts): distância mínima de cada vértice das malhas
 * do adereço que casam com `padrao` (nome da malha ou de um ancestral) até os vértices do busto e do que está vestido
 * (`vestidos`: boné, óculos, apito), no espaço do glb e na
 * pose ATUAL (shape keys da expressão aplicadas). Como o adereço é filho do `frame`, olhar e arrasto não mudam a folga.
 * Sinal pela normal do vértice do busto mais próximo: negativo = o ponto está dentro da cabeça. Grade de 1 cm, busca
 * até `raio` (acima disso devolve `raio`; ponto sem vizinho dentro do crânio aproximado conta −raio).
 * Lido por 3d/tools/props/folga_vela.mjs.
 */
import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { isMesh } from './passes'

const CELULA = 0.01
/** Abaixo de y 0,02 o busto já sumiu no degradê do pescoço: não há o que atravessar na tela. */
const Y_MIN = 0.02
/** Distância (m) até onde a normal do vértice mais próximo decide dentro/fora. */
const PERTO = 0.008
/** Crânio aproximado (elipsoide no espaço do glb): ponto longe da superfície e dentro dele = atravessou fundo. */
const dentroDoCranio = (v: THREE.Vector3) =>
  (v.x / 0.095) ** 2 + ((v.y - 0.19) / 0.15) ** 2 + ((v.z + 0.13) / 0.185) ** 2 < 1

const chave = (x: number, y: number, z: number) => `${x},${y},${z}`
const celula = (a: number) => Math.floor(a / CELULA)

/** Vértices e normais do busto no espaço do glb, na pose atual, numa grade de 1 cm. */
class Busto {
  grade = new Map<string, number[]>()
  pos: number[] = []
  nor: number[] = []

  constructor(frame: THREE.Object3D, vestidos: RegExp) {
    const bust = frame.getObjectByName('bust')
    const prop = frame.getObjectByName('prop')
    if (!bust || !prop) throw new Error('cena sem os grupos bust e prop')
    const inv = frame.matrixWorld.clone().invert()
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    const nm = new THREE.Matrix3()
    const obstaculo = (o: THREE.Object3D) =>
      isMesh(o) && o.visible && !/Sombra/.test(o.name) && (casa(o, frame, /^bust$/) || casa(o, prop, vestidos))
    frame.traverse((o) => {
      if (!isMesh(o) || !obstaculo(o)) return
      nm.getNormalMatrix(inv.clone().multiply(o.matrixWorld))
      const normal = o.geometry.getAttribute('normal')
      const count = o.geometry.getAttribute('position').count
      for (let i = 0; i < count; i++) {
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv)
        if (v.y < Y_MIN && casa(o, frame, /^bust$/)) continue
        n.fromBufferAttribute(normal, i).applyMatrix3(nm).normalize()
        this.add(v, n)
      }
    })
  }

  private add(v: THREE.Vector3, n: THREE.Vector3) {
    const k = this.pos.length / 3
    this.pos.push(v.x, v.y, v.z)
    this.nor.push(n.x, n.y, n.z)
    const c = chave(celula(v.x), celula(v.y), celula(v.z))
    const lista = this.grade.get(c)
    if (lista) lista.push(k)
    else this.grade.set(c, [k])
  }

  private d2(k: number, v: THREE.Vector3) {
    const p = this.pos
    return ((p[3 * k] ?? 0) - v.x) ** 2 + ((p[3 * k + 1] ?? 0) - v.y) ** 2 + ((p[3 * k + 2] ?? 0) - v.z) ** 2
  }

  /** Vértice do busto mais próximo de v (até r células) e a distância ao quadrado; -1 se não houver. */
  private proximo(v: THREE.Vector3, r: number): [number, number] {
    let melhor = Infinity
    let k0 = -1
    const [cx, cy, cz] = [celula(v.x), celula(v.y), celula(v.z)]
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (const k of this.grade.get(chave(cx + dx, cy + dy, cz + dz)) ?? []) {
            const d = this.d2(k, v)
            if (d < melhor) [melhor, k0] = [d, k]
          }
    return [k0, melhor]
  }

  /** Distância com sinal (m) de v ao busto: negativa dentro; `raio` se longe e fora; −raio se longe e dentro. */
  distancia(v: THREE.Vector3, raio: number) {
    const [k, d2] = this.proximo(v, Math.ceil(raio / CELULA))
    if (k < 0) return dentroDoCranio(v) ? -raio : raio
    const p = this.pos
    const n = this.nor
    const dot =
      (v.x - (p[3 * k] ?? 0)) * (n[3 * k] ?? 0) +
      (v.y - (p[3 * k + 1] ?? 0)) * (n[3 * k + 1] ?? 0) +
      (v.z - (p[3 * k + 2] ?? 0)) * (n[3 * k + 2] ?? 0)
    const d = Math.sqrt(d2)
    // A normal só decide o lado perto da superfície: longe dela (malha com ~2 mm entre vértices), o vértice mais
    // próximo pode estar na borda de uma peça fina (aba do boné, haste dos óculos) com a normal para dentro, e o
    // sinal sairia errado; aí decide o crânio aproximado.
    if (dot < 0 && d > PERTO) return dentroDoCranio(v) ? -d : d
    return (dot >= 0 ? 1 : -1) * d
  }
}

/** A malha pertence a um nó (ela ou ancestral, até `raiz`) cujo nome casa com `re`. */
function casa(o: THREE.Object3D, raiz: THREE.Object3D, re: RegExp) {
  for (let p: THREE.Object3D | null = o; p && p !== raiz; p = p.parent) if (re.test(p.name)) return true
  return false
}

/** Folga mínima (m) por padrão de nome, com o pior vértice (espaço do glb) e a malha dele. */
export function folga(s: RootState, padroes: string[], raio = 0.03, vestidos = '^vela_(bone|oculos|apito)') {
  const frame = s.scene.getObjectByName('frame')
  const prop = frame?.getObjectByName('prop')
  if (!frame || !prop) throw new Error('cena sem frame/prop')
  s.scene.updateMatrixWorld()
  const busto = new Busto(frame, new RegExp(vestidos))
  const inv = frame.matrixWorld.clone().invert()
  const v = new THREE.Vector3()
  const out: Record<string, { min: number; ponto: number[] | null; parte: string }> = {}
  for (const padrao of padroes) {
    const re = new RegExp(padrao)
    const res = { min: raio, ponto: null as number[] | null, parte: '' }
    prop.traverse((o) => {
      if (!isMesh(o) || !casa(o, prop, re)) return
      const count = o.geometry.getAttribute('position').count
      for (let i = 0; i < count; i++) {
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv)
        const d = busto.distancia(v, raio)
        if (d < res.min) Object.assign(res, { min: d, ponto: [v.x, v.y, v.z], parte: o.name })
      }
    })
    out[padrao] = res
  }
  return out
}
