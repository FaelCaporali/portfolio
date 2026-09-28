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
const rail = document.querySelector<HTMLElement>('.rail-fill')

/** Vida em leitura: acende o ponto dela e pinta o trilho com a cor dela. */
function setCurrent(id: string | undefined) {
  for (const [dotId, a] of dots) {
    if (dotId === id) a.setAttribute('aria-current', 'step')
    else a.removeAttribute('aria-current')
  }
  if (rail) rail.className = rail.className.replace(/\blife-\S+/g, '').trim() + (id ? ` life-${id}` : '')
}

const scoped = [...document.querySelectorAll<HTMLElement>('[data-scope]')]

/** A vida em leitura é a da última entrada que já passou do meio da tela (acima da primeira vida, nenhuma). */
function updateCurrent() {
  const line = window.innerHeight * 0.55
  const passed = scoped.filter((el) => el.getBoundingClientRect().top < line).at(-1)
  setCurrent(passed?.dataset.scope)
}
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: updateCurrent, onRefresh: updateCurrent })

/** Já na tela ao abrir: não esconde para depois revelar (o leitor veria o texto piscar). */
const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight

gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  const timeline = document.querySelector('.timeline')
  if (rail && timeline) {
    gsap.fromTo(
      rail,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: timeline, start: 'top 55%', end: 'bottom 55%', scrub: 0.4 },
      },
    )
  }
  for (const el of gsap.utils.toArray<HTMLElement>('[data-reveal]').filter(below)) {
    gsap.from(el, {
      autoAlpha: 0,
      y: 28,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  }
  // A vida entra letra a letra, como no herói.
  for (const slot of gsap.utils.toArray<HTMLElement>('.slot').filter(below)) {
    gsap.from(slot.querySelectorAll('.ch'), {
      opacity: 0,
      yPercent: 40,
      rotate: -8,
      filter: 'blur(8px)',
      duration: 0.55,
      ease: 'power3.out',
      stagger: 0.025,
      scrollTrigger: { trigger: slot, start: 'top 85%', once: true },
    })
  }
})
