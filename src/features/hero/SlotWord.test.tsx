import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotWord } from './SlotWord'

describe('SlotWord', () => {
  it('uma letra por span, com a posição na frase inteira (escalona a animação)', () => {
    const { container } = render(<SlotWord text="QA tester" color="#fff" leaving={false} />)
    const letters = [...container.querySelectorAll<HTMLElement>('.ch')]
    expect(letters.map((l) => l.textContent).join('')).toBe('QAtester')
    expect(letters.map((l) => l.style.getPropertyValue('--i'))).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
  })
  it('o leitor de tela recebe a frase inteira; as letras são só visuais', () => {
    const { container } = render(<SlotWord text="QA tester" color="#fff" leaving={false} />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('QA tester')
    expect(container.querySelector('.ch')?.closest('[aria-hidden]')).not.toBeNull()
  })
  it('quebra só entre palavras e marca a saída', () => {
    const { container } = render(<SlotWord text="AI software developer" color="#fff" leaving />)
    expect(container.querySelectorAll('.whitespace-nowrap')).toHaveLength(3)
    expect(container.firstElementChild).toHaveClass('slot-word', 'is-leaving')
  })
})
