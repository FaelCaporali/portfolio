/**
 * Identidade e links públicos. Fonte: CV 09/09 (perfis) e Lattes (ID 3842816194833398);
 * títulos redigidos pelo Fael (23/09).
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

/**
 * Página da trajetória cronológica (ainda não existe; tarefa própria). `live: false` tira o botão do herói até a
 * página ir ao ar (Fael, 28/09: "Oculte por hora o botão de 'see the full journey'").
 */
export const journeyLink: ProfileLink & { live: boolean } = {
  label: 'See the full journey',
  href: '/trajetoria',
  live: false,
}

/** Currículo: baixa direto no idioma escolhido (versão 2026-09). */
export const resumes: ProfileLink[] = [
  { label: 'Português', href: '/cv/fael-caporali-cv-pt.pdf' },
  { label: 'English', href: '/cv/fael-caporali-cv-en.pdf' },
]

/**
 * Contato direto, sempre à vista (linha do herói e widget).
 * Exposto por decisão do Fael (23/09): "quero ser encontrado".
 * O telefone abre o WhatsApp. O formulário do widget envia pelo Worker (worker/, docs/CONTATO.md).
 */
export interface DirectContact extends ProfileLink {
  kind: 'email' | 'phone'
  /**
   * Como aparece e como é copiado. Telefone no formato internacional legível: discador, WhatsApp e agenda
   * reconhecem ao colar.
   */
  value: string
}
export const directContacts: DirectContact[] = [
  { kind: 'email', label: 'E-mail', value: 'fael@caporali.dev', href: 'mailto:fael@caporali.dev' },
  { kind: 'phone', label: 'WhatsApp', value: '+55 31 99196-2016', href: 'https://wa.me/5531991962016' },
]

/** Código deste portfólio (repositório público no GitHub). */
export const sourceLink: ProfileLink = {
  label: 'View source on GitHub',
  href: 'https://github.com/FaelCaporali/portfolio',
}

/** Abrem em outra aba. */
export const profileLinks: ProfileLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/faelcaporali/' },
  { label: 'GitHub', href: 'https://github.com/FaelCaporali' },
]
