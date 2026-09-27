/**
 * Cartões de texto no fundo da vida devops (FICHA-PRODUCAO, FECHAMENTO: "Cartões no fundo"; D9, D14): o ADR (contexto:
 * o monólito; opções; critérios; decisão), o contrato OpenAPI do serviço de pedidos com o evento versionado e o
 * template do CloudFormation (serviço Fargate com deploy do CodeDeploy e o alarme do CloudWatch). Inglês técnico curto,
 * sem projeto nem cliente (D3). Realce do VS Code Dark+ (o da chuva do FullStack), fonte mono, digitados ADIANTADOS
 * às batidas (roteiro.ts). Uma versão por formato, escrita para caber na zona sem quebrar; o corpo encolhe até caber.
 */
import { CORES } from '../fullstack/sintaxe'
import type { Formato } from './composicao'
import { COR, MONO, TAM, type Tela } from './estilo'
import { desenharIcone, type Icone } from './icones'
import type { Quadro } from './pincel'
import { T } from './roteiro'

type Trecho = readonly [string, string]

interface Cartao {
  titulo: string
  icone: Icone
  linhas: readonly string[]
  /** Janela da digitação (s). */
  de: number
  ate: number
  yaml: boolean
}

const ADR: Record<'largo' | 'medio', readonly string[]> = {
  largo: [
    'Status: accepted ✓',
    'Context: Lightsail app,',
    '  1 deploy, 1 DB, peaks',
    'Options:',
    '  1 modular monolith',
    '  2 services, Fargate ✓',
    '  3 Docker Swarm ✗',
    'Criteria: deploy, scale,',
    '  ops cost',
    'Decision: 2, SQS events,',
    '  RDS|DynamoDB per svc',
  ],
  medio: [
    'accepted ✓',
    'Context: Lightsail',
    'Options: modular,',
    '  Fargate ✓, Swarm ✗',
    'Criteria: deploy,',
    '  scale, ops cost',
    'Decision: services,',
    '  SQS, RDS|DynamoDB',
  ],
}

const OPENAPI: Record<'largo' | 'medio', readonly string[]> = {
  largo: [
    'openapi: 3.1.0',
    'paths:',
    '  /orders:',
    '    post:',
    '      requestBody: Order',
    '      responses:',
    "        '201': Order",
    "        '409': Conflict",
    'x-events:',
    '  order.created: v1',
  ],
  medio: [
    'openapi: 3.1.0',
    'paths:',
    '  /orders:',
    '    post:',
    "      '201': Order",
    'x-events:',
    '  order.created: v1',
  ],
}

const CFN: Record<'largo' | 'medio', readonly string[]> = {
  largo: [
    'Resources:',
    '  Service:',
    '    Type: AWS::ECS::Service',
    '    Properties:',
    '      LaunchType: FARGATE',
    '      DesiredCount: 2',
    '      DeploymentController:',
    '        Type: CODE_DEPLOY',
    '  CpuAlarm:',
    '    Type: AWS::CloudWatch::Alarm',
    '    Properties: {Threshold: 70}',
  ],
  medio: [
    'Resources:',
    ' Service:',
    '  Type: AWS::ECS::Service',
    '  Properties:',
    '   LaunchType: FARGATE',
    '   DeploymentController:',
    '    Type: CODE_DEPLOY',
  ],
}

/** Realce: chave YAML, valor (número, tipo AWS, texto), marcas de decisão; no ADR, rótulos em azul. */
function realce(l: string, yaml: boolean): Trecho[] {
  const dois = l.indexOf(':')
  if (dois < 0) return [[l, l.includes('✗') ? COR.nota : CORES.pontuacao]]
  const ind = l.slice(0, l.length - l.trimStart().length)
  const chave = l.slice(ind.length, dois + 1)
  const resto = l.slice(dois + 1)
  const v = resto.trim()
  let cor: string = CORES.pontuacao
  if (yaml) {
    if (/^-?\d+(\.\d+)?$/.test(v)) cor = CORES.numero
    else if (v.startsWith('AWS::')) cor = CORES.tipo
    else if (v && !v.startsWith('{')) cor = CORES.texto
  }
  const out: Trecho[] = [
    [ind, CORES.pontuacao],
    [chave, yaml ? CORES.nome : CORES.palavra],
  ]
  const partes = resto.split(/([✓✗])/)
  for (const p of partes) {
    if (p === '✓') out.push([p, COR.check])
    else if (p === '✗') out.push([p, COR.risco])
    else if (p) out.push([p, cor])
  }
  return out
}

