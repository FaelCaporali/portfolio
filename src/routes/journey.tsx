import type { MetaFunction } from 'react-router'
import { JourneyPage } from '../features/journey/JourneyPage'

export const meta: MetaFunction = () => [
  { title: 'The full journey · Fael Caporali' },
  {
    name: 'description',
    content: "Fael Caporali's career, from running his own ventures to QA, tech lead and AI product engineering.",
  },
]

/** A trajetória (/journey): o HTML sai pronto do build, com o texto de todos os marcos, e o navegador o hidrata. */
export default function Journey() {
  return <JourneyPage />
}
