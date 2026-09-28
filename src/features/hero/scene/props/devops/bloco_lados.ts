/**
 * Blocos laterais do diagrama da vida devops (FICHA-PRODUCAO, FECHAMENTO; D7, D9, D10, D13):
 * - ASSÍNCRONO (entre o título e a cabeça, pendurado no ECS): SQS ✓ × RabbitMQ (descartado, D13) com o contrato do
 *   evento, Lambda × Fargate por serviço, SNS → SES;
 * - OBSERVABILIDADE (à direita da cabeça): CloudWatch em DESTAQUE (D7, com o alarme que acende e volta ao normal) e
 *   cada ferramenta no seu papel (Prometheus → Grafana, Datadog, Sentry, PostHog);
 * - INTEGRAÇÕES: terceiros entrando pelo API Gateway (webhook assinado) até o proxy, e a saída com retry;
 * - RUNTIME: ECS on Fargate ✓ × Docker Swarm (descartado);
 * - ENTREGA (à direita da prancheta): CodePipeline → CodeBuild (imagem Docker) → CodeDeploy blue/green e
 *   CloudFormation, com o estado do deploy.
 */
import { desenharIcone } from './icones'
import {
  COR,
  TAM,
  check,
  descartada,
  fonteMono,
  fonteNome,
  fonteNota,
  grupo,
  item,
  servico,
  seta,
  type Tela,
} from './estilo'
import { JANELA } from './decisoes'
import type { Quadro } from './pincel'
import { GRUPO } from './revela'
import { ESCALA, T } from './roteiro'

const t0 = T.apoio[0]
/** Offsets do apoio e dos grupos (subida) e dos contratos (decisões) pelo fator do evento (roteiro.ts, RITMO.md). */
const { sobe: KS, decisoes: KD, entrega: KE } = ESCALA

/** SQS × RabbitMQ, Lambda × Fargate e SNS → SES em coluna, a partir de `y` (a ponta da seta do evento). */
export function blocoAssincrono(tl: Tela, z: Quadro, y: number) {
  const k = TAM[tl.f]
  const W = z.x1 - z.x0
  const xL = z.x0 + 0.28 * W
  const xR = z.x0 + 0.76 * W
  const ap = k.apoio
  const y1 = y + ap / 2 + 3
  // D18: o par cresce, o ✓ marca o SQS, o RabbitMQ é cortado e o SQS pousa aqui (decisoes.ts).
  const [s0, s1] = JANELA.sqs
  tl.p.pares.push({
    exclusivo: true,
    de: s0,
    ate: s1,
    palco: z,
    itens: [
      { id: 'sqs', nome: 'SQS', nota: 'managed', x: xL, y: y1, lado: ap, vence: true },
      { id: 'rabbitmq', nome: 'RabbitMQ', nota: 'self-run', x: xR, y: y1, lado: ap, vence: false },
    ],
  })
  servico(tl, { id: 'sqs', x: xL, y: y1, nome: 'SQS', nota: 'managed', lado: ap, t: s1 })
  check(tl, xL + ap / 2 + 7, y1 - ap / 2 + 2, s1, 9)
  descartada(tl, { id: 'rabbitmq', x: xR, y: y1, nome: 'RabbitMQ', nota: 'self-run', t: s1 })
  let yy = y1 + ap / 2 + k.nome + k.nota * 2
  const fm = fonteMono(k.nota)
  tl.p.texto(
    { t: T.contratos },
    z.x0 + 2,
    yy,
    fm,
    [
      ['order.created', COR.contrato],
      [' v1', COR.nota],
    ],
    0.01,
  )
  yy += k.nota * 1.3
  tl.p.texto({ t: T.contratos + 0.15 * KD }, z.x0 + 2, yy, fm, [['schema: JSON', COR.contrato]], 0.01)
  yy += k.nota * 2.2
  tl.p.texto({ t: t0 + 0.1 * KS }, z.x0 + 2, yy, fonteNome(k.nota), [['compute per service', COR.titulo]], 0.006)
  const y2 = yy + k.nota * 0.8 + ap / 2 + 4
  const [c0, c1] = JANELA.computacao
  tl.p.pares.push({
    exclusivo: false,
    de: c0,
    ate: c1,
    palco: z,
    itens: [
      { id: 'lambda', nome: 'Lambda', nota: 'bursty jobs', x: xL, y: y2, lado: ap, vence: true },
      { id: 'fargate', nome: 'Fargate', nota: 'steady APIs', x: xR, y: y2, lado: ap, vence: true },
    ],
  })
  servico(tl, { id: 'lambda', x: xL, y: y2, nome: 'Lambda', nota: 'bursty jobs', lado: ap, t: c1 })
  servico(tl, { id: 'fargate', x: xR, y: y2, nome: 'Fargate', nota: 'steady APIs', lado: ap, t: c1 })
  const y3 = y2 + ap + k.nome * 2 + k.nota * 2
  servico(tl, { id: 'sns', x: xL, y: y3, nome: 'SNS', nota: 'fan-out', lado: ap, t: t0 + 0.25 * KS })
  servico(tl, { id: 'ses', x: xR, y: y3, nome: 'SES', nota: 'email', lado: ap, t: t0 + 0.3 * KS })
  const m = ap / 2 + 3
  seta(
    tl,
    [
      [xL, y1 + m + k.nome * 2],
      [xL, y2 - m],
    ],
    { t: t0 + 0.12 * KS, dur: 0.1 * KS, fluxo: true },
  )
  seta(
    tl,
    [
      [xL, y2 + m + k.nome * 2],
      [xL, y3 - m],
    ],
    { t: t0 + 0.22 * KS, dur: 0.1 * KS, fluxo: true },
  )
  seta(
    tl,
    [
      [xL + m, y3],
      [xR - m, y3],
    ],
    { t: t0 + 0.28 * KS, dur: 0.1 * KS, fluxo: true },
  )
}

