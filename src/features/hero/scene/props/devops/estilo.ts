/**
 * Estilo do diagrama de soluções da vida devops (FICHA-PRODUCAO, FECHAMENTO; D8, D9): arquitetura de referência da AWS
 * no fundo escuro — grupos com o ícone oficial no canto (AWS Cloud, VPC, subnets, Auto Scaling), serviços pelo ícone
 * com o nome embaixo e uma nota curta de análise, setas finas com o CONTRATO escrito nelas e as decisões por tradeoff
 * (escolhido com ✓, alternativa esmaecida e riscada no estado B do grupo `decisao`). Brilho contido: o rosto domina.
 */
import { desenharIcone, type Icone } from './icones'
import type { Formato } from './composicao'
import type { Marca, Pincel, Ponto } from './pincel'
import { GRUPO } from './revela'

export const COR = {
  nome: '#dfe4ea',
  nota: '#8f98a6',
  seta: '#9aa3b0',
  contrato: '#9CDCFE',
  nuvem: '#aeb6c2',
  vpc: '#8C4FFF',
  publica: '#7AA116',
  privada: '#00A4A6',
  asg: '#ED7100',
  check: '#3ddc84',
  risco: '#f0506a',
  blue: '#4c8dff',
  green: '#3ddc84',
  alarme: '#ff4d5e',
  ok: '#3ddc84',
  titulo: '#c8ced6',
} as const

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace"

/** Tamanhos por formato (px CSS): ícone do fluxo principal, de apoio, nome, nota, código. */
export const TAM: Record<Formato, { icone: number; apoio: number; nome: number; nota: number; mono: number }> = {
  largo: { icone: 30, apoio: 22, nome: 11.5, nota: 10, mono: 12 },
  medio: { icone: 24, apoio: 18, nome: 9.5, nota: 9, mono: 10.5 },
  estreito: { icone: 22, apoio: 16, nome: 9, nota: 8.5, mono: 10.5 },
}

export const fonteNome = (px: number) => `600 ${px}px ${SANS}`
export const fonteNota = (px: number) => `${px}px ${SANS}`
export const fonteMono = (px: number) => `${px}px ${MONO}`

/** Contexto de desenho de uma zona. */
export interface Tela {
  p: Pincel
  img: HTMLImageElement
  f: Formato
}

export interface Servico {
  id: Icone
  x: number
  y: number
  nome: string
  nota?: string
  lado?: number
  t: number
  g?: number
  so?: 'a' | 'b'
  alfa?: number
}

/** Texto centralizado em x. */
function centro(tl: Tela, m: Marca, x: number, y: number, fonte: string, txt: string, cor: string, dt = 0) {
  const w = tl.p.medir(fonte, txt)
  tl.p.texto(m, x - w / 2, y, fonte, [[txt, cor]], dt)
}

/** Serviço: ícone oficial, nome embaixo e nota de análise; devolve o y de baixo. */
export function servico(tl: Tela, s: Servico) {
  const k = TAM[tl.f]
  const lado = s.lado ?? k.icone
  const m: Marca = { t: s.t, g: s.g, so: s.so }
  tl.p.imagem(m, s.x, s.y, lado, (ctx) => desenharIcone(ctx, tl.img, s.id, s.x, s.y, lado), s.alfa ?? 1)
  let y = s.y + lado / 2 + k.nome * 0.85
  // Alternativa descartada: o texto esmaece junto com o ícone.
  const apaga = s.alfa !== undefined && s.alfa < 1
  if (s.nome) {
    const cor = apaga ? 'rgba(223, 228, 234, 0.4)' : COR.nome
    centro(tl, { ...m, t: s.t + 0.06 }, s.x, y, fonteNome(k.nome), s.nome, cor, 0.004)
    y += k.nome * 1.1
  }
  if (s.nota) {
    const cor = apaga ? 'rgba(143, 152, 166, 0.4)' : COR.nota
    centro(tl, { ...m, t: s.t + 0.12 }, s.x, y, fonteNota(k.nota), s.nota, cor, 0.004)
    y += k.nota * 1.15
  }
  return y
}

