/**
 * Cena 4 da vida ai, o lado HUMANO da noite (FICHA §4.2): o caso que o guardrail segurou abre o fluxo no canvas do n8n
 * (logo oficial): `Webhook → Extract (LLM) → JSON → IF > $500 → Human-in-the-loop`, os nós acendendo em ordem (o nó do
 * LLM tem rosto, ao lado, nunca no logo); no app do operador, a IA deixou a decisão pré-preenchida (`Refund · $1,240`,
 * `suggested by AI`) e o operador (avatar + cursor) toca `Edit` e depois `Accept`; o nó humano fica verde. No retrato,
 * a silhueta: o logo do n8n, os nós e os dois botões de decisão da noite.
 */
import {
  ACENTO,
  COR,
  PESSOAS,
  TAM,
  botao,
  cartao,
  fonte,
  fonteMono,
  humano,
  janela,
  logo,
  ponteiro,
  rostinho,
} from './estilo'
import type { Tela } from './estilo'
import type { Marca, Quadro } from './pincel'
import { GRUPO, T } from './roteiro'

const NOS = ['Webhook', 'Extract (LLM)', 'JSON', 'IF > $500', 'Human-in-the-loop'] as const

/** Selo de execução do n8n no canto do nó: ✓ verde (ou a espera âmbar). */
function selo(tl: Tela, m: Marca, x: number, y: number, r: number, cor: string, txt: string) {
  tl.p.forma(m, (ctx, tinta) => {
    ctx.fillStyle = tinta(cor)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  })
  tl.p.texto(m, x - r * 0.62, y + 0.5, fonte(r * 1.5, 800), [[txt, '#0b0f12']])
}

/** O canvas do n8n: nós em fila (ou em duas fileiras, se não couber) ligados por conexões; devolve o fim em y. */
function n8n(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const barra = k.meta * 2.1
  const fn = fonte(k.meta, 600)
  const pad = k.meta * 0.7
  const ws = NOS.map((n) => tl.p.medir(fn, n) + pad * 2)
  const gap = k.meta * 1.6
  const total = ws.reduce((a, b) => a + b, 0) + gap * (NOS.length - 1)
  const umaFila = total <= q.x1 - q.x0 - 24
  const h = k.meta * 2.3
  const alto = barra + (umaFila ? h * 2.4 : h * 4)
  const jan: Quadro = { ...q, y1: q.y0 + alto }
  const corpo = janela(tl, jan, T.n8n, barra)
  logo(tl, 'n8n', q.x0 + 46, q.y0 + barra / 2, k.meta * 1.3, T.n8n)
  tl.p.texto({ t: T.n8n }, q.x0 + 58 + k.meta * 0.4, q.y0 + barra / 2, fonteMono(k.meta, 600), [
    ['refund-review', COR.fraco],
  ])
  // Pontos do canvas do n8n.
  tl.p.fundo({ t: T.n8n }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(255, 255, 255, 0.07)')
    for (let x = q.x0 + 10; x < q.x1 - 6; x += 14)
      for (let y = corpo + 8; y < jan.y1 - 4; y += 14) ctx.fillRect(x, y, 1.2, 1.2)
  })
  let x = q.x0 + 14
  let y = corpo + (umaFila ? h * 1.2 : h * 1.05)
  const fila2 = umaFila ? NOS.length : 3
  const pos: { x: number; y: number; w: number }[] = []
  NOS.forEach((nome, i) => {
    if (i === fila2) {
      x = q.x0 + 14
      y += h * 1.9
    }
    const w = ws[i] ?? 0
    const tn = T.n8n + 0.05 + i * 0.03
    tl.p.fundo({ t: tn }, (ctx, tinta) => {
      ctx.fillStyle = tinta(COR.n8nNo)
      ctx.strokeStyle = tinta(COR.n8nBorda)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.roundRect(x + 0.5, y - h / 2, w, h, 5)
      ctx.fill()
      ctx.stroke()
    })
    tl.p.texto({ t: tn }, x + pad, y, fn, [[nome, COR.texto]])
    pos.push({ x, y, w })
    x += w + gap
  })
  // Conexões (a da quebra de fileira desce e volta à esquerda).
  pos.forEach((a, i) => {
    const b = pos[i + 1]
    if (!b) return
    const t = T.n8n + 0.08 + i * 0.03
    const pts: [number, number][] =
      b.y === a.y
        ? [
            [a.x + a.w + 2, a.y],
            [b.x - 2, b.y],
          ]
        : [
            [a.x + a.w / 2, a.y + h / 2 + 1],
            [a.x + a.w / 2, (a.y + b.y) / 2],
            [b.x + b.w / 2, (a.y + b.y) / 2],
            [b.x + b.w / 2, b.y - h / 2 - 2],
          ]
    tl.p.linha({ t }, pts, { cor: COR.n8nLinha, largura: 1.2, dur: 0.04, seta: true })
  })
  // O nó do LLM tem rosto (fora do logo); os nós acendem em ordem; o humano espera e depois aprova.
  const llm = pos[1]
  if (llm) rostinho(tl.p, { t: T.n8n + 0.08 }, llm.x + llm.w - 2, llm.y - h / 2 - k.meta * 0.35, k.meta * 1.25, 'pensa')
  const r = k.meta * 0.55
  pos.forEach((p, i) => {
    const tn = T.nos[i] ?? 0
    const cx = p.x + p.w - (i === 1 ? p.w * 0.5 : 2)
    const cy = p.y - h / 2
    if (i < pos.length - 1) {
      selo(tl, { t: tn }, cx, cy, r, COR.ok, '✓')
      return
    }
    selo(tl, { t: tn, g: GRUPO.aceita, so: 'a' }, cx, cy, r, COR.alerta, '…')
    selo(tl, { t: tn, g: GRUPO.aceita, so: 'b' }, cx, cy, r, COR.ok, '✓')
  })
  tl.alvos.humano = { x: (q.x0 + q.x1) / 2, y: (corpo + jan.y1) / 2 }
  return jan.y1
}

