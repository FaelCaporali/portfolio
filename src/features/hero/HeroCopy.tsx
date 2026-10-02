import { useRef, type Ref } from 'react'
import { Link } from 'react-router'
import { stages, type Stage } from '../../content/journey'
import { OVERVIEW_ID, overview } from '../../content/overview'
import { journeyPath, profileLinks } from '../../content/profile'
import { LANGS } from '../../../shared/i18n'
import { localePath, MESSAGES, useLang, type Lang } from '../../i18n/lang'
import type { Messages } from '../../i18n/messages/en'
import { pill } from '../../ui/pill'
import { useHydrated } from '../../lib/useHydrated'
import { CopyContacts } from '../contact/CopyContacts'
import { useFitFontSize } from './hooks/useFitFontSize'
import { WIDE_QUERY } from './model/layout'
import { ResumeMenu } from './ResumeMenu'
import { SlotWord } from './SlotWord'

interface HeroCopyProps {
  ref: Ref<HTMLDivElement>
  stage: Stage
  /** A vida está saindo (furacão): as letras saem girando. */
  leaving: boolean
  /** A cena 3D ainda não está na tela: "Today I am loading" no lugar da vida (U2, D-143a). */
  loading: boolean
}

/** As vidas de cada idioma, na ordem do indicador (a lista que useFitFontSize mede: a mesma referência por idioma). */
const SLOTS = Object.fromEntries(LANGS.map((l) => [l, stages.map((s) => MESSAGES[l].hero.slots[s.id])])) as Record<
  Lang,
  string[]
>
/** "Today I am a(n)" / "Yesterday I was a(n)"; em português, "Hoje sou" / "Ontem fui". */
const abertura = (m: Messages, s: Stage) => m.hero.opening(!!s.past, m.hero.slots[s.id])

/**
 * "loading" no lugar da vida enquanto a cena 3D não chega (index.css: .loading-word): a palavra respira e três pontos
 * sobem em onda. Uma palavra só, sem letras soltas: o HTML e o leitor de tela leem "Today I am loading". Fora de
 * .slot-word de propósito: as sondas do estúdio 3D e o e2e leem a vida em .slot-word.
 */
function LoadingWord({ word }: { word: string }) {
  return (
    <span className="loading-word">
      {word}
      <span aria-hidden className="loading-dots">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </span>
    </span>
  )
}

