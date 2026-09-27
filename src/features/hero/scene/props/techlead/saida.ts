/**
 * A voz que SAI do microfone rumo à equipe na destrava (REQUISITOS T10): uma fita fina no acento da vida que nasce
 * logo abaixo da cápsula do microfone (acompanha a cabeça: o ponto é projetado por quadro), desce por baixo do queixo,
 * longe da boca, e chega à conversa da equipe no fundo; pulsos correm dela para a equipe. Uma malha, uma chamada; por
 * quadro só se reescrevem posições e alfas (arrays já alocados). Fica no grupo do fundo (preso ao mundo), num plano à
 * frente do rosto (Z_SAIDA), para as máscaras das ferramentas a verem onde ela está.
 */
import * as THREE from 'three'
import { dissolveUniforms } from '../../dissolve'
import type { Ponto } from './pincel'
import { ACENTO } from './estilo'

/** Plano da fita no espaço do glb: à frente do rosto e da barba. */
export const Z_SAIDA = 0.1
const N = 48
/** Meia largura (px CSS), amplitude e comprimento de onda (px) da voz. */
const MEIA = 1
const AMP = 5
const ONDA = 16

const VERT = /* glsl */ `
attribute float aAlfa;
varying float vAlfa;
void main() {
  vAlfa = aAlfa;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */ `
uniform vec3 uCor;
uniform float uD;
varying float vAlfa;
void main() {
  float a = vAlfa * (1.0 - smoothstep(0.0, 0.3, uD));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uCor, a);
  #include <colorspace_fragment>
}`

export function criarSaida() {
  const pos = new Float32Array((N + 1) * 2 * 3)
  const alfa = new Float32Array((N + 1) * 2)
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  const aPos = new THREE.BufferAttribute(pos, 3)
  const aAlfa = new THREE.BufferAttribute(alfa, 1)
  aPos.setUsage(THREE.DynamicDrawUsage)
  aAlfa.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', aPos)
  geo.setAttribute('aAlfa', aAlfa)
  geo.setIndex(idx)
  const material = new THREE.ShaderMaterial({
    name: 'tl_saida',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uCor: { value: new THREE.Color(ACENTO) }, uD: dissolveUniforms.uD },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'tl_saida'
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.visible = false
  // Tela (px CSS) → plano Z_SAIDA do grupo do fundo: origem e passo por px em x e em y (afim; medido no resize).
  const O = new THREE.Vector3()
  const U = new THREE.Vector3()
  const V = new THREE.Vector3()
  const chegada: [number, number] = [0, 0]
  let queixo = 0
  let retrato = false
  let pronto = false

  /** No resize: o mapa tela → plano (`plano` devolve o ponto do plano Z_SAIDA), a chegada e a linha do queixo. */
  const ajustar = (
    plano: (x: number, y: number, out: THREE.Vector3) => THREE.Vector3,
    alvo: Ponto,
    yQueixo: number,
    ehRetrato: boolean,
  ) => {
    plano(0, 0, O)
    plano(100, 0, U).sub(O).divideScalar(100)
    plano(0, 100, V).sub(O).divideScalar(100)
    chegada[0] = alvo[0]
    chegada[1] = alvo[1]
    queixo = yQueixo
    retrato = ehRetrato
    pronto = true
  }
  const escrever = (k: number, x: number, y: number) => {
    pos[k * 3] = O.x + U.x * x + V.x * y
    pos[k * 3 + 1] = O.y + U.y * x + V.y * y
    pos[k * 3 + 2] = O.z + U.z * x + V.z * y
  }

  /** Por quadro: `k` 0–1 (visível), `fase` (s) e o microfone na tela (px CSS). Nada alocado. */
  const atualizar = (k: number, fase: number, mx: number, my: number) => {
    mesh.visible = pronto && k > 0.002
    if (!mesh.visible) return
    const x0 = mx
    const y0 = my + 8
    const [x2, y2] = chegada
    // Controle: por baixo do queixo (paisagem) ou no meio do caminho (retrato, a conversa fica ao lado).
    const x1 = retrato ? (x0 + x2) / 2 : x0 - 6
    const y1 = retrato ? (y0 + y2) / 2 + 10 : Math.max(y0 + 30, queixo + 22)
    const comp = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1)
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const a = (1 - u) * (1 - u)
      const b = 2 * u * (1 - u)
      const c = u * u
      const bx = a * x0 + b * x1 + c * x2
      const by = a * y0 + b * y1 + c * y2
      const tx = 2 * (1 - u) * (x1 - x0) + 2 * u * (x2 - x1)
      const ty = 2 * (1 - u) * (y1 - y0) + 2 * u * (y2 - y1)
      const l = Math.hypot(tx, ty) || 1
      const nx = -ty / l
      const ny = tx / l
      const env = Math.sin(Math.PI * u)
      const d = AMP * env * Math.sin(((u * comp) / ONDA - fase * 3) * Math.PI * 2)
      const cx = bx + nx * d
      const cy = by + ny * d
      escrever(i * 2, cx - nx * MEIA, cy - ny * MEIA)
      escrever(i * 2 + 1, cx + nx * MEIA, cy + ny * MEIA)
      // Pulsos correndo do microfone para a equipe; as pontas somem.
      const pulso = 0.5 + 0.5 * Math.sin((u * 2.5 - fase * 1.8) * Math.PI * 2)
      const borda = Math.min(1, u * 12, (1 - u) * 12)
      const v = k * borda * (0.35 + 0.65 * pulso * pulso)
      alfa[i * 2] = v
      alfa[i * 2 + 1] = v
    }
    aPos.needsUpdate = true
    aAlfa.needsUpdate = true
  }
  const dispose = () => {
    material.dispose()
    geo.dispose()
  }
  return { mesh, ajustar, atualizar, dispose }
}
