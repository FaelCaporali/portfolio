import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useHydrated } from '../lib/useHydrated'
import { backToClose } from './backToClose'
import { useDismiss } from './useDismiss'

/**
 * Botão que abre um painel (menu, formulário): estado, ids ARIA, fecha com Esc ou clique fora e devolve o foco ao
 * botão quando o foco estava dentro do painel. `root` envolve botão e painel; `trigger` vai no botão.
 */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  /** Quem abriu de fora do botão: recebe o foco de volta ao fechar (sem ele, o próprio botão). */
  const opener = useRef<HTMLElement | null>(null)
  /** Abre de fora do botão (o contato pedido pela home, contactRequest.ts). */
  const show = useCallback((from?: HTMLElement) => {
    opener.current = from ?? null
    setOpen(true)
  }, [])
  const close = useCallback(() => {
    if (root.current?.contains(document.activeElement)) (opener.current ?? trigger.current)?.focus()
    opener.current = null
    setOpen(false)
  }, [])
  useDismiss(open, close, root)

  // Botão voltar (J85): com o painel aberto, fecha o teclado, depois o painel, e só então navega.
  const back = useRef<ReturnType<typeof backToClose>>(null)
  useEffect(() => {
    const b = backToClose(close)
    back.current = b
    return () => {
      b.dispose()
    }
  }, [close])
  useEffect(() => {
    if (open) back.current?.opened()
    else back.current?.closed()
  }, [open])
  /** Fecha indo a `url` na mesma página (escolher um item do índice): a entrada do painel vira a do destino. */
  const closeTo = useCallback(
    (url: string) => {
      back.current?.closedTo(url)
      close()
    },
    [close],
  )

  // A página sai pronta do build: até a hidratação o botão existe mas não abre nada. Desligado até lá, o clique não se
  // perde em silêncio.
  const hydrated = useHydrated()
  const triggerProps = {
    ref: trigger,
    type: 'button' as const,
    disabled: !hydrated,
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: () => {
      opener.current = null
      setOpen((o) => !o)
    },
  }

  return { open, show, close, closeTo, root, panelId, triggerProps }
}
