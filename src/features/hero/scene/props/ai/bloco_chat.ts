/**
 * Cenas 3 e 4 da vida ai no app (FICHA §4.2): o chat de atendimento às `02:14`. A cliente: "I was charged twice."; o
 * robô pensa e, SOB o balão, o TRACE da resposta aparece span a span — `rag.search` (o trecho que vira a fonte),
 * `vectors · top-3`, `context 6.2k / 8k` (a barra com o excesso cortado), `model:` (o seletor com Anthropic Claude,
 * OpenAI GPT e Google Gemini, logos oficiais, e o ✓ `latency`), `mcp → crm.lookup`, `JSON ✓`; o robô responde com a
 * fonte; ela: "It's $1,240.". No conflito, `confidence 0.71` bate no escudo `guardrail(0.8)` (`needs human review`) e,
 * depois do operador, chega "Refund approved ✓". No retrato, a silhueta (rostos, os três logos, o escudo).
 */
import { ACENTO, COR, PESSOAS, TAM, fonte, fonteMono, humano, janela, logo, rostinho, type Tela } from './estilo'
import type { Logo } from './logos'
import { Pincel, type Quadro } from './pincel'
import { T } from './roteiro'

const MODELOS: readonly [Logo, string][] = [
  ['anthropic', 'Anthropic Claude'],
  ['openai', 'OpenAI GPT'],
  ['gemini', 'Google Gemini'],
]
/** O modelo que o seletor escolhe (índice em MODELOS). */
const ESCOLHIDO = 2

/** Quebra `txt` em linhas de no máximo `max` px na fonte. */
function linhasDe(tl: Tela, fnt: string, txt: string, max: number) {
  const linhas: string[] = []
  let atual = ''
  for (const p of txt.split(' ')) {
    const tenta = atual ? `${atual} ${p}` : p
    if (atual && tl.p.medir(fnt, tenta) > max) {
      linhas.push(atual)
      atual = p
    } else atual = tenta
  }
  linhas.push(atual)
  return linhas
}

/** Balão (cliente à esquerda, robô à direita), com o texto quebrado na largura; devolve o fim em y. */
function balao(tl: Tela, q: Quadro, y: number, t: number, quem: 'cliente' | 'robo', txt: string, extra?: string) {
  const k = TAM[tl.f]
  const ra = k.corpo * 0.62
  const fb = fonte(k.corpo)
  const fx = fonte(k.rotulo, 700)
  const robo = quem === 'robo'
  const max = q.x1 - q.x0 - ra * 2 - 22 - k.corpo
  const linhas = linhasDe(tl, fb, txt, max)
  const ex = extra ? tl.p.medir(fx, extra) + 6 : 0
  const ult = linhas[linhas.length - 1] ?? ''
  const cabeExtra = tl.p.medir(fb, ult) + ex <= max
  const nl = linhas.length + (extra && !cabeExtra ? 1 : 0)
  const w =
    Math.min(max, Math.max(...linhas.map((l) => tl.p.medir(fb, l)), cabeExtra ? tl.p.medir(fb, ult) + ex : ex)) +
    k.corpo
  const lh = k.corpo * 1.3
  const h = nl * lh + k.corpo * 0.5
  const xb = robo ? q.x1 - 8 - ra * 2 - 5 - w : q.x0 + 8 + ra * 2 + 5
  const yc = y + h / 2
  if (robo) rostinho(tl.p, { t }, q.x1 - 8 - ra, y + ra, ra * 2, 'fala')
  else humano(tl.p, { t }, q.x0 + 8 + ra, y + ra, ra, PESSOAS.cliente)
  tl.p.fundo({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta(robo ? 'rgba(0, 229, 255, 0.13)' : 'rgba(255, 255, 255, 0.09)')
    ctx.beginPath()
    ctx.roundRect(xb, y, w, h, Math.min(h / 2, k.corpo))
    ctx.fill()
  })
  linhas.forEach((l, i) => {
    const yl = yc - ((nl - 1) * lh) / 2 + i * lh
    const wl = tl.p.texto({ t: t + 0.02 }, xb + k.corpo / 2, yl, fb, [[l, COR.texto]], 0.004)
    if (extra && cabeExtra && i === linhas.length - 1)
      tl.p.texto({ t: t + 0.05 }, xb + k.corpo / 2 + wl + 6, yl, fx, [[extra, ACENTO]])
  })
  if (extra && !cabeExtra)
    tl.p.texto({ t: t + 0.05 }, xb + k.corpo / 2, yc + ((nl - 1) * lh) / 2, fx, [[extra, ACENTO]])
  return y + h + k.corpo * 0.45
}

