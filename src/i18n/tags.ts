import type { Lang } from '../../shared/i18n'
import { ptConcepts, ptHomeTags, ptSkills } from './messages/pt-tags'

export type TagGroup = 'tools' | 'concepts' | 'skills'

/** Ferramentas são nomes próprios: não traduzem. Conceitos e habilidades têm dicionário em português. */
const PT: Record<TagGroup, Record<string, string> | undefined> = {
  tools: undefined,
  concepts: ptConcepts,
  skills: ptSkills,
}

/** A tag como aparece no idioma; a tag em si (a chave, em inglês) é a do filtro e do endereço. */
export function tagLabel(lang: Lang, group: TagGroup, tag: string): string {
  if (lang === 'en') return tag
  return PT[group]?.[tag] ?? tag
}

/** Conferido ao carregar a trajetória (journey-timeline.ts): tag sem tradução derruba o build. */
export function hasTagLabel(group: TagGroup, tag: string): boolean {
  const dict = PT[group]
  return !dict || Object.hasOwn(dict, tag)
}

/**
 * A etiqueta da home (ofertas e stack) no idioma: o dicionário conferido da trajetória (conceitos, depois habilidades)
 * e o das etiquetas só da home; nome de ferramenta e termo sem entrada ficam como estão.
 */
export function homeTagLabel(lang: Lang, tag: string): string {
  if (lang === 'en') return tag
  return ptConcepts[tag] ?? ptSkills[tag] ?? ptHomeTags[tag] ?? tag
}

/** Os dicionários, para o teste achar entrada que sobrou (tag que saiu de journey.json). */
export const tagDictionaries = { concepts: ptConcepts, skills: ptSkills, home: ptHomeTags }
