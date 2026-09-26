// Métricas de site do adereço vestido (ficha da vida `vela`, §Harmonização e §Composição), no site real (pnpm dev da
// 5199, SwiftShader) pelo gancho window.__heroDebug.medidas (src/features/hero/scene/dev/medidas.ts). Cada tela:
//  - contraste íris × esclera visto pela lente ÷ o mesmo sem óculos (mesmos pixels, mesmo quadro: olhar e piscar iguais);
//  - % dos pixels visíveis do boné estourados (algum canal ≥ 250) e luma ≥ 250;
//  - queda de luminância da faixa da testa logo abaixo da aba (com boné × sem boné, mesmos pixels);
//  - caixa em px CSS de cada nó (boné, óculos, barcos), respiro até texto/interface e borda, parte atrás da cabeça;
//  - chamadas de desenho e triângulos da peça na página (renderer.info com e sem a peça).
// Uso: node 3d/tools/props/medidas_vela.mjs <pasta> <rótulo> [--telas=1440x900,...] [--espera=16000]
//        [--caso=lente-opaca|bone-estourado|sem-sombra|sobre-texto|chamadas] [--nomes=v0]
// --caso aplica um caso ruim conhecido na página antes de medir (prova de que a métrica reprova). --nomes=v0 mede o
// blockout de primitivas (grupos nomeados à mão). Sai 1 se algo reprovar. Luma Rec.709 sobre os bytes sRGB da tela.
import { mkdirSync, writeFileSync } from 'node:fs'
import { TELAS, abrir, extras, launch, retangulosUi } from './site.mjs'
import { medirNaPagina } from './medidas_vela_pagina.mjs'

const { espera, resto } = extras(process.argv.slice(2))
const pos = resto.filter((a) => !a.startsWith('--'))
const opt = (k) => resto.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const [pasta = '3d/captura/props/vela/v1/site/medidas', rot = 'medidas'] = pos
const caso = opt('caso') ?? null
const telasPedidas = opt('telas')?.split(',')
const telas = TELAS.filter(([w, h]) => !telasPedidas || telasPedidas.includes(`${w}x${h}`))
mkdirSync(pasta, { recursive: true })

/** Contrato de nomes do glb (FICHA §Técnica) e do busto (rig.ts). */
const NOMES = {
  oculos: '^vela_oculos$',
  lente: '^vela_lente$|lente',
  bone: '^vela_bone$',
  sombra: '[Ss]ombra',
  // Flutuantes (respiro ≥ 24 px de texto e borda); o primeiro é o que o caso `sobre-texto` empurra.
  barcos: ['vela_laser', 'vela_optimist', 'vela_lais'],
  vestidos: ['vela_bone', 'vela_oculos'],
  nos: ['vela_bone', 'vela_oculos', 'vela_laser', 'vela_optimist', 'vela_lais', 'vela_apito'],
}
// Blockout de primitivas: as malhas da lente não têm nome; a lente é o óculos inteiro.
if (opt('nomes') === 'v0') NOMES.lente = '^vela_oculos$'
/** Limites da ficha. */
const LIM = { contrasteRazaoMin: 0.5, estouroMax: 0.005, quedaTestaMin: 0.15, respiroMin: 24, chamadas: 14, tris: 30000 }

const r = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)

async function medirTela(browser, [w, h, dsf]) {
  const tela = `${w}x${h}`
  const { ctx, page } = await abrir(browser, { viewport: { width: w, height: h }, dsf, query: 'slot=vela&d=0' })
  await page.waitForTimeout(espera)
  const ui = await retangulosUi(page)
  // Sem GPU o quadro demora: prazo longo no screenshot.
  if (!caso) await page.screenshot({ path: `${pasta}/${rot}-${tela}.png`, timeout: 180_000 })
  const m = await page.evaluate(medirNaPagina, { nomes: NOMES, caso })
  const info = await page.evaluate(() => window.__heroDebug.info())
  if (caso) await page.screenshot({ path: `${pasta}/${rot}-${tela}.png`, timeout: 180_000 })
  await ctx.close()
  return { tela, ui, m, info }
}

