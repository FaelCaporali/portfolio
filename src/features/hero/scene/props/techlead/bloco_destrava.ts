/**
 * DESTRAVA da vida techlead (REQUISITOS T8, T10; o ponto alto): a conversa da equipe (avatares genéricos, sem nome
 * nem cargo) com as tentativas que falharam há horas (restart, timeout, mais pods), o log do checkout estourando o
 * tempo com a mesma query repetida, e o `</>` do Fael entrando com o conselho ("it's an N+1 — batch the query") e o
 * diff de 1 linha; a conversa marca `2 min` e o teste fica verde. O cartão Blocked e a corrida para Done estão em
 * cartoes.ts; a voz que sai do microfone rumo à equipe, em saida.ts. Nenhum projeto nem cliente citado (T6).
 */
import type { Ponto, Quadro } from './pincel'
import { ACENTO, COR, PESSOAS, TAM, avatar, fonte, fonteMono, quebrar, type Tela } from './estilo'
import { T } from './roteiro'

const TENTATIVAS = ['restarted the service', 'raised the timeout', 'scaled to more pods'] as const
const LOG = [
  [
    ['GET /checkout ', COR.fraco],
    ['504', COR.bloqueio],
    [' · 30s', COR.fraco],
  ],
  [
    ['SELECT … id=? ', COR.fraco],
    ['×300', COR.bloqueio],
  ],
] as const
const CONSELHO = 'it’s an N+1 — batch the query'
const DIFF = [
  ['- ids.map(find)', COR.bloqueio],
  ['+ findMany(ids)', COR.feito],
] as const

/** Avatar do Fael na conversa: o acento com o glifo `</>`. */
function fael(tl: Tela, x: number, y: number, r: number, t: number) {
  tl.p.forma({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta(ACENTO)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  })
  const fnt = fonteMono(Math.max(6, r * 0.85), 700)
  const w = tl.p.medir(fnt, '</>')
  tl.p.texto({ t }, x - w / 2, y, fnt, [['</>', '#1b1030']])
}

/** Silhueta (retrato): três falas cinza com ✗, a do `</>` no acento e o check verde; devolve o ponto de chegada. */
function conversaMini(tl: Tela, r: Quadro): Ponto {
  const ra = 4
  const passo = Math.min(13, (r.y1 - r.y0) / 5)
  const w = r.x1 - r.x0
  const linha = (i: number, cor: string, larg: number, t: number, eu = false) => {
    const y = r.y0 + passo * (i + 0.5)
    if (eu) fael(tl, r.x0 + ra, y, ra + 1, t)
    else avatar(tl.p, r.x0 + ra, y, ra, PESSOAS[i % PESSOAS.length] ?? COR.fraco, t)
    tl.p.forma({ t: t + 0.03 }, (ctx, tinta) => {
      ctx.fillStyle = tinta(cor)
      ctx.beginPath()
      ctx.roundRect(r.x0 + 2 * ra + 3, y - 2.5, larg, 5, 2.5)
      ctx.fill()
    })
  }
  TENTATIVAS.forEach((_, i) => linha(i, '#5a626c', w * ([0.55, 0.45, 0.5][i] ?? 0.5), T.conversa[0] + i * 0.1))
  linha(3, ACENTO, w * 0.6, T.conselho[0], true)
  linha(4, COR.feito, w * 0.4, T.verde)
  return [r.x1 - 2, r.y0 + passo * 2]
}

