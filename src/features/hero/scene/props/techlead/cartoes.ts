/**
 * Cartões do Jira que ANDAM no Kanban da vida techlead (FICHA-PRODUCAO, FECHAMENTO: "avatares genéricos puxam
 * cartões", "cartões chegam em Done"). Uma malha, uma chamada: quatro quadriláteros com a imagem de cada cartão num
 * atlas (canvas, pintado no resize). Por quadro só se reescrevem as 16 posições e os 16 alfas (arrays já alocados):
 * a posição vai no próprio buffer, e não num shader, para as máscaras das ferramentas (que trocam o material) verem o
 * cartão onde ele está. Os slots (coluna, linha) vêm do bloco do quadro (bloco_jira.ts), em px CSS.
 */
import * as THREE from 'three'
import { dissolveUniforms } from '../../dissolve'
import type { Quadro } from './pincel'
import type { Formato } from '../devops/composicao'
import { pintarBloqueio, pintarCartao, type Cartao } from './cartoes_arte'
import { ESCALA, T } from './roteiro'

const CO = T.coordenacao
/** Offsets da coordenação e dos desenhos da destrava pelo fator da batida (roteiro.ts, RITMO.md). */
const KC = ESCALA.coordenacao
const KD = ESCALA.destrava
/**
 * Coluna 0 To Do, 1 In Progress, 2 Done; duas linhas. O primeiro é o cartão que TRAVA (destrava, T10): fica Blocked
 * em In Progress e corre para Done depois do conselho. Pontos: 18 no sprint; 13 feitos no fim (o degrau do burndown).
 */
const CARTOES: readonly Cartao[] = [
  {
    chave: 'APP-101',
    resumo: 'Checkout API',
    tipo: 'story',
    pontos: 8,
    inicio: [1, 0],
    passos: [[T.done[0], T.done[1], 2, 1]],
  },
  {
    chave: 'APP-102',
    resumo: 'Doc checklist',
    tipo: 'story',
    pontos: 5,
    inicio: [1, 1],
    passos: [[CO + 0.1 * KC, CO + 0.3 * KC, 2, 0]],
  },
  {
    chave: 'APP-103',
    resumo: 'Upload docs',
    tipo: 'task',
    pontos: 3,
    inicio: [0, 0],
    passos: [
      [CO + 0.25 * KC, CO + 0.45 * KC, 1, 1],
      [T.puxa[0], T.puxa[1], 1, 0],
    ],
  },
  {
    chave: 'APP-104',
    resumo: 'Reminder email',
    tipo: 'task',
    pontos: 2,
    inicio: [0, 1],
    passos: [[CO + 0.4 * KC, CO + 0.5 * KC, 0, 0]],
  },
]

const N = CARTOES.length
/** Quadriláteros: os cartões e, por cima do primeiro, a marca Blocked (contorno vermelho e `blocked · 5h`). */
const Q = N + 1
const VERT = /* glsl */ `
attribute float aAlfa;
varying vec2 vUv;
varying float vAlfa;
void main() {
  vUv = uv;
  vAlfa = aAlfa;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uD;
varying vec2 vUv;
varying float vAlfa;
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  float a = c.a * vAlfa * (1.0 - smoothstep(0.0, 0.3, uD));
  if (a < 0.004) discard;
  gl_FragColor = vec4(c.rgb, a);
  #include <colorspace_fragment>
}`

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

