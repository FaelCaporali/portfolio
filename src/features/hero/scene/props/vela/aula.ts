/**
 * A aula de vela (V8; ADENDOS 2, 3, 6 e 7), em funções puras do relógio da vida (s desde a montagem). Os dois barcos
 * NAVEGAM um circuito de regata fechado em volta da cabeça, no plano inclinado da ficha (frente baixa, abaixo da boca;
 * trás alta, atrás da cabeça, sumindo por oclusão real), uma volta em VOLTA s.
 *
 * Regra de vela: o vento VERDADEIRO é fixo no espaço do glb e vem da direita da tela (+x). Visto de cima o percurso é
 * um pentágono de cantos redondos com a ponta para a câmera: perna da esquerda para a frente ao través, orçada para a
 * orça fechada (45°, vindo para a câmera), VIRADA DE BORDO na ponta da frente, abaixo do queixo (a proa cruza o vento,
 * o barco quase para, a retranca cruza pelo centro, o adernamento troca de lado), orça a 45° no outro bordo indo para
 * a direita, arribada ao través na perna da direita, popa na perna de trás com o JAIBE atrás da cabeça (a retranca
 * atravessa rápido, escondida) e través de novo na esquerda. Pernas de orça em 3/4 para a câmera (a vela lê). Nenhum
 * rumo é sustentado a menos de 40° do vento. Velocidade, retranca e adernamento saem do ângulo α do vento em relação à
 * proa (0 = de proa, ±π = de popa). O Optimist faz o mesmo percurso ATRASO s depois: as mesmas manobras no mesmo
 * ponto. Movimento reduzido: nada roda (Vela.tsx).
 * Espaço do glb: metros na escala do scan, Y para cima, rosto para +Z; ângulos em rad; rumo = giro em Y (proa em +x).
 */
import { angulo, noPercurso, poligono } from './circuito'

/**
 * Pentágono visto de cima (x, z), na ordem de navegação, começando na ponta da frente (a virada). As duas pernas da
 * frente ficam a 45° do vento (rumos −37° e 53° com o vento a 8°): orça fechada nos dois bordos.
 */
const VERTICES = [
  // Folga (Fael, 25/09: "o barco atravessa minha bochecha"): pentágono afastado da cabeça com os MESMOS rumos (ponta
  // da frente andando ao longo da perna que chega nela; perna da direita 2 cm para fora; perna de trás 3 cm para trás)
  // e a frente mais baixa. Tamanho, ritmo, manobras e vento iguais. Prova: colisao_orq.mjs e folga_vela.mjs (≥ 5 mm
  // contra busto, boné, óculos e apito, em todas as poses).
  [0.062, 0.179],
  [0.18, 0.0217],
  [0.18, -0.39],
  [-0.16, -0.39],
  [-0.16, 0.0125],
] as const
/** Raio dos cantos (m). */
const RAIO = 0.035
/** Plano inclinado: altura do centro de giro na frente (z máximo) e atrás (z mínimo). */
const ALTURA = { frente: -0.03, tras: 0.22 } as const
/**
 * Uma volta (s) e o instante da virada do Laser (proa no vento, s desde a montagem; dentro da pausa, 1,2–2,8 s).
 * @public lidos também por 3d/tools/props/diagrama_vela.mjs, que transpila este arquivo.
 */
export const VOLTA = 3.0
/** @public idem (diagrama_vela.mjs). */
export const VIRA_LASER = 1.5
/** Atraso do Optimist no mesmo percurso (s): vira em VIRA_LASER + ATRASO. */
export const ATRASO = 0.6
/** Escala dos barcos navegando sobre o tamanho do glb (Laser 0,75 H no 1440, ADENDO 8). */
export const ESCALA = 1
/**
 * De onde vem o vento verdadeiro (horizontal, unitário): da direita da tela, 8° para trás. A perna de trás fica ao
 * largo (172°, um bordo só) e o jaibe cai no canto de trás-esquerda, escondido pela cabeça.
 * @public lido também por 3d/tools/props/diagrama_vela.mjs.
 */
export const VENTO_DE = { x: Math.cos((8 * Math.PI) / 180), z: -Math.sin((8 * Math.PI) / 180) } as const

const G = Math.PI / 180
type Tabela = readonly (readonly [number, number])[]
/** Pontos de vela: |α| (graus) → abertura da retranca (graus, sempre a sotavento). */
const RETRANCA: Tabela = [
  [0, 0],
  [40, 5],
  [45, 7],
  [90, 42],
  [135, 65],
  [180, 87],
]
/** |α| → fração do adernamento máximo (a sotavento): máximo na orça e no través, pouco no largo, zero na popa. */
const ADERNA: Tabela = [
  [0, 0],
  [35, 0.2],
  [45, 1],
  [90, 1],
  [135, 0.35],
  [180, 0],
]
const ADERNA_MAX = 18 * G
/** |α| → velocidade relativa: quase parado no meio da virada, lento na orça, rápido no través e no largo. */
const VELOCIDADE: Tabela = [
  [0, 0.3],
  [40, 0.45],
  [45, 0.75],
  [90, 1],
  [135, 1],
  [180, 0.85],
]

/** Interpolação linear numa tabela crescente em x. */
function tabela(t: Tabela, x: number) {
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i] ?? [0, 0]
    const [x0, y0] = t[i - 1] ?? [0, 0]
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return t[t.length - 1]?.[1] ?? 0
}

