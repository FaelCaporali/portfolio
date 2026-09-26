// Folga barco × busto numa volta inteira da aula de vela, no site real (pnpm dev da 5199), com relógio falso: a cada
// passo (padrão 1/15 s de cena, t de 0 a 3 s desde a montagem), a distância mínima com sinal de cada barco (casco,
// vela, retranca, mastro, biruta, fitas: tudo sob o nó) até a malha do busto na expressão da vida, no espaço do glb
// (window.__heroDebug.medidas.folga). Olhar e arrasto giram cabeça e barcos juntos (filhos do frame): não mudam a folga.
// Uso: node 3d/tools/props/folga_vela.mjs <pasta> <rótulo> [--passo=0.0667] [--min=0.005] [--inicio=0] [--fim=3]
// Grava <rótulo>-folga.json e a captura (1440×900) de cada quadro abaixo do mínimo. Sai 1 se algum quadro reprovar.
import { mkdirSync, writeFileSync } from 'node:fs'
import { abrir, launch } from './site.mjs'

const args = process.argv.slice(2)
const [pasta = '3d/captura/props/vela/v1/site', rot = 'v1'] = args.filter((a) => !a.startsWith('--'))
const opt = (k, d) => Number(args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d)
const passo = opt('passo', 1 / 15)
const MIN = opt('min', 0.005)
const fim = opt('fim', 3)
const inicio = opt('inicio', 0)
const BARCOS = ['^vela_laser$', '^vela_optimist$']
mkdirSync(pasta, { recursive: true })

const palavra = (page) =>
  page.evaluate(() => document.querySelector('.slot-word:not(.is-leaving)')?.textContent?.replace(/\s+/g, ' ').trim())

async function montar(page, vida) {
  await page.evaluate(
    (v) => [...document.querySelectorAll('nav[aria-label="Timeline"] button')].find((b) => b.ariaLabel === v)?.click(),
    vida,
  )
  for (let i = 0; i < 300; i++) {
    await page.clock.runFor(20)
    if ((await palavra(page))?.includes(vida)) return
  }
  throw new Error(`a vida ${vida} não montou`)
}

const browser = await launch()
const { ctx, page, vidaInicial: alvo } = await abrir(browser, {
  viewport: { width: 1440, height: 900 },
  query: 'slot=vela',
  relogio: true,
})
page.on('framenavigated', () => console.error('a página recarregou (glb ou código mudou): medida inválida'))
// O relógio falso nasceu no carregamento: pausa 1 s à frente do relógio DA PÁGINA (não do Node).
await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
const vidas = await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.getAttribute('aria-label') ?? ''),
)
await montar(page, vidas[(vidas.indexOf(alvo) + 1) % vidas.length])
await montar(page, alvo)
const quadros = []
let agora = 0
for (let t = inicio; t <= fim + 1e-9; t += passo) {
  await page.clock.runFor(Math.max(0, Math.round((t - agora) * 1000)))
  agora = t
  const f = await page.evaluate((p) => {
    if (!window.__heroDebug) throw new Error('gancho de depuração ausente (página recarregou?)')
    return window.__heroDebug.medidas.folga(p, 0.03)
  }, BARCOS)
  const q = { t: Math.round(t * 1000) / 1000 }
  for (const b of BARCOS) q[b.replace(/\W/g, '')] = { mm: Math.round(f[b].min * 10000) / 10, parte: f[b].parte, ponto: f[b].ponto?.map((x) => +x.toFixed(4)) }
  const pior = Math.min(...BARCOS.map((b) => f[b].min))
  q.ok = pior >= MIN
  if (!q.ok) {
    q.captura = `${pasta}/${rot}-folga-${t.toFixed(2)}s.png`
    await page.screenshot({ path: q.captura, timeout: 180_000 })
  }
  quadros.push(q)
  console.log(`t=${t.toFixed(2)} ${BARCOS.map((b) => `${b.slice(6, -1)} ${q[b.replace(/\W/g, '')].mm} mm`).join(' ')}`)
}
await ctx.close()
await browser.close()
const ruins = quadros.filter((q) => !q.ok)
const minimo = Math.min(...quadros.flatMap((q) => BARCOS.map((b) => q[b.replace(/\W/g, '')].mm)))
writeFileSync(`${pasta}/${rot}-folga.json`, JSON.stringify({ minMm: MIN * 1000, passo, minimo, ruins: ruins.length, quadros }, null, 2))
console.log(ruins.length ? `REPROVA: ${ruins.length} quadros abaixo de ${MIN * 1000} mm (mín. ${minimo} mm)` : `PASSA (mín. ${minimo} mm)`)
process.exitCode = ruins.length ? 1 : 0
