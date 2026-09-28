/**
 * ESCUTA e ENTENDIMENTO da vida techlead (REQUISITOS T1, T2, T5; FICHA-PRODUCAO, FECHAMENTO): o balão do cliente
 * (avatar genérico), a onda de áudio no acento da vida que corre até o headset, a fala transcrita como legenda
 * (dor genérica, nenhum projeto nem cliente: T6), os trechos que se destacam (estado B do grupo `destaque`) e os
 * post-its de traço Excalidraw (Problem / Need / Requirement). No fim do ciclo, um novo balão recomeça.
 */
import type { Ponto, Quadro } from './pincel'
import { T } from './roteiro'
import { ACENTO, COR, GRUPO, TAM, avatar, caixaMao, fonte, preencher, quebrar, type Tela } from './estilo'

type Tipo = 'problema' | 'necessidade' | 'requisito'
/** Trecho da fala: texto e, se destacado, o post-it que ele vira. */
type Trecho = readonly [string, Tipo?]

const BALAO = 'Can we talk about sign-up?'
const NOVO = 'One more thing…'
const FALA: readonly (readonly Trecho[])[] = [
  [['Half our users '], ['give up during sign-up', 'problema'], ['.']],
  [['They never know '], ['which documents to send', 'necessidade'], [',']],
  [['so we need '], ['a simple guided flow', 'requisito'], [' this quarter.']],
]
const POSTITS: readonly { tipo: Tipo; rotulo: string; texto: string }[] = [
  { tipo: 'problema', rotulo: 'PROBLEM', texto: 'Users give up at sign-up' },
  { tipo: 'necessidade', rotulo: 'NEED', texto: 'Know which docs to send' },
  { tipo: 'requisito', rotulo: 'REQUIREMENT', texto: 'Guided 3-step upload' },
]
const CLIENTE = '#8b95a5'

/** Balão com avatar genérico; devolve a caixa do balão. */
function balao(tl: Tela, x: number, y: number, larguraMax: number, txt: string, t: number) {
  const k = TAM[tl.f]
  const r = k.corpo * 1.05
  avatar(tl.p, x + r, y + r, r, CLIENTE, t)
  const fnt = fonte(k.corpo, 500)
  const w = Math.min(larguraMax - 2 * r - 10, tl.p.medir(fnt, txt) + k.corpo * 1.4)
  const q: Quadro = { x0: x + 2 * r + 10, y0: y, x1: x + 2 * r + 10 + w, y1: y + 2 * r }
  tl.p.forma({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(255, 255, 255, 0.07)')
    ctx.strokeStyle = tinta(COR.linha)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0, r)
    ctx.moveTo(q.x0 + 2, q.y0 + r * 0.7)
    ctx.lineTo(q.x0 - 7, q.y0 + r * 1.1)
    ctx.lineTo(q.x0 + 3, q.y0 + r * 1.25)
    ctx.fill()
    ctx.stroke()
  })
  tl.p.texto({ t: t + 0.05 }, q.x0 + k.corpo * 0.7, q.y0 + r, fnt, [[txt, COR.texto]], 0.009)
  return q
}

/** Onda de áudio pelo caminho `via` (a voz corre por ela até o fim: canal de fluxo), desenhando-se em `dur` s. */
function onda(tl: Tela, via: readonly Ponto[], amp: number, t: number, dur: number) {
  const segs: [Ponto, Ponto, number, number][] = []
  let total = 0
  for (let i = 1; i < via.length; i++) {
    const a = via[i - 1]
    const b = via[i]
    if (!a || !b) continue
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l < 1) continue
    segs.push([a, b, total, l])
    total += l
  }
  if (total < 8) return
  const pts: Ponto[] = []
  for (const [a, b, s0, l] of segs) {
    const nx = -(b[1] - a[1]) / l
    const ny = (b[0] - a[0]) / l
    const n = Math.ceil(l / 2)
    for (let i = pts.length ? 1 : 0; i <= n; i++) {
      const s = s0 + (i / n) * l
      const u = s / total
      const env = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(u * 9.3 + 0.6))
      const d = amp * env * Math.sin((s / 11) * Math.PI * 2)
      pts.push([a[0] + ((b[0] - a[0]) * i) / n + nx * d, a[1] + ((b[1] - a[1]) * i) / n + ny * d])
    }
  }
  tl.p.linha({ t }, pts, { cor: ACENTO, largura: 1.3, dur, fluxo: true })
}

