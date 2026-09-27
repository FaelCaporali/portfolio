// Chuva de código do fullstack (F10, ADENDO 1) no site real (5199, SwiftShader), vida parada (?d=0), em cada tela:
// - contraste de cada linha de texto da UI (herói, cabeçalho, balão) sobre a chuva: a cor do texto contra o pixel mais
//   claro do canvas nos pixels do retângulo que a chuva mudou (a mesma cena com e sem `fs_chuva`, no mesmo quadro);
//   texto sobre fundo próprio opaco (botão cheio) não conta. Limite 4,5:1 (WCAG AA);
// - rosto: PESO visual da chuva = soma da luminância dos pixels da chuva ÷ soma da luminância da pele visível (limite
//   0,35, meu); informativos: média por pixel (chuva ÷ pele) e p95 da chuva. A média por pixel deixou de reprovar
//   porque a linha da frente legível (F10) é por definição mais clara que a pele: mede o texto, não a disputa;
// - várias amostras no tempo (a chuva anda); o pior valor vale. Com --reduzido, a camada da chuva tem de ficar igual.
// Uso: node 3d/tools/props/volta_prop_chuva.mjs [pasta] [rótulo] [--telas=1440x900,1024x768,360x740] [--amostras=6]
//        [--reduzido] [--limite-rosto=0.35]. Grava <rótulo>-chuva-<tela>[-reduzido].png e <rótulo>-chuva.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { TELAS, abrir, launch } from './site.mjs'

const args = process.argv.slice(2)
const [pasta = '3d/captura/props/fullstack/v1/site', rot = 'v1'] = args.filter((a) => !a.startsWith('--'))
const opc = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const reduzido = args.includes('--reduzido')
const pedidas = (opc('telas') ?? '1440x900,1024x768,360x740').split(',')
const AMOSTRAS = Number(opc('amostras') ?? 6)
const LIMITE_ROSTO = Number(opc('limite-rosto') ?? 0.35)
const CONTRASTE = 4.5
/** Legibilidade (Fael, F10): corpo mínimo da fonte (px CSS) por largura de tela e contraste da linha da frente. */
const CORPO = { 1440: 12, 1024: 11, 360: 10 }
const FRENTE = 7
const suf = reduzido ? '-reduzido' : ''
mkdirSync(pasta, { recursive: true })

