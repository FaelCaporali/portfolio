/**
 * COORDENAÇÃO e CADÊNCIA da vida techlead (REQUISITOS T1, T2, T5; FICHA-PRODUCAO, FECHAMENTO): o fluxo quebrado em
 * issues do Jira num Kanban (To Do / In Progress / Done; os cartões que andam estão em cartoes.ts), a equipe com
 * avatares genéricos (sem nome nem cargo) e o Fael como ÚNICO nó técnico (acento da vida e o glifo `</>`, com linhas
 * finas para todos), a linha de sprints que avança, o burndown que desce e a release que sai. Papéis como ações, não
 * rótulos: nenhum cargo escrito.
 */
import type { Ponto, Quadro } from './pincel'
import { conversa } from './bloco_destrava'
import { T } from './roteiro'
import { ACENTO, COR, PESSOAS, TAM, avatar, fonte, fonteMono, logo, type Tela } from './estilo'

const COLUNAS = ['TO DO', 'IN PROGRESS', 'DONE'] as const
const LINHAS = 2

/** Equipe em `r`: o Fael no centro (acento, `</>`), os avatares em volta e as linhas dele para todos. */
function equipe(tl: Tela, r: Quadro) {
  const cx = (r.x0 + r.x1) / 2
  const cy = (r.y0 + r.y1) / 2
  const raio = Math.min((r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2)
  const rf = Math.max(7, raio * 0.36)
  const ra = Math.max(5, raio * 0.24)
  const orb = raio - ra - 1
  const [t0, t1] = T.equipe
  PESSOAS.forEach((cor, i) => {
    const ang = -Math.PI / 2 + Math.PI / 4 + (i * Math.PI) / 2
    const x = cx + Math.cos(ang) * orb
    const y = cy + Math.sin(ang) * orb
    const t = t0 + (i * (t1 - t0)) / PESSOAS.length
    const a: Ponto = [cx + Math.cos(ang) * rf, cy + Math.sin(ang) * rf]
    const b: Ponto = [x - Math.cos(ang) * ra, y - Math.sin(ang) * ra]
    tl.p.linha({ t }, [a, b], { cor: `${ACENTO}b0`, largura: 1, dur: 0.08 })
    avatar(tl.p, x, y, ra, cor, t + 0.06)
  })
  tl.p.forma({ t: t0 - 0.05 }, (ctx, tinta) => {
    ctx.fillStyle = tinta(ACENTO)
    ctx.beginPath()
    ctx.arc(cx, cy, rf, 0, Math.PI * 2)
    ctx.fill()
  })
  const fnt = fonteMono(Math.max(7, rf * 0.8), 700)
  const w = tl.p.medir(fnt, '</>')
  tl.p.texto({ t: t0 }, cx - w / 2, cy, fnt, [['</>', '#1b1030']])
}

/** Sprints de x0 a x1 na altura y: a 13 feita, a 14 avançando (acento) e a 15 por vir. */
function sprints(tl: Tela, x0: number, x1: number, y: number) {
  const k = TAM[tl.f]
  const fr = fonte(k.rotulo, 600)
  const a = x0 + 4
  const b = x0 + (x1 - x0) * 0.42
  const c = x1 - 4
  const nos = [a, b, c]
  tl.p.linha(
    { t: T.quadro },
    [
      [a, y],
      [c, y],
    ],
    { cor: COR.linha, largura: 1.2, dur: 0.15 },
  )
  tl.p.linha(
    { t: T.sprint[0] },
    [
      [b, y],
      [c - 10, y],
    ],
    {
      cor: ACENTO,
      largura: 2.4,
      dur: T.sprint[1] - T.sprint[0],
    },
  )
  const nomes = ['Sprint 13', 'Sprint 14', 'Sprint 15']
  nos.forEach((x, i) => {
    tl.p.forma({ t: T.quadro + 0.05 * i }, (ctx, tinta) => {
      ctx.fillStyle = tinta([COR.feito, ACENTO, '#2c333a'][i] ?? COR.linha)
      ctx.strokeStyle = tinta(COR.linha)
      ctx.beginPath()
      ctx.arc(x, y, k.rotulo * 0.38, 0, Math.PI * 2)
      ctx.fill()
      if (i === 2) ctx.stroke()
    })
    const txt = nomes[i] ?? ''
    const w = tl.p.medir(fr, txt)
    const xt = Math.min(Math.max(x - w / 2, x0), x1 - w)
    const cor = i === 1 ? ACENTO : COR.fraco
    tl.p.texto({ t: T.quadro + 0.05 * i }, xt, y - k.rotulo * 1.05, fr, [[txt, cor]], 0.006)
  })
}

/** Release: selo verde com check, à direita de `x1` na altura y. */
function release(tl: Tela, x1: number, y: number) {
  const k = TAM[tl.f]
  const fr = fonte(k.meta, 600)
  const txt = 'v2.4 released'
  const w = tl.p.medir(fr, txt) + k.meta * 2.2
  const x0 = x1 - w
  tl.p.forma({ t: T.release }, (ctx, tinta) => {
    ctx.fillStyle = tinta('rgba(75, 206, 151, 0.16)')
    ctx.strokeStyle = tinta(COR.feito)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x0 + 0.5, y - k.meta * 0.75, w - 1, k.meta * 1.5, k.meta * 0.75)
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x0 + k.meta * 0.45, y)
    ctx.lineTo(x0 + k.meta * 0.75, y + k.meta * 0.3)
    ctx.lineTo(x0 + k.meta * 1.25, y - k.meta * 0.35)
    ctx.stroke()
  })
  tl.p.texto({ t: T.release + 0.03 }, x0 + k.meta * 1.6, y, fr, [[txt, COR.feito]], 0.008)
}