function cartoes(f: Formato): Cartao[] {
  const v = f === 'largo' ? 'largo' : 'medio'
  const adr: Cartao = {
    titulo: 'ADR-012 split monolith',
    icone: 'lightsail',
    linhas: ADR[v],
    de: T.adr,
    ate: 1.35,
    yaml: false,
  }
  const api: Cartao = {
    titulo: 'orders.openapi.yaml',
    icone: 'apigateway',
    linhas: OPENAPI[v],
    de: T.openapi,
    ate: 2.4,
    yaml: true,
  }
  const cfn: Cartao = {
    titulo: 'service.cfn.yaml',
    icone: 'cloudformation',
    linhas: CFN[v],
    de: T.cfn,
    ate: 3.15,
    yaml: true,
  }
  // No 1024 os três não cabem legíveis: o contrato OpenAPI fica na seta API Gateway → ALB e o do evento no assíncrono.
  return f === 'largo' ? [adr, api, cfn] : [adr, cfn]
}

const PAD = 6
const VAO = 6

/** Os três cartões lado a lado na zona `z`; o corpo encolhe (até 9,5 px) para caber na largura. */
export function blocoCartoes(tl: Tela, z: Quadro) {
  const cs = cartoes(tl.f)
  const larg = cs.map((c) => Math.max(...c.linhas.map((l) => l.length), c.titulo.length + 3))
  let px = TAM[tl.f].mono
  const cw = (p: number) => tl.p.medir(`${p}px ${MONO}`, 'M')
  const total = (p: number) => larg.reduce((s, n) => s + n * cw(p) + 2 * PAD, 0) + VAO * (cs.length - 1)
  while (px > 9.5 && total(px) > z.x1 - z.x0) px -= 0.5
  const fonte = `${px}px ${MONO}`
  const lh = px * 1.32
  let x = z.x0
  cs.forEach((c, i) => {
    const w = (larg[i] ?? 0) * cw(px) + 2 * PAD
    const cabem = Math.max(1, Math.floor((z.y1 - z.y0 - 2 * PAD) / lh) - 1)
    const linhas = c.linhas.slice(0, cabem)
    const h = (linhas.length + 1) * lh + 2 * PAD
    const n = linhas.reduce((s, l) => s + l.length, 0) + c.titulo.length
    const dt = (c.ate - c.de) / Math.max(1, n)
    // Moldura discreta com fundo escuro (o texto lê sobre o preto do site).
    tl.p.forma({ t: c.de }, (ctx, tinta, dados) => {
      ctx.fillStyle = tinta(dados ? '' : 'rgba(17, 20, 26, 0.85)')
      ctx.fillRect(x, z.y0, w, h)
      ctx.strokeStyle = tinta('#2c323c')
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, z.y0 + 0.5, w - 1, h - 1)
    })
    const li = Math.round(px * 1.15)
    const yt = z.y0 + PAD + lh / 2
    const x0 = x
    const xi = x0 + PAD + li / 2
    tl.p.imagem({ t: c.de }, xi, yt, li, (ctx) => desenharIcone(ctx, tl.img, c.icone, xi, yt, li))
    tl.p.texto({ t: c.de }, x + PAD + li + 5, yt, `600 ${fonte}`, [[c.titulo, CORES.funcao]], dt)
    let k = c.titulo.length
    linhas.forEach((l, j) => {
      const y = yt + (j + 1) * lh
      tl.p.texto({ t: c.de + k * dt }, x0 + PAD, y, fonte, realce(l, c.yaml), dt)
      k += l.length
    })
    x += w + VAO
  })
}
