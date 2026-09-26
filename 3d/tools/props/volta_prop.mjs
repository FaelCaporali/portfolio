// Volta de um adereço no site real (pnpm dev da 5199, SwiftShader), por vida, com relógio falso: quadros a cada
// 0,25 s de cena desde a MONTAGEM da vida (t=0 no auge do furacão) e, em cada quadro, o portão arte ↔ cena: nada da
// peça sobre texto/interface (com respiro) nem perto da borda; olhos e boca livres; íris livre das lágrimas; respiro do
// aro ao lábio inferior; caixas das partes (px CSS). A parte abaixo do meio do degradê próprio da peça não conta.
// Com --poses, o mesmo portão nas poses (olhar nos 4 cantos e no centro, arrasto para os lados e para cima), com a
// vida parada (?d=0) e o tempo real (o olhar amortece em alguns segundos).
// Generaliza volta_vela.mjs (que continua valendo para a vela) para as vidas da tabela VIDAS.
// Uso: node 3d/tools/props/volta_prop.mjs <vida> <pasta> <rótulo> [--telas=1440x900,1024x768,360x740]
//        [--tempos=0,0.25,...] [--reduzido] [--janela=1,3.5] [--respiro=16] [--borda=16] [--aro=12,8,4] [--poses]
//        [--caso=aro-na-boca|sobre-texto]   (caso ruim conhecido: o portão TEM de reprovar)
// Grava <rótulo>-volta-<tela>-<t|pose>.png e <rótulo>-volta[-reduzido][-<caso>].json. Sai 1 se reprovar.
import { mkdirSync, writeFileSync } from 'node:fs'
import { LIMITES as L } from './limites.mjs'
import { TELAS, abrir, dilatar, extras, launch, retangulosUi } from './site.mjs'
import { aplicarCaso, labioInferior, medirQuadroProp, rectsTitulo } from './volta_prop_pagina.mjs'

/** Padrões por vida (nome da malha, de um ancestral até o frame, ou do material). */
const VIDAS = {
  uber: {
    pecas: {
      tudo: '^uber$',
      volante: '^uber_volante$',
      maos: '^uber_mao_',
      rastro: '^uber_lagrima_(esq|dir)_rastro',
      gota: '^uber_lagrima_(esq|dir)_gota$',
      celular: '^uber_celular$',
      tela: '^uber_celular_tela',
    },
    // O que não pode cobrir olhos e boca (as lágrimas descem da pálpebra de propósito: medidas contra a íris).
    rosto: '^uber_(volante|mao_|celular)',
    iris: '^uber_lagrima_',
    // Respiro do lábio ao ARO (a malha do volante; as mãos, filhas dele, respondem pela zona da boca).
    aro: '^uber_volante_malha',
    maos: '^uber_mao_',
    // Centros dos olhos no glb (SITE.md) e raio da íris.
    olhos: [
      [-0.04, 0.18, 0.0],
      [0.04, 0.18, 0.0],
    ],
    irisRaio: 0.006,
  },
}

const { reduzido, tempos, espera, resto } = extras(process.argv.slice(2))
const pos = resto.filter((a) => !a.startsWith('--'))
const [vida = 'uber', pasta = `3d/captura/props/${vida}/v1/volta`, rot = 'v1'] = pos
const cfgVida = VIDAS[vida]
if (!cfgVida) {
  console.error(`vida sem padrões em VIDAS: ${vida} (a vela usa volta_vela.mjs)`)
  process.exit(2)
}
const opc = (k) => resto.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const num = (k, d) => Number(opc(k) ?? d)
const pedidas = opc('telas')?.split(',')
const telas = TELAS.filter(([w, h]) => (pedidas ?? ['1440x900']).includes(`${w}x${h}`))
const ts = tempos ?? Array.from({ length: 17 }, (_, i) => i * 0.25)
const caso = opc('caso')
const comPoses = resto.includes('--poses')
const sufixo = (reduzido ? '-reduzido' : '') + (caso ? `-${caso}` : '')
/** Janela da vida em que a peça tem de ler: cabeça completa (1 s) até o começo da saída (3,5 s). */
const JANELA = opc('janela')?.split(',').map(Number) ?? [1, 3.5]
const RESPIRO = num('respiro', 16)
const BORDA = num('borda', 16)
/** Contraste mínimo de cada glifo do título sobre a peça no retrato estreito (WCAG AA, ADENDO 6). */
const CONTRASTE = 4.5
/** Respiro mínimo do aro à borda do lábio inferior (px CSS) por tela (ficha, ADENDO 6: 12 / 8 / 4). */
const [a1440 = 12, a1024 = 8, a360 = 4] = (opc('aro') ?? '').split(',').filter(Boolean).map(Number)
const ARO = { 1440: a1440, 1024: a1024, 360: a360 }
mkdirSync(pasta, { recursive: true })

