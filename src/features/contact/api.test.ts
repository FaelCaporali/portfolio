import { describe, expect, it } from 'vitest'
import { toResult } from './api'

describe('resposta do Worker → resultado', () => {
  it('enviado só com status ok e corpo ok', () => {
    expect(toResult(true, { ok: true })).toEqual({ kind: 'sent' })
    expect(toResult(false, { ok: true })).toEqual({ kind: 'error', code: null })
  })
  it('campos a corrigir, filtrando o que não é campo', () => {
    expect(toResult(false, { ok: false, error: 'invalid', fields: ['name', 'x', 'message'] })).toEqual({
      kind: 'invalid',
      fields: ['name', 'message'],
    })
  })
  it('código conhecido passa; desconhecido, HTML ou nada viram erro sem código', () => {
    expect(toResult(false, { ok: false, error: 'rate_limited' })).toEqual({ kind: 'error', code: 'rate_limited' })
    expect(toResult(false, { ok: false, error: 'not_found' })).toEqual({ kind: 'error', code: null })
    expect(toResult(false, '<html>')).toEqual({ kind: 'error', code: null })
    expect(toResult(false, null)).toEqual({ kind: 'error', code: null })
  })
})
