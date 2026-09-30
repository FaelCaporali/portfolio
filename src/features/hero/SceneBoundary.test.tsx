import { act, render, screen, waitFor } from '@testing-library/react'
import { Suspense, lazy } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneBoundary } from './SceneBoundary'

const boom = new Error('a cena quebrou')
function Thrower(): never {
  throw boom
}

/** A página do herói em miniatura: a cena dentro da fronteira e o texto fora dela. */
function Page({ scene, onFail }: { scene: React.ReactNode; onFail?: () => void }) {
  return (
    <section>
      <SceneBoundary onFail={onFail}>{scene}</SceneBoundary>
      <h1>Today I am a</h1>
    </section>
  )
}

describe('fronteira de erro da cena 3D', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem erro, a cena aparece e nada é registrado', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Page scene={<canvas data-testid="cena" />} />)
    expect(screen.getByTestId('cena')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Today I am a' })).toBeInTheDocument()
    expect(error).not.toHaveBeenCalled()
  })

  it('o filho que lança some sozinho; o resto da página fica e o erro vai para o console', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onFail = vi.fn()
    const { container } = render(<Page scene={<Thrower />} onFail={onFail} />)
    expect(onFail).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Today I am a' })).toBeInTheDocument()
    expect(container.querySelector('section')?.childElementCount).toBe(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cena 3D falhou'), boom, expect.any(String))
  })

  it('o import da cena que falha (lazy dentro do Suspense) também só tira a cena', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const chunk = new Error('Failed to fetch dynamically imported module')
    const Broken = lazy(() => Promise.reject(chunk))
    render(
      <Page
        scene={
          <Suspense fallback={null}>
            <Broken />
          </Suspense>
        }
      />,
    )
    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining('cena 3D falhou'), chunk, expect.any(String))
    })
    expect(screen.getByRole('heading', { name: 'Today I am a' })).toBeInTheDocument()
  })

  it('o WebGL que não nasce (rejeição solta) derruba só a cena', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onFail = vi.fn()
    render(<Page scene={<canvas data-testid="cena" />} onFail={onFail} />)
    const webgl = new Error('Error creating WebGL context.')
    const event = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: webgl })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(screen.queryByTestId('cena')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Today I am a' })).toBeInTheDocument()
    expect(event.defaultPrevented).toBe(true)
    expect(onFail).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('WebGL'), webgl)
  })

  it('rejeição solta que não é do WebGL não mexe na cena', () => {
    render(<Page scene={<canvas data-testid="cena" />} />)
    const event = Object.assign(new Event('unhandledrejection', { cancelable: true }), {
      reason: new Error('Failed to fetch'),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(screen.getByTestId('cena')).toBeInTheDocument()
    expect(event.defaultPrevented).toBe(false)
  })
})
