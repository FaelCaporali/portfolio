import { describe, expect, it } from 'vitest'
import { checkpoints } from './journey-timeline'

describe('journey-timeline', () => {
  // A conferência roda ao carregar o módulo: dado errado em journey.json derruba este teste (e o pnpm check).
  it('journey.json passa na conferência e tem os marcos em ordem', () => {
    expect(checkpoints.length).toBeGreaterThan(0)
    expect(checkpoints.map((c) => c.order)).toEqual([...checkpoints.map((c) => c.order)].sort((a, b) => a - b))
  })
})
