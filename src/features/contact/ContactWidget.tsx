import { useMessages } from '../../i18n/lang'
import { usePopover } from '../../ui/usePopover'
import { ContactForm } from './ContactForm'
import { DirectContacts } from './DirectContacts'

/**
 * Contato flutuante, em todas as páginas: formulário que envia direto (Worker → fael@caporali.dev) e, abaixo, e-mail e
 * WhatsApp à vista. Sempre no canto inferior direito, abrindo para cima. Celular: botão redondo só com o balão de
 * conversa, na zona do polegar, acima da margem de segurança do iPhone (o nome "Contact me" continua para leitor de
 * tela); 56 px, ou 48 px até 360 px de largura, onde encostava na linha de contato. Largo: pílula com ícone e texto.
 */
export function ContactWidget() {
  const { open, root, panelId, triggerProps } = usePopover()
  const titleId = `${panelId}-title`
  const t = useMessages().contact

  return (
    <div
      ref={root}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-float sm:right-8 lg:right-8 lg:bottom-8"
    >
      <button
        {...triggerProps}
        className="contact-cta flex h-12 w-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent bg-raised/90 text-sm font-medium text-fg shadow-lg backdrop-blur-md transition-colors hover:bg-fg/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg min-[361px]:h-14 min-[361px]:w-14 lg:h-auto lg:w-auto lg:bg-fg/10 lg:px-5 lg:py-3"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5 min-[361px]:h-6 min-[361px]:w-6 lg:h-5 lg:w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
        </svg>
        <span className="sr-only lg:not-sr-only">{t.open}</span>
      </button>

      <section
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        className="absolute right-0 bottom-full mb-2 max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-fg/15 bg-raised/95 p-5 text-fg shadow-2xl backdrop-blur lg:max-h-[calc(100dvh-7rem)] lg:w-[22rem]"
      >
        <h2 id={titleId} className="text-base font-semibold">
          {t.title}
        </h2>
        <ContactForm active={open} />
        <DirectContacts />
      </section>
    </div>
  )
}
