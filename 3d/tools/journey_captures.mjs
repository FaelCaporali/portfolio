// Capturas da página /journey em desktop e mobile com rolagem real (GSAP ScrollTrigger).
// Rola a página de 0,6 × altura da janela por vez e captura JPEG em cada passo.
// Uso: node 3d/tools/journey_captures.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const BASE = process.env.SITE ?? 'http://localhost:5199'
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
// Pasta de saída: 3d/captura/<nome>, com o nome pelo 1º argumento (padrão journey-v2, a primeira rodada).
const OUT_DIR = join(REPO, '3d', 'captura', process.argv[2] ?? 'journey-v2')

const SIZES = [
  { name: 'desktop', width: 1440, height: 900, dsf: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dsf: 2, mobile: true },
]

async function launch() {
  return chromium.launch({ args: ARGS })
}

/** Abre /journey e espera a página estar pronta. */
async function abrir(browser, { width, height, dsf, mobile, reducedMotion = false }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text())
    }
  })
  page.on('pageerror', (e) => {
    consoleErrors.push(e.message)
  })

  await page.goto(`${BASE}/journey`)
  await page.waitForTimeout(2000)

  return { ctx, page, consoleErrors }
}

/** Captura JPEG com qualidade 70. */
async function capturar(page, caminho) {
  mkdirSync(dirname(caminho), { recursive: true })
  await page.screenshot({ path: caminho, type: 'jpeg', quality: 70 })
}

/** Rola até o fim de forma incremental. */
async function rolarECapturar(page, nomeDirCapturar) {
  const capturas = []

  // Captura 1: topo (já capturado no abrir, mas fazemos novamente para consistência)
  const caminho1 = join(OUT_DIR, nomeDirCapturar, '00.jpg')
  await capturar(page, caminho1)
  capturas.push(caminho1)

  // Rola enquanto há conteúdo
  let capturaNum = 1
  while (true) {
    // Calcula altura da página e posição atual
    const state = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    const stepPixels = Math.round(state.innerHeight * 0.6)
    const proximaPos = state.scrollY + stepPixels

    // Se já está no fim, para
    if (state.scrollY + state.innerHeight >= state.scrollHeight - 1) {
      break
    }

    // Rola
    await page.evaluate((pos) => window.scrollTo({ top: pos, behavior: 'instant' }), proximaPos)
    await page.waitForTimeout(900)

    // Captura
    const num = String(capturaNum).padStart(2, '0')
    const caminhoN = join(OUT_DIR, nomeDirCapturar, `${num}.jpg`)
    await capturar(page, caminhoN)
    capturas.push(caminhoN)
    capturaNum++
  }

  // Retorna info para medidas.json
  const info = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))

  return {
    capturas,
    altura: info.scrollHeight,
    temRolagem: info.scrollWidth > info.innerWidth,
  }
}

/** Captura fullPage com reduced-motion (sem rolagem, só screenshot completo). */
async function capturaReduzida(page) {
  // Rola pro topo
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(500)

  // Tira a captura fullPage (reduz vertical automaticamente)
  const caminho = join(OUT_DIR, 'reduced-full.jpg')
  mkdirSync(dirname(caminho), { recursive: true })
  await page.screenshot({ path: caminho, type: 'jpeg', quality: 70, fullPage: true })

  return caminho
}

/** Tenta criar folhas de contato com montage (ImageMagick). Retorna null se não disponível. */
function criarFolhasContato() {
  try {
    execFileSync('which', ['montage'], { stdio: 'pipe' })
  } catch {
    return null
  }

  const resultado = {}

  for (const tamanho of SIZES) {
    const dirCaps = join(OUT_DIR, tamanho.name)
    const folha = join(OUT_DIR, `folha-${tamanho.name}.jpg`)

    try {
      const cmd = [
        `${dirCaps}/[0-9]*.jpg`,
        '-tile', '4x',
        '-background', '#0b0b0e',
        '-geometry', `+10+10`,
        '-label', '%f',
        '-pointsize', '12',
        '-fill', 'white',
        folha,
      ]
      execFileSync('montage', cmd)
      resultado[tamanho.name] = folha
    } catch (e) {
      console.warn(`Erro ao criar folha para ${tamanho.name}:`, e.message)
    }
  }

  return Object.keys(resultado).length > 0 ? resultado : null
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await launch()
  const medidas = { tamanhos: {}, erros: [] }

  // Desktop e mobile: rola real
  for (const tamanho of SIZES) {
    const { ctx, page, consoleErrors } = await abrir(browser, tamanho)

    console.log(`Capturando ${tamanho.name}...`)
    const resultado = await rolarECapturar(page, tamanho.name)

    medidas.tamanhos[tamanho.name] = {
      altura: resultado.altura,
      numCapturas: resultado.capturas.length,
      temRolagemHorizontal: resultado.temRolagem,
    }

    if (consoleErrors.length > 0) {
      medidas.erros.push({ tamanho: tamanho.name, erros: consoleErrors })
    }

    console.log(`  ${resultado.capturas.length} capturas, altura ${resultado.altura} px`)
    await ctx.close()
  }

  // Desktop com reduced-motion: fullPage
  const { ctx: ctxReduzido, page: pageReduzido, consoleErrors: errosReduzidos } = await abrir(browser, {
    width: 1440,
    height: 900,
    dsf: 1,
    mobile: false,
    reducedMotion: true,
  })

  console.log('Capturando reduced-full.jpg...')
  const reduvidaPath = await capturaReduzida(pageReduzido)
  console.log(`  Salvo em ${reduvidaPath}`)

  if (errosReduzidos.length > 0) {
    medidas.erros.push({ tamanho: 'reduced-motion', erros: errosReduzidos })
  }

  await ctxReduzido.close()
  await browser.close()

  // Salva medidas.json
  const caminhoMedidas = join(OUT_DIR, 'medidas.json')
  writeFileSync(caminhoMedidas, JSON.stringify(medidas, null, 2))
  console.log(`\nMedidas salvas em ${caminhoMedidas}`)

  // Tenta criar folhas de contato
  const folhas = criarFolhasContato()
  if (folhas) {
    console.log('Folhas de contato:')
    for (const [nome, caminho] of Object.entries(folhas)) {
      console.log(`  ${nome}: ${caminho}`)
    }
  } else {
    console.log('montage não disponível (ImageMagick não instalado)')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
