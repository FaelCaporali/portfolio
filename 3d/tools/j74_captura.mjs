// J74 (29/09/2026): o elemento de cima à esquerda das vidas devops (Solutions Architect) e techlead (Tech Lead) no
// herói. Captura cada vida nas telas do pedido, no estado final parado (movimento reduzido) e, com --animado, num
// instante da animação; mede as zonas dos painéis (userData.rect), o cabeçalho, o indicador e a caixa real do que o
// adereço desenha no canto de cima à esquerda (diferença de pixels com o adereço escondido).
// Uso: node 3d/tools/j74_captura.mjs <antes|depois> [vida,vida] [--animado=<s desde a montagem>] [--telas=WxH,...]
// Contra o servidor do Fael na 5199 (Chromium com SwiftShader: não mede GPU de celular).
import { mkdirSync, writeFileSync } from 'node:fs'
import { abrir, launch } from './props/site.mjs'

const args = process.argv.slice(2)
const rotulo = args.find((a) => !a.startsWith('--')) ?? 'antes'
const vidas = (args.filter((a) => !a.startsWith('--'))[1] ?? 'devops,techlead').split(',')
const animado = args.find((a) => a.startsWith('--animado='))?.slice(10)
const OUT = '3d/captura/j74'
mkdirSync(OUT, { recursive: true })
export const TELAS_J74 = [
  [320, 568, 2],
  [360, 780, 2],
  [390, 844, 2],
  [800, 360, 2],
  [768, 1024, 2],
  [1280, 800, 1],
  [1440, 900, 1],
  [1920, 1080, 1],
]
const telasArg = args.find((a) => a.startsWith('--telas='))?.slice(8)
const TELAS = telasArg
  ? telasArg.split(',').map((t) => {
      const [w, h] = t.split('x').map(Number)
      return [w, h, TELAS_J74.find(([a, b]) => a === w && b === h)?.[2] ?? (w < 700 ? 2 : 1)]
    })
  : TELAS_J74
const PREFIXO = { devops: 'arq_fundo_', techlead: 'tl_fundo_' }

/** Caixa (px CSS) dos pixels que mudam entre os PNG `a` e `b` (em dsf), na janela `j`; calculada no navegador. */
function caixaDiff(page, a, b, dsf, j) {
  return page.evaluate(
    async ({ a, b, dsf, j }) => {
      const ler = async (s) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())
        const cv = new OffscreenCanvas(img.width, img.height)
        const cx = cv.getContext('2d')
        cx.drawImage(img, 0, 0)
        return cx.getImageData(0, 0, img.width, img.height)
      }
      const A = await ler(a)
      const B = await ler(b)
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      const [jx0, jy0, jx1, jy1] = j.map((v) => Math.round(v * dsf))
      for (let y = Math.max(0, jy0); y < Math.min(A.height, jy1); y++)
        for (let x = Math.max(0, jx0); x < Math.min(A.width, jx1); x++) {
          const i = (y * A.width + x) * 4
          const d =
            Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])
          if (d < 24) continue
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
      if (!Number.isFinite(x0)) return null
      return { x0: x0 / dsf, y0: y0 / dsf, x1: (x1 + 1) / dsf, y1: (y1 + 1) / dsf }
    },
    { a: a.toString('base64'), b: b.toString('base64'), dsf, j },
  )
}

const browser = await launch()
const medidas = {}
/** Uma tela de uma vida; sob carga o SwiftShader pode perder o canvas do herói: até 3 tentativas. */
async function tela(vida, w, h, dsf) {
  for (let i = 1; ; i++) {
    try {
      return await capturar(vida, w, h, dsf)
    } catch (e) {
      if (i >= 3) throw e
      console.error(`tentativa ${i} de ${vida} ${w}x${h}: ${e.message.split('\n')[0]}`)
    }
  }
}

for (const vida of vidas) for (const [w, h, dsf] of TELAS) await tela(vida, w, h, dsf)
writeFileSync(`${OUT}/medidas-${rotulo}${animado ? `-t${animado}` : ''}.json`, JSON.stringify(medidas, null, 1))
await browser.close()