/** CloudWatch em destaque e as ferramentas de observabilidade; devolve o y de baixo. */
export function blocoObservabilidade(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const lado = Math.round(k.icone * 1.2)
  const x = r.x0 + 8
  const yc = r.y0 + k.nome * 1.8 + lado / 2 + 2
  const cx = x + lado / 2
  // Alarme (D7): anel vermelho no ícone no estado B.
  tl.p.forma({ t: t0, g: GRUPO.alarme, so: 'b' }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(COR.alarme)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, yc, lado * 0.72, 0, Math.PI * 2)
    ctx.stroke()
  })
  tl.p.imagem({ t: t0 }, cx, yc, lado, (ctx) => desenharIcone(ctx, tl.img, 'cloudwatch', cx, yc, lado))
  tl.p.alvos.alarme = { x: cx, y: yc, t: t0 }
  const tx = x + lado + 8
  tl.p.texto({ t: t0 + 0.05 * KS }, tx, yc - k.nome * 1.05, fonteNome(k.nome * 1.1), [['CloudWatch', COR.nome]], 0.004)
  const papel = tl.f === 'largo' ? 'metrics · logs · alarms' : 'logs · alarms'
  tl.p.texto({ t: t0 + 0.1 * KS }, tx, yc + 0.1, fonteNota(k.nota), [[papel, COR.nota]], 0.004)
  const ya = yc + k.nome * 1.15
  const la = Math.round(k.nota * 1.3)
  const xa = tx + la / 2
  tl.p.imagem({ t: t0 + 0.12 * KS }, xa, ya, la, (ctx) => desenharIcone(ctx, tl.img, 'alarme', xa, ya, la))
  const fm = fonteMono(k.nota)
  tl.p.texto({ t: t0 + 0.15 * KS, g: GRUPO.alarme, so: 'a' }, tx + la + 4, ya, fm, [
    ['OK', COR.ok],
    [' p99 < 300ms', COR.nota],
  ])
  tl.p.texto({ t: t0 + 0.15 * KS, g: GRUPO.alarme, so: 'b' }, tx + la + 4, ya, fm, [
    ['ALARM', COR.alarme],
    [' CPU > 70%', COR.nome],
  ])
  // Ferramentas, cada uma no seu papel (uma por linha).
  const passo = Math.max(k.apoio, k.nome * 1.85)
  let y = yc + lado / 2 + passo * 0.85
  const linhas = [
    ['prometheus', 'Prometheus', 'metrics'],
    ['grafana', 'Grafana', 'dashboards'],
    ['datadog', 'Datadog', 'APM · traces'],
    ['sentry', 'Sentry', 'errors'],
    ['posthog', 'PostHog', tl.f === 'largo' ? 'product analytics' : 'analytics'],
  ] as const
  linhas.forEach(([id, nome, nota], i) => {
    item(tl, x, y + i * passo, id, nome, nota, t0 + (0.2 + i * 0.05) * KS)
  })
  y += (linhas.length - 1) * passo
  const y1 = y + passo * 0.6
  grupo(tl, { x0: r.x0, y0: r.y0, x1: r.x1, y1 }, { titulo: 'Observability', cor: COR.titulo, t: T.grupos + 0.1 * KS })
  return y1
}

