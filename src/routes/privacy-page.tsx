import type { MetaFunction } from 'react-router'
import { PrivacyPage } from '../features/privacy/PrivacyPage'
import { pageMeta } from '../i18n/meta'

export const meta: MetaFunction = ({ params }) => pageMeta(params.lang, 'privacy')

/** O aviso de privacidade (/privacy): o que o site registra e por quanto tempo. Sai pronto do build. */
export default function Privacy() {
  return <PrivacyPage />
}
