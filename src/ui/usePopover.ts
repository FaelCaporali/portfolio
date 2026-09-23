import { useCallback, useId, useRef, useState } from 'react'
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

  const triggerProps = {
    ref: trigger,
    type: 'button' as const,
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: () => {
      setOpen((o) => !o)
    },
  }

  return { open, close, root, panelId, triggerProps }
}
