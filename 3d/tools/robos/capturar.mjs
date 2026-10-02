// Captura as 9 imagens estáticas das vidas do herói para a variante dos robôs (BotHero.tsx), contra o site real do
// Fael (5199, nunca derrubado) — e monta a folha de contato de prova em .wai/seo-geo/08-3d-google/capturas/.
//
// Decisão do Fael (03-plano-versao-robos.md §10, P1): "imagem no ultimo frame possível com tudo montado". Captura a
// cena REAL (Opção B do plano, §5), não o gerador isolado (3d/tools/og/gerar.mjs): pelo menos 2 vidas (devops, qa)
// calculam a posição do adereço a partir do DOM real do herói em tempo de execução
// (src/features/hero/scene/props/devops/referencias.ts:34-40), que uma réplica fora do site não reproduziria.
//
// `?slot=<vida>&d=0`: a MESMA query de 3d/tools/captura_prop.mjs (modo estatico) e 3d/tools/props/site.mjs. `d=0` é
// lido por readHeroOptions (src/features/hero/model/options.ts) e força frozenDissolve=0; o Director aplica
// `dissolveUniforms.uD.value = frozenDissolve` todo quadro e RETORNA sem chamar tick() (Director.tsx:43-46) — a vida
// nunca avança, e uD fica no "0 (inteiro)" da escala (model/carousel.ts:12-13: "0 (inteiro) a DISSOLVE_MAX, só
// furacão"). Ou seja: busto e adereço sempre montados, nunca desintegrando. É o "congela sem desintegração" citado
// na Opção B do plano (03-plano-versao-robos.md:236-238).
//
// Para as 4 vidas com narrativa própria por quadro (roteiro.ts: ai, devops, qa, techlead), o adereço ainda roda o
// PRÓPRIO relógio local (r.c) mesmo com d=0 — Director só congela o uD do CARROSSEL, não o useFrame de cada prop.
// Ex. Ai.tsx:217-227: a cada quadro `r.c += dt` até `T.fim + RECOMECA`, quando reinicia em 0; a pose desenhada é
// `pose(Math.min(r.c, T.fim), ...)` — ou seja, de T.fim a T.fim+RECOMECA (0,3 s) a pose fica PARADA no quadro final
// da narrativa (a função `quadroFinal` de cada roteiro.ts chama exatamente `quadroEm(T.fim, …)`). Esse é o "último
// quadro possível com tudo montado" que o Fael pediu nessas 4 vidas. No 1º quadro (r.iniciado=false) r.c começa em
// TIMING.in (=1s, model/carousel.ts:8), não em 0; daí a espera = (T.fim − TIMING.in) + 0,15 s de folga (a metade da
// janela de 0,3 s, contra o jitter do SwiftShader — sem GPU a cena roda mais lento, o que só ALONGA essa janela em
// tempo real, nunca encurta: cada quadro soma no máximo 0,1 s a r.c, então um quadro lento atrasa r.c, não antecipa):
//   - ai       T.fim=6   src/features/hero/scene/props/ai/roteiro.ts:86        → 5,15 s
//   - devops   T.fim=6   src/features/hero/scene/props/devops/roteiro.ts:67    → 5,15 s
//   - techlead T.fim=6   src/features/hero/scene/props/techlead/roteiro.ts:100 → 5,15 s
//   - qa       T.fim=4.5 src/features/hero/scene/props/qa/roteiro.ts:35        → 3,65 s
// As outras 5 vidas (financeiro, empreendedor, vela, uber, fullstack) não têm roteiro.ts com T.fim/RECOMECA — são
// idle contínuo, sempre "tudo montado" enquanto d=0; 4 s bastam para assentar (câmera, cabelo, roupa).
//
// Toda imagem final é olhada (Read) por quem roda este script antes de aceitar: vida certa, nada cortado, sem
// "loading" (não existe aqui: BotHero não hidrata, mas a captura é feita no site HUMANO com ?slot&d, que hidrata e
// pode mostrar "loading" se a espera for curta demais).
//
// Uso: node 3d/tools/robos/capturar.mjs [vida...]   (sem argumento: as 9; com argumento(s): refaz só essas)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BASE, launch } from '../props/site.mjs'
// sharp (0.35.4) está no store do pnpm mas não linkado na raiz deste node_modules (não é dependência direta do
// projeto); caminho direto ao build ESM do pacote, só usado aqui, dentro do domínio do TD (3d/tools/robos/).
import sharp from '/home/fael/projects/portfolio-robos/node_modules/.pnpm/sharp@0.35.4_@types+node@22.20.4/node_modules/sharp/dist/index.mjs'

