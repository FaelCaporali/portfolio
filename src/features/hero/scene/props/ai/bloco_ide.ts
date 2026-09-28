/**
 * Cena 1 e cena 5 da vida ai (FICHA §4.2): a IDE dele, às `18:40`. Abas `harness.ts` e `system_prompt.v1.md`; no
 * editor, o harness que o agente de código acabou de escrever (a saída com `schema: Reply`, o JSON Schema de `answer`,
 * `sources`, `confidence`, e a linha do guardrail com `0.6`); no painel do agente, o avatar com o logo da Anthropic AO
 * LADO e as chamadas `mcp → …` com o logo do MCP, `tests ✓  types ✓` e `Approve · Edit · Reject`. O cursor DELE troca
 * `0.6` → `0.8` e clica Approve. Na volta (`09:02`): a aba `cases/refund-1240.json`, `evals 91% → 96%` e a aba
 * `system_prompt.v2.md`. No retrato, a silhueta (rosto, logos, o Approve que acende).
 */
import { DIFF, exibir, quebraSuave, realce } from './codigo'
import { ACENTO, COR, TAM, botao, fonte, fonteMono, janela, logo, ponteiro, rostinho, type Tela } from './estilo'
import type { Quadro } from './pincel'
import { GRUPO, T } from './roteiro'

const MCP = ['repo.read', 'postgres.query', 'browser.open'] as const
const FALA = 'Harness ready.'

/** Abas da barra de título; devolve o x depois delas. */
function abas(tl: Tela, q: Quadro, barra: number) {
  const k = TAM[tl.f]
  const fa = fonte(k.meta, 500)
  const y = q.y0 + barra / 2
  let x = q.x0 + 44
  const aba = (txt: string, t: number, ativa: boolean, g = 0, so?: 'a' | 'b') => {
    const w = tl.p.medir(fa, txt) + k.meta * 1.2
    tl.p.fundo({ t, g, so }, (ctx, tinta) => {
      ctx.fillStyle = tinta(ativa ? COR.term : 'rgba(255, 255, 255, 0.03)')
      ctx.fillRect(x, q.y0 + 3, w, barra - 3)
      if (ativa) {
        ctx.fillStyle = tinta(ACENTO)
        ctx.fillRect(x, q.y0 + 3, w, 1.5)
      }
    })
    tl.p.texto({ t, g, so }, x + k.meta * 0.6, y, fa, [[txt, ativa ? COR.texto : COR.fraco]])
    return w
  }
  x += aba('harness.ts', T.ide, true) + 2
  aba('system_prompt.v1.md', T.ide, false, GRUPO.volta, 'a')
  x += aba('system_prompt.v2.md', T.ide, false, GRUPO.volta, 'b') + 2
  x += aba('cases/refund-1240.json', T.caso, false) + 2
  return x
}

/** Barra de título: abas, `evals` (na volta) e o relógio 18:40 → 09:02. */
function barraTitulo(tl: Tela, q: Quadro, barra: number) {
  const k = TAM[tl.f]
  abas(tl, q, barra)
  const y = q.y0 + barra / 2
  const fr = fonteMono(k.meta, 700)
  const wr = tl.p.medir(fr, '18:40')
  const xr = q.x1 - 10 - wr
  tl.p.texto({ t: T.ide, g: GRUPO.volta, so: 'a' }, xr, y, fr, [['18:40', COR.fraco]])
  tl.p.texto({ t: T.ide, g: GRUPO.volta, so: 'b' }, xr, y, fr, [['09:02', COR.texto]])
  const fe = fonteMono(k.meta, 700)
  const we = tl.p.medir(fe, 'evals 91% → 96%')
  tl.p.texto(
    { t: T.evals },
    xr - 14 - we,
    y,
    fe,
    [
      ['evals 91% → ', COR.fraco],
      ['96%', COR.ok],
    ],
    0.01,
  )
}

/** Linha de código no editor (fundo verde se `mais`); devolve a largura do texto. */
function linha(tl: Tela, t: number, x: number, x1: number, y: number, txt: string, mais: boolean, sinal: boolean) {
  const k = TAM[tl.f]
  const lh = k.mono * 1.4
  const fm = fonteMono(k.mono)
  if (mais) {
    tl.p.fundo({ t }, (ctx, tinta) => {
      ctx.fillStyle = tinta(COR.maisFundo)
      ctx.fillRect(x - 4, y - lh / 2, x1 - x + 4, lh)
    })
  }
  if (sinal) tl.p.texto({ t }, x, y, fm, [['+', COR.mais]])
  return tl.p.texto({ t }, x + k.mono * 1.1, y, fm, realce(txt, mais ? COR.texto : COR.com))
}

