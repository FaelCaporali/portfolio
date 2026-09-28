/**
 * Os traços que SOBEM da folha e viram o diagrama no fundo (D12; FICHA-PRODUCAO, FECHAMENTO, batida 1,4–2,0 s): cada
 * traço sai de uma caixa da decomposição na planta e voa, numa curva que abre para o lado da cabeça (nunca pela frente
 * do rosto), até um ícone do diagrama, chegando no instante em que o ícone aparece. Linhas finas com rastro (alfa por
 * vértice), no branco da planta; uma chamada para todos. Por quadro só se reescrevem as posições (nada alocado).
 */
import * as THREE from 'three'
import { withDissolve } from '../../dissolve'
import type { Ponto } from './pincel'
import { ESCALA, T } from './roteiro'

/** Traços no máximo, segmentos do rastro de cada um e o comprimento do rastro (fração do voo). */
const MAX = 16
const SEG = 6
const RASTRO = 0.3
/** Offsets da subida pelo fator dela (roteiro.ts, RITMO.md). */
const KS = ESCALA.sobe
/** Duração do voo de cada traço (s) e o quanto a curva abre para o lado e sobe (m, glb). */
const VOO = 0.45 * KS
const ABRE = 0.09
const SOBE = 0.04
const COR = new THREE.Color('#e6f0ff')

interface Voo {
  /** Origem no espaço da folha (malha) e destino no espaço do grupo do fundo. */
  de: THREE.Vector3
  para: THREE.Vector3
  /** Chegada (s do ciclo). */
  chega: number
}

export function criarTracos() {
  const n = MAX * SEG * 2
  const pos = new Float32Array(n * 3)
  const cor = new Float32Array(n * 4)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 4).setUsage(THREE.DynamicDrawUsage))
  const mat = withDissolve(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }))
  const linhas = new THREE.LineSegments(geo, mat)
  linhas.name = 'arq_tracos'
  linhas.frustumCulled = false
  linhas.visible = false
  const voos: Voo[] = Array.from({ length: MAX }, () => ({
    de: new THREE.Vector3(),
    para: new THREE.Vector3(),
    chega: 0,
  }))
  let ativos = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const p = new THREE.Vector3()
  const inv = new THREE.Matrix4()

  /** Define os voos: origens na folha (espaço da malha) e destinos (espaço do fundo), chegadas em s. */
  const definir = (lista: readonly { de: THREE.Vector3; para: THREE.Vector3; chega: number }[]) => {
    ativos = Math.min(MAX, lista.length)
    for (let i = 0; i < ativos; i++) {
      const v = voos[i]
      const l = lista[i]
      if (!v || !l) continue
      v.de.copy(l.de)
      v.para.copy(l.para)
      v.chega = l.chega
    }
  }

  const bezier = (s: number, out: THREE.Vector3) => {
    const u = 1 - s
    return out
      .copy(a)
      .multiplyScalar(u * u)
      .addScaledVector(c, 2 * u * s)
      .addScaledVector(b, s * s)
  }

  /** Posições no instante c (s do ciclo); `folha` e `fundo` dão os espaços; o pai das linhas é `raiz`. */
  const atualizar = (t: number, folha: THREE.Object3D, fundo: THREE.Object3D, raiz: THREE.Object3D) => {
    const noVoo = t > T.sobe[0] - 0.05 * KS && t < T.sobe[1] + 0.35 * KS
    linhas.visible = noVoo && ativos > 0
    if (!linhas.visible) return
    inv.copy(raiz.matrixWorld).invert()
    cor.fill(0)
    for (let i = 0; i < ativos; i++) {
      const v = voos[i]
      if (!v) continue
      const s = (t - (v.chega - VOO)) / VOO
      a.copy(v.de).applyMatrix4(folha.matrixWorld).applyMatrix4(inv)
      b.copy(v.para).applyMatrix4(fundo.matrixWorld).applyMatrix4(inv)
      // Controle da curva: abre para o lado do destino e sobe um pouco (contorna a cabeça por fora).
      c.copy(a).lerp(b, 0.5)
      c.x += Math.sign(b.x || 1) * ABRE
      c.y += SOBE
      for (let k = 0; k < SEG; k++) {
        const j = (i * SEG + k) * 2
        const s0 = s - RASTRO * (1 - k / SEG)
        const s1 = s - RASTRO * (1 - (k + 1) / SEG)
        bezier(Math.min(1, Math.max(0, s0)), p).toArray(pos, j * 3)
        bezier(Math.min(1, Math.max(0, s1)), p).toArray(pos, (j + 1) * 3)
        const vivo = s1 > 0 && s0 < 1 ? 0.9 : 0
        for (let e = 0; e < 2; e++) {
          const o = (j + e) * 4
          cor[o] = COR.r
          cor[o + 1] = COR.g
          cor[o + 2] = COR.b
          cor[o + 3] = (vivo * (k + e)) / SEG
        }
      }
    }
    const pa = geo.getAttribute('position')
    const ca = geo.getAttribute('color')
    pa.needsUpdate = true
    ca.needsUpdate = true
  }
  const dispose = () => {
    geo.dispose()
    mat.dispose()
  }
  return { linhas, definir, atualizar, dispose }
}

/** Liga cada origem na planta (UV) a destinos no diagrama, na ordem da esquerda para a direita. */
export function parear(origens: readonly Ponto[], destinos: readonly { x: number; y: number; t: number }[]) {
  const d = destinos
    .filter((m) => m.t >= T.sobe[0] && m.t <= T.sobe[1] + 0.3 * KS)
    .sort((m1, m2) => m1.x - m2.x)
    .slice(0, MAX)
  const o = [...origens].sort((p1, p2) => p1[0] - p2[0])
  const meio: Ponto = [0.5, 0.7]
  return d.map((m, i) => ({ origem: o[Math.floor((i / Math.max(1, d.length)) * o.length)] ?? meio, destino: m }))
}