const embrulha = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
/** α: de onde vem o vento em relação à proa (> 0 = vento por bombordo, −z do casco; sotavento a boreste). */
const alfaDe = (rumo: number) => embrulha(angulo(VENTO_DE.x, VENTO_DE.z) - rumo)
export { angulo }

export interface Ponto {
  x: number
  y: number
  z: number
  rumo: number
  alfa: number
  /** Velocidade relativa pelo ponto de vela (1 = través). */
  v: number
}

/** Tabela uniforme no tempo (M quadros por volta), feita uma vez: a velocidade de cada ponto de vela decide o tempo. */
const N = 2000
const M = 600
function construir() {
  const trechos = poligono(VERTICES, RAIO)
  const total = trechos.reduce((soma, t) => soma + t.L, 0)
  const pts = Array.from({ length: N }, (_, i) => noPercurso(trechos, total, (i / N) * total))
  const inicio: number[] = []
  let T = 0
  for (let i = 0; i < N; i++) {
    const [x0, z0, r0] = pts[i] ?? [0, 0, 0]
    const [x1, z1] = pts[(i + 1) % N] ?? [0, 0, 0]
    inicio.push(T)
    T += Math.hypot(x1 - x0, z1 - z0) / tabela(VELOCIDADE, Math.abs(alfaDe(r0)) / G)
  }
  const out: Ponto[] = []
  let j = 0
  const zs = VERTICES.map((q) => q[1])
  const [fundo, frente] = [Math.min(...zs), Math.max(...zs)]
  for (let k = 0; k < M; k++) {
    const tt = (k / M) * T
    while (j < N - 1 && (inicio[j + 1] ?? T) <= tt) j++
    const [x, z, rumo] = pts[j] ?? [0, 0, 0]
    const y = ALTURA.tras + ((ALTURA.frente - ALTURA.tras) * (z - fundo)) / (frente - fundo)
    const alfa = alfaDe(rumo)
    out.push({ x, y, z, rumo, alfa, v: tabela(VELOCIDADE, Math.abs(alfa) / G) })
  }
  // Fração da volta em que a proa passa pelo vento: a virada.
  let vira = 0
  out.forEach((p, i) => {
    if (Math.abs(p.alfa) < Math.abs(out[vira]?.alfa ?? Math.PI)) vira = i
  })
  return { out, vira: vira / M }
}
const { out: TABELA, vira: FRACAO_VIRADA } = construir()

/** Ponto do percurso no instante t (s desde a montagem), `atraso` s atrás do Laser. */
export function percurso(t: number, atraso: number, p: Ponto): Ponto {
  const f = ((((t - atraso - VIRA_LASER) / VOLTA + FRACAO_VIRADA) % 1) + 1) % 1
  const q = TABELA[Math.floor(f * M)] ?? TABELA[0]
  if (q) Object.assign(p, q)
  return p
}

/** Velocidade do barco em relação à do vento verdadeiro, no través (compõe o vento aparente). */
const VB = 0.6

/**
 * Vento aparente no referencial do casco (o que a biruta e as fitas mostram): `para` = para onde ele sopra (ângulo de
 * `angulo`, 0 = para a proa, π = para a popa) e `paneja` = 1 quando a vela bate (proa perto do vento, na virada).
 */
export function ventoAparente(p: Ponto, out: { para: number; paneja: number }) {
  const ax = -VENTO_DE.x - Math.cos(p.rumo) * p.v * VB
  const az = -VENTO_DE.z + Math.sin(p.rumo) * p.v * VB
  out.para = embrulha(angulo(ax, az) - p.rumo)
  out.paneja = 1 - Math.min(1, Math.max(0, (Math.abs(p.alfa) / G - 25) / 20))
  return out
}

/** Ponto de vela para o ângulo α: retranca (rad, + = boreste) e adernamento (rad), os dois a sotavento. */
export function pontoDeVela(alfa: number, out: { retranca: number; aderna: number }) {
  const lado = alfa >= 0 ? 1 : -1
  const abs = Math.abs(alfa) / G
  out.retranca = lado * tabela(RETRANCA, abs) * G
  out.aderna = lado * tabela(ADERNA, abs) * ADERNA_MAX
  return out
}

/** Constantes de tempo (s): a retranca acompanha o ponto de vela quase na hora e cruza o jaibe em ~0,1 s; o casco
 * assenta o adernamento em ~0,3 s. */
export const TAU_RETRANCA = 0.04
export const TAU_ADERNA = 0.1

/** Aproxima `atual` de `alvo` com constante de tempo tau (s): inércia da retranca no jaibe e do adernamento. */
export const seguir = (atual: number, alvo: number, dt: number, tau: number) =>
  atual + (alvo - atual) * (1 - Math.exp(-dt / tau))

export interface Balanco {
  aderna: number
  arfa: number
}

/** Balanço de mar calmo por cima (ESTILO §5): ±2°, ±1,5 mm, período ≥ 4 s, fases diferentes. */
export const ONDAS = { laser: { periodo: 4.4, fase: 0 }, optimist: { periodo: 5.3, fase: 2.1 } } as const
export function balanco(t: number, onda: { periodo: number; fase: number }, out: Balanco): Balanco {
  const w = (2 * Math.PI * t) / onda.periodo + onda.fase
  out.aderna = 2 * G * Math.sin(w)
  out.arfa = 0.0015 * Math.sin(w - Math.PI / 2)
  return out
}
