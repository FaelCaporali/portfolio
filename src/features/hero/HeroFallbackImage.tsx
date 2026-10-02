import { useEffect } from 'react'
import type { Stage } from '../../content/journey'

/** O quadro inteiro do canvas da vida, capturado no site real (3d/tools/robos/fallback.mjs): desktop (1440×900,
 *  ≤120 KB) e celular (780×1688, ≤80 KB). NUNCA o quadrado 480×480 dos robôs (BotHero.tsx, `/hero-bot/<id>.webp`):
 *  essa é a Fase 8b, correção da Fase 8, que usava o quadrado aqui — centralizado, pequeno, por cima do texto. */
const srcFor = (id: string, variante: 'desktop' | 'mobile') => `/hero-fallback/${id}-${variante}.webp`

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
 *
 * Fase 8b: a imagem reproduz o QUADRO do canvas (busto + adereços, do tamanho e no lugar que o 3D os põe), não um
 * recorte quadrado centralizado — esse era o defeito da Fase 8 (capturas comparativas em
 * .wai/seo-geo/08-3d-google/capturas/fase8/). `<picture>` troca entre dois quadros capturados nos dois layouts do
 * herói: "wide" (texto à esquerda, busto à direita — a MESMA borda de 1024px de `@custom-variant wide`,
 * src/index.css) usa a captura de desktop; abaixo disso, a de celular. `object-cover` com `object-position` ancora
 * o busto à direita no layout largo (onde o 3D o põe); fora dele, ao centro, que é onde a captura de celular já o
 * enquadra — o 3D não desloca o busto por decisão própria no celular, as duas capturas bastam.
 */
export function HeroFallbackImage({ stage, nextStage, alt }: HeroFallbackImageProps) {
  useEffect(() => {
    if (!nextStage) return
    // Só no cliente, só neste caminho (sem GPU): o navegador baixa a próxima vida (os dois formatos) enquanto a
    // atual ainda segura — a troca de tamanho de tela no meio de uma vida é rara, e os dois cabem no orçamento.
    for (const variante of ['desktop', 'mobile'] as const) {
      const img = new Image()
      img.src = srcFor(nextStage.id, variante)
    }
  }, [nextStage])
  return (
    <picture key={stage.id} className="!absolute inset-0 block h-full w-full">
      <source media="(min-width: 1024px)" srcSet={srcFor(stage.id, 'desktop')} />
      <img
        src={srcFor(stage.id, 'mobile')}
        alt={alt}
        className="hero-fallback-img h-full w-full object-cover object-center wide:object-right"
      />
    </picture>
  )
}
