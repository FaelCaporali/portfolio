/**
 * FLUXO PRINCIPAL do diagrama (FICHA-PRODUCAO, ADENDO 1 e FECHAMENTO; D5–D9), na zona de cima: Users → Route 53 →
 * CloudFront (+ S3) → API Gateway → ALB (target groups blue/green) → ECS on Fargate (tasks com Auto Scaling) → RDS,
 * DynamoDB e Redis, dentro de AWS Cloud / VPC / subnets pública e privada, com IAM e Secrets Manager de apoio. As setas
 * levam o contrato (HTTPS, REST · OpenAPI, SQL, KV) e o tráfego (canal B). Posições em fração da zona, por formato
 * (no 1024 a zona tem ~560 × 120 px: nomes curtos, sem notas).
 */
import { desenharIcone } from './icones'
import { COR, TAM, check, fonteMono, fonteNome, grupo, servico, seta, type Tela } from './estilo'
import { JANELA } from './decisoes'
import type { Quadro } from './pincel'
import { GRUPO } from './revela'
import { T } from './roteiro'

/** Instante de um ícone do fluxo pela posição (da esquerda para a direita, como o traço chega). */
const quando = (fx: number) => T.icones[0] + (T.icones[1] - T.icones[0]) * fx

/** Posições (fração da largura da zona) por formato. */
const POS = {
  largo: {
    nuvem: 0.095,
    users: 0.045,
    r53: 0.17,
    cf: 0.28,
    api: 0.4,
    iam: 0.36,
    sec: 0.44,
    vpc: 0.49,
    pub: [0.5, 0.645],
    alb: 0.572,
    priv: 0.655,
    ecs: 0.712,
    asg: [0.665, 0.8],
    rds: 0.875,
    redis: 0.96,
  },
  medio: {
    nuvem: 0.075,
    users: 0.035,
    r53: 0.135,
    cf: 0.24,
    api: 0.35,
    iam: 0.3,
    sec: 0.39,
    vpc: 0.43,
    pub: [0.44, 0.575],
    alb: 0.507,
    priv: 0.585,
    ecs: 0.64,
    asg: [0.595, 0.77],
    rds: 0.855,
    redis: 0.95,
  },
} as const

/** Onde o fluxo entrega o evento ao bloco assíncrono (px). */
export interface SaidaFluxo {
  x: number
  y: number
}

