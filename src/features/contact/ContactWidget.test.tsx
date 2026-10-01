import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS } from '../../../shared/contact/contract'
import { requestContact } from './contactRequest'
import { ContactWidget } from './ContactWidget'
import { FALLBACK, STILL_VERIFYING, errorText } from './texts'

// Turnstile de mentira: por padrão entrega um token assim que o widget é criado. Guarda os callbacks do widget para o
// teste entregar o token (ou a falha) depois, como o desafio de verdade na 1ª abertura.
interface WidgetCallbacks {
  callback: (token: string) => void
  'error-callback': () => void
}
const turnstile = vi.hoisted(() => {
  const state: { token: string | null; widget: WidgetCallbacks | null } = { token: 'tok-1', widget: null }
  return state
})
vi.mock('./turnstile', () => ({
  SITEKEY: 'sitekey-de-teste',
  loadTurnstile: () =>
    Promise.resolve({
      render: (_el: HTMLElement, options: WidgetCallbacks) => {
        turnstile.widget = options
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
  turnstile.widget = null
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

  it('aberto pelo CTA de uma oferta: mostra o assunto e o junta à mensagem; o mínimo vale para o texto da pessoa', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    const user = userEvent.setup()
    render(<ContactWidget />)
    const topic = 'Technical leadership and team training'
    act(() => {
      requestContact(undefined, topic)
    })
    expect(screen.getByText(topic)).toBeVisible()
    expect(screen.getByText(/^About:/)).toBeVisible()
    const prefix = `[About: ${topic}]\n\n`
    expect(screen.getByLabelText('Message')).toHaveAttribute('maxLength', String(LIMITS.message - prefix.length))
    await user.type(screen.getByLabelText('Name'), 'Maria')
    await user.type(screen.getByLabelText('E-mail or WhatsApp, so I can reply'), 'maria@example.com')
    // Curta demais: o assunto não conta para o mínimo.
    await user.type(screen.getByLabelText('Message'), 'Oi')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Message'), ', vamos falar do meu time?')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/Message received/)).toBeVisible()
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect((JSON.parse(init?.body as string) as { message: string }).message).toBe(
      `${prefix}Oi, vamos falar do meu time?`,
    )
  })

  it('texto no limite digitado antes de abrir por uma oferta: vai sem o assunto, sem o Worker recusar', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    const user = await openAndFill({ message: 'Oi' })
    const longo = 'a'.repeat(LIMITS.message - 1)
    fireEvent.input(screen.getByLabelText('Message'), { target: { value: longo } })
    await user.keyboard('{Escape}')
    act(() => {
      requestContact(undefined, 'Quality without slowing delivery')
    })
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/Message received/)).toBeVisible()
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect((JSON.parse(init?.body as string) as { message: string }).message).toBe(longo)
  })

  it('aberto depois pelo botão flutuante, o formulário esquece o assunto', async () => {
    const user = userEvent.setup()
    render(<ContactWidget />)
    act(() => {
      requestContact(undefined, 'From MVP to a product that scales')
    })
    expect(screen.getByText(/^About:/)).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Contact me' }))
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.queryByText(/^About:/)).toBeNull()
    expect(screen.getByLabelText('Message')).toHaveAttribute('maxLength', String(LIMITS.message))
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

  it('campo recusado pelo Worker volta como dica e recebe o foco', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'invalid', fields: ['contact'] }, { status: 422 }))
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    const contact = screen.getByLabelText('E-mail or WhatsApp, so I can reply')
    await waitFor(() => {
      expect(contact).toHaveAttribute('aria-invalid', 'true')
    })
    expect(contact).toHaveFocus()
  })

  it('erro de envio não tira o foco de onde a pessoa deixou', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'busy' }, { status: 429 }))
    const user = await openAndFill()
    const send = screen.getByRole('button', { name: 'Send' })
    await user.click(send)
    expect(await screen.findByText(errorText('busy'))).toBeVisible()
    expect(send).toHaveFocus()
  })

  it('"enviar outra" volta ao primeiro campo com o formulário limpo', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    const user = await openAndFill()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.click(await screen.findByRole('button', { name: 'Send another message' }))
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('sem token ainda: o botão mostra "Verifying…", ocupado, e não envia; com o token vira "Send" (U2)', async () => {
    turnstile.token = null
    const user = await openAndFill()
    const button = screen.getByRole('button', { name: 'Verifying…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(screen.getByText(STILL_VERIFYING)).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
    act(() => {
      turnstile.widget?.callback('tok-2')
    })
    expect(screen.getByRole('button', { name: 'Send' })).not.toHaveAttribute('aria-busy')
    // O aviso de "ainda verificando" sai com o token: não fica ao lado de um "Send" pronto.
    expect(screen.queryByText(STILL_VERIFYING)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verifying…' })).not.toBeInTheDocument()
  })

  it('verificação que falha: sai do "Verifying…" para "Send", com o texto de falha que já existe', async () => {
    turnstile.token = null
    const user = await openAndFill()
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeVisible()
    act(() => {
      turnstile.widget?.['error-callback']()
    })
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText(FALLBACK)).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('da 2ª abertura em diante, com o token já no widget, o botão é "Send" direto', async () => {
    const user = userEvent.setup()
    render(<ContactWidget />)
    const trigger = screen.getByRole('button', { name: 'Contact me' })
    await user.click(trigger)
    expect(await screen.findByRole('button', { name: 'Send' })).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Send' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Verifying…' })).not.toBeInTheDocument()
  })
})
