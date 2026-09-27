/**
 * Diagrama no RETRATO (360×740; FICHA-PRODUCAO, FECHAMENTO: "no 360 o diagrama vira a silhueta do sistema, ícones
 * do fluxo principal legíveis"): duas colunas ao lado da cabeça, acima da prancheta. À esquerda a borda (Route 53 →
 * CloudFront → API Gateway) e a decisão SQS ✓ × RabbitMQ; à direita a VPC (ALB → ECS on Fargate com as tasks do
 * auto scale → RDS | DynamoDB) e o CloudWatch com o alarme. Nomes curtos; o resto do sistema fica no 1440 e no 1024.
 */
import { desenharIcone } from './icones'
import { COR, TAM, check, descartada, grupo, servico, seta, type Tela } from './estilo'
import type { Quadro } from './pincel'
import { GRUPO } from './revela'
import { T } from './roteiro'

const quando = (f: number) => T.icones[0] + (T.icones[1] - T.icones[0]) * f

export function blocoEstreito(tl: Tela, esq: Quadro | null, dir: Quadro | null) {
  const k = TAM[tl.f]
  const ic = k.icone
  if (esq) {
    const W = esq.x1 - esq.x0
    const H = esq.y1 - esq.y0
    const x = esq.x0 + W / 2
    const ys = [0.13, 0.4, 0.67].map((f) => esq.y0 + f * H)
    const [y0 = 0, y1 = 0, y2 = 0] = ys
    grupo(
      tl,
      { x0: esq.x0, y0: esq.y0 - 2, x1: esq.x1, y1: esq.y1 },
      { icone: 'g_nuvem', titulo: 'AWS', cor: COR.nuvem, t: T.grupos },
    )
    servico(tl, { id: 'route53', x, y: y0 + 6, nome: 'Route 53', t: quando(0) })
    servico(tl, { id: 'cloudfront', x, y: y1, nome: 'CloudFront', t: quando(0.2) })
    servico(tl, { id: 'apigateway', x, y: y2, nome: 'API Gateway', t: quando(0.4) })
    const m = ic / 2 + 3
    seta(
      tl,
      [
        [x, y0 + 6 + m + k.nome],
        [x, y1 - m],
      ],
      { t: quando(0.1), dur: 0.1, fluxo: true },
    )
    seta(
      tl,
      [
        [x, y1 + m + k.nome],
        [x, y2 - m],
      ],
      { t: quando(0.3), dur: 0.1, fluxo: true },
    )
    const yq = esq.y1 - k.apoio / 2 - k.nome * 1.4
    servico(tl, { id: 'sqs', x: esq.x0 + W * 0.28, y: yq, nome: 'SQS', lado: k.apoio, t: T.apoio[0] })
    check(tl, esq.x0 + W * 0.28 + k.apoio / 2 + 5, yq - k.apoio / 2 + 2, T.decide[0], 7)
    descartada(tl, { id: 'rabbitmq', x: esq.x0 + W * 0.74, y: yq, nome: 'Rabbit', t: T.apoio[0] + 0.05 })
  }
  if (dir) {
    const W = dir.x1 - dir.x0
    const H = dir.y1 - dir.y0
    const x = dir.x0 + W / 2
    const [y0 = 0, y1 = 0, y2 = 0, y3 = 0] = [0.13, 0.38, 0.63, 0.86].map((f) => dir.y0 + f * H)
    grupo(
      tl,
      { x0: dir.x0, y0: dir.y0 - 2, x1: dir.x1, y1: y2 + ic / 2 + k.nome * 1.5 },
      {
        icone: 'g_vpc',
        titulo: 'VPC',
        cor: COR.vpc,
        t: T.grupos + 0.1,
      },
    )
    servico(tl, { id: 'alb', x, y: y0 + 6, nome: 'ALB', t: quando(0.55) })
    servico(tl, { id: 'ecs', x, y: y1, nome: 'ECS', t: quando(0.7) })
    // Tasks do auto scale ao lado do ECS: duas desde o começo, mais duas em T.tasks.
    const lt = Math.round(k.apoio * 0.7)
    for (let i = 0; i < 4; i++) {
      const tx = x + ic / 2 + 4 + lt / 2 + (i % 2) * (lt + 2)
      const ty = y1 - lt / 2 - 1 + Math.floor(i / 2) * (lt + 2)
      const t = i < 2 ? T.icones[1] : T.tasks + (i - 2) * 0.07
      tl.p.imagem({ t }, tx, ty, lt, (ctx) => desenharIcone(ctx, tl.img, 'task', tx, ty, lt))
    }
    servico(tl, { id: 'rds', x: dir.x0 + W * 0.3, y: y2, nome: 'RDS', lado: k.apoio, t: quando(0.85) })
    servico(tl, { id: 'dynamodb', x: dir.x0 + W * 0.72, y: y2, nome: 'Dynamo', lado: k.apoio, t: quando(0.9) })
    const m = ic / 2 + 3
    seta(
      tl,
      [
        [x, y0 + 6 + m + k.nome],
        [x, y1 - m],
      ],
      { t: quando(0.6), dur: 0.1, fluxo: true },
    )
    seta(
      tl,
      [
        [x, y1 + m + k.nome],
        [x, y2 - k.apoio / 2 - 3],
      ],
      { t: quando(0.8), dur: 0.1, fluxo: true },
    )
    // CloudWatch com o alarme (D7): anel vermelho no estado B.
    const lc = k.icone
    const cx = dir.x0 + W / 2
    tl.p.forma({ t: T.apoio[0], g: GRUPO.alarme, so: 'b' }, (ctx, tinta) => {
      ctx.strokeStyle = tinta(COR.alarme)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, y3, lc * 0.7, 0, Math.PI * 2)
      ctx.stroke()
    })
    servico(tl, { id: 'cloudwatch', x: cx, y: y3, nome: 'CloudWatch', lado: lc, t: T.apoio[0] })
    tl.p.alvos.alarme = { x: cx, y: y3, t: T.apoio[0] }
  }
}
