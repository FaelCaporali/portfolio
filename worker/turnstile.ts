import { LIMITS } from './validate'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const TURNSTILE_ACTION = 'contact'

interface Siteverify {
  success: boolean
  hostname?: string
  action?: string
  metadata?: { result_with_testing_key?: boolean }
}

export const list = (csv: string) =>
  new Set(
    csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

/**
 * Confere o token no servidor (o widget sozinho não protege nada). Token de uso único, válido por 5 minutos.
 * Exige a ação e o hostname esperados. Resultado das chaves de teste só vale em desenvolvimento.
 */
export async function verifyTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  if (!token || token.length > LIMITS.token) return false
  let result: Siteverify
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token })
    if (ip) body.set('remoteip', ip)
    const r = await fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return false
    result = await r.json<Siteverify>()
  } catch {
    return false
  }
  if (!result.success) return false
  if (result.metadata?.result_with_testing_key) return env.ALLOW_TEST_TURNSTILE === '1'
  return result.action === TURNSTILE_ACTION && list(env.TURNSTILE_HOSTNAMES).has(result.hostname ?? '')
}