/**
 * Burndown em `r`: eixos, ideal tracejado e o real (acento): o plâtô enquanto o cartão está travado e o DEGRAU
 * depois da destrava; a release no título.
 */
function burndown(tl: Tela, r: Quadro, mini: boolean) {
  const k = TAM[tl.f]
  const titulo = mini ? 0 : k.meta * 1.9
  const g: Quadro = { x0: r.x0 + 2, y0: r.y0 + titulo, x1: r.x1 - 2, y1: r.y1 - 1 }
  const t0 = T.plato[0] - 0.1
  if (!mini) {
    tl.p.texto({ t: t0 }, r.x0, r.y0 + k.meta * 0.75, fonte(k.rotulo, 700), [['BURNDOWN', COR.jChave]])
    release(tl, r.x1, r.y0 + k.meta * 0.75)
  }
  tl.p.linha(
    { t: t0 },
    [
      [g.x0, g.y0],
      [g.x0, g.y1],
      [g.x1, g.y1],
    ],
    {
      cor: COR.linha,
      largura: 1,
      dur: 0.12,
    },
  )
  tl.p.linha(
    { t: t0 + 0.05 },
    [
      [g.x0, g.y0 + 2],
      [g.x1, g.y1 - 1],
    ],
    {
      cor: '#5e6c84',
      largura: 1,
      dur: 0.15,
      tracejado: [4, 3],
    },
  )
  // Pontos restantes por dia: 18; 13 com o Doc checklist em Done; o plâtô do cartão travado; 5 depois da destrava.
  const resto = [18, 18, 13, 13, 13, 13, 13, 5]
  const pts: Ponto[] = []
  resto.forEach((v, i) => {
    const x = g.x0 + ((g.x1 - g.x0) * i) / (resto.length - 1)
    const y = g.y1 - ((g.y1 - g.y0 - 2) * v) / 18
    const ant = pts[pts.length - 1]
    if (ant) pts.push([x, ant[1]])
    pts.push([x, y])
  })
  const plato = pts.slice(0, -2)
  const degrau = pts.slice(-3)
  tl.p.linha({ t: T.plato[0] }, plato, { cor: ACENTO, largura: 2, dur: T.plato[1] - T.plato[0] })
  tl.p.linha({ t: T.degrau[0] }, degrau, { cor: ACENTO, largura: 2, dur: T.degrau[1] - T.degrau[0] })
  tl.alvos.burndown = { x: (g.x0 + g.x1) / 2, y: (g.y0 + g.y1) / 2 }
}