/** Editor com o harness; devolve a posição do limiar (o 0.6 que vira 0.8). */
function editor(tl: Tela, q: Quadro, y0: number) {
  const k = TAM[tl.f]
  const fm = fonteMono(k.mono)
  const lh = k.mono * (tl.f === 'largo' ? 1.45 : 1.35)
  const x = q.x0 + k.mono * 0.8
  const larg = q.x1 - x - k.mono * 1.4
  const [t0, t1] = T.codigo
  let y = y0 + lh * 0.65
  linha(tl, t0, x, q.x1, y, DIFF.reply, false, false)
  const ger = quebraSuave(tl.p, fm, DIFF.gera, larg)
  ger.forEach((parte, i) => {
    y += lh
    linha(tl, t0 + 0.1, x, q.x1, y, exibir(parte, i), true, i === 0)
  })
  const [antes, limiar, depois] = DIFF.guarda
  let ini = 0
  let alvo = { x: 0, y: 0, w: 0 }
  quebraSuave(tl.p, fm, antes + limiar + depois, larg).forEach((parte, i) => {
    y += lh
    const fim = ini + parte.length
    const pos = antes.length
    const tl0 = t1 - 0.1
    const vis = exibir(parte, i)
    if (pos < ini || pos >= fim) {
      linha(tl, tl0, x, q.x1, y, vis, true, i === 0)
      ini = fim
      return
    }
    // Posição do limiar no texto exibido (a continuação perde os espaços do começo e ganha o recuo).
    const p0 = vis.length - parte.length + (pos - ini)
    const w0 = linha(tl, tl0, x, q.x1, y, vis.slice(0, p0), true, i === 0)
    const xn = x + k.mono * 1.1 + w0
    const wn = tl.p.medir(fm, limiar)
    tl.p.texto({ t: tl0, g: GRUPO.edicao, so: 'a' }, xn, y, fm, [[limiar, COR.num]])
    tl.p.forma({ t: tl0, g: GRUPO.edicao, so: 'b' }, (ctx, tinta) => {
      ctx.fillStyle = tinta('rgba(227, 179, 65, 0.32)')
      ctx.fillRect(xn - 2, y - lh / 2 + 1, wn + 4, lh - 2)
      ctx.fillStyle = tinta('#ffffff')
      ctx.fillRect(xn + wn + 1, y - lh * 0.42, 1.4, lh * 0.84)
    })
    tl.p.texto({ t: tl0, g: GRUPO.edicao, so: 'b' }, xn, y, fm, [[DIFF.editado, '#ffd866']])
    tl.p.texto({ t: tl0 }, xn + wn, y, fm, realce(vis.slice(p0 + limiar.length)))
    alvo = { x: xn, y, w: wn }
    ini = fim
  })
  return alvo
}

/** Painel do agente de código: rosto + logo da Anthropic ao lado, MCP, testes e a faixa de decisão. */
function agente(tl: Tela, q: Quadro, y0: number) {
  const k = TAM[tl.f]
  // No 1024 a IDE tem 108 px de altura: as seis linhas do painel ficam mais juntas para a faixa caber.
  const lh = k.mono * (tl.f === 'largo' ? 1.45 : 1.2)
  const x = q.x0 + 8
  tl.p.fundo({ t: T.agente }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(255, 255, 255, 0.035)')
    ctx.fillRect(q.x0, y0, q.x1 - q.x0 - 1, q.y1 - y0 - 1)
  })
  const lg = k.logo
  let y = y0 + lh * 0.7
  rostinho(tl.p, { t: T.agente }, x + lg / 2, y, lg, 'fala')
  logo(tl, 'anthropic', x + lg * 1.7, y, lg * 0.95, T.agente)
  tl.p.texto({ t: T.agente + 0.03 }, x + lg * 2.5 + 2, y, fonte(k.meta, 500), [[FALA, COR.texto]], 0.01)
  const fm = fonteMono(k.mono * 0.92)
  MCP.forEach((l, i) => {
    y += lh
    const ti = T.mcp[0] + i * ((T.mcp[1] - T.mcp[0]) / 3)
    logo(tl, 'mcp', x + k.mono * 0.5, y, k.mono * 1.05, ti)
    tl.p.texto(
      { t: ti },
      x + k.mono * 1.4,
      y,
      fm,
      [
        ['mcp', ACENTO],
        [' → ', COR.fraco],
        [l, COR.texto],
      ],
      0.004,
    )
  })
  y += lh
  const fb = fonte(k.meta, 600)
  tl.p.texto({ t: T.testes }, x, y, fb, [
    ['tests ', COR.texto],
    ['✓', COR.ok],
    ['  types ', COR.texto],
    ['✓', COR.ok],
  ])
  y += lh * 1.05
  return faixa(tl, x, y)
}