async function capturar(vida, w, h, dsf) {
  {
    const { ctx, page } = await abrir(browser, {
      viewport: { width: w, height: h },
      dsf,
      query: `slot=${vida}&d=0`,
      reduzido: !animado,
    })
    // O fundo é pintado no 2º quadro e repintado no 30º (fonte final); SwiftShader anda devagar.
    await page.waitForTimeout(animado ? 0 : 9000)
    if (animado) {
      // d=0 segura a pausa: o ciclo recomeça sozinho; espera o instante pedido do ciclo seguinte pelo relógio real.
      await page.waitForTimeout(Number(animado) * 1000 + 6000)
    }
    const m = await page.evaluate((pre) => {
      const d = window.__heroDebug
      const canvas = document.querySelector('section[aria-label="Apresentação"] canvas')
      const c = canvas.getBoundingClientRect()
      const rel = (r) => r && { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top }
      const zonas = {}
      for (const n of ['topo', 'esq', 'direita', 'dir', 'base']) {
        const o = d.medidas.objeto(pre + n)
        if (o?.visible && o.userData.rect) zonas[n] = o.userData.rect
      }
      const header = document.querySelector('section[aria-label="Apresentação"] > header')
      const nav = document.querySelector('nav[aria-label="Timeline"]')
      // A caixa do texto do herói como ../src/features/hero/scene/props/devops/referencias.ts a mede.
      const copia = document.querySelector('section[aria-label="Apresentação"] h1')?.parentElement
      const ui = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
      const somar = (r) => {
        if (r.width < 2 || r.height < 2) return
        const q = rel(r)
        ui.x0 = Math.min(ui.x0, q.x0)
        ui.y0 = Math.min(ui.y0, q.y0)
        ui.x1 = Math.max(ui.x1, q.x1)
        ui.y1 = Math.max(ui.y1, q.y1)
      }
      const walk = document.createTreeWalker(copia, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent?.trim() || n.parentElement?.closest('.sr-only')) continue
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) somar(r)
      }
      for (const el of copia.querySelectorAll('a, button')) somar(el.getBoundingClientRect())
      // Cabeça (pontos de referencias.ts) e, no techlead, o headset (zonas.ts), projetados em px CSS.
      const dpr = window.devicePixelRatio || 1
      const pts = [
        [-0.1, 0.18, -0.1],
        [0.1, 0.18, -0.1],
        [0, 0.33, -0.1],
        [0, 0.04, 0],
        ...(pre.startsWith('tl') ? [[-0.125, 0.18, -0.13], [0.125, 0.18, -0.13], [0, 0.345, -0.13]] : []),
      ].map((p) => d.medidas.projetar(p).map((v) => v / dpr))
      const cabeca = {
        x0: Math.min(...pts.map((p) => p[0])),
        y0: Math.min(...pts.map((p) => p[1])),
        x1: Math.max(...pts.map((p) => p[0])),
        y1: Math.max(...pts.map((p) => p[1])),
      }
      return {
        ui,
        cabeca,
        canvas: { x: c.left, y: c.top, w: c.width, h: c.height },
        header: rel(header?.getBoundingClientRect()),
        nav: rel(nav?.getBoundingClientRect()),
        zonas,
      }
    }, PREFIXO[vida])
    const nome = `${OUT}/${vida}-${w}x${h}-${rotulo}${animado ? `-t${animado}` : ''}.png`
    const com = await page.screenshot({ path: nome, timeout: 180_000 })
    await page.evaluate(() => window.__heroDebug.setPropVisible(false))
    await page.waitForTimeout(1500)
    const sem = await page.screenshot({ timeout: 180_000 })
    await page.evaluate(() => window.__heroDebug.setPropVisible(true))
    // Canto de cima à esquerda: metade esquerda da tela, metade de cima (onde vivem o diagrama/chamada do topo).
    const esq = await caixaDiff(page, com, sem, dsf, [0, 0, w / 2, h / 2])
    medidas[`${vida}-${w}x${h}`] = { ...m, desenhoEsqCima: esq }
    const z = m.zonas.topo ?? m.zonas.esq
    const fimUi = Math.max(m.header?.y1 ?? 0, m.nav?.y1 ?? 0)
    const f = (q) => (q ? `${q.x0.toFixed(0)},${q.y0.toFixed(0)}–${q.x1.toFixed(0)},${q.y1.toFixed(0)}` : '-')
    console.log(`  ui ${f(m.ui)} cabeça ${f(m.cabeca)} zonas ${Object.entries(m.zonas).map(([k, q]) => `${k}:${f(q)}`).join(' ')}`)
    console.log(
      `${vida} ${w}x${h}`,
      'zona',
      z ? `${z.x0.toFixed(0)},${z.y0.toFixed(0)}–${z.x1.toFixed(0)},${z.y1.toFixed(0)}` : 'nenhuma',
      'desenho',
      esq ? `${esq.x0.toFixed(0)},${esq.y0.toFixed(0)}–${esq.x1.toFixed(0)},${esq.y1.toFixed(0)}` : 'nenhum',
      'fim cabeçalho/indicador',
      fimUi.toFixed(0),
    )
    await ctx.close()
  }
}
