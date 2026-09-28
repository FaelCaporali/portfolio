/**
 * Estilo do fundo da vida ai (FICHA §4): cores, fontes e tamanhos por tela, o contexto de desenho e as peças comuns — o
 * ROSTINHO dos agentes (a mesma linguagem da tela do robô: olhos em pílula na tela escura), o avatar genérico do humano
 * (sem nome nem cargo), logo, botão, janela e o cursor. Pintado pelo Pincel (pincel.ts) uma vez no resize. Brilho
 * contido: o rosto do Fael domina. Textos em inglês.
 */
import type { Formato } from '../devops/composicao'
import type { Marca, Pincel, Quadro } from './pincel'
import { desenharLogo, type Logo } from './logos'
import type { Alvo } from './roteiro'

/** Acento da vida (journey.ts). */
export const ACENTO = '#00e5ff'

export const COR = {
  texto: '#e6edf3',
  fraco: '#9aa4b0',
  linha: '#4b5563',
  cartao: 'rgba(255, 255, 255, 0.05)',
  borda: '#3a424d',
  /** Terminal (tema escuro do GitHub) e o realce de sintaxe dele. */
  term: 'rgba(13, 17, 23, 0.92)',
  termBarra: '#161b22',
  kw: '#ff7b72',
  fn: '#d2a8ff',
  str: '#a5d6ff',
  num: '#79c0ff',
  com: '#8b949e',
  /** Diff: adição e remoção. */
  mais: '#3fb950',
  maisFundo: 'rgba(46, 160, 67, 0.2)',
  menos: '#f85149',
  menosFundo: 'rgba(248, 81, 73, 0.16)',
  ok: '#3fb950',
  alerta: '#e3b341',
  /** Canvas do n8n (tema escuro): nós e conexões. */
  n8nNo: '#2a2b30',
  n8nBorda: '#6b6f7a',
  n8nLinha: '#8e929c',
} as const

/** Humanos genéricos (operador, cliente, usuário): cores neutras, nenhuma igual ao acento. */
export const PESSOAS = { operador: '#d9a441', cliente: '#8b95a5', usuario: '#7a8ca3' } as const

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace"

/** Tamanhos por formato (px CSS): corpo (14 / 11,5), meta, rótulo, código e logo. */
export const TAM: Record<Formato, { corpo: number; meta: number; rotulo: number; mono: number; logo: number }> = {
  largo: { corpo: 14, meta: 12, rotulo: 11, mono: 13, logo: 18 },
  medio: { corpo: 11.5, meta: 10, rotulo: 9.5, mono: 11, logo: 15 },
  estreito: { corpo: 9, meta: 8, rotulo: 8, mono: 8, logo: 14 },
}

export const fonte = (px: number, peso = 400) => `${peso} ${px}px ${SANS}`
export const fonteMono = (px: number, peso = 400) => `${peso} ${px}px ${MONO}`

/** Contexto de desenho: pincel do painel, atlas de logos, formato, pontos do olhar e âncoras do pulso (px CSS). */
export interface Tela {
  p: Pincel
  img: HTMLImageElement
  f: Formato
  alvos: Partial<Record<Alvo, { x: number; y: number }>>
}

/** Janela com barra de título (os três pontos à esquerda); o fundo fica sob o texto. Devolve o y do corpo. */
export function janela(tl: Tela, q: Quadro, t: number, barra: number, g = 0) {
  cartao(tl.p, { t, g }, q, COR.term, COR.borda, 7)
  tl.p.fundo({ t, g }, (ctx, tinta) => {
    ctx.fillStyle = tinta(COR.termBarra)
    ctx.beginPath()
    ctx.roundRect(q.x0 + 1, q.y0 + 1, q.x1 - q.x0 - 2, barra, [6, 6, 0, 0])
    ctx.fill()
  })
  tl.p.forma({ t, g }, (ctx, tinta) => {
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = tinta(c)
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.arc(q.x0 + 11 + i * 10, q.y0 + barra / 2, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })
  })
  return q.y0 + barra
}

