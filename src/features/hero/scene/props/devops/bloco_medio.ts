/**
 * Bloco ASSÍNCRONO em linha, para o 1024 (FICHA-PRODUCAO, FECHAMENTO; D9, D13): lá não sobra coluna entre o título e a
 * cabeça, e o assíncrono vai para a zona de baixo, acima dos cartões: RabbitMQ (descartado) × SQS ✓ → Lambda | Fargate
 * (por serviço) · SNS → SES, com o contrato do evento embaixo. Devolve o y de baixo.
 */
import { COR, TAM, check, descartada, fonteMono, grupo, servico, seta, type Tela } from './estilo'
import type { Quadro } from './pincel'
import { T } from './roteiro'

const t0 = T.apoio[0]

export function blocoAssincronoLinha(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const ap = k.apoio
  const W = r.x1 - r.x0
  const X = (f: number) => r.x0 + f * W
  const y = r.y0 + k.nome * 1.7 + ap / 2 + 2
  descartada(tl, { id: 'rabbitmq', x: X(0.08), y, nome: 'RabbitMQ', t: t0 + 0.05 })
  servico(tl, { id: 'sqs', x: X(0.22), y, nome: 'SQS', lado: ap, t: t0 })
  check(tl, X(0.22) + ap / 2 + 6, y - ap / 2 + 2, T.decide[0], 8)
  servico(tl, { id: 'lambda', x: X(0.42), y, nome: 'Lambda', nota: 'bursty', lado: ap, t: t0 + 0.15 })
  servico(tl, { id: 'fargate', x: X(0.56), y, nome: 'Fargate', nota: 'steady', lado: ap, t: t0 + 0.2 })
  servico(tl, { id: 'sns', x: X(0.74), y, nome: 'SNS', lado: ap, t: t0 + 0.25 })
  servico(tl, { id: 'ses', x: X(0.9), y, nome: 'SES', nota: 'email', lado: ap, t: t0 + 0.3 })
  const m = ap / 2 + 3
  const liga = (a: number, b: number, t: number) =>
    seta(
      tl,
      [
        [X(a) + m, y],
        [X(b) - m, y],
      ],
      { t, dur: 0.08, fluxo: true },
    )
  liga(0.22, 0.42, t0 + 0.12)
  liga(0.56, 0.74, t0 + 0.22)
  liga(0.74, 0.9, t0 + 0.28)
  const yc = y + ap / 2 + k.nome * 1.1 + k.nota * 1.5
  const fm = fonteMono(k.nota)
  tl.p.texto(
    { t: T.contratos },
    X(0.02),
    yc,
    fm,
    [
      ['event ', COR.nota],
      ['order.created', COR.contrato],
      [' v1 · JSON Schema', COR.nota],
    ],
    0.01,
  )
  const y1 = yc + k.nota * 1.1
  grupo(tl, { x0: r.x0, y0: r.y0, x1: r.x1, y1 }, { titulo: 'Async', cor: COR.titulo, t: T.grupos + 0.1 })
  return y1
}
