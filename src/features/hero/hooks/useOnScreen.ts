import { useEffect, useState, type RefObject } from 'react'

/**
 * Se o elemento tem algum pixel na tela. Verdadeiro até o navegador medir (o build e a hidratação não medem) e onde
 * não há IntersectionObserver. O herói para a cena 3D quando sai da vista (conteúdo abaixo dele, 05-contrato O3).
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      const last = entries.at(-1)
      if (last) setOnScreen(last.isIntersecting)
    })
    io.observe(el)
    return () => {
      io.disconnect()
    }
  }, [ref])
  return onScreen
}
