import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createReading } from './reading'

gsap.registerPlugin(ScrollTrigger)

const SVG = 'http://www.w3.org/2000/svg'
/** A linha de leitura, em fração da altura da tela. */
const LINE = 0.55

/** Um trecho do caminho, de um marco ao seguinte. */
interface Leg {
  path: SVGPathElement
  from: number
  to: number
  length: number
}

const aboveLine = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * LINE
/** Fora do filtro, a parada some da página e do caminho. */
const onMap = (el: Element) => !el.closest('[hidden]')
const visibleMarks = (timeline: HTMLElement | null) =>
  timeline ? [...timeline.querySelectorAll<HTMLElement>('[data-checkpoint]')].filter(onMap) : []

/** O tamanho da linha do tempo em que o caminho foi desenhado. */
const sizeOf = (r: DOMRect) => `${r.width.toFixed(1)}x${r.height.toFixed(1)}`

/**
 * O caminho: uma curva em S de ponto em ponto ([data-node], no cartão de cada marco à vista), um trecho por marco, na
 * cor da vida de destino. Desenhado direto no <svg> (o React o entrega vazio): refeito dentro do aviso do
 * ResizeObserver, antes da pintura, ele nunca mostra um quadro com o caminho antigo (J68).
 */
function buildRoute(timeline: HTMLElement, route: SVGSVGElement): Leg[] {
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
  const legs = pts.slice(1).map((b, i) => {
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
  // Com o caminho no lugar, o eixo reto (sem JavaScript) some (journey.css).
  timeline.classList.add('map-ready')
  return legs
}

/**
 * O movimento da trajetória, acabamento sobre a página que o build já entrega: o caminho sinuoso (cada trecho se
 * desenha quando a linha de leitura passa por ele; com movimento reduzido, inteiro), a barra de progresso, a vida e o
 * marco em leitura, e a entrada dos marcos que estavam abaixo da tela ao abrir. `visible` muda com o filtro: o caminho
 * é refeito sobre as paradas à vista; `lang` muda com a troca de idioma: os textos mudam de tamanho e o caminho
 * também é refeito, antes da pintura.
 */
export function useJourneyMotion(visible: unknown, lang: string) {
  const timeline = useRef<HTMLDivElement>(null)
  const route = useRef<SVGSVGElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const legs = useRef<Leg[]>([])
  const animate = useRef(false)
  // A vida, o marco e a entrada de cada marco, fora do estado da página: quem mostra lê o seu pedaço (reading.ts).
  const [reading] = useState(createReading)

  const draw = useCallback(() => {
    const t = timeline.current
    if (!t) return
    const line = window.innerHeight * LINE - t.getBoundingClientRect().top
    for (const leg of legs.current) {
      const f = animate.current ? gsap.utils.clamp(0, 1, (line - leg.from) / Math.max(1, leg.to - leg.from)) : 1
      leg.path.style.strokeDashoffset = (leg.length * (1 - f)).toFixed(1)
    }
  }, [])

  /**
   * Refaz o caminho já e mede a rolagem de novo depois da pintura seguinte: o refresh do ScrollTrigger (e o que ele
   * troca na leitura) fica fora do quadro que responde ao toque (142). O caminho já está certo antes da pintura; o
   * refresh só acerta a barra, a vida e o marco em leitura um quadro depois.
   */
  const frame = useRef(0)
  const task = useRef(0)
  const built = useRef('')
  const cancelRefresh = useCallback(() => {
    cancelAnimationFrame(frame.current)
    clearTimeout(task.current)
  }, [])
  const remeasure = useCallback(() => {
    if (!timeline.current || !route.current) return
    legs.current = buildRoute(timeline.current, route.current)
    built.current = sizeOf(timeline.current.getBoundingClientRect())
    draw()
    cancelRefresh()
    frame.current = requestAnimationFrame(() => {
      task.current = window.setTimeout(() => ScrollTrigger.refresh())
    })
  }, [draw, cancelRefresh])

  // A história abre ou a tela muda de tamanho: o caminho é refeito no próprio aviso do ResizeObserver (J68). Se o
  // tamanho é o do caminho já desenhado (o filtro acabou de refazê-lo antes da pintura), não refaz de novo.
  useLayoutEffect(() => {
    const t = timeline.current
    if (!t) return
    const ro = new ResizeObserver(() => {
      if (sizeOf(t.getBoundingClientRect()) !== built.current) remeasure()
    })
    ro.observe(t)
    return () => {
      ro.disconnect()
      cancelRefresh()
    }
  }, [remeasure, cancelRefresh])

  // O filtro ou o idioma mudou: o caminho sobre as paradas à vista, antes da pintura.
  useLayoutEffect(remeasure, [visible, lang, remeasure])

  // A rolagem: a barra, a vida e o marco em leitura (o último à vista que já passou da linha) e o caminho.
  useLayoutEffect(() => {
    const update = (self: ScrollTrigger) => {
      if (bar.current) bar.current.style.transform = `scaleX(${self.progress.toFixed(4)})`
      const read = visibleMarks(timeline.current).filter(aboveLine)
      reading.set({ life: read.filter((el) => el.dataset.scope).at(-1)?.dataset.scope, mark: read.at(-1)?.id })
      draw()
    }
    const st = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: update })
    return () => {
      st.kill()
    }
  }, [draw, reading])

  // Com movimento liberado: o caminho se desenha na rolagem e os marcos abaixo da tela ao abrir entram quando chegam.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      animate.current = true
      draw()
      const below = visibleMarks(timeline.current).filter((el) => el.getBoundingClientRect().top > window.innerHeight)
      reading.set({ reveal: new Map(below.map((el) => [el.id, false])) })
      for (const el of below) {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            reading.set({ reveal: new Map(reading.get().reveal).set(el.id, true) })
          },
        })
      }
      return () => {
        animate.current = false
        draw()
        reading.set({ reveal: new Map() })
      }
    })
    return () => {
      mm.revert()
    }
  }, [draw, reading])

  // A vida em leitura dá a cor dela ao <body> (brilho, barra, cabeçalho e índice), sem passar pelo React. A troca é
  // num salto no <body>; a transição de 0,8 s é só de quem pinta com essa cor (journey.css).
  useLayoutEffect(() => {
    let shown: string | undefined
    const sync = () => {
      const { life } = reading.get()
      if (life === shown) return
      if (shown) document.body.classList.remove(`life-${shown}`)
      if (life) document.body.classList.add(`life-${life}`)
      shown = life
    }
    sync()
    const off = reading.subscribe(sync)
    return () => {
      off()
      if (shown) document.body.classList.remove(`life-${shown}`)
    }
  }, [reading])

  return { timeline, route, bar, reading }
}
