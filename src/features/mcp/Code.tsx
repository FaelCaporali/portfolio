import { useId } from 'react'
import { mcp } from '../../content/mcp'
import type { Lang } from '../../i18n/lang'
import { cx } from '../../lib/cx'
import { FOCUS } from '../overview/parts'
import { CopyButton } from './Copy'

/**
 * Um bloco de código da /mcp: o rótulo (o terminal ou o arquivo) e o copiar em cima, que o rótulo descreve (três "Copy"
 * no Tab); o texto não quebra (um comando quebrado parece dois) e rola por dentro, focável e com nome (o Safari não põe
 * no Tab a área que rola; Chrome 130+ e Firefox põem). O endereço é o único realce.
 */
export function Code({ label, code, lang }: { label: string; code: string; lang: Lang }) {
  const [before, after] = code.split(mcp.address) as [string, string | undefined]
  const labelId = useId()
  return (
    <figure className="min-w-0 rounded-2xl border border-fg/10 bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-fg/8 px-4 py-2">
        <span id={labelId} className="font-mono text-tag text-fg/55">
          {label}
        </span>
        <CopyButton text={code} label={mcp.copy.code[lang]} lang={lang} describedBy={labelId} />
      </figcaption>
      <pre
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- rola: o teclado alcança o fim (WCAG 2.1.1)
        tabIndex={0}
        role="region"
        aria-label={label}
        className={cx('overflow-x-auto p-4 font-mono text-proof leading-relaxed text-fg/85', FOCUS)}
      >
        <code>
          {before}
          {after !== undefined && (
            <>
              <span className="ov-ink">{mcp.address}</span>
              {after}
            </>
          )}
        </code>
      </pre>
    </figure>
  )
}