const palavra = (page) =>
  page.evaluate(() => document.querySelector('.slot-word:not(.is-leaving)')?.textContent?.replace(/\s+/g, ' ').trim())

async function montar(page, alvo) {
  await page.evaluate(
    (v) => [...document.querySelectorAll('nav[aria-label="Timeline"] button')].find((b) => b.ariaLabel === v)?.click(),
    alvo,
  )
  // A troca pode suspender a cena (glb da outra vida carregando) e desmontar o gancho: espera a vida E o gancho.
  const pronto = () => page.evaluate(() => window.__heroDebug?.ready() === true)
  for (let i = 0; i < 300; i++) {
    await page.clock.runFor(20)
    if ((await palavra(page))?.includes(alvo) && (await pronto())) return
  }
  throw new Error(`a vida ${alvo} não montou`)
}

const browser = await launch()
const saida = {}
const falhas = []
let labio = null
let casoAplicado = null

/**
 * O servidor de desenvolvimento RECARREGA a página quando qualquer arquivo do repositório muda (o plugin do Tailwind
 * varre tudo o que o git não ignora: um .py do modelador basta); recarga no meio invalida a medida, que é refeita do
 * zero (até 6 vezes).
 */
async function comRecarga(nome, fn) {
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    try {
      return await fn()
    } catch (e) {
      console.error(`${nome}: tentativa ${tentativa} perdida (${String(e.message).split('\n')[0]}); refazendo`)
    }
  }
  throw new Error(`${nome}: seis recargas seguidas`)
}

async function naPagina(w, h, dsf, opcoes, fn) {
  const { ctx, page, vidaInicial } = await abrir(browser, { viewport: { width: w, height: h }, dsf, reduzido, ...opcoes })
  let recarregou = false
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) recarregou = true
  })
  try {
    return await fn(page, vidaInicial, () => recarregou)
  } finally {
    await ctx.close()
  }
}

/** Mede e julga um quadro. */
async function quadro(page, w, ui, rects, rotulo, recarregou) {
  if (!labio) labio = await page.evaluate(labioInferior)
  const tela = `${w}x${ui.canvas.h}`
  await page.screenshot({ path: `${pasta}/${rot}-volta-${tela}-${rotulo}${sufixo}.png`, timeout: 180_000 })
  const lab = { labio: labio.labio, borda: labio.borda, sulco: labio.sulco }
  // Retrato estreito: o título sai da regra de 0 px e entra na de legibilidade (botões e links continuam em 0 px).
  const estreito = ui.canvas.w < ui.canvas.h
  const tit = estreito ? await page.evaluate(rectsTitulo) : null
  const dentro = (r, c) => c && r.x >= c.x - 1 && r.y >= c.y - 1 && r.x + r.w <= c.x + c.w + 1 && r.y + r.h <= c.y + c.h + 1
  const rectsQ = tit ? Object.fromEntries(Object.entries(rects).filter(([n]) => !dentro(ui.rects[n], tit.caixa))) : rects
  const q = await page.evaluate(medirQuadroProp, { ...cfgVida, rects: rectsQ, lab, titulo: tit?.glifos })
  if (recarregou()) throw new Error('a página recarregou')
  const b = q.partes.tudo
  const borda = b && Math.min(b.x, b.y, ui.canvas.w - (b.x + b.w), ui.canvas.h - (b.y + b.h))
  const f = []
  for (const [z, px] of q.rosto) if (px > L.arteCena.pxRostoMax) f.push(`${px} px sobre ${z}`)
  for (const [z, px] of q.iris) if (px > 0) f.push(`lágrima ${px} px sobre ${z}`)
  for (const [n, px] of q.sobreUi) f.push(`${px} px sobre ${n}`)
  for (const g of q.titulo ?? []) {
    if (g.mao > 0) f.push(`mão ${g.mao} px sob ${g.nome}`)
    if (g.contraste < CONTRASTE) f.push(`${g.nome} com contraste ${g.contraste}:1 sobre a peça (< ${CONTRASTE})`)
  }
  if (borda != null && borda < BORDA) f.push(`a ${Math.round(borda)} px da borda`)
  const r = q.respiro.borda
  if (r != null && r < (ARO[w] ?? 0)) f.push(`aro a ${r} px do lábio inferior (< ${ARO[w]})`)
  return { ...q, borda, falhas: f }
}

