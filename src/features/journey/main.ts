import 'virtual:journey-accents.css'
import './journey.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Tudo aqui é acabamento: o texto inteiro já está no HTML (journey.html, gerado no build). Sem JavaScript, ou com
 * movimento reduzido, a página é a mesma, só parada.
 */
gsap.registerPlugin(ScrollTrigger)

const dots = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('[data-dot]')].map((a) => [a.dataset.dot ?? '', a]),
)
const scoped = [...document.querySelectorAll<HTMLElement>('[data-scope]')]
const marks = [...document.querySelectorAll<HTMLElement>('[data-checkpoint]')]
const bar = document.querySelector<HTMLElement>('.progress')
const rail = document.querySelector<HTMLElement>('.rail-fill')
const timeline = document.querySelector<HTMLElement>('.timeline')
let shown: string | undefined
let currentMark: HTMLElement | undefined

/** Vida em leitura: acende o ponto dela e dá a cor dela ao <body> (brilho, barra e cabeçalho). */
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

/** Marco em leitura: o último que já passou do meio da tela. */
function setMark(el: HTMLElement | undefined) {
  if (el === currentMark) return
  currentMark?.classList.remove('is-current')
  el?.classList.add('is-current')
  currentMark = el
}

const aboveLine = (el: HTMLElement) => el.getBoundingClientRect().top < window.innerHeight * 0.55

function onScroll(self: ScrollTrigger) {
  if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`
  setLife(scoped.filter(aboveLine).at(-1)?.dataset.scope)
  setMark(marks.filter(aboveLine).at(-1))
}
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: onScroll, onRefresh: onScroll })

// A história abre e a página cresce: as posições da rolagem são medidas de novo.
document.addEventListener('toggle', () => ScrollTrigger.refresh(), true)

const mm = gsap.matchMedia()
mm.add('(prefers-reduced-motion: no-preference)', () => {
  // O eixo se preenche até o meio da tela, acompanhando a leitura.
  if (rail && timeline) {
    const fill = (self: ScrollTrigger) => rail.style.setProperty('--read', self.progress.toFixed(4))
    ScrollTrigger.create({
      trigger: timeline,
      start: 'top 55%',
      end: 'bottom 55%',
      onUpdate: fill,
      onRefresh: fill,
    })
  }

  // Os marcos abaixo da tela entram subindo quando chegam; os já visíveis ao abrir ficam como estão (sem piscar).
  const below = marks.filter((el) => el.getBoundingClientRect().top > window.innerHeight)
  for (const el of below) {
    el.classList.add('reveal')
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-in') })
  }

  return () => {
    rail?.style.removeProperty('--read')
    for (const el of below) el.classList.remove('reveal', 'is-in')
  }
})
