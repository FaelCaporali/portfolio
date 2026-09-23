import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactWidget } from './ContactWidget'
import { FALLBACK, STILL_VERIFYING, errorText } from './texts'

// Turnstile de mentira: por padrão entrega um token assim que o widget é criado.
const turnstile = vi.hoisted(() => {
  const state: { token: string | null } = { token: 'tok-1' }
  return state
})
vi.mock('./turnstile', () => ({
  SITEKEY: 'sitekey-de-teste',
  loadTurnstile: () =>
    Promise.resolve({
      render: (_el: HTMLElement, options: { callback: (token: string) => void }) => {
        if (turnstile.token) options.callback(turnstile.token)
        return 'widget-1'
      },
      reset: vi.fn(),
      remove: vi.fn(),
    }),
}))

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  turnstile.token = 'tok-1'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

async function openAndFill(fields: { name?: string; contact?: string; message?: string } = {}) {
  const user = userEvent.setup()
  render(<ContactWidget />)
  await user.click(screen.getByRole('button', { name: 'Contact me' }))
  const values = { name: 'Maria', contact: 'maria@example.com', message: 'Vamos conversar sobre uma vaga?', ...fields }
  for (const [label, value] of [
    ['Name', values.name],
    ['E-mail or WhatsApp, so I can reply', values.contact],
    ['Message', values.message],
  ] as const) {
    if (value) await user.type(screen.getByLabelText(label), value)
  }
  return user
}

describe('widget de contato', () => {
  it('abre com o foco no nome; Esc fecha e devolve o foco ao botão', async () => {
    const user = userEvent.setup()
    render(<ContactWidget />)
    const trigger = screen.getByRole('button', { name: 'Contact me' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('valida antes de enviar: aponta cada campo e não chama a API', async () => {
    const user = await openAndFill({ name: '', contact: '', message: '' })
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Tell me your name.')
    expect(screen.getByLabelText('Message')).toHaveAccessibleDescription('Write at least 10 characters.')
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia com o token e mostra a confirmação', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/Message received/)).toBeVisible()
    // O formulário some com o botão que tinha o foco: o foco vai para "enviar outra".
    expect(screen.getByRole('button', { name: 'Send another message' })).toHaveFocus()
    const [path, init] = fetchMock.mock.calls[0] ?? []
    expect(path).toBe('/api/contact')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Maria',
      contact: 'maria@example.com',
      message: 'Vamos conversar sobre uma vaga?',
      website: '',
      token: 'tok-1',
    })
  })

  it.each([
    [
      'código conhecido',
      Response.json({ ok: false, error: 'rate_limited' }, { status: 429 }),
      errorText('rate_limited'),
    ],
    ['resposta fora do contrato', new Response('<html>', { status: 502 }), FALLBACK],
  ])('%s: mostra o texto certo', async (_, response, text) => {
    fetchMock.mockResolvedValue(response)
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(text)).toBeVisible()
  })

  it('campo recusado pelo Worker volta como dica no campo', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'invalid', fields: ['contact'] }, { status: 422 }))
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => {
      expect(screen.getByLabelText('E-mail or WhatsApp, so I can reply')).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('sem token ainda: pede um instante e não envia', async () => {
    turnstile.token = null
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText(STILL_VERIFYING)).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