async function volta(w, h, dsf) {
  return naPagina(w, h, dsf, { query: `slot=${vida}`, relogio: true }, async (page, alvo, recarregou) => {
    // O relógio falso nasceu no carregamento: pausa 1 s à frente do relógio DA PÁGINA (não do Node).
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
    const vidas = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.getAttribute('aria-label') ?? ''),
    )
    await montar(page, vidas[(vidas.indexOf(alvo) + 1) % vidas.length])
    await montar(page, alvo)
    const ui = await retangulosUi(page)
    const rects = Object.fromEntries(Object.entries(ui.rects).map(([k, r]) => [k, dilatar(r, RESPIRO)]))
    const quadros = []
    let agora = 0
    for (const t of ts) {
      await page.clock.runFor(Math.max(0, Math.round((t - agora) * 1000)))
      agora = t
      if (caso && agora === ts[0]) casoAplicado = await page.evaluate(aplicarCaso, caso)
      const q = await quadro(page, w, ui, rects, `${t.toFixed(2)}s`, recarregou)
      quadros.push({ t, janela: t >= JANELA[0] && t <= JANELA[1], ...q })
    }
    return quadros
  })
}

/** Poses com a vida parada: olhar nos cantos e no centro, arrasto para os lados e para cima (tempo real). */
async function poses(w, h, dsf) {
  return naPagina(w, h, dsf, { query: `slot=${vida}&d=0` }, async (page, _alvo, recarregou) => {
    await page.waitForTimeout(espera)
    const ui = await retangulosUi(page)
    const rects = Object.fromEntries(Object.entries(ui.rects).map(([k, r]) => [k, dilatar(r, RESPIRO)]))
    const cv = await page.locator('section[aria-label="Apresentação"] canvas').boundingBox()
    const [hx, hy] = await page.evaluate(() => {
      const H = window.__heroDebug
      const k = H.camera().dpr
      return H.medidas.projetar([0, 0.18, 0]).map((v) => v / k)
    })
    const cx = cv.x + hx
    const cy = cv.y + hy
    const saidas = []
    const medir = async (nome) => {
      // O olhar e o giro amortecem ao longo de vários quadros; sem GPU, alguns segundos.
      await page.waitForTimeout(4000)
      saidas.push({ t: nome, janela: true, ...(await quadro(page, w, ui, rects, nome, recarregou)) })
    }
    const cantos = {
      'olhar-sup-esq': [cv.x + 2, cv.y + 2],
      'olhar-sup-dir': [cv.x + cv.width - 2, cv.y + 2],
      'olhar-inf-esq': [cv.x + 2, cv.y + cv.height - 2],
      'olhar-inf-dir': [cv.x + cv.width - 2, cv.y + cv.height - 2],
      'olhar-centro': [cx, cy],
    }
    for (const [nome, [x, y]] of Object.entries(cantos)) {
      await page.mouse.move(x, y, { steps: 4 })
      await medir(nome)
    }
    const d = Math.min(420, w * 0.3)
    const arrastos = { 'arrasto-esq': [-d, 0], 'arrasto-dir': [d, 0], 'arrasto-cima': [0, -Math.min(300, h * 0.3)] }
    for (const [nome, [dx, dy]] of Object.entries(arrastos)) {
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + dx, cy + dy, { steps: 12 })
      await medir(nome)
      await page.mouse.up()
      await page.waitForTimeout(3000)
    }
    return saidas
  })
}

for (const [w, h, dsf] of telas) {
  const tela = `${w}x${h}`
  const qs = await comRecarga(`${tela} volta`, () => volta(w, h, dsf))
  if (comPoses) qs.push(...(await comRecarga(`${tela} poses`, () => poses(w, h, dsf))))
  saida[tela] = qs
  for (const q of qs) if (q.janela) for (const x of q.falhas) falhas.push(`${tela} ${q.t}: ${x}`)
}
await browser.close()
const limites = { respiroUi: RESPIRO, borda: BORDA, aroLabio: ARO, janela: JANELA }
writeFileSync(
  `${pasta}/${rot}-volta${sufixo}.json`,
  JSON.stringify({ vida, limites, caso: casoAplicado, labio, telas: saida, falhas }, null, 2),
)
for (const [tela, qs] of Object.entries(saida)) {
  for (const q of qs) {
    const p = q.partes
    const alt = (x) => (x ? Math.round(x.h) : '-')
    const larg = (x) => (x ? Math.round(x.w) : '-')
    const resp = `aro→lábio ${q.respiro.labio ?? '-'}/borda ${q.respiro.borda ?? '-'}/sulco ${q.respiro.sulco ?? '-'} px`
    const linha = `borda ${Math.round(q.borda ?? -1)} gota ${larg(p.gota)} px tela ${alt(p.tela)} px`
    console.log(`${tela} ${q.t} ${resp} ${linha} ${q.falhas.join('; ')}`)
  }
}
console.log(falhas.length ? `REPROVA (${falhas.length})\n - ${falhas.slice(0, 30).join('\n - ')}` : 'PASSA')
process.exitCode = falhas.length ? 1 : 0