/** Um span do trace: marcador, nome em mono e uma barrinha de duração; devolve o y seguinte. */
function span(tl: Tela, q: Quadro, y: number, t: number, nome: readonly (readonly [string, string])[], dur: number) {
  const k = TAM[tl.f]
  const fm = fonteMono(k.rotulo + 0.5)
  const x = q.x0 + 14
  tl.p.forma({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta(ACENTO)
    ctx.fillRect(x - 6, y - 2.5, 3, 5)
  })
  const w = tl.p.texto({ t }, x, y, fm, nome, 0.004)
  const bx = x + w + 6
  const bw = Math.max(0, Math.min(q.x1 - 10 - bx, (q.x1 - q.x0) * 0.25 * dur))
  if (bw > 6) {
    tl.p.forma({ t: t + 0.03 }, (ctx, tinta) => {
      ctx.fillStyle = tinta('rgba(0, 229, 255, 0.45)')
      ctx.fillRect(bx, y - 2, bw, 4)
    })
  }
  return y + (k.rotulo + 0.5) * 1.55
}

/** O trace sob o balão da cliente: os seis spans e o seletor de modelo. */
function trace(tl: Tela, q: Quadro, y0: number) {
  const k = TAM[tl.f]
  const lh = (k.rotulo + 0.5) * 1.55
  let y = y0 + lh * 0.5
  const [s0, s1, s2, s3, s4, s5] = T.spans
  tl.p.fundo({ t: s0 - 0.03 }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(0, 229, 255, 0.05)')
    ctx.fillRect(q.x0 + 6, y0, q.x1 - q.x0 - 12, lh * 9.4)
  })
  y = span(
    tl,
    q,
    y,
    s0,
    [
      ['rag.search ', COR.texto],
      ['refunds.md', ACENTO],
    ],
    0.8,
  )
  y = span(tl, q, y, s1, [['vectors · top-3', COR.texto]], 0.5)
  y = span(tl, q, y, s2, [['context 6.2k / 8k', COR.texto]], 0)
  // A janela de contexto: o orçamento (78 %) e o excesso além do fim, hachurado e cortado.
  const bx = q.x0 + 14
  const bw = (q.x1 - q.x0 - 30) * 0.8
  const by = y - lh * 0.35
  tl.p.forma({ t: s2 + 0.04 }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(COR.linha)
    ctx.strokeRect(bx + 0.5, by - 3, bw, 6)
    ctx.fillStyle = tinta('rgba(0, 229, 255, 0.6)')
    ctx.fillRect(bx + 1.5, by - 2, bw * 0.775, 4)
    ctx.strokeStyle = tinta(COR.menos)
    for (let hx = 0; hx < bw * 0.2; hx += 4) {
      ctx.beginPath()
      ctx.moveTo(bx + bw + 4 + hx, by + 3)
      ctx.lineTo(bx + bw + 8 + hx, by - 3)
      ctx.stroke()
    }
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(bx + bw + 2, by - 5)
    ctx.lineTo(bx + bw + 2, by + 5)
    ctx.stroke()
  })
  y += lh * 0.4
  y = span(tl, q, y, s3, [['model:', COR.texto]], 0)
  const lg = k.logo * 0.8
  const fn = fonte(k.meta)
  MODELOS.forEach(([id, nome], j) => {
    const yl = y + lh * j * 0.95 - lh * 0.1
    const tj = s3 + 0.02 + j * 0.03
    const x = q.x0 + 16
    logo(tl, id, x + lg / 2, yl, lg, tj)
    const wn = tl.p.texto({ t: tj }, x + lg + 5, yl, fn, [[nome, j === ESCOLHIDO ? COR.texto : COR.fraco]], 0.004)
    if (j !== ESCOLHIDO) return
    const xc = x + lg + 10 + wn
    const fl = fonte(k.rotulo, 700)
    const cabe = xc + tl.p.medir(fl, '✓ latency') < q.x1 - 8
    tl.p.texto({ t: T.escolha }, cabe ? xc : x + lg + 5, cabe ? yl : yl + lh * 0.9, fl, [['✓ latency', COR.ok]], 0.01)
  })
  y += lh * (MODELOS.length * 0.95 + (q.x1 - q.x0 < 170 ? 0.9 : 0))
  y = span(
    tl,
    q,
    y,
    s4,
    [
      ['mcp → ', COR.texto],
      ['crm.lookup', ACENTO],
    ],
    0.6,
  )
  y = span(
    tl,
    q,
    y,
    s5,
    [
      ['JSON ', COR.texto],
      ['✓', COR.ok],
    ],
    0.2,
  )
  return y
}

