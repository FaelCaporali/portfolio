import { usePopover } from '../../ui/usePopover'
import { ContactForm } from './ContactForm'
import { DirectContacts } from './DirectContacts'

/**
 * Contato flutuante, em todas as páginas: formulário que envia direto (Worker → fael@caporali.dev) e, abaixo, e-mail e
 * WhatsApp à vista. Sempre no canto inferior direito, abrindo para cima. Celular: botão redondo de 56 px só com o
 * balão de conversa, na zona do polegar, acima da margem de segurança do iPhone (o nome "Contact me" continua para
 * leitor de tela). Largo: pílula com ícone e texto.
 */
export function ContactWidget() {
  const { open, root, panelId, triggerProps } = usePopover()
  const titleId = `${panelId}-title`

  return (
    <div
      ref={root}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 sm:right-8 lg:right-8 lg:bottom-8"
    >
      <button
        {...triggerProps}
        className="flex h-14 w-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/25 bg-[#16161b]/90 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-auto lg:w-auto lg:bg-white/10 lg:px-5 lg:py-3"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-6 w-6 lg:h-5 lg:w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
        </svg>
        <span className="sr-only lg:not-sr-only">Contact me</span>
      </button>

      <section
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        className="absolute right-0 bottom-full mb-2 max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#16161b]/95 p-5 text-white shadow-2xl backdrop-blur lg:max-h-[calc(100dvh-7rem)] lg:w-[22rem]"
      >
        <h2 id={titleId} className="text-base font-semibold">
          Send me a message
        </h2>
        <ContactForm active={open} />
        <DirectContacts />
      </section>
    </div>
  )
}
