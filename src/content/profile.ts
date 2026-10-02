/**
 * Identidade e links públicos. Fonte: CV 09/09 (perfis) e Lattes (ID 3842816194833398).
 * Nome público "Fael Caporali" (decisão do Fael, 23/09). Os textos de interface (títulos redigidos pelo Fael em 23/09,
 * rótulos dos botões) moram em src/i18n/messages/, um arquivo por idioma.
 */
export const profile = {
  name: 'Fael Caporali',
}

export interface ProfileLink {
  label: string
  href: string
}

/**
 * Página da trajetória (a rota /journey, src/routes.ts; em português, /pt/journey). O botão do herói leva ao início
 * dela, sempre (J48, 28/09: "por hora o btn deve levar ao início, sempre"); o salto direto para a vida da tela (pedido
 * de 23/09) fica para depois.
 */
export const journeyPath = '/journey'

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
export const sourceHref = 'https://github.com/FaelCaporali/portfolio'

/** Abrem em outra aba. */
export const profileLinks: ProfileLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/faelcaporali/' },
  { label: 'GitHub', href: 'https://github.com/FaelCaporali' },
]
