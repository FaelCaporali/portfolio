import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LangContext } from '../../i18n/lang'
import { ContactWidget } from './ContactWidget'

// Turnstile de mentira que guarda as opções do widget: o idioma do desafio é o da página.
const turnstile = vi.hoisted(() => ({ language: '' }))
vi.mock('./turnstile', () => ({
  SITEKEY: 'sitekey-de-teste',
  loadTurnstile: () =>
    Promise.resolve({
      render: (_el: HTMLElement, options: { language: string; callback: (t: string) => void }) => {
        turnstile.language = options.language
        options.callback('tok-1')
        return 'widget-1'
      },
      reset: vi.fn(),
      remove: vi.fn(),
    }),
}))

describe('contato em português', () => {
  it('rótulos, dicas e a verificação humana no idioma da página', async () => {
    const user = userEvent.setup()
    render(
      <LangContext value="pt">
        <ContactWidget />
      </LangContext>,
    )
    await user.click(screen.getByRole('button', { name: 'Fale comigo' }))
    expect(screen.getByRole('dialog', { name: 'Mande uma mensagem' })).toBeVisible()
    expect(screen.getByLabelText('Nome')).toHaveFocus()
    await user.click(await screen.findByRole('button', { name: 'Enviar' }))
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Informe seu nome.')
    expect(screen.getByLabelText('E-mail ou WhatsApp, para eu responder')).toHaveAccessibleDescription(
      'Informe um e-mail ou um telefone.',
    )
    expect(screen.getByLabelText('Mensagem')).toHaveAccessibleDescription('Escreva pelo menos 10 caracteres.')
    expect(screen.getByText('Ou fale comigo direto')).toBeInTheDocument()
    expect(turnstile.language).toBe('pt-br')
  })
})
