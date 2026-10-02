import { useEffect } from 'react'
import type { Stage } from '../../content/journey'

/** A imagem de uma vida, igual às dos robôs (BotHero.tsx): `/hero-bot/<id>.webp`, WebP ~480×480, ≤ 40 KB. */
const srcFor = (id: string) => `/hero-bot/${id}.webp`

interface HeroFallbackImageProps {
  /** A vida atual do carrossel: a imagem que aparece agora. */
  stage: Stage
  /** A vida seguinte (o relógio, Hero.tsx): pré-carregada, para a troca nunca esperar. */
  nextStage: Stage | null
  /** `m.hero.slots[stage.id]`, igual ao `alt` de BotHero.tsx — nunca o texto da frase inteira. */
  alt: string
}

/**
 * Sem aceleração de GPU real (hasAcceleration() falhou, ou a cena caiu depois de montada: Hero.tsx, `sceneFailed`),
 * o lugar do busto 3D mostra a imagem parada da vida atual, no lugar do `<canvas>` (mesmo `!absolute inset-0`), e
 * troca junto com o relógio do carrossel (o `useEffect` de Hero.tsx que chama `next()` no mesmo tempo do 3D).
 * Fala do Fael (Capítulo 11 do plano): "ausência de GPU não impede render 3d [...] deveria ter imagens". Decisão
 * técnica: nunca "loading" aqui — a imagem seguinte já está pré-carregada antes de precisar dela.
 */
export function HeroFallbackImage({ stage, nextStage, alt }: HeroFallbackImageProps) {
  useEffect(() => {
    if (!nextStage) return
    // Só no cliente, só neste caminho (sem GPU): o navegador baixa a próxima vida enquanto a atual ainda segura.
    const img = new Image()
    img.src = srcFor(nextStage.id)
  }, [nextStage])
  return (
    <img
      key={stage.id}
      src={srcFor(stage.id)}
      width={480}
      height={480}
      alt={alt}
      className="hero-fallback-img !absolute inset-0 h-full w-full object-contain"
    />
  )
}
