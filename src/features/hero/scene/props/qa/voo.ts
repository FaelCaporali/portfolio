/**
 * Voo do bug em volta da cabeça (vida qa, FICHA-PRODUCAO.md, FICHA v2): rotas erráticas por pontos de passagem no
 * espaço do glb (+X à esquerda do Fael, +Z para a câmera; cabeça: topo y 0,32, crânio x ±0,09 e z −0,30 a 0,01,
 * olhos y 0,18, boca y 0,10), com folga medida em volta da cabeça (colisao_orq.mjs qa), por trás dela e por cima da
 * testa, nunca na frente dos olhos nem da boca. Curva de Hermite com as tangentes de Catmull-Rom (tempo não uniforme):
 * muda de direção sem padrão, sem "boing". A entrada começa já voando (o bug nasce SOLTO, Q11); as repetições (pausa
 * segurada) começam paradas na VAGA da caixa, de onde o bug catalogado escapa. Toda rota termina parada no ponto de
 * captura, onde a lente espera. As rotas foram desenhadas com a captura do lado direito do Fael (−X); com a captura do
 * outro lado, o x de cada ponto de passagem é espelhado (e no retrato, estreitado). Por cima, o tremor do voo de
 * inseto, que some nas pontas.
 * Só números e um vetor de saída: nada alocado por quadro.
 */
import type * as THREE from 'three'

/** Marcas de ponto de passagem: o ponto de captura e a vaga da caixa (medidos por tela, Qa.tsx). */
const CAP = Number.NaN
const VAGA = Number.POSITIVE_INFINITY

/** Rota: [t (s desde o começo da rota), x, y, z] por ponto; o último é sempre a captura, parado. */
export interface Rota {
  chaves: readonly number[]
  /** Duração até a chegada na lente (s). */
  chega: number
}

/** Pontos medidos por quadro: captura (atrás do vidro da lente) e vaga (sobre o alfinete da caixa). */
export interface Extremos {
  cap: THREE.Vector3
  vaga: THREE.Vector3
  /** Captura do lado esquerdo do Fael (+X): espelha o x dos pontos de passagem. */
  espelho: boolean
  /** Largura das rotas (fator no x dos pontos de passagem): menor no retrato, longe da borda. */
  largura: number
}

const rota = (chaves: number[]): Rota => ({ chaves, chega: chaves[chaves.length - 4] ?? 0 })

/**
 * Entrada (ciclo 0): pela lateral oposta à captura; cruza a frente por cima da testa, volta de repente (a virada sem
 * padrão), contorna a cabeça por trás e entra na lente pela lateral. Nada acima da altura da testa na frente
 * (y ≤ 0,285): acima disso o bug chega no indicador de vidas (volta_prop.mjs qa, 1440 e 360).
 * Repetições: sobem da vaga pela lateral da captura e fazem outro trajeto, alternando.
 * Uma linha por ponto: [t, x, y, z].
 */
// prettier-ignore
export const ROTAS: readonly Rota[] = [
  rota([
    0, 0.18, 0.21, -0.1,
    0.18, 0.12, 0.275, 0.1,
    0.33, -0.03, 0.265, 0.13,
    0.46, 0.06, 0.285, 0.08,
    0.66, 0.17, 0.23, -0.17,
    0.86, 0.02, 0.25, -0.42,
    1.04, -0.19, 0.21, -0.15,
    1.16, -0.21, 0.2, -0.01,
    1.3, CAP, CAP, CAP,
  ]),
  rota([
    0, VAGA, VAGA, VAGA,
    0.2, -0.22, 0.12, 0.03,
    0.4, -0.21, 0.23, -0.06,
    0.6, -0.06, 0.28, -0.36,
    0.82, 0.17, 0.24, -0.12,
    1.0, 0.05, 0.275, 0.12,
    1.14, -0.1, 0.265, 0.1,
    1.3, CAP, CAP, CAP,
  ]),
  rota([
    0, VAGA, VAGA, VAGA,
    0.2, -0.23, 0.13, 0.02,
    0.38, -0.13, 0.27, 0.09,
    0.56, 0.03, 0.28, 0.12,
    0.76, 0.18, 0.2, -0.06,
    0.96, 0.02, 0.24, -0.37,
    1.14, -0.2, 0.19, -0.13,
    1.3, CAP, CAP, CAP,
  ]),
]

