import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReading, useReading, type Reading } from './reading'

describe('o que está em leitura na trajetória', () => {
  it('avisa só quando algo muda', () => {
    const reading = createReading()
    const listener = vi.fn()
    reading.subscribe(listener)
    reading.set({ life: 'vela', mark: 'sailing' })
    reading.set({ life: 'vela', mark: 'sailing' })
    expect(listener).toHaveBeenCalledTimes(1)
    reading.set({ mark: 'switch' })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(reading.get()).toMatchObject({ life: 'vela', mark: 'switch' })
  })

  it('só o marco que entra ou sai da leitura redesenha', () => {
    const reading = createReading()
    const renders = new Map<string, number>()
    function Mark({ id, source }: { id: string; source: Reading }) {
      const current = useReading(source, (s) => s.mark === id)
      renders.set(id, (renders.get(id) ?? 0) + 1)
      return <p aria-current={current ? 'location' : undefined}>{id}</p>
    }
    render(
      <>
        {['a', 'b', 'c'].map((id) => (
          <Mark key={id} id={id} source={reading} />
        ))}
      </>,
    )
    act(() => {
      reading.set({ mark: 'a' })
    })
    act(() => {
      reading.set({ mark: 'b' })
    })
    expect(screen.getByText('b')).toHaveAttribute('aria-current', 'location')
    expect(screen.getByText('a')).not.toHaveAttribute('aria-current')
    expect(renders.get('c')).toBe(1)
  })
})