/** Terceiros → API Gateway (webhook assinado) → proxy, e a saída protegida; devolve o y de baixo. */
export function blocoIntegracoes(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const ap = k.apoio
  const W = r.x1 - r.x0
  const y = r.y0 + k.nome * 1.8 + k.nota * 1.6 + ap / 2
  const xs = [r.x0 + 0.17 * W, r.x0 + 0.5 * W, r.x0 + 0.83 * W] as const
  // Terceiro genérico (sem marca, D3): caixa com três linhas, como um serviço externo.
  tl.p.forma({ t: t0 }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(COR.nome)
    ctx.lineWidth = 1.2
    ctx.strokeRect(xs[0] - ap / 2, y - ap / 2, ap, ap)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(xs[0] - ap * 0.3, y - ap * 0.22 + i * ap * 0.22)
      ctx.lineTo(xs[0] + ap * 0.3, y - ap * 0.22 + i * ap * 0.22)
      ctx.stroke()
    }
  })
  const yn = y + ap / 2 + k.nome * 0.85
  const fn = fonteNome(k.nome)
  tl.p.texto({ t: t0 + 0.05 * KS }, xs[0] - tl.p.medir(fn, '3rd-party') / 2, yn, fn, [['3rd-party', COR.nome]], 0.004)
  const nApi = tl.f === 'largo' ? 'API Gateway' : 'API GW'
  servico(tl, { id: 'apigateway', x: xs[1], y, nome: nApi, lado: ap, t: t0 + 0.05 * KS })
  servico(tl, { id: 'fargate', x: xs[2], y, nome: 'proxy', lado: ap, t: t0 + 0.1 * KS })
  const m = ap / 2 + 3
  seta(
    tl,
    [
      [xs[0] + m, y],
      [xs[1] - m, y],
    ],
    { t: t0 + 0.08 * KS, dur: 0.08 * KS, fluxo: true },
  )
  seta(
    tl,
    [
      [xs[1] + m, y],
      [xs[2] - m, y],
    ],
    { t: t0 + 0.12 * KS, dur: 0.08 * KS, fluxo: true },
  )
  const fm = fonteMono(k.nota)
  const rot = 'webhook · HMAC'
  const xr = (xs[0] + xs[1]) / 2 - tl.p.medir(fm, rot) / 2
  tl.p.texto({ t: T.contratos }, xr, y - ap / 2 - k.nota, fm, [[rot, COR.contrato]], 0.01)
  // Saída: o proxy chama o terceiro com retry e circuit breaker (credenciais no Secrets Manager).
  const yv = yn + k.nome * 1.4
  const yl = yn + k.nome * 0.6
  seta(
    tl,
    [
      [xs[2], yl],
      [xs[2], yv],
      [xs[0], yv],
      [xs[0], yl],
    ],
    { t: t0 + 0.15 * KS, dur: 0.12 * KS },
  )
  const eg = 'egress · retry · breaker'
  const xe = r.x0 + (W - tl.p.medir(fm, eg)) / 2
  tl.p.texto({ t: T.contratos + 0.1 * KD }, xe, yv + k.nota * 1.2, fm, [[eg, COR.contrato]], 0.01)
  const y1 = yv + k.nota * 2.3
  grupo(tl, { x0: r.x0, y0: r.y0, x1: r.x1, y1 }, { titulo: 'Integrations', cor: COR.titulo, t: T.grupos + 0.15 * KS })
  return y1
}