/** Colunas do Kanban em `r`; devolve os slots (coluna → linhas) em px CSS para os cartões. */
function kanban(tl: Tela, r: Quadro, mini: boolean) {
  const k = TAM[tl.f]
  const gap = mini ? 3 : 6
  const cw = (r.x1 - r.x0 - 2 * gap) / 3
  const cab = mini ? 4 : k.rotulo * 1.9
  const pad = mini ? 2 : 4
  const ch = Math.min(mini ? 16 : k.corpo * 3.3, (r.y1 - r.y0 - cab - pad - (LINHAS - 1) * pad) / LINHAS)
  const slots: Quadro[][] = []
  COLUNAS.forEach((nome, i) => {
    const x0 = r.x0 + i * (cw + gap)
    const t = T.quadro + i * 0.05
    const alto = cab + LINHAS * (ch + pad) + pad
    tl.p.forma({ t }, (ctx, tinta) => {
      ctx.fillStyle = tinta(COR.jColuna)
      ctx.beginPath()
      ctx.roundRect(x0, r.y0, cw, alto, mini ? 2 : 4)
      ctx.fill()
    })
    if (!mini) tl.p.texto({ t }, x0 + pad + 2, r.y0 + cab * 0.5, fonte(k.rotulo, 700), [[nome, COR.jChave]], 0.006)
    slots.push(
      Array.from({ length: LINHAS }, (_, l) => {
        const y0 = r.y0 + cab + pad + l * (ch + pad)
        return { x0: x0 + pad, y0, x1: x0 + cw - pad, y1: y0 + ch }
      }),
    )
  })
  tl.alvos.quadro = { x: (r.x0 + r.x1) / 2, y: r.y0 + cab + ch }
  return slots
}

/** Slots do Kanban (coluna → linhas, px CSS) e o ponto onde chega a voz que sai do microfone. */
export interface Jira {
  slots: Quadro[][]
  chegada: Ponto
}

/** Alvo do olhar na destrava: o cartão que trava (In Progress, primeira linha). */
function alvoBloqueado(tl: Tela, slots: Quadro[][]) {
  const s = slots[1]?.[0]
  if (s) tl.alvos.bloqueado = { x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 }
}

/**
 * Quadro completo em `r` (faixa larga): cabeçalho com o logo do Jira e a linha de sprints; à esquerda o Kanban e,
 * embaixo dele, a equipe e o burndown; à direita a conversa da destrava. `mini` (retrato): coluna estreita, tudo em
 * silhueta.
 */
export function quadroJira(tl: Tela, r: Quadro, mini = false): Jira {
  const k = TAM[tl.f]
  if (mini) {
    const h = r.y1 - r.y0
    logo(tl, 'jira', r.x0 + k.logo / 2, r.y0 + k.logo / 2, k.logo, T.quadro - 0.1)
    const y1 = r.y0 + h * 0.42
    const slots = kanban(tl, { x0: r.x0, y0: r.y0 + k.logo + 4, x1: r.x1, y1 }, true)
    const chegada = conversa(tl, { x0: r.x0, y0: y1 + 6, x1: r.x1, y1: r.y0 + h * 0.74 }, true)
    burndown(tl, { x0: r.x0, y0: r.y0 + h * 0.74 + 8, x1: r.x1, y1: r.y1 }, true)
    alvoBloqueado(tl, slots)
    return { slots, chegada }
  }
  const chatW = Math.max(k.corpo * 15, (r.x1 - r.x0) * 0.34)
  const xe = r.x1 - chatW - 14
  const cab = k.logo * 1.5
  const yc = r.y0 + k.logo * 0.6
  logo(tl, 'jira', r.x0 + k.logo / 2, yc, k.logo, T.quadro - 0.1)
  const xs = r.x0 + k.logo + 6
  const w = tl.p.texto({ t: T.quadro - 0.05 }, xs, yc, fonte(k.corpo, 600), [['Sprint board', COR.texto]], 0.01)
  sprints(tl, xs + w + k.corpo * 1.5, xe, yc + k.rotulo * 0.4)
  const y0 = r.y0 + cab + k.rotulo
  const slots = kanban(tl, { x0: r.x0, y0, x1: xe, y1: r.y1 }, false)
  const fimK = (slots[0]?.[LINHAS - 1]?.y1 ?? y0) + 12
  const eq = Math.min(r.y1 - fimK, (xe - r.x0) * 0.2)
  equipe(tl, { x0: r.x0, y0: fimK, x1: r.x0 + eq, y1: fimK + eq })
  burndown(tl, { x0: r.x0 + eq + 14, y0: fimK, x1: xe, y1: r.y1 }, false)
  const chegada = conversa(tl, { x0: r.x1 - chatW, y0: r.y0, x1: r.x1, y1: r.y1 })
  alvoBloqueado(tl, slots)
  return { slots, chegada }
}