export function criarCartoes() {
  const pos = new Float32Array(Q * 4 * 3)
  const uv = new Float32Array(Q * 4 * 2)
  const alfa = new Float32Array(Q * 4)
  const idx: number[] = []
  for (let i = 0; i < Q; i++) {
    const b = i * 4
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    // Cartão i na faixa i do atlas (horizontal): cantos sup-esq, sup-dir, inf-esq, inf-dir.
    uv.set([i / Q, 1, (i + 1) / Q, 1, i / Q, 0, (i + 1) / Q, 0], i * 8)
  }
  const geo = new THREE.BufferGeometry()
  const aPos = new THREE.BufferAttribute(pos, 3)
  const aAlfa = new THREE.BufferAttribute(alfa, 1)
  aPos.setUsage(THREE.DynamicDrawUsage)
  aAlfa.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', aPos)
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('aAlfa', aAlfa)
  geo.setIndex(idx)
  const u = { uAtlas: { value: null as THREE.Texture | null }, uD: dissolveUniforms.uD }
  const material = new THREE.ShaderMaterial({
    name: 'tl_cartoes',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: u,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'tl_cartoes'
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  mesh.visible = false
  /** Centro e meia-largura/altura de cada slot no plano do fundo: [coluna][linha] → x, y. */
  const slots: number[][][] = []
  let meiaW = 0
  let meiaH = 0
  let z = 0

  /** Slots em px CSS (Quadro por coluna e linha) e o mapa tela → plano; pinta o atlas. */
  const ajustar = (
    f: Formato,
    q: readonly (readonly Quadro[])[],
    plano: (x: number, y: number, out: THREE.Vector3) => THREE.Vector3,
    escala: number,
  ) => {
    const primeiro = q[0]?.[0]
    if (!primeiro) return
    const w = primeiro.x1 - primeiro.x0
    const h = primeiro.y1 - primeiro.y0
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(w * escala) * Q
    canvas.height = Math.ceil(h * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.width / Q
    CARTOES.forEach((c, i) => {
      ctx.setTransform(escala, 0, 0, escala, i * cw, 0)
      pintarCartao(ctx, f, c, i, w, h)
    })
    ctx.setTransform(escala, 0, 0, escala, N * cw, 0)
    pintarBloqueio(ctx, f, 0, w, h)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    u.uAtlas.value?.dispose()
    u.uAtlas.value = tex
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    slots.length = 0
    q.forEach((col, ci) => {
      slots[ci] = col.map((s) => {
        plano(s.x0, s.y0, a)
        plano(s.x1, s.y1, b)
        z = a.z
        meiaW = Math.abs(b.x - a.x) / 2
        meiaH = Math.abs(b.y - a.y) / 2
        return [(a.x + b.x) / 2, (a.y + b.y) / 2]
      })
    })
    mesh.visible = true
  }

  const ORIGEM = [0, 0]
  const centro = (col: number, lin: number) => slots[col]?.[lin] ?? ORIGEM
  /** Escreve o vértice v (0–3) do cartão i. */
  const vert = (i: number, v: number, x: number, y: number) => {
    const k = (i * 4 + v) * 3
    pos[k] = x
    pos[k + 1] = y
    pos[k + 2] = z
  }
  /** Posições e alfas no instante c (por quadro, sem alocar). `surge`: [início, fim] do aparecimento. */
  const atualizar = (c: number, surge: readonly [number, number]) => {
    if (!slots.length) return
    CARTOES.forEach((cart, i) => {
      let [x = 0, y = 0] = centro(cart.inicio[0], cart.inicio[1])
      let lift = 0
      for (const [t0, t1, col, lin] of cart.passos) {
        if (c <= t0) break
        const e = liso((c - t0) / (t1 - t0))
        const [nx = 0, ny = 0] = centro(col, lin)
        x += (nx - x) * e
        y += (ny - y) * e
        lift = Math.max(lift, Math.sin(Math.PI * e) * 0.08)
      }
      const sw = meiaW * (1 + lift)
      const sh = meiaH * (1 + lift)
      vert(i, 0, x - sw, y + sh)
      vert(i, 1, x + sw, y + sh)
      vert(i, 2, x - sw, y - sh)
      vert(i, 3, x + sw, y - sh)
      const d = (surge[1] - surge[0]) / N
      alfa.fill(liso((c - surge[0] - i * d) / (0.15 * KC)), i * 4, i * 4 + 4)
      if (i > 0) return
      // A marca Blocked segue o primeiro cartão: acende no bloqueio e apaga quando o teste fica verde.
      vert(N, 0, x - sw, y + sh)
      vert(N, 1, x + sw, y + sh)
      vert(N, 2, x - sw, y - sh)
      vert(N, 3, x + sw, y - sh)
      const b = liso((c - T.bloqueio) / (0.1 * KD)) * (1 - liso((c - T.verde) / (0.1 * KD)))
      alfa.fill(b, N * 4, N * 4 + 4)
    })
    aPos.needsUpdate = true
    aAlfa.needsUpdate = true
  }
  const dispose = () => {
    u.uAtlas.value?.dispose()
    material.dispose()
    geo.dispose()
  }
  return { mesh, ajustar, atualizar, dispose }
}
