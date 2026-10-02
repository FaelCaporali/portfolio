import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { OPENING, stages } from '../../content/journey'
import { Hero } from './Hero'

// A cena 3D de mentira: um botão que dá o 1º quadro com o busto (onScene, a marca 'cena' do Bust.tsx) e outro que a
// derruba depois; com `quebra`, o erro já no 1º render (a SceneBoundary tira a cena e avisa o herói).
const cena = vi.hoisted(() => ({ quebra: false }))
vi.mock('./scene/HeroCanvas', async () => {
  const { createElement, Fragment, useState } = await import('react')
  return {
    HeroCanvas: ({ onScene, paused }: { onScene: () => void; paused: boolean }) => {
      const [caiu, setCaiu] = useState(false)
      if (cena.quebra || caiu) throw new Error('a cena quebrou')
      return createElement(
        Fragment,
        null,
        createElement('button', { type: 'button', onClick: onScene, 'data-paused': String(paused) }, 'cena pronta'),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              setCaiu(true)
            },
          },
          'cena cai',
        ),
      )
    },
  }
})

// Sonda de verdade (WebGL, document.createElement('canvas')) não existe no jsdom: mockada em `true` para o suite
// seguir exercitando a <HeroCanvas> mockada acima, como sempre fez (a sonda em si: model/acceleration.test.ts).
vi.mock('./model/acceleration', () => ({ hasAcceleration: () => true }))

const abertura = stages.find((s) => s.id === OPENING)
if (!abertura) throw new Error('vida de abertura fora da lista')
const VIDA = new RegExp(`^Today I am an? ${abertura.slot}$`)
const LOADING = 'Today I am loading'

const rotas = () => [
  { path: '/', element: <Hero /> },
  { path: '/journey', element: <p>trajetória</p> },
]
// A frase da vida é o h2 do herói; o h1 é o nome (Hero.tsx).
const titulo = () => screen.getByRole('heading', { level: 2 })
const indicador = () => within(screen.getByRole('navigation', { name: 'Timeline' }))
const atuais = () => indicador().queryAllByRole('button', { current: 'step' })

