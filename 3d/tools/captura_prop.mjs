// Conferência visual de um adereço do herói no site real (servidor de desenvolvimento do Fael, porta 5199).
// Uso: node 3d/tools/captura_prop.mjs <estatico|zoom|sequencia|poses> <vida> <pasta> <rótulo> [extras]
//   estatico : ?slot=<vida>&d=0 em 1440×900, 1024×768 e 360×740 (dsf 2), depois da animação terminar.
//   zoom     : ?slot=<vida>&d=0 em 1440×900 com densidade 2; recorte da cabeça + adereço e detalhe do adereço
//              (retângulos medidos pelo gancho de depuração; sem ele, os recortes fixos antigos).
//   sequencia: ?slot=<vida> (carrossel normal) em 1440×900 com relógio falso: 17 quadros a cada 0,25 s de cena, com
//              t=0 na MONTAGEM real (pula pelo indicador para a vida seguinte e volta; folha: props/folha_seq.py).
//   poses    : ?slot=<vida>&d=0 em 1440×900 dsf 2: ponteiro nos 4 cantos e no centro e arrasto para os dois lados e
//              para cima (interpenetração com cabelo, barba e orelhas), recorte da cabeça + adereço em cada pose.
// Extras: --q=chave=valor (parâmetro de URL, repetível), --reduzido (prefers-reduced-motion), --espera=16000 (ms até o
//         estado final nos modos parados). Sem laboratório: a peça em teste vai direto no site do branch.
// Sem GPU (SwiftShader) a cena roda a poucos quadros por segundo e não mede FPS de celular; o relógio do herói limita
// o passo por quadro a 0,1 s, então nos modos parados o tempo de cena corre mais devagar que o real.
import { mkdirSync, writeFileSync } from 'node:fs'
import { TELAS, abrir, extras, launch, uniao } from './props/site.mjs'

const { query, reduzido, espera, resto } = extras(process.argv.slice(2))
const [mode = 'estatico', slot = 'financeiro', out = '3d/captura/props/financeiro', tag = 'v1'] = resto
const q = (base) => [base, query].filter(Boolean).join('&')
const sufixo = reduzido ? '-reduzido' : ''
mkdirSync(out, { recursive: true })

const browser = await launch()

/** Recorte (px CSS) da cabeça + adereço, medido pelo gancho; null se o gancho não responder. */
async function recorte(page, margem, soPeca = false) {
  const m = await page.evaluate(() => window.__heroDebug?.masks({}, false) ?? null)
  if (!m) return null
  const vp = page.viewportSize()
  return uniao(soPeca ? [m.peca.boxTotal] : [m.cabeca.box, m.peca.boxTotal], margem, vp.width, vp.height)
}

/** Palavra da vida em cena (a que não está saindo), com espaços normalizados. */
const palavra = (page) =>
  page.evaluate(() => document.querySelector('.slot-word:not(.is-leaving)')?.textContent?.replace(/\s+/g, ' ').trim())
/** A palavra traz o texto duas vezes (medida + visível): basta conter o nome da vida. */
const mesma = (palavraAtual, vida) => (palavraAtual ?? '').includes(vida)

/** Escolhe a vida no indicador e avança o relógio falso em passos de 0,05 s até ela montar. */
async function montar(page, vida) {
  await page.evaluate(
    (v) => [...document.querySelectorAll('nav[aria-label="Timeline"] button')].find((b) => b.ariaLabel === v)?.click(),
    vida,
  )
  for (let i = 0; i < 120; i++) {
    await page.clock.runFor(50)
    if (mesma(await palavra(page), vida)) return
  }
  const agora = await page.evaluate(() => ({
    palavras: [...document.querySelectorAll('.slot-word')].map((e) => `${e.className}: ${e.textContent}`),
    atual: document.querySelector('nav[aria-label="Timeline"] button[aria-current]')?.ariaLabel,
  }))
  throw new Error(`a vida ${vida} não montou em 6 s de cena: ${JSON.stringify(agora)}`)
}

