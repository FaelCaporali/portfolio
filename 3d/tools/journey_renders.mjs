// Retratos do herói para a página /journey (tarefa pontual, não é peça do estúdio 3D).
// Para cada vida de src/content/journey.ts, captura o busto com o adereço como aparece no herói (?slot=<vida>&d=0,
// desintegração parada em "inteiro"), esconde a UI real da página (cabeçalho, indicador, texto, balão de contato:
// tudo DOM sobreposto ao canvas) e recorta em torno do busto, no formato retrato 900×1100. bust.webp usa a mesma
// vida de abertura (OPENING) com o adereço escondido (window.__heroDebug.setPropVisible(false)), busto sozinho.
//
// Dois grupos de vida (ajuste de 28/09, retorno do orquestrador: financeiro.webp cortou o painel da planilha):
// - OBJECT_STAGES: o adereço é um objeto perto do corpo (prancheta, foguete, etc.) — o recorte usa a caixa cheia
//   (busto ∪ peça, window.__heroDebug.masks().peca.boxTotal), centrada no rosto, SEM cortar nada; como a proporção
//   natural dessa caixa raramente é 900×1100, a imagem é ajustada por dentro (sem distorcer) e completada com o
//   mesmo #0b0b0e do fundo real da cena — nunca recorte forçado que fatiaria a peça.
// - SCENE_STAGES (qa, devops, techlead, ai): o adereço é um cenário pintado de ponta a ponta da tela (ver
//   criarFundo em scene/props/*/fundo.ts) — já sai cortado nas bordas no site real em qualquer largura de janela,
//   então "não cortar o adereço" não se aplica; o recorte usa só o busto com margem, como nas vidas de objeto.
//
// Uso: node 3d/tools/journey_renders.mjs [--vidas=ai,qa] [--espera=8000] [--margem=0.15]
//
// Fundo: o site já pinta #0b0b0e atrás do canvas (src/index.css); a captura usa esse fundo sólido em vez de tentar
// alpha real (o Canvas do herói não declara alpha:true, então o WebGL renderiza opaco sobre o body), e é também a
// cor de tarja usada para completar o enquadramento sem cortar (acima).
import { mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrir, launch } from './props/site.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const OUT_DIR = join(REPO, 'public', 'journey')
const TMP_DIR = '/tmp/journey_renders'

const OBJECT_STAGES = ['financeiro', 'empreendedor', 'vela', 'uber', 'fullstack']
const SCENE_STAGES = ['qa', 'devops', 'techlead', 'ai']
const STAGES = [...OBJECT_STAGES, ...SCENE_STAGES]
const OPENING = 'ai' // src/content/journey.ts: OPENING; vida em que a página abre e fecha (bust.webp)

// Canvas bem mais largo que o site real: dá folga horizontal para a peça inteira caber sem recorte nas vidas de
// objeto (medido: financeiro precisa de ~1950 px de largura de cena a partir do centro do busto). A câmera do
// herói (Framing.tsx) mantém o campo de visão vertical constante para qualquer proporção ≥ 1.6 (WIDE_ASPECT), então
// alargar o viewport só revela mais canto de cena; não muda o tamanho do busto nem sua posição vertical.
const VIEWPORT = { width: 2600, height: 900 }
const DSF = 1.4
const TARGET = { w: 900, h: 1100 }
const ASPECT = TARGET.w / TARGET.h
const BG = '#0b0b0e'

function parseArgs(argv) {
  const out = { vidas: null, espera: 8000, margem: 0.15 }
  for (const a of argv) {
    if (a.startsWith('--vidas=')) out.vidas = a.slice(8).split(',')
    else if (a.startsWith('--espera=')) out.espera = Number(a.slice(9))
    else if (a.startsWith('--margem=')) out.margem = Number(a.slice(9))
  }
  return out
}

/** Recorte com a proporção alvo, centrado na caixa, prioridade à altura, sem sair da tela. */
function fitAspect(box, aspect, marginFrac, canvasW, canvasH) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const ph = box.h * (1 + 2 * marginFrac)
  let h = Math.min(ph, canvasH)
  let w = h * aspect
  if (w > canvasW) {
    w = canvasW
    h = w / aspect
  }
  let x0 = cx - w / 2
  let y0 = cy - h / 2
  x0 = Math.max(0, Math.min(x0, canvasW - w))
  y0 = Math.max(0, Math.min(y0, canvasH - h))
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(w), height: Math.round(h) }
}

/**
 * Recorte que contém a peça inteira (busto ∪ adereço), centrado no rosto (centro de busto.box), com margem; nunca
 * corta a peça (a proporção resultante quase nunca é a alvo — quem ajusta ao 900×1100 é padTarget, com tarja, não
 * recorte). Clampado ao canvas só por segurança (o canvas já foi escolhido largo o bastante).
 */
function noClipCrop(bustoBox, pecaBox, marginFrac, canvasW, canvasH) {
  const cx = bustoBox.x + bustoBox.w / 2
  const cy = bustoBox.y + bustoBox.h / 2
  const x0u = Math.min(bustoBox.x, pecaBox.x)
  const y0u = Math.min(bustoBox.y, pecaBox.y)
  const x1u = Math.max(bustoBox.x + bustoBox.w, pecaBox.x + pecaBox.w)
  const y1u = Math.max(bustoBox.y + bustoBox.h, pecaBox.y + pecaBox.h)
  const halfW = Math.max(cx - x0u, x1u - cx) * (1 + marginFrac)
  const halfH = Math.max(cy - y0u, y1u - cy) * (1 + marginFrac)
  const x0 = Math.max(0, cx - halfW)
  const y0 = Math.max(0, cy - halfH)
  const x1 = Math.min(canvasW, cx + halfW)
  const y1 = Math.min(canvasH, cy + halfH)
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) }
}