export function blocoFluxo(tl: Tela, z: Quadro, xEvento: number): SaidaFluxo {
  const W = z.x1 - z.x0
  const H = z.y1 - z.y0
  const X = (f: number) => z.x0 + f * W
  const Y = (f: number) => z.y0 + f * H
  const k = TAM[tl.f]
  const medio = tl.f === 'medio'
  const P = medio ? POS.medio : POS.largo
  const yB = Y(medio ? 0.8 : 0.76)
  const ic = k.icone
  const ap = k.apoio
  const nota = (s: string) => (medio ? '' : s)

  // Grupos: se desenham primeiro (o traço que sobe da folha vira o contorno).
  grupo(
    tl,
    { x0: X(P.nuvem), y0: Y(0.02), x1: z.x1 - 2, y1: z.y1 - 2 },
    { icone: 'g_nuvem', titulo: 'AWS Cloud', cor: COR.nuvem, t: T.grupos },
  )
  const vpc = { x0: X(P.vpc), y0: Y(0.1), x1: z.x1 - 8, y1: z.y1 - 7 }
  grupo(tl, vpc, { icone: 'g_vpc', titulo: 'VPC', cor: COR.vpc, t: T.grupos + 0.08 })
  const sub0 = vpc.y0 + k.nome * 1.9
  const sub = (x0: number, x1: number, icone: 'g_publica' | 'g_privada', titulo: string, cor: string, t: number) =>
    grupo(tl, { x0, y0: sub0, x1, y1: vpc.y1 - 4 }, { icone, titulo: medio ? '' : titulo, cor, t })
  sub(X(P.pub[0]), X(P.pub[1]), 'g_publica', 'Public', COR.publica, T.grupos + 0.14)
  sub(X(P.priv), vpc.x1 - 4, 'g_privada', 'Private', COR.privada, T.grupos + 0.18)

  // Borda: usuários → DNS → CDN → API.
  const ya = sub0 + (medio ? ic * 0.95 : ic * 0.8)
  servico(tl, { id: 'usuarios', x: X(P.users), y: ya, nome: 'Users', nota: nota('web · mobile'), t: quando(0) })
  servico(tl, { id: 'route53', x: X(P.r53), y: ya, nome: 'Route 53', nota: nota('latency DNS'), t: quando(0.1) })
  servico(tl, { id: 'cloudfront', x: X(P.cf), y: ya, nome: 'CloudFront', nota: nota('edge cache'), t: quando(0.2) })
  servico(tl, { id: 's3', x: X(P.cf), y: yB, nome: 'S3', nota: nota('assets'), lado: ap, t: T.apoio[0] })
  const nApi = 'API Gateway'
  servico(tl, { id: 'apigateway', x: X(P.api), y: ya, nome: nApi, nota: nota('auth · throttle'), t: quando(0.35) })
  servico(tl, { id: 'iam', x: X(P.iam), y: yB, nome: 'IAM', nota: nota('roles'), lado: ap, t: T.apoio[0] + 0.1 })
  const tSec = T.apoio[0] + 0.15
  servico(tl, { id: 'secrets', x: X(P.sec), y: yB, nome: 'Secrets', nota: nota('rotation'), lado: ap, t: tSec })

  // VPC: ALB com os dois target groups (blue/green, D6) → serviço ECS on Fargate → dados.
  const xAlb = X(P.alb)
  servico(tl, { id: 'alb', x: xAlb, y: ya, nome: 'ALB', t: quando(0.55) })
  targetGroups(tl, xAlb, yB)
  const xEcs = X(P.ecs)
  const xFg = xEcs + ic * 0.95
  servico(tl, { id: 'ecs', x: xEcs, y: ya, nome: '', t: quando(0.7) })
  servico(tl, { id: 'fargate', x: xFg, y: ya, nome: '', lado: ap, t: quando(0.72) })
  const fn = fonteNome(k.nome)
  const nEcs = medio ? 'ECS · Fargate' : 'ECS on Fargate'
  const xn = (xEcs + xFg) / 2 - tl.p.medir(fn, nEcs) / 2
  tl.p.texto({ t: quando(0.7) + 0.06 }, xn, ya + ic / 2 + k.nome * 0.85, fn, [[nEcs, COR.nome]], 0.004)
  tasks(tl, { x0: X(P.asg[0]), x1: X(P.asg[1]), y: yB }, ap)
  const xRds = X(P.rds)
  const xRedis = X(P.redis)
  // D18: RDS × DynamoDB por serviço: os dois crescem, ganham o ✓ e cada um encaixa no seu serviço (decisoes.ts).
  const [d0, d1] = JANELA.dados
  tl.p.pares.push({
    exclusivo: false,
    de: d0,
    ate: d1,
    palco: z,
    itens: [
      { id: 'rds', nome: 'RDS', nota: 'orders · ACID', x: xRds, y: ya, lado: ic, vence: true },
      { id: 'dynamodb', nome: 'DynamoDB', nota: 'sessions · KV', x: xRds, y: yB, lado: ap, vence: true },
    ],
  })
  servico(tl, { id: 'rds', x: xRds, y: ya, nome: 'RDS', nota: nota('orders'), t: d1 })
  servico(tl, { id: 'dynamodb', x: xRds, y: yB, nome: 'DynamoDB', nota: nota('sessions'), lado: ap, t: d1 })
  servico(tl, { id: 'redis', x: xRedis, y: ya, nome: 'Redis', nota: nota('cache'), lado: ap, t: quando(0.95) })

  // Setas com contrato (D9) e tráfego.
  const m = ic / 2 + 4
  const dur = 0.15
  const setaH = (x0: number, x1: number, t: number, contrato?: string) =>
    seta(
      tl,
      [
        [x0 + m, ya],
        [x1 - m, ya],
      ],
      { t, dur, fluxo: true, contrato, tContrato: T.contratos },
    )
  setaH(X(P.users), X(P.r53), quando(0.05), 'HTTPS')
  setaH(X(P.r53), X(P.cf), quando(0.15))
  setaH(X(P.cf), X(P.api), quando(0.3))
  setaH(X(P.api), xAlb, quando(0.45), medio ? 'OpenAPI' : 'REST·OpenAPI')
  setaH(xAlb, xEcs, quando(0.62))
  setaH(xFg - ic * 0.2, xRds, quando(0.8), 'SQL')
  seta(
    tl,
    [
      [X(P.cf), ya + m + k.nome * (medio ? 1 : 2.1)],
      [X(P.cf), yB - ap / 2 - 3],
    ],
    { t: T.apoio[0], dur: 0.1 },
  )
  // Tasks → DynamoDB (embaixo) e ECS → Redis (por cima do RDS): cache-aside.
  seta(
    tl,
    [
      [X(P.asg[1]) + 2, yB],
      [xRds - ap / 2 - 4, yB],
    ],
    { t: quando(0.85), dur, fluxo: true, contrato: 'KV', tContrato: T.contratos },
  )
  const yCima = sub0 - k.nome * 0.4
  const yr = ya - ap / 2 - 3
  seta(
    tl,
    [
      [xFg, ya - ap / 2 - 2],
      [xFg, yCima],
      [xRedis, yCima],
      [xRedis, yr],
    ],
    { t: quando(0.9), dur },
  )
  // Evento para o bloco assíncrono (abaixo, entre o título e a cabeça), se ele estiver ali.
  if (!Number.isFinite(xEvento)) return { x: z.x1, y: z.y1 }
  const xs = Math.min(xEvento, z.x1 - 10)
  const xt = (X(P.asg[0]) + X(P.asg[1])) / 2
  const yt = yB + Math.round(ap * 0.75) / 2 + 4
  seta(
    tl,
    [
      [xt, yt],
      [xt, z.y1 - 4],
      [xs, z.y1 - 4],
      [xs, z.y1 + 22],
    ],
    { t: T.apoio[1], dur: 0.12, fluxo: true },
  )
  return { x: xs, y: z.y1 + 22 }
}

