import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { stages } from '../../content/journey'
import { pt } from '../../i18n/messages/pt'
import LangLayout from '../../routes/lang'
import { Hero } from './Hero'

// A cena 3D de mentira, que conta quantas vezes montou: a troca de idioma não pode desmontá-la.
const cena = vi.hoisted(() => ({ montagens: 0 }))
vi.mock('./scene/HeroCanvas', async () => {
  const { createElement, useEffect } = await import('react')
  return {
    HeroCanvas: ({ onScene }: { onScene: () => void }) => {
      useEffect(() => {
        cena.montagens += 1
      }, [])
      return createElement('button', { type: 'button', onClick: onScene }, 'cena pronta')
    },
  }
})

/** As rotas do site (src/routes.ts): o idioma como segmento opcional, os mesmos ids nos dois idiomas. */
const rotas = () => [
  {
    id: 'lang',
    path: '/:lang?',
    Component: LangLayout,
    children: [
      { id: 'home', index: true, element: <Hero /> },
      { id: 'journey', path: 'journey', element: <p>trajetória</p> },
    ],
  },
]
const titulo = () => screen.getByRole('heading', { level: 2 })

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }),
  })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cena.montagens = 0
  document.cookie = 'lang=; Max-Age=0; Path=/'
})

describe('herói em português (/pt)', () => {
  it('o HTML do build sai em português: "Hoje estou carregando", títulos, botão e o controle EN', () => {
    const html = renderToString(<RouterProvider router={createMemoryRouter(rotas(), { initialEntries: ['/pt'] })} />)
    const box = document.createElement('div')
    box.innerHTML = html
    expect(box.querySelector('h2')?.textContent).toBe('Hoje estou carregando')
    expect(box.querySelector('h1')?.textContent).toBe('Fael Caporali')
    expect(within(box).getByRole('list', { name: 'Títulos' })).toHaveTextContent('Analista de QA')
    expect(within(box).getByRole('link', { name: /Ver a trajetória completa/ })).toHaveAttribute('href', '/pt/journey')
    const en = within(box).getByRole('link', { name: 'Read in English' })
    expect(en).toHaveAttribute('href', '/')
    expect(en).toHaveAttribute('hreflang', 'en')
    expect(en).toHaveTextContent('EN')
    expect(html).not.toMatch(/Today I am|See the full journey|Résumé|Contact me/)
  })

  it('com a cena, a vida sem artigo ("Hoje sou AI Product Engineer") e o indicador em português', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas(), { initialEntries: ['/pt'] })} />)
    await user.click(await screen.findByRole('button', { name: 'cena pronta' }))
    expect(titulo()).toHaveAccessibleName('Hoje sou AI Product Engineer')
    const indicador = within(screen.getByRole('navigation', { name: 'Linha do tempo' }))
    expect(indicador.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(
      stages.map((s) => pt.hero.slots[s.id]),
    )
  })

  it('PT no herói inglês: vai a /pt sem desmontar a cena, com a vida em português e a escolha salva', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(rotas(), { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    await user.click(await screen.findByRole('button', { name: 'cena pronta' }))
    expect(titulo()).toHaveAccessibleName('Today I am an AI Product Engineer')
    await user.click(screen.getByRole('link', { name: 'Ler em português' }))
    expect(router.state.location.pathname).toBe('/pt')
    expect(titulo()).toHaveAccessibleName('Hoje sou AI Product Engineer')
    expect(cena.montagens).toBe(1)
    expect(document.cookie).toContain('lang=pt')
    await act(() => router.navigate(-1))
    expect(titulo()).toHaveAccessibleName('Today I am an AI Product Engineer')
    expect(cena.montagens).toBe(1)
  })

  it('segmento que não é idioma: "Page not found"', async () => {
    render(<RouterProvider router={createMemoryRouter(rotas(), { initialEntries: ['/xx'] })} />)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'cena pronta' })).not.toBeInTheDocument()
  })
})
