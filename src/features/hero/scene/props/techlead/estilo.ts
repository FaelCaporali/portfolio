/**
 * Estilo do fundo da vida techlead (FICHA-PRODUCAO, FECHAMENTO, "Fundo e site (TD)"): cores, fontes e tamanhos por
 * tela, o traço à mão do Excalidraw (duas passadas com tremor, pontas que passam do canto) e a quebra de texto. O
 * desenho é pintado pelo Pincel da vida devops (../devops/pincel.ts) nas texturas de revelação (../devops/revela.ts):
 * uma vez no resize, e o roteiro só mexe em uniformes. Brilho contido: o rosto domina.
 */
import type { Formato } from '../devops/composicao'
import type { Marca, Pincel, Ponto, Quadro } from './pincel'
import { desenharLogo, type Logo } from './logos'
import type { Alvo } from './roteiro'

export const ACENTO = '#b388ff'

/** Grupos de estado da revelação (0–7): 1 = trechos da legenda destacados (entendimento). */
export const GRUPO = { fixo: 0, destaque: 1 } as const

export const COR = {
  texto: '#e3e6ea',
  fraco: '#98a1ad',
  linha: '#6b7380',
  /** Excalidraw no tema escuro: traço claro; post-its nas cores do Excalidraw. */
  traco: '#ced4da',
  problema: '#ff8787',
  necessidade: '#ffd43b',
  requisito: '#74c0fc',
  /** Mermaid, tema dark. */
  mNo: '#1f2020',
  mBorda: '#81B1DB',
  mTexto: '#d6d6d6',
  mSeta: '#c8c8c8',
  /** Jira no tema escuro. */
  jCartao: '#22272B',
  jBorda: '#38414a',
  jTexto: '#B6C2CF',
  jChave: '#9FADBC',
  jColuna: '#161a1d',
  jHistoria: '#63BA3C',
  jTarefa: '#4BADE8',
  pontos: '#454F59',
  feito: '#4bce97',
  /** Bloqueio (Jira: vermelho do tema escuro), tentativas que falharam e o log. */
  bloqueio: '#f87168',
} as const

/** Avatares genéricos (sem nome nem cargo): cores neutras, nenhuma igual ao acento. */
export const PESSOAS = ['#4bb0a8', '#d9a441', '#e07a5f', '#7a8ca3'] as const

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace"

/** Tamanhos por formato (px CSS): corpo (14 / 11,5, como o QA), meta, rótulo pequeno e logo. */
export const TAM: Record<Formato, { corpo: number; meta: number; rotulo: number; logo: number }> = {
  largo: { corpo: 14, meta: 12, rotulo: 11, logo: 18 },
  medio: { corpo: 11.5, meta: 10, rotulo: 9.5, logo: 15 },
  estreito: { corpo: 9, meta: 8, rotulo: 8, logo: 12 },
}

export const fonte = (px: number, peso = 400) => `${peso} ${px}px ${SANS}`
export const fonteMono = (px: number, peso = 400) => `${peso} ${px}px ${MONO}`

/** Contexto de desenho: pincel do painel, atlas de logos, formato e os pontos que o olhar procura. */
export interface Tela {
  p: Pincel
  img: HTMLImageElement
  f: Formato
  alvos: Partial<Record<Alvo, { x: number; y: number }>>
}

/** Gerador determinístico (o mesmo tremor em todo resize). */
function aleatorio(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Traco {
  cor: string
  largura: number
  dur: number
  semente: number
}

/** Segmento à mão (Excalidraw): duas passadas com tremor nas pontas e no meio, a segunda logo depois da primeira. */
export function rabisco(p: Pincel, m: Marca, a: Ponto, b: Ponto, e: Traco) {
  const r = aleatorio(e.semente)
  const len = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]))
  const j = Math.min(1.8, 0.35 + len * 0.012)
  const nx = -(b[1] - a[1]) / len
  const ny = (b[0] - a[0]) / len
  for (let k = 0; k < 2; k++) {
    const tr = () => (r() - 0.5) * 2 * j
    const p0: Ponto = [a[0] + tr(), a[1] + tr()]
    const p1: Ponto = [b[0] + tr(), b[1] + tr()]
    const d = tr() * 0.9
    const meio: Ponto = [(p0[0] + p1[0]) / 2 + nx * d, (p0[1] + p1[1]) / 2 + ny * d]
    p.linha({ ...m, t: m.t + k * 0.04 }, [p0, meio, p1], {
      cor: e.cor,
      largura: e.largura * (k ? 0.75 : 1),
      dur: e.dur,
    })
  }
}

/** Retângulo à mão: os quatro lados em sequência, cada um passando um pouco do canto. */
export function caixaMao(p: Pincel, m: Marca, q: Quadro, e: Traco) {
  const o = Math.min(3, (q.x1 - q.x0) * 0.03)
  const lados: [Ponto, Ponto][] = [
    [
      [q.x0 - o, q.y0],
      [q.x1 + o, q.y0],
    ],
    [
      [q.x1, q.y0 - o],
      [q.x1, q.y1 + o],
    ],
    [
      [q.x1 + o, q.y1],
      [q.x0 - o, q.y1],
    ],
    [
      [q.x0, q.y1 + o],
      [q.x0, q.y0 - o],
    ],
  ]
  const dt = e.dur / 4
  lados.forEach(([a, b], i) => rabisco(p, { ...m, t: m.t + i * dt }, a, b, { ...e, dur: dt, semente: e.semente + i }))
}

/** Preenchimento de post-it (surge inteiro em m.t), um quadrilátero levemente torto. */
export function preencher(p: Pincel, m: Marca, q: Quadro, cor: string, semente: number) {
  const r = aleatorio(semente)
  const t = () => (r() - 0.5) * 2.4
  p.forma(m, (ctx, tinta) => {
    ctx.fillStyle = tinta(cor)
    ctx.beginPath()
    ctx.moveTo(q.x0 + t(), q.y0 + t())
    ctx.lineTo(q.x1 + t(), q.y0 + t())
    ctx.lineTo(q.x1 + t(), q.y1 + t())
    ctx.lineTo(q.x0 + t(), q.y1 + t())
    ctx.closePath()
    ctx.fill()
  })
}

/** Quebra `txt` em linhas de no máximo `largura` na fonte. */
export function quebrar(p: Pincel, fnt: string, txt: string, largura: number) {
  const linhas: string[] = []
  let atual = ''
  for (const w of txt.split(' ')) {
    const tenta = atual ? `${atual} ${w}` : w
    if (atual && p.medir(fnt, tenta) > largura) {
      linhas.push(atual)
      atual = w
    } else atual = tenta
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Logo do atlas, surgindo inteiro em t. */
export function logo(tl: Tela, id: Logo, x: number, y: number, lado: number, t: number) {
  tl.p.imagem({ t }, x, y, lado, (ctx) => desenharLogo(ctx, tl.img, id, x, y, lado))
}

/** Avatar genérico: círculo com cabeça e ombros (sem nome, sem cargo), surgindo em t. */
export function avatar(p: Pincel, x: number, y: number, raio: number, cor: string, t: number) {
  p.forma({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta(cor)
    ctx.beginPath()
    ctx.arc(x, y, raio, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = tinta('rgba(15, 17, 20, 0.55)')
    ctx.beginPath()
    ctx.arc(x, y - raio * 0.22, raio * 0.33, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x, y + raio * 0.72, raio * 0.6, raio * 0.48, 0, Math.PI, 0)
    ctx.fill()
    ctx.restore()
  })
}