/** Uma amostra, dentro da página: contraste por linha de texto e brilho da chuva contra a pele. */
function amostra() {
  const H = window.__heroDebug
  const M = H.medidas
  const k = H.camera().dpr
  const sec = document.querySelector('section[aria-label="Apresentação"]')
  const c = sec.querySelector('canvas').getBoundingClientRect()
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgba = (cor) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = cor
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data]
  }
  const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const com = M.cor()
  const sem = M.cor(['^fs_chuva$'])
  const chuva = new Uint8Array(com.w * com.h)
  let assinatura = 0
  for (let i = 0; i < chuva.length; i++) {
    const d = Math.max(...[0, 1, 2].map((j) => Math.abs(com.data[i * 4 + j] - sem.data[i * 4 + j])))
    if (d > 3) {
      chuva[i] = 1
      assinatura = (assinatura * 31 + i) % 1000000007
    }
  }
  // Linhas de texto da UI sobre o canvas (fundo próprio opaco = botão cheio: fora).
  const raizes = [sec, document.querySelector('div.fixed')].filter(Boolean)
  const textos = []
  for (const raiz of raizes) {
    const walk = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement
      if (!n.textContent.trim() || el.closest('.sr-only')) continue
      let proprio = false
      for (let p = el; p && p !== sec && p !== document.body; p = p.parentElement)
        if (rgba(getComputedStyle(p).backgroundColor)[3] >= 128) proprio = true
      if (proprio) continue
      const [r, g, b] = rgba(getComputedStyle(el).color)
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const q of range.getClientRects()) {
        if (q.width < 2 || q.height < 2) continue
        textos.push({ texto: n.textContent.trim().slice(0, 24), x: q.left - c.left, y: q.top - c.top, w: q.width, h: q.height, lt: lum(r, g, b) })
      }
    }
  }
  const linhas = []
  for (const t of textos) {
    let [n, lmax] = [0, 0]
    for (let y = Math.max(0, Math.floor(t.y * k)); y < Math.min(com.h, Math.ceil((t.y + t.h) * k)); y++)
      for (let x = Math.max(0, Math.floor(t.x * k)); x < Math.min(com.w, Math.ceil((t.x + t.w) * k)); x++) {
        const i = y * com.w + x
        if (!chuva[i]) continue
        n++
        lmax = Math.max(lmax, lum(com.data[i * 4], com.data[i * 4 + 1], com.data[i * 4 + 2]))
      }
    if (!n) continue
    const contraste = (Math.max(t.lt, lmax) + 0.05) / (Math.min(t.lt, lmax) + 0.05)
    linhas.push({ texto: t.texto, px: Math.round(n / (k * k)), contraste: +contraste.toFixed(2) })
  }
  // Rosto: chuva × pele visível.
  const pele = M.mascara([['^bust$', 'preto']])
  let [lp, np] = [0, 0]
  const lc = []
  for (let i = 0; i < chuva.length; i++) {
    const l = lum(com.data[i * 4], com.data[i * 4 + 1], com.data[i * 4 + 2])
    if (pele.data[i]) {
      lp += l
      np++
    } else if (chuva[i]) lc.push(l)
  }
  lc.sort((a, b) => a - b)
  const media = lc.length ? lc.reduce((s, v) => s + v, 0) / lc.length : 0
  // Legibilidade: corpo da fonte (px CSS) pela projeção do plano e contraste da linha da frente de cada coluna (o
  // pixel mais claro da chuva visível na coluna) contra o fundo #0b0b0e.
  const m = M.objeto('fs_chuva')
  const gr = m.userData.grade
  const frame = M.objeto('bust').parent
  const inv = frame.matrixWorld.clone().invert()
  const V = m.position.constructor
  const { width: W, height: Hp } = m.geometry.parameters
  const pj = (x, y) => M.projetar(new V(x, y, 0).applyMatrix4(m.matrixWorld).applyMatrix4(inv).toArray())
  const [, yT] = pj(0, Hp / 2)
  const [, yB] = pj(0, -Hp / 2)
  const corpo = (Math.abs(yB - yT) / k / gr.linhas) * gr.corpo
  const lf = lum(11, 11, 14)
  const colunas = []
  // As colunas ocupam o plano à direita de uMin (a parte da esquerda fica fora, sob o texto da UI).
  const uMin = m.material.uniforms.uMin?.value ?? 0
  const xCol = (f) => -W / 2 + W * (uMin + (f / gr.colunas) * (1 - uMin))
  for (let i = 0; i < gr.colunas; i++) {
    const [x0] = pj(xCol(i), 0)
    const [x1] = pj(xCol(i + 1), 0)
    const [cx] = pj(xCol(i + 0.5), 0)
    if (cx < 0 || cx >= com.w) continue
    const ls = []
    for (let y = Math.max(0, Math.floor(Math.min(yT, yB))); y < Math.min(com.h, Math.ceil(Math.max(yT, yB))); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(com.w, Math.ceil(x1)); x++) {
        const j = y * com.w + x
        if (chuva[j] && !pele.data[j]) ls.push(lum(com.data[j * 4], com.data[j * 4 + 1], com.data[j * 4 + 2]))
      }
    ls.sort((a, b) => a - b)
    // O pixel mais claro da coluna: o miolo de um glifo da frente (o rastro tem no máximo ~55% do alfa); o p99,5
    // caía no rastro quando a linha da frente era curta ("}").
    const l = ls[ls.length - 1] ?? 0
    colunas.push({ coluna: i, px: Math.round(ls.length / (k * k)), frente: +((l + 0.05) / (lf + 0.05)).toFixed(2) })
  }
  return {
    corpoPx: +corpo.toFixed(1),
    colunas,
    textos: textos.length,
    linhas,
    chuvaPx: Math.round(lc.length / (k * k)),
    chuvaMedia: +media.toFixed(4),
    chuvaP95: +(lc[Math.floor(lc.length * 0.95)] ?? 0).toFixed(4),
    peleMedia: np ? +(lp / np).toFixed(4) : null,
    peso: lp ? +(lc.reduce((s, v) => s + v, 0) / lp).toFixed(4) : null,
    assinatura,
  }
}

