import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ResumeMenu } from './ResumeMenu'

describe('menu do currículo', () => {
  it('abre com os PDFs e fecha com clique fora', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ResumeMenu className="" />
        <p>fora</p>
      </>,
    )
    const trigger = screen.getByRole('button', { name: /Résumé/ })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Português/ })).toHaveAttribute('href', '/cv/fael-caporali-cv-pt.pdf')
    await user.click(screen.getByText('fora'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /Português/ })).not.toBeInTheDocument()
  })
})
