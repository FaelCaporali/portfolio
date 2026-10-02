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
import { launch } from '../props/site.mjs'
import { labPage, montarFolha, paraWebp } from './imagem.mjs'
import { abrirVida, FUNDO, VIDAS } from './vidas.mjs'

const CAPTURAS_FORA = '/home/fael/projects/portfolio/.wai/seo-geo/08-3d-google/capturas'
const SAIDA = new URL('../../../public/hero-bot/', import.meta.url).pathname

const LADO_WEBP = 480
const PESO_MAX = 40 * 1024

/**
 * Caixa (cabeça ∪ adereço) pelo gancho de depuração (window.__heroDebug, só em DEV; debug.ts); null se não responder.
 * NÃO força quadrado aqui: as 4 vidas com narrativa (ai, devops, qa, techlead) são cenas inteiras, de ponta a ponta
 * da viewport (medido: ~1400 px de largura por ~780 px de altura, contra 1440×900) — um recorte quadrado forçado
 * nessa largura cortaria as pontas (medido e corrigido: 1ª rodada desta captura cortou o headset do techlead e os
 * painéis da esquerda em ai/techlead). O quadrado final vem depois (paraWebp, fit "contain", sem cortar nada).
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

/** Abre a vida congelada (?slot&d=0), espera o quadro certo e devolve o PNG da cena (cabeça + adereço), sem recortar. */
async function capturarUma(browser, vida) {
  const { ctx, page } = await abrirVida(browser, vida.id, { width: 1440, height: 900 })
  await page.waitForTimeout(vida.esperaMs)
  const clip = (await recorte(page, 60)) ?? { x: 20, y: 70, width: 1400, height: 780 }
  const png = await page.screenshot({ clip, type: 'png' })
  await ctx.close()
  mkdirSync(CAPTURAS_FORA, { recursive: true })
  writeFileSync(`${CAPTURAS_FORA}/${vida.id}.png`, png)
  return png
}

const pedidas = process.argv.slice(2)
const alvo = pedidas.length ? VIDAS.filter((v) => pedidas.includes(v.id)) : VIDAS
if (pedidas.length && alvo.length !== pedidas.length) throw new Error(`vida desconhecida em ${JSON.stringify(pedidas)}`)

mkdirSync(SAIDA, { recursive: true })
const browser = await launch()
const lab = await labPage(browser)
const pesos = {}
const webps = {}
for (const vida of alvo) {
  const png = await capturarUma(browser, vida)
  // "contain", nunca "cover": a caixa de recorte não é quadrada (cenas largas como ai/devops/qa/techlead, ~1400×780)
  // — cover cortaria as pontas para preencher o quadrado. Com contain, a imagem inteira cabe dentro de 480×480, com
  // barras na cor real do fundo do herói (FUNDO, vidas.mjs) nos lados que sobram — nunca recorte.
  const webp = await paraWebp(lab, png, { width: LADO_WEBP, height: LADO_WEBP, background: FUNDO, mode: 'contain', maxBytes: PESO_MAX })
  writeFileSync(`${SAIDA}${vida.id}.webp`, webp)
  webps[vida.id] = webp
  pesos[vida.id] = webp.byteLength
  console.log(vida.id, `${(webp.byteLength / 1024).toFixed(1)} KB`)
}

// Folha com quem tem webp desta execução, e com quem já estava salvo em disco (reexecuções parciais não a quebram).
const todasComWebp = VIDAS.map((v) => ({
  ...v,
  webp: webps[v.id] ?? (existsSync(`${SAIDA}${v.id}.webp`) ? readFileSync(`${SAIDA}${v.id}.webp`) : null),
}))
const faltando = todasComWebp.filter((v) => !v.webp)
if (faltando.length) console.log('faltando na folha:', faltando.map((v) => v.id).join(', '))
const celulas = todasComWebp.filter((v) => v.webp).map((v) => ({ webp: v.webp, rotulo: `${v.id} — ${v.label}` }))
const folha = await montarFolha(lab, celulas)
mkdirSync(CAPTURAS_FORA, { recursive: true })
writeFileSync(`${CAPTURAS_FORA}/folha.png`, folha)
await browser.close()

console.log(JSON.stringify(pesos, null, 2))
