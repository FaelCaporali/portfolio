import type { Stage } from '../../../content/journey'
import type { Messages } from '../../../i18n/messages/en'

/**
 * "Today I am a(n)" / "Yesterday I was a(n)"; em português, "Hoje sou" / "Ontem fui". Função única (nunca duplicada,
 * decisão 7 de 03-plano-versao-robos.md): o herói humano (HeroCopy.tsx) e a variante dos robôs (BotHero.tsx) chamam
 * a MESMA função, para a frase de cada vida ser idêntica nos dois lados por construção, nunca por cópia.
 */
export const abertura = (m: Messages, s: Stage): string => m.hero.opening(!!s.past, m.hero.slots[s.id])