beforeAll(() => {
  // O que o jsdom não tem e o herói usa na montagem (layout largo, medidas, fontes).
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
  cena.quebra = false
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('herói: "Today I am loading" até a cena 3D (U2)', () => {
  it('o HTML do build traz a vida de abertura como texto, o "loading" só pelo CSS, e a hidratação bate', async () => {
    const html = renderToString(<RouterProvider router={createMemoryRouter(rotas())} />)
    const container = document.createElement('div')
    container.innerHTML = html
    // O texto do h2 sem as marcas: a frase que buscadores, IAs e quem navega sem JavaScript recebem (D-SEO7); o
    // "loading" da tela vem do CSS (data-com-js), sem texto. O h1 é o nome.
    expect(container.querySelector('h2')?.textContent).toMatch(VIDA)
    expect(html).not.toContain('>loading<')
    expect([...container.querySelectorAll('[data-com-js]')].map((e) => e.getAttribute('data-com-js'))).toEqual([
      'Today I am',
      'loading',
    ])
    expect(container.querySelector('h1')?.textContent).toBe('Fael Caporali')
    expect(html).not.toContain('aria-current')

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onRecoverableError = vi.fn()
    document.body.appendChild(container)
    await act(async () => {
      hydrateRoot(container, <RouterProvider router={createMemoryRouter(rotas())} />, { onRecoverableError })
      await Promise.resolve()
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(within(container).getByRole('heading', { level: 2 })).toHaveAccessibleName(LOADING)
    container.remove()
  })

  it('segue "loading", sem ponto atual no indicador, até o 1º quadro da cena; então entra a vida de abertura', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    const pronta = await screen.findByRole('button', { name: 'cena pronta' })
    expect(titulo()).toHaveAccessibleName(LOADING)
    // A vida em cena (as amostras escondidas da medida, data-medida, também são .slot-word).
    expect(document.querySelector('[data-vida-texto] .slot-word')).toBeNull()
    expect(atuais()).toHaveLength(0)

    await user.click(pronta)
    expect(titulo()).toHaveAccessibleName(VIDA)
    expect(document.querySelector('.loading-word')).toBeNull()
    expect(atuais().map((b) => b.getAttribute('aria-label'))).toEqual([abertura.slot])
  })

  it('a escolha feita no indicador durante o "loading" vale: só ela aparece marcada', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    await screen.findByRole('button', { name: 'cena pronta' })
    const outra = stages.find((s) => s.id !== OPENING)
    if (!outra) throw new Error('uma vida só')
    await user.click(indicador().getByRole('button', { name: outra.slot }))
    expect(atuais().map((b) => b.getAttribute('aria-label'))).toEqual([outra.slot])
    expect(titulo()).toHaveAccessibleName(LOADING)
  })

  it('cena que cai sai do "loading" na hora, para a vida de abertura', async () => {
    cena.quebra = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    expect(await screen.findByRole('heading', { level: 2, name: VIDA })).toBeInTheDocument()
    expect(atuais().map((b) => b.getAttribute('aria-label'))).toEqual([abertura.slot])
  })

  it('escolha feita no "loading" e a cena que cai depois: o texto vai para a escolhida, junto do ponto', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    await screen.findByRole('button', { name: 'cena cai' })
    const outra = stages.find((s) => s.id !== OPENING)
    if (!outra) throw new Error('uma vida só')
    await user.click(indicador().getByRole('button', { name: outra.slot }))
    await user.click(screen.getByRole('button', { name: 'cena cai' }))
    expect(titulo()).toHaveAccessibleName(new RegExp(`^(Today I am|Yesterday I was) an? ${outra.slot}$`))
    expect(atuais().map((b) => b.getAttribute('aria-label'))).toEqual([outra.slot])
  })

  it('sem prazo (D-U2a): a cena que demora deixa o "loading" até o busto chegar, e aí troca', async () => {
    vi.useFakeTimers()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('button', { name: 'cena pronta' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(titulo()).toHaveAccessibleName(LOADING)
    fireEvent.click(screen.getByRole('button', { name: 'cena pronta' }))
    expect(titulo()).toHaveAccessibleName(VIDA)
    expect(atuais().map((b) => b.getAttribute('aria-label'))).toEqual([abertura.slot])
  })

  it('a volta da trajetória para o herói mostra "loading" de novo até a cena', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(rotas())
    render(<RouterProvider router={router} />)
    await user.click(await screen.findByRole('button', { name: 'cena pronta' }))
    expect(titulo()).toHaveAccessibleName(VIDA)
    await act(() => router.navigate('/journey'))
    await act(() => router.navigate('/'))
    expect(titulo()).toHaveAccessibleName(LOADING)
    await user.click(await screen.findByRole('button', { name: 'cena pronta' }))
    expect(titulo()).toHaveAccessibleName(VIDA)
  })

  it('com aceleração de GPU, nenhuma imagem /hero-bot nem /hero-fallback é pedida: zero mudança do caminho de hoje', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    await user.click(await screen.findByRole('button', { name: 'cena pronta' }))
    expect(document.querySelector('img[src^="/hero-bot/"]')).toBeNull()
    expect(document.querySelector('[src^="/hero-fallback/"], [srcset^="/hero-fallback/"]')).toBeNull()
  })
})

describe('conteúdo abaixo do herói (05-contrato O2, O3; 08-contrato-v2 C1)', () => {
  it('o CTA "Cut the BS" é uma âncora para #overview, também no HTML do build', () => {
    const html = renderToString(<RouterProvider router={createMemoryRouter(rotas())} />)
    const container = document.createElement('div')
    container.innerHTML = html
    const cut = within(container).getByRole('link', { name: /^Cut the BS/ })
    expect(cut).toHaveAttribute('href', '#overview')
    // A ordem do DOM é a da tela no largo (trajetória → Cut), e o Tab segue a visual; no celular o Cut fica ao lado,
    // à direita dos títulos (11-contrato-v3, revisão: inverter por CSS order trocava o Tab no largo).
    const journey = within(container).getByRole('link', { name: /^See the full journey/ })
    expect(journey.compareDocumentPosition(cut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a cena para quando o herói sai da vista e volta ao entrar, sem novo "loading" e sem trocar a vida', async () => {
    const vistos: ((entries: { isIntersecting: boolean }[]) => void)[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          vistos.push(cb)
        }
        observe() {}
        disconnect() {}
      },
    )
    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(rotas())} />)
    const cena = await screen.findByRole('button', { name: 'cena pronta' })
    await user.click(cena)
    expect(cena).toHaveAttribute('data-paused', 'false')
    const visto = (isIntersecting: boolean) => {
      act(() => {
        for (const cb of vistos) cb([{ isIntersecting }])
      })
    }
    visto(false)
    expect(cena).toHaveAttribute('data-paused', 'true')
    expect(titulo()).toHaveAccessibleName(VIDA)
    visto(true)
    expect(cena).toHaveAttribute('data-paused', 'false')
    expect(titulo()).toHaveAccessibleName(VIDA)
    vi.stubGlobal('IntersectionObserver', undefined)
  })
})
