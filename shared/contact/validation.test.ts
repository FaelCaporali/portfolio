import { describe, expect, it } from 'vitest'
import { asEmail, asPhone, cleanLine, cleanText, parseContact } from './validation'

describe('limpeza', () => {
  it('uma linha: quebras viram espaço, espaços colapsam, invisíveis saem', () => {
    expect(cleanLine('  Maria\r\nBcc:\t x‮ ')).toBe('Maria Bcc: x')
  })
  it('várias linhas: mantém parágrafos, no máximo uma linha em branco, sem espaço no fim', () => {
    expect(cleanText('a   \r\n\r\n\r\n\r\nb\t')).toBe('a\n\nb')
  })
  it('fim de linha em tempo linear: 16 KB de espaços no meio da linha em poucos milissegundos', () => {
    const start = performance.now()
    cleanText(`${' '.repeat(16 * 1024)}x`)
    expect(performance.now() - start).toBeLessThan(50)
  })
})

describe('contato', () => {
  it.each(['maria@example.com', 'a.b+c@sub.example.com.br'])('e-mail válido: %s', (s) => {
    expect(asEmail(s)).toBe(s)
  })
  it.each(['a@b', 'a..b@example.com', '.a@example.com', 'a@b@example.com'])('e-mail inválido: %s', (s) => {
    expect(asEmail(s)).toBeNull()
  })
  it('telefone sem código do país assume Brasil; com + mantém o país', () => {
    expect(asPhone('(31) 99999-0000')).toBe('5531999990000')
    expect(asPhone('+1 415 555 0100')).toBe('14155550100')
    expect(asPhone('1234567')).toBeNull()
  })
})

describe('parseContact', () => {
  const ok = { name: 'Maria', contact: 'maria@example.com', message: 'Mensagem longa o bastante.', token: 't' }
  it('aceita e separa e-mail de resposta, telefone e isca', () => {
    const r = parseContact({ ...ok, website: '' })
    expect(r).toMatchObject({ ok: true, value: { replyEmail: 'maria@example.com', phone: null, honeypot: false } })
  })
  it('aponta cada campo inválido', () => {
    expect(parseContact({ name: ' ', contact: 'x', message: 'oi' })).toEqual({
      ok: false,
      fields: ['name', 'contact', 'message'],
    })
  })
  it('recusa o que não é objeto', () => {
    expect(parseContact([])).toMatchObject({ ok: false })
  })
})
