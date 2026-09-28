/**
 * Bloco ASSÍNCRONO em linha, para o 1024 (FICHA-PRODUCAO, FECHAMENTO; D9, D13): lá não sobra coluna entre o título e a
 * cabeça, e o assíncrono vai para a zona de baixo, acima dos cartões: RabbitMQ (descartado) × SQS ✓ → Lambda | Fargate
 * (por serviço) · SNS → SES, com o contrato do evento embaixo. Devolve o y de baixo.
 */
import { COR, TAM, check, descartada, fonteMono, grupo, servico, seta, type Tela } from './estilo'
import { JANELA } from './decisoes'
import type { Quadro } from './pincel'
import { ESCALA, T } from './roteiro'

const t0 = T.apoio[0]
/** Offsets do apoio e dos grupos pelo fator da subida (roteiro.ts, RITMO.md). */
const KS = ESCALA.sobe

export function blocoAssincronoLinha(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const ap = k.apoio
  const W = r.x1 - r.x0
  const X = (f: number) => r.x0 + f * W
  const y = r.y0 + k.nome * 1.7 + ap / 2 + 2
  // D18: pares em movimento (decisoes.ts); no diagrama, cada um aparece ao pousar.
  const [s0, s1] = JANELA.sqs
  const [c0, c1] = JANELA.computacao
  tl.p.pares.push(
    {
      exclusivo: true,
      de: s0,
      ate: s1,
      palco: r,
      itens: [
        { id: 'sqs', nome: 'SQS', nota: 'managed', x: X(0.22), y, lado: ap, vence: true },
        { id: 'rabbitmq', nome: 'RabbitMQ', nota: 'self-run', x: X(0.08), y, lado: ap, vence: false },
      ],
    },
    {
      exclusivo: false,
      de: c0,
      ate: c1,
      palco: r,
      itens: [
        { id: 'lambda', nome: 'Lambda', nota: 'bursty jobs', x: X(0.42), y, lado: ap, vence: true },
        { id: 'fargate', nome: 'Fargate', nota: 'steady APIs', x: X(0.56), y, lado: ap, vence: true },
      ],
    },
  )
  descartada(tl, { id: 'rabbitmq', x: X(0.08), y, nome: 'RabbitMQ', t: s1 })
  servico(tl, { id: 'sqs', x: X(0.22), y, nome: 'SQS', lado: ap, t: s1 })
  check(tl, X(0.22) + ap / 2 + 6, y - ap / 2 + 2, s1, 8)
  servico(tl, { id: 'lambda', x: X(0.42), y, nome: 'Lambda', nota: 'bursty', lado: ap, t: c1 })
  servico(tl, { id: 'fargate', x: X(0.56), y, nome: 'Fargate', nota: 'steady', lado: ap, t: c1 })
  servico(tl, { id: 'sns', x: X(0.74), y, nome: 'SNS', lado: ap, t: t0 + 0.25 * KS })
  servico(tl, { id: 'ses', x: X(0.9), y, nome: 'SES', nota: 'email', lado: ap, t: t0 + 0.3 * KS })
  const m = ap / 2 + 3
  const liga = (a: number, b: number, t: number) =>
    seta(
      tl,
      [
        [X(a) + m, y],
        [X(b) - m, y],
      ],
      { t, dur: 0.08 * KS, fluxo: true },
    )
  liga(0.22, 0.42, t0 + 0.12 * KS)
  liga(0.56, 0.74, t0 + 0.22 * KS)
  liga(0.74, 0.9, t0 + 0.28 * KS)
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
  grupo(tl, { x0: r.x0, y0: r.y0, x1: r.x1, y1 }, { titulo: 'Async', cor: COR.titulo, t: T.grupos + 0.1 * KS })
  return y1
}
