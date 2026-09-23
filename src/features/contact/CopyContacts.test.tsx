import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyContacts } from './CopyContacts'

describe('copiar contatos', () => {
  it('copia o telefone pronto para colar e confirma', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<CopyContacts />)
    await user.click(screen.getByRole('button', { name: '+55 31 99196-2016' }))
    expect(write).toHaveBeenCalledWith('+55 31 99196-2016')
    expect(await screen.findByText('Phone copied')).toBeInTheDocument()
  })
  it('navegador recusou: sugere selecionar o texto', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'))
    render(<CopyContacts />)
    await user.click(screen.getByRole('button', { name: 'fael@caporali.dev' }))
    expect(await screen.findByText('Copy failed. Select the text instead.')).toBeInTheDocument()
  })
})
