import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ContactWidget } from '../contact/ContactWidget'

/**
 * O mesmo contato do herói (J83): o ContactWidget, com o formulário que envia pelo Worker e o e-mail e o WhatsApp
 * embaixo, montado no #contact que JourneyPage deixa no HTML. Nada reimplementado.
 */
export function mountContact() {
  const el = document.getElementById('contact')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <ContactWidget />
    </StrictMode>,
  )
}
