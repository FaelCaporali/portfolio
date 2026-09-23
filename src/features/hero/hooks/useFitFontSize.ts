/* eslint-disable @eslint-react/set-state-in-effect -- medir o DOM e guardar o tamanho é o uso do layout effect */
import { useLayoutEffect, useState, type RefObject } from 'react'
import { fitFontSize } from '../model/fit'

/** Largura do texto em ems, medida num span fora da tela com a fonte, o peso e o espaçamento do elemento. */
function widestRatio(el: HTMLElement, texts: readonly string[]) {
  const cs = getComputedStyle(el)
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:100px;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};letter-spacing:${parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) || 0}em`
  document.body.appendChild(probe)
  let widest = 0
  for (const t of texts) {
    probe.textContent = t
    widest = Math.max(widest, probe.getBoundingClientRect().width / 100)
  }
  probe.remove()
  return widest
}

/**
 * Enquanto `query` casa (ex.: layout largo), devolve o maior tamanho de fonte, até o do CSS, em que o texto mais longo
 * da lista cabe numa linha do elemento. A fonte é a do sistema de quem visita, e a largura muda de um sistema para
 * outro; por isso a medida é feita no navegador, e refeita quando o elemento muda de largura ou a fonte carrega.
 */
export function useFitFontSize(ref: RefObject<HTMLElement | null>, texts: readonly string[], query: string) {
  const [size, setSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const media = window.matchMedia(query)
    const measure = () => {
      if (!media.matches) {
        setSize(null)
        return
      }
      const inline = el.style.fontSize
      el.style.fontSize = '' // o teto é o tamanho do CSS, sem o ajuste anterior
      const max = parseFloat(getComputedStyle(el).fontSize)
      const ratio = widestRatio(el, texts)
      el.style.fontSize = inline
      setSize(fitFontSize(el.clientWidth, ratio, max))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    media.addEventListener('change', measure)
    void document.fonts.ready.then(measure)
    measure()
    return () => {
      ro.disconnect()
      media.removeEventListener('change', measure)
    }
  }, [ref, texts, query])

  return size
}
