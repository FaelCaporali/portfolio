import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VISITS_PATH, type VisitBeat } from '../../shared/visits'
import { startTracking, track, trackPage } from './track'

/** O registro de visitas no navegador: o que vai no sendBeacon, quando vai, e o que nunca fica no aparelho. */
describe('registro de visitas (track)', () => {
  const beacon = vi.fn((_url: string, _body: string) => true)
  let stop: () => void
  let clock = 0
  const sent = () => beacon.mock.calls.map((c) => JSON.parse(c[1]) as VisitBeat)
  const hide = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    beacon.mockClear()
    clock = 0
    stop = startTracking('/pt/journey')
  })
  afterEach(() => {
    stop()
    vi.restoreAllMocks()
  })

  it('ao esconder a aba: o tempo visível e os eventos da página, um envio só, para /api/e', () => {
    clock = 4200
    track('journey_filter', 'tools:TypeScript')
    track('bust_drag')
    track('bust_drag') // repetido na mesma página conta uma vez
    hide()
    expect(beacon).toHaveBeenCalledOnce()
    expect(beacon.mock.calls[0]?.[0]).toBe(VISITS_PATH)
    const [beat] = sent()
    expect(beat).toMatchObject({
      p: '/pt/journey',
      t: 4200,
      e: [
        ['journey_filter', 'tools:TypeScript'],
        ['bust_drag', ''],
      ],
    })
    expect(beat?.v).toMatch(/^[a-z0-9]{12}$/)
  })

  it('troca de página: manda a anterior com a mesma visita e começa a nova do zero', () => {
    clock = 1000
    track('lang_switch', 'en')
    trackPage('/journey')
    clock = 3000
    hide()
    const [first, second] = sent()
    expect(first).toMatchObject({ p: '/pt/journey', t: 1000, e: [['lang_switch', 'en']] })
    expect(second).toMatchObject({ p: '/journey', t: 2000, e: [] })
    expect(second?.v).toBe(first?.v)
  })

  it('detalhe com caractere que o Worker recusa: o caractere sai, o envio não cai', () => {
    track('journey_filter', 'skills:R&D <b>')
    clock = 10
    hide()
    expect(sent()[0]?.e).toEqual([['journey_filter', 'skills:RD b']])
  })

  it('página sem tempo visível nem evento: nada é mandado', () => {
    hide()
    expect(beacon).not.toHaveBeenCalled()
  })

  it('nada no aparelho: nenhum cookie, localStorage ou sessionStorage', () => {
    clock = 50
    track('resume', 'English')
    hide()
    expect(document.cookie).toBe('')
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
  })
})