const CAPTURAS_FORA = '/home/fael/projects/portfolio/.wai/seo-geo/08-3d-google/capturas'
const SAIDA = new URL('../../../public/hero-bot/', import.meta.url).pathname

// Ordem cronológica de src/content/journey.ts `stages` (financeiro…ai); `label` só para a folha de contato, do
// campo `slot` de cada Stage (journey.ts, lido em 02/10/2026 — atualizar se os slots mudarem).
const VIDAS = [
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

const LADO_WEBP = 480
const PESO_MAX = 40 * 1024

/**
 * Caixa (cabeça ∪ adereço) pelo gancho de depuração (window.__heroDebug, só em DEV; debug.ts); null se não responder.
 * NÃO força quadrado aqui: as 4 vidas com narrativa (ai, devops, qa, techlead) são cenas inteiras, de ponta a ponta
 * da viewport (medido: ~1400 px de largura por ~780 px de altura, contra 1440×900) — um recorte quadrado forçado
 * nessa largura cortaria as pontas (medido e corrigido: 1ª rodada desta captura cortou o headset do techlead e os
 * painéis da esquerda em ai/techlead). O quadrado final vem depois, no sharp (fit "contain", sem cortar nada).
 */
async function recorte(page, margem) {
  const m = await page.evaluate(() => window.__heroDebug?.masks({}, false) ?? null)
  const boxes = [m?.cabeca?.box, m?.peca?.boxTotal].filter(Boolean)
  if (!boxes.length) return null
  const vp = page.viewportSize()
  const clamp = (v, max) => Math.max(0, Math.min(v, max))
  const x0 = clamp(Math.min(...boxes.map((b) => b.x)) - margem, vp.width)
  const y0 = clamp(Math.min(...boxes.map((b) => b.y)) - margem, vp.height)
  const x1 = clamp(Math.max(...boxes.map((b) => b.x + b.w)) + margem, vp.width)
  const y1 = clamp(Math.max(...boxes.map((b) => b.y + b.h)) + margem, vp.height)
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) }
}

// /pt explícito: português é o padrão do estúdio (NUCLEO.md §5, "Português do Brasil") e das ferramentas existentes
// (site.mjs usa aria-label="Apresentação", só existe em pt). Sem isso, a detecção de idioma no cliente
// (useDetectLang.ts) decide pelo navigator.languages do sistema — nesta sessão dá em português de qualquer jeito,
// mas navegar direto a /pt evita depender do redirecionamento (e do idioma do SO de quem rodar o script depois).
async function abrirVida(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
  const busto = page.waitForResponse((r) => r.url().includes('busto-s13.glb'), { timeout: 90_000 })
  await page.goto(`${BASE}/pt/?${query}`)
  await page.locator('canvas').waitFor({ timeout: 90_000 })
  await busto
  await page.waitForFunction(() => window.__heroDebug?.ready() === true, null, { timeout: 90_000 })
  // Esconde a interface por cima da cena (texto da vida, indicador, link do código, idioma, balão de contato, MCP
  // flutuante) — só para a captura; a cena 3D (1º filho da seção) fica, com o fundo do próprio site.
  await page.addStyleTag({
    content: `
      section[aria-label="Apresentação"] > *:not(:first-child) { visibility: hidden !important; }
      .mcp-fab, div.fixed { visibility: hidden !important; }
    `,
  })
  return { ctx, page }
}

/** Abre a vida congelada (?slot&d=0), espera o quadro certo e devolve o PNG da cena (cabeça + adereço), sem recortar. */
async function capturarUma(browser, vida) {
  const { ctx, page } = await abrirVida(browser, `slot=${vida.id}&d=0`)
  await page.waitForTimeout(vida.esperaMs)
  const clip = (await recorte(page, 60)) ?? { x: 20, y: 70, width: 1400, height: 780 }
  const png = await page.screenshot({ clip, type: 'png' })
  await ctx.close()
  mkdirSync(CAPTURAS_FORA, { recursive: true })
  writeFileSync(`${CAPTURAS_FORA}/${vida.id}.png`, png)
  return png
}