/** Grupo da arquitetura de referência: contorno que se desenha, ícone oficial no canto e título. */
export function grupo(
  tl: Tela,
  r: { x0: number; y0: number; x1: number; y1: number },
  g: { icone?: Icone; titulo: string; cor: string; t: number; tracejado?: number[] },
) {
  const k = TAM[tl.f]
  const ic = Math.round(k.nome * 1.6)
  tl.p.caixa({ t: g.t }, r.x0, r.y0, r.x1, r.y1, { cor: g.cor, largura: 1, dur: 0.35, tracejado: g.tracejado })
  const icone = g.icone
  if (icone) {
    tl.p.imagem({ t: g.t }, r.x0 + ic / 2, r.y0 + ic / 2, ic, (ctx) =>
      desenharIcone(ctx, tl.img, icone, r.x0 + ic / 2, r.y0 + ic / 2, ic),
    )
  }
  const x = icone ? r.x0 + ic + 4 : r.x0 + 6
  tl.p.texto({ t: g.t + 0.05 }, x, r.y0 + ic / 2, fonteNome(k.nota), [[g.titulo, g.cor]], 0.006)
}

/** Linha de ferramenta: ícone, nome em negrito e nota à direita (x = borda esquerda do ícone); devolve o fim em x. */
export function item(tl: Tela, x: number, y: number, id: Icone, nome: string, nota: string, t: number, lado?: number) {
  const k = TAM[tl.f]
  const l = lado ?? Math.round(k.apoio * 0.85)
  tl.p.imagem({ t }, x + l / 2, y, l, (ctx) => desenharIcone(ctx, tl.img, id, x + l / 2, y, l))
  const w = tl.p.texto({ t: t + 0.05 }, x + l + 5, y, fonteNome(k.nome), [[nome, COR.nome]], 0.004)
  if (!nota) return x + l + 5 + w
  const w2 = tl.p.texto({ t: t + 0.1 }, x + l + 10 + w, y, fonteNota(k.nota), [[nota, COR.nota]], 0.004)
  return x + l + 10 + w + w2
}

/** Seta com o contrato escrito no meio do trecho `rotuloEm` (índice do segmento), acima da linha. */
export function seta(
  tl: Tela,
  pts: readonly Ponto[],
  o: {
    t: number
    dur?: number
    fluxo?: boolean
    contrato?: string
    tContrato?: number
    rotuloEm?: number
    cor?: string
  },
) {
  tl.p.linha({ t: o.t }, pts, { cor: o.cor ?? COR.seta, largura: 1.2, dur: o.dur ?? 0.2, seta: true, fluxo: o.fluxo })
  if (!o.contrato) return
  const i = o.rotuloEm ?? 0
  const a = pts[i]
  const b = pts[i + 1]
  if (!a || !b) return
  const k = TAM[tl.f]
  const fonte = fonteMono(k.nota)
  const vertical = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1])
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const m = { t: o.tContrato ?? o.t + 0.3 }
  if (vertical) tl.p.texto(m, mx + 4, my, fonte, [[o.contrato, COR.contrato]], 0.01)
  // Embaixo da linha: em cima ficam os títulos dos grupos.
  else centro(tl, m, mx, my + k.nota * 0.85, fonte, o.contrato, COR.contrato, 0.01)
}

/** Check verde ao lado (decisão tomada). */
export function check(tl: Tela, x: number, y: number, t: number, tam: number) {
  tl.p.forma({ t }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(COR.check)
    ctx.lineWidth = Math.max(1.5, tam / 6)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - tam * 0.4, y)
    ctx.lineTo(x - tam * 0.1, y + tam * 0.3)
    ctx.lineTo(x + tam * 0.45, y - tam * 0.35)
    ctx.stroke()
  })
}

/**
 * Alternativa descartada (D9, D13): ícone e nome normais no estado A; no B (decisão tomada), esmaecidos e riscados.
 */
export function descartada(tl: Tela, s: Servico) {
  const k = TAM[tl.f]
  const lado = s.lado ?? k.apoio
  servico(tl, { ...s, lado, g: GRUPO.decisao, so: 'a' })
  servico(tl, { ...s, lado, g: GRUPO.decisao, so: 'b', alfa: 0.3 })
  const w = Math.max(lado, tl.p.medir(fonteNome(k.nome), s.nome)) / 2 + 3
  // O risco nasce com o ícone, mas só existe no estado B: a troca do estado (uEst) é a decisão.
  tl.p.linha(
    { t: s.t, g: GRUPO.decisao, so: 'b' },
    [
      [s.x - w, s.y + lado * 0.55],
      [s.x + w, s.y - lado * 0.35],
    ],
    { cor: COR.risco, largura: 1.6 },
  )
}
