import type { MetaFunction } from 'react-router'
import { ContactWidget } from '../features/contact/ContactWidget'
import { Hero } from '../features/hero/Hero'
import { pageMeta } from '../i18n/meta'

export const meta: MetaFunction = ({ params }) => pageMeta(params.lang, 'home')

/** A página inicial: o herói e o contato. O texto sai no HTML do build; a cena 3D monta no navegador (Hero). */
export default function Home() {
  return (
    <>
      <main>
        <Hero />
      </main>
      <ContactWidget />
    </>
  )
}
