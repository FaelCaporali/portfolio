import 'virtual:journey-accents.css'
import './journey.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Tudo aqui é acabamento: o texto inteiro já está no HTML (journey.html, gerado no build). Sem JavaScript, ou com
 * movimento reduzido, a página é a mesma, só parada: o foco (`--focus`, journey.css) vale 1 quando ninguém o escreve.
 */
gsap.registerPlugin(ScrollTrigger)

/** Imagem que não veio (ainda sendo feita, ou falhou): some, e fica só o brilho da vida no lugar reservado. */
for (const img of document.querySelectorAll('img')) {
  const missing = () => img.classList.add('is-missing')
  if (img.complete && img.naturalWidth === 0) missing()
  else img.addEventListener('error', missing, { once: true })
}

const dots = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('[data-dot]')].map((a) => [a.dataset.dot ?? '', a]),
)
const scoped = [...document.querySelectorAll<HTMLElement>('[data-scope]')]
const bar = document.querySelector<HTMLElement>('.progress')
let shown: string | undefined

/** Vida em leitura: acende o ponto dela e dá a cor dela ao <body> (brilho de fundo, barra e cabeçalho). */
function setCurrent(id: string | undefined) {
  if (id === shown) return
  if (shown) document.body.classList.remove(`life-${shown}`)
  if (id) document.body.classList.add(`life-${id}`)
  shown = id
  for (const [dotId, a] of dots) {
    if (dotId === id) a.setAttribute('aria-current', 'step')
    else a.removeAttribute('aria-current')
  }
}

/** A vida em leitura é a da última entrada que já passou do meio da tela (acima da primeira vida, nenhuma). */
function onScroll(self: ScrollTrigger) {
  if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`
  const line = window.innerHeight * 0.55
  setCurrent(scoped.filter((el) => el.getBoundingClientRect().top < line).at(-1)?.dataset.scope)
}
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: onScroll, onRefresh: onScroll })

// "What I did" abre e a página cresce: as posições da rolagem são medidas de novo.
document.addEventListener('toggle', () => ScrollTrigger.refresh(), true)

/** Já na tela ao abrir: não esconde para depois revelar (o leitor veria o texto piscar). */
const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight

/**
 * Foco: 1 enquanto o bloco cobre o meio da tela, caindo até 0 à medida que se afasta dele. Calculado das posições que
 * o ScrollTrigger já mediu (sem ler o layout a cada quadro).
 */
function focus(el: HTMLElement, reach: number) {
  const host = el.parentElement ?? el
  const apply = (self: ScrollTrigger) => {
    const vh = window.innerHeight
    const top = self.start + vh - self.scroll()
    const bottom = top + (self.end - self.start - vh)
    const off = Math.max(top - vh / 2, vh / 2 - bottom, 0)
    el.style.setProperty('--focus', Math.max(0, 1 - off / (vh * reach)).toFixed(3))
  }
  ScrollTrigger.create({ trigger: host, start: 'top bottom', end: 'bottom top', onUpdate: apply, onRefresh: apply })
}

const mm = gsap.matchMedia()
mm.add('(prefers-reduced-motion: no-preference)', () => {
  const focusable = gsap.utils.toArray<HTMLElement>('[data-focus]')
  for (const el of focusable) focus(el, el.closest('.scene') ? 0.42 : 0.24)

  // A vida assenta letra a letra com a rolagem, como a troca de vida do herói.
  for (const slot of gsap.utils.toArray<HTMLElement>('.slot').filter(below)) {
    gsap.fromTo(
      slot.querySelectorAll('.ch'),
      { opacity: 0, yPercent: 45, rotate: -8, filter: 'blur(8px)' },
      {
        opacity: 1,
        yPercent: 0,
        rotate: 0,
        filter: 'blur(0px)',
        ease: 'power3.out',
        stagger: 0.04,
        scrollTrigger: { trigger: slot, start: 'top bottom', end: 'top 78%', scrub: 0.4 },
      },
    )
  }

  // Parallax: a imagem da cena, o título e o número de cada capítulo.
  for (const media of gsap.utils.toArray<HTMLElement>('[data-parallax]')) {
    gsap.fromTo(
      media,
      { yPercent: 9 },
      {
        yPercent: -9,
        ease: 'none',
        scrollTrigger: { trigger: media.closest('.scene'), start: 'top bottom', end: 'bottom top', scrub: true },
      },
    )
  }
  for (const head of gsap.utils.toArray<HTMLElement>('.chapter-head')) {
    const scrub = { trigger: head, start: 'top bottom', end: 'bottom top', scrub: true }
    gsap.fromTo(
      head.querySelector('[data-chapter-title]'),
      { xPercent: 6 },
      { xPercent: -3, ease: 'none', scrollTrigger: scrub },
    )
    gsap.fromTo(
      head.querySelector('[data-chapter-num]'),
      { yPercent: 15 },
      { yPercent: -15, ease: 'none', scrollTrigger: scrub },
    )
  }

  // Abertura: sai subindo e o busto se aproxima; o brilho passeia pelas nove cores, na ordem do indicador.
  const opening = document.querySelector('.opening')
  if (opening) {
    const scrub = { trigger: opening, start: 'top top', end: 'bottom top', scrub: true }
    gsap.to('[data-opening-copy]', { y: -90, opacity: 0.15, ease: 'none', scrollTrigger: scrub })
    gsap.to('[data-opening-bust]', { yPercent: 8, scale: 1.06, ease: 'none', scrollTrigger: scrub })
  }
  const colors = [...dots.values()].map((a) => getComputedStyle(a).getPropertyValue('--accent').trim())
  const glow = document.querySelector('.opening-glow')
  if (glow && colors.length) {
    gsap.to(glow, {
      keyframes: colors.map((c) => ({ '--accent': c, duration: 2.2 })),
      ease: 'sine.inOut',
      repeat: -1,
    })
    gsap.to(glow, { xPercent: -8, yPercent: 6, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 })
  }
  gsap.fromTo(
    '.scroll-cue-bead',
    { yPercent: -100 },
    { yPercent: 340, duration: 1.6, ease: 'power2.inOut', repeat: -1 },
  )

  return () => {
    for (const el of focusable) el.style.removeProperty('--focus')
  }
})
