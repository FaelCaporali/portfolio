import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lang } from '../../../shared/i18n'
import { MCP_URL } from '../../../shared/mcp'
import { mcp } from '../../content/mcp'
import { LangContext } from '../../i18n/lang'
import { McpPage } from './McpPage'

// Turnstile de mentira: o formulário do widget flutuante não vai à rede.
vi.mock('../contact/turnstile', () => ({
  SITEKEY: 'sitekey-de-teste',
  loadTurnstile: () => Promise.resolve({ render: () => 'widget-1', reset: vi.fn(), remove: vi.fn() }),
}))

/** A página como a rota monta (routes/mcp-page.tsx), no endereço do idioma. */
const pagina = (lang: Lang) => (
  <RouterProvider
    router={createMemoryRouter(
      [
        {
          path: lang === 'pt' ? '/pt/mcp' : '/mcp',
          element: (
            <LangContext value={lang}>
              <McpPage />
            </LangContext>
          ),
        },
      ],
      { initialEntries: [lang === 'pt' ? '/pt/mcp' : '/mcp'] },
    )}
  />
)

afterEach(() => vi.restoreAllMocks())

describe('página /mcp (D-MCP15)', () => {
  it.each(['en', 'pt'] as const)('sai no HTML do build em %s: um h1, o endereço, os passos e o registro', (lang) => {
    // No documento: o nome acessível segue o aria-describedby pelo getElementById.
    const container = document.body.appendChild(document.createElement('div'))
    container.innerHTML = renderToString(pagina(lang))
    const page = within(container)
    expect(page.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([mcp.title[lang]])
    // Política de marcas da LF Projects: a forma completa na primeira menção do protocolo na página.
    const main = container.querySelector('main')?.textContent ?? ''
    expect(main.indexOf('Model Context Protocol')).toBeGreaterThanOrEqual(0)
    expect(main.indexOf('Model Context Protocol')).toBeLessThan(main.indexOf('MCP'))
    // Cada bloco de código: a área que rola tem foco e nome (Safari), e o "Copy" diz o que copia.
    for (const s of mcp.others.items) {
      const region = page.getByRole('region', { name: s.label })
      expect(region).toHaveAttribute('tabindex', '0')
      expect(region.textContent).toBe(s.code)
    }
    const ids = [...container.querySelectorAll('[id]')]
    const described = page
      .getAllByRole('button', { name: mcp.copy.code[lang] })
      .map((b) => ids.find((e) => e.id === b.getAttribute('aria-describedby'))?.textContent)
    expect(described).toEqual(mcp.others.items.map((s) => s.label))
    // O endereço inteiro, sem o hífen de "fael-caporali" quebrável, e o mesmo nos três blocos de configuração.
    const code = container.querySelector('code')
    expect(code?.textContent).toBe(MCP_URL)
    expect(code?.querySelector('.whitespace-nowrap')?.textContent).toBe('https://fael-caporali.')
    for (const s of mcp.others.items) expect(s.code).toContain(MCP_URL)
    // Cada cliente com os passos e o link da fonte oficial, numa aba nova.
    for (const c of mcp.clients.items) {
      expect(page.getByRole('heading', { level: 3, name: c.name })).toBeTruthy()
      for (const s of c.steps[lang]) expect(container.textContent).toContain(s.replaceAll('**', ''))
      const source = container.querySelector(`a[href="${c.source}"]`)
      expect(source).toHaveAttribute('target', '_blank')
      expect(source).toHaveAttribute('rel', 'noopener noreferrer')
    }
    for (const t of mcp.tools.items) expect(container.textContent).toContain(t.text[lang])
    for (const item of [...mcp.log.items, ...mcp.log.neverItems]) expect(container.textContent).toContain(item[lang])
    // A volta à home e o outro idioma, no endereço do idioma.
    expect(page.getByRole('link', { name: /Fael Caporali/ })).toHaveAttribute('href', lang === 'pt' ? '/pt' : '/')
    expect(container.querySelector('a[hreflang]')).toHaveAttribute('href', lang === 'pt' ? '/mcp' : '/pt/mcp')
    // CSP: nenhum style inline no HTML.
    expect(container.querySelector('[style]')).toBeNull()
    container.remove()
  })

  it('copiar o endereço: o texto exato vai à área de transferência e o botão confirma', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(pagina('en'))
    await userEvent.click(screen.getByRole('button', { name: mcp.copy.address.en }))
    expect(writeText).toHaveBeenCalledWith(MCP_URL)
    expect(await screen.findByRole('button', { name: mcp.copy.copied.en })).toBeTruthy()
  })

  it('cópia recusada pelo navegador: diz para selecionar o texto', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(pagina('pt'))
    await userEvent.click(screen.getByRole('button', { name: mcp.copy.address.pt }))
    expect(await screen.findAllByText(/Selecione o texto/i)).not.toHaveLength(0)
  })
})