/** O app do operador: título, o valor sugerido pela IA e os botões; o cursor toca Edit e depois Accept. */
function operador(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const t = T.operador
  cartao(tl.p, { t }, q, COR.term, COR.borda, 7)
  const ra = k.corpo * 0.75
  const x = q.x0 + 10
  const larga = q.x1 - q.x0 > 420
  let y = q.y0 + ra + 8
  humano(tl.p, { t }, x + ra, y, ra, PESSOAS.operador)
  const fv = fonte(k.corpo, 700)
  const fs = fonte(k.rotulo, 600)
  let xv = x + ra * 2 + 10
  const wv = tl.p.texto(
    { t: t + 0.03 },
    xv,
    y,
    fv,
    [
      ['Refund · ', COR.texto],
      ['$1,240', COR.texto],
    ],
    0.004,
  )
  if (larga) xv += wv + 12
  else y += k.corpo * 1.5
  const wsug = tl.p.medir(fs, '✦ suggested by AI') + k.rotulo
  tl.p.fundo({ t: t + 0.06 }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(0, 229, 255, 0.1)')
    ctx.strokeStyle = tinta(ACENTO)
    ctx.beginPath()
    ctx.roundRect(xv, y - k.rotulo * 0.85, wsug, k.rotulo * 1.7, 4)
    ctx.fill()
    ctx.stroke()
  })
  tl.p.texto({ t: t + 0.06 }, xv + k.rotulo * 0.5, y, fs, [['✦ suggested by AI', ACENTO]], 0.004)
  // Edit ao vivo: um sublinhado no valor (o operador conferiu); Accept acende (grupo `aceita`).
  tl.p.forma({ t: T.editaOp[0] }, (ctx, tinta) => {
    ctx.fillStyle = tinta(COR.alerta)
    ctx.fillRect(x + ra * 2 + 10, q.y0 + ra + 8 + k.corpo * 0.7, wv, 1.5)
  })
  const xb = larga ? xv + wsug + 14 : x + ra * 2 + 10
  const yb = larga ? y : y + k.corpo * 1.7
  const px = k.meta
  const m = { t: t + 0.08, g: GRUPO.aceita }
  botao(tl, { ...m, so: 'a' }, xb, yb, 'Accept', px, COR.ok, false)
  const wa = botao(tl, { ...m, so: 'b' }, xb, yb, 'Accept', px, COR.ok, true)
  tl.p.texto({ t: t + 0.08 }, xb + wa + px * 0.3, yb, fonte(px, 700), [['·', COR.fraco]])
  const we = botao(tl, { t: t + 0.08 }, xb + wa + px, yb, 'Edit', px, COR.fraco, false)
  const a = k.meta * 1.2
  ponteiro(tl.p, { t: T.cursorOp, g: GRUPO.cursorOp, so: 'a' }, xb + wa + px + we * 0.6, yb + px * 0.3, a)
  ponteiro(tl.p, { t: T.cursorOp, g: GRUPO.cursorOp, so: 'b' }, xb + wa * 0.6, yb + px * 0.3, a)
  return yb + px * 1.5
}

