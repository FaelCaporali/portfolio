/**
 * Pincel da vida ai: o da vida techlead (../techlead/pincel.ts, que não se altera) com o FUNDO SOB O TEXTO. No
 * pincel original, o texto que aparece depois do cartão sob ele deixa um "buraco" no cartão até a hora dele (o pixel
 * guarda um instante só). Aqui o que é fundo (cartão, terminal, faixa do diff, balão, nó) também vai para um canvas
 * próprio de cor e o instante dele vai para o canal B dos dados (`fechar`, no fim da pintura); o material (revela.ts)
 * mostra esse fundo enquanto o que está por cima ainda não apareceu. Primitivas: ver ../techlead/pincel.ts.
 * Chamado só no resize (nunca por quadro).
 */
import { PASSO_T } from '../devops/revela'
import type { Marca, Pinta, Quadro } from '../techlead/pincel'

export type { Marca, Ponto, Quadro } from '../techlead/pincel'

type Ctx = CanvasRenderingContext2D
const cod = (t: number) => Math.max(0, Math.min(255, Math.round(t / PASSO_T)))

export class Pincel {
  readonly cor: HTMLCanvasElement
  readonly dados: HTMLCanvasElement
  /** Cor só do fundo (estado A); o instante dele fica no canal R do contexto `ft`. */
  readonly fundoCor: HTMLCanvasElement
  private readonly c: Ctx
  private readonly d: Ctx
  private readonly fc: Ctx
  private readonly ft: Ctx
  private readonly h: number
  readonly q: Quadro
  readonly escala: number

  /** `escala`: px do canvas por unidade do desenho (dpr no fundo). */
  constructor(q: Quadro, escala: number) {
    this.q = q
    this.escala = escala
    const w = Math.max(1, Math.ceil((q.x1 - q.x0) * escala))
    this.h = Math.max(1, Math.ceil((q.y1 - q.y0) * escala))
    const novo = (a: number) => {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = a
      const ctx = cv.getContext('2d')
      if (!ctx) throw new Error('pincel: canvas 2D indisponível')
      return [cv, ctx] as const
    }
    ;[this.cor, this.c] = novo(2 * this.h)
    ;[this.dados, this.d] = novo(this.h)
    ;[this.fundoCor, this.fc] = novo(this.h)
    this.ft = novo(this.h)[1]
  }

  private transformar(ctx: Ctx, k = 0) {
    const s = this.escala
    ctx.setTransform(s, 0, 0, s, -this.q.x0 * s, -this.q.y0 * s + k * this.h)
  }

  /** Roda `fn` na cor (em cada metade pedida) e nos dados com a tinta da marca (instante, grupo, posição `b`). */
  private cada(m: Marca, fn: Pinta, b = 0) {
    for (const [k, lado] of [
      [0, 'a'],
      [1, 'b'],
    ] as const) {
      if (m.so && m.so !== lado) continue
      this.c.save()
      this.c.setTransform(1, 0, 0, 1, 0, 0)
      this.c.beginPath()
      this.c.rect(0, k * this.h, this.cor.width, this.h)
      this.c.clip()
      this.transformar(this.c, k)
      fn(this.c, (css) => css, false)
      this.c.restore()
    }
    const dado = `rgb(${cod(m.t)},${(m.g ?? 0) * 16},${b})`
    this.transformar(this.d)
    fn(this.d, () => dado, true)
  }

  /** Fundo (cartão, faixa, balão): como `forma`, e também guardado como o fundo que fica sob o que vem depois. */
  fundo(m: Marca, fn: Pinta) {
    this.cada(m, fn)
    if (m.so === 'b') return
    this.transformar(this.fc)
    fn(this.fc, (css) => css, false)
    const t = `rgb(${cod(m.t)},0,0)`
    this.transformar(this.ft)
    fn(this.ft, () => t, true)
  }