/** Decisão de runtime (D9): ECS on Fargate ✓ × Docker Swarm (descartado; o logo do Docker, sem logo próprio). */
export function blocoRuntime(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const ap = k.apoio
  const W = r.x1 - r.x0
  const y = r.y0 + k.nome * 1.8 + ap / 2
  const largo = tl.f === 'largo'
  const x1 = r.x0 + 0.28 * W
  const nEcs = largo ? 'ECS · Fargate' : 'Fargate'
  const nSwarm = largo ? 'Docker Swarm' : 'Swarm'
  const xs = r.x0 + 0.72 * W
  const [r0, r1] = JANELA.runtime
  tl.p.pares.push({
    exclusivo: true,
    de: r0,
    ate: r1,
    palco: r,
    itens: [
      { id: 'ecs', nome: nEcs, x: x1, y, lado: ap, vence: true },
      { id: 'docker', nome: nSwarm, x: xs, y, lado: k.apoio, vence: false },
    ],
  })
  servico(tl, { id: 'ecs', x: x1, y, nome: nEcs, lado: ap, t: r1 })
  check(tl, x1 + ap / 2 + 7, y - ap / 2 + 2, r1, 9)
  descartada(tl, { id: 'docker', x: xs, y, nome: nSwarm, t: r1 })
  const y1 = y + ap / 2 + k.nome * 1.6
  const tg = T.grupos + 0.2 * KS
  grupo(tl, { x0: r.x0, y0: r.y0, x1: r.x1, y1 }, { titulo: 'Runtime decision', cor: COR.titulo, t: tg })
  return y1
}

/** Pipeline (D6): CodePipeline → CodeBuild (imagem Docker) → CodeDeploy blue/green, CloudFormation e o estado. */
export function blocoEntrega(tl: Tela, r: Quadro) {
  const k = TAM[tl.f]
  const x = r.x0 + 8
  const passo = Math.max(k.apoio + 4, k.nome * 2.2)
  let y = r.y0 + k.nome * 1.8 + passo * 0.5
  const te = T.entrega
  item(tl, x, y, 'codepipeline', 'CodePipeline', '', te)
  y += passo
  const fb = item(tl, x, y, 'codebuild', 'CodeBuild', '', te + 0.08 * KE)
  item(tl, fb + 6, y, 'docker', 'image', '', te + 0.12 * KE, Math.round(k.apoio * 0.7))
  y += passo
  item(tl, x, y, 'codedeploy', 'CodeDeploy', 'blue/green', te + 0.16 * KE)
  y += passo
  item(tl, x, y, 'cloudformation', 'CloudFormation', 'IaC', te + 0.2 * KE)
  y += passo * 0.85
  const fm = fonteMono(k.nota)
  tl.p.texto({ t: te + 0.3 * KE, g: GRUPO.deploy, so: 'a' }, x, y, fm, [['● deploying green', COR.nota]], 0.01)
  tl.p.texto({ t: te + 0.3 * KE, g: GRUPO.deploy, so: 'b' }, x, y, fm, [
    ['✓ green live', COR.green],
    [' · blue off', COR.nota],
  ])
  const y1 = y + k.nota * 1.4
  grupo(
    tl,
    { x0: r.x0, y0: r.y0, x1: r.x1, y1 },
    { icone: 'codepipeline', titulo: 'CI/CD', cor: COR.titulo, t: T.grupos + 0.25 * KS },
  )
  return y1
}