const browser = await launch()
const saida = {}
const falhas = []
for (const [w, h, dsf] of TELAS.filter(([a, b]) => pedidas.includes(`${a}x${b}`))) {
  const tela = `${w}x${h}`
  const { ctx, page } = await abrir(browser, { viewport: { width: w, height: h }, dsf, reduzido, query: 'slot=fullstack&d=0' })
  await page.waitForTimeout(6000)
  const amostras = []
  for (let i = 0; i < AMOSTRAS; i++) {
    if (i) await page.waitForTimeout(700)
    amostras.push(await page.evaluate(amostra))
  }
  await page.screenshot({ path: `${pasta}/${rot}-chuva-${tela}${suf}.png` })
  await ctx.close()
  const todas = amostras.flatMap((a) => a.linhas)
  const pior = todas.reduce((m, l) => (!m || l.contraste < m.contraste ? l : m), null)
  const razao = Math.max(...amostras.map((a) => (a.peleMedia ? a.chuvaMedia / a.peleMedia : 0)))
  const corpo = Math.min(...amostras.map((a) => a.corpoPx))
  const frentes = {}
  for (const a of amostras)
    for (const c of a.colunas) if (c.px > 0) frentes[c.coluna] = Math.max(frentes[c.coluna] ?? 0, c.frente)
  const piorFrente = Math.min(...Object.values(frentes))
  if (corpo < (CORPO[w] ?? 0)) falhas.push(`${tela}: corpo da fonte ${corpo} px (< ${CORPO[w]})`)
  if (!(piorFrente >= FRENTE)) falhas.push(`${tela}: linha da frente com contraste ${piorFrente}:1 (< ${FRENTE})`)
  const r = {
    corpoPx: corpo,
    frentePorColuna: frentes,
    amostras: amostras.map(({ linhas, ...x }) => ({ ...x, linhasSobChuva: linhas.length })),
    piorContraste: pior,
    abaixo: todas.filter((l) => l.contraste < CONTRASTE),
    razaoRosto: +razao.toFixed(3),
    pesoRosto: Math.max(...amostras.map((a) => a.peso ?? 0)),
  }
  if (r.abaixo.length) falhas.push(`${tela}: ${r.abaixo.length} linha(s) de texto < ${CONTRASTE}:1 (pior ${pior.texto} ${pior.contraste})`)
  if (r.pesoRosto > LIMITE_ROSTO) falhas.push(`${tela}: peso da chuva/pele ${r.pesoRosto} > ${LIMITE_ROSTO}`)
  if (reduzido && new Set(amostras.map((a) => a.assinatura)).size > 1) falhas.push(`${tela}: a chuva andou com movimento reduzido`)
  if (!amostras.some((a) => a.chuvaPx > 0)) falhas.push(`${tela}: nenhuma chuva na tela`)
  saida[tela] = r
  const px = amostras.map((a) => a.chuvaPx).join('/')
  console.log(
    `${tela} chuva ${px} px; pior contraste ${pior ? `${pior.contraste}:1 (${pior.texto}, ${pior.px} px)` : 'sem texto sobre a chuva'};` +
      ` peso chuva/pele ${r.pesoRosto}; média chuva/pele ${r.razaoRosto} (p95 ${Math.max(...amostras.map((a) => a.chuvaP95))});` +
      ` corpo ${corpo} px; frente por coluna ${Object.values(frentes).join('/')}:1`,
  )
}
await browser.close()
writeFileSync(
  `${pasta}/${rot}-chuva${suf}.json`,
  JSON.stringify({ limites: { contraste: CONTRASTE, rosto: LIMITE_ROSTO }, reduzido, telas: saida, falhas }, null, 2),
)
console.log(falhas.length ? `REPROVA\n - ${falhas.join('\n - ')}` : 'PASSA')
process.exitCode = falhas.length ? 1 : 0