// "contain", nunca "cover": a caixa de recorte não é quadrada (cenas largas como ai/devops/qa/techlead, ~1400×780) —
// cover cortaria as pontas para preencher o quadrado. Com contain, a imagem inteira cabe dentro de 480×480, com
// barras do preto do próprio fundo do site (#000, a cor do fundo do herói) nos lados que sobram — nunca recorte.
const FUNDO = { r: 0, g: 0, b: 0 }

/** PNG (caixa inteira, qualquer proporção) → WebP ≤ PESO_MAX (P2: ~480×480, até 40 KB), qualidade decrescente até caber. */
async function paraWebp(png) {
  let ultimo = null
  for (const q of [82, 74, 66, 58, 50, 42, 34, 26, 20]) {
    ultimo = await sharp(png)
      .resize(LADO_WEBP, LADO_WEBP, { fit: 'contain', background: FUNDO })
      .webp({ quality: q })
      .toBuffer()
    if (ultimo.byteLength <= PESO_MAX) return ultimo
  }
  return ultimo
}

/** Folha de contato única (≤ 1568 px de largura, rótulo por vida) — padrão do estúdio, lida com um Read só.
 * Só entra quem já tem PNG capturado (reexecuções parciais não quebram a folha; avisa quem falta). */
async function montarFolha(todasVidas) {
  const vidas = todasVidas.filter((v) => existsSync(`${CAPTURAS_FORA}/${v.id}.png`))
  const faltando = todasVidas.filter((v) => !existsSync(`${CAPTURAS_FORA}/${v.id}.png`))
  if (faltando.length) console.log('faltando na folha:', faltando.map((v) => v.id).join(', '))
  const cols = 3
  const cel = 480
  const rotulo = 28
  const largura = cols * cel
  const linhas = Math.ceil(vidas.length / cols)
  const altura = linhas * (cel + rotulo)
  const composicoes = []
  for (let i = 0; i < vidas.length; i++) {
    const v = vidas[i]
    const col = i % cols
    const lin = Math.floor(i / cols)
    const png = readFileSync(`${CAPTURAS_FORA}/${v.id}.png`)
    const thumb = await sharp(png).resize(cel, cel, { fit: 'contain', background: FUNDO }).png().toBuffer()
    composicoes.push({ input: thumb, left: col * cel, top: lin * (cel + rotulo) + rotulo })
    const svg = `<svg width="${cel}" height="${rotulo}"><rect width="100%" height="100%" fill="#111"/>
      <text x="8" y="${rotulo - 9}" font-family="sans-serif" font-size="16" fill="#fff">${v.id} — ${v.label}</text></svg>`
    composicoes.push({ input: Buffer.from(svg), left: col * cel, top: lin * (cel + rotulo) })
  }
  const folha = await sharp({ create: { width: largura, height: altura, channels: 3, background: '#000' } })
    .composite(composicoes)
    .png()
    .toBuffer()
  mkdirSync(CAPTURAS_FORA, { recursive: true })
  writeFileSync(`${CAPTURAS_FORA}/folha.png`, folha)
}

const pedidas = process.argv.slice(2)
const alvo = pedidas.length ? VIDAS.filter((v) => pedidas.includes(v.id)) : VIDAS
if (pedidas.length && alvo.length !== pedidas.length) throw new Error(`vida desconhecida em ${JSON.stringify(pedidas)}`)

mkdirSync(SAIDA, { recursive: true })
const browser = await launch()
const pesos = {}
for (const vida of alvo) {
  const png = await capturarUma(browser, vida)
  const webp = await paraWebp(png)
  writeFileSync(`${SAIDA}${vida.id}.webp`, webp)
  pesos[vida.id] = webp.byteLength
  console.log(vida.id, `${(webp.byteLength / 1024).toFixed(1)} KB`)
}
await browser.close()
await montarFolha(VIDAS)
console.log(JSON.stringify(pesos, null, 2))
