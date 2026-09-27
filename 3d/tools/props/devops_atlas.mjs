// Atlas de ícones da vida devops (FICHA-PRODUCAO, FECHAMENTO; REQUISITOS D5, D10, D11): os SVGs oficiais de
// 3d/referencias/props/devops/logos/ (fonte e termos em FONTES.md) rasterizados pelo Chromium numa grade de células
// quadradas e gravados num WebP único em src/features/hero/scene/props/devops/icones.webp (o site não baixa nada de
// fora: CSP). A ORDEM das células é a de ICONES em src/features/hero/scene/props/devops/icones.ts: conferir as duas
// listas ao mudar qualquer uma (o script imprime a lista na ordem gravada).
// Uso: node 3d/tools/props/devops_atlas.mjs [--previa=<png>]   (a prévia rotulada serve para conferir o recorte)
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const RAIZ = new URL('../../../', import.meta.url).pathname
const LOGOS = `${RAIZ}3d/referencias/props/devops/logos`
const SAIDA = `${RAIZ}src/features/hero/scene/props/devops/icones.webp`
const CELULA = 96
const COLUNAS = 7
/** Margem interna da célula (px): o ícone cabe inteiro, sem encostar no vizinho (filtro linear). */
const MARGEM = 4

/** [nome, arquivo relativo a LOGOS, cor de preenchimento (só nos glifos de uma cor do Simple Icons)]. */
const ICONES = [
  ['route53', 'aws/Arch_Amazon-Route-53_48.svg'],
  ['cloudfront', 'aws/Arch_Amazon-CloudFront_48.svg'],
  ['s3', 'aws/Arch_Amazon-Simple-Storage-Service_48.svg'],
  ['apigateway', 'aws/Arch_Amazon-API-Gateway_48.svg'],
  ['elb', 'aws/Arch_Elastic-Load-Balancing_48.svg'],
  ['alb', 'aws/Res_Elastic-Load-Balancing_Application-Load-Balancer_48.svg'],
  ['ecs', 'aws/Arch_Amazon-Elastic-Container-Service_48.svg'],
  ['fargate', 'aws/Arch_AWS-Fargate_48.svg'],
  ['task', 'aws/Res_Amazon-Elastic-Container-Service_Task_48.svg'],
  ['rds', 'aws/Arch_Amazon-RDS_48.svg'],
  ['dynamodb', 'aws/Arch_Amazon-DynamoDB_48.svg'],
  ['vpc', 'aws/Arch_Amazon-Virtual-Private-Cloud_48.svg'],
  ['cloudformation', 'aws/Arch_AWS-CloudFormation_48.svg'],
  ['codepipeline', 'aws/Arch_AWS-CodePipeline_48.svg'],
  ['codebuild', 'aws/Arch_AWS-CodeBuild_48.svg'],
  ['codedeploy', 'aws/Arch_AWS-CodeDeploy_48.svg'],
  ['lightsail', 'aws/Arch_Amazon-Lightsail_48.svg'],
  ['cloudwatch', 'aws/Arch_Amazon-CloudWatch_48.svg'],
  ['alarme', 'aws/Res_Amazon-CloudWatch_Alarm_48.svg'],
  ['ses', 'aws/Arch_Amazon-Simple-Email-Service_48.svg'],
  ['sns', 'aws/Arch_Amazon-Simple-Notification-Service_48.svg'],
  ['sqs', 'aws/Arch_Amazon-Simple-Queue-Service_48.svg'],
  ['iam', 'aws/Arch_AWS-Identity-and-Access-Management_48.svg'],
  ['secrets', 'aws/Arch_AWS-Secrets-Manager_48.svg'],
  ['lambda', 'aws/Arch_AWS-Lambda_48.svg'],
  ['usuarios', 'aws/Res_Users_48_Dark.svg'],
  ['g_nuvem', 'aws/AWS-Cloud-logo_32_Dark.svg'],
  ['g_vpc', 'aws/Virtual-private-cloud-VPC_32.svg'],
  ['g_publica', 'aws/Public-subnet_32.svg'],
  ['g_privada', 'aws/Private-subnet_32.svg'],
  ['g_asg', 'aws/Auto-Scaling-group_32.svg'],
  ['docker', 'ferramentas/docker-simpleicons.svg', '#2496ED'],
  ['redis', 'ferramentas/redis-simpleicons.svg', '#FF4438'],
  ['rabbitmq', 'ferramentas/rabbitmq-oficial.svg'],
  ['sentry', 'ferramentas/sentry-simpleicons.svg', '#FFFFFF'],
  ['datadog', 'ferramentas/datadog-simpleicons.svg', '#FFFFFF'],
  // Cabeça do ouriço: preta (#111) no arquivo; clara no fundo escuro, como a versão escura do site da marca.
  ['posthog', 'ferramentas/posthog-oficial.svg', null, ['fill="#111"', 'fill="#F3F4F6"']],
  ['grafana', 'ferramentas/grafana-oficial.svg'],
  ['prometheus', 'ferramentas/prometheus-cncf.svg'],
]

