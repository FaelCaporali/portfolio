import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Outlet, createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NavigationProgress } from './NavigationProgress'

describe('barra da troca de página (U2)', () => {
  it('acende no clique enquanto a página nova carrega e apaga quando ela está na tela', async () => {
    let chegar: (() => void) | undefined
    const router = createMemoryRouter([
      {
        // Como a raiz (root.tsx): a barra fica acima das páginas.
        element: (
          <>
            <NavigationProgress />
            <Outlet />
          </>
        ),
        children: [
          { path: '/', element: <Link to="/journey">See the full journey</Link> },
          {
            path: '/journey',
            loader: () =>
              new Promise<null>((resolve) => {
                chegar = () => {
                  resolve(null)
                }
              }),
            element: <p>trajetória</p>,
          },
        ],
      },
    ])
    const { container } = render(<RouterProvider router={router} />)
    const barra = container.querySelector('.nav-progress')
    expect(barra).not.toHaveClass('is-busy')
    expect(barra).toHaveAttribute('aria-hidden', 'true')

    await userEvent.click(screen.getByRole('link', { name: 'See the full journey' }))
    expect(container.querySelector('.nav-progress')).toHaveClass('is-busy')
    expect(screen.queryByText('trajetória')).not.toBeInTheDocument()

    await act(async () => {
      chegar?.()
      await Promise.resolve()
    })
    expect(await screen.findByText('trajetória')).toBeInTheDocument()
    expect(container.querySelector('.nav-progress')).not.toHaveClass('is-busy')
  })
})
