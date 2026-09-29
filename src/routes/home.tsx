import type { MetaFunction } from 'react-router'
import { ContactWidget } from '../features/contact/ContactWidget'
import { Hero } from '../features/hero/Hero'

export const meta: MetaFunction = () => [
  { title: 'Fael Caporali' },
  { name: 'description', content: 'Rafael Caporali — senior full-stack developer, Belo Horizonte.' },
]

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