const previa = process.argv.find((a) => a.startsWith('--previa='))?.slice(9)
const svg = (arq, cor, troca) => {
  let s = readFileSync(`${LOGOS}/${arq}`, 'utf8')
  if (troca) s = s.replaceAll(troca[0], troca[1])
  // Glifo de uma cor do Simple Icons (sem fill): a cor oficial da marca, ou branco onde ela some no fundo escuro.
  if (cor) s = s.replace('<svg ', `<svg fill="${cor}" `)
  return `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`
}
const itens = ICONES.map(([nome, arq, cor, troca]) => ({ nome, url: svg(arq, cor, troca) }))

const browser = await chromium.launch()
const page = await browser.newPage()
const r = await page.evaluate(
  async ({ itens, CELULA, COLUNAS, MARGEM, rotulos }) => {
    const linhas = Math.ceil(itens.length / COLUNAS)
    const c = document.createElement('canvas')
    c.width = COLUNAS * CELULA
    c.height = linhas * CELULA
    const ctx = c.getContext('2d')
    for (const [i, it] of itens.entries()) {
      const img = new Image()
      img.src = it.url
      await img.decode()
      const w = img.naturalWidth || 48
      const h = img.naturalHeight || 48
      const k = (CELULA - 2 * MARGEM) / Math.max(w, h)
      const x = (i % COLUNAS) * CELULA + (CELULA - w * k) / 2
      const y = Math.floor(i / COLUNAS) * CELULA + (CELULA - h * k) / 2
      ctx.drawImage(img, x, y, w * k, h * k)
    }
    const webp = c.toDataURL('image/webp', 0.9)
    if (!rotulos) return { webp }
    const p = document.createElement('canvas')
    p.width = c.width
    p.height = c.height + linhas * 14
    const q = p.getContext('2d')
    q.fillStyle = '#0b0b0e'
    q.fillRect(0, 0, p.width, p.height)
    q.font = '11px sans-serif'
    q.fillStyle = '#ccc'
    for (let l = 0; l < linhas; l++) {
      q.drawImage(c, 0, l * CELULA, c.width, CELULA, 0, l * (CELULA + 14), c.width, CELULA)
      for (let k = 0; k < COLUNAS; k++) {
        const it = itens[l * COLUNAS + k]
        if (it) q.fillText(it.nome, k * CELULA + 4, l * (CELULA + 14) + CELULA + 11)
      }
    }
    return { webp, png: p.toDataURL('image/png') }
  },
  { itens, CELULA, COLUNAS, MARGEM, rotulos: Boolean(previa) },
)
await browser.close()
const bin = Buffer.from(r.webp.split(',')[1], 'base64')
writeFileSync(SAIDA, bin)
if (previa && r.png) writeFileSync(previa, Buffer.from(r.png.split(',')[1], 'base64'))
console.log(`atlas ${COLUNAS}x${Math.ceil(ICONES.length / COLUNAS)} células de ${CELULA} px, ${(bin.length / 1024).toFixed(1)} kB`)
console.log(ICONES.map(([n]) => n).join(','))
