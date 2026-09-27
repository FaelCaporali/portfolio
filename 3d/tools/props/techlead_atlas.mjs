// Atlas de logos da vida techlead (FICHA-PRODUCAO, FECHAMENTO, "Fundo e site (TD)"; REQUISITOS T4): Jira, Figma,
// Excalidraw e Mermaid, dos SVGs de 3d/referencias/props/techlead/logos/ (fonte e licença em FONTES.md), rasterizados
// pelo Chromium numa grade de células quadradas e gravados num WebP único em
// src/features/hero/scene/props/techlead/logos.webp (o site não baixa nada de fora: CSP). A ORDEM das células é a de
// LOGOS em src/features/hero/scene/props/techlead/logos.ts (o script imprime a lista na ordem gravada).
// Uso: node 3d/tools/props/techlead_atlas.mjs [--previa=<png>]   (a prévia rotulada serve para conferir o recorte)
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const RAIZ = new URL('../../../', import.meta.url).pathname
const PASTA = `${RAIZ}3d/referencias/props/techlead/logos`
const SAIDA = `${RAIZ}src/features/hero/scene/props/techlead/logos.webp`
const CELULA = 96
const COLUNAS = 4
const MARGEM = 4

/** [nome, arquivo, cor de preenchimento (só no glifo de uma cor do Simple Icons)]. */
const LOGOS = [
  // Glifo do Simple Icons (CC0); o azul oficial #0052CC some no fundo escuro: o azul claro do degradê oficial.
  ['jira', 'jira-simpleicons.svg', '#2684FF'],
  ['figma', 'figma-wikimedia.svg'],
  ['excalidraw', 'excalidraw-oficial.svg'],
  ['mermaid', 'mermaid-favicon-oficial.svg'],
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
