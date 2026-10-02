import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { stages } from '../../content/journey'
import { HeroFallbackImage } from './HeroFallbackImage'

const devops = stages.find((s) => s.id === 'devops')
if (!devops) throw new Error('vida devops fora da lista')
const ai = stages.find((s) => s.id === 'ai')
if (!ai) throw new Error('vida ai fora da lista')

// Fase 8b: o defeito da Fase 8 era o fallback usar a imagem QUADRADA dos robôs (/hero-bot/<id>.webp, 480×480,
// "contain"), centralizada sobre o texto. Este arquivo prova o componente sozinho (o caminho dentro de Hero.tsx
// segue coberto por Hero.no-acceleration.test.tsx); nunca GPU, nunca <canvas>, nunca three.js aqui.
describe('HeroFallbackImage (Fase 8b: o quadro inteiro do canvas, não o quadrado dos robôs)', () => {
  it('usa <picture> com uma fonte de desktop (1024px+) e a imagem de celular como alternativa', () => {
    render(<HeroFallbackImage stage={devops} nextStage={null} alt="Solutions Architect" />)
    const img = screen.getByRole('img', { name: 'Solutions Architect' })
    const picture = img.closest('picture')
    expect(picture).not.toBeNull()
    const source = picture?.querySelector('source')
    expect(source).toHaveAttribute('media', '(min-width: 1024px)')
    expect(source).toHaveAttribute('srcset', `/hero-fallback/${devops.id}-desktop.webp`)
    expect(img).toHaveAttribute('src', `/hero-fallback/${devops.id}-mobile.webp`)
  })

  it('nunca aponta para o quadrado 480×480 dos robôs (/hero-bot/)', () => {
    render(<HeroFallbackImage stage={ai} nextStage={null} alt="AI Product Engineer" />)
    const img = screen.getByRole('img', { name: 'AI Product Engineer' })
    const picture = img.closest('picture')
    const source = picture?.querySelector('source')
    expect(img.getAttribute('src')).not.toMatch(/\/hero-bot\//)
    expect(source?.getAttribute('srcset')).not.toMatch(/\/hero-bot\//)
  })

  it.each([
    [true, 'desktop'],
    [false, 'mobile'],
  ])('pré-carrega só o formato da tela (largo: %s) da vida seguinte, nunca da atual de novo', (largo, variante) => {
    const originalImage = window.Image
    const srcsPedidos: string[] = []
    class ImagemEspia {
      set src(value: string) {
        srcsPedidos.push(value)
      }
    }
    // @ts-expect-error -- stub mínimo só para capturar `new Image().src =`, como o componente usa.
    window.Image = ImagemEspia
    // O jsdom não tem matchMedia: o stub responde à borda de 1024px que o componente consulta.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: largo, media: query }))
    try {
      render(<HeroFallbackImage stage={devops} nextStage={ai} alt="Solutions Architect" />)
    } finally {
      window.Image = originalImage
      vi.unstubAllGlobals()
    }
    expect(srcsPedidos).toEqual([`/hero-fallback/${ai.id}-${variante}.webp`])
  })
})
