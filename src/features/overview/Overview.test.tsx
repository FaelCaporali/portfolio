import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Lang } from '../../../shared/i18n'
import { overview } from '../../content/overview'
import { LangContext } from '../../i18n/lang'
import { ContactWidget } from '../contact/ContactWidget'
import { Overview } from './Overview'

// Turnstile de mentira: o formulário do widget abre sem rede.
vi.mock('../contact/turnstile', () => ({
  SITEKEY: 'sitekey-de-teste',
  loadTurnstile: () => Promise.resolve({ render: () => 'widget-1', reset: vi.fn(), remove: vi.fn() }),
}))

/** A home abaixo do herói, como a rota monta (routes/home.tsx): a região e o contato flutuante. */
const pagina = (lang: Lang) => (
  <RouterProvider
    router={createMemoryRouter([
      {
        path: '/',
        element: (
          <LangContext value={lang}>
            <Overview />
            <ContactWidget />
          </LangContext>
        ),
      },
    ])}
  />
)

describe('conteúdo objetivo abaixo do herói (05-contrato O1; 08-contrato-v2 C1)', () => {
  it.each(['en', 'pt'] as const)('sai no HTML do build em %s: títulos, ofertas, perguntas com a resposta', (lang) => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(pagina(lang))
    const region = container.querySelector('#overview')
    if (!(region instanceof HTMLElement)) throw new Error('sem #overview')
    const r = within(region)
    // Nenhum h1 (o do herói é o único) e os cinco títulos de seção, na ordem do contrato (sem formação: R5).
    expect(r.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
    expect(r.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      overview.offers.title[lang],
      overview.experience.title[lang],
      overview.stack.title[lang],
      overview.faq.title[lang],
      overview.closing.title[lang],
    ])
    for (const o of overview.offers.items)
      expect(r.getByRole('heading', { level: 3, name: o.title[lang] })).toBeTruthy()
    // A resposta das perguntas está no HTML (details nativo), mesmo fechada.
    for (const q of overview.faq.items) expect(region.textContent).toContain(q.a[lang])
    expect(region.querySelectorAll('details')).toHaveLength(overview.faq.items.length)
    // "and many more" no HTML: fecha as provas de cada oferta e cada grupo da stack; a rota do que entreguei termina em
    // "Read the full story", sem ele (11-contrato-v3, A4).
    const more = r.getAllByRole('link', { name: overview.more.label[lang] })
    expect(more).toHaveLength(overview.offers.items.length + overview.stack.groups.length)
    for (const a of more) {
      expect(a).toHaveAttribute('href', lang === 'pt' ? '/pt/journey' : '/journey')
      expect(a.textContent).toContain(overview.more.text[lang])
    }
    const rota = region.querySelector('section[aria-labelledby="experience-title"]')
    if (!(rota instanceof HTMLElement)) throw new Error('sem a rota')
    expect(within(rota).queryAllByRole('link', { name: overview.more.label[lang] })).toHaveLength(0)
    // As etiquetas no idioma da página (A9): em português, nenhuma sobra em inglês.
    if (lang === 'pt')
      for (const t of ['RAG and embeddings', 'Tech leadership', 'Evals']) expect(region.textContent).not.toContain(t)
  })

  it('links das provas e da história chegam ao marco da trajetória no idioma da página', () => {
    render(pagina('pt'))
    const [principal, , mpc] = overview.offers.items[0]?.proof ?? []
    if (!principal || !mpc) throw new Error('oferta de IA sem as provas')
    // A prova principal (R8) leva ao próprio marco; mpc é o marco em que a vida "ai" começa: na trajetória ele tem o
    // id da vida.
    const link = (text: string) => screen.getByRole('link', { name: (name) => name.startsWith(text) })
    expect(link(principal.pt)).toHaveAttribute('href', '/pt/journey#previa')
    expect(link(mpc.pt)).toHaveAttribute('href', '/pt/journey#ai')
    const historias = screen.getAllByRole('link', { name: /^A história/ })
    expect(historias).toHaveLength(overview.experience.items.length)
    expect(historias[0]).toHaveAccessibleDescription(overview.experience.items[0]?.context.pt ?? '')
    expect(screen.getByRole('link', { name: /^Ler a história completa/ })).toHaveAttribute(
      'href',
      '/pt/journey#prologue',
    )
  })

  it('cada CTA da região abre o MESMO formulário do botão flutuante e, com Esc, devolve o foco a ele', async () => {
    const user = userEvent.setup()
    render(pagina('en'))
    // O primário do cabeçalho das ofertas, o secundário de cada oferta e o primário do fechamento (10 §4.2), cada um
    // com o seu rótulo (Fael, 01/10: "textos mais variados com o mesmo sentido").
    const ctas = [...document.querySelectorAll<HTMLButtonElement>('#overview button[aria-haspopup="dialog"]')]
    const { offers, closing } = overview
    expect(ctas.map((b) => b.textContent.replace('→', '').trim())).toEqual([
      offers.action.en,
      ...offers.items.map((o) => o.action.en),
      closing.action.en,
    ])
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('aria-expanded', 'false')
      await user.click(cta)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeVisible()
      expect(cta).toHaveAttribute('aria-expanded', 'true')
      expect(cta).toHaveAttribute('aria-controls', dialog.id)
      expect(within(dialog).getByLabelText('Name')).toHaveFocus()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).toBeNull()
      // O foco volta a quem abriu, não ao "Contact me" (11-contrato-v3, a).
      expect(cta).toHaveFocus()
    }
    // Os secundários levam o título da oferta como descrição e como assunto do formulário; os primários, sem assunto.
    expect(ctas[1]).toHaveAccessibleDescription(offers.items[0]?.title.en ?? '')
    await user.click(ctas[4] as HTMLButtonElement)
    expect(within(screen.getByRole('dialog')).getByText(offers.items[3]?.title.en ?? '')).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(ctas[0] as HTMLButtonElement)
    expect(within(screen.getByRole('dialog')).queryByText(/^About:/)).toBeNull()
    await user.keyboard('{Escape}')
    // Um formulário só na página.
    expect(document.querySelectorAll('form')).toHaveLength(1)
    const contato = screen.getByRole('button', { name: 'Contact me' })
    expect(contato).toHaveAttribute('aria-expanded', 'false')
    // Aberto pelo próprio botão, o foco volta a ele.
    await user.click(contato)
    await user.keyboard('{Escape}')
    expect(contato).toHaveFocus()
  })
})