/** Legenda: a fala quebrada na largura, digitada linha a linha; os destaques ficam no estado B. */
function legenda(tl: Tela, x: number, y: number, largura: number, t: [number, number]) {
  const k = TAM[tl.f]
  const fnt = fonte(k.corpo)
  const passo = k.corpo * 1.45
  // Palavras com o tipo do trecho, para quebrar sem perder o destaque.
  const linhas: { txt: string; tipo?: Tipo }[][] = []
  for (const frase of FALA) {
    const texto = frase.map(([s]) => s).join('')
    let i = 0
    for (const l of quebrar(tl.p, fnt, texto, largura)) {
      const ini = texto.indexOf(l, i)
      i = ini + l.length
      const pedacos: { txt: string; tipo?: Tipo }[] = []
      let pos = 0
      for (const [s, tipo] of frase) {
        const a = Math.max(ini, pos)
        const b = Math.min(i, pos + s.length)
        if (b > a) pedacos.push({ txt: texto.slice(a, b), tipo })
        pos += s.length
      }
      linhas.push(pedacos)
    }
  }
  const total = linhas.reduce((n, l) => n + l.reduce((m, p) => m + p.txt.length, 0), 0)
  const dt = (t[1] - t[0]) / Math.max(1, total)
  let n = 0
  linhas.forEach((l, j) => {
    const yl = y + j * passo
    let xl = x
    for (const p of l) {
      const w = tl.p.medir(fnt, p.txt)
      const tp = t[0] + n * dt
      const g = p.tipo ? GRUPO.destaque : GRUPO.fixo
      if (p.tipo) {
        const cor = COR[p.tipo]
        tl.p.forma({ t: tp, g, so: 'b' }, (ctx, tinta) => {
          ctx.fillStyle = tinta(`${cor}47`)
          ctx.fillRect(xl - 2, yl - k.corpo * 0.72, w + 4, k.corpo * 1.44)
        })
      }
      tl.p.texto({ t: tp, g }, xl, yl, fnt, [[p.txt, p.tipo ? COR.texto : COR.fraco]], dt)
      xl += w
      n += p.txt.length
    }
  })
  return y + linhas.length * passo
}

/**
 * Chamada em `r`: balão, onda até `ouvido` (ponto da tela junto à concha do headset) e a legenda. `desvio`: a onda
 * segue na altura do balão até esse x e só então desce ao ouvido; a legenda para antes dele. Devolve o fim em y e
 * registra o cliente como alvo do olhar.
 */
export function chamada(tl: Tela, r: Quadro, ouvido: Ponto, desvio?: number) {
  const k = TAM[tl.f]
  const q = balao(tl, r.x0, r.y0 + 4, Math.min(r.x1 - r.x0, 26 * k.corpo), BALAO, T.balao)
  tl.alvos.cliente = { x: (r.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 }
  const yb = (q.y0 + q.y1) / 2
  const via: Ponto[] = desvio ? [[q.x1 + 6, yb], [desvio, yb], ouvido] : [[q.x1 + 6, yb], ouvido]
  onda(tl, via, k.corpo * 0.55, T.onda[0], T.onda[1] - T.onda[0])
  const cc = fonte(k.rotulo, 700)
  const y = q.y1 + k.corpo * 1.4
  tl.p.forma({ t: T.legenda[0] - 0.05 }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(COR.fraco)
    ctx.lineWidth = 1
    ctx.strokeRect(r.x0 + 0.5, y - k.rotulo * 0.7, k.rotulo * 2.2, k.rotulo * 1.4)
  })
  tl.p.texto({ t: T.legenda[0] - 0.05 }, r.x0 + k.rotulo * 0.3, y, cc, [['CC', COR.fraco]])
  const x = r.x0 + k.rotulo * 3
  const fim = desvio ? Math.min(r.x1, desvio - 12) : r.x1
  return legenda(tl, x, y, fim - x - 4, [T.legenda[0], T.legenda[1]])
}

