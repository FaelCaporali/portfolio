import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

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
 * é refeito sobre as paradas à vista.
 */
export function useJourneyMotion(visible: unknown) {
  const timeline = useRef<HTMLDivElement>(null)
  const route = useRef<SVGSVGElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const legs = useRef<Leg[]>([])
  const animate = useRef(false)
  const [life, setLife] = useState<string>()
  const [mark, setMark] = useState<string>()
  const [reveal, setReveal] = useState<ReadonlyMap<string, boolean>>(() => new Map())

  const draw = useCallback(() => {
    const t = timeline.current
    if (!t) return
    const line = window.innerHeight * LINE - t.getBoundingClientRect().top
    for (const leg of legs.current) {
      const f = animate.current ? gsap.utils.clamp(0, 1, (line - leg.from) / Math.max(1, leg.to - leg.from)) : 1
      leg.path.style.strokeDashoffset = (leg.length * (1 - f)).toFixed(1)
    }
  }, [])

  /** Refaz o caminho já e mede a rolagem de novo no quadro seguinte. */
  const pending = useRef(0)
  const remeasure = useCallback(() => {
    if (!timeline.current || !route.current) return
    legs.current = buildRoute(timeline.current, route.current)
    draw()
    cancelAnimationFrame(pending.current)
    pending.current = requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [draw])

  // A história abre ou a tela muda de tamanho: o caminho é refeito no próprio aviso do ResizeObserver (J68).
  useLayoutEffect(() => {
    const t = timeline.current
    if (!t) return
    const ro = new ResizeObserver(remeasure)
    ro.observe(t)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(pending.current)
    }
  }, [remeasure])

  // O filtro mudou: o caminho sobre as paradas à vista, antes da pintura.
  useLayoutEffect(remeasure, [visible, remeasure])

  // A rolagem: a barra, a vida e o marco em leitura (o último à vista que já passou da linha) e o caminho.
  useLayoutEffect(() => {
    const update = (self: ScrollTrigger) => {
      if (bar.current) bar.current.style.transform = `scaleX(${self.progress.toFixed(4)})`
      const read = visibleMarks(timeline.current).filter(aboveLine)
      setLife(read.filter((el) => el.dataset.scope).at(-1)?.dataset.scope)
      setMark(read.at(-1)?.id)
      draw()
    }
    const st = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: update })
    return () => {
      st.kill()
    }
  }, [draw])

  // Com movimento liberado: o caminho se desenha na rolagem e os marcos abaixo da tela ao abrir entram quando chegam.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      animate.current = true
      draw()
      const below = visibleMarks(timeline.current).filter((el) => el.getBoundingClientRect().top > window.innerHeight)
      setReveal(new Map(below.map((el) => [el.id, false])))
      for (const el of below) {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            setReveal((m) => new Map(m).set(el.id, true))
          },
        })
      }
      return () => {
        animate.current = false
        draw()
        setReveal(new Map())
      }
    })
    return () => {
      mm.revert()
    }
  }, [draw])

  // A vida em leitura dá a cor dela ao <body> (brilho, barra, cabeçalho e índice).
  useLayoutEffect(() => {
    if (!life) return
    document.body.classList.add(`life-${life}`)
    return () => {
      document.body.classList.remove(`life-${life}`)
    }
  }, [life])

  return { timeline, route, bar, life, mark, reveal }
}
