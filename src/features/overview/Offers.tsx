import { Link } from 'react-router'
import { journeyHref, LIFE_OF, overview } from '../../content/overview'
import type { StageId } from '../../content/journey'
import type { Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { GRID, H2, KeepHyphens, LINK, More, OfferCta, StartProject, Tags, WithArrow, WRAP } from './parts'

const { offers } = overview

/**
 * A vida de cada oferta, na ordem do JSON: aquela em que as provas dela pousam na trajetória (07 §3.5). A de IA abre o
 * carrossel do herói; o MVP pousa em devops (bid e a arquitetura da plataforma); a qualidade, em qa; a liderança, em
 * techlead (o "Tech Lead" do herói; beamble-lead é a âncora dessa vida).
 */
const OFFER_LIVES: readonly StageId[] = ['ai', 'devops', 'qa', 'techlead']

/**
 * Ofertas (10-direcao-v3.md §3, arranjo C): cabeçalho assimétrico do xl (título nas colunas 1–7; o texto e a ação
 * principal nas 8–12); no lg, título numa linha e o texto embaixo. As quatro ofertas em faixas de 12 colunas no largo,
 * divididas 6/6 por dentro (título, texto, etiquetas e o CTA da oferta à esquerda; as provas à direita), uma por linha
 * abaixo dele; a luz das faixas 2 e 4 nasce à direita. Depois, os fatos de contratação numa faixa.
 */
export function Offers({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="offers-title" className={cx('ov-dots', WRAP)}>
      <div className={cx(GRID, 'gap-y-4 sm:gap-y-6 xl:items-end')}>
        <H2 id="offers" className="sm:col-span-6 lg:col-span-12 xl:col-span-7">
          {offers.title[lang]}
        </H2>
        <div className="sm:col-span-6 lg:col-span-12 xl:col-span-5">
          <p className="max-w-[46ch] text-lede text-pretty text-fg/65">{offers.lede[lang]}</p>
          <StartProject label={offers.action[lang]} className="mt-4 sm:mt-6" />
        </div>
      </div>
      <ul className={cx(GRID, 'mt-section-inner gap-y-4 sm:gap-y-6')}>
        {offers.items.map((o, i) => {
          const lead = i === 0
          const titleId = `offer-${String(i + 1)}-title`
          return (
            <li
              key={o.title.en}
              className={cx(
                'ov-panel flex flex-col rounded-3xl p-5 phone:p-6 sm:col-span-6 sm:p-8 lg:col-span-12 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:gap-x-8',
                `life-${OFFER_LIVES[i] ?? 'ai'}`,
                lead ? 'is-lead lg:p-12' : 'lg:p-10',
                i % 2 === 1 && 'is-right',
              )}
            >
              <div className="lg:col-span-6 lg:row-start-1">
                <h3 id={titleId} className={cx('font-semibold text-balance', lead ? 'text-offer-lead' : 'text-offer')}>
                  <KeepHyphens text={o.title[lang]} />
                </h3>
                <p className="mt-3 max-w-[64ch] text-body text-pretty text-fg/80">{o.text[lang]}</p>
              </div>
              <ul className="mt-4 max-w-[68ch] space-y-2 text-proof sm:mt-6 sm:space-y-3 lg:col-span-6 lg:col-start-7 lg:row-span-3 lg:row-start-1 lg:mt-0">
                {o.proof.map((p, j) => {
                  // A prova principal (R8: os agentes de planejamento de obras) maior, com o fio da vida de destino.
                  const main = lead && j === 0
                  return (
                    <li
                      key={p.en}
                      className={cx(
                        'text-pretty',
                        `life-${LIFE_OF[p.journeyId] ?? 'ai'}`,
                        main && 'ov-lead-proof pl-4 text-body text-fg/90 sm:text-lg sm:leading-snug',
                      )}
                    >
                      <Link to={journeyHref(lang, p.journeyId)} prefetch="intent" className={LINK}>
                        <WithArrow text={p[lang]} />
                      </Link>
                    </li>
                  )
                })}
                <li>
                  <More lang={lang} className="sm:min-h-8" />
                </li>
              </ul>
              <Tags tags={o.tags} lang={lang} className="pt-4 sm:pt-6 lg:col-span-6 lg:row-start-2 lg:self-start" />
              {/* O CTA da oferta, logo depois da prova (10 §4.2): abre o mesmo painel do "Contact me". */}
              <OfferCta
                label={o.action[lang]}
                topic={o.title[lang]}
                describedBy={titleId}
                className="mt-6 self-start lg:col-span-6 lg:row-start-3 lg:justify-self-start"
              />
            </li>
          )
        })}
      </ul>
      <Facts lang={lang} />
    </section>
  )
}

/**
 * Fatos de contratação: uma faixa com fio em cima e embaixo e divisórias entre as células. Uma por linha abaixo de 640
 * px (no 2×2 do celular as células de 175 px quebravam em 3 linhas; 10 §2.2), 2×2 até o lg, quatro numa linha no largo.
 */
function Facts({ lang }: { lang: Lang }) {
  return (
    <ul className="mt-6 grid border-y border-fg/10 text-proof text-fg/75 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
      {offers.facts.map((f) => (
        <li
          key={f.en}
          className="border-fg/10 py-3 text-balance not-first:border-t sm:px-5 sm:py-4 sm:odd:border-r sm:odd:pl-0 sm:nth-2:border-t-0 lg:border-r lg:not-first:border-t-0 lg:last:border-r-0 lg:odd:not-first:pl-5"
        >
          {f[lang]}
        </li>
      ))}
    </ul>
  )
}
