import { useCallback, useEffect, useId, useRef, useState } from 'react'
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

  const close = useCallback(() => {
    if (root.current?.contains(document.activeElement)) trigger.current?.focus()
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

  const triggerProps = {
    ref: trigger,
    type: 'button' as const,
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: () => {
      setOpen((o) => !o)
    },
  }

  return { open, close, closeTo, root, panelId, triggerProps }
}
