/**
 * SOLUÇÃO VISÍVEL da vida techlead (REQUISITOS T1, T4; FICHA-PRODUCAO, FECHAMENTO): o que se mostra ao cliente para
 * validar — o mockup low-fi de traço Excalidraw (tela de cadastro guiado: passos, checklist, envio de documento,
 * botão), com os logos do Excalidraw e do Figma, e o fluxo de uso em Mermaid (usuário → ação → resultado), no tema
 * escuro do Mermaid. Nunca arquitetura (a fronteira com o Solutions Architect).
 */
import type { Ponto, Quadro } from './pincel'
import { ESCALA, T } from './roteiro'
import { COR, TAM, caixaMao, fonte, fonteMono, logo, rabisco, type Tela } from './estilo'

const FLUXO = ['User', 'Opens sign-up', 'Uploads documents', 'Account ready'] as const
/** Offsets da solução pelo fator da batida (roteiro.ts, RITMO.md). */
const K = ESCALA.solucao

/** Cabeçalho: logo e rótulo; devolve o x do fim. */
function rotulo(tl: Tela, x: number, y: number, id: Parameters<typeof logo>[1], txt: string, t: number, mono = false) {
  const k = TAM[tl.f]
  logo(tl, id, x + k.logo / 2, y, k.logo, t)
  const fnt = mono ? fonteMono(k.meta) : fonte(k.meta, 500)
  return x + k.logo + 5 + tl.p.texto({ t: t + 0.04 * K }, x + k.logo + 5, y, fnt, [[txt, COR.fraco]], 0.006)
}

/** Mockup de celular em `q`, desenhando-se de t0 a t1. */
function mockup(tl: Tela, q: Quadro, t0: number, t1: number) {
  const k = TAM[tl.f]
  const p = tl.p
  const w = q.x1 - q.x0
  const d = (t1 - t0) / 8
  const tr = (s: number) => ({ cor: COR.traco, largura: 1.3, dur: d, semente: s })
  caixaMao(p, { t: t0 }, q, { ...tr(1), dur: d * 2 })
  const m = w * 0.1
  const x0 = q.x0 + m
  const x1 = q.x1 - m
  let y = q.y0 + k.corpo * 1.5
  p.texto({ t: t0 + d }, x0, y, fonte(k.corpo, 700), [['Sign up', COR.texto]], 0.01)
  y += k.corpo * 1.3
  // Passos: dois feitos e o atual.
  const rr = k.rotulo * 0.38
  for (let i = 0; i < 3; i++) {
    const cx = x0 + rr + i * rr * 3.2
    p.forma({ t: t0 + d * 1.5 + i * 0.02 * K }, (ctx, tinta) => {
      ctx.strokeStyle = tinta(COR.traco)
      ctx.fillStyle = tinta(COR.requisito)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx, y, rr, 0, Math.PI * 2)
      if (i < 2) ctx.fill()
      else ctx.stroke()
    })
  }
  p.texto({ t: t0 + d * 2 }, x0 + rr * 9, y, fonte(k.rotulo), [['Step 2 of 3', COR.fraco]], 0.008)
  y += k.corpo * 1.25
  // Checklist: caixa marcada e o texto rabiscado.
  for (let i = 0; i < 3; i++) {
    const c = k.rotulo * 0.8
    const yy = y + i * k.corpo * 1.15
    const t = t0 + d * (2.5 + i * 0.5)
    caixaMao(p, { t }, { x0, y0: yy - c / 2, x1: x0 + c, y1: yy + c / 2 }, { ...tr(20 + i), dur: 0.06 * K })
    if (i < 2) rabisco(p, { t: t + 0.04 * K }, [x0 + c * 0.2, yy], [x0 + c * 0.9, yy + c * 0.4], tr(30 + i))
    const fim = x0 + c * 1.6 + (x1 - x0 - c * 1.6) * ([0.8, 0.62, 0.7][i] ?? 0.7)
    rabisco(p, { t: t + 0.05 * K }, [x0 + c * 1.6, yy], [fim, yy], tr(40 + i))
  }
  y += k.corpo * 3.1
  // Envio do documento: o quadro com o X de imagem.
  const alto = Math.max(k.corpo * 1.6, q.y1 - y - k.corpo * 2.6)
  const up: Quadro = { x0, y0: y, x1, y1: y + alto }
  caixaMao(p, { t: t0 + d * 4.2 }, up, tr(50))
  rabisco(p, { t: t0 + d * 5 }, [up.x0, up.y0], [up.x1, up.y1], tr(51))
  rabisco(p, { t: t0 + d * 5.3 }, [up.x1, up.y0], [up.x0, up.y1], tr(52))
  // Botão.
  const b: Quadro = { x0, y0: q.y1 - k.corpo * 2.1, x1, y1: q.y1 - k.corpo * 0.6 }
  caixaMao(p, { t: t0 + d * 6 }, b, { ...tr(60), cor: COR.requisito })
  const fb = fonte(k.rotulo, 600)
  const tw = p.medir(fb, 'Continue')
  p.texto({ t: t0 + d * 6.8 }, (b.x0 + b.x1 - tw) / 2, (b.y0 + b.y1) / 2, fb, [['Continue', COR.requisito]], 0.01)
}

