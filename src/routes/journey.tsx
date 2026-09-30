import type { MetaFunction } from 'react-router'
import { JourneyPage } from '../features/journey/JourneyPage'
import { pageMeta } from '../i18n/meta'

export const meta: MetaFunction = ({ params }) => pageMeta(params.lang, 'journey')

/** A trajetória (/journey): o HTML sai pronto do build, com o texto de todos os marcos, e o navegador o hidrata. */
export default function Journey() {
  return <JourneyPage />
}
