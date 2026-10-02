import { Link } from 'react-router'
import { privacy } from '../../content/privacy'
import { localePath, useLang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { PageHeader } from '../../ui/PageHeader'
import { ContactWidget } from '../contact/ContactWidget'
import { GRID, H2, LINK, WRAP } from '../overview/parts'
import '../overview/overview.css'

/** Rótulo pequeno em caixa alta (o da /mcp). */
const EYEBROW = 'text-tag font-medium tracking-[0.14em] text-fg/55 uppercase'

/**
 * A página /privacy (e /pt/privacy): o aviso de privacidade (src/content/privacy.ts), na forma da seção "O que fica
 * registrado" da /mcp: título à esquerda, itens em linhas à direita. Tudo no HTML do build.
 */
export function PrivacyPage() {
  const lang = useLang()
  return (
    <>
      <PageHeader lang={lang} />
      <main className="life-ai relative pb-24 text-fg sm:pb-36 lg:pb-40">
        <div className="relative flex flex-col gap-section">
          <section aria-labelledby="privacy-title" className={cx('pt-14 sm:pt-20 lg:pt-24', WRAP)}>
            <p className={EYEBROW}>{privacy.eyebrow[lang]}</p>
            <h1 id="privacy-title" className="mt-3 text-section text-balance text-fg">
              {privacy.title[lang]}
            </h1>
            <p className="mt-4 max-w-[60ch] text-lede text-pretty text-fg/70 sm:mt-6">{privacy.lede[lang]}</p>
            <p className="mt-4 max-w-[64ch] text-proof text-pretty text-fg/60">{privacy.controller[lang]}</p>
          </section>
          {privacy.sections.map((s) => (
            <section key={s.id} aria-labelledby={`${s.id}-title`} className={cx('ov-neutral', GRID, WRAP)}>
              <H2 id={s.id} small className="sm:col-span-6 lg:col-span-4">
                {s.title[lang]}
              </H2>
              <ul className="mt-section-inner divide-y divide-fg/8 border-y border-fg/8 sm:col-span-6 lg:col-span-8 lg:mt-0">
                {s.items.map((item) => (
                  <li key={item.en} className="max-w-[64ch] py-3 text-proof text-pretty text-fg/75">
                    {item[lang]}
                    {item.link && (
                      <>
                        {' '}
                        <Link to={localePath(lang, item.link)} prefetch="intent" className={LINK}>
                          {item.link}
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className={cx('text-proof text-fg/50', WRAP)}>{privacy.updated[lang]}</p>
        </div>
      </main>
      <ContactWidget />
    </>
  )
}
