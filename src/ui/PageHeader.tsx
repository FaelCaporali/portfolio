import { Link } from 'react-router'
import { profile } from '../content/profile'
import { FOCUS, WRAP } from '../features/overview/parts'
import { LangSwitch } from '../i18n/LangSwitch'
import { localePath, type Lang } from '../i18n/lang'
import { cx } from '../lib/cx'

/**
 * Cabeçalho das páginas internas (/mcp, /services/…): parado (não fixo, sem barra translúcida), a volta à home com o
 * nome e o PT/EN, na borda da grade.
 */
export function PageHeader({ lang }: { lang: Lang }) {
  return (
    <header className={cx('flex h-14 items-center justify-between', WRAP)}>
      <Link
        to={localePath(lang, '/')}
        prefetch="intent"
        className={cx('inline-flex min-h-6 items-center text-sm font-semibold text-fg/85 hover:text-fg', FOCUS)}
      >
        <span aria-hidden>←</span>
        <span className="ml-2">{profile.name}</span>
      </Link>
      <LangSwitch
        className={cx(
          'flex h-11 min-w-11 items-center justify-center rounded-full text-sm font-semibold tracking-wide text-fg/60 transition-colors hover:text-fg',
          FOCUS,
        )}
      />
    </header>
  )
}
