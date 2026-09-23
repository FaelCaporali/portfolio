/** Validação dos campos: recusa com 422 apontando o campo, antes de gastar o Turnstile. */
import { describe, expect, it } from 'vitest'
import { call, post, t, useWorkerDoubles, valid } from './helpers'

useWorkerDoubles()

describe('validação dos campos', () => {
  it.each([
    ['nome vazio', { name: '   ' }, 'name'],
    ['nome longo', { name: 'x'.repeat(101) }, 'name'],
    ['nome não string', { name: { $gt: '' } }, 'name'],
    ['contato vazio', { contact: '' }, 'contact'],
    ['contato que não é e-mail nem telefone', { contact: 'linkedin.com/in/maria' }, 'contact'],
    [
      'e-mail com quebra de linha (injeção de cabeçalho)',
      { contact: 'maria@example.com\r\nBcc: alvo@example.com' },
      'contact',
    ],
    ['e-mail com dois arrobas', { contact: 'a@b@example.com' }, 'contact'],
    ['e-mail com pontos seguidos', { contact: 'a..b@example.com' }, 'contact'],
    ['telefone curto', { contact: '1234567' }, 'contact'],
    ['mensagem curta', { message: 'oi' }, 'message'],
    ['mensagem longa', { message: 'x'.repeat(4001) }, 'message'],
  ])('%s → 422 apontando o campo', async (_, patch, field) => {
    const r = await call(post({ ...valid, ...patch }))
    expect(r.status).toBe(422)
    expect(((await r.json()) as { fields: string[] }).fields).toContain(field)
    expect(t.send).not.toHaveBeenCalled()
  })
  it('a validação vem antes do Turnstile (token não é gasto à toa)', async () => {
    await call(post({ ...valid, message: 'oi' }))
    expect(fetch).not.toHaveBeenCalled()
  })
})