/** Tremor do voo: amplitude (m) e frequências (rad/s) por eixo; some a 0 nos primeiros/últimos TREMOR_BORDA s. */
const TREMOR = 0.0045
const FREQ = [
  [41, 67],
  [53, 29],
  [37, 59],
] as const
const TREMOR_BORDA = 0.18
const EIXOS = ['x', 'y', 'z'] as const

interface Ponto {
  t: number
  x: number
  y: number
  z: number
}
const P: [Ponto, Ponto, Ponto, Ponto] = [
  { t: 0, x: 0, y: 0, z: 0 },
  { t: 0, x: 0, y: 0, z: 0 },
  { t: 0, x: 0, y: 0, z: 0 },
  { t: 0, x: 0, y: 0, z: 0 },
]

/** Ponto marcado (captura ou vaga): parado, sem tangente. */
const marcado = (x: number) => Number.isNaN(x) || x === VAGA

/** Ponto i da rota (as marcas trocadas pelos pontos medidos); fora da rota, o da ponta. */
function ponto(r: Rota, i: number, ext: Extremos, out: Ponto) {
  const n = r.chaves.length / 4
  const k = Math.max(0, Math.min(n - 1, i)) * 4
  const x = r.chaves[k + 1] ?? 0
  out.t = r.chaves[k] ?? 0
  let alvo: THREE.Vector3 | null = x === VAGA ? ext.vaga : null
  if (Number.isNaN(x)) alvo = ext.cap
  const lado = ext.espelho ? -ext.largura : ext.largura
  out.x = alvo ? alvo.x : x * lado
  out.y = alvo ? alvo.y : (r.chaves[k + 2] ?? 0)
  out.z = alvo ? alvo.z : (r.chaves[k + 3] ?? 0)
  return out
}

/** Tangente de Catmull-Rom (não uniforme) no ponto entre `a` e `c`; nos pontos marcados, parada. */
function tangente(a: Ponto, c: Ponto, ponta: boolean, eixo: 'x' | 'y' | 'z') {
  if (ponta) return 0
  const dt = c.t - a.t
  return dt > 0 ? (c[eixo] - a[eixo]) / dt : 0
}

/**
 * Posição do bug na rota `r` no instante `t` (s desde o começo da rota), com os pontos medidos `ext`; grava em `out`.
 * `semTremor` para o rastro e a direção ficarem estáveis quando pedido.
 */
export function posicaoNaRota(r: Rota, t: number, ext: Extremos, out: THREE.Vector3, semTremor = false) {
  const n = r.chaves.length / 4
  const tc = Math.max(0, Math.min(r.chega, t))
  let i = 0
  while (i < n - 2 && (r.chaves[(i + 1) * 4] ?? 0) <= tc) i++
  const [a, b, c, d] = P
  ponto(r, i - 1, ext, a)
  ponto(r, i, ext, b)
  ponto(r, i + 1, ext, c)
  ponto(r, i + 2, ext, d)
  const h = c.t - b.t
  const s = h > 0 ? (tc - b.t) / h : 0
  const s2 = s * s
  const s3 = s2 * s
  const h00 = 2 * s3 - 3 * s2 + 1
  const h10 = s3 - 2 * s2 + s
  const h01 = -2 * s3 + 3 * s2
  const h11 = s3 - s2
  // Pontos marcados parados; a ponta de entrada (1º ponto não marcado) usa a diferença de um lado só.
  const bPara = marcado(r.chaves[i * 4 + 1] ?? 0)
  const cPara = marcado(r.chaves[(i + 1) * 4 + 1] ?? 0)
  for (const e of EIXOS) {
    const mb = tangente(i === 0 ? b : a, c, bPara, e)
    const mc = tangente(b, i + 1 === n - 1 ? c : d, cPara, e)
    out[e] = h00 * b[e] + h10 * h * mb + h01 * c[e] + h11 * h * mc
  }
  if (semTremor) return out
  const env = Math.min(1, tc / TREMOR_BORDA, (r.chega - tc) / TREMOR_BORDA)
  if (env <= 0) return out
  const [fx, fy, fz] = FREQ
  out.x += TREMOR * env * (Math.sin(fx[0] * t) + 0.5 * Math.sin(fx[1] * t + 1.3))
  out.y += TREMOR * env * (Math.sin(fy[0] * t + 0.7) + 0.5 * Math.sin(fy[1] * t + 2.1))
  out.z += TREMOR * env * (Math.sin(fz[0] * t + 2.4) + 0.5 * Math.sin(fz[1] * t + 0.4))
  return out
}
