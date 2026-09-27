/**
 * Atlas de ícones da vida devops (REQUISITOS D5, D10, D11): os 22 serviços AWS pelo pacote oficial AWS Architecture
 * Icons (release 07/2026), os grupos do diagrama (AWS Cloud, VPC, subnets, Auto Scaling) e as ferramentas pelos logos
 * oficiais; fonte e termos de cada um em 3d/referencias/props/devops/logos/FONTES.md. Um WebP local gerado por
 * 3d/tools/props/devops_atlas.mjs (nada vem de fora: CSP). A ORDEM de ICONES é a das células do script.
 */
import atlasUrl from './icones.webp?url'

export const ICONES = [
  'route53',
  'cloudfront',
  's3',
  'apigateway',
  'elb',
  'alb',
  'ecs',
  'fargate',
  'task',
  'rds',
  'dynamodb',
  'vpc',
  'cloudformation',
  'codepipeline',
  'codebuild',
  'codedeploy',
  'lightsail',
  'cloudwatch',
  'alarme',
  'ses',
  'sns',
  'sqs',
  'iam',
  'secrets',
  'lambda',
  'usuarios',
  'g_nuvem',
  'g_vpc',
  'g_publica',
  'g_privada',
  'g_asg',
  'docker',
  'redis',
  'rabbitmq',
  'sentry',
  'datadog',
  'posthog',
  'grafana',
  'prometheus',
] as const

export type Icone = (typeof ICONES)[number]

/** Célula do atlas (px) e colunas da grade: as do script. */
const CELULA = 96
const COLUNAS = 7

/** Carrega o atlas (uma vez por montagem da vida; o navegador guarda em cache). */
export function carregarAtlas(): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = atlasUrl
  return img.decode().then(() => img)
}

/** Desenha o ícone `id` com centro (x, y) e lado `lado` (unidades do contexto). */
export function desenharIcone(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  id: Icone,
  x: number,
  y: number,
  lado: number,
) {
  const i = ICONES.indexOf(id)
  const sx = (i % COLUNAS) * CELULA
  const sy = Math.floor(i / COLUNAS) * CELULA
  ctx.drawImage(img, sx, sy, CELULA, CELULA, x - lado / 2, y - lado / 2, lado, lado)
}
