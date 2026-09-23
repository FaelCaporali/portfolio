/**
 * Validação do formulário de contato. Funções puras, sem ambiente: o Worker decide com elas e o site as usa para
 * avisar antes de enviar. Tudo o que vem do visitante passa por aqui antes de tocar banco, Turnstile ou e-mail.
 */
import { LIMITS, type Field } from './contract'

export interface ContactInput {
  name: string
  /** Como o visitante escreveu, já limpo. */
  contact: string
  /** O contato, quando é um e-mail válido (vira o Reply-To). */
  replyEmail: string | null
  /** Só dígitos com código do país, quando o contato é telefone (vira link do WhatsApp). */
  phone: string | null
  message: string
  /** Token do Turnstile. */
  token: string
  /** Campo isca: invisível para pessoas, robôs preenchem. */
  honeypot: boolean
}

export type Parsed = { ok: true; value: ContactInput } | { ok: false; fields: Field[] }

/**
 * Caracteres de controle e de formatação invisível: C0 (menos \t e \n), C1, marcas bidirecionais (texto que se
 * apresenta invertido), separadores de linha Unicode e BOM.
 */
const INVISIBLE =
  // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o propósito desta expressão
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2028\u2029\u2066-\u2069\uFEFF]/g

/** Texto de uma linha: sem quebras (fecha a porta para injeção de cabeçalho), espaços colapsados. */
export function cleanLine(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\r\n?|\n|\t/g, ' ')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto de várias linhas: mantém parágrafos, no máximo uma linha em branco seguida. */
export function cleanText(s: string): string {
  return (
    s
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '  ')
      .replace(INVISIBLE, '')
      // Espaço no fim de cada linha. Por linha e com trimEnd, linear: a regex /[ ]+$/gm era quadrática com uma
      // sequência longa de espaços no meio da linha (16 KB de espaços: ~250 ms de CPU; o limite do Worker é 10 ms).
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/** Comprimento em caracteres (pontos de código), não em unidades UTF-16. */
const length = (s: string) => Array.from(s).length

const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export function asEmail(s: string): string | null {
  if (s.length > 254 || !EMAIL.test(s)) return null
  const local = s.slice(0, s.indexOf('@'))
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  return s
}

/** Telefone em qualquer formatação comum. Sem código do país, assume Brasil. */
export function asPhone(s: string): string | null {
  if (!/^\+?[\d\s().-]{8,25}$/.test(s)) return null
  const digits = s.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  if (s.startsWith('+')) return digits
  return digits.length <= 11 ? `55${digits}` : digits
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function parseContact(data: unknown): Parsed {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return { ok: false, fields: ['name', 'contact', 'message'] }
  const d = data as Record<string, unknown>
  const fields: Field[] = []

  const name = cleanLine(str(d.name))
  if (!name || length(name) > LIMITS.name) fields.push('name')

  const contact = cleanLine(str(d.contact))
  const replyEmail = length(contact) <= LIMITS.contact ? asEmail(contact) : null
  const phone = replyEmail || length(contact) > LIMITS.contact ? null : asPhone(contact)
  if (!replyEmail && !phone) fields.push('contact')

  const message = cleanText(str(d.message))
  if (length(message) < LIMITS.messageMin || length(message) > LIMITS.message) fields.push('message')

  if (fields.length) return { ok: false, fields }
  return {
    ok: true,
    value: {
      name,
      contact,
      replyEmail,
      phone,
      message,
      token: str(d.token),
      honeypot: str(d.website) !== '',
    },
  }
}
