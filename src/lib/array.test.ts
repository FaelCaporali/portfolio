import { describe, expect, it } from 'vitest'
import { cyclicAt } from './array'

describe('cyclicAt', () => {
  it('dá a volta nos dois sentidos', () => {
    expect([0, 1, 2, 3, 4].map((i) => cyclicAt(['a', 'b', 'c'], i))).toEqual(['a', 'b', 'c', 'a', 'b'])
    expect(cyclicAt(['a', 'b', 'c'], -1)).toBe('c')
  })
  it('lista vazia é erro de programação', () => {
    expect(() => cyclicAt([], 0)).toThrow()
  })
})
