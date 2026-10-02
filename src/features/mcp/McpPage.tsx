import { Fragment } from 'react'
import { mcp } from '../../content/mcp'
import { useLang, type Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { PageHeader } from '../../ui/PageHeader'
import { ContactWidget } from '../contact/ContactWidget'
import { GRID, H2, LINK, WithArrow, WRAP } from '../overview/parts'
import { Code } from './Code'
import { CopyButton } from './Copy'
import '../overview/overview.css'

/**
 * A página /mcp (e /pt/mcp): como conectar o assistente de IA ao servidor MCP do portfólio. Direção P2 (D-MCP15,
 * .wai/mcp/04-direcao-mcp.md §2): a grade e a luz da home abaixo do herói (vida "ai"), uma landing curta e não um
 * documento; o objeto da primeira tela é o endereço com o botão de copiar. Tudo no HTML do build. Na /journey não há
 * link para cá (D-MCP2).
 */
export function McpPage() {
  const lang = useLang()
  return (
    <>
      <PageHeader lang={lang} />
      <main className="life-ai relative pb-24 text-fg sm:pb-36 lg:pb-40">
        <div aria-hidden className="ov-light pointer-events-none absolute inset-x-0 top-0 h-svh" />
        <div className="relative flex flex-col gap-section">
          <Opening lang={lang} />
          <Clients lang={lang} />
          <Others lang={lang} />
          <Tools lang={lang} />
          <Log lang={lang} />
        </div>
      </main>
      <ContactWidget />
    </>
  )
}

/** Rótulo pequeno em caixa alta (o rótulo dos grupos da stack). */
const EYEBROW = 'text-tag font-medium tracking-[0.14em] text-fg/55 uppercase'

/**
 * Abertura: título, texto e o endereço com o copiar; as perguntas de exemplo à direita a partir de 1280 e abaixo antes
 * disso (a ordem do DOM é a da leitura no celular).
 */
function Opening({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="mcp-title" className={cx('ov-dots pt-14 sm:pt-20 lg:pt-24', WRAP)}>
      <div className={cx(GRID, 'gap-y-12 xl:items-end')}>
        <div className="sm:col-span-6 lg:col-span-12 xl:col-span-7">
          <p className={EYEBROW}>{mcp.eyebrow[lang]}</p>
          <h1 id="mcp-title" className="mt-3 text-section text-balance text-fg">
            {mcp.title[lang]}
          </h1>
          <p className="mt-4 max-w-[46ch] text-lede text-pretty text-fg/70 sm:mt-6">{mcp.lede[lang]}</p>
          <Address lang={lang} />
        </div>
        <Asks lang={lang} />
      </div>
    </section>
  )
}

/**
 * O endereço (04 §2.4): quebra só depois de "fael-caporali." (o hífen nunca quebra), o toque seleciona tudo, e o
 * botão copia a string inteira. Embaixo, o aviso de que o endereço da barra do navegador não é este.
 */
function Address({ lang }: { lang: Lang }) {
  const [head, tail] = mcp.addressParts
  return (
    <div className="mt-6 max-w-3xl sm:mt-8">
      <div className="ov-panel is-lead rounded-2xl p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5 lg:p-6">
        <div className="min-w-0">
          <p className={EYEBROW}>{mcp.addressLabel[lang]}</p>
          <code className="mt-2 block font-mono text-[clamp(0.9375rem,0.8rem+0.6vw,1.25rem)] text-fg select-all">
            <span className="whitespace-nowrap">{head}</span>
            <wbr />
            {tail}
          </code>
        </div>
        <CopyButton
          text={mcp.address}
          label={mcp.copy.address[lang]}
          lang={lang}
          big
          className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto"
        />
      </div>
      <p className="mt-3 max-w-[64ch] text-proof text-pretty text-fg/60">{mcp.addressNote[lang]}</p>
    </div>
  )
}

/** Três pedidos de recrutador, cada um com as ferramentas que ele aciona (etiquetas, sem forma de botão). */
function Asks({ lang }: { lang: Lang }) {
  return (
    <div className="sm:col-span-6 lg:col-span-12 xl:col-span-5 xl:col-start-8">
      <p className={EYEBROW}>{mcp.asks.title[lang]}</p>
      <ul className="mt-4 grid gap-6 lg:grid-cols-3 xl:grid-cols-1">
        {mcp.asks.items.map((a) => (
          <li key={a.q.en} className="border-t border-fg/10 pt-4">
            <p className="text-offer text-balance text-fg/90">“{a.q[lang]}”</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {a.tools.map((t) => (
                <li key={t} className="ov-tag px-2.5 py-0.5 font-mono text-tag leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Um passo com os nomes de menu em negrito (`**Settings**` no texto); a chave é a posição no texto. */
function Step({ text }: { text: string }) {
  let at = 0
  return text.split('**').map((part, i) => {
    const key = at
    at += part.length + 2
    return i % 2 ? (
      <strong key={key} className="font-semibold text-fg">
        {part}
      </strong>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    )
  })
}

/** Claude e ChatGPT em dois painéis (o das ofertas), lado a lado a partir de 1024, cada um com a fonte oficial. */
function Clients({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="clients-title" className={WRAP}>
      <H2 id="clients" small>
        {mcp.clients.title[lang]}
      </H2>
      <div className={cx(GRID, 'mt-section-inner gap-y-6')}>
        {mcp.clients.items.map((c, i) => (
          <article
            key={c.name}
            className={cx(
              'ov-panel flex flex-col rounded-3xl p-5 phone:p-6 sm:col-span-6 sm:p-8 lg:p-10',
              i % 2 === 1 && 'is-right',
            )}
          >
            <h3 className="text-offer font-semibold text-fg">{c.name}</h3>
            <p className="mt-2 text-proof text-pretty text-fg/60">{c.plans[lang]}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-body text-pretty text-fg/80 marker:text-fg/45">
              {c.steps[lang].map((s) => (
                <li key={s}>
                  <Step text={s} />
                </li>
              ))}
            </ol>
            <p className="mt-auto pt-6 text-proof">
              <a
                href={c.source}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(LINK, 'inline-flex min-h-8 items-center')}
              >
                <span>
                  <WithArrow text={mcp.clients.source[lang]} arrow={<span aria-hidden>↗</span>} />
                </span>
              </a>
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

/** Claude Code em largura cheia; Cursor e VS Code lado a lado a partir de 1024. */
function Others({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="others-title" className={WRAP}>
      <H2 id="others" small>
        {mcp.others.title[lang]}
      </H2>
      <p className="mt-4 max-w-[64ch] text-body text-pretty text-fg/70">{mcp.others.text[lang]}</p>
      <div className={cx(GRID, 'mt-section-inner gap-y-8')}>
        {mcp.others.items.map((s, i) => (
          <div key={s.name} className={cx('min-w-0 sm:col-span-6', i === 0 ? 'lg:col-span-12' : 'lg:col-span-6')}>
            <h3 className="mb-3 text-lg font-semibold text-fg/90">{s.name}</h3>
            <Code label={s.label} code={s.code} lang={lang} />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * As sete ferramentas, com o que cada uma faz, em linhas na forma da stack da home; as duas que mandam algo dizem que
 * o assistente pergunta antes.
 */
function Tools({ lang }: { lang: Lang }) {
  return (
    <section aria-labelledby="tools-title" className={WRAP}>
      <H2 id="tools" small>
        {mcp.tools.title[lang]}
      </H2>
      <dl className="mt-section-inner border-b border-fg/8">
        {mcp.tools.items.map((t) => (
          <div
            key={t.name}
            className="border-t border-fg/8 py-3 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-6 lg:grid-cols-[16rem_minmax(0,1fr)] desktop:gap-x-8"
          >
            <dt className="font-mono text-proof text-fg/85">{t.name}</dt>
            <dd className="mt-1 max-w-[64ch] text-proof text-pretty text-fg/75 sm:mt-0">{t.text[lang]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** O que fica registrado e o que nunca fica (T5; LGPD), na forma das perguntas frequentes da home. */
function Log({ lang }: { lang: Lang }) {
  const lists = [
    { title: mcp.log.recorded, items: mcp.log.items },
    { title: mcp.log.never, items: mcp.log.neverItems },
  ]
  return (
    <section aria-labelledby="log-title" className={cx('ov-neutral', GRID, WRAP)}>
      <H2 id="log" small className="sm:col-span-6 lg:col-span-4">
        {mcp.log.title[lang]}
      </H2>
      <div className="mt-section-inner flex flex-col gap-8 sm:col-span-6 lg:col-span-8 lg:mt-0">
        {lists.map((l) => (
          <div key={l.title.en}>
            <h3 className={EYEBROW}>{l.title[lang]}</h3>
            <ul className="mt-3 divide-y divide-fg/8 border-y border-fg/8">
              {l.items.map((item) => (
                <li key={item.en} className="max-w-[64ch] py-3 text-proof text-pretty text-fg/75">
                  {item[lang]}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
