// Utilitários do estúdio 3D para o site real (servidor de desenvolvimento do Fael na 5199, nunca derrubado).
// Usados por 3d/tools/captura_prop.mjs e 3d/tools/props/portoes.mjs. O gancho window.__heroDebug existe só no
// `pnpm dev` (src/features/hero/scene/dev/). Sem laboratório: a peça em teste vai direto no site do branch.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const BASE = process.env.SITE ?? 'http://localhost:5199'
// Sem GPU: SwiftShader (não mede FPS de celular; só forma, posição e ordem de desenho).
export const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
export const TELAS = [
  [1440, 900, 1],
  [1024, 768, 1],
  [360, 740, 2],
]

/**
 * Argumentos extras depois dos posicionais: `--q=chave=valor` (repetível; vira parte da query),
 * `--reduzido` (prefers-reduced-motion: reduce), `--espera=16000` (ms até o estado final nos modos parados),
 * `--tempos=0.3,0.5,2.5` (instantes, s desde a montagem, da `sequencia` em vez de 0 a 4 s a cada 0,25 s).
 */
export function extras(argv) {
  const q = []
  let reduzido = false
  let espera = 16000
  let tempos = null
  const resto = []
  for (const a of argv) {
    if (a.startsWith('--q=')) q.push(a.slice(4))
    else if (a === '--reduzido') reduzido = true
    else if (a.startsWith('--espera=')) espera = Number(a.slice(9))
    else if (a.startsWith('--tempos=')) tempos = a.slice(9).split(',').map(Number)
    else resto.push(a)
  }
  return { query: q.join('&'), reduzido, espera, tempos, resto }
}

export const launch = () => chromium.launch({ args: ARGS })

/** Abre a página, espera o busto e o adereço montado na cena. */
export async function abrir(browser, { viewport, dsf = 1, query, reduzido = false, relogio = false }) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: dsf,
    reducedMotion: reduzido ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
  if (relogio) await page.clock.install()
  const busto = page.waitForResponse((r) => r.url().includes('busto-s13.glb'), { timeout: 90_000 })
  await page.goto(`${BASE}/?${query}`)
  // A vida pedida, lida no indicador logo na chegada (sem GPU, o carrossel pode já ter andado quando o busto fica pronto).
  const vidaInicial = await page
    .locator('nav[aria-label="Timeline"] button[aria-current]')
    .getAttribute('aria-label', { timeout: 90_000 })
  await page.locator('canvas').waitFor({ timeout: 90_000 })
  await busto
  await page.waitForFunction(() => window.__heroDebug?.ready() === true, null, { timeout: 90_000 })
  return { ctx, page, vidaInicial }
}

/**
 * Retângulos da interface no referencial do canvas (px CSS): cada linha de texto do herói, cada link/botão, o
 * indicador de vidas, o balão de contato e o link do código. Categoria:índice → retângulo.
 */
export function retangulosUi(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('section[aria-label="Apresentação"] canvas')
    const c = canvas.getBoundingClientRect()
    const out = {}
    const add = (cat, r) => {
      if (r.width < 2 || r.height < 2) return
      const n = Object.keys(out).filter((k) => k.startsWith(`${cat}:`)).length
      out[`${cat}:${n}`] = { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }
    }
    const textos = (root, cat) => {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) add(cat, r)
      }
      for (const el of root.querySelectorAll('a, button')) add(cat, el.getBoundingClientRect())
    }
    const header = document.querySelector('section[aria-label="Apresentação"] > header')
    const timeline = document.querySelector('nav[aria-label="Timeline"]')
    const copy = document.querySelector('section[aria-label="Apresentação"] h1')?.parentElement
    if (header) textos(header.firstElementChild, 'cabecalho')
    if (timeline) add('indicador', timeline.getBoundingClientRect())
    if (copy) textos(copy, 'texto')
    const fonte = document.querySelector('section[aria-label="Apresentação"] > a')
    if (fonte) add('cabecalho', fonte.getBoundingClientRect())
    const balao = document.querySelector('div.fixed > button')
    if (balao) add('balao', balao.getBoundingClientRect())
    return { canvas: { w: c.width, h: c.height }, rects: out }
  })
}

/** Retângulo dilatado (margem de respiro em px CSS). */
export const dilatar = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m })

/** Grava um data URL PNG em arquivo. */
export function gravarPng(caminho, dataUrl) {
  if (!dataUrl) return
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, Buffer.from(dataUrl.split(',')[1], 'base64'))
}

/** União de retângulos (ignora nulos) com margem, limitada à tela. */
export function uniao(boxes, margem, w, h) {
  const bs = boxes.filter(Boolean)
  if (!bs.length) return null
  const x0 = Math.max(0, Math.min(...bs.map((b) => b.x)) - margem)
  const y0 = Math.max(0, Math.min(...bs.map((b) => b.y)) - margem)
  const x1 = Math.min(w, Math.max(...bs.map((b) => b.x + b.w)) + margem)
  const y1 = Math.min(h, Math.max(...bs.map((b) => b.y + b.h)) + margem)
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) }
}