/** `Approve · Edit · Reject`: o Approve acende (grupo `aprova`); devolve o centro do Approve. */
function faixa(tl: Tela, x: number, y: number) {
  const k = TAM[tl.f]
  const px = k.meta * 0.95
  const m = { t: T.faixa, g: GRUPO.aprova }
  botao(tl, { ...m, so: 'a' }, x, y, 'Approve', px, COR.ok, false)
  const wa = botao(tl, { ...m, so: 'b' }, x, y, 'Approve', px, COR.ok, true)
  const sep = fonte(px, 700)
  let xb = x + wa
  tl.p.texto({ t: T.faixa }, xb + px * 0.3, y, sep, [['·', COR.fraco]])
  xb += px
  xb += botao(tl, { t: T.faixa }, xb, y, 'Edit', px, COR.fraco, false)
  tl.p.texto({ t: T.faixa }, xb + px * 0.3, y, sep, [['·', COR.fraco]])
  botao(tl, { t: T.faixa }, xb + px, y, 'Reject', px, COR.menos, false)
  return { x: x + wa * 0.7, y }
}

/** A IDE inteira na zona `q`. */
export function ide(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const barra = k.meta * 2.1
  const corpo = janela(tl, q, T.ide, barra)
  barraTitulo(tl, q, barra)
  const pw = tl.f === 'largo' ? 236 : 172
  const ed: Quadro = { x0: q.x0, y0: corpo, x1: q.x1 - pw, y1: q.y1 }
  const n = editor(tl, ed, corpo)
  const ap = agente(tl, { x0: q.x1 - pw, y0: corpo, x1: q.x1, y1: q.y1 }, corpo)
  // O cursor dele: no limiar (troca 0.6 → 0.8) e depois no Approve (grupo `cursorIde`).
  const a = k.mono * 1.1
  ponteiro(tl.p, { t: T.cursor, g: GRUPO.cursorIde, so: 'a' }, n.x + n.w * 0.7, n.y + k.mono * 0.45, a)
  ponteiro(tl.p, { t: T.cursor, g: GRUPO.cursorIde, so: 'b' }, ap.x, ap.y + k.meta * 0.35, a)
  tl.alvos.ide = { x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 }
  tl.alvos.limiar = { x: n.x + n.w / 2, y: n.y }
}

/** Retrato (silhueta): a IDE mínima, o agente (rosto + Anthropic), o MCP e o Approve que acende. */
export function ideMini(tl: Tela, q: Quadro) {
  const k = TAM[tl.f]
  const lg = k.logo
  const corpo = janela(tl, q, T.ide, lg * 0.9)
  const y = corpo + lg * 0.8
  rostinho(tl.p, { t: T.agente }, q.x0 + lg * 0.7, y, lg, 'fala')
  logo(tl, 'anthropic', q.x0 + lg * 1.95, y, lg, T.agente)
  logo(tl, 'mcp', q.x0 + lg * 3.2, y, lg, T.mcp[0])
  ;[0.7, 0.85].forEach((f, i) => {
    tl.p.fundo({ t: T.codigo[0] + i * 0.1 }, (ctx, tinta) => {
      ctx.fillStyle = tinta(COR.mais)
      ctx.globalAlpha = 0.7
      ctx.fillRect(q.x0 + 6, y + lg * (0.85 + i * 0.45), (q.x1 - q.x0 - 12) * f, lg * 0.22)
      ctx.globalAlpha = 1
    })
  })
  const yb = Math.min(q.y1 - k.meta, y + lg * 2.1)
  const m = { t: T.faixa, g: GRUPO.aprova }
  botao(tl, { ...m, so: 'a' }, q.x0 + 6, yb, '✓', k.meta, COR.ok, false)
  botao(tl, { ...m, so: 'b' }, q.x0 + 6, yb, '✓', k.meta, COR.ok, true)
  tl.alvos.ide = { x: (q.x0 + q.x1) / 2, y }
  tl.alvos.limiar = { x: (q.x0 + q.x1) / 2, y: y + lg }
}