/** Chamada em silhueta (retrato): avatar, balão com reticências e a onda até o ouvido; devolve o fim em y. */
export function chamadaMini(tl: Tela, r: Quadro, ouvido: Ponto) {
  const ra = 7
  const y = r.y0 + ra + 2
  avatar(tl.p, r.x0 + ra, y, ra, CLIENTE, T.balao)
  const q: Quadro = { x0: r.x0 + 2 * ra + 5, y0: y - ra, x1: r.x0 + 2 * ra + 31, y1: y + ra }
  tl.p.forma({ t: T.balao }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(255, 255, 255, 0.1)')
    ctx.strokeStyle = tinta(COR.linha)
    ctx.beginPath()
    ctx.roundRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0, ra)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = tinta(COR.texto)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(q.x0 + 7 + i * 6, y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  tl.alvos.cliente = { x: (q.x0 + q.x1) / 2, y }
  onda(tl, [[(q.x0 + q.x1) / 2, q.y1 + 3], ouvido], 4, T.onda[0], T.onda[1] - T.onda[0])
  return Math.max(q.y1, ouvido[1]) + 10
}

/** Novo balão do cliente (o ciclo recomeça), em (x, y). */
export function novoBalao(tl: Tela, x: number, y: number, largura: number) {
  balao(tl, x, y, largura, NOVO, T.novoBalao)
}

/**
 * Post-its em `r` (coluna ou linha, pelo formato da zona): preenchimento na cor do Excalidraw, contorno à mão, rótulo
 * e o texto. `mini` (retrato): só o rótulo (silhueta).
 */
export function postits(tl: Tela, r: Quadro, mini = false) {
  const k = TAM[tl.f]
  const emLinha = r.x1 - r.x0 > (r.y1 - r.y0) * 2.2
  const n = POSTITS.length
  const gap = mini ? 6 : 10
  const w = emLinha ? (r.x1 - r.x0 - gap * (n - 1)) / n : Math.min(r.x1 - r.x0, 15 * k.corpo)
  const pad = k.corpo * 0.55
  const fr = fonte(k.rotulo, 700)
  const ft = fonte(k.corpo, 500)
  const alto = mini ? k.rotulo * 2.4 : pad * 2 + k.rotulo * 1.3 + 2 * k.corpo * 1.3
  const h = emLinha ? r.y1 - r.y0 : Math.min(alto, (r.y1 - r.y0 - gap * (n - 1)) / n)
  POSTITS.forEach((pi, i) => {
    const x0 = emLinha ? r.x0 + i * (w + gap) : r.x0 + (i % 2) * Math.min(12, (r.x1 - r.x0 - w) * 0.5)
    const y0 = emLinha ? r.y0 : r.y0 + i * (h + gap)
    const q: Quadro = { x0, y0, x1: x0 + w, y1: y0 + h }
    const t = T.postits + i * 0.15
    const cor = COR[pi.tipo]
    preencher(tl.p, { t }, q, `${cor}2e`, 40 + i)
    caixaMao(tl.p, { t }, q, { cor, largura: 1.4, dur: 0.16, semente: 10 + i * 7 })
    tl.p.texto({ t: t + 0.03 }, q.x0 + pad, q.y0 + pad + k.rotulo * 0.6, fr, [[pi.rotulo, cor]], 0.01)
    if (mini) return
    const linhas = quebrar(tl.p, ft, pi.texto, w - 2 * pad)
    linhas.slice(0, 2).forEach((l, j) => {
      const yl = q.y0 + pad + k.rotulo * 1.3 + (j + 0.6) * k.corpo * 1.3
      tl.p.texto({ t: t + 0.08 + j * 0.06 }, q.x0 + pad, yl, ft, [[l, COR.texto]], 0.005)
    })
  })
  tl.alvos.postits = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }
}
