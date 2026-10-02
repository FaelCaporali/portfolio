import { Link } from 'react-router'
import { journeyHref, LIFE_OF, overview, prologueHref } from '../../content/overview'
import type { Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { GRID, H2, KeepHyphens, LINK, WithArrow, WRAP } from './parts'
import './route.css'

const { experience } = overview

/** O nó de cada parada (o .dot da trajetória, 14 px), no meio da 1ª linha do texto dela; no largo, route.css o põe
 *  28 px antes da coluna do texto, do lado da parada. */
const NODE = 'ov-node absolute left-0 size-3.5 rounded-full'

/** O texto da parada no largo: colunas 1–7 (à esquerda) ou 6–12 (à direita). */
const COLS = { left: 'lg:col-span-7 lg:col-start-1', right: 'lg:col-span-7 lg:col-start-6' }
/** O papel no largo, no lado oposto, como o rótulo grande de um mapa: colunas 9–12 ou 1–4 (alinhado ao texto). */
const ROLE = { left: 'lg:col-span-4 lg:col-start-9', right: 'lg:col-span-4 lg:col-start-1 lg:text-right' }

/**
 * Um pouco do que entreguei (10-direcao-v3.md §5), do mais recente para trás, como um trecho do mapa da trajetória: no
 * largo as paradas alternam de lado, o caminho pontilhado faz uma curva de um lado ao outro entre elas (SVG estático,
 * na cor da vida que sai e da que chega) e cada parada acende uma poça de luz da vida dela; abaixo do lg, a coluna
 * única, com uma perna do caminho por parada. Cada parada é o que foi feito num contexto genérico (sem empresa nem
 * período, R2: os nomes ficam na trajetória), o papel na cor da vida, os resultados e "The story". A rota termina antes
 * da tecnologia, com "Read the full story" (A4: sem "and many more" aqui).
 */
export function Delivered({ lang }: { lang: Lang }) {
  const { items } = experience
  return (
    <section aria-labelledby="experience-title" className={cx(GRID, WRAP)}>
      <H2 id="experience" className="sm:col-span-6 lg:col-span-8">
        {experience.title[lang]}
      </H2>
      <ol className="ov-route relative isolate mt-section-inner sm:col-span-6 lg:col-span-12">
        {items.map((e, i) => {
          const side = i % 2 ? 'right' : 'left'
          const next = items[i + 1]
          return (
            <li
              key={e.journeyId}
              className={cx(
                'ov-stop relative mb-7 pl-8 sm:mb-12 sm:pl-10 lg:mb-stop lg:pl-0',
                `is-${side}`,
                !next && 'is-last',
                `life-${LIFE_OF[e.journeyId] ?? 'ai'}`,
              )}
            >
              <span
                aria-hidden
                className={cx(NODE, 'top-[calc(var(--text-offer)*0.575-7px)]', i === 0 && 'is-current')}
              />
              <h3
                id={`experience-${e.journeyId}`}
                className={cx('text-offer font-semibold text-balance lg:row-start-1', COLS[side])}
              >
                <KeepHyphens text={e.context[lang]} />
              </h3>
              <p
                className={cx(
                  'ov-ink mt-1.5 text-proof font-medium lg:row-span-3 lg:row-start-1 lg:mt-0 lg:self-center lg:text-role lg:font-semibold lg:text-balance',
                  ROLE[side],
                )}
              >
                <KeepHyphens text={e.role[lang]} />
              </p>
              <ul
                className={cx(
                  'mt-2 max-w-[64ch] space-y-1.5 text-proof text-pretty text-fg/80 marker:text-fg/30 sm:mt-4 sm:list-disc sm:space-y-2 sm:pl-5 lg:row-start-2',
                  COLS[side],
                )}
              >
                {e.results[lang].map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className={cx('mt-2 text-proof font-medium sm:mt-4 lg:row-start-3', COLS[side])}>
                {/* "The story" em todo item: o contexto completa o nome do link para o leitor de tela. */}
                <Link
                  to={journeyHref(lang, e.journeyId)}
                  prefetch="intent"
                  aria-describedby={`experience-${e.journeyId}`}
                  className={LINK}
                >
                  <WithArrow text={experience.story[lang]} />
                </Link>
              </p>
              <Curve
                id={`ov-curve-${e.journeyId}`}
                reverse={side === 'right'}
                to={next ? `life-${LIFE_OF[next.journeyId] ?? 'ai'}` : 'ov-neutral'}
              />
            </li>
          )
        })}
        {/* O início da trajetória não tem vida (o 1º marco é branco): link neutro, no meio do texto (sublinhado). */}
        <li className="ov-stop is-before is-left ov-neutral relative pl-8 sm:pl-10 lg:pl-0">
          <span
            aria-hidden
            className={cx(
              NODE,
              'is-before top-[calc(var(--text-lede)*0.75-7px)] sm:top-[calc(var(--text-before)*0.7-7px)]',
            )}
          />
          <p className="max-w-[52ch] text-lede text-pretty text-fg/75 sm:text-before lg:col-span-9">
            {experience.before.text[lang]}{' '}
            <Link to={prologueHref(lang)} prefetch="intent" className={cx(LINK, 'is-inline')}>
              <WithArrow text={experience.before.link[lang]} />
            </Link>
          </p>
        </li>
      </ol>
    </section>
  )
}

/**
 * A curva do caminho até a próxima parada, no largo (route.css: .ov-curve): do nó desta ao da seguinte, em S, com o
 * traço do pontilhado da rota; o gradiente vai da vida desta (herdada) à da próxima (`to`: a classe da vida). Estática;
 * o id é o do marco, igual nos dois idiomas.
 */
function Curve({ id, reverse, to }: { id: string; reverse: boolean; to: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cx('ov-curve', reverse && 'is-reverse')}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" />
          <stop offset="1" className={to} />
        </linearGradient>
      </defs>
      <path d="M0 0 C0 60 100 40 100 100" stroke={`url(#${id})`} />
    </svg>
  )
}
