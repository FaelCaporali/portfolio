import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { OPENING, stages } from '../../content/journey'
import { Hero } from './Hero'

// Sem GPU real (camada 2, R1/R3): a cena nunca é importada. Se Hero.tsx chamasse loadCanvas() mesmo assim, este
// mock faria o teste quebrar (orçamento: nenhum chunk a mais sem aceleração).
vi.mock('./scene/HeroCanvas', () => {
  throw new Error('HeroCanvas não deve ser importado sem aceleração de GPU (R1, camada 2)')
})
vi.mock('./model/acceleration', () => ({ hasAcceleration: () => false }))

const abertura = stages.find((s) => s.id === OPENING)
if (!abertura) throw new Error('vida de abertura fora da lista')
const VIDA = new RegExp(`^Today I am an? ${abertura.slot}$`)

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

const rotas = () => [
  { path: '/', element: <Hero /> },
  { path: '/journey', element: <p>trajetória</p> },
]

describe('herói sem aceleração de GPU real (camada 2, R1/R3: Googlebot ou pessoa sem GPU)', () => {
  it('mostra a vida de abertura direto, sem "loading", sem <canvas> e sem importar a cena', async () => {
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    expect(await screen.findByRole('heading', { level: 2, name: VIDA })).toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeNull()
    // O indicador já marca a vida de abertura (não fica em "loading", sem ponto atual, para sempre).
    const indicador = within(screen.getByRole('navigation', { name: 'Timeline' }))
    expect(indicador.getAllByRole('button', { current: 'step' }).map((b) => b.getAttribute('aria-label'))).toEqual([
      abertura.slot,
    ])
  })
})
