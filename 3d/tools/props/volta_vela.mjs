// Uma volta da aula de vela no site real (pnpm dev da 5199, SwiftShader), com relógio falso: quadros a cada 0,25 s de
// cena desde a MONTAGEM da vida (t=0 no auge do furacão) e, em cada quadro, o portão arte ↔ cena (olhos e boca, texto
// e interface, borda) e a legibilidade (fração visível de cada barco; ao menos um barco inteiro na janela da vida).
// Uso: node 3d/tools/props/volta_vela.mjs <pasta> <rótulo> [--telas=1440x900,1024x768,360x740] [--tempos=0,0.25,...]
//        [--reduzido]
// Grava <rótulo>-volta-<tela>-<t>s.png (tela inteira) e <rótulo>-volta.json. Sai 1 se algum quadro reprovar.
import { writeFileSync, mkdirSync } from 'node:fs'
import { LIMITES as L } from './limites.mjs'
import { TELAS, abrir, dilatar, extras, launch, retangulosUi } from './site.mjs'

const { reduzido, tempos, resto } = extras(process.argv.slice(2))
const pos = resto.filter((a) => !a.startsWith('--'))
const [pasta = '3d/captura/props/vela/v1/site', rot = 'v1'] = pos
const pedidas = resto.find((a) => a.startsWith('--telas='))?.slice(8).split(',')
const telas = TELAS.filter(([w, h]) => (pedidas ?? ['1440x900']).includes(`${w}x${h}`))
const ts = tempos ?? Array.from({ length: 17 }, (_, i) => i * 0.25)
const sufixo = reduzido ? '-reduzido' : ''
/** Janela da vida em que a peça tem de ler: cabeça completa (1 s) até o começo da saída (3,5 s). */
const JANELA = [1, 3.5]
const BARCOS = ['vela_laser', 'vela_optimist']
/** Barco "inteiro visível": fração da silhueta não escondida pela cabeça. */
const INTEIRO = 0.9
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

/** No navegador: máscaras da peça (portão) e fração visível de cada barco. */
function medirQuadro({ rects, barcos }) {
  const H = window.__heroDebug
  const M = H.medidas
  const m = H.masks(rects, false)
  const k = m.dpr
  const vis = {}
  for (const b of barcos) {
    const regras = (bust) => [...(bust ? [] : [['^bust$', 'oculto']]), [`^${b}$`, 'preto'], ['^prop$', 'oculto']]
    const conta = (mask) => mask.data.reduce((s, v) => s + v, 0)
    const tot = conta(M.mascara(regras(false)))
    vis[b] = tot ? conta(M.mascara(regras(true))) / tot : 0
  }
  // Olhos e boca: só o que NAVEGA conta (óculos e boné são vestidos de propósito sobre o rosto).
  const nav = M.mascara([[`^(${barcos.join('|')})$`, 'preto'], ['^prop$', 'oculto']])
  const rosto = m.rosto.map((z) => {
    const [cx, cy, r] = [z.centro[0] * k, z.centro[1] * k, z.raio * k]
    let n = 0
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(nav.h, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(nav.w, Math.ceil(cx + r)); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) n += nav.data[y * nav.w + x]
    return [z.nome, Math.round(n / (k * k))]
  })
  return {
    rosto,
    sobreUi: Object.entries(m.sobreUi).filter(([, px]) => px > 0),
    box: m.peca.box,
    dpr: k,
    visivel: vis,
  }
}

const browser = await launch()
const saida = {}
const falhas = []
for (const [w, h, dsf] of telas) {
  const tela = `${w}x${h}`
  const { ctx, page, vidaInicial: alvo } = await abrir(browser, {
    viewport: { width: w, height: h },
    dsf,
    query: 'slot=vela',
    reduzido,
    relogio: true,
  })
  // O relógio falso nasceu no carregamento: pausa 1 s à frente do relógio DA PÁGINA (não do Node).
await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  const vidas = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.getAttribute('aria-label') ?? ''),
  )
  await montar(page, vidas[(vidas.indexOf(alvo) + 1) % vidas.length])
  await montar(page, alvo)
  const ui = await retangulosUi(page)
  const rects = Object.fromEntries(Object.entries(ui.rects).map(([k, r]) => [k, dilatar(r, L.arteCena.margemUi)]))
  const quadros = []
  let agora = 0
  for (const t of ts) {
    await page.clock.runFor(Math.max(0, Math.round((t - agora) * 1000)))
    agora = t
    await page.screenshot({ path: `${pasta}/${rot}-volta-${tela}-${t.toFixed(2)}s${sufixo}.png`, timeout: 180_000 })
    const q = await page.evaluate(medirQuadro, { rects, barcos: BARCOS })
    const b = q.box
    const borda = b && Math.min(b.x, b.y, ui.canvas.w - (b.x + b.w), ui.canvas.h - (b.y + b.h))
    const naJanela = t >= JANELA[0] && t <= JANELA[1]
    const inteiro = BARCOS.some((n) => q.visivel[n] >= INTEIRO)
    const f = []
    for (const [z, px] of q.rosto) if (px > L.arteCena.pxRostoMax) f.push(`${px} px sobre ${z}`)
    for (const [n, px] of q.sobreUi) f.push(`${Math.round(px)} px sobre ${n}`)
    if (borda != null && borda < L.arteCena.bordaMinPx) f.push(`encosta na borda (${Math.round(borda)} px)`)
    if (naJanela && !inteiro) f.push('nenhum barco inteiro visível')
    // Só reprova dentro da janela da vida (antes de 1 s a cabeça ainda se forma; depois de 3,5 s ela se desfaz).
    if (naJanela) for (const x of f) falhas.push(`${tela} t=${t}: ${x}`)
    quadros.push({ t, ...q, borda, inteiro, falhas: f })
  }
  saida[tela] = quadros
  await ctx.close()
}
await browser.close()
writeFileSync(`${pasta}/${rot}-volta${sufixo}.json`, JSON.stringify({ janela: JANELA, inteiro: INTEIRO, telas: saida }, null, 2))
for (const [tela, qs] of Object.entries(saida)) {
  for (const q of qs) {
    const v = BARCOS.map((n) => `${n.slice(5)} ${Math.round(q.visivel[n] * 100)}%`).join(' ')
    console.log(`${tela} t=${q.t.toFixed(2)} ${v} ${q.falhas.join('; ')}`)
  }
}
console.log(falhas.length ? `REPROVA\n - ${falhas.join('\n - ')}` : 'PASSA')
process.exitCode = falhas.length ? 1 : 0
