import { Link } from 'react-router'
import { journeyHref, LIFE_OF, overview } from '../../content/overview'
import { services, type Service } from '../../content/services'
import { localePath, MESSAGES, useLang, type Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { PageHeader } from '../../ui/PageHeader'
import { ContactWidget } from '../contact/ContactWidget'
import { Facts, OFFER_LIVES } from '../overview/Offers'
import { GRID, H2, KeepHyphens, LINK, More, OfferCta, StartProject, Tags, WithArrow, WRAP } from '../overview/parts'
import '../overview/overview.css'

/** Rótulo pequeno em caixa alta (o mesmo da /mcp). */
const EYEBROW = 'text-tag font-medium tracking-[0.14em] text-fg/55 uppercase'

/**
 * A página de uma oferta (/services/…, .wai/seo-geo/04-plano.md F1b): a resposta do site a quem busca esse serviço e
 * não conhece o Fael. Só o que a home já mostra, mais completo: a oferta com as provas, o que foi entregue nesses
 * marcos, as ferramentas deles na trajetória, os fatos de contratação e as outras ofertas. A grade, a luz e os
 * componentes da home abaixo do herói, na cor da vida da oferta. Tudo no HTML do build.
 */
export function ServicePage({ service, tools }: { service: Service; tools: string[] }) {
  const lang = useLang()
  const life = OFFER_LIVES[service.index] ?? 'ai'
  return (
    <>
      <PageHeader lang={lang} />
      <main className={cx(`life-${life}`, 'relative pb-24 text-fg sm:pb-36 lg:pb-40')}>
        <div aria-hidden className="ov-light pointer-events-none absolute inset-x-0 top-0 h-svh" />
        <div className="relative flex flex-col gap-section">
          <Opening service={service} lang={lang} />
          {service.delivered.length > 0 && <Delivered service={service} lang={lang} />}
          {tools.length > 0 && <Tools tools={tools} lang={lang} />}
          <Hire lang={lang} />
          <Others service={service} lang={lang} />
        </div>
      </main>
      <ContactWidget />
    </>
  )
}

/** Abertura: a oferta (título, texto, etiquetas e o CTA dela) e, ao lado no largo, as provas com o link da história. */
function Opening({ service, lang }: { service: Service; lang: Lang }) {
  const { offer } = service
  return (
    <section aria-labelledby="service-title" className={cx('ov-dots pt-14 sm:pt-20 lg:pt-24', WRAP)}>
      <div className={cx(GRID, 'gap-y-10 xl:items-start')}>
        <div className="sm:col-span-6 lg:col-span-12 xl:col-span-6">
          <p className={EYEBROW}>{overview.offers.title[lang]}</p>
          <h1 id="service-title" className="mt-3 text-section text-balance text-fg">
            <KeepHyphens text={offer.title[lang]} />
          </h1>
          <p className="mt-4 max-w-[52ch] text-lede text-pretty text-fg/75 sm:mt-6">{offer.text[lang]}</p>
          <Tags tags={offer.tags} lang={lang} className="mt-6" />
          <OfferCta label={offer.action[lang]} topic={offer.title[lang]} describedBy="service-title" className="mt-8" />
        </div>
        <div className="ov-panel is-lead rounded-3xl p-5 phone:p-6 sm:col-span-6 sm:p-8 lg:col-span-12 lg:p-10 xl:col-span-6">
          <ul className="space-y-3 text-proof sm:space-y-4">
            {offer.proof.map((p) => (
              <li key={p.en} className={cx('text-pretty', `life-${LIFE_OF[p.journeyId] ?? 'ai'}`)}>
                <Link to={journeyHref(lang, p.journeyId)} prefetch="intent" className={LINK}>
                  <WithArrow text={p[lang]} />
                </Link>
              </li>
            ))}
            <li>
              <More lang={lang} className="sm:min-h-8" />
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/** O que foi entregue nos marcos das provas: contexto, papel, resultados e o link da história (como na home). */
function Delivered({ service, lang }: { service: Service; lang: Lang }) {
  const { experience } = overview
  return (
    <section aria-labelledby="delivered-title" className={WRAP}>
      <H2 id="delivered" small>
        {experience.title[lang]}
      </H2>
      <ul className={cx(GRID, 'mt-section-inner gap-y-4 sm:gap-y-6')}>
        {service.delivered.map((e) => (
          <li
            key={e.journeyId}
            className={cx(
              'ov-panel flex flex-col rounded-3xl p-5 phone:p-6 sm:col-span-6 sm:p-8',
              // Um só: mais largo, sem deixar meia grade vazia ao lado.
              service.delivered.length === 1 ? 'lg:col-span-8' : 'lg:col-span-6',
              `life-${LIFE_OF[e.journeyId] ?? 'ai'}`,
            )}
          >
            <h3 id={`delivered-${e.journeyId}`} className="text-offer font-semibold text-balance">
              <KeepHyphens text={e.context[lang]} />
            </h3>
            <p className="ov-ink mt-1.5 text-proof font-medium">{e.role[lang]}</p>
            <ul className="mt-3 max-w-[64ch] space-y-1.5 text-proof text-pretty text-fg/80 marker:text-fg/30 sm:list-disc sm:space-y-2 sm:pl-5">
              {e.results[lang].map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-4 text-proof font-medium">
              <Link
                to={journeyHref(lang, e.journeyId)}
                prefetch="intent"
                aria-describedby={`delivered-${e.journeyId}`}
                className={LINK}
              >
                <WithArrow text={experience.story[lang]} />
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** As ferramentas dos marcos das provas, como estão na trajetória (o rótulo do filtro dela; nomes próprios). */
function Tools({ tools, lang }: { tools: string[]; lang: Lang }) {
  return (
    <section aria-labelledby="tools-title" className={WRAP}>
      <H2 id="tools" small>
        {MESSAGES[lang].journey.groups.tools}
      </H2>
      <ul className="mt-6 flex flex-wrap gap-1.5 sm:mt-8 sm:gap-2">
        {tools.map((t) => (
          <li key={t} className="ov-tag inline-flex items-center px-2.5 py-0.5 text-tag leading-relaxed">
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Como contratar: os fatos da home e o CTA do fechamento. */
function Hire({ lang }: { lang: Lang }) {
  const { closing } = overview
  return (
    <section aria-labelledby="hire-title" className={WRAP}>
      <h2 id="hire-title" className="text-heading leading-tight font-semibold text-balance text-fg">
        {closing.title[lang]}
      </h2>
      <p className="mt-3 max-w-[52ch] text-lede text-pretty text-fg/70">{closing.text[lang]}</p>
      <Facts lang={lang} />
      <StartProject label={closing.action[lang]} big className="mt-8" />
    </section>
  )
}

/** As outras ofertas sob o título da seção da home, cada uma levando à página dela (links internos). */
function Others({ service, lang }: { service: Service; lang: Lang }) {
  return (
    <nav aria-labelledby="others-title" className={WRAP}>
      <H2 id="others" small>
        {overview.offers.title[lang]}
      </H2>
      <ul className={cx(GRID, 'mt-6 gap-y-4 sm:mt-8')}>
        {services
          .filter((s) => s.path !== service.path)
          .map((s) => (
            <li key={s.path} className={cx('sm:col-span-6 lg:col-span-4', `life-${OFFER_LIVES[s.index] ?? 'ai'}`)}>
              <Link
                to={localePath(lang, s.path)}
                prefetch="intent"
                className={cx('ov-panel block h-full rounded-3xl p-5 sm:p-6', LINK)}
              >
                <span className="block text-offer font-semibold text-balance">
                  <WithArrow text={s.offer.title[lang]} />
                </span>
                <span className="mt-2 block text-proof text-pretty text-fg/70">{s.offer.text[lang]}</span>
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  )
}
