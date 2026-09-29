// J74: referências medidas pelo próprio adereço (estado.ref do devops, estado.medida do techlead) e as zonas por tela.
// Uso: node 3d/tools/j74_medir.mjs [vida,vida] [WxH,WxH]  (servidor do Fael na 5199; movimento reduzido)
import { writeFileSync } from 'node:fs'
import { abrir, launch } from './props/site.mjs'

const vidas = (process.argv[2] ?? 'devops,techlead').split(',')
const telas = (process.argv[3] ?? '320x568,360x780,390x844,800x360,768x1024,1280x800,1440x900,1920x1080,1366x657')
  .split(',')
  .map((t) => t.split('x').map(Number))
const GRUPO = { devops: 'arq_fundo', techlead: 'tl_fundo' }
const f = (q) => (q ? `${q.x0.toFixed(0)},${q.y0.toFixed(0)}–${q.x1.toFixed(0)},${q.y1.toFixed(0)}` : '-')
const browser = await launch()
const saida = {}
for (const vida of vidas)
  for (const [w, h] of telas) {
    const { ctx, page } = await abrir(browser, {
      viewport: { width: w, height: h },
      dsf: w < 700 ? 2 : 1,
      query: `slot=${vida}&d=0`,
      reduzido: true,
    })
    await page.waitForTimeout(7000)
    const e = await page.evaluate((g) => {
      const est = window.__heroDebug?.medidas.objeto(g)?.userData.estado
      return est ? JSON.parse(JSON.stringify({ ref: est.ref ?? est.medida, zonas: est.zonas })) : null
    }, GRUPO[vida])
    saida[`${vida}-${w}x${h}`] = e
    const r = e?.ref
    console.log(
      `${vida} ${w}x${h} ui ${f(r?.ui)} topo ${r?.topo} cabeça ${f(r?.cabeca)} mesa ${f(r?.mesa)} balão ${f(r?.balao)}`,
    )
    const zs = Object.entries(e?.zonas ?? {}).filter(([, q]) => !q || 'x0' in q)
    console.log(`   zonas ${zs.map(([k, q]) => `${k}:${f(q)}`).join(' ')} fluxo/chamada ${JSON.stringify(e?.zonas?.fluxo ?? e?.zonas?.chamada ?? null)}`)
    await ctx.close()
  }
writeFileSync('3d/captura/j74/referencias.json', JSON.stringify(saida, null, 1))
await browser.close()
