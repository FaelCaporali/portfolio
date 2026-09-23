import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { chronology, stages } from '../../content/journey'
import { LifeTimeline } from './LifeTimeline'

describe('indicador das vidas', () => {
  it('mostra todas as vidas em ordem cronológica, com a atual marcada', () => {
    render(<LifeTimeline currentId="qa" onSelect={() => undefined} />)
    const buttons = screen.getAllByRole('button')
    const slot = (id: string) => stages.find((s) => s.id === id)?.slot
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(chronology.map(slot))
    expect(buttons).toHaveLength(stages.length)
    expect(screen.getByRole('button', { name: 'QA Tester' })).toHaveAttribute('aria-current', 'step')
  })
  it('clique escolhe a vida', async () => {
    const onSelect = vi.fn()
    render(<LifeTimeline currentId="qa" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Uber Driver' }))
    expect(onSelect).toHaveBeenCalledWith('uber')
  })
})
