import { describe, expect, it } from 'vitest'
import { checkpoints } from '../content/journey-timeline'
import { tagDictionaries, tagLabel } from './tags'

const used = (group: 'concepts' | 'skills') => new Set(checkpoints.flatMap((c) => c.tags?.[group] ?? []))

describe('dicionário das tags em português', () => {
  // A falta derruba o carregamento de journey-timeline.ts (e o build); aqui, a lista do que sobrou no dicionário.
  it.each(['concepts', 'skills'] as const)('%s: toda tag tem tradução e nenhuma tradução sobra', (group) => {
    const tags = used(group)
    const dict = tagDictionaries[group]
    expect([...tags].filter((t) => !Object.hasOwn(dict, t))).toEqual([])
    expect(Object.keys(dict).filter((t) => !tags.has(t))).toEqual([])
    expect(Object.values(dict).every((v) => v.trim() === v && v.length > 0)).toBe(true)
  })

  it('ferramentas são nomes próprios; em inglês a tag é o rótulo', () => {
    expect(tagLabel('pt', 'tools', 'React')).toBe('React')
    expect(tagLabel('pt', 'concepts', 'Unit testing')).toBe('Testes unitários')
    expect(tagLabel('en', 'concepts', 'Unit testing')).toBe('Unit testing')
  })
})
