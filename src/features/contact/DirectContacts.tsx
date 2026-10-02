import { directContacts } from '../../content/profile'
import { useMessages } from '../../i18n/lang'

/** E-mail e WhatsApp como links, abaixo do formulário: o caminho que sempre funciona. */
export function DirectContacts() {
  const { direct } = useMessages().contact
  return (
    <div className="mt-4 border-t border-fg/10 pt-4">
      <p className="text-xs text-fg/50">{direct}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {directContacts.map((c) => (
          <li key={c.label}>
            <a
              href={c.href}
              target={c.href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="text-fg/80 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
            >
              <span className="text-fg/45">{c.label}:</span> {c.value}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
