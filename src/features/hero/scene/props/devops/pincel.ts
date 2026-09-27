/**
 * Pincel da vida devops: pinta um desenho nas duas texturas de revela.ts (cor com os estados A/B e dados com instante,
 * grupo e posição ao longo da seta), em coordenadas próprias (px CSS da tela no fundo, px da folha na planta). Cada
 * primitiva recebe a MARCA: quando aparece (t, s), em que grupo de estado e se existe só no estado A ou só no B.
 * Texto se DIGITA (um instante por caractere); linha e caixa se DESENHAM (instante ao longo do comprimento); ícone
 * surge inteiro. Chamado só no resize (nunca por quadro).
 */
import { PASSO_T } from './revela'

export interface Marca {
  t: number
  g?: number
  /** Só no estado A ou só no B (padrão: nos dois). */
  so?: 'a' | 'b'
}

/** Retângulo do canvas em coordenadas do desenho. */
export interface Quadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Ponto = readonly [number, number]
type Ctx = CanvasRenderingContext2D
/** Desenha no contexto com a tinta (a cor pedida na textura de cor; a marca nos dados). */
export type Pinta = (ctx: Ctx, tinta: (css: string) => string, dados: boolean) => void

const cod = (t: number) => Math.max(0, Math.min(255, Math.round(t / PASSO_T)))

export class Pincel {
  readonly cor: HTMLCanvasElement
  readonly dados: HTMLCanvasElement
  private readonly c: Ctx
  private readonly d: Ctx
  private readonly h: number
  readonly q: Quadro
  readonly escala: number
  /** Centro e instante de cada ícone pintado (os traços que sobem da folha chegam neles: tracos.ts). */
  readonly marcos: { x: number; y: number; t: number }[] = []
  /** Pontos com nome para o olhar (o CloudWatch do alarme). */
  readonly alvos: Partial<Record<'alarme', { x: number; y: number; t: number }>> = {}

  /** `escala`: px do canvas por unidade do desenho (dpr no fundo). */
  constructor(q: Quadro, escala: number) {
    this.q = q
    this.escala = escala
    const w = Math.max(1, Math.ceil((q.x1 - q.x0) * escala))
    this.h = Math.max(1, Math.ceil((q.y1 - q.y0) * escala))
    this.cor = document.createElement('canvas')
    this.cor.width = w
    this.cor.height = 2 * this.h
    this.dados = document.createElement('canvas')
    this.dados.width = w
    this.dados.height = this.h
    const c = this.cor.getContext('2d')
    const d = this.dados.getContext('2d')
    if (!c || !d) throw new Error('pincel: canvas 2D indisponível')
    this.c = c
    this.d = d
  }

  /** Roda `fn` na cor (em cada metade pedida) e nos dados com a tinta da marca (instante `t`, grupo, posição `b`). */
  private cada(m: Marca, fn: Pinta, b = 0) {
    const s = this.escala
    for (const [k, lado] of [
      [0, 'a'],
      [1, 'b'],
    ] as const) {
      if (m.so && m.so !== lado) continue
      this.c.setTransform(s, 0, 0, s, -this.q.x0 * s, -this.q.y0 * s + k * this.h)
      fn(this.c, (css) => css, false)
    }
    const dado = `rgb(${cod(m.t)},${(m.g ?? 0) * 16},${b})`
    this.d.setTransform(s, 0, 0, s, -this.q.x0 * s, -this.q.y0 * s)
    fn(this.d, () => dado, true)
  }

  /** Ícone do atlas (ou qualquer imagem já desenhada por `pinta`), surgindo inteiro em m.t. */
  imagem(m: Marca, x: number, y: number, lado: number, pinta: (ctx: Ctx) => void, alfa = 1) {
    if (m.so !== 'b') this.marcos.push({ x, y, t: m.t })
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

  /** Forma livre (retângulo cheio, selo, marca de check): surge inteira em m.t. */
  forma(m: Marca, desenha: Pinta) {
    this.cada(m, desenha)
  }

  /**
   * Texto em trechos coloridos, digitado de m.t a um caractere a cada `dt` s; devolve a largura. Fonte CSS completa.
   * Nos dados, cada caractere é o retângulo da célula dele (a forma vem do alfa da cor).
   */
  texto(m: Marca, x: number, y: number, fonte: string, trechos: readonly (readonly [string, string])[], dt = 0) {
    this.c.font = fonte
    let largura = 0
    let i = 0
    // Corpo da fonte: o número antes de "px" ("600 11.5px ...").
    const alto = parseFloat(fonte.split('px')[0]?.split(' ').pop() ?? '12') || 12
    for (const [txt, css] of trechos) {
      for (const ch of txt) {
        const w = this.c.measureText(ch).width
        const xi = x + largura
        const mi = { ...m, t: m.t + i * dt }
        this.cada(mi, (ctx, tinta, dados) => {
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

  /** Largura de um texto na fonte (para centralizar). */
  medir(fonte: string, txt: string) {
    this.c.font = fonte
    return this.c.measureText(txt).width
  }

  /**
   * Polilinha que se DESENHA de m.t a m.t + dur (instante ao longo do comprimento), com ponta de seta opcional e o
   * tráfego (canal B) se `fluxo`. `tracejado`: [traço, vão] em unidades do desenho.
   */
  linha(
    m: Marca,
    pts: readonly Ponto[],
    estilo: { cor: string; largura: number; dur?: number; seta?: boolean; fluxo?: boolean; tracejado?: number[] },
  ) {
    const segs: [Ponto, Ponto, number][] = []
    let total = 0
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]
      const b = pts[k]
      if (!a || !b) continue
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      segs.push([a, b, total])
      total += l
    }
    const dur = estilo.dur ?? 0
    // Pedaços de 3 unidades: cada um com o seu instante (desenho) e a sua posição (tráfego).
    for (const [a, b, l0] of segs) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.ceil(l / 3))
      for (let j = 0; j < n; j++) {
        const f0 = j / n
        const f1 = (j + 1) / n
        const s = l0 + ((f0 + f1) / 2) * l
        const t = m.t + (total > 0 ? (s / total) * dur : 0)
        const pos = estilo.fluxo ? 1 + (Math.floor(s / 2) % 252) : 0
        this.cada(
          { ...m, t },
          (ctx, tinta, dados) => {
            ctx.strokeStyle = tinta(estilo.cor)
            ctx.lineWidth = dados ? estilo.largura + 2 : estilo.largura
            ctx.lineCap = 'butt'
            ctx.setLineDash(estilo.tracejado ?? [])
            ctx.lineDashOffset = -(l0 + f0 * l)
            ctx.beginPath()
            ctx.moveTo(a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0)
            ctx.lineTo(a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1)
            ctx.stroke()
            ctx.setLineDash([])
          },
          pos,
        )
      }
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

  /** Contorno de retângulo que se desenha a partir do canto de cima à esquerda, no sentido horário. */
  caixa(
    m: Marca,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    estilo: { cor: string; largura: number; dur: number; tracejado?: number[] },
  ) {
    this.linha(
      m,
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ],
      estilo,
    )
  }
}