  /** Fim da pintura: o instante do fundo vai para o canal B dos dados (o material usa quando o de cima não surgiu). */
  fechar() {
    const w = this.dados.width
    const h = this.dados.height
    const dd = this.d.getImageData(0, 0, w, h)
    const tt = this.ft.getImageData(0, 0, w, h).data
    for (let i = 0; i < dd.data.length; i += 4) {
      const a = tt[i + 3] ?? 0
      dd.data[i + 2] = a > 127 ? (tt[i] ?? 0) : 0
    }
    this.d.putImageData(dd, 0, 0)
  }

  /** Imagem (logo do atlas), surgindo inteira em m.t. */
  imagem(m: Marca, x: number, y: number, lado: number, pinta: (ctx: Ctx) => void, alfa = 1) {
    this.cada(m, (ctx, tinta, dados) => {
      if (!dados) {
        ctx.globalAlpha = alfa
        pinta(ctx)
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = tinta('')
        ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado)
      }
    })
  }

  /** Forma livre: surge inteira em m.t. */
  forma(m: Marca, desenha: Pinta) {
    this.cada(m, desenha)
  }

  /** Texto em trechos coloridos, digitado de m.t a um caractere a cada `dt` s; devolve a largura. */
  texto(m: Marca, x: number, y: number, fonte: string, trechos: readonly (readonly [string, string])[], dt = 0) {
    this.c.font = fonte
    let largura = 0
    let i = 0
    const alto = parseFloat(fonte.split('px')[0]?.split(' ').pop() ?? '12') || 12
    for (const [txt, css] of trechos) {
      for (const ch of txt) {
        const w = this.c.measureText(ch).width
        const xi = x + largura
        this.cada({ ...m, t: m.t + i * dt }, (ctx, tinta, dados) => {
          if (!dados) {
            ctx.font = fonte
            ctx.textBaseline = 'middle'
            ctx.fillStyle = css
            ctx.fillText(ch, xi, y)
          } else if (ch !== ' ') {
            ctx.fillStyle = tinta('')
            ctx.fillRect(xi - 0.5, y - alto * 0.75, w + 1, alto * 1.5)
          }
        })
        largura += w
        i++
      }
    }
    return largura
  }

  /** Largura de um texto na fonte. */
  medir(fonte: string, txt: string) {
    this.c.font = fonte
    return this.c.measureText(txt).width
  }

  /** Polilinha que se desenha de m.t a m.t + dur, com ponta de seta opcional. */
  linha(
    m: Marca,
    pts: readonly (readonly [number, number])[],
    estilo: { cor: string; largura: number; dur?: number; seta?: boolean },
  ) {
    let total = 0
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]
      const b = pts[k]
      if (a && b) total += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    const dur = estilo.dur ?? 0
    let l0 = 0
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]
      const b = pts[k]
      if (!a || !b) continue
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.ceil(l / 3))
      for (let j = 0; j < n; j++) {
        const f0 = j / n
        const f1 = (j + 1) / n
        const t = m.t + (total > 0 ? ((l0 + ((f0 + f1) / 2) * l) / total) * dur : 0)
        this.cada({ ...m, t }, (ctx, tinta, dados) => {
          ctx.strokeStyle = tinta(estilo.cor)
          ctx.lineWidth = dados ? estilo.largura + 2 : estilo.largura
          ctx.beginPath()
          ctx.moveTo(a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0)
          ctx.lineTo(a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1)
          ctx.stroke()
        })
      }
      l0 += l
    }
    const fim = pts[pts.length - 1]
    const pen = pts[pts.length - 2]
    if (estilo.seta && fim && pen) {
      const ang = Math.atan2(fim[1] - pen[1], fim[0] - pen[0])
      const k = 3 + estilo.largura * 2
      this.cada({ ...m, t: m.t + dur }, (ctx, tinta) => {
        ctx.fillStyle = tinta(estilo.cor)
        ctx.beginPath()
        ctx.moveTo(fim[0], fim[1])
        ctx.lineTo(fim[0] - k * Math.cos(ang - 0.45), fim[1] - k * Math.sin(ang - 0.45))
        ctx.lineTo(fim[0] - k * Math.cos(ang + 0.45), fim[1] - k * Math.sin(ang + 0.45))
        ctx.closePath()
        ctx.fill()
      })
    }
  }
}
