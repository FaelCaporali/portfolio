/**
 * Identidade e links públicos. Fonte: CV 09/09 (perfis) e Lattes (ID 3842816194833398); títulos redigidos pelo Fael (23/09).
 * Nome público "Fael Caporali" (decisão do Fael, 23/09). Idioma padrão (D-C) ainda aberto: por ora, inglês.
 */
export const profile = {
  name: 'Fael Caporali',
  /** Um título por linha. */
  titles: ['FullStack Dev', 'QA Analyst', 'TechLead'],
}

export interface ProfileLink {
  label: string
  href: string
}

/** Página da trajetória cronológica (ainda não existe; tarefa própria). */
export const journeyLink: ProfileLink = { label: 'See the full journey', href: '/trajetoria' }

/** Currículo: baixa direto no idioma escolhido (cópias de ~/Downloads/curriculo, versão 2026-09). */
export const resumes: ProfileLink[] = [
  { label: 'Português', href: '/cv/fael-caporali-cv-pt.pdf' },
  { label: 'English', href: '/cv/fael-caporali-cv-en.pdf' },
]

/** Abrem em outra aba. */
export const profileLinks: ProfileLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/faelcaporali/' },
  { label: 'GitHub', href: 'https://github.com/FaelCaporali' },
  { label: 'Lattes', href: 'http://lattes.cnpq.br/3842816194833398' },
]