/** Target groups do ALB (D6): no estado A o blue recebe o tráfego; no B (deploy concluído), o green. */
function targetGroups(tl: Tela, x: number, y: number) {
  const k = TAM[tl.f]
  const f = fonteMono(k.nota)
  const w = tl.p.medir(f, 'green') + 6
  const h = k.nota * 1.5
  const chip = (cx: number, nome: string, cor: string, ativo: 'a' | 'b') => {
    for (const lado of ['a', 'b'] as const) {
      const on = lado === ativo
      tl.p.forma({ t: T.apoio[0] + 0.05, g: GRUPO.blueGreen, so: lado }, (ctx, tinta) => {
        ctx.strokeStyle = tinta(cor)
        ctx.globalAlpha = on ? 1 : 0.35
        ctx.lineWidth = on ? 1.6 : 1
        ctx.strokeRect(cx - w / 2, y - h / 2, w, h)
        ctx.fillStyle = tinta(cor)
        ctx.font = f
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(nome, cx, y)
        ctx.textAlign = 'left'
        ctx.globalAlpha = 1
      })
    }
  }
  chip(x - w / 2 - 2, 'blue', COR.blue, 'a')
  chip(x + w / 2 + 2, 'green', COR.green, 'b')
}

/** Serviço com Auto Scaling: duas tasks desde o começo e mais duas no auto scale (T.tasks). */
function tasks(tl: Tela, r: { x0: number; x1: number; y: number }, ap: number) {
  const k = TAM[tl.f]
  const lado = Math.round(ap * 0.75)
  // Ícone e título do grupo numa linha acima das tasks.
  // No 1024 não há altura para a linha do título: só o contorno tracejado do grupo.
  const curto = tl.f === 'medio'
  const y0 = r.y - lado / 2 - (curto ? 3 : Math.round(k.nome * 1.6) + 2)
  grupo(
    tl,
    { x0: r.x0, y0, x1: r.x1, y1: r.y + lado / 2 + 4 },
    {
      icone: curto ? undefined : 'g_asg',
      titulo: curto ? '' : 'Auto Scaling',
      cor: COR.asg,
      t: T.grupos + 0.25,
      tracejado: [4, 3],
    },
  )
  const n = 4
  const passo = (r.x1 - r.x0 - 8 - lado) / (n - 1)
  for (let i = 0; i < n; i++) {
    const x = r.x0 + 4 + lado / 2 + i * passo
    const t = i < 2 ? T.icones[1] : T.tasks + (i - 2) * 0.07
    tl.p.imagem({ t }, x, r.y, lado, (ctx) => desenharIcone(ctx, tl.img, 'task', x, r.y, lado))
  }
  if (k.nota >= 10) check(tl, r.x1 - 7, y0 + 6, T.tasks + 0.15, 8)
}