/** O lado humano na zona `q`: o n8n e, ao lado (ou embaixo), o app do operador. */
export function ladoHumano(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const lado = tl.f === 'largo'
  const wOp = lado ? Math.min(250, (q.x1 - q.x0) * 0.32) : 0
  const fimN = n8n(tl, { ...q, x1: q.x1 - (lado ? wOp + 12 : 0) })
  const op: Quadro = lado
    ? { x0: q.x1 - wOp, y0: q.y0, x1: q.x1, y1: Math.min(q.y1, q.y0 + k.corpo * 7.2) }
    : { x0: q.x0, y0: fimN + 10, x1: q.x1, y1: Math.min(q.y1, fimN + 10 + k.corpo * 3.6) }
  operador(tl, op)
}

/** Retrato (silhueta): o n8n (logo e nós) e os dois botões de decisão da noite (Human-in-the-loop, Accept). */
export function humanoMini(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const lg = k.logo
  const corpo = janela(tl, q, T.n8n, lg * 0.9)
  logo(tl, 'n8n', q.x0 + lg * 0.75, corpo + lg * 0.75, lg, T.n8n)
  tl.p.fundo({ t: T.n8n + 0.05 }, (ctx, tinta) => {
    ctx.fillStyle = tinta(COR.n8nNo)
    ctx.strokeStyle = tinta(COR.n8nBorda)
    for (let j = 0; j < 3; j++) {
      ctx.beginPath()
      ctx.roundRect(q.x0 + lg * 1.6 + j * lg * 0.95, corpo + lg * 0.55, lg * 0.7, lg * 0.4, 2)
      ctx.fill()
      ctx.stroke()
    }
  })
  const yb = corpo + lg * 1.9
  humano(tl.p, { t: T.operador }, q.x0 + lg * 0.6, yb, lg * 0.42, PESSOAS.operador)
  const m = { t: T.nos[4], g: GRUPO.aceita }
  botao(tl, { ...m, so: 'a' }, q.x0 + lg * 1.3, yb, '…', k.meta, COR.alerta, false)
  const w = botao(tl, { ...m, so: 'b' }, q.x0 + lg * 1.3, yb, '✓', k.meta, COR.ok, true)
  botao(tl, { ...m, so: 'a' }, q.x0 + lg * 1.5 + w, yb, '✓', k.meta, COR.ok, false)
  botao(tl, { ...m, so: 'b' }, q.x0 + lg * 1.5 + w, yb, '✓', k.meta, COR.ok, true)
  tl.alvos.humano = { x: (q.x0 + q.x1) / 2, y: yb }
}
