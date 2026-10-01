import { describe, expect, it } from 'vitest'
import { checkpoints } from '../../content/journey-timeline'
import { yearRanges } from '../../../worker/mcp/content'
import { date } from './layout'

describe('anos de cada marco', () => {
  // O filtro de período do MCP (worker/mcp/content.ts) repete a regra da página porque o Worker não importa o React;
  // este teste trava as duas na mesma conta.
  it('o MCP e a página dão o mesmo intervalo a todo marco', () => {
    const ranges = yearRanges(new Date().getFullYear())
    for (const d of date(checkpoints.map((c) => ({ c })))) {
      expect(ranges.get(d.c.id), d.c.id).toEqual({ from: d.from, to: d.to })
    }
  })
})