/** O escudo do guardrail que a confidence bate; devolve o fim em y. */
function escudo(tl: Tela, q: Quadro, y: number) {
  const k = TAM[tl.f]
  const fm = fonteMono(k.rotulo + 0.5, 600)
  const x = q.x0 + 10
  tl.p.texto(
    { t: T.confianca },
    x,
    y,
    fm,
    [
      ['confidence ', COR.fraco],
      ['0.71', COR.alerta],
    ],
    0.004,
  )
  const ys = y + k.corpo * 1.5
  const s = k.corpo * 0.7
  tl.p.forma({ t: T.escudo }, (ctx, tinta) => {
    ctx.fillStyle = tinta(COR.alerta)
    ctx.beginPath()
    ctx.moveTo(x + s, ys - s)
    ctx.lineTo(x + s * 1.85, ys - s * 0.6)
    ctx.quadraticCurveTo(x + s * 1.8, ys + s * 0.6, x + s, ys + s)
    ctx.quadraticCurveTo(x + s * 0.2, ys + s * 0.6, x + s * 0.15, ys - s * 0.6)
    ctx.closePath()
    ctx.fill()
  })
  const fg = fonte(k.meta, 700)
  const xg = x + s * 2 + 6
  tl.p.texto({ t: T.escudo }, xg, ys - k.meta * 0.55, fg, [['guardrail(0.8)', COR.alerta]], 0.004)
  tl.p.texto({ t: T.escudo + 0.04 }, xg, ys + k.meta * 0.65, fonte(k.meta), [['needs human review', COR.texto]], 0.004)
  tl.alvos.escudo = { x: x + s, y: ys }
  return ys + s + k.corpo * 0.6
}

/** A conversa e o trace a partir de `y`; devolve o fim em y. */
function conversa(tl: Tela, q: Quadro, y0: number) {
  const k = TAM[tl.f]
  let y = balao(tl, q, y0 + k.corpo * 0.5, T.cliente, 'cliente', 'I was charged twice.')
  y = trace(tl, q, y)
  y = balao(tl, q, y + k.corpo * 0.3, T.resposta, 'robo', 'Two charges found.', '[source]')
  y = balao(tl, q, y, T.valor, 'cliente', "It's $1,240.")
  y = escudo(tl, q, y)
  return balao(tl, q, y, T.aprovado, 'robo', 'Refund approved ✓')
}

/** O chat inteiro na zona `q`: a janela tem a altura da conversa (medida num ensaio sem pintar). */
export function chat(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const barra = k.meta * 2.1
  const ensaio: Tela = { ...tl, p: new Pincel({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1), alvos: {} }
  const fim = Math.min(q.y1, conversa(ensaio, q, q.y0 + barra) + k.corpo * 0.2)
  const corpo = janela(tl, { ...q, y1: fim }, T.chat, barra)
  const fr = fonteMono(k.meta, 700)
  rostinho(tl.p, { t: T.chat }, q.x0 + 44, q.y0 + barra / 2, k.meta * 1.3, 'olhos')
  tl.p.texto({ t: T.chat }, q.x1 - 10 - tl.p.medir(fr, '02:14'), q.y0 + barra / 2, fr, [['02:14', COR.texto]])
  const y = conversa(tl, q, corpo)
  tl.alvos.chat = { x: (q.x0 + q.x1) / 2, y: (corpo + y) / 2 }
  return fim
}

/** Retrato (silhueta): o chat mínimo com a cliente, o robô, os três logos do seletor e o escudo. */
export function chatMini(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const lg = k.logo
  const alto = Math.min(q.y1 - q.y0, lg * 7)
  const corpo = janela(tl, { ...q, y1: q.y0 + alto }, T.chat, lg * 0.9)
  let y = corpo + lg * 0.75
  humano(tl.p, { t: T.cliente }, q.x0 + lg * 0.6, y, lg * 0.42, PESSOAS.cliente)
  tl.p.fundo({ t: T.cliente }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(255, 255, 255, 0.12)')
    ctx.fillRect(q.x0 + lg * 1.2, y - 3, (q.x1 - q.x0) * 0.5, 6)
  })
  y += lg * 1.15
  MODELOS.forEach(([id], j) => logo(tl, id, q.x0 + lg * (0.75 + j * 1.15), y, lg * 0.95, T.spans[3] + j * 0.03))
  y += lg * 1.2
  rostinho(tl.p, { t: T.resposta }, q.x1 - lg * 0.7, y, lg, 'fala')
  y += lg * 1.2
  tl.p.forma({ t: T.escudo }, (ctx, tinta) => {
    const s = lg * 0.4
    const x = q.x0 + lg * 0.7
    ctx.fillStyle = tinta(COR.alerta)
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s * 0.85, y - s * 0.6)
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.6, x, y + s)
    ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.6, x - s * 0.85, y - s * 0.6)
    ctx.closePath()
    ctx.fill()
  })
  tl.alvos.escudo = { x: q.x0 + lg * 0.7, y }
  tl.alvos.chat = { x: (q.x0 + q.x1) / 2, y: corpo + lg * 2 }
}
