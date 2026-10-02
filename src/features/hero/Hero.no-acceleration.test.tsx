import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { OPENING, stages } from '../../content/journey'
import { Hero } from './Hero'
import { createLineup, peek } from './model/lineup'

// Sem aceleração de GPU real (a sonda `hasAcceleration` falha): `HeroCanvas` nunca existe (Hero.tsx, módulo), e o
// herói cai direto no estado de `sceneFailed`, sem esperar nenhum `onFail` (Capítulo 11 de 03-plano-versao-robos.md:
// "ausência de GPU não impede render 3d [...] deveria ter imagens"). Este arquivo prova o caminho da imagem; o da
// cena 3D continua em Hero.test.tsx (hasAcceleration mockada em `true`, lá).
vi.mock('./model/acceleration', () => ({ hasAcceleration: () => false }))

const opening = stages.find((s) => s.id === OPENING)
if (!opening) throw new Error('vida de abertura fora da lista')
// A vida seguinte de verdade (model/lineup.ts, "de trás para frente"): nunca suposta por posição no array.
const openingIndex = stages.findIndex((s) => s.id === OPENING)
const depoisDaAbertura = stages[peek(createLineup(stages.length, openingIndex), null)]
if (!depoisDaAbertura) throw new Error('lineup sem próxima vida')
const outra = stages.find((s) => s.id !== OPENING)
if (!outra) throw new Error('uma vida só na lista')

const rotas = () => [
  { path: '/', element: <Hero /> },
  { path: '/journey', element: <p>trajetória</p> },
]
const titulo = () => screen.getByRole('heading', { level: 2 })
const indicador = () => within(screen.getByRole('navigation', { name: 'Timeline' }))
const vidaRegex = (slot: string) => new RegExp(`^(Today I am|Yesterday I was) an? ${slot}$`)

beforeAll(() => {
  // O que o jsdom não tem e o herói usa na montagem (layout largo, medidas, fontes) — mesmo stub de Hero.test.tsx.
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
  vi.useRealTimers()
})

describe('herói sem aceleração de GPU: imagem no lugar do busto (Capítulo 11, 03-plano-versao-robos.md)', () => {
  it('mostra a imagem da vida atual desde o 1º render, nunca "loading"', () => {
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    expect(titulo()).toHaveAccessibleName(vidaRegex(opening.slot))
    expect(document.querySelector('.loading-word')).toBeNull()
    const img = screen.getByRole('img', { name: opening.slot })
    expect(img).toHaveAttribute('src', `/hero-fallback/${opening.id}-mobile.webp`)
    expect(img).not.toHaveAttribute('loading')
  })

  it('troca sozinha, na cadência do 3D (parado + desintegração + reconstrução), sem precisar de clique', async () => {
    vi.useFakeTimers()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    expect(screen.getByRole('img', { name: opening.slot })).toBeInTheDocument()
    // Abertura: 3 s parada + 1 s + 1 s de transição (TIMING); 1 ms antes, ainda é ela.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999)
    })
    expect(screen.getByRole('img', { name: opening.slot })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(titulo()).toHaveAccessibleName(vidaRegex(depoisDaAbertura.slot))
    expect(screen.getByRole('img', { name: depoisDaAbertura.slot })).toHaveAttribute(
      'src',
      `/hero-fallback/${depoisDaAbertura.id}-mobile.webp`,
    )
  })

  it('o clique no indicador troca a vida na hora, sem esperar o relógio', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    await user.click(indicador().getByRole('button', { name: outra.slot }))
    expect(titulo()).toHaveAccessibleName(vidaRegex(outra.slot))
    expect(screen.getByRole('img', { name: outra.slot })).toBeInTheDocument()
    expect(
      indicador()
        .queryAllByRole('button', { current: 'step' })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([outra.slot])
  })
})
