// As 9 vidas do herói (src/content/journey.ts `stages`) e a função que abre cada uma CONGELADA (?slot&d=0) no site
// real do Fael (5199, nunca derrubado), com a interface escondida — usada tanto pelas imagens 480×480 dos robôs
// (capturar.mjs) quanto pelas imagens de tela cheia sem GPU (fallback.mjs). Ver capturar.mjs para o porquê de cada
// tempo de espera (T.fim de cada roteiro.ts) e do `d=0` (congela a desintegração, Director.tsx).
import { BASE } from '../props/site.mjs'

// Ordem cronológica de src/content/journey.ts `stages` (financeiro…ai); `label` só para a folha de contato, do campo
// `slot` de cada Stage (journey.ts, lido em 02/10/2026 — atualizar se os slots mudarem).
export const VIDAS = [
  { id: 'financeiro', esperaMs: 4000, label: 'Financial Assistant' },
  { id: 'empreendedor', esperaMs: 4000, label: 'Entrepreneur' },
  { id: 'vela', esperaMs: 4000, label: 'Sailing Instructor' },
  { id: 'uber', esperaMs: 4000, label: 'Uber Driver' },
  { id: 'fullstack', esperaMs: 4000, label: 'FullStack Dev' },
  { id: 'qa', esperaMs: 3650, label: 'QA Analyst' },
  { id: 'devops', esperaMs: 5150, label: 'Solutions Architect' },
  { id: 'techlead', esperaMs: 5150, label: 'Tech Lead' },
  { id: 'ai', esperaMs: 5150, label: 'AI Product Engineer' },
]

// Cor medida, não suposta: `--color-page` (src/index.css) é #0b0b0e = (11, 11, 14) — o fundo atrás do canvas nas
// duas capturas (o quadrado dos robôs e o quadro inteiro do fallback).
export const FUNDO = '#0b0b0e'

/**
 * Abre a vida congelada (?slot&d=0) com a interface escondida (texto da vida, indicador, link do código, idioma,
 * balão de contato/MCP) — só a cena 3D (1º filho da seção) fica, sobre o fundo real do site. `/pt` explícito:
 * português é o padrão do estúdio (NUCLEO.md §5) e das ferramentas existentes (site.mjs usa
 * aria-label="Apresentação", só existe em pt); sem isso, a detecção de idioma no cliente decide pelo navigator do
 * sistema que rodar o script.
 */
export async function abrirVida(browser, vidaId, viewport, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
  const busto = page.waitForResponse((r) => r.url().includes('busto-s13.glb'), { timeout: 90_000 })
  await page.goto(`${BASE}/pt/?slot=${vidaId}&d=0`)
  await page.locator('canvas').waitFor({ timeout: 90_000 })
  await busto
  await page.waitForFunction(() => window.__heroDebug?.ready() === true, null, { timeout: 90_000 })
  await page.addStyleTag({
    content: `
      section[aria-label="Apresentação"] > *:not(:first-child) { visibility: hidden !important; }
      .mcp-fab, div.fixed { visibility: hidden !important; }
    `,
  })
  return { ctx, page }
}
