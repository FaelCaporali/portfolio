import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Lang } from '../../../shared/i18n'
import { journeyStartHref, overview } from '../../content/overview'
import { cx } from '../../lib/cx'
import { track } from '../../lib/track'
import { useHydrated } from '../../lib/useHydrated'
import { homeTagLabel } from '../../i18n/tags'
import {
  contactPanelServerState,
  contactPanelState,
  requestContact,
  watchContactPanel,
} from '../contact/contactRequest'

/** Peças comuns às seções da home abaixo do herói (Overview.tsx; 07-direcao-visual.md §3; 10-direcao-v3.md). */

/**
 * Recuo lateral da região: o do herói em cada faixa (20 px, 40 px e 7vw no largo, a mesma borda esquerda do texto
 * dele), e a largura útil travada em --container-region a partir de 1953 px (07 §3.1).
 */
export const WRAP = 'px-5 sm:px-10 lg:px-[max(var(--spacing-hero),calc((100%_-_var(--container-region))/2))]'
/** A grade: uma coluna no celular, 6 do sm, 12 do lg; o vão abre no desktop largo. */
export const GRID = 'grid sm:grid-cols-6 sm:gap-x-6 lg:grid-cols-12 desktop:gap-x-8'
/** Foco de todo link e botão da região. */
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
/**
 * Link de texto (overview.css: .ov-link): sozinho na linha ou numa lista, sem sublinhado em repouso; a seta na cor da
 * vida é o sinal que não é só cor, e o sublinhado aparece no hover e no foco (10 §2.3).
 */
export const LINK = cx('ov-link text-fg/85', FOCUS)

/**
 * Título de seção: o h1 do herói segue o único h1 da página. O id é fixo e igual nos dois idiomas. `small`: as seções
 * de apoio (stack e perguntas), com o título menor que o das de venda (10 §2.1).
 */
export function H2({
  id,
  small,
  className,
  children,
}: {
  id: string
  small?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <h2
      id={`${id}-title`}
      className={cx(small ? 'text-section-sm' : 'text-section', 'text-balance text-fg', className)}
    >
      {children}
    </h2>
  )
}

/** A seta de direção do site (→), na cor da vida; anda 3 px no hover do link. */
const Arrow = () => (
  <span aria-hidden className="ov-arrow">
    →
  </span>
)

/**
 * O texto de um link com seta: a última palavra, o espaço sem quebra e a seta não se separam, e "→" nunca fica sozinho
 * numa linha (10 §2.2; `.ov-arrow` é inline-block e abriria um ponto de quebra).
 */
export function WithArrow({ text, arrow = <Arrow /> }: { text: string; arrow?: ReactNode }) {
  const cut = text.lastIndexOf(' ') + 1
  return (
    <>
      {text.slice(0, cut)}
      <span className="whitespace-nowrap">
        {text.slice(cut)}
        {'\u00a0'}
        {arrow}
      </span>
    </>
  )
}

/** Em título e papel, palavra com hífen interno não quebra no hífen ("Full-Stack", "high-end"; 10 §2.2). */
export function KeepHyphens({ text }: { text: string }) {
  const out: ReactNode[] = []
  let at = 0
  for (const word of text.split(' ')) {
    const space = at > 0 ? ' ' : ''
    if (/\S-\S/.test(word))
      out.push(
        space,
        <span key={at} className="whitespace-nowrap">
          {word}
        </span>,
      )
    else out.push(space + word)
    at += word.length + 1
  }
  return out
}

/**
 * "and many more" (R6): fecha as provas de cada oferta e cada grupo da stack e leva ao início da trajetória no idioma
 * da página; com o tamanho e o peso da lista que fecha (10 §2.1). O nome acessível contém o texto visível (2.5.3).
 */
export function More({ lang, className }: { lang: Lang; className?: string }) {
  return (
    <Link
      to={journeyStartHref(lang)}
      prefetch="intent"
      aria-label={overview.more.label[lang]}
      className={cx('ov-more inline-flex min-h-6 items-center whitespace-nowrap text-fg/60', FOCUS, className)}
    >
      {overview.more.text[lang]}
      {'\u00a0'}
      <Arrow />
    </Link>
  )
}

/** Etiquetas das ofertas, sem forma de botão (overview.css: .ov-tag), no idioma da página. */
export function Tags({ tags, lang, className }: { tags: string[]; lang: Lang; className?: string }) {
  return (
    <ul className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {tags.map((t) => (
        <li key={t} className="ov-tag inline-flex items-center px-2.5 py-0.5 text-tag leading-relaxed">
          {homeTagLabel(lang, t)}
        </li>
      ))}
    </ul>
  )
}

/**
 * O que todo botão que abre o contato tem: abre o MESMO formulário do botão flutuante (ContactWidget, pelo
 * contactRequest.ts) e devolve o foco a si ao fechar; aria-expanded e aria-controls do painel. Até a hidratação não
 * abre nada: desligado, como o botão flutuante; sem JavaScript, os contatos diretos do fechamento.
 */
function useContactTrigger(topic?: string) {
  const hydrated = useHydrated()
  const panel = useSyncExternalStore(watchContactPanel, contactPanelState, contactPanelServerState)
  return {
    type: 'button' as const,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': panel.open,
    'aria-controls': panel.panelId,
    disabled: !hydrated,
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      track('offer_cta', topic ?? 'start_project')
      requestContact(e.currentTarget, topic)
    },
  }
}

/**
 * O CTA primário (cabeçalho das ofertas e fechamento; 10 §4.2): cheio. `big`: o do fechamento, 52 px com o anel do
 * espectro parado (overview.css: .ov-ring).
 */
export function StartProject({ label, big, className }: { label: string; big?: boolean; className?: string }) {
  return (
    <button
      {...useContactTrigger()}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center rounded-full bg-fg px-5 py-2 text-center text-sm font-semibold text-on-fg transition-[color,background-color,transform] duration-150 hover:bg-fg/85 active:scale-[0.96] active:bg-fg/70 disabled:cursor-default motion-reduce:transition-none motion-reduce:active:scale-100',
        big ? 'ov-ring min-h-13 px-7 text-base' : 'min-h-11',
        FOCUS,
        className,
      )}
    >
      {/* Numa tela estreita o rótulo quebra em duas linhas, centradas, com a seta presa à última palavra. */}
      <span className="text-balance">
        <WithArrow
          text={label}
          arrow={
            <span aria-hidden className="ml-1">
              →
            </span>
          }
        />
      </span>
    </button>
  )
}

/**
 * O CTA secundário, no fim de cada oferta (10 §4.2): contorno na cor da vida e o balão do "Contact me" (abre conversa;
 * a seta é dos links). O nome acessível é o rótulo, e a descrição, o título da oferta (`describedBy`); o assunto
 * (`topic`, o título da oferta) vai ao formulário (contactRequest.ts). Abaixo de 360 px
 * o rótulo pode quebrar em duas linhas, sem alargar o painel.
 */
export function OfferCta({
  label,
  topic,
  describedBy,
  className,
}: {
  label: string
  topic: string
  describedBy: string
  className?: string
}) {
  return (
    <button
      {...useContactTrigger(topic)}
      aria-describedby={describedBy}
      className={cx(
        'ov-cta2 inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-left text-sm font-semibold text-balance text-fg transition-transform duration-150 active:scale-[0.96] disabled:cursor-default motion-reduce:transition-none motion-reduce:active:scale-100',
        FOCUS,
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
      </svg>
      {label}
    </button>
  )
}