/** Nó do Mermaid (tema escuro): caixa arredondada (a primeira, o usuário, em cápsula) com o texto centrado. */
function no(tl: Tela, q: Quadro, txt: string, t: number, capsula: boolean) {
  const k = TAM[tl.f]
  tl.p.forma({ t }, (ctx, tinta) => {
    ctx.fillStyle = tinta(COR.mNo)
    ctx.strokeStyle = tinta(COR.mBorda)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(q.x0 + 0.5, q.y0 + 0.5, q.x1 - q.x0 - 1, q.y1 - q.y0 - 1, capsula ? (q.y1 - q.y0) / 2 : 3)
    ctx.fill()
    ctx.stroke()
  })
  // Texto mais largo que o nó (coluna estreita): o corpo encolhe até caber.
  const cabe = q.x1 - q.x0 - 8
  const w0 = tl.p.medir(fonte(k.corpo), txt)
  const fnt = fonte(w0 > cabe ? (k.corpo * cabe) / w0 : k.corpo)
  const w = tl.p.medir(fnt, txt)
  tl.p.texto({ t: t + 0.03 * K }, (q.x0 + q.x1 - w) / 2, (q.y0 + q.y1) / 2, fnt, [[txt, COR.mTexto]], 0.006)
}

/** Fluxo de uso em Mermaid (flowchart TD) a partir de y, na largura de `r`; devolve o fim em y. */
function fluxo(tl: Tela, r: Quadro, y: number) {
  const k = TAM[tl.f]
  const t0 = T.fluxo[0]
  const passo = (T.fluxo[1] - t0) / FLUXO.length
  rotulo(tl, r.x0, y, 'mermaid', 'flowchart TD', t0 - 0.05 * K, true)
  let yy = y + k.logo * 0.9
  const alto = k.corpo * 2
  const seta = k.corpo * 1.25
  const w = Math.min(r.x1 - r.x0, 12.5 * k.corpo)
  const x0 = r.x0 + (r.x1 - r.x0 - w) / 2
  const cx = x0 + w / 2
  FLUXO.forEach((txt, i) => {
    const t = t0 + i * passo
    if (i > 0) {
      const a: Ponto = [cx, yy - seta + 1]
      const b: Ponto = [cx, yy - 1]
      tl.p.linha({ t: t - 0.06 * K }, [a, b], { cor: COR.mSeta, largura: 1.2, dur: 0.06 * K, seta: true })
    }
    no(tl, { x0, y0: yy, x1: x0 + w, y1: yy + alto }, txt, t, i === 0)
    yy += alto + seta
  })
  return yy - seta
}

/** Mockup e fluxo em `r` (coluna), centrados na altura que sobra. */
export function solucao(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const w = r.x1 - r.x0
  const fluxoAlto = k.logo * 0.9 + FLUXO.length * k.corpo * 3.25
  const mw = Math.min(w, 9.5 * k.corpo)
  // Excalidraw e Figma na mesma linha se couberem; senão, uma embaixo da outra.
  const juntos = w >= 2 * k.logo + 12 * k.meta + 14
  const cab = k.logo * (juntos ? 1.1 : 2.2)
  const mh = Math.max(k.corpo * 11, Math.min(mw * 1.55, r.y1 - r.y0 - cab - k.logo * 0.5 - k.corpo - fluxoAlto))
  const sobra = r.y1 - r.y0 - (cab + k.logo * 0.5 + mh + k.corpo + fluxoAlto)
  let y = r.y0 + Math.max(0, sobra / 2) + k.logo / 2
  const x = rotulo(tl, r.x0, y, 'excalidraw', 'wireframe', T.mockup[0] - 0.1 * K)
  if (juntos) rotulo(tl, x + 8, y, 'figma', 'prototype', T.mockup[0] - 0.05 * K)
  else rotulo(tl, r.x0, y + k.logo * 1.1, 'figma', 'prototype', T.mockup[0] - 0.05 * K)
  y += cab
  const mx = r.x0 + (w - mw) / 2
  mockup(tl, { x0: mx, y0: y, x1: mx + mw, y1: y + mh }, T.mockup[0], T.mockup[1])
  y += mh + k.corpo
  const fim = fluxo(tl, r, y + k.logo / 2)
  tl.alvos.solucao = { x: (r.x0 + r.x1) / 2, y: (y + fim) / 2 - mh / 3 }
  return fim
}
