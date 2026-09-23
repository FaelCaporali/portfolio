/** Entrega: composição do e-mail, sanitização, fila quando o envio falha e logs sem dado pessoal. */
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import { compose } from '../mail'
import type { Message } from '../message'
import { brokenDb, call, post, rows, sentMail, t, useWorkerDoubles, valid } from './helpers'

useWorkerDoubles()

describe('envio', () => {
  it('sucesso: grava, envia do remetente fixo para fael@caporali.dev, só texto, Reply-To do visitante', async () => {
    const r = await call(post(valid))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(t.send).toHaveBeenCalledOnce()
    const mail = sentMail()
    expect(mail.from).toEqual({ email: 'worker@mail.caporali.dev', name: 'Portfólio · contato' })
    expect(mail.to).toBe('fael@caporali.dev')
    expect(mail.replyTo).toEqual({ email: 'maria@example.com', name: 'Maria Silva' })
    expect(mail.html).toBeUndefined()
    expect(mail.subject).toBe('Contato pelo portfólio: Maria Silva')
    expect(mail.text).toContain(valid.message)
    expect(mail.text).toContain('país: BR')
    const [row] = await rows()
    expect(row).toMatchObject({
      status: 'sent',
      attempts: 1,
      reply_email: 'maria@example.com',
      country: 'BR',
      message_id: 'msg-1',
    })
  })
  it('telefone: sem Reply-To, com link do WhatsApp (assume +55)', async () => {
    await call(post({ ...valid, contact: '(31) 99999-0000' }))
    const mail = sentMail()
    expect(mail.replyTo).toBeUndefined()
    expect(mail.text).toContain('https://wa.me/5531999990000')
  })
  it('telefone internacional mantém o código do país', async () => {
    await call(post({ ...valid, contact: '+1 415 555 0100' }))
    expect(sentMail().text).toContain('https://wa.me/14155550100')
  })
  it('injeção de cabeçalho pelo nome: quebras viram espaço, assunto em uma linha', async () => {
    await call(post({ ...valid, name: 'Maria\r\nBcc: alvo@example.com' }))
    const mail = sentMail()
    expect(mail.subject).toBe('Contato pelo portfólio: Maria Bcc: alvo@example.com')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.to).toBe('fael@caporali.dev')
    expect(mail.bcc).toBeUndefined()
  })
  it('remove marcas bidirecionais e caracteres de controle; mantém parágrafos e emoji', async () => {
    const rlo = String.fromCharCode(0x202e)
    const nul = String.fromCharCode(0)
    await call(post({ ...valid, name: `Maria${rlo}gpj.exe`, message: `Linha 1${nul}\r\n\r\n\r\n\r\nLinha 2 👩‍💻` }))
    const mail = sentMail()
    expect(mail.subject).toBe('Contato pelo portfólio: Mariagpj.exe')
    expect(mail.text).toContain('Linha 1\n\nLinha 2 👩‍💻')
  })
  it('HTML do visitante chega como texto, nunca como HTML', async () => {
    const message = '<img src=x onerror=alert(1)> <a href="https://phish.example">clique</a>'
    await call(post({ ...valid, message }))
    const mail = sentMail()
    expect(mail.html).toBeUndefined()
    expect(mail.text).toContain(message)
  })
  it('falha no envio: responde 200 (fica na fila), grava pendente com o código do erro', async () => {
    t.send.mockRejectedValue(
      Object.assign(new Error('E_RATE_LIMIT_EXCEEDED: slow down, maria@example.com'), {
        code: 'E_RATE_LIMIT_EXCEEDED',
      }),
    )
    const r = await call(post(valid))
    expect(r.status).toBe(200)
    const [row] = await rows()
    expect(row).toMatchObject({ status: 'pending', attempts: 1, last_error: 'E_RATE_LIMIT_EXCEEDED' })
  })
  it('falha no envio e no banco: 503, visitante vê o erro', async () => {
    t.send.mockRejectedValue(new Error('boom'))
    const r = await call(post(valid), { ...t.env, DB: brokenDb })
    expect(r.status).toBe(503)
  })
  it('banco fora do ar não impede o envio', async () => {
    const r = await call(post(valid), { ...t.env, DB: brokenDb })
    expect(r.status).toBe(200)
    expect(t.send).toHaveBeenCalledOnce()
  })
  it('logs sem dado pessoal', async () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')))
    vi.spyOn(console, 'warn').mockImplementation((...a) => void logs.push(a.join(' ')))
    t.send.mockRejectedValue(new Error('E_X maria@example.com'))
    await call(post(valid))
    const all = logs.join('\n')
    expect(all).not.toContain('maria@example.com')
    expect(all).not.toContain('Maria')
    expect(all).not.toContain('vaga')
  })
  it('a mensagem composta passa pela binding real de e-mail (simulada localmente)', async () => {
    const m: Message = {
      id: 'x',
      created_at: Date.now(),
      name: 'Maria',
      contact: 'maria@example.com',
      reply_email: 'maria@example.com',
      body: 'Olá, tudo bem? Teste.',
      country: 'BR',
      attempts: 0,
    }
    await expect(env.EMAIL.send(compose(m))).resolves.toHaveProperty('messageId')
  })
  // O simulador local registra a recusa como erro solto e um aviso de "hung" do próprio simulador; o resultado vale.
  it('a binding real recusa outro destino (destino fixo na configuração)', async () => {
    const m: Message = {
      id: 'x',
      created_at: Date.now(),
      name: 'Maria',
      contact: 'maria@example.com',
      reply_email: null,
      body: 'Olá, tudo bem? Teste.',
      country: null,
      attempts: 0,
    }
    await expect(env.EMAIL.send({ ...compose(m), to: 'alvo@example.com' })).rejects.toThrow()
    await expect(env.EMAIL.send({ ...compose(m), from: 'fael@caporali.dev' })).rejects.toThrow()
  })
})
