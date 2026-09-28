/**
 * O FIO de luz da vida ai (FICHA §4.1): uma fita fina no acento da vida (#00e5ff) por um caminho de oito.ts (o 8 da
 * história ou o elo do 0.8 ao escudo), com setas de sentido. Ele se DESENHA junto com a história (a frente anda com o
 * caso) e a cabeça da frente brilha (branca, cauda no acento). Uma malha, uma chamada; a geometria é montada no resize
 * (cada ponto da tela vai ao plano do fundo por raio), e por quadro só se reescrevem dois atributos (alfa e brilho), em
 * arrays já alocados. Apaga com a desintegração (uD).
 */
import * as THREE from 'three'
import { dissolveUniforms } from '../../dissolve'
import type { Ponto } from '../techlead/pincel'
import { ACENTO } from './estilo'
import type { Caminho } from './oito'

/** Alfa da linha desenhada (o pulso sobe até 1) e comprimento da cauda do pulso (px). */
const BASE = 0.5
const CAUDA = 150
/** Uma seta a cada tanto de caminho (px) e o tamanho dela. */
const SETA_A_CADA = 190

const VERT = /* glsl */ `
attribute float aAlfa;
attribute float aBrilho;
varying float vAlfa;
varying float vBrilho;
void main() {
  vAlfa = aAlfa;
  vBrilho = aBrilho;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */ `
uniform vec3 uCor;
uniform float uD;
varying float vAlfa;
varying float vBrilho;
void main() {
  float a = vAlfa * (1.0 - smoothstep(0.0, 0.3, uD));
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uCor, vec3(1.0), vBrilho * 0.75), a);
  #include <colorspace_fragment>
}`

export function criarFita(nome: string, ordem: number) {
  const geo = new THREE.BufferGeometry()
  const material = new THREE.ShaderMaterial({
    name: nome,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uCor: { value: new THREE.Color(ACENTO) }, uD: dissolveUniforms.uD },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = nome
  mesh.frustumCulled = false
  mesh.renderOrder = ordem
  mesh.visible = false
  let sv = new Float32Array(0)
  let alfa = new Float32Array(0)
  let brilho = new Float32Array(0)
  let aAlfa: THREE.BufferAttribute | null = null
  let aBrilho: THREE.BufferAttribute | null = null

  /**
   * No resize: monta a fita pelo caminho (px CSS) com meia largura `meia` (px); `plano(x, y, out)` leva um ponto da
   * tela ao plano do fundo, nas coordenadas do pai da malha.
   */
  const ajustar = (c: Caminho, meia: number, plano: (x: number, y: number, out: THREE.Vector3) => THREE.Vector3) => {
    const n = c.pts.length
    const setas: [Ponto, Ponto, number][] = []
    for (let s = SETA_A_CADA * 0.5; s < c.total; s += SETA_A_CADA) {
      let i = 1
      while (i < n - 1 && (c.s[i] ?? 0) < s) i++
      const a = c.pts[i - 1] as Ponto
      const b = c.pts[i] as Ponto
      setas.push([a, b, s])
    }
    const nv = n * 2 + setas.length * 3
    const pos = new Float32Array(nv * 3)
    sv = new Float32Array(nv)
    alfa = new Float32Array(nv)
    brilho = new Float32Array(nv)
    const idx: number[] = []
    const v = new THREE.Vector3()
    const pv = (k: number, x: number, y: number, s: number) => {
      plano(x, y, v)
      pos[k * 3] = v.x
      pos[k * 3 + 1] = v.y
      pos[k * 3 + 2] = v.z
      sv[k] = s
    }
    for (let i = 0; i < n; i++) {
      const a = c.pts[Math.max(0, i - 1)] as Ponto
      const b = c.pts[Math.min(n - 1, i + 1)] as Ponto
      const p = c.pts[i] as Ponto
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / l
      const ny = (b[0] - a[0]) / l
      const s = c.s[i] ?? 0
      pv(i * 2, p[0] - nx * meia, p[1] - ny * meia, s)
      pv(i * 2 + 1, p[0] + nx * meia, p[1] + ny * meia, s)
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const k = 3 + meia * 3.2
    setas.forEach(([a, b, s], j) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const tx = (b[0] - a[0]) / l
      const ty = (b[1] - a[1]) / l
      const o = n * 2 + j * 3
      pv(o, b[0] + tx * k * 0.6, b[1] + ty * k * 0.6, s)
      pv(o + 1, b[0] - tx * k * 0.6 - ty * k * 0.55, b[1] - ty * k * 0.6 + tx * k * 0.55, s)
      pv(o + 2, b[0] - tx * k * 0.6 + ty * k * 0.55, b[1] - ty * k * 0.6 - tx * k * 0.55, s)
      idx.push(o, o + 1, o + 2)
    })
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    aAlfa = new THREE.BufferAttribute(alfa, 1)
    aBrilho = new THREE.BufferAttribute(brilho, 1)
    aAlfa.setUsage(THREE.DynamicDrawUsage)
    aBrilho.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aAlfa', aAlfa)
    geo.setAttribute('aBrilho', aBrilho)
    geo.setIndex(idx)
    mesh.visible = true
  }

  /**
   * Por quadro: `frente` (px de arco já desenhados), o pulso em `sp` px (< 0: sem pulso) e `realce` 0–1 (o trecho
   * desenhado inteiro acende).
   */
  const atualizar = (frente: number, sp: number, realce = 0) => {
    if (!aAlfa || !aBrilho) return
    const base = BASE + (1 - BASE) * realce
    for (let i = 0; i < sv.length; i++) {
      const s = sv[i] ?? 0
      const d = Math.min(1, Math.max(0, (frente - s) / 20))
      let p = 0
      if (sp >= 0) {
        const atras = sp - s
        p = atras >= 0 && atras < CAUDA ? (1 - atras / CAUDA) ** 2 : 0
      }
      alfa[i] = Math.max(base * d, p)
      brilho[i] = Math.max(p * p, realce * d * 0.5)
    }
    aAlfa.needsUpdate = true
    aBrilho.needsUpdate = true
  }
  const dispose = () => {
    material.dispose()
    geo.dispose()
  }
  return { mesh, ajustar, atualizar, dispose }
}