/** Conversa em `r`; devolve o ponto (px CSS) onde chega a voz que sai do microfone. `mini` (retrato): silhueta. */
export function conversa(tl: Tela, r: Quadro, mini = false): Ponto {
  if (mini) return conversaMini(tl, r)
  const k = TAM[tl.f]
  const ra = k.corpo * 0.55
  const xt = r.x0 + 2 * ra + 6
  const ft = fonte(k.corpo)
  const fm = fonteMono(k.meta)
  const conselho = quebrar(tl.p, fonte(k.corpo, 600), CONSELHO, r.x1 - xt - k.meta * 4.6)
  // Altura pedida e o aperto, se a zona for menor (nunca abaixo de 0,8).
  const L0 = k.corpo * 1.4
  const M0 = k.meta * 1.4
  const pede = M0 + 3 * L0 + 2 * M0 + 6 + conselho.length * L0 + 2 * M0 + 6 + L0
  const s = Math.max(0.8, Math.min(1, (r.y1 - r.y0) / pede))
  const L = L0 * s
  const M = M0 * s
  let y = r.y0 + M / 2
  tl.p.texto({ t: T.conversa[0] - 0.05 }, r.x0, y, fonteMono(k.meta, 700), [['# checkout', COR.fraco]], 0.006)
  y += M / 2 + L / 2
  const [c0, c1] = T.conversa
  TENTATIVAS.forEach((txt, i) => {
    const t = c0 + ((c1 - c0) * i) / TENTATIVAS.length
    avatar(tl.p, r.x0 + ra, y, ra, PESSOAS[i % PESSOAS.length] ?? COR.fraco, t)
    const w = tl.p.texto({ t: t + 0.02 }, xt, y, ft, [[txt, COR.texto]], 0.004)
    tl.p.texto({ t: t + 0.12 }, xt + w + 5, y, fonte(k.corpo, 700), [['✗', COR.bloqueio]])
    y += L
  })
  // Log: o checkout estourando o tempo com a mesma query repetida.
  const yl = y - L / 2 + 3
  tl.p.forma({ t: T.log[0] }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(248, 113, 104, 0.08)')
    ctx.fillRect(xt - 4, yl, r.x1 - xt + 4, 2 * M)
    ctx.fillStyle = tinta(COR.bloqueio)
    ctx.fillRect(xt - 4, yl, 2, 2 * M)
  })
  LOG.forEach((trechos, i) => {
    tl.p.texto({ t: T.log[0] + i * 0.1 }, xt + 2, yl + M * (i + 0.5), fm, trechos, 0.005)
  })
  y = yl + 2 * M + 3 + L / 2
  // O conselho do `</>`, com a marca de 2 minutos.
  fael(tl, r.x0 + ra, y, ra + 1, T.conselho[0] - 0.03)
  const [k0, k1] = T.conselho
  conselho.forEach((l, i) => {
    const t = k0 + ((k1 - k0) * i) / conselho.length
    tl.p.texto({ t }, xt, y + i * L, fonte(k.corpo, 600), [[l, ACENTO]], (k1 - k0) / CONSELHO.length)
  })
  const fc = fonte(k.rotulo, 700)
  const wc = tl.p.medir(fc, '2 min') + k.rotulo
  tl.p.forma({ t: T.doisMin }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(ACENTO)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(r.x1 - wc - 1, y - k.rotulo * 0.75, wc, k.rotulo * 1.5, k.rotulo * 0.75)
    ctx.stroke()
  })
  tl.p.texto({ t: T.doisMin }, r.x1 - wc - 1 + k.rotulo * 0.5, y, fc, [['2 min', ACENTO]])
  y += (conselho.length - 0.5) * L + 3
  // O diff de uma linha.
  DIFF.forEach(([txt, cor], i) => {
    const t = T.diff + i * 0.04
    const yy = y + M * i
    tl.p.forma({ t }, (ctx, tinta) => {
      ctx.fillStyle = tinta(i === 0 ? 'rgba(248, 113, 104, 0.14)' : 'rgba(75, 206, 151, 0.14)')
      ctx.fillRect(xt - 4, yy, r.x1 - xt + 4, M)
    })
    tl.p.texto({ t }, xt, yy + M / 2, fm, [[txt, cor]], 0.004)
  })
  y += 2 * M + 3 + L / 2
  tl.p.texto({ t: T.verde }, xt, y, fonte(k.corpo, 600), [['✓ checkout test passing', COR.feito]], 0.004)
  return [r.x1 - 2, r.y0 + M + L]
}
