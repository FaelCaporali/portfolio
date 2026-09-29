// As cores das vidas (geradas de journey.ts, vite.config.ts). O resto do CSS vem por <link> no journey.html, no <head>,
// para o HTML nunca aparecer sem estilo (J54); no build, as duas partes entram no <head>.
import 'virtual:journey-accents.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { initFilters } from './filters'

/**
 * Tudo aqui é acabamento: o texto inteiro, o índice e o minimapa já estão no HTML (journey.html, gerado no build).
 * Sem JavaScript a página é a mesma, com o eixo reto no lugar do caminho; com movimento reduzido, o caminho aparece
 * inteiro, sem se desenhar.
 */
gsap.registerPlugin(ScrollTrigger)

const SVG = 'http://www.w3.org/2000/svg'
const LINE = 0.55 // a linha de leitura, em fração da altura da tela

const dots = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('[data-dot]')].map((a) => [a.dataset.dot ?? '', a]),
)
const scoped = [...document.querySelectorAll<HTMLElement>('[data-scope]')]
const marks = [...document.querySelectorAll<HTMLElement>('[data-checkpoint]')]
const minis = [...document.querySelectorAll<HTMLAnchorElement>('[data-mini]')]
const miniSegs = [...document.querySelectorAll<SVGPathElement>('[data-mini-seg]')]
const sheet = document.querySelector<HTMLDetailsElement>('.index-sheet')
const sheetLabel = document.querySelector<HTMLElement>('[data-index-current]')
const bar = document.querySelector<HTMLElement>('.progress')
const timeline = document.querySelector<HTMLElement>('.timeline')
const route = document.querySelector<SVGSVGElement>('.route')
let shown: string | undefined
let currentMark: HTMLElement | undefined
let animateRoute = false

/** Vida em leitura: acende o ponto dela e dá a cor dela ao <body> (brilho, barra, cabeçalho e índice). */
function setLife(id: string | undefined) {
  if (id === shown) return
  if (shown) document.body.classList.remove(`life-${shown}`)
  if (id) document.body.classList.add(`life-${id}`)
  shown = id
  for (const [dotId, a] of dots) {
    if (dotId === id) a.setAttribute('aria-current', 'step')
    else a.removeAttribute('aria-current')
  }
}

/** Marco em leitura: o último que já passou da linha de leitura. Acende no mapa, no minimapa e na barra do índice. */
function setMark(el: HTMLElement | undefined) {
  if (el === currentMark) return
  currentMark?.classList.remove('is-current')
  el?.classList.add('is-current')
  currentMark = el
  const id = el?.id
  for (const a of minis) {
    if (a.dataset.mini === id) a.setAttribute('aria-current', 'location')
    else a.removeAttribute('aria-current')
  }
  // Os trechos do minimapa até o marco em leitura ficam acesos.
  const at = miniSegs.findIndex((s) => s.dataset.miniSeg === id)
  miniSegs.forEach((s, i) => s.classList.toggle('is-read', i <= at))
  if (sheetLabel) sheetLabel.textContent = el?.dataset.label ?? 'Journey map'
}

const aboveLine = (el: HTMLElement) => el.getBoundingClientRect().top < window.innerHeight * LINE
/** Fora do filtro (filters.ts), a parada some da página e do caminho. */
const onMap = (el: HTMLElement) => !el.closest('[hidden]')

/* O caminho: uma curva em S de ponto em ponto ([data-node]), um trecho por marco, na cor da vida de destino. */
interface Leg {
  path: SVGPathElement
  from: number
  to: number
  length: number
}
let legs: Leg[] = []

function buildRoute() {
  if (!route || !timeline) return
  const box = timeline.getBoundingClientRect()
  const pts = [...timeline.querySelectorAll<HTMLElement>('[data-node]')].filter(onMap).map((n) => {
    const r = n.getBoundingClientRect()
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, scope: n.dataset.node ?? '' }
  })
  // Tamanho em pixels, igual ao viewBox: o SVG nunca estica sozinho quando a página cresce (J68, o caminho piscava).
  route.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`)
  route.style.width = `${box.width.toFixed(1)}px`
  route.style.height = `${box.height.toFixed(1)}px`
  const base = document.createElementNS(SVG, 'path')
  base.classList.add('route-base')
  const parts: string[] = []
  legs = pts.slice(1).map((b, i) => {
    const a = pts[i] ?? b
    const k = (b.y - a.y) / 2
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${a.x.toFixed(1)} ${(a.y + k).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - k).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
    parts.push(d)
    const path = document.createElementNS(SVG, 'path')
    path.setAttribute('d', d)
    path.classList.add('route-leg')
    if (b.scope) path.classList.add(`life-${b.scope}`)
    return { path, from: a.y, to: b.y, length: 0 }
  })
  base.setAttribute('d', parts.join(' '))
  route.replaceChildren(base, ...legs.map((l) => l.path))
  for (const leg of legs) {
    leg.length = leg.path.getTotalLength()
    leg.path.style.strokeDasharray = leg.length.toFixed(1)
  }
  timeline.classList.add('map-ready')
  drawRoute()
}

/** Cada trecho se desenha enquanto a linha de leitura passa por ele; com movimento reduzido, tudo desenhado. */
function drawRoute() {
  if (!timeline || !legs.length) return
  const line = window.innerHeight * LINE - timeline.getBoundingClientRect().top
  for (const leg of legs) {
    const f = animateRoute ? gsap.utils.clamp(0, 1, (line - leg.from) / Math.max(1, leg.to - leg.from)) : 1
    leg.path.style.strokeDashoffset = (leg.length * (1 - f)).toFixed(1)
  }
}

function onScroll(self: ScrollTrigger) {
  if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`
  setLife(scoped.filter(onMap).filter(aboveLine).at(-1)?.dataset.scope)
  setMark(marks.filter(onMap).filter(aboveLine).at(-1))
  drawRoute()
}
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: onScroll, onRefresh: onScroll })

/*
 * A história abre, o filtro muda ou a tela muda de tamanho: o caminho é refeito já, no próprio aviso do
 * ResizeObserver, que chega depois do layout e antes da pintura. Refazer só no quadro seguinte deixava um quadro com
 * o caminho antigo esticado e fora do lugar (J68: "pisca mudando de posição e depois volta"). A rolagem é medida de
 * novo no quadro seguinte.
 */
let pending = 0
function remeasure() {
  buildRoute()
  cancelAnimationFrame(pending)
  pending = requestAnimationFrame(() => ScrollTrigger.refresh())
}
if (timeline) new ResizeObserver(remeasure).observe(timeline)
initFilters(remeasure)

// No celular, escolher um marco no índice fecha a barra.
sheet?.addEventListener('click', (e) => {
  if (e.target instanceof Element && e.target.closest('a')) sheet.open = false
})

const mm = gsap.matchMedia()
mm.add('(prefers-reduced-motion: no-preference)', () => {
  animateRoute = true
  drawRoute()

  // Os marcos abaixo da tela aparecem quando chegam; os já visíveis ao abrir ficam como estão (sem piscar).
  const below = marks.filter((el) => el.getBoundingClientRect().top > window.innerHeight)
  for (const el of below) {
    el.classList.add('reveal')
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-in') })
  }

  return () => {
    animateRoute = false
    drawRoute()
    for (const el of below) el.classList.remove('reveal', 'is-in')
  }
})