/** Menor distância entre dois retângulos (0 se se tocam ou cruzam). */
function vao(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

function julgar({ tela, ui, m, info }) {
  const falhas = []
  const out = { tela, dpr: m.dpr }
  // Contraste: só 1440 e 1024 (no 360 o olho tem poucos pixels).
  if (tela !== '360x740') {
    out.contraste = m.contraste
    for (const [olho, c] of Object.entries(m.contraste)) {
      if (c.razao == null) falhas.push(`${tela}: contraste do ${olho} não obtido (${c.motivo})`)
      else if (c.razao < LIM.contrasteRazaoMin)
        falhas.push(`${tela}: contraste do ${olho} pela lente ${r(c.razao * 100)}% do sem óculos (mín. 50%)`)
    }
  }
  out.bone = { ...m.bone, pctCanal: r(m.bone.pctCanal * 100, 2), pctLuma: r(m.bone.pctLuma * 100, 2) }
  if (tela === '1440x900') {
    if (!m.bone.px) falhas.push(`${tela}: boné sem pixel visível`)
    else if (m.bone.pctCanal >= LIM.estouroMax)
      falhas.push(`${tela}: ${r(m.bone.pctCanal * 100, 2)}% do boné com canal ≥ 250 (máx. 0,5%)`)
  }
  out.testa = { ...m.testa, queda: r(m.testa.queda * 100) }
  if (tela !== '360x740') {
    if (m.testa.queda == null) falhas.push(`${tela}: faixa da testa não obtida (${m.testa.motivo})`)
    else if (m.testa.queda < LIM.quedaTestaMin)
      falhas.push(`${tela}: testa sob a aba escurece ${r(m.testa.queda * 100)}% (mín. 15%)`)
  }
  const rects = Object.entries(ui.rects)
  out.nos = {}
  for (const [nome, n] of Object.entries(m.nos)) {
    if (!n.box) {
      out.nos[nome] = { visivel: false }
      if (NOMES.vestidos.includes(nome)) falhas.push(`${tela}: ${nome} sem pixel (boné e óculos nunca somem)`)
      continue
    }
    const b = n.box
    const borda = Math.min(b.x, b.y, ui.canvas.w - (b.x + b.w), ui.canvas.h - (b.y + b.h))
    const perto = rects.map(([k, rr]) => [k, vao(b, rr)]).sort((a, c) => a[1] - c[1])[0] ?? ['nenhum', Infinity]
    out.nos[nome] = {
      box: [r(b.x), r(b.y), r(b.w), r(b.h)],
      maiorLadoSobreCabeca: m.cabecaPx ? r(Math.max(b.w, b.h) / m.cabecaPx, 2) : null,
      respiroUi: [perto[0], r(perto[1])],
      respiroBorda: r(borda),
      atrasDaCabeca: r(n.oculta * 100),
    }
    if (NOMES.barcos.includes(nome)) {
      if (perto[1] < LIM.respiroMin) falhas.push(`${tela}: ${nome} a ${r(perto[1])} px de ${perto[0]} (mín. 24)`)
      if (borda < LIM.respiroMin) falhas.push(`${tela}: ${nome} a ${r(borda)} px da borda (mín. 24)`)
    }
  }
  out.cabecaPx = r(m.cabecaPx)
  const calls = info.sem ? info.com.calls - info.sem.calls : null
  const tris = info.sem ? info.com.triangulos - info.sem.triangulos : null
  out.orcamento = { chamadas: calls, triangulos: tris, programas: info.programas }
  if (calls > LIM.chamadas) falhas.push(`${tela}: ${calls} chamadas da peça (máx. ${LIM.chamadas})`)
  if (tris > LIM.tris) falhas.push(`${tela}: ${tris} triângulos da peça (máx. ${LIM.tris})`)
  if (m.caso) out.caso = m.caso
  return { ...out, falhas }
}

const browser = await launch()
const res = []
for (const t of telas) res.push(julgar(await medirTela(browser, t)))
await browser.close()
const falhas = res.flatMap((t) => t.falhas)
const saida = { rotulo: rot, caso, limites: LIM, nomes: NOMES, gerado: new Date().toISOString(), telas: res }
writeFileSync(`${pasta}/${rot}.json`, JSON.stringify(saida, null, 2))
for (const t of res) {
  const c = t.contraste ? Object.entries(t.contraste).map(([k, v]) => `${k} ${r((v.razao ?? NaN) * 100)}%`) : []
  console.log(
    `${t.tela}: contraste ${c.join(' ') || '-'} | boné ≥250 ${t.bone.pctCanal}% | testa −${t.testa.queda}% |` +
      ` chamadas ${t.orcamento.chamadas} tri ${t.orcamento.triangulos}`,
  )
  for (const [k, v] of Object.entries(t.nos)) console.log(`   ${k}: ${JSON.stringify(v)}`)
}
console.log(falhas.length ? `REPROVA\n - ${falhas.join('\n - ')}` : 'PASSA')
console.log(`→ ${pasta}/${rot}.json`)
process.exitCode = falhas.length ? 1 : 0
