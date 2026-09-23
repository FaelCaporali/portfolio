import { usePopover } from '../../ui/usePopover'
import { ContactForm } from './ContactForm'
import { DirectContacts } from './DirectContacts'

/**
 * Contato flutuante, em todas as páginas: formulário que envia direto (Worker → fael@caporali.dev) e, abaixo, e-mail e
 * WhatsApp à vista. Largo: canto inferior direito, abre para cima. Celular: canto superior direito, abre para baixo.
 */
export function ContactWidget() {
  const { open, root, panelId, triggerProps } = usePopover()
  const titleId = `${panelId}-title`

  return (
    <div ref={root} className="fixed top-3.5 right-5 z-20 sm:right-10 lg:top-auto lg:right-8 lg:bottom-8">
      <button
        {...triggerProps}
        className="ml-auto flex cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:px-5 lg:py-3 lg:text-sm"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 lg:h-5 lg:w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
        </svg>
        Contact me
      </button>

      <section
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        className="absolute top-full right-0 mt-2 max-h-[calc(100dvh-4.5rem)] w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#16161b]/95 p-5 text-white shadow-2xl backdrop-blur lg:top-auto lg:bottom-full lg:mt-0 lg:mb-2 lg:max-h-[calc(100dvh-7rem)] lg:w-[22rem]"
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
