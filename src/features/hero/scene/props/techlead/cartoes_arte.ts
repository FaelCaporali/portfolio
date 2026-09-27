/**
 * Arte dos cartões do Jira da vida techlead (cartoes.ts): o cartão no tema escuro do Jira (resumo; ícone do tipo,
 * chave, story points e o avatar genérico de quem puxou) e a marca Blocked do cartão que trava na destrava (contorno
 * vermelho e o selo `blocked · 5h` na linha de baixo). No retrato, só a silhueta. Pintado no resize, num canvas.
 */
import type { Formato } from '../devops/composicao'
import { COR, PESSOAS, TAM, fonte } from './estilo'

type Slot = readonly [coluna: number, linha: number]
/** Movimento: de t0 a t1 para o slot. */
type Passo = readonly [t0: number, t1: number, coluna: number, linha: number]

export interface Cartao {
  chave: string
  resumo: string
  tipo: 'story' | 'task'
  pontos: number
  inicio: Slot
  passos: readonly Passo[]
}

const raio = (h: number) => Math.min(4, h * 0.15)

/** Ícone do tipo (história: marcador; tarefa: check) em (x, y) com lado `ic`. */
function tipo(ctx: CanvasRenderingContext2D, c: Cartao, x: number, y: number, ic: number) {
  ctx.fillStyle = c.tipo === 'story' ? COR.jHistoria : COR.jTarefa
  ctx.beginPath()
  ctx.roundRect(x, y - ic / 2, ic, ic, 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  if (c.tipo === 'story') {
    ctx.moveTo(x + ic * 0.3, y - ic * 0.3)
    ctx.lineTo(x + ic * 0.3, y + ic * 0.3)
    ctx.lineTo(x + ic * 0.5, y + ic * 0.12)
    ctx.lineTo(x + ic * 0.7, y + ic * 0.3)
    ctx.lineTo(x + ic * 0.7, y - ic * 0.3)
    ctx.closePath()
  } else {
    ctx.moveTo(x + ic * 0.25, y)
    ctx.lineTo(x + ic * 0.45, y + ic * 0.2)
    ctx.lineTo(x + ic * 0.78, y - ic * 0.22)
  }
  ctx.stroke()
}

/** Avatar de quem puxou, à direita da linha de baixo. */
function dono(ctx: CanvasRenderingContext2D, f: Formato, i: number, w: number, h: number) {
  const k = TAM[f]
  const pad = k.corpo * 0.5
  const ra = k.meta * 0.62
  ctx.fillStyle = PESSOAS[i % PESSOAS.length] ?? COR.fraco
  ctx.beginPath()
  ctx.arc(w - pad - ra, h - pad - k.meta * 0.6, ra, 0, Math.PI * 2)
  ctx.fill()
}

/** Pinta um cartão no retângulo (0, 0, w, h) do contexto. No retrato, só a silhueta (faixa do tipo e o avatar). */
export function pintarCartao(ctx: CanvasRenderingContext2D, f: Formato, c: Cartao, i: number, w: number, h: number) {
  const k = TAM[f]
  ctx.fillStyle = COR.jCartao
  ctx.strokeStyle = COR.jBorda
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, raio(h))
  ctx.fill()
  ctx.stroke()
  if (f === 'estreito') {
    ctx.fillStyle = c.tipo === 'story' ? COR.jHistoria : COR.jTarefa
    ctx.fillRect(2, 2, 2.5, h - 4)
    ctx.fillStyle = PESSOAS[i % PESSOAS.length] ?? COR.fraco
    ctx.beginPath()
    ctx.arc(w - h * 0.35, h / 2, h * 0.22, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const pad = k.corpo * 0.5
  ctx.textBaseline = 'middle'
  ctx.font = fonte(k.corpo)
  // Resumo mais largo que o cartão (colunas estreitas no 1024): o corpo encolhe até caber.
  const larg = ctx.measureText(c.resumo).width
  if (larg > w - 2 * pad) ctx.font = fonte((k.corpo * (w - 2 * pad)) / larg)
  ctx.fillStyle = COR.jTexto
  ctx.fillText(c.resumo, pad, pad + k.corpo * 0.6)
  // Linha de baixo: ícone do tipo, chave, pontos e o avatar de quem puxou.
  const yb = h - pad - k.meta * 0.6
  const ic = k.meta * 1.05
  tipo(ctx, c, pad, yb, ic)
  ctx.font = fonte(k.meta, 500)
  ctx.fillStyle = COR.jChave
  ctx.fillText(c.chave, pad + ic + 4, yb)
  const xp = pad + ic + 8 + ctx.measureText(c.chave).width
  const txt = String(c.pontos)
  const wp = ctx.measureText(txt).width + k.meta * 0.8
  ctx.fillStyle = COR.pontos
  ctx.beginPath()
  ctx.roundRect(xp, yb - k.meta * 0.6, wp, k.meta * 1.2, k.meta * 0.6)
  ctx.fill()
  ctx.fillStyle = COR.jTexto
  ctx.fillText(txt, xp + k.meta * 0.4, yb)
  dono(ctx, f, i, w, h)
}

/** Marca Blocked sobre o cartão `i` (0, 0, w, h): contorno vermelho e, na linha de baixo, o selo com as horas. */
export function pintarBloqueio(ctx: CanvasRenderingContext2D, f: Formato, i: number, w: number, h: number) {
  const k = TAM[f]
  ctx.strokeStyle = COR.bloqueio
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.roundRect(1, 1, w - 2, h - 2, raio(h))
  ctx.stroke()
  if (f === 'estreito') return
  const pad = k.corpo * 0.5
  const yb = h - pad - k.meta * 0.6
  // A linha de baixo (chave e pontos) dá lugar ao selo; o resumo e o dono continuam à vista.
  ctx.fillStyle = COR.jCartao
  ctx.fillRect(2, yb - k.meta * 0.8, w - 4, k.meta * 1.6)
  const txt = 'blocked · 5h'
  ctx.font = fonte(k.rotulo, 700)
  const tw = ctx.measureText(txt).width + k.rotulo
  ctx.fillStyle = COR.bloqueio
  ctx.beginPath()
  ctx.roundRect(pad, yb - k.rotulo * 0.72, tw, k.rotulo * 1.45, 3)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1d0b0e'
  ctx.fillText(txt, pad + k.rotulo * 0.5, yb)
  dono(ctx, f, i, w, h)
}
