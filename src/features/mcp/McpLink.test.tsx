import { act, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lang } from '../../../shared/i18n'
import { mcp } from '../../content/mcp'
import { LangContext } from '../../i18n/lang'
import { McpLink } from './McpLink'

/** O ícone como a home monta (routes/home.tsx), no endereço do idioma. */
const home = (lang: Lang) => (
  <RouterProvider
    router={createMemoryRouter(
      [
        {
          path: lang === 'pt' ? '/pt' : '/',
          element: (
            <LangContext value={lang}>
              <McpLink />
            </LangContext>
          ),
        },
      ],
      { initialEntries: [lang === 'pt' ? '/pt' : '/'] },
    )}
  />
)

afterEach(() => vi.unstubAllGlobals())

describe('ícone fixo do MCP na home (D-MCP14/17/18)', () => {
  it.each(['en', 'pt'] as const)('sai no HTML do build em %s: link para a /mcp do idioma, pílula aberta', (lang) => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(home(lang))
    // O nome acessível é o rótulo inteiro, o mesmo texto da pílula (WCAG 2.5.3); a seta e o logo são decorativos.
    const link = within(container).getByRole('link', { name: mcp.fab[lang] })
    expect(link).toHaveAttribute('href', lang === 'pt' ? '/pt/mcp' : '/mcp')
    expect(link).not.toHaveAttribute('data-compact')
    expect(link.querySelector('[aria-hidden]')?.textContent).toBe(`${mcp.fab[lang]} →`)
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden')
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('recolhe quando menos da metade da primeira tela está à vista e reabre ao voltar', () => {
    const vistos: ((entries: { intersectionRatio: number }[]) => void)[] = []
    const opcoes: (IntersectionObserverInit | undefined)[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { intersectionRatio: number }[]) => void, options?: IntersectionObserverInit) {
          vistos.push(cb)
          opcoes.push(options)
        }
        observe() {}
        disconnect() {}
      },
    )
    render(home('en'))
    const link = screen.getByRole('link', { name: mcp.fab.en })
    expect(opcoes).toEqual([{ threshold: 0.5 }])
    const visto = (intersectionRatio: number) => {
      act(() => {
        for (const cb of vistos) cb([{ intersectionRatio }])
      })
    }
    visto(0.49)
    expect(link).toHaveAttribute('data-compact')
    // Ainda na tela, mas abaixo da metade: segue recolhido (isIntersecting seria true aqui).
    visto(0.1)
    expect(link).toHaveAttribute('data-compact')
    visto(0.5)
    expect(link).not.toHaveAttribute('data-compact')
  })
})
