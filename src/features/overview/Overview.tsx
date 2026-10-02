import { OVERVIEW_ID, overview } from '../../content/overview'
import { sourceHref } from '../../content/profile'
import { useLang, type Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { pill } from '../../ui/pill'
import { DirectContacts } from '../contact/DirectContacts'
import { ResumeMenu } from '../hero/ResumeMenu'
import { Delivered } from './Delivered'
import { Offers } from './Offers'
import { homeTagLabel } from '../../i18n/tags'
import { FOCUS, GRID, H2, LINK, More, StartProject, WithArrow, WRAP } from './parts'
import './overview.css'

const { stack, faq, closing } = overview

/**
 * O conteúdo objetivo da home, abaixo do herói (contratos 05, 08 e 11, .wai/pagina-objetiva/): quem chega acha o
 * essencial sem clicar, e a home ganha texto que buscadores e IAs leem (o herói é quase todo canvas). Ordem: ofertas,
 * um pouco do que entreguei, stack, perguntas frequentes e fechamento; tudo no HTML do build. O alvo do CTA "Cut the
 * BS". Direção "Grade das vidas" (07-direcao-visual.md §3): a continuação do herói (a mesma borda esquerda e a luz da
 * vida em que ele abre) numa grade de 12 colunas que usa a largura, com cada bloco na cor da vida onde a prova dele
 * mora.
 */
export function Overview() {
  const lang = useLang()
  return (
    <div id={OVERVIEW_ID} className="life-ai relative pt-14 text-fg sm:pt-20 lg:pt-24">
      {/* A luz da vida de abertura sai do topo da região: o herói continua aqui (nada de "fim de página"). */}
      <div aria-hidden className="ov-light pointer-events-none absolute inset-x-0 top-0 h-svh" />
      <div className="relative flex flex-col gap-section">
        <Offers lang={lang} />
        <Delivered lang={lang} />
        <Stack lang={lang} />
        <Faq lang={lang} />
        <Closing lang={lang} />
      </div>
    </div>
  )
}

/**
 * Um pouco da minha stack (10-direcao-v3.md §6): curta, com o título de apoio. Seis grupos em linhas, cada um com o
 * rótulo e os itens em texto corrido ("TypeScript · JavaScript · … · and many more →"), sem etiqueta com fundo; neutra:
 * ligar uma linguagem a uma vida seria ponto sem nó. O "·" é decorativo e fica no fim do item, nunca no começo da
 * linha.
 */
function Stack({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="stack-title" className={cx('ov-neutral', WRAP)}>
      <div className={cx(GRID, 'gap-y-4 lg:items-end')}>
        <H2 id="stack" small className="sm:col-span-6 lg:col-span-8">
          {stack.title[lang]}
        </H2>
        <p className="text-proof sm:col-span-6 lg:col-span-4 lg:text-right">
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(LINK, 'inline-flex min-h-8 items-center')}
          >
            {/* Num span: no inline-flex, o espaço no fim do texto antes da última palavra sumiria. */}
            <span>
              <WithArrow text={stack.source[lang]} arrow={<span aria-hidden>↗</span>} />
            </span>
          </a>
        </p>
      </div>
      <dl className="mt-[clamp(1.25rem,0.75rem+1.5vw,2rem)] border-b border-fg/8">
        {stack.groups.map((g) => (
          <div
            key={g.label.en}
            className="border-t border-fg/8 py-3 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:gap-x-6 lg:grid-cols-[16rem_minmax(0,1fr)] desktop:gap-x-8"
          >
            <dt className="text-tag font-medium tracking-[0.14em] text-fg/55 uppercase">{g.label[lang]}</dt>
            <dd className="mt-2 sm:mt-0">
              <ul className="ov-run flex flex-wrap gap-x-[0.5em] gap-y-[0.15em] text-proof text-fg/82">
                {g.items.map((t) => (
                  <li key={t} className="whitespace-nowrap">
                    {homeTagLabel(lang, t)}
                  </li>
                ))}
                <li>
                  <More lang={lang} />
                </li>
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Perguntas frequentes (07 §3.2.4): título de apoio (10 §2.1) fixo à esquerda no largo; `<details>` nativo, a resposta
 * no HTML.
 */
function Faq({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="faq-title" className={cx(GRID, WRAP)}>
      <H2 id="faq" small className="sm:col-span-6 lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
        {faq.title[lang]}
      </H2>
      <div className="mt-section-inner divide-y divide-fg/10 border-y border-fg/10 sm:col-span-6 lg:col-span-8 lg:mt-0">
        {faq.items.map((item) => (
          <details key={item.q.en} className="group py-2">
            <summary
              className={cx(
                'flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 sm:py-3 [&::-webkit-details-marker]:hidden',
                FOCUS,
              )}
            >
              <h3 className="text-lg font-semibold text-fg/90 lg:text-xl">{item.q[lang]}</h3>
              <span
                aria-hidden
                className="shrink-0 text-2xl leading-none text-fg/50 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="max-w-[64ch] pb-4 text-body text-pretty text-fg/75">{item.a[lang]}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/**
 * Fechamento (07 §3.2.5): uma faixa de ponta a ponta com a luz da vida vindo de baixo, o maior título do site, as ações
 * na mesma linha (o CTA primário com o anel do espectro, parado, e o currículo) e os contatos diretos à direita.
 */
function Closing({ lang }: { lang: Lang }) {
  return (
    <section
      aria-labelledby="closing-title"
      className={cx('ov-dots ov-closing pt-section-inner pb-24 sm:pb-36 lg:pt-section lg:pb-40', WRAP)}
    >
      <div className={cx(GRID, 'gap-y-6 sm:gap-y-8 lg:items-end')}>
        <div className="sm:col-span-6 lg:col-span-8">
          <h2
            id="closing-title"
            className="text-display leading-display font-semibold tracking-display text-balance text-fg"
          >
            {closing.title[lang]}
          </h2>
          <p className="mt-4 max-w-[46ch] text-lede text-pretty text-fg/70 sm:mt-6">{closing.text[lang]}</p>
          {/* Abaixo do lg, empilhadas, com o CTA na largura toda. */}
          <div className="mt-6 flex flex-col items-start gap-3 sm:mt-8 lg:flex-row lg:items-center">
            <StartProject label={closing.action[lang]} big className="w-full lg:w-auto" />
            <ResumeMenu className={pill} />
          </div>
        </div>
        <div className="sm:col-span-6 lg:col-span-4">
          <DirectContacts />
        </div>
      </div>
    </section>
  )
}
