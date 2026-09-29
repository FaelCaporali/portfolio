import { useSyncExternalStore } from 'react'

const noSubscribe = () => () => undefined

/**
 * Falso no build (as páginas saem pré-renderizadas, react-router.config.ts) e durante a hidratação, para o primeiro
 * render do navegador ser igual ao HTML; verdadeiro logo depois (o React renderiza de novo) e em toda navegação
 * feita já no navegador.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )
}