/** Esconde a UI real da página (DOM sobre o canvas); o gancho de depuração só existe no dev. */
async function esconderUi(page) {
  await page.evaluate(() => {
    const hide = (el) => {
      if (el) el.style.setProperty('display', 'none', 'important')
    }
    hide(document.querySelector('section[aria-label="Apresentação"] > header'))
    hide(document.querySelector('section[aria-label="Apresentação"] > a'))
    hide(document.querySelector('nav[aria-label="Timeline"]'))
    hide(document.querySelector('div.fixed'))
    hide(document.querySelector('section[aria-label="Apresentação"] h1')?.parentElement ?? null)
  })
}

/** Screenshot com novas tentativas: sem GPU, a primeira captura recortada às vezes trava (medido: até ~60 s). */
async function capturar(page, path, clip, tentativas = 4) {
  let ultimoErro
  for (let i = 0; i < tentativas; i++) {
    try {
      await page.screenshot({ path, clip, timeout: 30000 })
      return
    } catch (e) {
      ultimoErro = e
      await page.waitForTimeout(1500)
    }
  }
  throw ultimoErro
}

/** PNG → WebP 900×1100 exato (recorte já na proporção alvo: estica só o arredondamento de px). */
function paraWebpEsticado(pngPath, webpPath, maxKb) {
  let quality = 92
  while (quality >= 35) {
    execFileSync('convert', [pngPath, '-resize', `${TARGET.w}x${TARGET.h}!`, '-quality', String(quality), webpPath])
    const kb = statSync(webpPath).size / 1024
    if (kb <= maxKb) return kb
    quality -= 7
  }
  return statSync(webpPath).size / 1024
}

/**
 * PNG → WebP 900×1100 sem cortar: encaixa por dentro preservando a proporção (nunca estica nem corta) e completa a
 * sobra com a cor exata do fundo da cena (#0b0b0e) — a vida de objeto passa por aqui, nunca por paraWebpEsticado.
 */
function paraWebpAjustado(pngPath, webpPath, maxKb) {
  let quality = 92
  while (quality >= 35) {
    execFileSync('convert', [
      pngPath,
      '-resize',
      `${TARGET.w}x${TARGET.h}`,
      '-background',
      BG,
      '-gravity',
      'center',
      '-extent',
      `${TARGET.w}x${TARGET.h}`,
      '-quality',
      String(quality),
      webpPath,
    ])
    const kb = statSync(webpPath).size / 1024
    if (kb <= maxKb) return kb
    quality -= 7
  }
  return statSync(webpPath).size / 1024
}

async function main() {
  const { vidas, espera, margem } = parseArgs(process.argv.slice(2))
  const alvo = vidas ?? STAGES
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })

  const browser = await launch()
  const resultado = []

  for (const id of alvo) {
    const { ctx, page } = await abrir(browser, {
      viewport: VIEWPORT,
      dsf: DSF,
      query: `slot=${id}&d=0`,
    })
    await page.waitForTimeout(espera)
    await esconderUi(page)
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => window.__heroDebug?.masks({}, false) ?? null)
    if (!m) throw new Error(`${id}: window.__heroDebug indisponível (fora do dev?)`)
    const isObjeto = OBJECT_STAGES.includes(id)
    const crop = isObjeto
      ? noClipCrop(m.busto.box, m.peca.boxTotal, margem, VIEWPORT.width, VIEWPORT.height)
      : fitAspect(m.busto.box, ASPECT, margem, VIEWPORT.width, VIEWPORT.height)
    const png = join(TMP_DIR, `${id}.png`)
    await capturar(page, png, crop)
    const webp = join(OUT_DIR, `${id}.webp`)
    const kb = isObjeto ? paraWebpAjustado(png, webp, 90) : paraWebpEsticado(png, webp, 90)
    resultado.push({ id, kb: kb.toFixed(1) })
    console.log(`${id}: ${kb.toFixed(1)} KB (${isObjeto ? 'sem corte, com tarja' : 'recorte no busto'} ${JSON.stringify(crop)})`)

    if (id === OPENING) {
      // bust.webp: mesma vida de abertura, adereço escondido (setPropVisible), busto sozinho — recorte simples.
      await page.evaluate(() => window.__heroDebug?.setPropVisible(false))
      await page.waitForTimeout(500)
      const mb = await page.evaluate(() => window.__heroDebug?.masks({}, false) ?? null)
      const cropBust = fitAspect(mb.busto.box, ASPECT, margem, VIEWPORT.width, VIEWPORT.height)
      const pngBust = join(TMP_DIR, 'bust.png')
      await capturar(page, pngBust, cropBust)
      const webpBust = join(OUT_DIR, 'bust.webp')
      const kbBust = paraWebpEsticado(pngBust, webpBust, 130)
      resultado.push({ id: 'bust', kb: kbBust.toFixed(1) })
      console.log(`bust: ${kbBust.toFixed(1)} KB (crop ${JSON.stringify(cropBust)})`)
    }

    await ctx.close()
  }

  await browser.close()
  console.log('\nResumo:')
  for (const r of resultado) console.log(`  ${r.id}.webp — ${r.kb} KB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