/** Coluna de texto do herói: a vida atual, os títulos, os links e o contato direto. */
export function HeroCopy({ ref, stage, leaving, loading }: HeroCopyProps) {
  const slotRef = useRef<HTMLSpanElement>(null)
  const lang = useLang()
  const m = MESSAGES[lang]
  // Largo (lg): a vida mais longa sempre numa linha, com a fonte do visitante. Abaixo, reserva de duas linhas.
  const slotSize = useFitFontSize(slotRef, SLOTS[lang], WIDE_QUERY)
  // As amostras só existem no navegador, depois da hidratação: fora do HTML (buscadores e IAs leriam as vidas como
  // texto escondido) e do caminho do LCP; absolutas e invisíveis, não mexem no layout.
  const amostras = useHydrated()
  return (
    <div
      ref={ref}
      data-hero-copy
      className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-6 text-fg sm:px-10 wide:inset-y-0 wide:right-auto wide:flex wide:w-[56%] wide:flex-col wide:justify-center wide:pr-6 wide:pb-0 wide:pl-hero wide:short:pt-20 wide:short:pb-3"
    >
      {/* A frase da vida é o subtítulo (h2): o h1 é o nome, no topo (Hero.tsx). */}
      <h2>
        <span className="relative block text-lg text-fg/65 lg:text-2xl">
          <span data-vida-texto>{loading ? m.hero.loadingOpening : abertura(m, stage)}</span>
          {/* Amostras paradas e escondidas de cada vida (#138): a cena 3D pinta o fundo de uma vida antes de ela
              entrar, medindo o texto dela aqui, na mesma coluna e na mesma fonte (devops/referencias.ts). */}
          {amostras &&
            stages.map((s) => (
              <span key={s.id} data-medida={s.prop} aria-hidden className="invisible absolute inset-x-0 top-0">
                {abertura(m, s)}
              </span>
            ))}
        </span>{' '}
        {/* Altura reservada para a troca não empurrar o resto: duas linhas no celular (a vida mais longa quebra),
            uma a partir de sm. No largo, useFitFontSize escolhe a maior fonte (até 4,4vw) em que todas cabem numa
            linha, sem vão embaixo das vidas curtas. */}
        <span
          ref={slotRef}
          style={slotSize ? { fontSize: slotSize } : undefined}
          className="relative mt-2 block min-h-[2em] text-life-narrow leading-none font-semibold tracking-tight phone:text-life sm:min-h-[1em] lg:text-life-wide"
        >
          <span data-vida-texto>
            {/* Com a cena, a vida entra com a entrada que o SlotWord já tem (monta de novo). */}
            {loading ? (
              <LoadingWord word={m.hero.loading} />
            ) : (
              <SlotWord text={m.hero.slots[stage.id]} life={stage.id} leaving={leaving} />
            )}
          </span>
          {amostras &&
            stages.map((s) => (
              <span key={s.id} data-medida={s.prop} aria-hidden className="invisible absolute inset-x-0 top-0">
                <SlotWord text={m.hero.slots[s.id]} life={s.id} leaving={false} medida />
              </span>
            ))}
        </span>
      </h2>
      {/* Celular: um título por linha. A partir de sm: numa linha só, separados por um ponto apagado. */}
      <ul
        aria-label={m.hero.titlesLabel}
        className="mt-4 flex flex-col gap-0.5 text-sm leading-snug font-medium text-fg/75 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-y-1 sm:text-hero-titles lg:mt-6 lg:text-lg short:mt-2"
      >
        {m.hero.titles.map((t, i) => (
          <li key={t} className="flex items-baseline">
            {i > 0 && (
              <span aria-hidden className="mx-2 hidden text-fg/25 sm:inline lg:mx-3">
                •
              </span>
            )}
            {t}
          </li>
        ))}
      </ul>
      <nav
        aria-label={m.hero.linksLabel}
        className="pointer-events-auto mt-6 flex flex-col items-start gap-3 sm:mt-7 lg:mt-8 lg:gap-4 short:mt-3 short:gap-2"
      >
        {/* O par: a trajetória (cheio, o destaque) e o conteúdo abaixo do herói (contornado), com a mesma altura e o
            mesmo raio (08-contrato-v2 C3; 07-direcao-visual §4). No celular em pé uma linha não cabe (pt precisa de
            454 px) e uma linha a mais tiraria 52 px da área livre do busto (useFreeArea): o par fica em "L", com a
            mesma borda direita, e o "Cut" sobe 12 px acima do botão da trajetória (o vão do botão às pílulas), fora do
            fluxo, sem mover nada. Do sm para cima, numa linha; deitado (short), numa linha mais baixa. */}
        <div className="relative flex w-full max-w-[22.5rem] items-center sm:w-auto sm:max-w-none sm:gap-3 lg:gap-4 short:w-auto short:max-w-none short:gap-2">
          {/* Leva ao início da trajetória, sempre (J48, 28/09); o salto direto para a vida fica para depois. Pelo
              roteador, sem recarregar: a página começa a baixar quando o ponteiro ou o foco chega ao botão. O toque
              afunda o botão no mesmo quadro (:active), e a barra do roteador (NavigationProgress) segue até a
              trajetória pintar (U2). */}
          <Link
            to={localePath(lang, journeyPath)}
            prefetch="intent"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-fg px-5 text-sm font-semibold whitespace-nowrap text-on-fg transition-[color,background-color,transform] duration-150 hover:bg-fg/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg active:scale-[0.96] active:bg-fg/70 motion-reduce:active:scale-100 sm:w-auto short:h-9 short:w-auto short:shrink-0 short:px-3 short:text-xs"
          >
            {/* Celular deitado estreito (< 760 px): o par em pt passava da coluna; sai só o fim do rótulo, que fica
                inteiro no HTML. */}
            <span>
              {m.hero.journeyLink}
              {m.hero.journeyLinkTail && (
                <>
                  {' '}
                  <span className="max-[47.5rem]:short:hidden">{m.hero.journeyLinkTail}</span>
                </>
              )}
            </span>{' '}
            <span aria-hidden>→</span>
          </Link>
          {/* O conteúdo objetivo abaixo do herói (#overview): âncora, funciona sem JavaScript; a rolagem é suave só sem
              movimento reduzido (index.css). Fundo liso, sem backdrop-filter: o canvas anima por baixo. Vem depois do
              botão da trajetória no DOM, a ordem da tela no largo; no celular ele fica à direita dos títulos, ao lado,
              e a leitura trajetória → Cut segue valendo (11-contrato-v3, revisão: com order, o Tab invertia no
              largo). */}
          <a
            href={`#${OVERVIEW_ID}`}
            className="absolute right-0 bottom-full mb-3 inline-flex h-11 items-center gap-2 rounded-full border border-fg/30 bg-page/70 px-4 text-sm font-medium whitespace-nowrap text-fg/85 transition-colors hover:border-fg/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg sm:static sm:mb-0 short:static short:mb-0 short:h-9 short:shrink-0 short:gap-1.5 short:px-3 short:text-xs"
          >
            {overview.cta[lang]} <span aria-hidden>↓</span>
          </a>
        </div>
        {/* Três pílulas: cabem numa linha desde 320 px. */}
        <ul className="flex flex-wrap gap-1.5 sm:gap-2">
          <li>
            <ResumeMenu className={pill} />
          </li>
          {profileLinks.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noopener noreferrer" className={pill}>
                {l.label}{' '}
                <span aria-hidden className="hidden text-fg/45 xl:inline">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* Contato direto sempre à vista; clique copia (o formulário e os links ficam no botão flutuante). */}
      <CopyContacts className="pointer-events-auto mt-5 lg:mt-6 short:mt-2" />
    </div>
  )
}
