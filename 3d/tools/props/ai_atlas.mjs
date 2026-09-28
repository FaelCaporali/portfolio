// Atlas de logos da vida ai (FICHA-PRODUCAO §2.6; REQUISITOS I3): Anthropic, OpenAI, Google Gemini, n8n e MCP (Model
// Context Protocol), dos SVGs de 3d/referencias/props/ai/logos/ (fonte, versão e uso em FONTES.md), rasterizados pelo
// Chromium numa grade de células quadradas e gravados num WebP único em src/features/hero/scene/props/ai/logos.webp (o
// site não baixa nada de fora: CSP). A ORDEM das células é a de LOGOS em src/features/hero/scene/props/ai/logos.ts (o
// script imprime a lista na ordem gravada). Logo sem alteração de forma; a cor só onde o glifo de uma cor sumiria no
// fundo escuro (a versão clara da própria marca), anotada em FONTES.md.
// Uso: node 3d/tools/props/ai_atlas.mjs [--previa=<png>]   (a prévia rotulada serve para conferir o recorte)
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const RAIZ = new URL('../../../', import.meta.url).pathname
const PASTA = `${RAIZ}3d/referencias/props/ai/logos`
const SAIDA = `${RAIZ}src/features/hero/scene/props/ai/logos.webp`
const CELULA = 96
const COLUNAS = 5
const MARGEM = 4

/** [nome, arquivo, cor de preenchimento (só no glifo de uma cor, na versão clara da marca sobre fundo escuro)]. */
const LOGOS = [
  // Glifo "A\" da Anthropic (Simple Icons, CC0; fonte anthropic.com): #191919 some no fundo escuro; o marfim da marca.
  ['anthropic', 'anthropic-simpleicons.svg', '#F0EEE6'],
  // Símbolo da OpenAI (2025): monocromático, preto ou branco pela marca; branco sobre o fundo escuro.
  ['openai', 'openai-symbol-wikimedia.svg', '#FFFFFF'],
  // Ícone do Google Gemini (2025), com o degradê oficial: sem alteração.
  ['gemini', 'gemini-icon-2025-wikimedia.svg'],
  // Glifo do n8n (Simple Icons, CC0; fonte n8n.io/press) na cor da marca #EA4B71.
  ['n8n', 'n8n-simpleicons.svg', '#EA4B71'],
  // Favicon oficial do repositório do MCP (quadrado preto com o glifo branco): sem alteração.
  ['mcp', 'mcp-favicon-oficial.svg'],
]

const previa = process.argv.find((a) => a.startsWith('--previa='))?.slice(9)
const svg = (arq, cor) => {
  let s = readFileSync(`${PASTA}/${arq}`, 'utf8')
  if (cor) s = s.replace('<svg ', `<svg fill="${cor}" `)
  return `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`
}
const itens = LOGOS.map(([nome, arq, cor]) => ({ nome, url: svg(arq, cor) }))

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
      // SVG sem tamanho (100%): o navegador dá 150 × 150; vale a proporção do viewBox, desenhada no lado maior.
      const w = img.naturalWidth || 48
      const h = img.naturalHeight || 48
      const k = (CELULA - 2 * MARGEM) / Math.max(w, h)
      const x = (i % COLUNAS) * CELULA + (CELULA - w * k) / 2
      const y = Math.floor(i / COLUNAS) * CELULA + (CELULA - h * k) / 2
      ctx.drawImage(img, x, y, w * k, h * k)
    }
    const webp = c.toDataURL('image/webp', 0.92)
    if (!rotulos) return { webp }
    const p = document.createElement('canvas')
    p.width = c.width
    p.height = c.height + 16
    const q = p.getContext('2d')
    q.fillStyle = '#0b0b0e'
    q.fillRect(0, 0, p.width, p.height)
    q.drawImage(c, 0, 0)
    q.font = '11px sans-serif'
    q.fillStyle = '#ccc'
    itens.forEach((it, k) => q.fillText(it.nome, k * CELULA + 4, c.height + 12))
    return { webp, png: p.toDataURL('image/png') }
  },
  { itens, CELULA, COLUNAS, MARGEM, rotulos: Boolean(previa) },
)
await browser.close()
const bin = Buffer.from(r.webp.split(',')[1], 'base64')
writeFileSync(SAIDA, bin)
if (previa && r.png) writeFileSync(previa, Buffer.from(r.png.split(',')[1], 'base64'))
console.log(`atlas ${COLUNAS} células de ${CELULA} px, ${(bin.length / 1024).toFixed(1)} kB`)
console.log(LOGOS.map(([n]) => n).join(','))