/** Ponteiro do mouse (seta branca com contorno escuro) com a ponta em (x, y). */
export function ponteiro(p: Pincel, m: Marca, x: number, y: number, a: number) {
  p.forma(m, (ctx, tinta) => {
    ctx.fillStyle = tinta('#ffffff')
    ctx.strokeStyle = tinta('#0b0f12')
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + a)
    ctx.lineTo(x + a * 0.28, y + a * 0.74)
    ctx.lineTo(x + a * 0.46, y + a * 1.08)
    ctx.lineTo(x + a * 0.6, y + a)
    ctx.lineTo(x + a * 0.43, y + a * 0.68)
    ctx.lineTo(x + a * 0.74, y + a * 0.68)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
  })
}

/** Logo do atlas, surgindo inteiro em t (sem alteração: nunca ganha rosto). */
export function logo(tl: Tela, id: Logo, x: number, y: number, lado: number, t: number, g = 0) {
  tl.p.imagem({ t, g }, x, y, lado, (ctx) => desenharLogo(ctx, tl.img, id, x, y, lado))
}

export type Expressao = 'olhos' | 'pensa' | 'fala' | 'feliz'

/**
 * Rostinho de agente (a linguagem da tela do robô): tela escura de cantos arredondados, olhos em pílula no acento.
 * `pensa`: reticências no lugar dos olhos; `fala`: boca aberta; `feliz`: olhos em arco.
 */
export function rostinho(p: Pincel, m: Marca, x: number, y: number, lado: number, e: Expressao = 'olhos') {
  p.forma(m, (ctx, tinta) => {
    const r = lado * 0.26
    ctx.fillStyle = tinta('#0b1418')
    ctx.strokeStyle = tinta('#5d6b73')
    ctx.lineWidth = Math.max(1, lado * 0.06)
    ctx.beginPath()
    ctx.roundRect(x - lado / 2, y - lado / 2, lado, lado, r)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = tinta(ACENTO)
    ctx.strokeStyle = tinta(ACENTO)
    const ox = lado * 0.2
    const oy = y - lado * 0.08
    const ow = lado * 0.13
    const oh = lado * 0.26
    if (e === 'pensa') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.arc(x + i * lado * 0.2, oy + oh * 0.2, lado * 0.065, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }
    if (e === 'feliz') {
      ctx.lineWidth = Math.max(1, lado * 0.08)
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(x + s * ox, oy + oh * 0.25, ow * 0.9, Math.PI * 1.1, Math.PI * 1.9)
        ctx.stroke()
      }
    } else {
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.roundRect(x + s * ox - ow / 2, oy - oh / 2, ow, oh, ow / 2)
        ctx.fill()
      }
    }
    if (e === 'fala' || e === 'feliz') {
      ctx.beginPath()
      ctx.ellipse(x, y + lado * 0.25, lado * 0.12, lado * (e === 'fala' ? 0.07 : 0.05), 0, 0, Math.PI)
      ctx.fill()
    }
  })
}

/** Avatar genérico de humano: círculo com cabeça e ombros (sem nome, sem cargo). */
export function humano(p: Pincel, m: Marca, x: number, y: number, raio: number, cor: string) {
  p.forma(m, (ctx, tinta) => {
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

/** Cartão de fundo (produto, estação, terminal): retângulo arredondado com borda (fica sob o texto de cima). */
export function cartao(p: Pincel, m: Marca, q: Quadro, fundo: string = COR.cartao, borda: string = COR.borda, r = 6) {
  p.fundo(m, (ctx, tinta) => {
    ctx.fillStyle = tinta(fundo)
    ctx.strokeStyle = tinta(borda)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(q.x0 + 0.5, q.y0 + 0.5, q.x1 - q.x0 - 1, q.y1 - q.y0 - 1, r)
    ctx.fill()
    ctx.stroke()
  })
}

/** Botão (pílula) com texto centrado; `cheio`: fundo na cor (acionado). Devolve a largura. */
export function botao(tl: Tela, m: Marca, x: number, y: number, txt: string, px: number, cor: string, cheio: boolean) {
  const fnt = fonte(px, 600)
  const w = tl.p.medir(fnt, txt) + px * 1.3
  const h = px * 1.7
  tl.p.forma(m, (ctx, tinta) => {
    ctx.fillStyle = tinta(cheio ? cor : 'rgba(255, 255, 255, 0.04)')
    ctx.strokeStyle = tinta(cor)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1, h / 2)
    ctx.fill()
    ctx.stroke()
  })
  tl.p.texto(m, x + px * 0.65, y, fnt, [[txt, cheio ? '#0b0f12' : cor]])
  return w
}
