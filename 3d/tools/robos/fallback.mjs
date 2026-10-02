// Captura o QUADRO INTEIRO do canvas do herói (texto/indicador/links do DOM escondidos — mesma interface de
// vidas.mjs), por vida, em dois tamanhos: desktop (1440×900) e celular (390×844 @2 → 780×1688, o tamanho real do
// canvas nesse viewport, pois o <canvas> é `!absolute inset-0` cheio da seção: scene/HeroCanvas.tsx). Contra o site
// real do Fael (5199, nunca derrubado).
//
// Fase 8b — corrige o defeito da Fase 8: HeroFallbackImage.tsx usava a imagem QUADRADA dos robôs (480×480,
// "contain") como fallback de tela cheia. Centralizada num quadro pequeno, ela ficava sobre o texto e os botões (os
// adereços nunca fazem isso no 3D real, que lê o DOM: src/features/hero/scene/props/devops/referencias.ts:34-40) e
// o busto saía muito menor que no 3D. Aqui a imagem final É o quadro que o navegador mostraria, no tamanho exato do
// viewport: não há recorte nem composição por cima, só a reembalagem PNG→WebP (paraWebp, mode "fill").
//
// Mesma decisão de tempo de espera por vida que capturar.mjs (VIDAS, vidas.mjs): o "último quadro possível com tudo
// montado" de cada roteiro.ts.
//
// Uso: node 3d/tools/robos/fallback.mjs [vida...]   (sem argumento: as 9; com argumento(s): refaz só essas)
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch } from '../props/site.mjs'
import { labPage, paraWebp } from './imagem.mjs'
import { abrirVida, FUNDO, VIDAS } from './vidas.mjs'

const SAIDA = new URL('../../../public/hero-fallback/', import.meta.url).pathname

// Pesos-alvo do Fael (Fase 8b): só quem não tem GPU baixa isso, então o orçamento é mais folgado que o dos robôs
// (480×480, 40 KB) — mas ainda um orçamento, não "o que der".
const FORMATOS = [
  { variante: 'desktop', viewport: { width: 1440, height: 900 }, dsf: 1, maxBytes: 120 * 1024 },
  { variante: 'mobile', viewport: { width: 390, height: 844 }, dsf: 2, maxBytes: 80 * 1024 },
]

/** Abre a vida no viewport do formato, espera o quadro certo e devolve o PNG do viewport inteiro (sem clip). */
async function capturarUma(browser, lab, vida, formato) {
  const { ctx, page } = await abrirVida(browser, vida.id, formato.viewport, formato.dsf)
  await page.waitForTimeout(vida.esperaMs)
  const png = await page.screenshot({ type: 'png' })
  await ctx.close()
  const largura = formato.viewport.width * formato.dsf
  const altura = formato.viewport.height * formato.dsf
  return paraWebp(lab, png, { width: largura, height: altura, background: FUNDO, mode: 'fill', maxBytes: formato.maxBytes })
}

const pedidas = process.argv.slice(2)
const alvo = pedidas.length ? VIDAS.filter((v) => pedidas.includes(v.id)) : VIDAS
if (pedidas.length && alvo.length !== pedidas.length) throw new Error(`vida desconhecida em ${JSON.stringify(pedidas)}`)

mkdirSync(SAIDA, { recursive: true })
const browser = await launch()
const lab = await labPage(browser)
const pesos = {}
for (const vida of alvo) {
  pesos[vida.id] = {}
  for (const formato of FORMATOS) {
    const webp = await capturarUma(browser, lab, vida, formato)
    writeFileSync(`${SAIDA}${vida.id}-${formato.variante}.webp`, webp)
    pesos[vida.id][formato.variante] = webp.byteLength
    console.log(vida.id, formato.variante, `${(webp.byteLength / 1024).toFixed(1)} KB`)
  }
}
await browser.close()
console.log(JSON.stringify(pesos, null, 2))