if (mode === 'estatico') {
  for (const [w, h, dsf] of TELAS) {
    const { ctx, page } = await abrir(browser, {
      viewport: { width: w, height: h },
      dsf,
      query: q(`slot=${slot}&d=0`),
      reduzido,
    })
    await page.waitForTimeout(espera)
    await page.screenshot({ path: `${out}/${tag}-${w}x${h}${sufixo}.png` })
    await ctx.close()
  }
} else if (mode === 'zoom') {
  const { ctx, page } = await abrir(browser, {
    viewport: { width: 1440, height: 900 },
    dsf: 2,
    query: q(`slot=${slot}&d=0`),
    reduzido,
  })
  await page.waitForTimeout(espera + 2000)
  const zoom = (await recorte(page, 40)) ?? { x: 760, y: 130, width: 680, height: 520 }
  const detalhe = (await recorte(page, 16, true)) ?? { x: 1150, y: 140, width: 290, height: 300 }
  await page.screenshot({ path: `${out}/${tag}-zoom${sufixo}.png`, clip: zoom })
  // Detalhe do adereço no dobro da densidade da tela.
  await page.screenshot({ path: `${out}/${tag}-detalhe${sufixo}.png`, clip: detalhe })
  await ctx.close()
} else if (mode === 'poses') {
  const { ctx, page } = await abrir(browser, {
    viewport: { width: 1440, height: 900 },
    dsf: 2,
    query: q(`slot=${slot}&d=0`),
    reduzido,
  })
  await page.waitForTimeout(espera)
  const clip = (await recorte(page, 60)) ?? { x: 760, y: 100, width: 680, height: 600 }
  const canvas = await page.locator('canvas').boundingBox()
  const cx = clip.x + clip.width / 2
  const cy = clip.y + clip.height / 2
  const medidas = {}
  const foto = async (nome) => {
    // O olhar e o giro amortecem ao longo de vários quadros; sem GPU, alguns segundos.
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${out}/${tag}-pose-${nome}${sufixo}.png`, clip })
    medidas[nome] = await page.evaluate(() => {
      const m = window.__heroDebug?.masks({}, false)
      return m && { peca: m.peca, oculta: m.ocultaPelaCabeca, contorno: m.contornoNaCabeca, rosto: m.rosto }
    })
  }
  const cantos = {
    'olhar-sup-esq': [2, 2],
    'olhar-sup-dir': [canvas.width - 2, 2],
    'olhar-inf-esq': [2, canvas.height - 2],
    'olhar-inf-dir': [canvas.width - 2, canvas.height - 2],
    'olhar-centro': [cx, cy],
  }
  for (const [nome, [x, y]] of Object.entries(cantos)) {
    await page.mouse.move(x, y, { steps: 4 })
    await foto(nome)
  }
  const arrastos = { 'arrasto-esq': [-420, 0], 'arrasto-dir': [420, 0], 'arrasto-cima': [0, -300] }
  for (const [nome, [dx, dy]] of Object.entries(arrastos)) {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + dx, cy + dy, { steps: 12 })
    await foto(nome)
    await page.mouse.up()
    await page.waitForTimeout(3000)
  }
  writeFileSync(`${out}/${tag}-poses${sufixo}.json`, JSON.stringify(medidas, null, 2))
  await ctx.close()
} else {
  // Relógio falso do Playwright (rAF e performance.now): cada passo avança exatamente 0,25 s de cena, então a
  // sequência mostra o roteiro em tempo de cena, não no ritmo lento do SwiftShader. t=0 é a MONTAGEM real da vida: na
  // primeira carga ela monta antes de o relógio parar, então a ferramenta pula pelo indicador para a vida seguinte e
  // volta à pedida; a palavra da vida troca no mesmo quadro em que o adereço monta (auge do furacão), com erro ≤ 0,05 s.
  const { ctx, page, vidaInicial: alvo } = await abrir(browser, {
    viewport: { width: 1440, height: 900 },
    query: q(`slot=${slot}`),
    reduzido,
    relogio: true,
  })
  await page.clock.pauseAt(Date.now() + 1000)
  const clip = (await recorte(page, 40)) ?? { x: 900, y: 120, width: 540, height: 480 }
  const vidas = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.getAttribute('aria-label') ?? ''),
  )
  await montar(page, vidas[(vidas.indexOf(alvo) + 1) % vidas.length])
  await montar(page, alvo)
  const caixas = []
  for (let i = 0; i <= 16; i++) {
    // Sem GPU, o primeiro quadro depois de muitos passos do relógio falso demora: prazo longo no screenshot.
    const path = `${out}/${tag}-seq-${(i * 0.25).toFixed(2)}s${sufixo}.png`
    await page.screenshot({ path, clip, timeout: 180_000 })
    // Caixas (px CSS) da cabeça e da peça neste quadro: prova de enquadramento estável ao longo do roteiro.
    const m = await page.evaluate(() => window.__heroDebug?.masks({}, false) ?? null)
    caixas.push({ t: i * 0.25, cabeca: m?.cabeca.box ?? null, peca: m?.peca.boxTotal ?? null })
    await page.clock.runFor(250)
  }
  writeFileSync(`${out}/${tag}-seq${sufixo}.json`, JSON.stringify(caixas, null, 2))
  await ctx.close()
}
await browser.close()
