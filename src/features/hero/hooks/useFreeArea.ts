import { useLayoutEffect, useState, type RefObject } from 'react'

/** [topo, base] em pixels do espaço livre entre o header e o texto: o enquadramento do busto no celular segue ele. */
export function useFreeArea(header: RefObject<HTMLElement | null>, text: RefObject<HTMLElement | null>) {
  const [free, setFree] = useState<readonly [number, number]>([0, 0])

  useLayoutEffect(() => {
    const hd = header.current
    const el = text.current
    if (!hd || !el) return
    const measure = () => {
      // Medir o DOM e guardar o resultado é o uso próprio do layout effect (antes da pintura, sem piscar).
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setFree((f) => {
        const top = hd.offsetTop + hd.offsetHeight
        const bottom = el.offsetTop
        return f[0] === top && f[1] === bottom ? f : [top, bottom]
      })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(hd)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [header, text])

  return free
}
